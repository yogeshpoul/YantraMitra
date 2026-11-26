# syntax=docker/dockerfile:1
# Build context: repository root.   docker build -f apps/api/Dockerfile -t yantramitra-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@9.10.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile --filter "@yantramitra/api..."
RUN pnpm -r --filter "./packages/*" run build \
 && pnpm --filter @yantramitra/api build \
 && pnpm --filter @yantramitra/api deploy --prod /out

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
