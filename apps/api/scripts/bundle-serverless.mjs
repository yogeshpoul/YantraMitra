// Bundles the compiled API (dist/, which tsc emitted with decorator metadata) into one ES module for
// serverless hosts. Some Nest packages are CommonJS that require() ES-module packages; Node 22 allows
// that, but host module loaders (e.g. Vercel's) may not. Bundling resolves those imports at build time.
import { build } from 'esbuild';

// Optional Nest integrations are loaded in try/catch only when used; native and file-path packages stay on disk.
const external = [
  '@nestjs/microservices', '@nestjs/microservices/*', '@nestjs/websockets', '@nestjs/websockets/*',
  'class-validator', 'class-transformer', '@fastify/static', '@fastify/*', 'fastify',
  '@node-rs/argon2', 'swagger-ui-dist', 'swagger-ui-dist/*',
  // Database driver and Prisma runtime: CommonJS that needs no ES modules, and breaks when bundled.
  'pg', 'pg-native', '@prisma/client', '@prisma/client/*', '@prisma/adapter-pg', '@prisma/driver-adapter-utils',
];

await build({
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist/serverless.bundle.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external,
  keepNames: true, // Nest uses class names for injection tokens and logging
  sourcemap: true,
  logLevel: 'warning',
  // CommonJS code inside an ES-module bundle still calls require() for Node built-ins.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
console.log('Wrote dist/serverless.bundle.mjs');
