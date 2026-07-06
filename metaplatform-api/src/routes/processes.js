/**
 * /api/processes — Process definition & instance routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Process Definitions
// ════════════════════════════════════════════════════════

// GET / — list definitions
router.get("/", (req, res, next) => {
  try {
    const { type, app_id } = req.query;
    let sql = "SELECT * FROM process_definitions WHERE 1=1";
    const params = [];
    if (type) { sql += " AND type = ?"; params.push(type); }
    if (app_id) { sql += " AND app_id = ?"; params.push(app_id); }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /instances — list instances (must be before /:id to avoid conflict)
router.get("/instances", (req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM process_instances ORDER BY started_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /:id — single definition
router.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "流程定义不存在" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// POST / — create definition
router.post("/", (req, res, next) => {
  try {
    const { name, type, app_id, description, bpmn_xml } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO process_definitions (id, app_id, name, type, status, version, bpmn_xml, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`
    ).run(id, app_id || null, name, type || "business", bpmn_xml || null, description || "", now, now);
    const row = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update definition
router.put("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "流程定义不存在" });

    const { name, type, status, description, bpmn_xml, app_id } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE process_definitions SET name = ?, type = ?, status = ?, description = ?, bpmn_xml = ?, app_id = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      status ?? existing.status,
      description ?? existing.description,
      bpmn_xml ?? existing.bpmn_xml,
      app_id ?? existing.app_id,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete definition
router.delete("/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "流程定义不存在" });
    db.prepare("DELETE FROM process_definitions WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Process Instances
// ════════════════════════════════════════════════════════

// POST /instances — start new instance
router.post("/instances", (req, res, next) => {
  try {
    const { definition_id, initiator_id, variables } = req.body;
    if (!definition_id) return res.status(400).json({ success: false, error: "definition_id 为必填项" });

    const def = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(definition_id);
    if (!def) return res.status(404).json({ success: false, error: "流程定义不存在" });

    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO process_instances (id, definition_id, status, initiator_id, variables, started_at)
       VALUES (?, ?, 'running', ?, ?, ?)`
    ).run(id, definition_id, initiator_id || req.user?.id || null, variables ? JSON.stringify(variables) : null, now);
    const row = db.prepare("SELECT * FROM process_instances WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /instances/:id — update instance status
router.put("/instances/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM process_instances WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "流程实例不存在" });

    const { status, variables } = req.body;
    const endedStatuses = ["approved", "rejected", "completed", "cancelled"];
    const now = new Date().toISOString();
    const endedAt = endedStatuses.includes(status) ? now : existing.ended_at;

    db.prepare(
      `UPDATE process_instances SET status = ?, variables = ?, ended_at = ? WHERE id = ?`
    ).run(
      status ?? existing.status,
      variables ? JSON.stringify(variables) : existing.variables,
      endedAt,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM process_instances WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// POST /instances/:id/intervene — process intervention
router.post("/instances/:id/intervene", (req, res, next) => {
  try {
    const instance = db.prepare("SELECT * FROM process_instances WHERE id = ?").get(req.params.id);
    if (!instance) return res.status(404).json({ success: false, error: "流程实例不存在" });

    const { action, reason } = req.body;
    if (!action) return res.status(400).json({ success: false, error: "action 为必填项" });

    let newStatus = instance.status;
    if (action === "suspend") newStatus = "suspended";
    else if (action === "resume") newStatus = "running";
    else if (action === "terminate") newStatus = "terminated";

    const now = new Date().toISOString();
    db.prepare("UPDATE process_instances SET status = ?, ended_at = ? WHERE id = ?")
      .run(newStatus, (action === "terminate") ? now : instance.ended_at, req.params.id);

    res.json({ success: true, data: { id: req.params.id, status: newStatus, action, reason } });
  } catch (err) {
    next(err);
  }
});

export default router;
