/**
 * Task Scheduler (Phase 7 — Notifications + DX)
 *
 * Lightweight cron-style scheduler. Each job has:
 *   - name:     unique identifier
 *   - cron:     "min hr day mo dow" (5-field cron)
 *   - handler:  async function
 *   - enabled:  bool
 *
 * Jobs are persisted to SQLite/PG so they survive restarts.
 *
 * Built-in jobs:
 *   - metrics.scrape_aggregator  every 1m  (no-op, hook for future)
 *   - cdc.reset_watermark       every 1h  (if RESET_WATERMARK_HOURLY=true)
 *   - cleanup.old_audit         every 1d  (retain last 30 days)
 */

import db from "./db.js";
import { logger } from "./observability/logger.js";

// ─── Schema setup ────────────────────────────────────────
let ensuredSchema = false;
function ensureSchema() {
  if (ensuredSchema) return;
  try {
    const isPg = !!process.env.DATABASE_URL;
    if (isPg) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scheduler_jobs (
          name TEXT PRIMARY KEY,
          cron TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          last_run TEXT,
          next_run TEXT,
          run_count INTEGER NOT NULL DEFAULT 0,
          last_status TEXT,
          last_error TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS scheduler_runs (
          id BIGSERIAL PRIMARY KEY,
          job_name TEXT NOT NULL,
          started_at TIMESTAMP NOT NULL DEFAULT NOW(),
          finished_at TIMESTAMP,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          error TEXT
        );
      `);
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scheduler_jobs (
          name TEXT PRIMARY KEY,
          cron TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          last_run TEXT,
          next_run TEXT,
          run_count INTEGER NOT NULL DEFAULT 0,
          last_status TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS scheduler_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_name TEXT NOT NULL,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          finished_at TEXT,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          error TEXT,
          FOREIGN KEY (job_name) REFERENCES scheduler_jobs(name)
        );
      `);
    }
    ensuredSchema = true;
  } catch (err) {
    console.warn("[Scheduler] schema setup failed:", err.message);
  }
}

// ─── Cron parsing ─────────────────────────────────────────
// Supports: "*/5 * * * *" or "0 8 * * *" (5-field)
// Returns next Date >= from
function nextRunAt(cron, from = new Date()) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron: ${cron}`);
  const [minExpr, hourExpr, dayExpr, moExpr, dowExpr] = parts;

  // Pre-parse each field into set of valid values
  const minSet = parseField(minExpr, 0, 59);
  const hourSet = parseField(hourExpr, 0, 23);
  const daySet = parseField(dayExpr, 1, 31);
  const moSet = parseField(moExpr, 1, 12);
  const dowSet = parseField(dowExpr, 0, 6);

  // Try next 366 days
  let candidate = new Date(from.getTime() + 60 * 1000); // start at +1 minute
  candidate.setSeconds(0, 0);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const d = candidate.getDate();
    const mo = candidate.getMonth() + 1;
    const dow = candidate.getDay();
    if (
      minSet.has(m) &&
      hourSet.has(h) &&
      daySet.has(d) &&
      moSet.has(mo) &&
      dowSet.has(dow)
    ) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + 60 * 1000);
  }
  return null;
}

function parseField(expr, min, max) {
  const set = new Set();
  for (const part of expr.split(",")) {
    if (part.includes("/")) {
      const [range, step] = part.split("/");
      const stepN = parseInt(step, 10);
      let start, end;
      if (range === "*") {
        start = min;
        end = max;
      } else if (range.includes("-")) {
        [start, end] = range.split("-").map((n) => parseInt(n, 10));
      } else {
        start = parseInt(range, 10);
        end = max;
      }
      for (let i = start; i <= end; i += stepN) set.add(i);
    } else if (part.includes("-")) {
      const [start, end] = part.split("-").map((n) => parseInt(n, 10));
      for (let i = start; i <= end; i++) set.add(i);
    } else if (part === "*") {
      for (let i = min; i <= max; i++) set.add(i);
    } else {
      set.add(parseInt(part, 10));
    }
  }
  return set;
}

// ─── Job registry ─────────────────────────────────────────
const jobs = new Map(); // name -> { cron, handler, enabled, nextRun }
let intervalHandle = null;
let lastTickAt = 0;

export function register(name, cron, handler, opts = {}) {
  ensureSchema();
  const enabled = opts.enabled !== false;
  const nextRun = enabled ? nextRunAt(cron) : null;
  jobs.set(name, { name, cron, handler, enabled, nextRun });

  try {
    db.prepare(
      `INSERT INTO scheduler_jobs (name, cron, enabled, next_run)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET cron = excluded.cron, enabled = excluded.enabled`
    ).run(name, cron, enabled ? 1 : 0, nextRun?.toISOString() || null);
  } catch (err) {
    logger.warn("scheduler.register_failed", { name, error: err.message });
  }

  logger.info("scheduler.job_registered", { name, cron, enabled, nextRun });
  return { name, cron, enabled, nextRun };
}

export function unregister(name) {
  // Built-in jobs are protected — registering them via registerBuiltin
  // populates BUILTIN_HANDLERS so we can recognise them here.
  if (BUILTIN_HANDLERS[name]) return false;
  const existed = jobs.has(name);
  jobs.delete(name);
  try {
    db.prepare("DELETE FROM scheduler_jobs WHERE name = ?").run(name);
  } catch {}
  return existed;
}

export function enable(name, enabled = true) {
  const job = jobs.get(name);
  if (!job) return false;
  job.enabled = enabled;
  job.nextRun = enabled ? nextRunAt(job.cron) : null;
  try {
    db.prepare(
      "UPDATE scheduler_jobs SET enabled = ?, next_run = ? WHERE name = ?"
    ).run(enabled ? 1 : 0, job.nextRun?.toISOString() || null, name);
  } catch {}
  return true;
}

export function listJobs() {
  return [...jobs.values()].map((j) => ({
    name: j.name,
    cron: j.cron,
    enabled: j.enabled,
    nextRun: j.nextRun?.toISOString() || null,
  }));
}

// ─── Tick loop ────────────────────────────────────────────
async function tick() {
  const now = new Date();
  for (const job of jobs.values()) {
    if (!job.enabled || !job.nextRun) continue;
    if (job.nextRun > now) continue;

    // Run
    const startedAt = new Date();
    const startedMs = Date.now();
    let status = "ok";
    let error = null;
    try {
      await job.handler();
    } catch (err) {
      status = "error";
      error = err.message;
      logger.error("scheduler.job_failed", { name: job.name, error: err.message });
    }
    const durationMs = Date.now() - startedMs;

    // Persist run history
    try {
      db.prepare(
        `INSERT INTO scheduler_runs (job_name, started_at, finished_at, status, duration_ms, error)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        job.name,
        startedAt.toISOString(),
        new Date().toISOString(),
        status,
        durationMs,
        error
      );
      db.prepare(
        `UPDATE scheduler_jobs SET last_run = ?, next_run = ?, run_count = run_count + 1,
                                   last_status = ?, last_error = ? WHERE name = ?`
      ).run(
        startedAt.toISOString(),
        nextRunAt(job.cron)?.toISOString() || null,
        status,
        error,
        job.name
      );
    } catch (err) {
      logger.warn("scheduler.persist_failed", { name: job.name, error: err.message });
    }

    job.nextRun = nextRunAt(job.cron, new Date());
    logger.info("scheduler.job_completed", { name: job.name, durationMs, status });
  }
}

