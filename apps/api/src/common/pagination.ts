import type { Paginated } from '@yantramitra/shared-types';

export interface PageRequest {
  page: number;
  pageSize: number;
}

export const skipTake = (p: PageRequest) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });

export function paginated<T>(items: T[], total: number, p: PageRequest): Paginated<T> {
  return { items, page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) };
}
