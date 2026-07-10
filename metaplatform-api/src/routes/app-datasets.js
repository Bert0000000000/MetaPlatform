/**
 * /api/apps/:id/datasets — 应用级数据集
 *
 *  Mounted from apps.js:
 *    router.use("/:id/datasets", appDatasetsRoutes)
 *
 *  `mergeParams: true` 让嵌套路由拿到父路由的 `req.params.id` (即 app id).
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";
import runDataset from "./_shared/runDataset.js";

const router = Router({ mergeParams: true });

function nowISO() { return new Date().toISOString(); }

function safeJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

const ALLOWED_SOURCE_TYPES = new Set([
  "ontology_object", "view", "form", "sql",
]);

function rowToDto(row) {
  if (!row) return row;
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type,
    ontologyObjectId: row.ontology_object_id,
    sqlText: row.sql_text,
    formId: row.form_id,
    fields: safeJSON(row.fields_json, []),
    cacheTtlSeconds: row.cache_ttl_seconds ?? 0,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list datasets ───────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_datasets WHERE app_id = ? ORDER BY updated_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) {
    if (/no such table/i.test(String(err?.message))) {
      return res.json({ success: true, data: [] });
    }
    next(err);
  }
});

// ─── GET /:datasetId — single dataset ───────────────────────
router.get("/:datasetId", async (req, res, next) => {
  try {
    const row = await db.prepare(
      "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
    ).get(req.params.datasetId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "数据集不存在" });
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── POST / — create ──────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const {
      name, description, sourceType, ontologyObjectId,
      sqlText, formId, fields, cacheTtlSeconds,
    } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }
    if (!ALLOWED_SOURCE_TYPES.has(String(sourceType))) {
      return res.status(400).json({ success: false, error: `sourceType 必须是 ${[...ALLOWED_SOURCE_TYPES].join(' / ')} 之一` });
    }
    const fieldsJson = fields == null ? null : (typeof fields === "string" ? fields : JSON.stringify(fields));

    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO app_datasets (id, app_id, name, description, source_type,
                                  ontology_object_id, sql_text, form_id,
                                  fields_json, cache_ttl_seconds, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      name.trim(),
      description || null,
      sourceType,
      ontologyObjectId || null,
      sqlText || null,
      formId || null,
      fieldsJson,
      Number(cacheTtlSeconds || 0),
      req.user?.id || null,
      now,
      now,
    );

    const row = await db.prepare("SELECT * FROM app_datasets WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:datasetId — update ─────────────────────────────
router.put("/:datasetId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
    ).get(req.params.datasetId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "数据集不存在" });

    const {
      name, description, sourceType, ontologyObjectId,
      sqlText, formId, fields, cacheTtlSeconds,
    } = req.body || {};
    if (sourceType != null && !ALLOWED_SOURCE_TYPES.has(String(sourceType))) {
      return res.status(400).json({ success: false, error: `sourceType 必须是 ${[...ALLOWED_SOURCE_TYPES].join(' / ')} 之一` });
    }
    const fieldsJson = fields === undefined
      ? existing.fields_json
      : (fields == null ? null : (typeof fields === "string" ? fields : JSON.stringify(fields)));

    const now = nowISO();
    await db.prepare(
      `UPDATE app_datasets
       SET name = ?, description = ?, source_type = ?, ontology_object_id = ?,
           sql_text = ?, form_id = ?, fields_json = ?, cache_ttl_seconds = ?,
           updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name != null ? String(name).trim() : existing.name,
      description !== undefined ? description : existing.description,
      sourceType || existing.source_type,
      ontologyObjectId !== undefined ? ontologyObjectId || null : existing.ontology_object_id,
      sqlText !== undefined ? sqlText || null : existing.sql_text,
      formId !== undefined ? formId || null : existing.form_id,
      fieldsJson,
      cacheTtlSeconds != null ? Number(cacheTtlSeconds) : existing.cache_ttl_seconds,
      now,
      req.params.datasetId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_datasets WHERE id = ?").get(req.params.datasetId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── POST /:datasetId/preview — 预览数据集, 拉前 200 行 ─
router.post("/:datasetId/preview", async (req, res, next) => {
  try {
    const dataset = await db.prepare(
      "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
    ).get(req.params.datasetId, req.params.id);
    if (!dataset) return res.status(404).json({ success: false, error: "数据集不存在" });
    const limit = Math.min(Math.max(Number(req.body?.limit || 200), 1), 1000);
    const t0 = Date.now();
    const rows = await runDataset(dataset, req.params.id, limit);
    res.json({
      success: true,
      data: {
        rows,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        datasetId: dataset.id,
        took: Date.now() - t0,
      },
    });
  } catch (err) { next(err); }
});

// ─── DELETE /:datasetId ─────────────────────────────
router.delete("/:datasetId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const result = await db.prepare(
      "DELETE FROM app_datasets WHERE id = ? AND app_id = ?"
    ).run(req.params.datasetId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "数据集不存在" });
    }
    res.json({ success: true, data: { id: req.params.datasetId } });
  } catch (err) { next(err); }
});

export default router;
