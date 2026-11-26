import { z } from 'zod';

const bool = z.enum(['true', 'false', '']).optional().transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  /** Connections per process. Keep small on serverless hosts, where every instance has its own pool. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  CORS_ORIGINS: z.string().default('').transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  INTERNAL_API_KEY: z.string().optional().transform((v) => v || undefined),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(240),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(15),
  CONTACT_REVEALS_PER_DAY: z.coerce.number().int().min(1).default(50),
  DEFAULT_SEARCH_RADIUS_KM: z.coerce.number().min(1).max(500).default(25),
  LOCATION_PROVIDER: z.enum(['local', 'nominatim', 'google']).default('local'),
  NOMINATIM_URL: z.url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z.string().optional(),
  GOOGLE_MAPS_SERVER_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  SWAGGER_ENABLED: bool,
});

export type Env = z.output<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Names and reasons only; never print values.
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  const env = parsed.data;
  if (env.LOCATION_PROVIDER === 'google' && !env.GOOGLE_MAPS_SERVER_KEY)
    throw new Error('LOCATION_PROVIDER=google requires GOOGLE_MAPS_SERVER_KEY');
  if (env.LOCATION_PROVIDER === 'nominatim' && !env.NOMINATIM_USER_AGENT)
    throw new Error('LOCATION_PROVIDER=nominatim requires NOMINATIM_USER_AGENT (Nominatim usage policy)');
  return env;
}

export const ENV = Symbol('ENV');
