# ── Dev stage ───────────────────────────────────────────────
# Installs deps and provides a ready-to-run pnpm environment.
# Source code is mounted via docker-compose volumes.
FROM node:22-alpine AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/portal/package.json apps/portal/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/superai/package.json apps/superai/
COPY apps/apphub/package.json apps/apphub/
COPY apps/arch/package.json apps/arch/
COPY apps/dw/package.json apps/dw/
COPY apps/mcphub/package.json apps/mcphub/
RUN pnpm install
EXPOSE 9200

# ── Build stage ─────────────────────────────────────────────
FROM dev AS build
ARG TARGET_APP=portal
COPY . .
RUN pnpm --filter @mate/${TARGET_APP} build

# ── Production stage ────────────────────────────────────────
FROM nginx:alpine AS prod
ARG TARGET_APP=portal
COPY --from=build /app/apps/${TARGET_APP}/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://host.docker.internal:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
