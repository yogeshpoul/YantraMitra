import { Phone } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buttonClass, Card } from '@/components/ui';
import { Link } from '@/i18n/navigation';

/**
 * No paid OTP: recovery is administrator-assisted. An admin verifies the person offline and issues a
 * one-time temporary password that must be changed at the next login.
 */
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const support = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  return (
    <div className="container-page max-w-md py-10">
      <Card className="space-y-5 p-6">
        <h1 className="text-3xl font-bold">{t('forgotTitle')}</h1>
        <p>{t('forgotText')}</p>
        {support && <a href={`tel:${support}`} className={buttonClass('primary', 'w-full')}><Phone className="size-5" />{support}</a>}
        <Link href="/login" className={buttonClass('secondary', 'w-full')}>{t('loginButton')}</Link>
      </Card>
    </div>
  );
}
