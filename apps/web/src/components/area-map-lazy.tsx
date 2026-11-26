'use client';
import type { LatLng } from '@yantramitra/shared-types';
import dynamic from 'next/dynamic';
import { Skeleton } from './ui';

const AreaMap = dynamic(() => import('./area-map'), { ssr: false, loading: () => <Skeleton className="h-56" /> });

export function AreaMapLazy(props: { point: LatLng; radiusM: number }) {
  return <AreaMap {...props} />;
}
