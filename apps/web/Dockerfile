# Build from the repo root: fly deploy --config fly.web.toml
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter "@malote/web..."
COPY packages/db packages/db
COPY apps/web apps/web
# Placeholders only so `next build` can evaluate modules; real values come from Fly secrets at runtime.
RUN NEON_AUTH_BASE_URL=https://build.invalid/auth \
    NEON_AUTH_COOKIE_SECRET=build-placeholder-secret-not-used-at-runtime \
    DATABASE_URL=postgres://build@localhost/build \
    pnpm --filter @malote/web build

FROM node:22-slim
WORKDIR /app
# Commit this image was built from (set by CI), published on /api/transparency.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
