// Tests always use the dedicated test database. They never run against the development database.
import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://yantramitra@127.0.0.1:55432/yantramitra_test';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';
process.env.CONTACT_REVEALS_PER_DAY = '3';
process.env.DEFAULT_SEARCH_RADIUS_KM = '25';
process.env.LOCATION_PROVIDER = 'local';
process.env.SWAGGER_ENABLED = 'false';
process.env.INTERNAL_API_KEY = '';
process.env.TRUST_PROXY_HOPS = '1';

if (!/_test\b|test/.test(process.env.DATABASE_URL)) throw new Error('Refusing to run tests against a non-test database');
