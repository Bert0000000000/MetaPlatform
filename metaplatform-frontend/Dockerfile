# syntax=docker/dockerfile:1.7

# ------------------------------------------------------------
# Base image: pnpm + Node 20 on alpine for small footprint
# ------------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ------------------------------------------------------------
# Dependencies layer (cached independently of source)
# ------------------------------------------------------------
FROM base AS deps
# Copy only manifests so dependency install is cache-stable.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/portal/package.json     apps/portal/
COPY apps/dashboard/package.json  apps/dashboard/
COPY apps/superai/package.json    apps/superai/
COPY apps/apphub/package.json     apps/apphub/
COPY apps/arch/package.json       apps/arch/
COPY apps/dw/package.json         apps/dw/
COPY apps/mcphub/package.json     apps/mcphub/
COPY apps/ontstudio/package.json  apps/ontstudio/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ------------------------------------------------------------
# Development image: hot-reload via Vite, port 9200
# ------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 9200
# Default: start portal. Override with `pnpm --filter <app> dev`
# via docker compose `command:` override.
CMD ["pnpm", "--filter", "portal", "dev", "--host", "0.0.0.0", "--port", "9200"]

# ------------------------------------------------------------
# Production builder: build the static assets for one app
# (Build target is selected via TARGET_APP build-arg.)
# ------------------------