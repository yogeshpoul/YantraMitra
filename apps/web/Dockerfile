# syntax=docker/dockerfile:1
# Build context: repository root.
#   docker build -f apps/web/Dockerfile --build-arg API_INTERNAL_URL=http://api:4000 \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://yantramitra.in -t yantramitra-web .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate
WORKDIR /repo

FROM base AS build
# Rewrites, CSP and NEXT_PUBLIC_* values are fixed at build time.
ARG API_INTERNAL_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG NEXT_PUBLIC_MAP_ATTRIBUTION="© OpenStreetMap contributors"
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY=
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL \
    NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE NEXT_OUTPUT=standalone
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages packages
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile --filter "@yantramitra/web..."
RUN pnpm -r --filter "./packages/*" run build && pnpm --filter @yantramitra/web build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
