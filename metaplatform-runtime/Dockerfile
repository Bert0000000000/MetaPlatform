# ──────────────────────────────────────────────────────────
# Runtime image — runs ONE published MetaPlatform application
# in a fully-isolated sandbox.
#
# Build:
#   docker build -t metaplatform-runtime:v1 ./metaplatform-runtime
#
# Run (the platform orchestrator does this for us, but you can try it
# by hand with a known slug DB):
#   docker run --rm -p 31001:3000 \
#     -v $PWD/data/published/crm:/data:ro \
#     -e APP_ID=... -e APP_SLUG=... \
#     --read-only --tmpfs /tmp --user 1000:1000 \
#     --cpus=0.5 --memory=256m \
#     --security-opt no-new-privileges:true \
#     metaplatform-runtime:v1
# ──────────────────────────────────────────────────────────

# Use the slim Debian image so better-sqlite3 compiles without
# dragging in a full gcc toolchain on every rebuild. The
# node:20-bookworm-slim base gives us nodejs-20 + libstdc++ already.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
# npm install is run as root here intentionally; the runtime stage
# drops to a non-root user.
RUN npm install --omit=dev --no-audit --no-fund

# ── Runtime stage ──
FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Use the prebuilt unprivileged `node` user that ships with the image.
USER node

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    RUNTIME_DB_PATH=/data/app.db

EXPOSE 3000

# SQLite WAL lives next to the data file but we mount /data read-only,
# so put the WAL/SHM in /tmp (a tmpfs).
ENV SQLITE_TMPDIR=/tmp

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) + '/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" \
  || exit 1

CMD ["node", "src/server.js"]
