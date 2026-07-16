/**
 * CDC (Change Data Capture) Service (Phase 4 — Data Stack)
 *
 * Captures row-level changes from the platform's PostgreSQL tables and
 * publishes them to Kafka topics for downstream consumers (ClickHouse,
 * search indexers, audit logs, etc.).
 *
 * Strategy:
 *   - Polling-based using a high-water-mark approach: each poll records
 *     the latest row id per tracked table, subsequent polls emit only
 *     rows with id > watermark (or updated_at > watermark).
 *   - Event format: { op: "INSERT"|"UPDATE"|"DELETE", table, ts, before, after }
 *
 * For production at scale, replace with Debezium + Kafka Connect.
 * For the MVP / single-node deployment this lightweight poller is
 * sufficient and zero-ops.
 */

import db from "./db.js";
import { kafka } from "./integrations/index.js";

const TRACKED_TABLES = (process.env.CDC_TABLES ||
  "ontology_objects,knowledge_documents,process_instances,messages,todos")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const POLL_INTERVAL_MS = parseInt(process.env.CDC_POLL_INTERVAL_MS || "5000", 10);
const TOPIC_PREFIX = process.env.CDC_TOPIC_PREFIX || "metaplatform.cdc";
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || "default";

// Per-table state
const state = new Map(); // table -> { watermark: number, lastPoll: number }
for (const t of TRACKED_TABLES) {
  state.set(t, { watermark: 0, lastPoll: 0 });
}

let intervalHandle = null;
let running = false;
let totalEmitted = 0;

/**
 * Determine the high-water-mark column for a table.
 * Prefers `id` (assumed auto-incrementing integer); falls back to `rowid` or `updated_at`.
 */
function watermarkColumn(table) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const names = new Set(cols.map((c) => c.name.toLowerCase()));
    if (names.has("id")) return "id";
    if (names.has("rowid")) return "rowid";
    if (names.has("updated_at")) return "updated_at";
  } catch {}
  return "id";
}

/**
 * Poll one table for new/changed rows and emit CDC events.
 */
async function pollTable(table) {
  const st = state.get(table);
  const wm = watermarkColumn(table);
  let rows = [];
  try {
    rows = db
      .prepare(`SELECT * FROM ${table} WHERE ${wm} > ? ORDER BY ${wm} ASC LIMIT 500`)
      .all(st.watermark);
  } catch (err) {
    // Table missing or has no watermark column
    return 0;
  }

  let emitted = 0;
  for (const row of rows) {
    const wmValue = row[wm];
    if (typeof wmValue === "number" && wmValue > st.watermark) {
      st.watermark = wmValue;
    }

    const event = {
      op: "UPSERT",
      table,
      schema: "public",
      ts: new Date().toISOString(),
      tenant: row.tenant_id || DEFAULT_TENANT,
      before: null,
      after: row,
    };

    try {
      await kafka.publish(`${TOPIC_PREFIX}.${table}`, {
        key: String(row.id || wmValue),
        value: event,
      });
      emitted++;
    } catch (err) {
      console.warn(`[CDC] Failed to publish for ${table}: ${err.message}`);
    }
  }

  st.lastPoll = Date.now();
  return emitted;
}

/**
 * Poll all tracked tables. Returns total events emitted.
 */
export async function pollOnce() {
  let total = 0;
  for (const t of TRACKED_TABLES) {
    try {
      total += await pollTable(t);
    } catch (err) {
      console.warn(`[CDC] poll error for ${t}: ${err.message}`);
    }
  }
  totalEmitted += total;
  return total;
}

/**
 * Start the CDC polling loop.
 */
export function start() {
  if (running) return;
  running = true;
  console.log(`[CDC] Starting — tables=${TRACKED_TABLES.join(",")} interval=${POLL_INTERVAL_MS}ms`);

  // Run immediately, then on interval
  pollOnce().catch(() => {});
  intervalHandle = setInterval(() => {
    pollOnce().catch((err) => console.warn("[CDC] poll error:", err.message));
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the CDC polling loop.
 */
export function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  running = false;
  console.log("[CDC] Stopped");
}

/**
 * Get CDC status and stats.
 */
export function getStatus() {
  return {
    running,
    trackedTables: TRACKED_TABLES,
    pollIntervalMs: POLL_INTERVAL_MS,
    topicPrefix: TOPIC_PREFIX,
    watermarks: Object.fromEntries(state),
    totalEmitted,
  };
}

/**
 * Reset all watermarks (replay from scratch on next poll).
 */
export function reset() {
  for (const t of TRACKED_TABLES) {
    state.set(t, { watermark: 0, lastPoll: 0 });
  }
  totalEmitted = 0;
}

export default { start, stop, pollOnce, getStatus, reset };