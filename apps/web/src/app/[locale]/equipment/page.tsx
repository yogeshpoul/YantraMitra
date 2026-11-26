import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExploreView } from '@/components/explore-view';
import { loadExplore } from '@/lib/explore';
import { parseSearch, type RawParams } from '@/lib/search-params';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  // Filter combinations are not indexed (no thin pages); the plain explore page is.
  const filtered = Object.keys(await searchParams).length > 0;
  return pageMetadata({ locale, path: '/equipment', title: t('exploreTitle'), description: t('exploreDescription'), index: !filtered });
}

export default async function ExplorePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');
  const data = await loadExplore(parseSearch(await searchParams));
  return <ExploreView heading={t('title')} {...data} />;
}
