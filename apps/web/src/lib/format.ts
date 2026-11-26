import { areaText, type LocalizedName, type PricingDto, type PublicArea } from '@yantramitra/shared-types';

export const pickName = (names: LocalizedName, locale: string): string => names[locale as keyof LocalizedName] ?? names.en;

export const intlLocale = (locale: string) => `${locale}-IN-u-nu-latn`;

export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}

type T = (key: string, values?: Record<string, string | number>) => string;

/** "₹900 /hour" or "Price on request". */
export function priceLabel(pricing: PricingDto, t: T, locale: string): string {
  if (pricing.price == null) return t('pricing.contactForPrice');
  const unit = t(`pricing.unit.${pricing.type}`);
  return `${formatMoney(pricing.price, pricing.currency, locale)}${unit ? ` ${unit}` : ''}`;
}

export function areaLabel(area: PublicArea | null | undefined, fallback: string): string {
  return (area && areaText(area)) || fallback;
}

/** Short form for cards: locality and district. */
export function shortArea(area: PublicArea, fallback: string): string {
  return areaText({ locality: area.locality, district: area.district, state: null }) || fallback;
}
