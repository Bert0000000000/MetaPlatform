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
router.get("/objects", (req, res, next) => {
  try {
    const { app_id } = req.query;
    let rows;
    if (app_id) {
      rows = db.prepare("SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at DESC").all(app_id);
    } else {
      rows = db.prepare("SELECT * FROM ontology_objects ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /objects/:id — single object with properties
router.get("/objects/:id", (req, res, next) => {
  try {
    const obj = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!obj) return res.status(404).json({ success: false, error: "对象不存在" });
    const properties = db.prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order").all(obj.id);
    res.json({ success: true, data: { ...obj, properties } });
  } catch (err) {
    next(err);
  }
});

// POST /objects — create object
router.post("/objects", (req, res, next) => {
  try {
    const { name, label, icon, app_id, description } = req.body;
    if (!name || !label || !icon) {
      return res.status(400).json({ success: false, error: "name, label, icon 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ontology_objects (id, app_id, name, label, description, icon, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, app_id || null, name, label, description || "", icon, now, now);
    const row = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /objects/:id — update object
router.put("/objects/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "对象不存在" });

    const { name, label, icon, description, status, app_id } = req.body;
    const now = new Date().toISOString();
    db.prepare(
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
    const row = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /objects/:id — delete object (cascade properties)
router.delete("/objects/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "对象不存在" });
    db.prepare("DELETE FROM ontology_properties WHERE object_id = ?").run(req.params.id);
    db.prepare("DELETE FROM ontology_objects WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Properties
// ════════════════════════════════════════════════════════

// GET /objects/:id/properties — list properties
router.get("/objects/:id/properties", (req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order").all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /objects/:id/properties — add property
router.post("/objects/:id/properties", (req, res, next) => {
  try {
    const obj = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!obj) return res.status(404).json({ success: false, error: "对象不存在" });

    const { name, label, type, required, unique_field, default_value, description, sort_order } = req.body;
    if (!name || !label) {
      return res.status(400).json({ success: false, error: "name, label 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
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
    db.prepare("UPDATE ontology_objects SET properties_count = properties_count + 1, updated_at = ? WHERE id = ?").run(now, req.params.id);
    const row = db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /properties/:id — update property
router.put("/properties/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "属性不存在" });

    const { name, label, type, required, unique_field, default_value, description, sort_order } = req.body;
    db.prepare(
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
    const row = db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /properties/:id — delete property
router.delete("/properties/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_properties WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "属性不存在" });
    const now = new Date().toISOString();
    db.prepare("DELETE FROM ontology_properties WHERE id = ?").run(req.params.id);
    db.prepare("UPDATE ontology_objects SET properties_count = MAX(properties_count - 1, 0), updated_at = ? WHERE id = ?").run(now, existing.object_id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Relations
// ════════════════════════════════════════════════════════

// GET /relations — list all relations
router.get("/relations", (req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM ontology_relations ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /relations — create relation
router.post("/relations", (req, res, next) => {
  try {
    const { source_object_id, target_object_id, type, label, description } = req.body;
    if (!source_object_id || !target_object_id || !type) {
      return res.status(400).json({ success: false, error: "source_object_id, target_object_id, type 为必填项" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ontology_relations (id, source_object_id, target_object_id, type, label, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, source_object_id, target_object_id, type, label || null, description || "", now);
    const row = db.prepare("SELECT * FROM ontology_relations WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Actions
// ════════════════════════════════════════════════════════

// GET /actions — list actions (optional filter by object_id)
router.get("/actions", (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = db.prepare("SELECT * FROM ontology_actions WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = db.prepare("SELECT * FROM ontology_actions ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /actions — create action
router.post("/actions", (req, res, next) => {
  try {
    const { object_id, name, type, trigger_type, config, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ontology_actions (id, object_id, name, type, trigger_type, config, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "custom", trigger_type || "manual", config || null, status || "active", now);
    const row = db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /actions/:id — update action
router.put("/actions/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "动作不存在" });
    const { object_id, name, type, trigger_type, config, status } = req.body;
    db.prepare(
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
    const row = db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /actions/:id — delete action
router.delete("/actions/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_actions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "动作不存在" });
    db.prepare("DELETE FROM ontology_actions WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Functions
// ════════════════════════════════════════════════════════

// GET /functions — list functions (optional filter by object_id)
router.get("/functions", (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = db.prepare("SELECT * FROM ontology_functions WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = db.prepare("SELECT * FROM ontology_functions ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /functions — create function
router.post("/functions", (req, res, next) => {
  try {
    const { object_id, name, type, expression, description, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ontology_functions (id, object_id, name, type, expression, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "custom", expression || null, description || null, status || "active", now);
    const row = db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /functions/:id — update function
router.put("/functions/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "函数不存在" });
    const { object_id, name, type, expression, description, status } = req.body;
    db.prepare(
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
    const row = db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /functions/:id — delete function
router.delete("/functions/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_functions WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "函数不存在" });
    db.prepare("DELETE FROM ontology_functions WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Rules
// ════════════════════════════════════════════════════════

// GET /rules — list rules (optional filter by object_id)
router.get("/rules", (req, res, next) => {
  try {
    const { object_id } = req.query;
    let rows;
    if (object_id) {
      rows = db.prepare("SELECT * FROM ontology_rules WHERE object_id = ? ORDER BY created_at DESC").all(object_id);
    } else {
      rows = db.prepare("SELECT * FROM ontology_rules ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /rules — create rule
router.post("/rules", (req, res, next) => {
  try {
    const { object_id, name, type, condition_expr, action, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ontology_rules (id, object_id, name, type, condition_expr, action, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, object_id || null, name, type || "validation", condition_expr || null, action || null, status || "active", now);
    const row = db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /rules/:id — update rule
router.put("/rules/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "规则不存在" });
    const { object_id, name, type, condition_expr, action, status } = req.body;
    db.prepare(
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
    const row = db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /rules/:id — delete rule
router.delete("/rules/:id", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM ontology_rules WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "规则不存在" });
    db.prepare("DELETE FROM ontology_rules WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
