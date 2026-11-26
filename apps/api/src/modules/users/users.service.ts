import { Injectable } from '@nestjs/common';
import type { MeDto } from '@yantramitra/shared-types';
import type { updateProfileSchema, z } from '@yantramitra/shared-validation';
import type { AdminUser, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Explicit mapping: the password hash can never reach a response. */
export function toMe(user: User & { admin: AdminUser | null }): MeDto {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    preferredLocale: user.preferredLocale,
    mustChangePassword: user.mustChangePassword,
    isAdmin: user.admin?.isActive ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: string): Promise<MeDto> {
    return toMe(await this.prisma.user.findUniqueOrThrow({ where: { id }, include: { admin: true } }));
  }

  async update(id: string, input: z.output<typeof updateProfileSchema>): Promise<MeDto> {
    const data = { fullName: input.fullName, preferredLocale: input.preferredLocale };
    return toMe(await this.prisma.user.update({ where: { id }, data, include: { admin: true } }));
  }
}
