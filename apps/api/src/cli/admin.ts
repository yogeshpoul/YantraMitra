/**
 * Administrator management. There is deliberately no HTTP endpoint that grants admin rights.
 *
 *   ADMIN_MOBILE=... ADMIN_NAME=... ADMIN_PASSWORD=... pnpm --filter @yantramitra/api admin create
 *   pnpm --filter @yantramitra/api admin promote <mobile>     existing user becomes admin
 *   pnpm --filter @yantramitra/api admin revoke <mobile>
 *   pnpm --filter @yantramitra/api admin list
 *
 * In the production image: node dist/cli/admin.js <command>
 */
import { hash } from '@node-rs/argon2';
import { newPasswordSchema, normalizePhone } from '@yantramitra/shared-validation';
import { run } from './db.js';

const [command, arg] = process.argv.slice(2);

function mobileOrExit(value: string | undefined): string {
  const mobile = value ? normalizePhone(value) : null;
  if (!mobile) throw new Error('A valid mobile number is required');
  return mobile;
}

void run(async (db) => {
  switch (command) {
    case 'create': {
      const mobile = mobileOrExit(process.env.ADMIN_MOBILE);
      const fullName = process.env.ADMIN_NAME?.trim();
      const password = process.env.ADMIN_PASSWORD ?? '';
      if (!fullName) throw new Error('ADMIN_NAME is required');
      if (!newPasswordSchema.safeParse(password).success || password.length < 12)
        throw new Error('ADMIN_PASSWORD must be at least 12 characters and not a common password');
      const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
      await db.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { mobile } });
        if (existing) throw new Error('A user with this mobile exists. Use: admin promote <mobile>');
        const user = await tx.user.create({ data: { mobile, fullName, passwordHash, preferredLocale: 'en' } });
        await tx.adminUser.create({ data: { userId: user.id } });
      });
      console.log(`Administrator created for ${mobile}. Remove ADMIN_PASSWORD from the environment now.`);
      break;
    }
    case 'promote': {
      const user = await db.user.findUnique({ where: { mobile: mobileOrExit(arg) } });
      if (!user || user.status !== 'active') throw new Error('No active user with that mobile number');
      await db.adminUser.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: { isActive: true } });
      console.log(`${user.mobile} is now an administrator`);
      break;
    }
    case 'revoke': {
      const user = await db.user.findUnique({ where: { mobile: mobileOrExit(arg) } });
      if (!user) throw new Error('No user with that mobile number');
      await db.adminUser.updateMany({ where: { userId: user.id }, data: { isActive: false } });
      console.log(`Administrator rights revoked for ${user.mobile}`);
      break;
    }
    case 'list': {
      const admins = await db.adminUser.findMany({ include: { user: true } });
      for (const a of admins) console.log(`${a.user.mobile}\t${a.user.fullName}\t${a.isActive ? 'active' : 'revoked'}`);
      break;
    }
    default:
      throw new Error('Usage: admin create | promote <mobile> | revoke <mobile> | list');
  }
});
