import { areaText, googleMapsUrl, listingIdFromSlug, type ListingDetailDto } from '@yantramitra/shared-types';
import { CalendarDays, ExternalLink, Fuel, MapPin, Truck, UserRound } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { AreaMapLazy } from '@/components/area-map-lazy';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EquipmentArt } from '@/components/equipment-art';
import { ExploreView } from '@/components/explore-view';
import { JsonLd } from '@/components/json-ld';
import { ContactOwner, ReportListing, SaveListing } from '@/components/listing-actions';
import { Alert, Badge, Card } from '@/components/ui';
import { loadExplore } from '@/lib/explore';
import { areaLabel, pickName, priceLabel } from '@/lib/format';
import { parseSearch, type RawParams } from '@/lib/search-params';
import { localePrefix, localeUrl, pageMetadata } from '@/lib/seo';
import { orNotFound, revalidate, serverApi } from '@/lib/server-api';

type Props = { params: Promise<{ locale: string; category: string; slug: string }>; searchParams: Promise<RawParams> };

async function loadType(categorySlug: string, typeSlug: string) {
  const categories = await serverApi.catalogue.categories(revalidate(300));
  const category = categories.find((c) => c.slug === categorySlug);
  const type = category?.types.find((t) => t.slug === typeSlug);
  return category && type ? { category, type } : null;
}

const loadListing = (id: string) => orNotFound(serverApi.equipment.get(id, revalidate(30)));

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, category, slug } = await params;
  const t = await getTranslations({ locale });
  const id = listingIdFromSlug(slug);
  if (id) {
    const l = await loadListing(id);
    const type = pickName(l.type.names, locale);
    const area = areaLabel(l.location, t('location.unknownArea'));
    const price = priceLabel(l.pricing, t, locale);
    // Built from public fields only: no owner name, phone or exact location.
    return pageMetadata({
      locale, path: l.path,
      title: t('seo.detailTitle', { title: l.title, type, area }),
      description: t('seo.detailDescription', { type, area, price }),
      index: l.status === 'active',
    });
  }
  const found = await loadType(category, slug);
  if (!found) return {};
  const name = pickName(found.type.names, locale);
  const filtered = Object.keys(await searchParams).length > 0;
  return pageMetadata({ locale, path: `/equipment/${category}/${slug}`, title: t('seo.categoryTitle', { name }), description: t('seo.categoryDescription', { name }), index: !filtered });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale, category, slug } = await params;
  setRequestLocale(locale);
  const id = listingIdFromSlug(slug);
  if (id) {
    const listing = await loadListing(id);
    // Canonical path is derived from catalogue slugs; old or mistyped paths redirect to it.
    if (listing.path !== `/equipment/${category}/${slug}`) permanentRedirect(listing.path);
    return <ListingDetail listing={listing} locale={locale} />;
  }

  const found = await loadType(category, slug);
  if (!found) notFound();
  const t = await getTranslations();
  const data = await loadExplore(parseSearch(await searchParams, { category, type: slug }));
  const name = pickName(found.type.names, locale);
  return (
    <ExploreView {...data} basePath={`/equipment/${category}/${slug}`} heading={t('seo.categoryTitle', { name })}
      breadcrumbs={<Breadcrumbs localePrefix={localePrefix(locale)} items={[
        { label: t('listing.breadcrumbHome'), href: '/' }, { label: t('nav.explore'), href: '/equipment' },
        { label: pickName(found.category.names, locale), href: `/equipment/${category}` }, { label: name },
      ]} />} />
  );
}

