/**
 * /api/ontology — Ontology management routes (objects, properties, relations)
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Objects
// ════════════════════════════════════════════════════════

// GET /objects — list all ontology objects
router.get("/objects", async (req, res, next) => {
  try {
    const { app_id } = req.query;
    let rows;
    if (app_id) {
      rows = await db.prepare("SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at DESC").all(app_id);
    } else {
      rows = await db.prepare("SELECT * FROM ontology_objects ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /objects/:id — single object with properties
router.get("/objects/:id", async (req, res, next) => {
  try {
    const obj = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!obj) return res.status(404).json({ success: false, error: "对象不存在" });
    const properties = await db.prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order").all(obj.id);
    res.json({ success: true, data: { ...obj, properties } });
  } catch (err) {
    next(err);
  }
});

// POST /objects — create object
router.post("/objects", async (req, res, next) => {
  try {
    const { name, label, icon, app_id, description } = req.body;
    if (!name || !label || !icon) {
      return res.status(400).json({ success: false, error: "name, label, icon 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_objects (id, app_id, name, label, description, icon, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, app_id || null, name, label, description || "", icon, now, now);
    const row = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /objects/:id — update object
router.put("/objects/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "对象不存在" });

    const { name, label, icon, description, status, app_id } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE ontology_objects SET name = ?, label = ?, icon = ?, description = ?, status = ?, app_id = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      label ?? existing.label,
      icon ?? existing.icon,
      description ?? existing.description,
      status ?? existing.status,
      app_id ?? existing.app_id,
      now,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /objects/:id — delete object (cascade properties)
router.delete("/objects/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "对象不存在" });
    await db.prepare("DELETE FROM ontology_properties WHERE object_id = ?").run(req.params.id);
    await db.prepare("DELETE FROM ontology_objects WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Properties
// ════════════════════════════════════════════════════════

// GET /objects/:id/properties — list properties
router.get("/objects/:id/properties", async (req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order").all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /objects/:id/properties — add property
router.post("/objects/:id/properties", async (req, res, next) => {
  try {
    const obj = await db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!obj) return res.status(404).json({ success: false, error: "对象不存在" });

    const { name, label, type, required, unique_field, default_value, description, sort_order } = req.body;
    if (!name || !label) {
      return res.status(400).json({ success: false, error: "name, label 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_properties (id, object_id, name, label, type, required, unique_field, default_value, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      name,
      label,
      type || "text",
      required ? 1 : 0,
      unique_field ? 1 : 0,
      default_value || null,
      description || "",
      sort_order || 0,
      now
    );
    // Update properties_count
    await db.prepare("UPDATE ontology_objects SET properties_count = properties_count + 1, updated_at = ? WHERE id = ?").run(now, req.params.id);
    const row = await db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /properties/:id — update property
router.put("/properties/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "属性不存在" });

    const { name, label, type, required, unique_field, default_value, description, sort_order } = req.body;
    await db.prepare(
      `UPDATE ontology_properties SET name = ?, label = ?, type = ?, required = ?, unique_field = ?, default_value = ?, description = ?, sort_order = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      label ?? existing.label,
      type ?? existing.type,
      required !== undefined ? (required ? 1 : 0) : existing.required,
      unique_field !== undefined ? (unique_field ? 1 : 0) : existing.unique_field,
      default_value ?? existing.default_value,
      description ?? existing.description,
      sort_order ?? existing.sort_order,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /properties/:id — delete property
router.delete("/properties/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "属性不存在" });
    const now = new Date().toISOString();
    await db.prepare("DELETE FROM ontology_properties WHERE id = ?").run(req.params.id);
    await db.prepare("UPDATE ontology_objects SET properties_count = MAX(properties_count - 1, 0), updated_at = ? WHERE id = ?").run(now, existing.object_id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Relations
// ════════════════════════════════════════════════════════

// GET /relations — list all relations
router.get("/relations", async (req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM ontology_relations ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /relations — create relation
router.post("/relations", async (req, res, next) => {
  try {
    const { source_object_id, target_object_id, type, label, description } = req.body;
    if (!source_object_id || !target_object_id || !type) {
      return res.status(400).json({ success: false, error: "source_object_id, target_object_id, type 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_relations (id, source_object_id, target_object_id, type, label, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, source_object_id, target_object_id, type, label || null, description || "", now);
    const row = await db.prepare("SELECT * FROM ontology_relations WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Actions
// ════════════════════════════════════════════════════════

// GET /actions — list actions (optional filter by object_id)
router.get("/actions", async (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = await db.prepare("SELECT * FROM ontology_actions WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = await db.prepare("SELECT * FROM ontology_actions ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /actions — create action
router.post("/actions", async (req, res, next) => {
  try {
    const { object_id, name, type, trigger_type, config, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_actions (id, object_id, name, type, trigger_type, config, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "custom", trigger_type || "manual", config || null, status || "active", now);
    const row = await db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /actions/:id — update action
router.put("/actions/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "动作不存在" });
    const { object_id, name, type, trigger_type, config, status } = req.body;
    await db.prepare(
      `UPDATE ontology_actions SET object_id = ?, name = ?, type = ?, trigger_type = ?, config = ?, status = ? WHERE id = ?`
    ).run(
      object_id !== undefined ? object_id : existing.object_id,
      name ?? existing.name,
      type ?? existing.type,
      trigger_type ?? existing.trigger_type,
      config !== undefined ? config : existing.config,
      status ?? existing.status,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /actions/:id — delete action
router.delete("/actions/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "动作不存在" });
    await db.prepare("DELETE FROM ontology_actions WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Functions
// ════════════════════════════════════════════════════════

// GET /functions — list functions (optional filter by object_id)
router.get("/functions", async (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = await db.prepare("SELECT * FROM ontology_functions WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = await db.prepare("SELECT * FROM ontology_functions ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /functions — create function
router.post("/functions", async (req, res, next) => {
  try {
    const { object_id, name, type, expression, description, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_functions (id, object_id, name, type, expression, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "custom", expression || null, description || null, status || "active", now);
    const row = await db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /functions/:id — update function
router.put("/functions/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "函数不存在" });
    const { object_id, name, type, expression, description, status } = req.body;
    await db.prepare(
      `UPDATE ontology_functions SET object_id = ?, name = ?, type = ?, expression = ?, description = ?, status = ? WHERE id = ?`
    ).run(
      object_id !== undefined ? object_id : existing.object_id,
      name ?? existing.name,
      type ?? existing.type,
      expression !== undefined ? expression : existing.expression,
      description !== undefined ? description : existing.description,
      status ?? existing.status,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /functions/:id — delete function
router.delete("/functions/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "函数不存在" });
    await db.prepare("DELETE FROM ontology_functions WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Rules
// ════════════════════════════════════════════════════════

// GET /rules — list rules (optional filter by object_id)
router.get("/rules", async (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = await db.prepare("SELECT * FROM ontology_rules WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = await db.prepare("SELECT * FROM ontology_rules ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /rules — create rule
router.post("/rules", async (req, res, next) => {
  try {
    const { object_id, name, type, condition_expr, action, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ontology_rules (id, object_id, name, type, condition_expr, action, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "validation", condition_expr || null, action || null, status || "active", now);
    const row = await db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /rules/:id — update rule
router.put("/rules/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "规则不存在" });
    const { object_id, name, type, condition_expr, action, status } = req.body;
    await db.prepare(
      `UPDATE ontology_rules SET object_id = ?, name = ?, type = ?, condition_expr = ?, action = ?, status = ? WHERE id = ?`
    ).run(
      object_id !== undefined ? object_id : existing.object_id,
      name ?? existing.name,
      type ?? existing.type,
      condition_expr !== undefined ? condition_expr : existing.condition_expr,
      action !== undefined ? action : existing.action,
      status ?? existing.status,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /rules/:id — delete rule
router.delete("/rules/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "规则不存在" });
    await db.prepare("DELETE FROM ontology_rules WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Security Rules
// ════════════════════════════════════════════════════════

// GET /security-rules — list all security rules
router.get("/security-rules", async (req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM ontology_security_rules ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /security-rules — create security rule
router.post("/security-rules", async (req, res, next) => {
  try {
    const { name, level, object_name, rule, roles, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const result = await db.prepare(
      `INSERT INTO ontology_security_rules (name, level, object_name, rule, roles, status) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, level || "字段级", object_name || null, rule || null, roles || null, status || "active");
    const row = await db.prepare("SELECT * FROM ontology_security_rules WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /security-rules/:id — update security rule
router.put("/security-rules/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_security_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "安全规则不存在" });
    const { name, level, object_name, rule, roles, status } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE ontology_security_rules SET name = ?, level = ?, object_name = ?, rule = ?, roles = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      level ?? existing.level,
      object_name !== undefined ? object_name : existing.object_name,
      rule !== undefined ? rule : existing.rule,
      roles !== undefined ? roles : existing.roles,
      status ?? existing.status,
      now,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_security_rules WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /security-rules/:id — delete security rule
router.delete("/security-rules/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_security_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "安全规则不存在" });
    await db.prepare("DELETE FROM ontology_security_rules WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Auto Numbers
// ════════════════════════════════════════════════════════

// GET /auto-numbers — list all auto-number rules
router.get("/auto-numbers", async (req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM ontology_auto_numbers ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /auto-numbers — create auto-number rule
router.post("/auto-numbers", async (req, res, next) => {
  try {
    const { name, object_name, prefix, format, current_value, status } = req.body;
    if (!name || !object_name || !prefix) {
      return res.status(400).json({ success: false, error: "name, object_name, prefix 为必填项" });
    }
    const result = await db.prepare(
      `INSERT INTO ontology_auto_numbers (name, object_name, prefix, format, current_value, status) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, object_name, prefix, format || "PREFIX-{YYYY}{MM}{seq:4}", current_value ?? 0, status || "active");
    const row = await db.prepare("SELECT * FROM ontology_auto_numbers WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /auto-numbers/:id — update auto-number rule
router.put("/auto-numbers/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_auto_numbers WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "编号规则不存在" });
    const { name, object_name, prefix, format, current_value, status } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE ontology_auto_numbers SET name = ?, object_name = ?, prefix = ?, format = ?, current_value = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      object_name ?? existing.object_name,
      prefix ?? existing.prefix,
      format ?? existing.format,
      current_value !== undefined ? current_value : existing.current_value,
      status ?? existing.status,
      now,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM ontology_auto_numbers WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /auto-numbers/:id — delete auto-number rule
router.delete("/auto-numbers/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_auto_numbers WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "编号规则不存在" });
    await db.prepare("DELETE FROM ontology_auto_numbers WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err) {
    next(err);
  }
});

// GET / — ontology overview
router.get("/", async (req, res) => {
  try {
    const objects = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_objects").get().cnt;
    const relations = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_relations").get().cnt;
    const actions = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_actions").get().cnt;
    const instances = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_instances").get().cnt;
    const events = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_events").get().cnt;
    res.json({ success: true, data: { objects, relations, actions, instances, events } });
  } catch (err) {
    res.json({ success: true, data: { objects: 0, relations: 0, actions: 0, instances: 0, events: 0 } });
  }
});

// ════════════════════════════════════════════════════════
//  Instances (P0-1) — 业务实例 CRUD
// ════════════════════════════════════════════════════════

// GET /objects/:id/instances — 列出对象下所有实例
router.get("/objects/:id/instances", async (req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT * FROM ontology_instances WHERE object_id = ? ORDER BY created_at DESC"
    ).all(req.params.id);
    const data = rows.map((r) => ({ ...r, data: JSON.parse(r.data || "{}") }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /objects/:id/instances — 新建实例
router.post("/objects/:id/instances", async (req, res, next) => {
  try {
    const id = uuid();
    const { data = {} } = req.body;
    await db.prepare(
      "INSERT INTO ontology_instances (id, object_id, data) VALUES (?, ?, ?)"
    ).run(id, req.params.id, JSON.stringify(data));
    // 触发事件
    const traceId = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(
      "INSERT INTO ontology_events (id, type, source, target, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "EntityInstanceCreated", req.params.id, id, JSON.stringify(data), traceId);
    res.json({ success: true, data: { id, object_id: req.params.id, data, trace_id: traceId } });
  } catch (err) {
    next(err);
  }
});

// GET /instances/:id — 详情
router.get("/instances/:id", async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT * FROM ontology_instances WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "实例不存在" });
    res.json({ success: true, data: { ...row, data: JSON.parse(row.data || "{}") } });
  } catch (err) {
    next(err);
  }
});

// PUT /instances/:id — 更新
router.put("/instances/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_instances WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "实例不存在" });
    const { data = {} } = req.body;
    await db.prepare(
      "UPDATE ontology_instances SET data = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(data), req.params.id);
    // 触发事件
    const traceId = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(
      "INSERT INTO ontology_events (id, type, source, target, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "EntityInstanceUpdated", existing.object_id, req.params.id, JSON.stringify(data), traceId);
    res.json({ success: true, data: { id: req.params.id, data } });
  } catch (err) {
    next(err);
  }
});

// DELETE /instances/:id — 删除
router.delete("/instances/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM ontology_instances WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "实例不存在" });
    await db.prepare("DELETE FROM ontology_instances WHERE id = ?").run(req.params.id);
    const traceId = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(
      "INSERT INTO ontology_events (id, type, source, target, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "EntityInstanceDeleted", existing.object_id, req.params.id, "{}", traceId);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Snapshots (P0-3) — 本体版本快照
// ════════════════════════════════════════════════════════

// GET /snapshots — 列表
router.get("/snapshots", async (req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT id, label, description, created_at, created_by FROM ontology_snapshots ORDER BY created_at DESC"
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /snapshots — 创建快照 (自动捕获当前 8 要素状态)
router.post("/snapshots", async (req, res, next) => {
  try {
    const id = uuid();
    const { label, description } = req.body;
    if (!label) return res.status(400).json({ success: false, error: "快照名称必填" });
    // 抓取 8 要素
    const objects = await db.prepare("SELECT * FROM ontology_objects").all();
    const properties = await db.prepare("SELECT * FROM ontology_properties").all();
    const relations = await db.prepare("SELECT * FROM ontology_relations").all();
    const actions = await db.prepare("SELECT * FROM ontology_actions").all();
    const functions = await db.prepare("SELECT * FROM ontology_functions").all();
    const rules = await db.prepare("SELECT * FROM ontology_rules").all();
    const payload = { objects, properties, relations, actions, functions, rules, snapshotAt: new Date().toISOString() };
    await db.prepare(
      "INSERT INTO ontology_snapshots (id, label, description, payload) VALUES (?, ?, ?, ?)"
    ).run(id, label, description || null, JSON.stringify(payload));
    const traceId = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(
      "INSERT INTO ontology_events (id, type, source, target, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(uuid(), "SnapshotCreated", label, id, "{}", traceId);
    res.json({ success: true, data: { id, label, count: { objects: objects.length, properties: properties.length, relations: relations.length } } });
  } catch (err) {
    next(err);
  }
});

// GET /snapshots/:id — 详情
router.get("/snapshots/:id", async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT * FROM ontology_snapshots WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "快照不存在" });
    res.json({ success: true, data: { ...row, payload: JSON.parse(row.payload) } });
  } catch (err) {
    next(err);
  }
});

// GET /snapshots/:from/diff/:to — 两个快照 diff
router.get("/snapshots/:from/diff/:to", async (req, res, next) => {
  try {
    const a = await db.prepare("SELECT payload FROM ontology_snapshots WHERE id = ?").get(req.params.from);
    const b = await db.prepare("SELECT payload FROM ontology_snapshots WHERE id = ?").get(req.params.to);
    if (!a || !b) return res.status(404).json({ success: false, error: "快照不存在" });
    const pa = JSON.parse(a.payload);
    const pb = JSON.parse(b.payload);
    // 简单 diff: 比较每类数组长度
    const diff = {};
    ["objects", "properties", "relations", "actions", "functions", "rules"].forEach((k) => {
      diff[k] = { from: (pa[k] || []).length, to: (pb[k] || []).length, delta: (pb[k] || []).length - (pa[k] || []).length };
    });
    res.json({ success: true, data: diff });
  } catch (err) {
    next(err);
  }
});

// DELETE /snapshots/:id
router.delete("/snapshots/:id", async (req, res, next) => {
  try {
    await db.prepare("DELETE FROM ontology_snapshots WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Events (P1-5) — 事件流
// ════════════════════════════════════════════════════════

// GET /events — 列表 (支持 type 过滤 + since 时间戳)
router.get("/events", async (req, res, next) => {
  try {
    const { type, trace_id, since, limit = 100 } = req.query;
    let sql = "SELECT * FROM ontology_events WHERE 1=1";
    const params = [];
    if (type) { sql += " AND type = ?"; params.push(type); }
    if (trace_id) { sql += " AND trace_id = ?"; params.push(trace_id); }
    if (since) { sql += " AND timestamp > ?"; params.push(since); }
    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(Number(limit));
    const rows = await db.prepare(sql).all(...params);
    const data = rows.map((r) => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /events — 手动发事件 (兼容旧版, 也用于测试)
router.post("/events", async (req, res, next) => {
  try {
    const id = uuid();
    const { type, source, target, payload, trace_id } = req.body;
    if (!type) return res.status(400).json({ success: false, error: "type 必填" });
    await db.prepare(
      "INSERT INTO ontology_events (id, type, source, target, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, type, source || null, target || null, payload ? JSON.stringify(payload) : null, trace_id || null);
    res.json({ success: true, data: { id, type, source, target, trace_id } });
  } catch (err) {
    next(err);
  }
});

export default router;
