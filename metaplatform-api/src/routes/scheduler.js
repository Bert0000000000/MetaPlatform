/**
 * F4.6.22 定时任务管理 (HTTP surface over the in-process scheduler)
 *
 * GET    /api/scheduler              — list jobs + scheduler status
 * GET    /api/scheduler/:name/runs   — recent run history (per-job)
 * POST   /api/scheduler/:name/run    — trigger a job immediately
 * PATCH  /api/scheduler/:name        — enable/disable
 * DELETE /api/scheduler/:name        — unregister a non-builtin job
 *
 * The scheduler itself is already in src/scheduler.js — this module
 * just exposes it to the admin SPA. We deliberately forbid unregister
 * on jobs registered via registerBuiltin() so a typo in the UI can't
 * silently kill the metrics.heartbeat / apikeys.flush_call_log / etc.
 */

import { Router } from "express";
import {
  listJobs,
  getStatus,
  runNow,
  recentRuns,
  enable,
  unregister,
  register,
} from "../scheduler.js";

const router = Router();

// ── GET / — status + jobs list ──────────────────────────────
router.get("/", (_req, res) => {
  const s = getStatus();
  res.json({
    success: true,
    data: {
      running: s.running,
      lastTickAt: s.lastTickAt,
      jobCount: s.jobCount,
      jobs: listJobs(),
    },
  });
});

// ── GET /:name/runs — last N runs ──────────────────────────
router.get("/:name/runs", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const rows = recentRuns(req.params.name, limit);
  res.json({ success: true, data: rows });
});

// ── POST /:name/run — manual trigger ───────────────────────
router.post("/:name/run", async (req, res, next) => {
  try {
    const start = Date.now();
    let error = null;
    try {
      await runNow(req.params.name);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    res.json({
      success: !error,
      data: {
        job: req.params.name,
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        error,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:name — enable/disable ──────────────────────────
router.patch("/:name", (req, res) => {
  const name = req.params.name;
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(400).json({ success: false, error: "需要提供 {enabled: boolean}" });
  }
  const ok = enable(name, req.body.enabled);
  if (!ok) return res.status(404).json({ success: false, error: `Job not found: ${name}` });
  res.json({ success: true, data: { name, enabled: req.body.enabled } });
});

// ── DELETE /:name — unregister (built-in jobs are protected) ──
router.delete("/:name", (req, res) => {
  try {
    const ok = unregister(req.params.name);
    if (!ok) {
      return res.status(400).json({
        success: false,
        error: "内置任务或未知任务，无法撤销注册",
      });
    }
    res.json({ success: true, data: { name: req.params.name } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
});

// ── POST / — register a NEW ad-hoc job (admin only) ───────
// Body: { name, cron, handlerKind, payload? }
//   handlerKind = "webhook" → fires HTTP POST to payload.url
//                "log"      → writes a structured log line
// Useful so an admin can cron-test things without restarting the API.
router.post("/", (req, res) => {
  const { name, cron, handlerKind = "log", payload = null } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ success: false, error: "name 必填" });
  }
  if (!cron || typeof cron !== "string" || cron.split(" ").length !== 5) {
    return res.status(400).json({ success: false, error: "cron 必须是 5 字段表达式 (分 时 日 月 周)" });
  }
  if (!["log", "webhook"].includes(handlerKind)) {
    return res.status(400).json({ success: false, error: "handlerKind 仅支持 log / webhook" });
  }

  let handler;
  if (handlerKind === "webhook") {
    const url = payload?.url;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "webhook 模式需要 payload.url" });
    }
    handler = async () => {
      try {
        const resp = await fetch(url, {
          method: payload?.method ?? "POST",
          headers: { "Content-Type": "application/json", ...(payload?.headers || {}) },
          body: payload?.body ? JSON.stringify(payload.body) : undefined,
        });
        return { ok: resp.ok, status: resp.status };
      } catch (e) {
        return { error: String(e?.message ?? e) };
      }
    };
  } else {
    // log-mode — useful for ad-hoc heartbeat jobs
    handler = async () => ({ ts: new Date().toISOString(), name });
  }

  try {
    register(name, cron, handler, { enabled: true });
    res.status(201).json({ success: true, data: { name, cron, handlerKind, enabled: true } });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err?.message ?? err) });
  }
});

export default router;