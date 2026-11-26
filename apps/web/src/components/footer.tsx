import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from './equipment-art';

export async function Footer() {
  const t = await getTranslations();
  return (
    <footer className="mt-16 border-t border-soil-200 bg-leaf-900 text-leaf-50">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Logo className="size-8" /><span className="font-display text-xl font-bold">{t('common.appName')}</span></div>
          <p className="font-medium text-turmeric-500">{t('common.tagline')}</p>
          <p className="max-w-md text-leaf-100">{t('footer.about')}</p>
        </div>
        <ul className="space-y-2">
          <li><Link href="/equipment" className="hover:underline">{t('nav.explore')}</Link></li>
          <li><Link href="/listings/new" className="hover:underline">{t('nav.addEquipment')}</Link></li>
          <li><Link href="/forgot-password" className="hover:underline">{t('auth.forgot')}</Link></li>
        </ul>
        <div className="space-y-2 text-sm text-leaf-200">
          <p>{t('listing.safety')}</p>
          <p>{t('footer.dataAttribution')}</p>
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
