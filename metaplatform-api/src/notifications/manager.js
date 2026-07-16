/**
 * Notification Manager (Phase 7 — Notifications)
 *
 * Multi-channel notification dispatcher:
 *   - inapp (站内信)        : stored in notifications table, read via /api/notifications
 *   - email (邮件)           : SMTP via nodemailer if configured, otherwise stub-log
 *   - webhook (Webhook)      : POST to a configured URL with HMAC signature
 *
 * Channels are pluggable: pass any number to dispatch().
 *
 * Usage:
 *   import { notify } from "./notifications/manager.js";
 *   await notify({
 *     userId: "u-123",
 *     category: "task_assigned",
 *     title: "New task assigned",
 *     body: "You have been assigned task T-42",
 *     data: { taskId: "T-42" },
 *     channels: ["inapp", "email", "webhook"]
 *   });
 */

import db from "../db.js";
import { logger } from "../observability/logger.js";
import { EventEmitter } from "node:events";

let ensuredSchema = false;
function ensureSchema() {
  if (ensuredSchema) return;
  try {
    if (process.env.DATABASE_URL) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id BIGSERIAL PRIMARY KEY,
          ts TIMESTAMP NOT NULL DEFAULT NOW(),
          user_id TEXT NOT NULL,
          tenant_id TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          data TEXT,
          channels TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          delivered_via TEXT,
          read_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, ts DESC);
        CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);
      `);
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL DEFAULT (datetime('now')),
          user_id TEXT NOT NULL,
          tenant_id TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          data TEXT,
          channels TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          delivered_via TEXT,
          read_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, ts DESC);
        CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);
      `);
    }
    ensuredSchema = true;
  } catch (err) {
    console.warn("[Notifications] schema setup failed:", err.message);
  }
}

// ─── Channel plugins ──────────────────────────────────────
const inAppChannel = {
  name: "inapp",
  async send(notification) {
    // Already persisted in `notifications` table; mark delivered
    return { channel: "inapp", delivered: true, address: notification.userId };
  },
};

const emailChannel = {
  name: "email",
  async send(notification) {
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(notification.userId);
    if (!user?.email) {
      return { channel: "email", delivered: false, reason: "user_has_no_email" };
    }
    // SMTP integration point: when SMTP_HOST is set, swap with real nodemailer send.
    if (process.env.SMTP_HOST) {
      try {
        // Lazy-load nodemailer (optional dep)
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || "noreply@metaplatform.com",
          to: user.email,
          subject: notification.title,
          text: notification.body || "",
          html: `<h3>${notification.title}</h3><p>${notification.body || ""}</p>`,
        });
        return { channel: "email", delivered: true, address: user.email };
      } catch (err) {
        return { channel: "email", delivered: false, reason: err.message };
      }
    }
    // Stub-mode log
    logger.info("notification.email.stub", {
      to: user.email,
      subject: notification.title,
      body: notification.body,
    });
    return { channel: "email", delivered: true, address: user.email, stub: true };
  },
};

const webhookChannel = {
  name: "webhook",
  async send(notification) {
    const url = process.env.NOTIFICATIONS_WEBHOOK_URL;
    if (!url) return { channel: "webhook", delivered: false, reason: "no_webhook_configured" };
    try {
      const crypto = await import("node:crypto");
      const body = JSON.stringify(notification);
      const sig = crypto
        .createHmac("sha256", process.env.NOTIFICATIONS_WEBHOOK_SECRET || "secret")
        .update(body)
        .digest("hex");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MetaPlatform-Signature": sig,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      return { channel: "webhook", delivered: res.ok, status: res.status };
    } catch (err) {
      return { channel: "webhook", delivered: false, reason: err.message };
    }
  },
};

const CHANNELS = {
  inapp: inAppChannel,
  email: emailChannel,
  webhook: webhookChannel,
};

// ─── Real-time event bus for WebSocket subscribers ─────────
export const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(1000);

