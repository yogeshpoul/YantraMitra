import { Injectable } from '@nestjs/common';
import type { CategoryDto, EquipmentTypeDto, LocalizedName, OperationDto } from '@yantramitra/shared-types';
import { notFound } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface NameColumns {
  nameEn: string;
  nameMr: string;
  nameHi: string;
}
export const toNames = (r: NameColumns): LocalizedName => ({ en: r.nameEn, mr: r.nameMr, hi: r.nameHi });
export const fromNames = (n: LocalizedName): NameColumns => ({ nameEn: n.en, nameMr: n.mr, nameHi: n.hi });

const order = [{ sortOrder: 'asc' as const }, { nameEn: 'asc' as const }];

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.equipmentCategory.findMany({
      where: { isActive: true },
      orderBy: order,
      include: { types: { where: { isActive: true }, orderBy: order } },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      names: toNames(c),
      iconKey: c.iconKey,
      types: c.types.map((t) => ({ id: t.id, slug: t.slug, names: toNames(t), iconKey: t.iconKey, categoryId: t.categoryId })),
    }));
  }

  async types(categoryId: string): Promise<EquipmentTypeDto[]> {
    const category = await this.prisma.equipmentCategory.findFirst({
      where: { id: categoryId, isActive: true },
      include: { types: { where: { isActive: true }, orderBy: order } },
    });
    if (!category) throw notFound('Category');
    return category.types.map((t) => ({ id: t.id, slug: t.slug, names: toNames(t), iconKey: t.iconKey, categoryId: t.categoryId }));
  }

  async operations(): Promise<OperationDto[]> {
    const rows = await this.prisma.operation.findMany({ where: { isActive: true }, orderBy: order });
    return rows.map((o) => ({ id: o.id, slug: o.slug, names: toNames(o) }));
  }
}
