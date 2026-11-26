// Vercel function: every request is rewritten here (see vercel.json).
// The API is compiled by tsc (Nest needs its decorator metadata), then bundled into one ES module by
// scripts/bundle-serverless.mjs, because Vercel's module loader rejects CommonJS packages that require()
// ES modules (e.g. @nestjs/throttler loading @nestjs/common 12).
export { default } from '../dist/serverless.bundle.mjs';
