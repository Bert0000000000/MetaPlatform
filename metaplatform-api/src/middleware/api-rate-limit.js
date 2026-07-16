/**
 * F4.6.14 Per-API-key rate limiting
 *
 * Token-bucket algorithm implemented in-process (Map keyed on apiKey.id).
 * Why in-memory:
 *   • We already have express-rate-limit doing IP-based throttling on top;
 *     per-key is a second layer that benefits from a smaller scope.
 *   • Multi-instance deployments would need Redis. For now the platform is
 *     single-node and the limits apply per-pod, which is what admins
 *     actually want when isolating a noisy tenant.
 *
 * Behaviour:
 *   • If req.apiKey is missing → next() (let the JWT path through).
 *   • If req.apiKey.rate_limit is null/0 → next() (key has no limit).
 *   • Otherwise:
 *       bucket.refill() every minute adds `rate_limit` tokens (cap)
 *       each request takes one token
 *       if bucket empty → 429 with Retry-After + X-RateLimit-* headers
 *
 * Headers we emit (X-RateLimit-* prefix) so clients can self-throttle:
 *   X-RateLimit-Limit      max requests per minute
 *   X-RateLimit-Remaining  tokens left in current window
 *   X-RateLimit-Reset      seconds until the bucket refills
 *
 * Statistics for F4.6.16 (API 调用统计) get a free bump: every accepted
 * request gets a row in api_key_calls so the future 'last 24h counts per
 * key' dashboard has data already.
 */

import db from "../db-sqlite.js";

const WINDOW_MS = 60_000; // 1 minute

class Bucket {
  constructor(limit) {
    this.limit = limit;
    this.tokens = limit;          // start full
    this.lastRefill = Date.now();
  }
  refill(now) {
    const elapsed = now - this.lastRefill;
    if (elapsed >= WINDOW_MS) {
      // full refill after a window has elapsed
      this.tokens = this.limit;
      this.lastRefill = now;
    }
  }
  take(now) {
    this.refill(now);
    if (this.tokens > 0) {
      this.tokens -= 1;
      return { allowed: true, remaining: this.tokens };
    }
    const resetSec = Math.max(1, Math.ceil((this.lastRefill + WINDOW_MS - now) / 1000));
    return { allowed: false, remaining: 0, resetSec };
  }
}

// Module-level cache: id → Bucket. We don't bother evicting revoked keys
// because they show up once during the request that does the revoke and
// then the next call fails on the apiKeyMiddleware revoked check before
// reaching us. Memory cost is bounded by # of issued keys.
const buckets = new Map();

function getBucket(key) {
  let b = buckets.get(key.id);
  // Bust cache if the limit changed (admin re-tuned it)
  if (!b || b.limit !== key.rate_limit) {
    b = new Bucket(key.rate_limit || 0);
    buckets.set(key.id, b);
  }
  return b;
}

// Lightweight ring buffer so we don't grow unbounded between dashboard
// queries (kept here as a stub so F4.6.16 can plug in the real table
// without changing the call sites).
let inMemCallLog = [];
const CALL_LOG_CAP = 5_000;
function pushCallLog(row) {
  inMemCallLog.push(row);
  if (inMemCallLog.length > CALL_LOG_CAP) inMemCallLog.shift();
}

export function apiKeyRateLimit() {
  return (req, res, next) => {
    const key = req.apiKey;
    if (!key) return next();           // not an API-key request
    const limit = Number(key.rate_limit);
    if (!limit || limit <= 0) return next();   // unlimited key

    const bucket = getBucket({ id: key.id, rate_limit: limit });
    const now = Date.now();
    const decision = bucket.take(now);

    // Always emit informational headers
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      String(decision.resetSec ?? Math.ceil((bucket.lastRefill + WINDOW_MS - now) / 1000)),
    );

    if (!decision.allowed) {
      res.setHeader("Retry-After", String(decision.resetSec));
      // Record the rejected call too — it's still a call
      const url = req.originalUrl || req.url || "";
      const qIdx = url.indexOf("?");
      const fullPath = qIdx === -1 ? url : url.slice(0, qIdx);
      pushCallLog({ key_id: key.id, ts: now, path: fullPath, method: req.method, status: 429 });
      return res.status(429).json({
        success: false,
        error: `API key ${key.name} (${key.key_prefix}) rate limit exceeded (${limit}/min)`,
        retryAfter: decision.resetSec,
      });
    }

    // Defer the success log to res.finish so we capture the actual status
    res.on("finish", () => {
      // req.originalUrl preserves the full mount path (e.g. /api/apps?…),
      // while req.path gives only the router-internal path. Use originalUrl
      // without the query string so the api_key_calls dashboard aggregates
      // by endpoint instead of by every unique query string.
      const url = req.originalUrl || req.url || "";
      const qIdx = url.indexOf("?");
      const fullPath = qIdx === -1 ? url : url.slice(0, qIdx);
      pushCallLog({ key_id: key.id, ts: now, path: fullPath, method: req.method, status: res.statusCode });
    });
    next();
  };
}

/** F4.6.16 stub: read recent per-key call counts from the in-memory ring. */
export function getRecentCallStats({ keyId = null, since = 0 } = {}) {
  return inMemCallLog.filter(
    (r) => (!keyId || r.key_id === keyId) && r.ts >= since,
  );
}

/** Persist a snapshot to SQLite for F4.6.16 dashboard; idempotent. */
export function flushCallLogToDb() {
  if (inMemCallLog.length === 0) return 0;
  // Ensure table exists (idempotent)
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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_calls_kid  ON api_key_calls(key_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_calls_ts   ON api_key_calls(ts)`);

  const insert = db.prepare(
    "INSERT INTO api_key_calls (key_id, ts, path, method, status) VALUES (?, ?, ?, ?, ?)",
  );
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(r.key_id, r.ts, r.path, r.method, r.status);
  });
  tx(inMemCallLog);
  const n = inMemCallLog.length;
  inMemCallLog = [];
  return n;
}