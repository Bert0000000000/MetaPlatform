/**
 * F4.6.17 OpenAPI - Webhook 配置
 *
 * Lets an admin register external HTTP endpoints that get called when
 * certain platform events fire (data created/updated, app published,
 * process completed, etc.). We persist the delivery log so failures
 * are visible from the UI without having to scrape server logs.
 *
 *   POST   /api/webhooks                 — register endpoint
 *   GET    /api/webhooks                 — list endpoints for app
 *   GET    /api/webhooks/:id             — fetch one (incl. secret once)
 *   PATCH  /api/webhooks/:id             — edit / toggle
 *   DELETE /api/webhooks/:id             — remove endpoint
 *   POST   /api/webhooks/:id/test        — fire a synthetic test event
 *   GET    /api/webhooks/:id/deliveries  — recent delivery log
 *
 * The endpoint secret is shown exactly once at registration time and
 * thereafter only the SHA-256 fingerprint is echoed back, mirroring
 * the F4.6.13 API Key reveal-once UX.
 */

import { Router } from "express";
import crypto from "node:crypto";
import db from "../db.js";

const router = Router();

// ─── Schema bootstrap ───────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id            TEXT PRIMARY KEY,
    app_id        TEXT NOT NULL,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL,
    secret        TEXT NOT NULL,
    secret_hash   TEXT NOT NULL,
    events        TEXT NOT NULL DEFAULT '*',
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_app ON webhook_endpoints(app_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_hash ON webhook_endpoints(secret_hash);

  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id     TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    payload         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    attempt         INTEGER NOT NULL DEFAULT 0,
    response_status INTEGER,
    response_body   TEXT,
    last_error      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    delivered_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_ep  ON webhook_deliveries(endpoint_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_ts  ON webhook_deliveries(created_at);
`);

/* ─── helpers ─────────────────────────────────────────────── */
const SECRET_PREFIX = "whsec_";

function generateSecret() {
  return SECRET_PREFIX + crypto.randomBytes(20).toString("hex"); // 40 hex chars
}
function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}
function signPayload(secret, payload) {
  // X-Webhook-Signature: sha256=<hex>; t=<unix>; v=<nonce>
  const t = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(6).toString("hex");
  const body = `${t}.${nonce}.${payload}`;
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return { signature: `sha256=${sig}`, t, nonce };
}

/** Strip secret from a row before responding to the UI. */
function publicView(row) {
  if (!row) return null;
  return {
    id: row.id,
    app_id: row.app_id,
    name: row.name,
    url: row.url,
    events: row.events,
    enabled: !!row.enabled,
    secret_fingerprint: row.secret_hash?.slice(0, 12),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Fire a webhook with retries (1s/3s/9s). Returns the last attempt. */
async function deliver(endpoint, eventType, payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const sig = signPayload(endpoint.secret, payload);
  const headers = {
    "Content-Type": "application/json",
    "X-Webhook-Event": eventType,
    "X-Webhook-Signature": sig.signature,
    "X-Webhook-Timestamp": String(sig.t),
    "X-Webhook-Nonce": sig.nonce,
    "User-Agent": "MetaPlatform-Webhooks/1.0",
  };
  const insertDelivery = db.prepare(
    `INSERT INTO webhook_deliveries (endpoint_id, event_type, payload, attempt, status)
     VALUES (?, ?, ?, 0, 'pending')`,
  );
  const updateDelivery = db.prepare(
    `UPDATE webhook_deliveries
     SET attempt = ?, status = ?, response_status = ?, response_body = ?,
         last_error = ?, delivered_at = ?
     WHERE id = ?`,
  );
  const deliveryId = insertDelivery.run(endpoint.id, eventType, payload).lastInsertRowid;

  const delays = [0, 1000, 3000]; // ms; attempt 1 immediately, retry after 1s/3s
  let lastResult = { ok: false, status: null, body: null, error: null };

  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const resp = await fetch(endpoint.url, { method: "POST", headers, body: payload });
      const body = await resp.text().catch(() => "");
      lastResult = { ok: resp.ok, status: resp.status, body: body.slice(0, 1024), error: null };
      if (resp.ok) break;
    } catch (e) {
      lastResult = { ok: false, status: null, body: null, error: String(e?.message ?? e) };
    }
  }

  updateDelivery.run(
    delays.length,
    lastResult.ok ? "success" : "failed",
    lastResult.status,
    lastResult.body,
    lastResult.error,
    lastResult.ok ? new Date().toISOString() : null,
    deliveryId,
  );

  return { ok: lastResult.ok, ...lastResult, delivery_id: Number(deliveryId) };
}

/* ─── routes ─────────────────────────────────────────────── */

router.post("/", async (req, res, next) => {
  try {
    const { app_id, name, url, events = "*", enabled = true } = req.body || {};
    if (!app_id || !name || !url) {
      return res.status(400).json({ success: false, error: "app_id, name, url 必填" });
    }
    if (!/^https?:\/\//.test(url)) {
      return res.status(400).json({ success: false, error: "url 必须以 http:// 或 https:// 开头" });
    }
    const id = "wh-" + crypto.randomBytes(6).toString("hex");
    const secret = generateSecret();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO webhook_endpoints (id, app_id, name, url, secret, secret_hash, events, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, app_id, name, url, secret, hashSecret(secret), events, enabled ? 1 : 0, now, now);
    const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(id);
    // Reveal secret exactly once.
    res.status(201).json({ success: true, data: { ...publicView(row), secret } });
  } catch (err) {
    next(err);
  }
});

router.get("/", (req, res) => {
  const appId = req.query.appId;
  const rows = appId
    ? db.prepare("SELECT * FROM webhook_endpoints WHERE app_id = ? ORDER BY created_at DESC").all(appId)
    : db.prepare("SELECT * FROM webhook_endpoints ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows.map(publicView) });
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Webhook 不存在" });
  res.json({ success: true, data: publicView(row) });
});

router.patch("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Webhook 不存在" });
  const updates = {};
  if ("name" in (req.body || {})) updates.name = String(req.body.name || "").trim();
  if ("url" in (req.body || {})) updates.url = String(req.body.url || "").trim();
  if ("events" in (req.body || {})) updates.events = String(req.body.events || "*");
  if ("enabled" in (req.body || {})) updates.enabled = req.body.enabled ? 1 : 0;
  if ("url" in updates && !/^https?:\/\//.test(updates.url)) {
    return res.status(400).json({ success: false, error: "url 必须以 http:// 或 https:// 开头" });
  }
  updates.updated_at = new Date().toISOString();
  const setClause = Object.keys(updates).map((c) => `${c} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE webhook_endpoints SET ${setClause} WHERE id = ?`).run(...values, req.params.id);
  const fresh = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: publicView(fresh) });
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: "Webhook 不存在" });
  db.prepare("DELETE FROM webhook_deliveries WHERE endpoint_id = ?").run(req.params.id);
  db.prepare("DELETE FROM webhook_endpoints WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

router.post("/:id/test", async (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM webhook_endpoints WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Webhook 不存在" });
    const syntheticPayload = {
      event: "webhook.test",
      endpoint_id: row.id,
      app_id: row.app_id,
      at: new Date().toISOString(),
      message: req.body?.message ?? "Hello from MetaPlatform!",
      nonce: crypto.randomBytes(8).toString("hex"),
    };
    const result = await deliver(row, "webhook.test", syntheticPayload);
    res.json({ success: result.ok, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/deliveries", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const rows = db.prepare(
    `SELECT id, endpoint_id, event_type, attempt, status, response_status,
            substr(response_body, 1, 512) AS response_body, last_error,
            created_at, delivered_at
     FROM webhook_deliveries
     WHERE endpoint_id = ?
     ORDER BY id DESC
     LIMIT ?`,
  ).all(req.params.id, limit);
  res.json({ success: true, data: rows });
});

export default router;