// Vercel function: every request is rewritten here (see vercel.json). Built by `tsc` into dist/ first,
// because Nest's dependency injection needs the decorator metadata that tsc emits.
export { default } from '../dist/serverless.js';
