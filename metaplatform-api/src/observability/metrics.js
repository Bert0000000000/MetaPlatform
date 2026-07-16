/**
 * Metrics Service (Phase 5 — Observability)
 *
 * Prometheus-compatible metrics via `prom-client`.
 *
 * Metrics exposed:
 *   - HTTP request counters & histograms (per route/method/status)
 *   - Backend storage health gauges (Neo4j / ES / Milvus / MinIO / Kafka / ClickHouse / PG / Redis)
 *   - Business counters (logins, RAG queries, agent runs, NL2SQL queries, CDC events, simulator runs)
 *   - Default Node.js process metrics (CPU, memory, GC, event loop lag)
 *
 * Scrape endpoint: GET /metrics (Prometheus text format)
 */

import promClient from "prom-client";

const registry = new promClient.Registry();

// Enable default Node.js + process metrics
promClient.collectDefaultMetrics({
  register: registry,
  prefix: "metaplatform_",
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ─── HTTP Metrics ────────────────────────────────────────
export const httpRequestsTotal = new promClient.Counter({
  name: "metaplatform_http_requests_total",
  help: "Total HTTP requests by route, method, and status",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

export const httpRequestDurationSeconds = new promClient.Histogram({
  name: "metaplatform_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

export const httpRequestsInFlight = new promClient.Gauge({
  name: "metaplatform_http_requests_in_flight",
  help: "HTTP requests currently being processed",
  registers: [registry],
});

// ─── Backend Health Gauges ───────────────────────────────
export const backendUp = new promClient.Gauge({
  name: "metaplatform_backend_up",
  help: "1 if backend is reachable, 0 otherwise",
  labelNames: ["backend"],
  registers: [registry],
});

// Initialize all known backends to 0 (will update via health probes)
const KNOWN_BACKENDS = ["postgres", "redis", "neo4j", "elasticsearch", "milvus", "minio", "kafka", "clickhouse"];
for (const b of KNOWN_BACKENDS) {
  backendUp.set({ backend: b }, 0);
}

// ─── Business Metrics ────────────────────────────────────
export const loginsTotal = new promClient.Counter({
  name: "metaplatform_logins_total",
  help: "Successful login count",
  labelNames: ["role"],
  registers: [registry],
});

export const ragQueriesTotal = new promClient.Counter({
  name: "metaplatform_rag_queries_total",
  help: "RAG queries served",
  registers: [registry],
});

export const ragRetrieveDuration = new promClient.Histogram({
  name: "metaplatform_rag_retrieve_duration_seconds",
  help: "RAG retrieve latency",
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [registry],
});

export const agentRunsTotal = new promClient.Counter({
  name: "metaplatform_agent_runs_total",
  help: "Agent invocations",
  labelNames: ["status"],
  registers: [registry],
});

export const agentStepsHistogram = new promClient.Histogram({
  name: "metaplatform_agent_steps",
  help: "Number of steps taken per agent run",
  buckets: [1, 2, 3, 5, 8, 10, 20],
  registers: [registry],
});

export const nl2sqlQueriesTotal = new promClient.Counter({
  name: "metaplatform_nl2sql_queries_total",
  help: "NL2SQL queries served",
  labelNames: ["safe"],
  registers: [registry],
});

export const cdcEventsEmittedTotal = new promClient.Counter({
  name: "metaplatform_cdc_events_emitted_total",
  help: "CDC events emitted to Kafka",
  labelNames: ["table"],
  registers: [registry],
});

export const simulatorRunsTotal = new promClient.Counter({
  name: "metaplatform_simulator_runs_total",
  help: "Simulator runs",
  registers: [registry],
});

export const ocrCallsTotal = new promClient.Counter({
  name: "metaplatform_ocr_calls_total",
  help: "OCR calls served",
  registers: [registry],
});

export const cacheHitsTotal = new promClient.Counter({
  name: "metaplatform_cache_hits_total",
  help: "Redis cache hits",
  registers: [registry],
});

export const cacheMissesTotal = new promClient.Counter({
  name: "metaplatform_cache_misses_total",
  help: "Redis cache misses",
  registers: [registry],
});

// ─── Cache for /metrics output ────────────────────────────
let lastMetricsScrapeAt = 0;
let lastMetricsText = "";

/**
 * Update backend health gauges. Call periodically.
 */
export async function updateBackendHealth() {
  const checks = [];
  try {
    const { healthCheckAll } = await import("../integrations/index.js");
    checks.push(["neo4j", "neo4j"], ["elasticsearch", "elasticsearch"], ["milvus", "milvus"], ["minio", "minio"], ["kafka", "kafka"]);
    const h = await healthCheckAll();
    for (const [k] of checks) {
      backendUp.set({ backend: k }, h[k]?.status === "connected" || h[k]?.status === "green" || h[k]?.status === "healthy" ? 1 : 0);
    }
  } catch (e) {
    // leave gauges as-is
  }

  // PostgreSQL + Redis
  try {
    const { default: db } = await import("../db.js");
    db.prepare("SELECT 1").get();
    backendUp.set({ backend: "postgres" }, 1);
  } catch {
    backendUp.set({ backend: "postgres" }, 0);
  }

  try {
    const { redisHealthCheck } = await import("../middleware/cache.js");
    const r = await redisHealthCheck();
    backendUp.set({ backend: "redis" }, r.status === "connected" ? 1 : 0);
  } catch {
    backendUp.set({ backend: "redis" }, 0);
  }

  try {
    const ch = await import("../integrations/clickhouse.js");
    const health = await ch.healthCheck();
    backendUp.set({ backend: "clickhouse" }, health.status === "connected" ? 1 : 0);
  } catch (e) {
    backendUp.set({ backend: "clickhouse" }, 0);
  }
}

/**
 * Express middleware: record HTTP metrics for each request.
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  res.on("finish", () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.baseUrl + (req.path || "") || "unknown";
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSec);
    httpRequestsInFlight.dec();
  });

  next();
}

/**
 * Render metrics in Prometheus text format.
 * Cached for 1 second to avoid hammering the registry under load.
 */
export async function renderMetrics() {
  const now = Date.now();
  if (now - lastMetricsScrapeAt < 1000 && lastMetricsText) {
    return lastMetricsText;
  }
  await updateBackendHealth();
  lastMetricsText = await registry.metrics();
  lastMetricsScrapeAt = now;
  return lastMetricsText;
}

/**
 * Reset the registry (mostly for tests).
 */
export function resetMetrics() {
  registry.resetMetrics();
}

export { registry };

export default {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsInFlight,
  backendUp,
  loginsTotal,
  ragQueriesTotal,
  ragRetrieveDuration,
  agentRunsTotal,
  agentStepsHistogram,
  nl2sqlQueriesTotal,
  cdcEventsEmittedTotal,
  simulatorRunsTotal,
  ocrCallsTotal,
  cacheHitsTotal,
  cacheMissesTotal,
  metricsMiddleware,
  renderMetrics,
  updateBackendHealth,
  resetMetrics,
};