export function start(intervalMs = 60 * 1000) {
  if (intervalHandle) return;
  ensureSchema();
  // Restore jobs from DB
  try {
    const rows = db.prepare("SELECT name, cron, enabled FROM scheduler_jobs").all();
    for (const row of rows) {
      // Restore handler from default registry; DB only stores metadata
      const handler = BUILTIN_HANDLERS[row.name] || (async () => {});
      jobs.set(row.name, {
        name: row.name,
        cron: row.cron,
        handler,
        enabled: row.enabled === 1,
        nextRun: row.enabled === 1 ? nextRunAt(row.cron) : null,
      });
    }
  } catch (err) {
    logger.warn("scheduler.restore_failed", { error: err.message });
  }

  intervalHandle = setInterval(() => {
    tick().catch((err) => logger.warn("scheduler.tick_error", { error: err.message }));
  }, intervalMs);
  lastTickAt = Date.now();
  logger.info("scheduler.started", { intervalMs, jobs: jobs.size });
}

export function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info("scheduler.stopped");
}

export function getStatus() {
  return {
    running: intervalHandle !== null,
    tickIntervalMs: 60 * 1000,
    lastTickAt: lastTickAt ? new Date(lastTickAt).toISOString() : null,
    jobCount: jobs.size,
    jobs: listJobs(),
  };
}

export function runNow(name) {
  const job = jobs.get(name);
  if (!job) return Promise.reject(new Error(`Job not found: ${name}`));
  return job.handler();
}

export function recentRuns(name, limit = 20) {
  try {
    return db.prepare(
      "SELECT * FROM scheduler_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT ?"
    ).all(name, limit);
  } catch {
    return [];
  }
}

// ─── Built-in handlers (registered by default) ────────────
const BUILTIN_HANDLERS = {};

export function registerBuiltin(name, cron, handler, opts = {}) {
  BUILTIN_HANDLERS[name] = handler;
  return register(name, cron, handler, opts);
}

// Register common jobs (safe defaults — they don't do destructive things)
registerBuiltin(
  "metrics.heartbeat",
  "*/5 * * * *",
  async () => {
    // Periodic heartbeat — keeps scheduler liveness observable in logs/metrics
    logger.debug("scheduler.heartbeat", { ts: new Date().toISOString() });
  },
  { enabled: true }
);

registerBuiltin(
  "cdc.emit_heartbeat",
  "*/1 * * * *",
  async () => {
    // Could be used to emit periodic CDC events; currently a no-op
    // Future: trigger CDC poll() if last emit > 60s ago
  },
  { enabled: true }
);

// F4.6.14/16 — flush the in-memory API-key call ring into SQLite every
// minute. Keeps the dashboard query cheap without blocking request
// handlers. If api-rate-limit module isn't loaded yet, import safely
// via dynamic import so we don't create a circular dep.
registerBuiltin(
  "apikeys.flush_call_log",
  "*/1 * * * *",
  async () => {
    try {
      const { flushCallLogToDb } = await import("./middleware/api-rate-limit.js");
      const n = flushCallLogToDb();
      if (n > 0) logger.debug("apikeys.flush_call_log", { flushed: n });
    } catch (err) {
      logger.warn("apikeys.flush_call_log_failed", { error: String(err?.message ?? err) });
    }
  },
  { enabled: true }
);

export { nextRunAt };
export default { register, registerBuiltin, unregister, enable, listJobs, start, stop, getStatus, runNow, recentRuns, nextRunAt };