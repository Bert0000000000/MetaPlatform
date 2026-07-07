# ────────────────────────────────────────────────────────────
# MetaPlatform Frontend — multi-stage build
# Stage 1: Vite build
# Stage 2: nginx to serve static assets
# ────────────────────────────────────────────────────────────

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ─── Final: nginx with security headers + SPA routing ─────
FROM nginx:1.27-alpine AS runtime

# Install curl for healthcheck + remove default config
RUN apk add --no-cache curl && \
    rm -f /etc/nginx/conf.d/default.conf

# Copy built site
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our nginx config (with /api/* reverse proxy to `api:3001`)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# OCI labels
LABEL org.opencontainers.image.title="MetaPlatform Frontend" \
      org.opencontainers.image.description="Enterprise AI Middleware Platform UI" \
      org.opencontainers.image.version="1.6.0" \
      org.opencontainers.image.source="https://github.com/Bert0000000000/MetaPlatform"

# nginx:alpine already runs as non-root if you remap, but we keep
# default `nginx` user for portability. For K8s use the configmap
# variant in deploy/kubernetes/base/frontend-config.yaml instead.

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]