#!/bin/sh
# Applies pending migrations when RUN_MIGRATIONS=true (single-instance deployments).
# With several API replicas, run `node_modules/.bin/prisma migrate deploy` once as a release step instead.
set -e
if [ "$RUN_MIGRATIONS" = "true" ]; then
  node_modules/.bin/prisma migrate deploy
  node dist/cli/seed.js
fi
exec "$@"
