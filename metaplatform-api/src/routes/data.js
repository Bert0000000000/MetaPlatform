/**
 * /api/data — Data source & metrics routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Data Sources
// ════════════════════════════════════════════════════════

// GET /sources — list data sources
router.get("/sources", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM data_sources ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /sources — create data source
router.post("/sources", (req, res, next) => {
  try {
    const { name, type, host, port, database_name, username, password_encrypted, description } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, error: "name, type 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO data_sources (id, name, type, host, port, database_name, username, password_encrypted, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?)`
    ).run(id, name, type, host || null, port || null, database_name || null, username || null, password_encrypted || null, description || "", now, now);
    const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /sources/:id — update data source
router.put("/sources/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });

    const { name, type, host, port, database_name, username, password_encrypted, status, description } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE data_sources SET name = ?, type = ?, host = ?, port = ?, database_name = ?, username = ?, password_encrypted = ?, status = ?, description = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      host ?? existing.host,
      port ?? existing.port,
      database_name ?? existing.database_name,
      username ?? existing.username,
      password_encrypted ?? existing.password_encrypted,
      status ?? existing.status,
      description ?? existing.description,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /sources/:id — delete data source
router.delete("/sources/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });
    db.prepare("DELETE FROM data_sources WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// GET /sources/:id/test — test connection (mock)
router.get("/sources/:id/test", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据源不存在" });
    // Mock: always return success with latency
    res.json({
      success: true,
      data: {
        connected: true,
        latency_ms: Math.floor(Math.random() * 50) + 5,
        message: "连接测试成功",
      },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Metrics
// ════════════════════════════════════════════════════════

// Note: Metrics table doesn't exist in schema yet, use a simple in-memory approach
// or create metrics table dynamically. For now, we'll use system_config as a store.

// GET /metrics — list metrics
router.get("/metrics", (_req, res, next) => {
  try {
    // Return mock metrics based on real data
    const appCount = db.prepare("SELECT COUNT(*) AS cnt FROM applications").get().cnt;
    const objectCount = db.prepare("SELECT COUNT(*) AS cnt FROM ontology_objects").get().cnt;
    const processCount = db.prepare("SELECT COUNT(*) AS cnt FROM process_definitions").get().cnt;
    const docCount = db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_documents").get().cnt;
    const agentCount = db.prepare("SELECT COUNT(*) AS cnt FROM agents").get().cnt;
    const userCount = db.prepare("SELECT COUNT(*) AS cnt FROM users").get().cnt;

    res.json({
      success: true,
      data: [
        { name: "应用总数", value: appCount, type: "count" },
        { name: "对象总数", value: objectCount, type: "count" },
        { name: "流程定义", value: processCount, type: "count" },
        { name: "知识文档", value: docCount, type: "count" },
        { name: "智能体", value: agentCount, type: "count" },
        { name: "用户数", value: userCount, type: "count" },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// POST /metrics — create metric (store in system_config)
router.post("/metrics", (req, res, next) => {
  try {
    const { name, value, type, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const key = `metric_${name}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)`
    ).run(key, JSON.stringify({ value, type: type || "custom" }), description || "", now);
    res.status(201).json({ success: true, data: { name, value, type: type || "custom" } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  AI Query (NL2SQL simulation)
// ════════════════════════════════════════════════════════

// POST /ask — natural language query
router.post("/ask", (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, error: "question 为必填项" });
    // Simple NL2SQL simulation - returns mock SQL and results
    // In production, this would use LLM to generate SQL
    const sql = `SELECT * FROM data_sources WHERE status = 'online'`;
    const results = db.prepare(sql).all();
    res.json({ success: true, data: { sql, results, question } });
  } catch (err) {
    next(err);
  }
});

// POST /export — export data
router.post("/export", (req, res, next) => {
  try {
    const { format, data } = req.body;
    res.json({ success: true, data: { format, message: `Export to ${format} initiated` } });
  } catch (err) {
    next(err);
  }
});

export default router;
