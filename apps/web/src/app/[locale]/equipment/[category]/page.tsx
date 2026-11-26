import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ExploreView } from '@/components/explore-view';
import { loadExplore } from '@/lib/explore';
import { pickName } from '@/lib/format';
import { parseSearch, type RawParams } from '@/lib/search-params';
import { localePrefix, pageMetadata } from '@/lib/seo';
import { revalidate, serverApi } from '@/lib/server-api';

type Props = { params: Promise<{ locale: string; category: string }>; searchParams: Promise<RawParams> };

async function findCategory(slug: string) {
  const categories = await serverApi.catalogue.categories(revalidate(300));
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  const name = pickName(category.names, locale);
  const filtered = Object.keys(await searchParams).length > 0;
  return pageMetadata({ locale, path: `/equipment/${slug}`, title: t('categoryTitle', { name }), description: t('categoryDescription', { name }), index: !filtered });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category: slug } = await params;
  setRequestLocale(locale);
  const category = await findCategory(slug);
  if (!category) notFound();
  const t = await getTranslations();
  const current = await getLocale();
  const data = await loadExplore(parseSearch(await searchParams, { category: slug }));
  const name = pickName(category.names, current);
  return (
    <ExploreView {...data} basePath={`/equipment/${slug}`} heading={t('seo.categoryTitle', { name })}
      breadcrumbs={<Breadcrumbs localePrefix={localePrefix(locale)} items={[{ label: t('listing.breadcrumbHome'), href: '/' }, { label: t('nav.explore'), href: '/equipment' }, { label: name }]} />} />
  );
}
