/**
 * ClickHouse OLAP Integration (ESM) — real implementation
 *
 * Phase 4: Data stack — column-oriented analytics database.
 */

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://localhost:8124";
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "meta";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || "metaplatform2026";
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "metaplatform";

let client = null;
let CH = null;
let connected = false;

export function isConfigured() {
  return Boolean(CLICKHOUSE_URL);
}

function stub(methodName) {
  return (...args) => {
    console.warn(`[ClickHouse] ${methodName}: Service not configured. Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

export async function connect() {
  if (!isConfigured()) {
    console.warn("[ClickHouse] connect: Service not configured");
    return null;
  }
  if (client && connected) return client;

  try {
    if (!CH) {
      try {
        const mod = await import("@clickhouse/client");
        CH = mod.createClient;
      } catch (e) {
        console.error("[ClickHouse] @clickhouse/client not installed");
        return null;
      }
    }

    client = CH({
      url: CLICKHOUSE_URL,
      username: CLICKHOUSE_USER,
      password: CLICKHOUSE_PASSWORD,
      database: CLICKHOUSE_DATABASE,
      request_timeout: 30000,
    });

    const ping = await client.ping();
    if (!ping.success) throw new Error("Ping failed");

    await client.command({
      query: `CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}`,
    });

    connected = true;
    console.log(`[ClickHouse] Connected to ${CLICKHOUSE_URL} (db=${CLICKHOUSE_DATABASE})`);
    return client;
  } catch (err) {
    console.error("[ClickHouse] Connection failed:", err.message);
    client = null;
    connected = false;
    return null;
  }
}

export async function createTable(table, columns, engine = "MergeTree", orderBy = "tuple()") {
  if (!isConfigured()) return stub("createTable")(table, columns);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const cols = columns
      .map((c) => `${c.name} ${c.type}${c.default ? ` DEFAULT ${c.default}` : ""}`)
      .join(", ");
    // CH requires:
    //   - tuple literal like `tuple()` or `(a, b)` for multi-key ORDER BY
    //   - bare identifier for single-key (e.g. `ORDER BY id`)
    let orderClause = "";
    if (orderBy && orderBy !== "tuple()") {
      // If it looks like a comma-separated list, wrap in parens; otherwise bare
      if (orderBy.includes(",")) {
        orderClause = `ORDER BY (${orderBy})`;
      } else {
        orderClause = `ORDER BY ${orderBy}`;
      }
    }
    const query = `CREATE TABLE IF NOT EXISTS ${table} (${cols}) ENGINE = ${engine} ${orderClause}`;
    await client.command({ query });
    return { table, created: true };
  } catch (err) {
    console.error("[ClickHouse] createTable error:", err.message);
    throw err;
  }
}

export async function insert(table, rows) {
  if (!isConfigured()) return stub("insert")(table, rows);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0 };
  try {
    await client.insert({
      table,
      values: rows,
      format: "JSONEachRow",
    });
    return { inserted: rows.length, table };
  } catch (err) {
    console.error("[ClickHouse] insert error:", err.message);
    throw err;
  }
}

export async function query(sql, params = {}) {
  if (!isConfigured()) return stub("query")(sql, params);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const resultSet = await client.query({
      query: sql,
      query_params: params,
      format: "JSONEachRow",
    });
    const rows = await resultSet.json();
    return { rows, count: rows.length };
  } catch (err) {
    console.error("[ClickHouse] query error:", err.message);
    throw err;
  }
}

export async function aggregate(table, metric = "count", column = "*", where = "1=1") {
  const fn = metric.toLowerCase();
  if (fn === "count") {
    return query(`SELECT count() AS value FROM ${table} WHERE ${where}`);
  }
  return query(`SELECT ${fn}(${column}) AS value FROM ${table} WHERE ${where}`);
}

export async function timeSeries(table, timeColumn, bucket = "1h", metric = "count", column = "*", where = "1=1") {
  const fn = metric.toLowerCase();
  const expr = fn === "count" ? "count() AS value" : `${fn}(${column}) AS value`;
  return query(`
    SELECT
      toStartOfInterval(${timeColumn}, INTERVAL ${bucket}) AS bucket,
      ${expr}
    FROM ${table}
    WHERE ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
}

export async function truncate(table) {
  if (!isConfigured()) return stub("truncate")(table);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  await client.command({ query: `TRUNCATE TABLE IF EXISTS ${table}` });
  return { truncated: true, table };
}

export async function listTables() {
  if (!isConfigured()) return stub("listTables")();
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const resultSet = await client.query({
      query: `SELECT name, engine, total_rows FROM system.tables WHERE database = currentDatabase()`,
      format: "JSONEachRow",
    });
    return await resultSet.json();
  } catch (err) {
    console.error("[ClickHouse] listTables error:", err.message);
    throw err;
  }
}

export async function healthCheck() {
  if (!isConfigured()) return { status: "disabled" };
  return Promise.race([
    _chHealthInner(),
    new Promise((resolve) =>
      setTimeout(() => resolve({ status: "timeout", after: "5s" }), 5000)
    ),
  ]);
}

async function _chHealthInner() {
  try {
    if (!client) await connect();
    if (!client) return { status: "unreachable" };
    const ping = await client.ping();
    return {
      status: ping.success ? "connected" : "unhealthy",
      url: CLICKHOUSE_URL,
      database: CLICKHOUSE_DATABASE,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

export default {
  isConfigured,
  connect,
  createTable,
  insert,
  query,
  aggregate,
  timeSeries,
  truncate,
  listTables,
  healthCheck,
};