import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const variants: Record<Variant, string> = {
  primary: 'bg-leaf-600 text-white hover:bg-leaf-700 disabled:bg-leaf-300',
  accent: 'bg-turmeric-500 text-ink hover:bg-turmeric-700 hover:text-white',
  secondary: 'bg-white text-leaf-800 border border-leaf-200 hover:bg-leaf-50',
  ghost: 'text-leaf-800 hover:bg-leaf-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};
export const buttonClass = (variant: Variant = 'primary', extra?: string) =>
  cx('inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70', variants[variant], extra);

export function Button({ variant = 'primary', loading, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button type="button" {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, className)}>
      {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, optional, id }: { label: ReactNode; hint?: ReactNode; error?: string; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; optional?: string; id?: string }) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = [hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 text-sm font-normal text-muted">({optional})</span>}
      </label>
      {children({ id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && <p id={`${fieldId}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${fieldId}-error`} className="flex items-center gap-1 text-sm font-medium text-red-700"><AlertCircle className="size-4" aria-hidden />{error}</p>}
    </div>
  );
}

const control = 'block min-h-12 w-full rounded-xl border border-soil-200 bg-white px-4 py-2.5 text-ink placeholder:text-muted/70 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-200 aria-[invalid=true]:border-red-600';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(control, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(control, 'pr-8', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={4} {...p} className={cx(control, p.className)} />;

export function Checkbox({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-soil-200 bg-white p-3 has-[:checked]:border-leaf-500 has-[:checked]:bg-leaf-50">
      <input type="checkbox" {...props} className="mt-1 size-5 shrink-0 accent-leaf-600" />
      <span>
        <span className="font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  const tones = { neutral: 'bg-soil-100 text-soil-700', green: 'bg-leaf-100 text-leaf-800', amber: 'bg-turmeric-100 text-turmeric-700', red: 'bg-red-100 text-red-800' };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium', tones[tone])}>{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-soil-200 bg-white p-5 shadow-sm', className)}>{children}</div>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = { info: 'border-leaf-200 bg-leaf-50 text-leaf-900', error: 'border-red-200 bg-red-50 text-red-900', success: 'border-leaf-300 bg-leaf-50 text-leaf-900', warning: 'border-turmeric-500/40 bg-turmeric-100 text-soil-700' };
  const Icon = tone === 'error' || tone === 'warning' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-4', styles[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx('animate-pulse rounded-xl bg-soil-100', className)} />;

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-soil-200 bg-white px-6 py-12 text-center">
      {icon && <div className="text-leaf-600">{icon}</div>}
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="max-w-md text-muted">{text}</p>}
      {action}
    </div>
  );
}
