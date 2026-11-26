'use client';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './ui';

/** Native <dialog>: focus trapping, Escape and backdrop handled by the browser. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations('common');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-soil-200 p-0 shadow-xl backdrop:bg-ink/50">
      <div className="flex items-start justify-between gap-4 border-b border-soil-100 p-5">
        <h2 id="dialog-title" className="text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-1 hover:bg-soil-100"><X className="size-6" /></button>
      </div>
      <div className="space-y-4 p-5">{open && children}</div>
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel, danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: string; confirmLabel: string; danger?: boolean; loading?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-muted">{text}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-testid="confirm-button">{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
