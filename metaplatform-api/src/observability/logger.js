/**
 * Structured Logger (Phase 5 — Observability)
 *
 * JSON-format logger that:
 *   - Emits one JSON line per event (for Loki / ELK ingestion)
 *   - Correlates every log with a request traceId via AsyncLocalStorage
 *   - Buffers recent logs in memory for the /api/observability/logs endpoint
 *   - Also writes to stdout for docker/k8s log collection
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { hostname } from "node:os";

const HOSTNAME = hostname();
const SERVICE = process.env.SERVICE_NAME || "metaplatform-api";
const ENV = process.env.NODE_ENV || "development";
const LEVEL = process.env.LOG_LEVEL || "info";

// In-memory ring buffer for recent logs (used by /api/observability/logs)
const RING_SIZE = parseInt(process.env.LOG_BUFFER_SIZE || "1000", 10);
const ringBuffer = [];
const ringIndex = { value: 0 };

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const shouldLog = (lvl) => LEVELS[lvl] <= LEVELS[LEVEL];

const traceStore = new AsyncLocalStorage();

/**
 * Run a function within a tracing context so all logs include the traceId.
 */
export function runWithContext(ctx, fn) {
  return traceStore.run({ ...ctx }, fn);
}

export function getContext() {
  return traceStore.getStore() || {};
}

export function setContextField(key, value) {
  const ctx = traceStore.getStore();
  if (ctx) ctx[key] = value;
}

function emit(level, message, fields = {}) {
  if (!shouldLog(level)) return;
  const ctx = getContext();
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    env: ENV,
    host: HOSTNAME,
    msg: typeof message === "string" ? message : JSON.stringify(message),
    traceId: ctx.traceId || null,
    spanId: ctx.spanId || null,
    userId: ctx.userId || null,
    requestId: ctx.requestId || null,
    ...fields,
  };

  const line = JSON.stringify(entry);

  // Write to stdout/stderr by level
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");

  // Buffer for /api/observability/logs
  ringBuffer[ringIndex.value] = entry;
  ringIndex.value = (ringIndex.value + 1) % RING_SIZE;
}

export const logger = {
  error: (msg, fields) => emit("error", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  debug: (msg, fields) => emit("debug", msg, fields),
};

/**
 * Read recent logs from the ring buffer.
 */
export function getRecentLogs({ level, since, limit = 100, traceId } = {}) {
  const all = [];
  for (let i = 0; i < RING_SIZE; i++) {
    const idx = (ringIndex.value + i) % RING_SIZE;
    const entry = ringBuffer[idx];
    if (entry) all.push(entry);
  }
  return all
    .filter((e) => !level || e.level === level)
    .filter((e) => !traceId || e.traceId === traceId)
    .filter((e) => !since || e.ts >= since)
    .slice(-limit);
}

/**
 * Express middleware: assigns a traceId per request and binds it to context.
 */
export function loggerMiddleware(req, res, next) {
  const traceId = req.headers["x-trace-id"] || req.headers["x-request-id"] || generateTraceId();
  const requestId = generateSpanId();
  req.traceId = traceId;
  req.requestId = requestId;
  res.setHeader("X-Trace-Id", traceId);

  const start = Date.now();
  runWithContext({ traceId, spanId: requestId, requestId }, () => {
    logger.info("request.received", {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.on("finish", () => {
      logger.info("request.completed", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  });
}

function generateTraceId() {
  return "tr-" + Math.random().toString(36).slice(2, 14).padStart(12, "0");
}
function generateSpanId() {
  return "sp-" + Math.random().toString(36).slice(2, 8).padStart(6, "0");
}

export function getStatus() {
  return {
    service: SERVICE,
    env: ENV,
    level: LEVEL,
    bufferSize: RING_SIZE,
    bufferedLogs: ringBuffer.filter(Boolean).length,
    hostname: HOSTNAME,
  };
}

export default { logger, loggerMiddleware, getRecentLogs, getStatus, runWithContext, getContext, setContextField };