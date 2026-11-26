import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { siteUrl } from '@/lib/server-api';
import { JsonLd } from './json-ld';

export interface Crumb {
  label: string;
  href?: string;
}

/** Visible breadcrumbs plus BreadcrumbList structured data. */
export function Breadcrumbs({ items, localePrefix }: { items: Crumb[]; localePrefix: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-4" aria-hidden />}
              {c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-leaf-700 hover:underline">{c.label}</Link> : <span aria-current="page" className="font-medium text-ink">{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: `${siteUrl()}${localePrefix}${c.href === '/' ? '' : c.href}` || siteUrl() } : {}) })),
      }} />
    </>
  );
}
