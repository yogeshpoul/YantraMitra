'use client';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/client-api';
import { useAuth } from './auth-context';
import { cx } from './ui';

export function FavoriteButton({ listingId, initial = false, compact }: { listingId: string; initial?: boolean; compact?: boolean }) {
  const t = useTranslations('listing');
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      await (next ? api.equipment.addFavorite(listingId) : api.equipment.removeFavorite(listingId));
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? t('saved') : t('save')} data-testid="favorite-button"
      className={cx('relative z-10 inline-flex min-h-11 items-center gap-2 rounded-full border font-medium transition-colors',
        compact ? 'border-transparent bg-white/90 p-2.5 shadow' : 'border-soil-200 bg-white px-4 hover:bg-leaf-50')}>
      <Heart className={cx('size-5', saved ? 'fill-red-600 text-red-600' : 'text-ink')} aria-hidden />
      {!compact && (saved ? t('saved') : t('save'))}
    </button>
  );
}
