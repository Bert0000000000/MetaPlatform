/**
 * /api/agents — Digital employee / agent routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Agents
// ════════════════════════════════════════════════════════

// GET / — list agents
// Filters:
//   owner=<userId>   → only agents owned by <userId>  (F1.3.1 我创建的)
router.get("/", async (req, res, next) => {
  try {
    const owner = req.query.owner;
    let rows;
    if (owner) {
      rows = await db
        .prepare("SELECT * FROM agents WHERE owner_id = ? ORDER BY created_at DESC")
        .all(owner);
    } else {
      rows = await db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /:id — single agent
router.get("/:id", async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "智能体不存在" });
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// POST / — create agent
router.post("/", async (req, res, next) => {
  try {
    const { name, description, type, model, skills, config } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO agents (id, name, description, type, status, model, skills, config, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      description || "",
      type || "builtin",
      model || null,
      skills ? (Array.isArray(skills) ? JSON.stringify(skills) : skills) : null,
      config ? (typeof config === "object" ? JSON.stringify(config) : config) : null,
      req.user?.id || null,
      now,
      now
    );
    const row = await db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update agent
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "智能体不存在" });

    const { name, description, type, status, model, skills, config } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE agents SET name = ?, description = ?, type = ?, status = ?, model = ?, skills = ?, config = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      description ?? existing.description,
      type ?? existing.type,
      status ?? existing.status,
      model ?? existing.model,
      skills !== undefined ? (Array.isArray(skills) ? JSON.stringify(skills) : skills) : existing.skills,
      config !== undefined ? (typeof config === "object" ? JSON.stringify(config) : config) : existing.config,
      now,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete agent (cascade tasks)
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "智能体不存在" });
    await db.prepare("DELETE FROM agent_tasks WHERE agent_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM agents WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Agent Tasks
// ════════════════════════════════════════════════════════

// GET /:id/tasks — list tasks for agent
router.get("/:id/tasks", async (req, res, next) => {
  try {
    const agent = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!agent) return res.status(404).json({ success: false, error: "智能体不存在" });
    const rows = await db.prepare("SELECT * FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC").all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /:id/tasks — create task
router.post("/:id/tasks", async (req, res, next) => {
  try {
    const agent = await db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!agent) return res.status(404).json({ success: false, error: "智能体不存在" });

    const { title, input } = req.body;
    if (!title) return res.status(400).json({ success: false, error: "title 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO agent_tasks (id, agent_id, title, status, input, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).run(id, req.params.id, title, input ? (typeof input === "object" ? JSON.stringify(input) : input) : null, now);
    const row = await db.prepare("SELECT * FROM agent_tasks WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id — update task status
router.put("/tasks/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM agent_tasks WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "任务不存在" });

    const { status, output } = req.body;
    const now = new Date().toISOString();
    const endedStatuses = ["completed", "failed", "cancelled"];
    const startedAt = existing.started_at || (status === "running" ? now : existing.started_at);
    const endedAt = endedStatuses.includes(status) ? now : existing.ended_at;

    await db.prepare(
      `UPDATE agent_tasks SET status = ?, output = ?, started_at = ?, ended_at = ? WHERE id = ?`
    ).run(
      status ?? existing.status,
      output !== undefined ? (typeof output === "object" ? JSON.stringify(output) : output) : existing.output,
      startedAt,
      endedAt,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM agent_tasks WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

export default router;
