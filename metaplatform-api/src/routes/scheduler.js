/**
 * /api/scheduler — Task scheduler admin (Phase 7 — DX)
 *
 *   GET    /api/scheduler/status      Current status + jobs list
 *   GET    /api/scheduler/jobs        List all jobs
 *   POST   /api/scheduler/jobs        Register a new job
 *   DELETE /api/scheduler/jobs/:name  Remove a job
 *   POST   /api/scheduler/jobs/:name/enable   Set enabled=true
 *   POST   /api/scheduler/jobs/:name/disable  Set enabled=false
 *   POST   /api/scheduler/jobs/:name/run      Trigger immediately
 *   GET    /api/scheduler/jobs/:name/runs     Recent run history
 */
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as scheduler from "../scheduler.js";

const router = Router();

router.get("/status", authenticate, (_req, res) => {
  res.json({ success: true, data: scheduler.getStatus() });
});

router.get("/jobs", authenticate, (_req, res) => {
  res.json({ success: true, data: scheduler.listJobs() });
});

router.post("/jobs", authenticate, (req, res) => {
  const { name, cron, handler } = req.body;
  if (!name || !cron) return res.status(400).json({ success: false, error: "name/cron required" });

  // Only allow built-in handlers (security: don't let anyone register arbitrary code)
  const BUILTIN = {
    "noop": async () => {},
    "log.heartbeat": async () => console.log(`[scheduler] heartbeat ${Date.now()}`),
    "metrics.flush": async () => {
      const m = await import("../observability/metrics.js");
      return m.updateBackendHealth();
    },
  };
  const fn = BUILTIN[handler] || BUILTIN.noop;
  const result = scheduler.register(name, cron, fn);
  res.json({ success: true, data: result });
});

router.delete("/jobs/:name", authenticate, (req, res) => {
  scheduler.unregister(req.params.name);
  res.json({ success: true, data: { removed: req.params.name } });
});

router.post("/jobs/:name/enable", authenticate, (req, res) => {
  const ok = scheduler.enable(req.params.name, true);
  res.json({ success: ok, data: { enabled: ok } });
});

router.post("/jobs/:name/disable", authenticate, (req, res) => {
  const ok = scheduler.enable(req.params.name, false);
  res.json({ success: ok, data: { enabled: !ok } });
});

router.post("/jobs/:name/run", authenticate, async (req, res, next) => {
  try {
    await scheduler.runNow(req.params.name);
    res.json({ success: true, data: { ran: req.params.name } });
  } catch (err) { next(err); }
});

router.get("/jobs/:name/runs", authenticate, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  res.json({ success: true, data: scheduler.recentRuns(req.params.name, limit) });
});

export default router;