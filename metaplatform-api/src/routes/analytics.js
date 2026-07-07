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

export default router;