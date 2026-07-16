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

// GET /team-stats — F1.1.4 领导版：团队数字员工概览
// Aggregates by department (joining agents.owner_id → users.department).
// Falls back to "(未分配)" when the owner has no department on file.
//   ?limitTop=5   — number of top-performer rows to return (default 5)
//   ?limitAct=10  — number of recent-activity rows (default 10)
//
// IMPORTANT: declared BEFORE the /:id route to avoid being matched as
// id="team-stats" — Express matches in registration order.
router.get("/team-stats", async (req, res, next) => {
  try {
    const limitTop = Math.min(50, Math.max(1, Number(req.query.limitTop) || 5));
    const limitAct = Math.min(50, Math.max(1, Number(req.query.limitAct) || 10));

    // ── agents — left join users so we can group by department
    const agents = await db.prepare(`
      SELECT a.id, a.name, a.status, a.owner_id,
             COALESCE(u.department, '(未分配)') AS department,
             COALESCE(u.name, '(匿名)')         AS owner_name
      FROM agents a
      LEFT JOIN users u ON u.id = a.owner_id
    `).all();

    // ── agent_tasks — used for task volume + completion stats
    const tasks = await db.prepare(`
      SELECT agent_id, status FROM agent_tasks
    `).all();
    const tasksByAgent = new Map();
    for (const t of tasks) {
      const m = tasksByAgent.get(t.agent_id) ?? { total: 0, done: 0, error: 0, running: 0 };
      m.total++;
      if (t.status === "completed" || t.status === "done") m.done++;
      else if (t.status === "error" || t.status === "failed") m.error++;
      else if (t.status === "running") m.running++;
      tasksByAgent.set(t.agent_id, m);
    }

    // ── team rollup ──
    const teamMap = new Map();
    for (const a of agents) {
      const t = teamMap.get(a.department) ?? {
        department: a.department,
        agentCount: 0, activeCount: 0, busyCount: 0,
        offlineCount: 0, errorCount: 0,
        taskCount: 0, doneCount: 0,
      };
      t.agentCount++;
      if (a.status === "active" || a.status === "online") t.activeCount++;
      else if (a.status === "busy") t.busyCount++;
      else if (a.status === "offline") t.offlineCount++;
      else if (a.status === "error") t.errorCount++;
      const m = tasksByAgent.get(a.id);
      if (m) {
        t.taskCount += m.total;
        t.doneCount += m.done;
      }
      teamMap.set(a.department, t);
    }
    const teams = Array.from(teamMap.values()).sort(
      (a, b) => b.agentCount - a.agentCount,
    );

    // ── overview ──
    const overview = {
      totalAgents: agents.length,
      totalActive: teams.reduce((s, t) => s + t.activeCount, 0),
      totalBusy:   teams.reduce((s, t) => s + t.busyCount, 0),
      totalOffline: teams.reduce((s, t) => s + t.offlineCount, 0),
      totalError:  teams.reduce((s, t) => s + t.errorCount, 0),
      totalTasks:  tasks.length,
      totalDone:   tasks.filter((t) => t.status === "completed" || t.status === "done").length,
    };
    overview.completionRate = overview.totalTasks > 0
      ? Math.round((overview.totalDone / overview.totalTasks) * 1000) / 10
      : 0;

    // ── top performers (by done tasks) ──
    const topPerformers = agents
      .map((a) => {
        const m = tasksByAgent.get(a.id) ?? { total: 0, done: 0 };
        return {
          id: a.id,
          name: a.name,
          ownerName: a.owner_name,
          department: a.department,
          status: a.status,
          tasksDone: m.done,
          tasksTotal: m.total,
          successRate: m.total > 0
            ? Math.round((m.done / m.total) * 1000) / 10
            : 0,
        };
      })
      .filter((r) => r.tasksTotal > 0)
      .sort((a, b) => b.tasksDone - a.tasksDone)
      .slice(0, limitTop);

    // ── recent activity (latest tasks) ──
    const recent = await db.prepare(`
      SELECT t.id, t.agent_id, a.name AS agent_name, t.status,
             t.started_at, t.ended_at, t.created_at
      FROM agent_tasks t
      LEFT JOIN agents a ON a.id = t.agent_id
      ORDER BY COALESCE(t.ended_at, t.started_at, t.created_at) DESC
      LIMIT ?
    `).all(limitAct);
    const recentActivity = recent.map((r) => ({
      task_id: r.id,
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      status: r.status,
      at: r.ended_at ?? r.started_at ?? r.created_at,
    }));

    res.json({
      success: true,
      data: { overview, teams, topPerformers, recentActivity },
    });
  } catch (err) {
    next(err);
  }
});

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
