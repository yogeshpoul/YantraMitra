'use client';
import { REPORT_REASONS, type ContactDto, type ListingDetailDto, type ReportReason } from '@yantramitra/shared-types';
import { Flag, MessageCircle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useErrorText } from '@/lib/errors';
import { useAuth } from './auth-context';
import { Dialog } from './dialog';
import { FavoriteButton } from './favorite-button';
import { Alert, Button, buttonClass, Field, Select, Textarea } from './ui';

/**
 * The phone number is fetched only on an explicit tap by a signed-in user, so it never appears in
 * page HTML, metadata or anything a search engine can read. Calls are never started automatically.
 */
export function ContactOwner({ listing }: { listing: ListingDetailDto }) {
  const t = useTranslations('listing');
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const errorText = useErrorText();
  const [contact, setContact] = useState<ContactDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (listing.status !== 'active') return <Alert tone="warning">{t('notActive')}</Alert>;
  if (!listing.contactEnabled) return <Alert tone="info">{t('contactDisabled')}</Alert>;
  if (loading) return <Button className="w-full" loading>{t('contactOwner')}</Button>;
  if (!user)
    return (
      <div className="space-y-2">
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass('primary', 'w-full text-lg')} data-testid="login-to-contact">
          <Phone className="size-5" aria-hidden />{t('contactOwner')}
        </Link>
        <p className="text-center text-sm text-muted">{t('loginToContact')}</p>
      </div>
    );

  const reveal = async () => {
    setBusy(true);
    setError(null);
    try { setContact(await api.equipment.contact(listing.id)); } catch (e) { setError(errorText(e).message); } finally { setBusy(false); }
  };
  const track = (type: 'call_click' | 'whatsapp_click') => void api.equipment.contactEvent(listing.id, type).catch(() => undefined);

  if (!contact)
    return (
      <div className="space-y-2">
        <Button className="w-full text-lg" onClick={reveal} loading={busy} data-testid="show-number"><Phone className="size-5" aria-hidden />{t('showNumber')}</Button>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    );

  return (
    <div className="space-y-3" data-testid="contact-revealed">
      <p className="text-center text-2xl font-bold tracking-wide" data-testid="owner-phone">{contact.phone}</p>
      <a href={`tel:${contact.phone}`} onClick={() => track('call_click')} className={buttonClass('primary', 'w-full text-lg')}>
        <Phone className="size-5" aria-hidden />{t('call', { name: contact.ownerName })}
      </a>
      {contact.whatsappUrl && (
        <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('whatsapp_click')} className={buttonClass('secondary', 'w-full')}>
          <MessageCircle className="size-5" aria-hidden />{t('whatsapp')}
        </a>
      )}
      <p className="text-sm text-muted">{t('verifiedNotice')}</p>
    </div>
  );
}

export function ReportListing({ listingId }: { listingId: string }) {
  const t = useTranslations('listing');
  const { user } = useAuth();
  const pathname = usePathname();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});

  if (!user)
    return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={buttonClass('ghost', 'text-sm')}><Flag className="size-4" />{t('report')}</Link>;

  const send = async () => {
    if (!reason) return;
    setState({ busy: true });
    try {
      await api.equipment.report(listingId, { reason, details: details || null });
      setState({ done: true });
    } catch (e) {
      setState({ error: errorText(e).message });
    }
  };

  return (
    <>
      <Button variant="ghost" className="text-sm" onClick={() => setOpen(true)}><Flag className="size-4" aria-hidden />{t('report')}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('reportTitle')}>
        {state.done ? <Alert tone="success">{t('reportSent')}</Alert> : (
          <>
            <Field label={t('reportReason')}>
              {(p) => (
                <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                  <option value="" disabled>—</option>
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t('reportDetails')}>{(p) => <Textarea {...p} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}</Field>
            {state.error && <Alert tone="error">{state.error}</Alert>}
            <Button className="w-full" disabled={!reason} loading={state.busy} onClick={send}>{t('reportSend')}</Button>
          </>
        )}
      </Dialog>
    </>
  );
}

export function SaveListing({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const [initial, setInitial] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.users.favoriteIds().then((ids) => alive && setInitial(ids.includes(listingId)), () => alive && setInitial(false));
    return () => { alive = false; };
  }, [user, listingId]);
  return <FavoriteButton key={String(initial)} listingId={listingId} initial={initial ?? false} />;
}
