/**
 * PostgreSQL worker thread
 * Runs in a separate thread with its own event loop, processing queries
 * sent from the main thread and writing results to a SharedArrayBuffer.
 *
 * Protocol:
 *   Main thread sends: { action, sab, sql?, params?, connStr? }
 *   Worker writes to sab:
 *     [0..3]  Int32   status: 0=pending, 1=ok, 2=error
 *     [4..7]  Uint32  result JSON byte length
 *     [8..]   bytes   UTF-8 JSON result
 *   Worker calls Atomics.notify(sab) to wake main thread.
 */
import { parentPort } from "worker_threads";
import pg from "pg";

const { Pool } = pg;

let pool = null;
let txClient = null; // active transaction client (null when not in tx)

// ── Statement splitter (quote-aware) ───────────────────────
function splitStatements(sql) {
  const stmts = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      if (inSingle && i + 1 < sql.length && sql[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      cur += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      cur += ch;
    } else if (ch === ";" && !inSingle && !inDouble) {
      const trimmed = cur.trim();
      if (trimmed) stmts.push(trimmed);
      cur = "";
    } else {
      cur += ch;
    }
  }
  const trimmed = cur.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

// ── Write result to SharedArrayBuffer and notify ───────────
function respond(sab, result) {
  const i32 = new Int32Array(sab);
  const view = new DataView(sab);
  const json = JSON.stringify(result);
  const bytes = new TextEncoder().encode(json);
  view.setUint32(4, bytes.length);
  new Uint8Array(sab, 8, bytes.length).set(bytes);
  Atomics.store(i32, 0, result.ok !== false ? 1 : 2);
  Atomics.notify(i32, 0);
}

// ── Message handler ────────────────────────────────────────
parentPort.on("message", async (msg) => {
  const { action, sab, sql, params, connStr } = msg;
  try {
    switch (action) {
      case "init": {
        pool = new Pool({ connectionString: connStr });
        const c = await pool.connect();
        c.release();
        respond(sab, { ok: true });
        break;
      }

      case "query": {
        const client = txClient || pool;
        const r = await client.query(sql, params || []);
        respond(sab, { ok: true, rows: r.rows, rowCount: r.rowCount });
        break;
      }

      case "exec": {
        const client = txClient || pool;
        const stmts = splitStatements(sql);
        for (const stmt of stmts) {
          await client.query(stmt);
        }
        respond(sab, { ok: true });
        break;
      }

      case "begin": {
        txClient = await pool.connect();
        await txClient.query("BEGIN");
        respond(sab, { ok: true });
        break;
      }

      case "commit": {
        if (txClient) {
          await txClient.query("COMMIT");
          txClient.release();
          txClient = null;
        }
        respond(sab, { ok: true });
        break;
      }

      case "rollback": {
        if (txClient) {
          try { await txClient.query("ROLLBACK"); } catch {}
          txClient.release();
          txClient = null;
        }
        respond(sab, { ok: true });
        break;
      }

      case "close": {
        if (txClient) {
          try { await txClient.query("ROLLBACK"); } catch {}
          txClient.release();
          txClient = null;
        }
        if (pool) {
          await pool.end();
          pool = null;
        }
        respond(sab, { ok: true });
        break;
      }

      default:
        respond(sab, { ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    respond(sab, { ok: false, error: err.message, stack: err.stack });
  }
});
