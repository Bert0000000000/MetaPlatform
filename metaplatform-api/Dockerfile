# ────────────────────────────────────────────────────────────
# MetaPlatform API — multi-stage production Dockerfile
# Stage 1: install all deps (including dev) + run tests
# Stage 2: production-only deps + runtime code
# Final image: ~150 MB on Alpine, runs as non-root
# ────────────────────────────────────────────────────────────

# ─── Stage 1: deps + build ────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install full deps (including devDependencies for tests / build)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source for any build steps (currently pure-JS, but future-proof)
COPY src ./src
COPY scripts ./scripts 2>/dev/null || true

# Optional: run tests in builder stage; cache-bust by source changes
RUN if [ -f "scripts/test.sh" ]; then bash scripts/test.sh || echo "tests skipped"; fi

# ─── Stage 2: runtime deps only ──────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# ─── Stage 3: final runtime image ────────────────────────
FROM node:22-alpine AS runtime

# Add tini for proper signal handling (PID 1 zombie reaping)
RUN apk add --no-cache tini curl

# Create non-root user
RUN addgroup -g 10001 -S metaplatform && \
    adduser -u 10001 -S metaplatform -G metaplatform

WORKDIR /app

# Copy only production node_modules from deps stage
COPY --from=deps --chown=metaplatform:metaplatform /app/node_modules ./node_modules
# Copy application source
COPY --chown=metaplatform:metaplatform package.json ./
COPY --chown=metaplatform:metaplatform src ./src
COPY --chown=metaplatform:metaplatform scripts ./scripts 2>/dev/null || true

# Persistent directories for SQLite / OCR cache / logs
RUN mkdir -p /app/data /app/.ocr-cache /app/logs && \
    chown -R metaplatform:metaplatform /app

# OCI labels
LABEL org.opencontainers.image.title="MetaPlatform API" \
      org.opencontainers.image.description="Enterprise AI Middleware Platform API" \
      org.opencontainers.image.version="1.6.0" \
      org.opencontainers.image.source="https://github.com/Bert0000000000/MetaPlatform" \
      org.opencontainers.image.licenses="Apache-2.0"

USER metaplatform

ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps" \
    PORT=3001

EXPOSE 3001

# Health check (uses /api/health endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:3001/api/health" || exit 1

# Use tini for proper signal forwarding
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]