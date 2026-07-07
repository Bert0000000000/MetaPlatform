/**
 * /api/analytics — Unified analytics & data-stack endpoints (Phase 4)
 *
 *   GET  /api/analytics/status                 — ClickHouse + CDC + quality status
 *
 *   ── ClickHouse (OLAP) ──
 *   GET    /api/analytics/clickhouse/tables
 *   POST   /api/analytics/clickhouse/query
 *   POST   /api/analytics/clickhouse/insert
 *   POST   /api/analytics/clickhouse/create-table
 *
 *   ── NL2SQL ──
 *   POST   /api/analytics/nl2sql              — natural-language question -> safe SQL
 *
 *   ── CDC ──
 *   GET    /api/analytics/cdc/status
 *   POST   /api/analytics/cdc/poll            — single poll (manual)
 *   POST   /api/analytics/cdc/start
 *   POST   /api/analytics/cdc/stop
 *   POST   /api/analytics/cdc/reset
 *
 *   ── Quality Engine ──
 *   POST   /api/analytics/quality/score       — score sample against rules
 *   POST   /api/analytics/quality/infer-rules  — auto-infer rules from sample
 *   GET    /api/analytics/quality/rule-types
 *
 *   ── Simulator ──
 *   POST   /api/analytics/simulate            — Monte Carlo discrete-event sim
 */
