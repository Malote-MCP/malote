# Build from the repo root: fly deploy --config fly.worker.toml
FROM node:22-slim
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --prod --filter "@malote/worker..."
COPY packages/db packages/db
COPY apps/worker apps/worker
WORKDIR /repo/apps/worker
# Commit this image was built from (set by CI), published on /api/transparency.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/main.ts"]
