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
let _db;

if (process.env.DATABASE_URL) {
  // ── PostgreSQL mode ────────────────────────────────────
  console.log("[db-adapter] Using PostgreSQL:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"));
  const { initDB } = await import("./db-pg.js");
  _db = await initDB();
} else {
  // ── SQLite mode (backward compatible) ─────────────────
  console.log("[db-adapter] Using SQLite (better-sqlite3)");
  const { default: sqliteDb } = await import("./db-sqlite.js");
  _db = sqliteDb;
}

export default _db;