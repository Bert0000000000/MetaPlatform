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
router.get("/users", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /users — create user
router.post("/users", async (req, res, next) => {
  try {
    const { name, email, role, department, status, avatar } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: "name, email 为必填项" });

    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ success: false, error: "邮箱已存在" });

    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO users (id, name, email, role, department, status, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, email, role || "business", department || null, status || "active", avatar || null, now, now);
    const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id — update user
router.put("/users/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "用户不存在" });

    const { name, email, role, department, status, avatar } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
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
    const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id — delete user
router.delete("/users/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "用户不存在" });
    await db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
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
router.get("/roles", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM roles ORDER BY created_at").all();
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
router.post("/roles", async (req, res, next) => {
  try {
    const { id, name, label, permissions } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, error: "id, name 为必填项" });
    const existing = await db.prepare("SELECT id FROM roles WHERE id = ?").get(id);
    if (existing) return res.status(409).json({ success: false, error: "角色ID已存在" });
    await db.prepare(
      `INSERT INTO roles (id, name, label, permissions) VALUES (?, ?, ?, ?)`
    ).run(id, name, label || null, JSON.stringify(permissions || []));
    const row = await db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: { ...row, permissions: JSON.parse(row.permissions || "[]") } });
  } catch (err) {
    next(err);
  }
});