import { Router } from "express";
import db from "../db.js";
import * as clickhouse from "../integrations/clickhouse.js";
import * as nl2sql from "../ai/nl2sql.js";
import * as quality from "../ai/quality.js";
import * as simulator from "../ai/simulator.js";
import cdc from "../cdc.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Health & status
// ════════════════════════════════════════════════════════
router.get("/status", async (_req, res, next) => {
  try {
    const [ch, cdcStatus] = await Promise.all([
      clickhouse.healthCheck(),
      Promise.resolve(cdc.getStatus()),
    ]);
    res.json({ success: true, data: { clickhouse: ch, cdc: cdcStatus } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════
//  ClickHouse
// ════════════════════════════════════════════════════════
router.get("/clickhouse/tables", async (_req, res, next) => {
  try {
    const data = await clickhouse.listTables();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/clickhouse/query", async (req, res, next) => {
  try {
    const { sql, params } = req.body;
    if (typeof sql !== "string") return res.status(400).json({ success: false, error: "sql 必填" });
    const data = await clickhouse.query(sql, params || {});
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/clickhouse/insert", async (req, res, next) => {
  try {
    const { table, rows } = req.body;
    if (!table || !Array.isArray(rows)) return res.status(400).json({ success: false, error: "table/rows 必填" });
    const data = await clickhouse.insert(table, rows);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/clickhouse/create-table", async (req, res, next) => {
  try {
    const { table, columns, engine, orderBy } = req.body;
    if (!table || !Array.isArray(columns)) return res.status(400).json({ success: false, error: "table/columns 必填" });
    const data = await clickhouse.createTable(table, columns, engine, orderBy);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post("/clickhouse/truncate", async (req, res, next) => {
  try {
    const { table } = req.body;
    if (!table) return res.status(400).json({ success: false, error: "table 必填" });
    const data = await clickhouse.truncate(table);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════
//  NL2SQL
// ════════════════════════════════════════════════════════
router.post("/nl2sql", async (req, res, next) => {
  try {
    const { question, tables, maxRows } = req.body;
    const data = await nl2sql.ask({ question, tables, maxRows });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════
//  CDC
// ════════════════════════════════════════════════════════
router.get("/cdc/status", (_req, res) => {
  res.json({ success: true, data: cdc.getStatus() });
});

router.post("/cdc/poll", async (_req, res, next) => {
  try {
    const emitted = await cdc.pollOnce();
    res.json({ success: true, data: { emitted } });
  } catch (err) { next(err); }
});

router.post("/cdc/start", (_req, res) => {
  cdc.start();
  res.json({ success: true, data: { running: true } });
});

router.post("/cdc/stop", (_req, res) => {
  cdc.stop();
  res.json({ success: true, data: { running: false } });
});

router.post("/cdc/reset", (_req, res) => {
  cdc.reset();
  res.json({ success: true, data: { reset: true } });
});

// ════════════════════════════════════════════════════════
//  Quality
// ════════════════════════════════════════════════════════
router.post("/quality/score", (req, res) => {
  try {
    const { sample, rules } = req.body;
    const data = quality.scoreQuality(sample || [], rules || []);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/quality/infer-rules", (req, res) => {
  try {
    const { sample } = req.body;
    const data = quality.inferRules(sample || []);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get("/quality/rule-types", (_req, res) => {
  res.json({ success: true, data: quality.listRuleTypes() });
});

// ════════════════════════════════════════════════════════
//  Simulator
// ════════════════════════════════════════════════════════
router.post("/simulate", async (req, res, next) => {
  try {
    const data = await simulator.simulate(req.body || {});
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /strategic ── F1.1.2 strategic dashboard metrics ──────
//
// Aggregates fleet-wide health so the leader dashboard can show
// real numbers instead of placeholder cards. Falls back to zeros
// if any aggregation table is missing — these are best-effort.
router.get("/strategic", async (_req, res, next) => {
  try {
    // Synchronous count helper — better-sqlite3 is sync, so wrapping with
    // `await` returned a non-Promise and caused try/catch to swallow errors
    // silently, leaving us with all-zero metrics even when tables had rows.
    const safeCount = (sql, params = []) => {
      try { return db.prepare(sql).get(...params)?.c ?? 0; }
      catch { return 0; }
    };

    // ── Known tables (introspect at runtime) ──
    const knownTables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    );

    const countFrom = (table, where = "") =>
      knownTables.has(table) ? safeCount(`SELECT COUNT(*) AS c FROM ${table}${where ? " WHERE " + where : ""}`) : 0;

    const totalUsers    = countFrom("users");
    const activeUsers   = countFrom("users", "status = 'active'");
    const totalApps     = countFrom("applications");
    const publishedApps = countFrom("applications", "status = 'published'");
    const draftApps     = countFrom("applications", "status = 'draft'");
    const totalObjects  = countFrom("ontology_objects");
    const totalPages    = countFrom("app_pages");
    const totalFlows    = countFrom("process_definitions");
    const totalAgents   = countFrom("agents");
    const activeAgents  = countFrom("agents", "status = 'active'");
    const totalMessages = countFrom("messages");
    const unreadMessages = countFrom("messages", "read_at IS NULL");
    const totalLogs     = countFrom("operation_logs");

    // Adoption = published apps / total apps (skip division if 0)
    const adoptionRate    = totalApps   > 0 ? Math.round((publishedApps / totalApps)   * 100) : 0;
    const agentOnlineRate = totalAgents > 0 ? Math.round((activeAgents  / totalAgents) * 100) : 0;

    res.json({
      success: true,
      data: {
        // 人 — users
        users: { total: totalUsers, active: activeUsers },
        // 应用 — apps
        apps: { total: totalApps, published: publishedApps, draft: draftApps, adoptionRate },
        // 内容 — ontology / pages / flows
        content: {
          objects: totalObjects, pages: totalPages, flows: totalFlows,
          objects_per_app: totalApps > 0 ? Math.round(totalObjects / totalApps) : 0,
        },
        // 数字员工 — agents
        agents: { total: totalAgents, active: activeAgents, onlineRate: agentOnlineRate },
        // 协作 — messages + audit
        collaboration: { messages: totalMessages, unread: unreadMessages, audit_logs: totalLogs },
        // 表覆盖（前端可提示"缺哪张表"）
        coverage: {
          users: knownTables.has("users"),
          applications: knownTables.has("applications"),
          ontology_objects: knownTables.has("ontology_objects"),
          app_pages: knownTables.has("app_pages"),
          process_definitions: knownTables.has("process_definitions"),
          agents: knownTables.has("agents"),
          messages: knownTables.has("messages"),
          operation_logs: knownTables.has("operation_logs"),
        },
        as_of: new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
});

export default router;