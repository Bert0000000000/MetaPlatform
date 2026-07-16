/**
 * Tracer (Phase 5 — Observability)
 *
 * Lightweight request-tracing utility that captures:
 *   - HTTP boundary timings
 *   - Storage backend call durations (per call)
 *   - Custom span annotations
 *
 * Each request gets a root trace with multiple spans (one per backend call
 * or logical operation). Traces are kept in memory and exposed via
 * /api/observability/traces for inspection.
 *
 * Output is structured to map to OpenTelemetry spans when adopting OTel later.
 */

import { logger, runWithContext, getContext, setContextField } from "./logger.js";

const SPANS_PER_TRACE = 200;
const TRACE_RETENTION_MS = 10 * 60 * 1000; // 10 minutes

// Map<traceId, { spans, startedAt, completedAt, root }>
const traces = new Map();

function genTraceId() {
  return Math.random().toString(36).slice(2, 14).padStart(12, "0");
}
function genSpanId() {
  return Math.random().toString(36).slice(2, 10).padStart(8, "0");
}

/**
 * Capture a span around an async function. The span is automatically
 * added to the current trace context.
 */
export async function withSpan(name, fn, fields = {}) {
  const ctx = getContext();
  const traceId = ctx.traceId || genTraceId();
  const parentSpanId = ctx.spanId || null;
  const spanId = genSpanId();

  if (!ctx.traceId) {
    setContextField("traceId", traceId);
  }
  setContextField("spanId", spanId);

  const trace = traces.get(traceId) || createTrace(traceId, parentSpanId);
  const span = {
    spanId,
    parentSpanId,
    name,
    startedAt: Date.now(),
    endedAt: null,
    durationMs: null,
    status: "ok",
    fields,
    events: [],
  };
  trace.spans.push(span);

  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    span.status = "ok";
    return result;
  } catch (err) {
    span.status = "error";
    span.fields.error = err.message;
    throw err;
  } finally {
    span.durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    span.endedAt = Date.now();
    // restore parent span
    setContextField("spanId", parentSpanId);
    logger.debug("span.completed", {
      traceId,
      spanId,
      name,
      durationMs: span.durationMs,
      status: span.status,
    });
  }
}

function createTrace(traceId, rootSpanId) {
  const trace = {
    traceId,
    spans: [],
    startedAt: Date.now(),
    completedAt: null,
    rootSpanId,
  };
  traces.set(traceId, trace);
  // Clean up old traces
  if (traces.size > 500) {
    const cutoff = Date.now() - TRACE_RETENTION_MS;
    for (const [id, t] of traces.entries()) {
      if (t.startedAt < cutoff) traces.delete(id);
    }
  }
  return trace;
}

/**
 * Mark the root span as completed (called at end of HTTP request).
 */
export function finishTrace() {
  const ctx = getContext();
  if (!ctx.traceId) return;
  const t = traces.get(ctx.traceId);
  if (t) t.completedAt = Date.now();
}

/**
 * Get a single trace by id.
 */
export function getTrace(traceId) {
  return traces.get(traceId) || null;
}

/**
 * List recent traces.
 */
export function listTraces({ limit = 50, since } = {}) {
  const all = [...traces.values()].sort((a, b) => b.startedAt - a.startedAt);
  const filtered = since ? all.filter((t) => t.startedAt >= since) : all;
  return filtered.slice(0, limit).map((t) => ({
    traceId: t.traceId,
    startedAt: new Date(t.startedAt).toISOString(),
    completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    durationMs: t.completedAt ? t.completedAt - t.startedAt : Date.now() - t.startedAt,
    spanCount: t.spans.length,
    status: t.spans.some((s) => s.status === "error") ? "error" : "ok",
  }));
}

/**
 * Express middleware: ensure traceId exists for every request.
 */
export function tracerMiddleware(req, res, next) {
  const traceId = req.headers["x-trace-id"] || genTraceId();
  req.traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);

  // Ensure a trace record exists so even simple requests show up.
  if (!traces.has(traceId)) {
    traces.set(traceId, {
      traceId,
      spans: [],
      startedAt: Date.now(),
      completedAt: null,
      rootSpanId: null,
    });
  }

  runWithContext({ traceId }, () => {
    res.on("finish", () => finishTrace());
    next();
  });
}

/**
 * Wrap storage backend calls with automatic spans.
 */
export const tracedNeo4j = {
  query: (cypher, params) => withSpan("neo4j.query", () => import("../integrations/neo4j.js").then((m) => m.queryGraph(cypher, params)), { cypher: cypher.slice(0, 80) }),
};

export const tracedClickhouse = {
  query: (sql) => withSpan("clickhouse.query", () => import("../integrations/clickhouse.js").then((m) => m.query(sql)), { sql: sql.slice(0, 80) }),
};

export const tracedES = {
  search: (query) => withSpan("elasticsearch.search", () => import("../integrations/elasticsearch.js").then((m) => m.searchText(query)), { query }),
};

export const tracedKafka = {
  publish: (topic, payload) => withSpan("kafka.publish", () => import("../integrations/kafka.js").then((m) => m.publish(topic, payload)), { topic }),
};

export function getStatus() {
  return {
    tracesInMemory: traces.size,
    spanCapPerTrace: SPANS_PER_TRACE,
    retentionMs: TRACE_RETENTION_MS,
  };
}

export default {
  withSpan,
  finishTrace,
  getTrace,
  listTraces,
  tracerMiddleware,
  tracedNeo4j,
  tracedClickhouse,
  tracedES,
  tracedKafka,
  getStatus,
};