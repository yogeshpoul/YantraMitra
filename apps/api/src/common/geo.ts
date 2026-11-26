import type { CurrentVisibility, LatLng } from '@yantramitra/shared-types';
import { Prisma } from '../generated/prisma/client.js';

/** Grid used for the public projection of a private position: 0.01 degrees, about 1.1 km. */
export const PUBLIC_GRID_DEGREES = 0.01;

/**
 * The only place a point is built from coordinates.
 * ST_MakePoint takes LONGITUDE first, latitude second.
 */
export const geography = (p: LatLng): Prisma.Sql =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography`;

/**
 * Public projection. Search, distance and sorting use only this value, so narrowing the radius or
 * combining several distances reveals the grid cell and never the exact position.
 */
export function publicPoint(p: LatLng, visibility: CurrentVisibility): LatLng {
  if (visibility === 'exact') return p;
  const snap = (v: number) => Number((Math.round(v / PUBLIC_GRID_DEGREES) * PUBLIC_GRID_DEGREES).toFixed(2));
  return { lat: snap(p.lat), lng: snap(p.lng) };
}

/** Escapes LIKE wildcards in user input. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
