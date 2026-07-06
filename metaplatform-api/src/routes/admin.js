/**
 * /api/admin — Administration routes (users, roles, departments, logs, config)
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Users
// ════════════════════════════════════════════════════════

// GET /users — list users
router.get("/users", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /users — create user
router.post("/users", (req, res, next) => {
  try {
    const { name, email, role, department, status, avatar } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: "name, email 为必填项" });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ success: false, error: "邮箱已存在" });

    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, name, email, role, department, status, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, email, role || "business", department || null, status || "active", avatar || null, now, now);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id — update user
router.put("/users/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "用户不存在" });

    const { name, email, role, department, status, avatar } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ?, avatar = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      email ?? existing.email,
      role ?? existing.role,
      department ?? existing.department,
      status ?? existing.status,
      avatar ?? existing.avatar,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — delete user
router.delete("/users/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "用户不存在" });
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Roles (database-backed RBAC)
// ════════════════════════════════════════════════════════

// Seed data kept only as documentation / reference for initial population
const RBAC_ROLES = [
  { id: "super_admin", name: "超级管理员", label: "Super Admin", permissions: ["*"] },
  { id: "executive", name: "高管", label: "Executive", permissions: ["dashboard.view", "reports.view", "apps.view"] },
  { id: "business", name: "业务人员", label: "Business User", permissions: ["apps.view", "apps.edit", "data.view", "process.start"] },
  { id: "developer", name: "开发者", label: "Developer", permissions: ["apps.*", "ontology.*", "data.*", "process.*", "code.edit"] },
  { id: "architect", name: "架构师", label: "Architect", permissions: ["apps.*", "ontology.*", "data.*", "process.*", "system.design"] },
  { id: "ops", name: "运维", label: "Operations", permissions: ["system.*", "monitoring.*", "logs.view", "config.edit"] },
  { id: "admin", name: "管理员", label: "Administrator", permissions: ["dashboard.view", "reports.view", "apps.view", "apps.edit", "data.view", "ontology.view", "process.view", "quality.view", "knowledge.view", "agents.view", "system.view"] },
];

// GET /roles — list roles from database
router.get("/roles", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM roles ORDER BY created_at").all();
    const data = rows.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions || "[]"),
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /roles — create a new role
router.post("/roles", (req, res, next) => {
  try {
    const { id, name, label, permissions } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, error: "id, name 为必填项" });
    const existing = db.prepare("SELECT id FROM roles WHERE id = ?").get(id);
    if (existing) return res.status(409).json({ success: false, error: "角色ID已存在" });
    db.prepare(
      `INSERT INTO roles (id, name, label, permissions) VALUES (?, ?, ?, ?)`
    ).run(id, name, label || null, JSON.stringify(permissions || []));
    const row = db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: { ...row, permissions: JSON.parse(row.permissions || "[]") } });
  } catch (err) {
    next(err);
  }
});

// PUT /roles/:id — update a role
router.put("/roles/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "角色不存在" });
    const { name, label, permissions } = req.body;
    db.prepare(
      `UPDATE roles SET name = ?, label = ?, permissions = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      label !== undefined ? label : existing.label,
      permissions !== undefined ? JSON.stringify(permissions) : existing.permissions,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: { ...row, permissions: JSON.parse(row.permissions || "[]") } });
  } catch (err) {
    next(err);
  }
});

// DELETE /roles/:id — delete a role (cannot delete 'admin')
router.delete("/roles/:id", (req, res, next) => {
  try {
    if (req.params.id === "admin") {
      return res.status(403).json({ success: false, error: "不能删除管理员角色" });
    }
    const existing = db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "角色不存在" });
    db.prepare("DELETE FROM roles WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Departments (database-backed CRUD)
// ════════════════════════════════════════════════════════

// GET /departments — list departments
router.get("/departments", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM departments ORDER BY sort_order, created_at").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /departments — create department
router.post("/departments", (req, res, next) => {
  try {
    const { name, parent_id, leader, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO departments (id, name, parent_id, leader, icon, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, name, parent_id || null, leader || null, icon || null, now, now);
    const row = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /departments/:id — update department
router.put("/departments/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "部门不存在" });
    const { name, parent_id, leader, icon, status } = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE departments SET name = ?, parent_id = ?, leader = ?, icon = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      parent_id !== undefined ? parent_id : existing.parent_id,
      leader !== undefined ? leader : existing.leader,
      icon !== undefined ? icon : existing.icon,
      status ?? existing.status,
      now,
      req.params.id
    );
    const row = db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /departments/:id — delete department
router.delete("/departments/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "部门不存在" });
    db.prepare("DELETE FROM departments WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Audit Logs
// ════════════════════════════════════════════════════════

// GET /logs — list audit logs (with pagination)
router.get("/logs", (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = db.prepare("SELECT COUNT(*) AS cnt FROM audit_logs").get().cnt;
    const rows = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    res.json({ success: true, data: { rows, total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /logs — create audit log entry
router.post("/logs", (req, res, next) => {
  try {
    const { action, module, target, detail, ip, result } = req.body;
    if (!action) return res.status(400).json({ success: false, error: "action 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user?.id || null,
      req.user?.name || null,
      action,
      module || null,
      target || null,
      detail || null,
      ip || null,
      result || "success",
      now
    );
    const row = db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  System Config
// ════════════════════════════════════════════════════════

// GET /config — list system config
router.get("/config", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM system_config ORDER BY key").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /config/:key — update config value
router.put("/config/:key", (req, res, next) => {
  try {
    const { value, description } = req.body;
    const now = new Date().toISOString();
    const existing = db.prepare("SELECT * FROM system_config WHERE key = ?").get(req.params.key);
    if (existing) {
      db.prepare(
        `UPDATE system_config SET value = ?, description = ?, updated_at = ? WHERE key = ?`
      ).run(value ?? existing.value, description ?? existing.description, now, req.params.key);
    } else {
      db.prepare(
        `INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)`
      ).run(req.params.key, value || null, description || "", now);
    }
    const row = db.prepare("SELECT * FROM system_config WHERE key = ?").get(req.params.key);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── LLM / AI Gateway Config ─────────────────────────────
const LLM_CONFIG_KEYS = [
  { key: "llm_base_url", label: "Base URL", description: "LLM API 地址", placeholder: "https://api.openai.com/v1" },
  { key: "llm_api_key", label: "API Key", description: "LLM API 密钥", placeholder: "sk-..." },
  { key: "llm_model", label: "默认模型", description: "默认聊天模型", placeholder: "gpt-4o-mini" },
  { key: "llm_embedding_model", label: "Embedding 模型", description: "向量嵌入模型", placeholder: "text-embedding-3-small" },
  { key: "llm_max_tokens", label: "最大 Token", description: "单次请求最大 token 数", placeholder: "4096" },
  { key: "llm_temperature", label: "Temperature", description: "生成温度 (0-2)", placeholder: "0.7" },
];

// GET /llm-config — get all LLM config items
router.get("/llm-config", (_req, res, next) => {
  try {
    const items = LLM_CONFIG_KEYS.map((item) => {
      const row = db.prepare("SELECT value FROM system_config WHERE key = ?").get(item.key);
      return { ...item, value: row ? row.value : "" };
    });
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// PUT /llm-config — batch update LLM config
router.put("/llm-config", (req, res, next) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "items 为必填项" });
    }
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
    );
    const tx = db.transaction(() => {
      for (const item of items) {
        const meta = LLM_CONFIG_KEYS.find((k) => k.key === item.key);
        if (!meta) continue;
        upsert.run(item.key, item.value || "", meta.description, now, item.value || "", now);
      }
    });
    tx();
    // Return updated config
    const updated = LLM_CONFIG_KEYS.map((item) => {
      const row = db.prepare("SELECT value FROM system_config WHERE key = ?").get(item.key);
      return { ...item, value: row ? row.value : "" };
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /llm-config/status — test LLM connectivity
router.get("/llm-config/status", async (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT key, value FROM system_config WHERE key IN (?,?,?,?,?,?)").all(
      "llm_base_url", "llm_api_key", "llm_model", "llm_embedding_model", "llm_max_tokens", "llm_temperature"
    );
    const cfg = {};
    for (const r of rows) cfg[r.key] = r.value;

    const baseUrl = cfg.llm_base_url || process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    const apiKey = cfg.llm_api_key || process.env.LLM_API_KEY || "";

    if (!apiKey) {
      return res.json({ success: true, data: { connected: false, reason: "未配置 API Key" } });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        res.json({ success: true, data: { connected: true, baseUrl, model: cfg.llm_model || "gpt-4o-mini" } });
      } else {
        res.json({ success: true, data: { connected: false, reason: `HTTP ${resp.status}` } });
      }
    } catch {
      res.json({ success: true, data: { connected: false, reason: "连接超时或地址不可达" } });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
