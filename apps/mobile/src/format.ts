import { areaText, type LocalizedName, type PricingDto, type PublicArea } from '@yantramitra/shared-types';

export const pickName = (n: LocalizedName, locale: string) => n[locale as keyof LocalizedName] ?? n.en;

type T = (key: string, values?: Record<string, string | number>) => string;

export function priceLabel(p: PricingDto, t: T, locale: string): string {
  if (p.price == null) return t('pricing.contactForPrice');
  const money = new Intl.NumberFormat(`${locale}-IN-u-nu-latn`, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.price);
  const unit = t(`pricing.unit.${p.type}`);
  return unit ? `${money} ${unit}` : money;
}

export const areaLabel = (a: PublicArea, fallback: string) => areaText(a) || fallback;