async function ListingDetail({ listing, locale }: { listing: ListingDetailDto; locale: string }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const typeName = pickName(listing.type.names, locale);
  const area = areaLabel(listing.location, t('location.unknownArea'));
  const p = listing.pricing;
  const mapsUrl = googleMapsUrl({ point: listing.location.point, areaText: areaText(listing.location) });

  const conditions: [typeof Fuel, string, string][] = [
    [UserRound, t('terms.operator'), t(`terms.operatorValues.${listing.operatorTerm}`)],
    [Fuel, t('terms.fuel'), t(`terms.fuelValues.${listing.fuelTerm}`)],
    [Truck, t('terms.transport'), t(`terms.transportValues.${listing.transportTerm}`)],
  ];
  const details = [
    [t('listing.manufacturer'), listing.manufacturer],
    [t('listing.model'), listing.model],
    [t('listing.year'), listing.manufacturingYear?.toString()],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <div className="container-page space-y-6 py-6">
      <Breadcrumbs localePrefix={localePrefix(locale)} items={[
        { label: t('listing.breadcrumbHome'), href: '/' }, { label: t('nav.explore'), href: '/equipment' },
        { label: pickName(listing.category.names, locale), href: `/equipment/${listing.category.slug}` },
        { label: typeName, href: `/equipment/${listing.category.slug}/${listing.type.slug}` }, { label: listing.title },
      ]} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Product', name: listing.title, category: typeName,
        description: listing.description ?? undefined, brand: listing.manufacturer ? { '@type': 'Brand', name: listing.manufacturer } : undefined,
        url: localeUrl(locale, listing.path),
        offers: p.price != null ? {
          '@type': 'Offer', priceCurrency: p.currency, price: p.price, businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
          availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          areaServed: area,
        } : undefined,
      }} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="flex h-56 items-center justify-center rounded-3xl bg-linear-to-b from-leaf-50 to-soil-100">
            <EquipmentArt iconKey={listing.type.iconKey} fallbackKey={listing.category.iconKey} className="h-44 w-auto" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{typeName}</Badge>
              <Badge tone={listing.status === 'active' ? 'green' : 'amber'}>{t(`listing.status.${listing.status}`)}</Badge>
            </div>
            <h1 className="text-3xl font-bold">{listing.title}</h1>
            <p className="flex items-center gap-1.5 text-muted"><MapPin className="size-5 text-leaf-600" aria-hidden />{area}</p>
          </div>
          {listing.status === 'unavailable' && <Alert tone="warning">{t('listing.unavailableBanner')}</Alert>}

          {listing.operations.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">{t('listing.operations')}</h2>
              <ul className="flex flex-wrap gap-2">{listing.operations.map((o) => <li key={o.id}><Badge>{pickName(o.names, locale)}</Badge></li>)}</ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t('listing.conditions')}</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {conditions.map(([Icon, label, value]) => (
                <li key={label} className="rounded-xl border border-soil-200 bg-white p-4">
                  <Icon className="mb-1 size-5 text-leaf-600" aria-hidden />
                  <div className="text-sm text-muted">{label}</div>
                  <div className="font-semibold">{value}</div>
                </li>
              ))}
            </ul>
            {listing.additionalConditions && (
              <div><h3 className="font-semibold">{t('listing.additional')}</h3><p className="whitespace-pre-line">{listing.additionalConditions}</p></div>
            )}
          </section>

          {(details.length > 0 || listing.description) && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('listing.details')}</h2>
              {details.length > 0 && (
                <dl className="grid grid-cols-3 gap-3">
                  {details.map(([k, v]) => <div key={k} className="rounded-xl bg-white p-3"><dt className="text-sm text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
                </dl>
              )}
              {/* Owner text is rendered as text, never as HTML, and is not machine-translated. */}
              {listing.description && <p className="whitespace-pre-line">{listing.description}</p>}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t('listing.location')}</h2>
            <p className="font-medium">{area}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarDays className="size-4" aria-hidden />
              {t('listing.updated', { time: format.dateTime(new Date(listing.location.updatedAt), { dateStyle: 'medium' }) })}</p>
            {listing.location.point && <AreaMapLazy point={listing.location.point} radiusM={listing.location.precision === 'exact' ? 150 : 1000} />}
            <p className="text-sm text-muted">{t('listing.mapNote')}</p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-leaf-700 hover:underline">
              <ExternalLink className="size-4" aria-hidden />{t('listing.openMaps')}
            </a>
            {listing.homeArea && <p><span className="text-muted">{t('listing.homeArea')}: </span>{areaText(listing.homeArea)}</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4">
            <div>
              <p className="text-3xl font-bold" data-testid="detail-price">{priceLabel(p, t, locale)}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-muted">
                {p.negotiable && p.price != null && <li>{t('pricing.negotiable')}</li>}
                {p.minHours != null && <li>{t('pricing.minHours', { value: p.minHours })}</li>}
                {p.minAcres != null && <li>{t('pricing.minAcres', { value: p.minAcres })}</li>}
              </ul>
            </div>
            <ContactOwner listing={listing} />
            <div className="flex items-center justify-between gap-2">
              <SaveListing listingId={listing.id} />
              <ReportListing listingId={listing.id} />
            </div>
          </Card>
          <p className="text-sm text-muted">{t('listing.memberSince', { date: format.dateTime(new Date(`${listing.ownerMemberSince}-01`), { month: 'long', year: 'numeric' }) })}</p>
          <Alert tone="info">{t('listing.safety')}</Alert>
        </aside>
      </div>
    </div>
  );
}
