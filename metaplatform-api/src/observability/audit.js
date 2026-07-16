/**
 * Audit Trail (Phase 5 — Observability)
 *
 * Records user-facing security-relevant actions (login, data mutation,
 * role change, file upload, etc.) for compliance & forensics.
 *
 * Storage: SQLite/PostgreSQL `audit_events` table (auto-created) + in-memory
 * ring buffer for the /api/observability/audit endpoint.
 */

import db from "../db.js";
import { logger } from "./logger.js";

const RING_SIZE = parseInt(process.env.AUDIT_BUFFER_SIZE || "500", 10);
const ringBuffer = [];
const ringIndex = { value: 0 };

let ensuredSchema = false;

/**
 * Ensure the audit_events table exists in the active database.
 */
function ensureSchema() {
  if (ensuredSchema) return;
  try {
    if (process.env.DATABASE_URL) {
      // PG mode: use the worker's prepare (sync)
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id BIGSERIAL PRIMARY KEY,
          ts TIMESTAMP NOT NULL DEFAULT NOW(),
          user_id TEXT,
          user_email TEXT,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          ip TEXT,
          user_agent TEXT,
          trace_id TEXT,
          status TEXT NOT NULL DEFAULT 'success',
          metadata TEXT,
          tenant_id TEXT
        );
        CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events(ts DESC);
        CREATE INDEX IF NOT EXISTS audit_events_user_idx ON audit_events(user_id);
        CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events(action);
      `);
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL DEFAULT (datetime('now')),
          user_id TEXT,
          user_email TEXT,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          ip TEXT,
          user_agent TEXT,
          trace_id TEXT,
          status TEXT NOT NULL DEFAULT 'success',
          metadata TEXT,
          tenant_id TEXT
        );
        CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events(ts DESC);
        CREATE INDEX IF NOT EXISTS audit_events_user_idx ON audit_events(user_id);
        CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events(action);
      `);
    }
    ensuredSchema = true;
  } catch (err) {
    console.warn("[Audit] Schema setup failed:", err.message);
  }
}

/**
 * Record an audit event.
 *
 * @param {object} event
 * @param {string} event.action        - e.g. "login", "create", "delete", "export"
 * @param {string} [event.userId]
 * @param {string} [event.userEmail]
 * @param {string} [event.resourceType]
 * @param {string} [event.resourceId]
 * @param {string} [event.ip]
 * @param {string} [event.userAgent]
 * @param {string} [event.traceId]
 * @param {object} [event.metadata]
 * @param {string} [event.status='success'|'failure']
 */
export function record(event) {
  ensureSchema();
  const entry = {
    ts: new Date().toISOString(),
    userId: event.userId || null,
    userEmail: event.userEmail || null,
    action: String(event.action),
    resourceType: event.resourceType || null,
    resourceId: event.resourceId || null,
    ip: event.ip || null,
    userAgent: event.userAgent || null,
    traceId: event.traceId || null,
    status: event.status || "success",
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    tenantId: event.tenantId || null,
  };

  // Push to ring buffer
  ringBuffer[ringIndex.value] = entry;
  ringIndex.value = (ringIndex.value + 1) % RING_SIZE;

  // Persist to DB (best-effort)
  try {
    db.prepare(
      `INSERT INTO audit_events
        (user_id, user_email, action, resource_type, resource_id, ip, user_agent, trace_id, status, metadata, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.userId,
      entry.userEmail,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.ip,
      entry.userAgent,
      entry.traceId,
      entry.status,
      entry.metadata,
      entry.tenantId
    );
  } catch (err) {
    console.warn("[Audit] Persist failed:", err.message);
  }

  // Emit structured log line too
  logger.info("audit", entry);
}

/**
 * Query recent audit events (newest first).
 */
export function query({ limit = 100, userId, action, resourceType, since } = {}) {
  ensureSchema();
  try {
    const filters = [];
    const params = [];
    if (userId) { filters.push("user_id = ?"); params.push(userId); }
    if (action) { filters.push("action = ?"); params.push(action); }
    if (resourceType) { filters.push("resource_type = ?"); params.push(resourceType); }
    if (since) { filters.push("ts >= ?"); params.push(since); }
    const where = filters.length ? "WHERE " + filters.join(" AND ") : "";
    const rows = db
      .prepare(`SELECT * FROM audit_events ${where} ORDER BY ts DESC LIMIT ?`)
      .all(...params, limit);
    return rows.map((r) => ({
      id: r.id,
      ts: typeof r.ts === "string" ? r.ts : new Date(r.ts).toISOString(),
      userId: r.user_id,
      userEmail: r.user_email,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      ip: r.ip,
      traceId: r.trace_id,
      status: r.status,
      metadata: r.metadata ? safeParse(r.metadata) : null,
      tenantId: r.tenant_id,
    }));
  } catch (err) {
    // Fallback to ring buffer
    return ringBuffer
      .filter(Boolean)
      .filter((e) => !userId || e.userId === userId)
      .filter((e) => !action || e.action === action)
      .filter((e) => !resourceType || e.resourceType === resourceType)
      .slice(-limit)
      .reverse();
  }
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return str; }
}

export function getStatus() {
  return {
    bufferSize: RING_SIZE,
    buffered: ringBuffer.filter(Boolean).length,
    schemaReady: ensuredSchema,
  };
}

export default { record, query, getStatus };