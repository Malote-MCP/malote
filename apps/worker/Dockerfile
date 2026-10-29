# Build from the repo root: fly deploy --config fly.worker.toml
# Reproducible: the same commit must always produce the same image digest (checked in CI).
# Base pinned by digest; caches and pnpm's timestamped state removed; the builder normalizes file times.
FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --prod --filter "@malote/worker..." \
  && find . -name .modules.yaml -delete \
  && rm -rf /root/.cache /root/.local/share/pnpm /tmp/*
COPY packages/db packages/db
COPY apps/worker apps/worker
WORKDIR /repo/apps/worker
# Commit this image was built from (set by CI), published on /api/transparency.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/main.ts"]
