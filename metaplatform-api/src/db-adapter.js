/**
 * Database adapter — selects SQLite or PostgreSQL based on DATABASE_URL.
 *
 * When DATABASE_URL is set   -> PostgreSQL via worker thread (SYNCHRONOUS API, Atomics.wait)
 * When DATABASE_URL is unset -> SQLite via better-sqlite3 (sync, backward compatible)
 *
 * Both modes expose the SAME synchronous interface:
 *   db.prepare(sql).get(params)   -> row | undefined
 *   db.prepare(sql).all(params)   -> row[]
 *   db.prepare(sql).run(params)   -> { changes, lastInsertRowid }
 *   db.exec(sql)
 *   db.transaction(fn)            -> function (sync)
 *   db.pragma()
 *   db.close()
 *
 * No route file changes required.
 */
import { initDB as initPg } from "./db-pg.js";

// Top-level await is supported in ESM (package.json "type": "module")

let _db;

if (process.env.DATABASE_URL) {
  // ── PostgreSQL mode ────────────────────────────────────
  console.log("[db-adapter] Using PostgreSQL:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  _db = await initPg();
} else {
  // ── SQLite mode (backward compatible) ─────────────────
  // Re-export the synchronous better-sqlite3 instance unchanged.
  // This keeps all existing code working exactly as before.
  const { default: sqliteDb } = await import("./db-sqlite.js");
  _db = sqliteDb;
}

export default _db;
