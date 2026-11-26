/**
 * Imports a GeoNames country extract (CC BY 4.0) into `places`: villages, towns, cities, talukas,
 * districts, states and PIN codes. Free, offline, and works for any country code.
 *
 *   pnpm --filter @yantramitra/api places:import IN
 *   pnpm --filter @yantramitra/api places:import IN --places ./IN.zip --postal ./IN-postal.zip
 *   pnpm --filter @yantramitra/api places:import IN --states "Maharashtra,Karnataka"   (smaller databases)
 *
 * Files are downloaded from download.geonames.org when paths are not given. Re-running updates rows in place.
 */
import { existsSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { Prisma } from '../generated/prisma/client.js';
import { run } from './db.js';

const args = process.argv.slice(2);
const country = (args.find((a) => /^[A-Za-z]{2}$/.test(a)) ?? 'IN').toUpperCase();
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

type Kind = 'village' | 'town' | 'city' | 'taluka' | 'district' | 'state' | 'postal';
interface PlaceInput {
  sourceId: string;
  name: string;
  kind: Kind;
  taluka: string | null;
  district: string | null;
  state: string | null;
  postalCode: string | null;
  lat: number;
  lng: number;
  population: number;
  importance: number;
  searchText: string;
  slugBase: string;
}

async function load(path: string | undefined, url: string): Promise<string> {
  let bytes: Uint8Array;
  if (path) {
    if (!existsSync(path)) throw new Error(`File not found: ${path}`);
    bytes = readFileSync(path);
  } else {
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  const files = unzipSync(bytes, { filter: (f) => f.name === `${country}.txt` });
  const file = files[`${country}.txt`];
  if (!file) throw new Error(`${country}.txt not found in archive`);
  return new TextDecoder().decode(file);
}

export function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Latin and Devanagari alternate names only, so Marathi/Hindi spellings are searchable. */
function searchable(...values: (string | null | undefined)[]): string {
  return values.filter(Boolean).join(' ').toLowerCase().slice(0, 1500);
}

/** "State of Maharashtra" → "Maharashtra"; "Union Territory of Ladakh" → "Ladakh". */
function cleanAdmin(name: string): string {
  return name.replace(/^(State|Union Territory|National Capital Territory) of /i, '').trim();
}

function parsePlaces(text: string): PlaceInput[] {
  const rows = text.split('\n').map((l) => l.split('\t')).filter((c) => c.length >= 19);
  const adminName = new Map<string, string>();
  for (const c of rows) {
    const code = c[7];
    // ASCII form: "Maharashtra", not "Mahārāshtra"; this text is shown in every listing's area.
    const name = cleanAdmin(c[2] || c[1]!);
    if (code === 'ADM1') adminName.set(`1:${c[10]}`, name);
    if (code === 'ADM2') adminName.set(`2:${c[10]}:${c[11]}`, name);
    if (code === 'ADM3') adminName.set(`3:${c[10]}:${c[11]}:${c[12]}`, name);
  }
  const out: PlaceInput[] = [];
  for (const c of rows) {
    const [id, rawName, ascii, alt, lat, lng, fclass, fcode, , , a1, a2, a3, , pop] = c as string[];
    let name = rawName;
    let kind: Kind | null = null;
    const population = Number(pop) || 0;
    if (fclass === 'A') kind = fcode === 'ADM1' ? 'state' : fcode === 'ADM2' ? 'district' : fcode === 'ADM3' ? 'taluka' : null;
    else if (fclass === 'P' && !['PPLH', 'PPLQ', 'PPLW', 'PPLCH'].includes(fcode!)) {
      kind = population >= 100_000 || ['PPLC', 'PPLA', 'PPLA2'].includes(fcode!) ? 'city'
        : population >= 5_000 || fcode === 'PPLA3' ? 'town' : 'village';
    }
    if (!kind || !name) continue;
    if (kind === 'state' || kind === 'district' || kind === 'taluka') name = cleanAdmin(ascii || name);
    const state = adminName.get(`1:${a1}`) ?? null;
    const district = kind === 'state' ? null : adminName.get(`2:${a1}:${a2}`) ?? null;
    const taluka = kind === 'state' || kind === 'district' ? null : adminName.get(`3:${a1}:${a2}:${a3}`) ?? null;
    const alternates = (alt ?? '').split(',').filter((n) => /^[\p{Script=Latin}\p{Script=Devanagari}\s.'-]+$/u.test(n)).slice(0, 12);
    const weight = { state: 6, district: 5, city: 4, taluka: 3, town: 2.5, village: 1, postal: 0 }[kind];
    out.push({
      sourceId: id!, name, kind, taluka, district: kind === 'district' ? name : district, state: kind === 'state' ? name : state,
      postalCode: null, lat: Number(lat), lng: Number(lng), population,
      importance: weight + Math.log10(population + 1),
      searchText: searchable(name, ascii, alternates.join(' '), taluka, district, state),
      slugBase: slugify(ascii || name) + (kind === 'district' ? '-district' : kind === 'taluka' ? '-taluka' : ''),
    });
  }
  return out;
}

/** One entry per PIN code, at the mean position of its post offices. */
function parsePostal(text: string): PlaceInput[] {
  const groups = new Map<string, { names: string[]; lat: number; lng: number; n: number; district: string | null; state: string | null; taluka: string | null }>();
  for (const line of text.split('\n')) {
    const c = line.split('\t');
    if (c.length < 11 || !c[1]) continue;
    const g = groups.get(c[1]) ?? { names: [], lat: 0, lng: 0, n: 0, state: c[3] || null, district: c[5] || null, taluka: c[7] || null };
    g.names.push(c[2]!.replace(/\s+(B\.?O|S\.?O|H\.?O)\.?$/i, ''));
    g.lat += Number(c[9]);
    g.lng += Number(c[10]);
    g.n += 1;
    groups.set(c[1], g);
  }
  return [...groups].map(([pin, g]) => ({
    sourceId: `pin:${pin}`, name: g.names[0] ?? pin, kind: 'postal' as const, taluka: g.taluka, district: g.district, state: g.state,
    postalCode: pin, lat: g.lat / g.n, lng: g.lng / g.n, population: 0, importance: 2,
    searchText: searchable(pin, g.names.join(' '), g.district, g.state), slugBase: `pin-${pin}`,
  }));
}

void run(async (db) => {
  const places = parsePlaces(await load(option('--places'), `https://download.geonames.org/export/dump/${country}.zip`));
  const postal = option('--no-postal') !== undefined || args.includes('--no-postal')
    ? []
    : parsePostal(await load(option('--postal'), `https://download.geonames.org/export/zip/${country}.zip`));
  // Optional: only some states, for databases with little storage (all of India takes about 600 MB).
  const states = option('--states')?.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  const all = [...places, ...postal].filter((p) => !states || (p.state !== null && states.includes(p.state.toLowerCase())));
  if (states && all.length === 0) throw new Error(`No places matched --states ${states.join(',')}`);

  // Most important place keeps the plain slug; others get a district suffix, then an id suffix.
  const existing = new Map(
    (await db.place.findMany({ where: { source: 'geonames' }, select: { sourceId: true, slug: true } })).map((p) => [p.sourceId, p.slug]),
  );
  const taken = new Set(existing.values());
  all.sort((a, b) => b.importance - a.importance);
  const slugs = new Map<string, string>();
  for (const p of all) {
    const keep = existing.get(p.sourceId);
    if (keep) { slugs.set(p.sourceId, keep); continue; }
    const base = p.slugBase || `place-${p.sourceId}`;
    const candidates = [base, `${base}-${slugify(p.district ?? '')}`, `${base}-${slugify(p.sourceId)}`];
    const slug = candidates.find((s) => s && !s.endsWith('-') && !taken.has(s)) ?? `${base}-${slugify(p.sourceId)}-${country.toLowerCase()}`;
    taken.add(slug);
    slugs.set(p.sourceId, slug);
  }

  const BATCH = 2000;
  for (let i = 0; i < all.length; i += BATCH) {
    const values = all.slice(i, i + BATCH).map((p) => Prisma.sql`(
      gen_random_uuid(), 'geonames', ${p.sourceId}, ${slugs.get(p.sourceId)}, ${p.name}, ${p.kind}::"PlaceKind", ${p.taluka}, ${p.district},
      ${p.state}, ${country}, ${p.postalCode}, ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography,
      ${p.population}, ${p.importance}, ${p.searchText})`);
    await db.$executeRaw`
      INSERT INTO places (id, source, source_id, slug, name, kind, taluka, district, state, country_code, postal_code, point, population, importance, search_text)
      VALUES ${Prisma.join(values)}
      ON CONFLICT (source, source_id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, taluka = EXCLUDED.taluka,
        district = EXCLUDED.district, state = EXCLUDED.state, postal_code = EXCLUDED.postal_code, point = EXCLUDED.point,
        population = EXCLUDED.population, importance = EXCLUDED.importance, search_text = EXCLUDED.search_text`;
    if ((i / BATCH) % 25 === 0) console.log(`${Math.min(i + BATCH, all.length)} / ${all.length}`);
  }
  // Listings keep a copy of their area names for fast filtering; refresh it from the updated gazetteer.
  const refreshed = await db.$executeRaw`
    UPDATE equipment_listings l SET current_locality = p.name, current_taluka = p.taluka, current_district = p.district,
      current_state = p.state, current_country_code = p.country_code
    FROM places p WHERE p.id = l.current_place_id`;
  await db.$executeRaw`ANALYZE places`;
  console.log(`Refreshed area names on ${refreshed} listings.`);
  console.log(`Imported ${all.length} places and PIN codes for ${country}${states ? ` (${states.join(', ')})` : ''}. Data © GeoNames, CC BY 4.0.`);
});
