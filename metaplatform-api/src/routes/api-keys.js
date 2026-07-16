/**
 * F4.6.13 API Key authentication
 *
 * POST   /api/auth/api-keys          — mint a new key (returns plaintext ONCE)
 * GET    /api/auth/api-keys          — list keys for the caller's tenant
 * DELETE /api/auth/api-keys/:id      — revoke a key
 *
 * GET    /api/auth/api-keys/whoami   — introspect the calling key (handy for
 *                                      clients to verify their token still
 *                                      works without paging an admin).
 *
 * On creation we hand back:
 *   { id, key, prefix, scopes, ... }
 * where `key` is the literal `mp_live_<32 random base32 chars>` string.
 * The DB only stores SHA-256(key) + the 12-char prefix — the raw token is
 * unrecoverable from then on, which is the usual API-key UX.
 */

import { Router } from "express";
import crypto from "node:crypto";
import db from "../db-sqlite.js";

const router = Router();

// ─── helpers ──────────────────────────────────────────────
const PREFIX = "mp_live_";
const KEY_LEN = 32;

function generateRawKey() {
  // 32 bytes → base64url → strip padding; gives ~43 chars of entropy.
  const buf = crypto.randomBytes(KEY_LEN);
  return PREFIX + buf.toString("base64url").slice(0, 32);
}

