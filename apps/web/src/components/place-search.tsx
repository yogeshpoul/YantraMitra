'use client';
import type { PlaceDto } from '@yantramitra/shared-types';
import { Loader2, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import { Input } from './ui';

/** Accessible autocomplete over villages, towns, talukas, districts, states and PIN codes. */
export function PlaceSearch({ onSelect, autoFocus, label }: { onSelect: (p: PlaceDto) => void; autoFocus?: boolean; label?: string }) {
  const t = useTranslations('location');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api.locations.search(q, 8).then(
        (r) => { if (id === seq.current) { setResults(r); setOpen(true); setActive(-1); } },
        () => { if (id === seq.current) setResults([]); },
      ).finally(() => { if (id === seq.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (p: PlaceDto) => { onSelect(p); setQuery(''); setResults([]); setOpen(false); };

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>{label ?? t('searchPlaceholder')}</label>
      <Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted" aria-hidden />
      <Input id={`${listId}-input`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="pl-10" autoFocus={autoFocus} value={query} placeholder={t('searchPlaceholder')} autoComplete="off"
        onChange={(e) => setQuery(e.target.value)} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active >= 0 ? active : 0]) { e.preventDefault(); choose(results[active >= 0 ? active : 0]!); }
          if (e.key === 'Escape') setOpen(false);
        }} />
      {loading && <Loader2 className="absolute right-3 top-3.5 size-5 animate-spin text-muted" aria-hidden />}
      {open && query.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-soil-200 bg-white py-1 shadow-lg">
          {results.length === 0 && !loading && <li className="px-4 py-3 text-muted">{t('noResults')}</li>}
          {results.map((p, i) => (
            <li key={`${p.slug ?? p.label}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              className={`flex cursor-pointer items-start gap-2 px-4 py-2.5 ${i === active ? 'bg-leaf-50' : 'hover:bg-leaf-50'}`}>
              <MapPin className="mt-1 size-4 shrink-0 text-leaf-600" aria-hidden />
              <span><span className="font-medium">{p.kind === 'postal' ? `${p.postalCode} · ${p.name}` : p.name}</span>
                {['taluka', 'district', 'state', 'postal'].includes(p.kind) && <span className="ml-2 rounded bg-soil-100 px-1.5 text-xs text-soil-700">{t(`kind.${p.kind}`)}</span>}
                <span className="block text-sm text-muted">{[p.taluka, p.district, p.state].filter(Boolean).join(', ')}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