// PUT /roles/:id — update a role
router.put("/roles/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "角色不存在" });
    const { name, label, permissions } = req.body;
    await db.prepare(
      `UPDATE roles SET name = ?, label = ?, permissions = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      label !== undefined ? label : existing.label,
      permissions !== undefined ? JSON.stringify(permissions) : existing.permissions,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: { ...row, permissions: JSON.parse(row.permissions || "[]") } });
  } catch (err) {
    next(err);
  }
});

// DELETE /roles/:id — delete a role (cannot delete 'admin')
router.delete("/roles/:id", async (req, res, next) => {
  try {
    if (req.params.id === "admin") {
      return res.status(403).json({ success: false, error: "不能删除管理员角色" });
    }
    const existing = await db.prepare("SELECT * FROM roles WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "角色不存在" });
    await db.prepare("DELETE FROM roles WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Departments (database-backed CRUD)
// ════════════════════════════════════════════════════════

// GET /departments — list departments
router.get("/departments", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM departments ORDER BY sort_order, created_at").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /departments — create department
router.post("/departments", async (req, res, next) => {
  try {
    const { name, parent_id, leader, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO departments (id, name, parent_id, leader, icon, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, name, parent_id || null, leader || null, icon || null, now, now);
    const row = await db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /departments/:id — update department
router.put("/departments/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "部门不存在" });
    const { name, parent_id, leader, icon, status } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
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
    const row = await db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /departments/:id — delete department
router.delete("/departments/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "部门不存在" });
    await db.prepare("DELETE FROM departments WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Audit Logs
// ════════════════════════════════════════════════════════

// GET /logs — list audit logs (with pagination)
router.get("/logs", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = await db.prepare("SELECT COUNT(*) AS cnt FROM audit_logs").get().cnt;
    const rows = await db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    res.json({ success: true, data: { rows, total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

// POST /logs — create audit log entry
router.post("/logs", async (req, res, next) => {
  try {
    const { action, module, target, detail, ip, result } = req.body;
    if (!action) return res.status(400).json({ success: false, error: "action 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
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
    const row = await db.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  System Config
// ════════════════════════════════════════════════════════

// GET /config — list system config
router.get("/config", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM system_config ORDER BY key").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /config/:key — update config value
router.put("/config/:key", async (req, res, next) => {
  try {
    const { value, description } = req.body;
    const now = new Date().toISOString();
    const existing = await db.prepare("SELECT * FROM system_config WHERE key = ?").get(req.params.key);
    if (existing) {
      await db.prepare(
        `UPDATE system_config SET value = ?, description = ?, updated_at = ? WHERE key = ?`
      ).run(value ?? existing.value, description ?? existing.description, now, req.params.key);
    } else {
      await db.prepare(
        `INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)`
      ).run(req.params.key, value || null, description || "", now);
    }
    const row = await db.prepare("SELECT * FROM system_config WHERE key = ?").get(req.params.key);
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
router.get("/llm-config", async (_req, res, next) => {
  try {
    const items = await Promise.all(LLM_CONFIG_KEYS.map(async (item) => {
      const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").get(item.key);
      return { ...item, value: row ? row.value : "" };
    }));
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

// PUT /llm-config — batch update LLM config
//
// Implementation note: each item is upserted with its own statement inside
// an async loop, not a single wrapped transaction. The pg-worker backend
// is asynchronous (begin/commit/rollback are posted across a worker thread),
// so wrapping multiple statements in db.transaction(...) — which is a
// *synchronous* better-sqlite3 style API — does NOT actually bracket them
// into a real PostgreSQL transaction. The first statement runs before the
// BEGIN round-trips, and any error leaves the connection in a poisoned
// "transaction aborted" state that the next statement cannot escape.
//
// Each UPSERT is itself atomic, so we don't need a multi-statement tx.
router.put("/llm-config", async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "items 为必填项" });
    }
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
    );
    for (const item of items) {
      const meta = LLM_CONFIG_KEYS.find((k) => k.key === item.key);
      if (!meta) continue;
      await upsert.run(item.key, item.value || "", meta.description, now);
    }
    // Return updated config
    const updated = await Promise.all(LLM_CONFIG_KEYS.map(async (item) => {
      const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").get(item.key);
      return { ...item, value: row ? row.value : "" };
    }));
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /llm-config/status — test LLM connectivity
//
// ?provider=mock  → don't actually dial the LLM; just validate the
//                    configuration shape (base_url + api_key + model all set)
//                    and return connected=true with the mock provider tag.
//                    Used so the admin UI can validate configuration end-to-end
//                    even when no real upstream LLM is reachable.
router.get("/llm-config/status", async (req, res, next) => {
  try {
    const rows = await db.prepare("SELECT key, value FROM system_config WHERE key IN (?,?,?,?,?,?)").all(
      "llm_base_url", "llm_api_key", "llm_model", "llm_embedding_model", "llm_max_tokens", "llm_temperature"
    );
    const cfg = {};
    for (const r of rows) cfg[r.key] = r.value;

    const baseUrl = cfg.llm_base_url || process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    const apiKey = cfg.llm_api_key || process.env.LLM_API_KEY || "";

    if (req.query.provider === "mock" || baseUrl.startsWith("mock://") || baseUrl.startsWith("http://localhost") && req.query.provider === "mock") {
      // Mock mode — verify configuration is well-formed, skip the network call.
      const missing = [];
      if (!apiKey) missing.push("llm_api_key");
      if (!cfg.llm_model) missing.push("llm_model");
      if (missing.length > 0) {
        return res.json({
          success: true,
          data: {
            connected: false,
            reason: `Mock 模式下缺失字段: ${missing.join(", ")}`,
            baseUrl,
            model: cfg.llm_model,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          connected: true,
          baseUrl,
          model: cfg.llm_model,
          provider: "mock",
          reason: "已通过 Mock 验证（未实际连接远端）",
        },
      });
    }

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

// ════════════════════════════════════════════════════════
//  Runtime summary — fleet-wide view of all currently-published
//  apps, their container state, and the platform-wide docker
//  daemon reachability. Used by the admin dashboard.
// ════════════════════════════════════════════════════════

// GET /runtime/summary — list every published app's runtime status
router.get("/runtime/summary", async (_req, res, next) => {
  try {
    const published = await db.prepare(
      `SELECT id, name, app_slug, runtime_container_id, runtime_port,
              runtime_mode, runtime_alias_slug, published_at
       FROM applications
       WHERE status = 'published' AND app_slug IS NOT NULL`
    ).all();

    const { inspectRuntime, resolveTarget, probe } = await import("../services/runtime-orchestrator.js");
    const platformProbe = await probe();

    const items = await Promise.all(published.map(async (a) => {
      let runtime = null;
      try {
        runtime = await inspectRuntime(a.app_slug);
      } catch (err) {
        runtime = { state: "error", error: err.message };
      }
      const target = await resolveTarget(a.app_slug).catch(() => ({ mode: "unknown" }));
      return {
        app_id: a.id,
        name: a.name,
        app_slug: a.app_slug,
        alias_slug: a.runtime_alias_slug || a.app_slug,
        published_at: a.published_at,
        persisted_port: a.runtime_port,
        persisted_mode: a.runtime_mode,
        runtime,
        serving_mode: target.mode,
      };
    }));

    const totals = {
      total: items.length,
      container_running: items.filter((i) => i.runtime?.state === "running").length,
      degraded: items.filter((i) => i.serving_mode === "degraded").length,
      absent: items.filter((i) => !i.runtime || i.runtime.state === "absent").length,
    };

    res.json({
      success: true,
      data: {
        docker: platformProbe.ok ? "ok" : "degraded",
        docker_error: platformProbe.ok ? null : platformProbe.error,
        totals,
        items,
      },
    });
  } catch (err) { next(err); }
});

// POST /runtime/prune — manually trigger one prune pass.
// Returns the same structured report that the periodic pruner logs.
router.post("/runtime/prune", async (_req, res, next) => {
  try {
    const { pruneOnce } = await import("../services/runtime-pruner.js");
    const { aliasMap } = await import("../services/runtime-orchestrator.js");
    const report = await pruneOnce({ db, aliasMap });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

export default router;
