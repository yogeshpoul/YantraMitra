import type { CategoryDto, OperationDto, Paginated, ListingCardDto } from '@yantramitra/shared-types';
import type { SearchData } from '@yantramitra/shared-validation';
import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { toQueryString } from '@/lib/search-params';
import { ExploreFilters } from './explore-filters';
import { ListingGrid } from './listing-card';
import type { SearchLocation } from './location-context';
import { Pagination } from './pagination';
import { EmptyState } from './ui';

/** Results page shared by /equipment, category, type and locality pages. Server-rendered for SEO. */
export async function ExploreView({ heading, intro, breadcrumbs, query, results, categories, operations, urlLocation, basePath = '/equipment' }: {
  heading: string; intro?: ReactNode; breadcrumbs?: ReactNode; query: SearchData; results: Paginated<ListingCardDto>;
  categories: CategoryDto[]; operations: OperationDto[]; urlLocation: SearchLocation | null; basePath?: string;
}) {
  const t = await getTranslations('search');
  const pageHref = (page: number) => `${basePath}${toQueryString({ ...(query as Record<string, string | number | undefined>), page })}`;
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-3 lg:col-span-2">
        {breadcrumbs}
        <h1 className="text-3xl font-bold">{heading}</h1>
        {intro}
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <ExploreFilters query={query} categories={categories} operations={operations} urlLocation={urlLocation} />
      </aside>
      <section aria-labelledby="results-title" className="space-y-4">
        <h2 id="results-title" className="text-lg font-semibold text-muted" aria-live="polite" data-testid="results-count">{t('results', { count: results.total })}</h2>
        {results.items.length === 0
          ? <EmptyState icon={<SearchX className="size-12" />} title={t('emptyTitle')} text={t('emptyText')} />
          : <ListingGrid items={results.items} />}
        <Pagination page={results.page} totalPages={results.totalPages} href={pageHref} />
      </section>
    </div>
  );
}