function hashKey(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function stripSecret(row) {
  if (!row) return null;
  // Never echo key_hash out — the prefix is enough to identify the key
  // in logs / dashboards.
  const { key_hash, ...safe } = row;
  return safe;
}

// ─── POST / — create new key ──────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "default";
    const userId = req.user?.id || req.user?.sub || "system";
    const {
      name,
      scopes = "read",
      appId = null,
      expiresAt = null,
      rateLimit = null,     // F4.6.14 requests/min; null = unlimited
    } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ success: false, error: "name 必填" });
    }
    if (typeof scopes === "string" && scopes.split(",").length > 32) {
      return res.status(400).json({ success: false, error: "scopes 不能超过 32 项" });
    }
    if (rateLimit != null && (!Number.isInteger(rateLimit) || rateLimit < 0 || rateLimit > 100000)) {
      return res.status(400).json({ success: false, error: "rateLimit 必须是 0/null 或 1..100000" });
    }

    const raw = generateRawKey();
    const id = "key-" + crypto.randomBytes(6).toString("hex");
    const hash = hashKey(raw);
    const prefix = raw.slice(0, 12);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, app_id, created_by, expires_at, rate_limit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, tenantId, name, hash, prefix, scopes, appId, userId, expiresAt, rateLimit, now);

    const row = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id);
    // NB: we send `key` ONCE here. The DB only has the hash.
    res.json({
      success: true,
      data: {
        ...stripSecret(row),
        // plaintext token — store it client-side, this is the only time we
        // surface it
        key: raw,
      },
      warning: "请立即保存 key 字符串，刷新页面后无法再查看。",
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET / — list keys for caller's tenant ────────────────
router.get("/", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "default";
    const rows = db
      .prepare(
        `SELECT id, tenant_id, name, key_prefix, scopes, app_id, created_by,
                last_used_at, expires_at, revoked_at, rate_limit, created_at
         FROM api_keys
         WHERE tenant_id = ? AND revoked_at IS NULL
         ORDER BY created_at DESC`,
      )
      .all(tenantId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id — adjust rate_limit without rotating the key ──
// We accept either {rateLimit: number|null} or {name} so the UI
// can rename as well. Empty body → 400.
router.patch("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "default";
    const existing = db
      .prepare("SELECT * FROM api_keys WHERE id = ? AND tenant_id = ?")
      .get(req.params.id, tenantId);
    if (!existing) return res.status(404).json({ success: false, error: "API key 不存在" });

    const updates = {};
    if ("rateLimit" in (req.body || {})) {
      const rl = req.body.rateLimit;
      if (rl != null && (!Number.isInteger(rl) || rl < 0 || rl > 100000)) {
        return res.status(400).json({ success: false, error: "rateLimit 必须是 0/null 或 1..100000" });
      }
      updates.rate_limit = rl;
    }
    if ("name" in (req.body || {})) {
      const n = (req.body.name || "").trim();
      if (!n) return res.status(400).json({ success: false, error: "name 不能为空" });
      updates.name = n;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: "至少提供一个可更新字段" });
    }

    const setClause = Object.keys(updates).map((c) => `${c} = ?`).join(", ");
    const values = Object.values(updates);
    db.prepare(`UPDATE api_keys SET ${setClause} WHERE id = ?`).run(...values, req.params.id);

    const row = db
      .prepare(
        `SELECT id, tenant_id, name, key_prefix, scopes, app_id, created_by,
                last_used_at, expires_at, revoked_at, rate_limit, created_at
         FROM api_keys WHERE id = ?`,
      )
      .get(req.params.id);
    res.json({ success: true, data: stripSecret(row) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id — revoke ─────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "default";
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `UPDATE api_keys
         SET revoked_at = ?
         WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`,
      )
      .run(now, req.params.id, tenantId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "API key 不存在或已撤销" });
    }
    res.json({ success: true, data: { id: req.params.id, revokedAt: now } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /stats — aggregate call counts per key ────────────
// F4.6.16 dashboard endpoint. Returns:
//   summary        — last_24h totals (calls, errors, rate_limited, error_rate)
//   per_key        — rows for each existing key (incl. zero-call rows)
//   top_paths_24h  — top 5 paths in last 24h by call count
//   timeline_24h   — 24 hourly buckets with call counts
//
// Reads from the api_key_calls table populated by the cron-flushed ring
// buffer (see middleware/api-rate-limit.js + scheduler.js). We always
// merge in any not-yet-flushed entries from the in-memory ring so the
// dashboard is real-time even between cron ticks.
router.get("/stats", async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "default";
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const since24 = now - 24 * HOUR;

    // Make sure table exists (scheduler may not have run yet)
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_key_calls (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id    TEXT NOT NULL,
        ts        INTEGER NOT NULL,
        path      TEXT NOT NULL,
        method    TEXT NOT NULL,
        status    INTEGER NOT NULL
      );
    `);

    // ── in-memory ring merge (real-time) ──
    const { getRecentCallStats } = await import("../middleware/api-rate-limit.js");
    const live = getRecentCallStats({ since: since24 });

    // Build a per-key map of {calls, errors, rate_limited} from DB rows
    // (a row counts as "error" when status >= 400).
    const dbRows = db.prepare(
      `SELECT key_id, status FROM api_key_calls WHERE ts >= ?`,
    ).all(since24);
    const merged = new Map(); // key_id -> {calls, errors, rate_limited}
    const tenantKeyIds = new Set(
      db.prepare("SELECT id FROM api_keys WHERE tenant_id = ?").all(tenantId).map((r) => r.id),
    );
    const acc = (row) => {
      const cur = merged.get(row.key_id) || { calls: 0, errors: 0, rate_limited: 0 };
      cur.calls += 1;
      if (row.status >= 400) cur.errors += 1;
      if (row.status === 429) cur.rate_limited += 1;
      merged.set(row.key_id, cur);
    };
    for (const r of dbRows) if (tenantKeyIds.has(r.key_id)) acc(r);
    for (const r of live)       if (tenantKeyIds.has(r.key_id)) acc(r);

    // Make sure each tenant key appears with a 0-row even if it never
    // made a call (so the UI table is complete).
    for (const id of tenantKeyIds) {
      if (!merged.has(id)) merged.set(id, { calls: 0, errors: 0, rate_limited: 0 });
    }

    // Map key_id → meta (name, prefix, rate_limit) for the response
    const meta = new Map(
      db.prepare(
        `SELECT id, name, key_prefix, rate_limit FROM api_keys
         WHERE tenant_id = ?`,
      ).all(tenantId).map((r) => [r.id, r]),
    );

    const per_key = [...merged.entries()].map(([key_id, s]) => {
      const m = meta.get(key_id);
      return {
        key_id,
        name: m?.name || key_id,
        key_prefix: m?.key_prefix || null,
        rate_limit: m?.rate_limit ?? null,
        calls: s.calls,
        errors: s.errors,
        rate_limited: s.rate_limited,
        error_rate: s.calls > 0 ? +(s.errors / s.calls).toFixed(4) : 0,
      };
    }).sort((a, b) => b.calls - a.calls);

    // ── top paths in last 24h ──
    const pathAgg = new Map(); // path -> count
    const accPath = (path) => pathAgg.set(path, (pathAgg.get(path) || 0) + 1);
    for (const r of db.prepare(
      `SELECT path FROM api_key_calls WHERE ts >= ?`,
    ).all(since24)) accPath(r.path);
    for (const r of live) accPath(r.path);
    const top_paths_24h = [...pathAgg.entries()]
      .map(([path, calls]) => ({ path, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5);

    // ── 24h hourly timeline ──
    const buckets = new Array(24).fill(0);
    const put = (ts) => {
      const idx = 23 - Math.floor((now - ts) / HOUR);
      if (idx >= 0 && idx < 24) buckets[idx] += 1;
    };
    for (const r of db.prepare(
      `SELECT ts FROM api_key_calls WHERE ts >= ?`,
    ).all(since24)) put(r.ts);
    for (const r of live) put(r.ts);
    const timeline_24h = buckets.map((calls, i) => {
      const t = new Date(now - (23 - i) * HOUR);
      return {
        hour: t.toISOString().slice(0, 13) + ":00",
        calls,
      };
    });

    const totals = per_key.reduce(
      (acc, k) => {
        acc.calls += k.calls;
        acc.errors += k.errors;
        acc.rate_limited += k.rate_limited;
        return acc;
      },
      { calls: 0, errors: 0, rate_limited: 0 },
    );

    res.json({
      success: true,
      data: {
        summary: {
          window_hours: 24,
          ...totals,
          error_rate: totals.calls > 0 ? +(totals.errors / totals.calls).toFixed(4) : 0,
          active_keys: per_key.filter((k) => k.calls > 0).length,
        },
        per_key,
        top_paths_24h,
        timeline_24h,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /whoami — introspect calling key ─────────────────
router.get("/whoami", async (req, res, next) => {
  try {
    // The apiKeyAuth middleware stashes the resolved row on req.apiKey
    if (!req.apiKey) {
      return res.status(401).json({ success: false, error: "未通过 API Key 认证" });
    }
    res.json({
      success: true,
      data: {
        id: req.apiKey.id,
        name: req.apiKey.name,
        scopes: req.apiKey.scopes.split(",").filter(Boolean),
        app_id: req.apiKey.app_id,
        tenant_id: req.apiKey.tenant_id,
        rate_limit: req.apiKey.rate_limit ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

// ─── Middleware factory (so other modules can opt in) ─────
// Usage:
//   import apiKeyAuth from "./routes/api-keys.js";
//   app.use("/api/external", authenticate, apiKeyAuth.middleware(), handler);
//
// Clients send the token as either:
//   Authorization: Bearer mp_live_xxxxxx
//   X-API-Key:    mp_live_xxxxxx
export function apiKeyMiddleware({ requiredScopes = [] } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const bearer = header.toLowerCase().startsWith("bearer ")
        ? header.slice(7).trim()
        : null;
      const raw = bearer || req.headers["x-api-key"];
      if (!raw || !raw.startsWith(PREFIX)) return next(); // fall through to JWT

      const hash = hashKey(raw);
      const row = db
        .prepare(
          `SELECT * FROM api_keys
           WHERE key_hash = ?
             AND revoked_at IS NULL
             AND (expires_at IS NULL OR expires_at > datetime('now'))
           LIMIT 1`,
        )
        .get(hash);
      if (!row) return res.status(401).json({ success: false, error: "Invalid or revoked API key" });

      const granted = new Set((row.scopes || "").split(",").filter(Boolean));
      const missing = requiredScopes.filter((s) => !granted.has(s));
      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Missing required scope(s): ${missing.join(", ")}`,
        });
      }

      // touch last_used_at — async, fire-and-forget
      db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);

      req.apiKey = row;
      // synthesise a user so downstream handlers using req.user still work
      req.user = { id: row.created_by, sub: row.created_by, role: "api" };
      req.tenantId = req.tenantId || row.tenant_id;
      next();
    } catch (err) {
      next(err);
    }
  };
}