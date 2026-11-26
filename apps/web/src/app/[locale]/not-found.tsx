import { useTranslations } from 'next-intl';
import { EquipmentArt } from '@/components/equipment-art';
import { buttonClass, EmptyState } from '@/components/ui';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('state');
  return (
    <div className="container-page py-16">
      <EmptyState icon={<EquipmentArt iconKey="other" className="h-24" />} title={t('notFoundTitle')} text={t('notFoundText')}
        action={<Link href="/" className={buttonClass('primary')}>{t('goHome')}</Link>} />
    </div>
  );
}