// ─── Main dispatcher ──────────────────────────────────────
export async function notify({
  userId,
  tenantId = null,
  category,
  title,
  body = null,
  data = null,
  channels = ["inapp"],
}) {
  if (!userId) throw new Error("userId required");
  if (!category) throw new Error("category required");
  if (!title) throw new Error("title required");
  ensureSchema();

  const dataStr = data ? JSON.stringify(data) : null;
  const channelsStr = JSON.stringify(channels);

  // Persist first
  let rowId;
  try {
    const result = db.prepare(
      `INSERT INTO notifications (user_id, tenant_id, category, title, body, data, channels)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, tenantId, category, title, body, dataStr, channelsStr);
    rowId = result.lastInsertRowid;
  } catch (err) {
    logger.error("notification.persist_failed", { error: err.message, userId, category });
    return { delivered: false, error: err.message };
  }

  const notification = {
    id: String(rowId),
    userId,
    tenantId,
    category,
    title,
    body,
    data,
    channels,
  };

  // Fan out to each requested channel
  const results = [];
  for (const chName of channels) {
    const channel = CHANNELS[chName];
    if (!channel) {
      results.push({ channel: chName, delivered: false, reason: "unknown_channel" });
      continue;
    }
    try {
      const r = await channel.send(notification);
      results.push(r);
    } catch (err) {
      results.push({ channel: chName, delivered: false, reason: err.message });
    }
  }

  const delivered = results.some((r) => r.delivered);
  const deliveredVia = results.filter((r) => r.delivered).map((r) => r.channel).join(",");

  // Update row
  try {
    db.prepare(
      "UPDATE notifications SET status = ?, delivered_via = ? WHERE id = ?"
    ).run(delivered ? "delivered" : "failed", deliveredVia, rowId);
  } catch {}

  // Emit for real-time subscribers (WebSocket)
  notificationBus.emit("notification", notification);

  logger.info("notification.sent", {
    notificationId: String(rowId),
    userId,
    category,
    delivered,
    channels: results.map((r) => `${r.channel}:${r.delivered}`).join(","),
  });

  return { id: String(rowId), delivered, results, notification };
}

// ─── Read APIs ────────────────────────────────────────────
export function listForUser(userId, { limit = 50, unreadOnly = false, since } = {}) {
  ensureSchema();
  const filters = ["user_id = ?"];
  const params = [userId];
  if (unreadOnly) {
    filters.push("read_at IS NULL");
  }
  if (since) {
    filters.push("ts >= ?");
    params.push(since);
  }
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE ${filters.join(" AND ")} ORDER BY ts DESC LIMIT ?`
    )
    .all(...params, limit);
  return rows.map(toApi);
}

export function unreadCount(userId) {
  ensureSchema();
  const row = db
    .prepare("SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL")
    .get(userId);
  return row?.n || 0;
}

export function markRead(notificationId, userId) {
  ensureSchema();
  const result = db.prepare(
    "UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL"
  ).run(notificationId, userId);
  return result.changes > 0;
}

export function markAllRead(userId) {
  ensureSchema();
  const result = db.prepare(
    "UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL"
  ).run(userId);
  return result.changes;
}

function toApi(row) {
  return {
    id: String(row.id),
    ts: typeof row.ts === "string" ? row.ts : new Date(row.ts).toISOString(),
    userId: row.user_id,
    tenantId: row.tenant_id,
    category: row.category,
    title: row.title,
    body: row.body,
    data: row.data ? safeJson(row.data) : null,
    channels: row.channels ? safeJson(row.channels) : null,
    status: row.status,
    deliveredVia: row.delivered_via,
    readAt: row.read_at ? (typeof row.read_at === "string" ? row.read_at : new Date(row.read_at).toISOString()) : null,
  };
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

export default { notify, listForUser, unreadCount, markRead, markAllRead, notificationBus };