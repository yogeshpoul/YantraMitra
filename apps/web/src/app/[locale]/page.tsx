import { Handshake, PhoneCall, Search } from 'lucide-react';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { EquipmentArt } from '@/components/equipment-art';
import { HomeNearby } from '@/components/home-nearby';
import { HomeSearch } from '@/components/home-search';
import { JsonLd } from '@/components/json-ld';
import { buttonClass } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { pickName } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';
import { revalidate, serverApi, siteUrl } from '@/lib/server-api';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({ locale, path: '/', title: t('homeTitle'), description: t('homeDescription') });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const current = await getLocale();
  const [categories, operations] = await Promise.all([
    serverApi.catalogue.categories(revalidate(300)).catch(() => []),
    serverApi.catalogue.operations(revalidate(300)).catch(() => []),
  ]);

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'YantraMitra', url: siteUrl(),
        potentialAction: { '@type': 'SearchAction', target: `${siteUrl()}/equipment?q={q}`, 'query-input': 'required name=q' } }} />
      <section className="border-b border-soil-200 bg-linear-to-b from-leaf-50 to-soil-50">
        <div className="container-page grid items-center gap-8 py-10 md:grid-cols-[3fr_2fr] md:py-14">
          <div className="space-y-5">
            <p className="font-semibold text-turmeric-700">{t('common.tagline')}</p>
            <h1 className="text-4xl font-bold md:text-5xl">{t('home.heroTitle')}</h1>
            <p className="max-w-xl text-lg text-muted">{t('home.heroSubtitle')}</p>
            <HomeSearch />
          </div>
          <div className="hidden justify-center md:flex" aria-hidden>
            <EquipmentArt iconKey="tractor" className="w-full max-w-sm drop-shadow-sm" />
          </div>
        </div>
      </section>

      <section className="container-page space-y-4 py-10" aria-labelledby="work-title">
        <h2 id="work-title" className="text-2xl font-bold">{t('home.workTitle')}</h2>
        <ul className="flex flex-wrap gap-2">
          {operations.map((o) => (
            <li key={o.id}>
              <Link href={`/equipment?operation=${o.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-leaf-200 bg-white px-4 font-medium text-leaf-800 hover:bg-leaf-50">
                {pickName(o.names, current)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page space-y-4 pb-10" aria-labelledby="cat-title">
        <h2 id="cat-title" className="text-2xl font-bold">{t('home.categoriesTitle')}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/equipment/${c.slug}`} className="flex h-full flex-col items-center gap-2 rounded-2xl border border-soil-200 bg-white p-4 text-center font-semibold hover:border-leaf-300 hover:shadow-sm">
                <EquipmentArt iconKey={c.iconKey} className="h-16 w-auto" />
                {pickName(c.names, current)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <HomeNearby />

      <section className="bg-white py-12" aria-labelledby="how-title">
        <div className="container-page space-y-6">
          <h2 id="how-title" className="text-2xl font-bold">{t('home.howTitle')}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[[Search, 'how1'], [PhoneCall, 'how2'], [Handshake, 'how3']].map(([Icon, key], i) => {
              const I = Icon as typeof Search;
              return (
                <li key={key as string} className="flex gap-4 rounded-2xl bg-soil-50 p-5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-white"><I className="size-6" aria-hidden /></span>
                  <div>
                    <h3 className="text-lg font-semibold">{i + 1}. {t(`home.${key as string}Title`)}</h3>
                    <p className="text-muted">{t(`home.${key as string}Text`)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-leaf-800 p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('home.ctaTitle')}</h2>
            <p className="text-leaf-100">{t('home.ctaText')}</p>
          </div>
          <Link href="/listings/new" className={buttonClass('accent', 'text-lg')}>{t('home.ctaButton')}</Link>
        </div>
      </section>
    </>
  );
}
