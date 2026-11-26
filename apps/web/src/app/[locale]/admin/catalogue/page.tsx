'use client';
import { ICON_KEYS, type AdminCategoryDto, type AdminEquipmentTypeDto, type AdminOperationDto } from '@yantramitra/shared-types';
import { createCategorySchema, createEquipmentTypeSchema, createOperationSchema, fieldErrors } from '@yantramitra/shared-validation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/components/dialog';
import { EquipmentArt } from '@/components/equipment-art';
import { Alert, Badge, Button, Checkbox, cx, Field, Input, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/client-api';
import { useErrorText, useFieldText } from '@/lib/errors';

type Kind = 'categories' | 'equipment-types' | 'operations';
type Row = AdminCategoryDto | AdminEquipmentTypeDto | AdminOperationDto;
interface Draft { id: string | null; slug: string; en: string; mr: string; hi: string; iconKey: string; categoryId: string; sortOrder: string; isActive: boolean }

const SCHEMAS = { categories: createCategorySchema, 'equipment-types': createEquipmentTypeSchema, operations: createOperationSchema };

export default function AdminCatalogue() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const tv = useFieldText();
  const [kind, setKind] = useState<Kind>('categories');
  const [data, setData] = useState<{ categories: AdminCategoryDto[]; types: AdminEquipmentTypeDto[]; operations: AdminOperationDto[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<{ busy?: boolean; error?: string; fields?: Record<string, string> }>({});

  const load = useCallback(() => {
    Promise.all([api.admin.categories(), api.admin.equipmentTypes(), api.admin.operations()]).then(
      ([categories, types, operations]) => setData({ categories, types, operations }),
      (e) => setState({ error: errorText(e).message }),
    );
  }, [errorText]);
  useEffect(load, [load]);

  const rows: Row[] = !data ? [] : kind === 'categories' ? data.categories : kind === 'operations' ? data.operations : data.types;
  const edit = (r: Row | null) => setDraft({
    id: r?.id ?? null, slug: r?.slug ?? '', en: r?.names.en ?? '', mr: r?.names.mr ?? '', hi: r?.names.hi ?? '',
    iconKey: (r && 'iconKey' in r ? r.iconKey : null) ?? (kind === 'categories' ? 'other' : ''),
    categoryId: r && 'categoryId' in r ? r.categoryId : data?.categories[0]?.id ?? '', sortOrder: String(r?.sortOrder ?? 100), isActive: r?.isActive ?? true,
  });

  const save = async () => {
    if (!draft) return;
    const body: Record<string, unknown> = { slug: draft.slug, names: { en: draft.en, mr: draft.mr, hi: draft.hi }, sortOrder: Number(draft.sortOrder), isActive: draft.isActive };
    if (kind === 'categories') body.iconKey = draft.iconKey;
    if (kind === 'equipment-types') { body.iconKey = draft.iconKey || null; if (!draft.id) body.categoryId = draft.categoryId; }
    const parsed = SCHEMAS[kind].safeParse(draft.id ? { ...body, categoryId: draft.categoryId } : body);
    if (!parsed.success) return setState({ fields: tv(fieldErrors(parsed.error)) });
    setState({ busy: true });
    try {
      await api.admin.saveCatalogue(kind, draft.id, body);
      setDraft(null);
      setState({});
      load();
    } catch (e) {
      const r = errorText(e);
      setState({ error: r.message, fields: r.fields });
    }
  };

  const tabs: [Kind, string][] = [['categories', t('categories')], ['equipment-types', t('types')], ['operations', t('operations')]];
  const categoryName = (id: string) => data?.categories.find((c) => c.id === id)?.names.en ?? '';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{t('catalogue')}</h1>
        <Button onClick={() => edit(null)} data-testid="catalogue-add"><Plus className="size-5" />{t('add')}</Button>
      </div>
      <div role="tablist" className="flex gap-1">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={cx('min-h-11 rounded-full px-4 font-medium', kind === k ? 'bg-leaf-600 text-white' : 'bg-white hover:bg-leaf-50')}>{label}</button>
        ))}
      </div>
      {state.error && !draft && <Alert tone="error">{state.error}</Alert>}
      {!data && <Skeleton className="h-64" />}
      <ul className="divide-y divide-soil-100 rounded-xl border border-soil-200 bg-white">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            {'iconKey' in r && <EquipmentArt iconKey={r.iconKey} className="h-8 w-12 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.names.en} · {r.names.mr} · {r.names.hi}</p>
              <p className="font-mono text-sm text-muted">{r.slug}{'categoryId' in r ? ` · ${categoryName(r.categoryId)}` : ''} · #{r.sortOrder}</p>
            </div>
            <Badge tone={r.isActive ? 'green' : 'neutral'}>{r.isActive ? t('active') : t('inactive')}</Badge>
            <Button variant="secondary" className="min-h-10" onClick={() => edit(r)}>✎</Button>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? draft.en : t('add')}>
        {draft && (
          <div className="space-y-3">
            {state.error && <Alert tone="error">{state.error}</Alert>}
            <Field label={t('slug')} error={state.fields?.slug}>{(p) => <Input {...p} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} />}</Field>
            {(['en', 'mr', 'hi'] as const).map((l) => (
              <Field key={l} label={t(`name${l[0]!.toUpperCase()}${l[1]}` as 'nameEn')} error={state.fields?.[`names.${l}`]}>
                {(p) => <Input {...p} value={draft[l]} onChange={(e) => setDraft({ ...draft, [l]: e.target.value })} lang={l} />}
              </Field>
            ))}
            {kind === 'equipment-types' && !draft.id && (
              <Field label={t('parentCategory')}>{(p) => (
                <Select {...p} value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                  {data?.categories.map((c) => <option key={c.id} value={c.id}>{c.names.en}</option>)}
                </Select>)}
              </Field>
            )}
            {kind !== 'operations' && (
              <Field label={t('icon')}>{(p) => (
                <Select {...p} value={draft.iconKey} onChange={(e) => setDraft({ ...draft, iconKey: e.target.value })}>
                  {kind === 'equipment-types' && <option value="">—</option>}
                  {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </Select>)}
              </Field>
            )}
            <Field label={t('sortOrder')}>{(p) => <Input {...p} inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />}</Field>
            <Checkbox label={t('active')} checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            <Button className="w-full" loading={state.busy} onClick={save}>{tc('save')}</Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
