# Build from the repo root: fly deploy --config fly.worker.toml
# Reproducible: the same commit must always produce the same image digest (checked in CI).
# Base pinned by digest; caches and pnpm's timestamped state removed; the builder normalizes file times.
FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
RUN corepack enable && rm -rf /tmp/*
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/mcp/package.json packages/mcp/
RUN pnpm install --frozen-lockfile --prod --filter "@malote/worker..." \
  && find . -name .modules.yaml -delete \
  && rm -f node_modules/.pnpm-workspace-state*.json \
  && rm -rf /root/.cache /root/.local/share/pnpm /root/.local/state /tmp/*
COPY packages/db packages/db
COPY packages/mcp packages/mcp
COPY apps/worker apps/worker
WORKDIR /repo/apps/worker
# Confidential Space launch policy: the operator may only pick which committed config to use
# (MALOTE_ENV). Any other override (NODE_OPTIONS, a different command, …) would change what runs
# without changing the image digest, so the launcher refuses it. Logs carry no message content.
LABEL "tee.launch_policy.allow_env_override"="MALOTE_ENV"
LABEL "tee.launch_policy.log_redirect"="always"
EXPOSE 80 443
# Commit this image was built from (set by CI), published on /api/transparency.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/main.ts"]
