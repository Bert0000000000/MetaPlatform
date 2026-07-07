/**
 * /api/observability — Metrics / logs / traces / audit (Phase 5)
 */
import { Router } from "express";
import * as metrics from "../observability/metrics.js";
import { logger, getRecentLogs, getStatus as loggerStatus } from "../observability/logger.js";
import * as tracer from "../observability/tracer.js";
import * as audit from "../observability/audit.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Prometheus text-format scrape endpoint (public — Prometheus doesn't auth)
router.get("/metrics", async (_req, res) => {
  try {
    const text = await metrics.renderMetrics();
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(text);
  } catch (err) {
    res.status(500).send("# error: " + err.message);
  }
});

// Aggregate JSON status (public — healthcheck-like)
router.get("/status", async (_req, res) => {
  try {
    const s = metrics.getStatus ? metrics.getStatus() : {};
    const t = tracer.getStatus();
    const l = loggerStatus();
    const a = audit.getStatus();
    res.json({ success: true, data: { metrics: s, tracer: t, logger: l, audit: a } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logs (auth required to prevent log leakage)
router.get("/logs", authenticate, (req, res) => {
  const { level, traceId, since, limit } = req.query;
  const entries = getRecentLogs({
    level: level || undefined,
    traceId: traceId || undefined,
    since: since || undefined,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  res.json({ success: true, data: entries });
});

router.get("/logs/by-trace/:id", authenticate, (req, res) => {
  const entries = getRecentLogs({ traceId: req.params.id, limit: 500 });
  res.json({ success: true, data: entries });
});

// Traces (auth required)
router.get("/traces", authenticate, (req, res) => {
  const { limit, since } = req.query;
  const data = tracer.listTraces({
    limit: limit ? parseInt(limit, 10) : 50,
    since: since ? new Date(since).getTime() : undefined,
  });
  res.json({ success: true, data });
});

router.get("/traces/:id", authenticate, (req, res) => {
  const trace = tracer.getTrace(req.params.id);
  if (!trace) return res.status(404).json({ success: false, error: "trace not found" });
  res.json({ success: true, data: trace });
});

// Audit (auth required)
router.get("/audit", authenticate, (req, res) => {
  const { userId, action, resourceType, limit } = req.query;
  const data = audit.query({
    userId: userId || undefined,
    action: action || undefined,
    resourceType: resourceType || undefined,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  res.json({ success: true, data });
});

// Record synthetic audit event (dev convenience — also lets tests verify)
router.post("/audit/test", authenticate, (req, res) => {
  audit.record({
    action: req.body.action || "test.event",
    userId: req.user?.id,
    userEmail: req.user?.email,
    resourceType: req.body.resourceType,
    resourceId: req.body.resourceId,
    traceId: req.traceId,
    metadata: req.body.metadata,
    status: req.body.status || "success",
  });
  res.json({ success: true, data: { recorded: true } });
});

export default router;