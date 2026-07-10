/**
 * /api/apps/:id/forms — 应用级表单设计器持久化
 *
 *  Mounted from apps.js:
 *    router.use("/:id/forms", appFormsRoutes)
 *
 *  `mergeParams: true` 让嵌套路由拿到父路由的 `req.params.id` (即 app id).
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router({ mergeParams: true });

function nowISO() { return new Date().toISOString(); }

function safeJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function rowToDto(row) {
  if (!row) return row;
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    schema: safeJSON(row.schema_json, {}),
    version: row.version ?? 1,
    status: row.status,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ALLOWED_STATUS = ["draft", "published"];

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list forms for an app ────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_forms WHERE app_id = ? ORDER BY updated_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) { next(err); }
});

// ─── POST / — create a new form ───────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, schema, version, status } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }
    const safeStatus = ALLOWED_STATUS.includes(status) ? status : "draft";
    const safeVersion = Number.isFinite(+version) ? +version : 1;
    const schemaJson = schema == null ? null : (typeof schema === "string" ? schema : JSON.stringify(schema));

    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO app_forms (id, app_id, name, schema_json, version, status, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      name.trim(),
      schemaJson,
      safeVersion,
      safeStatus,
      req.user?.id || null,
      req.user?.id || null,
      now,
      now,
    );

    const row = await db.prepare("SELECT * FROM app_forms WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:formId — update form ───────────────────────────
router.put("/:formId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_forms WHERE id = ? AND app_id = ?"
    ).get(req.params.formId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "表单不存在" });

    const { name, schema, version, status } = req.body || {};
    const nextStatus = status && ALLOWED_STATUS.includes(status) ? status : existing.status;
    const nextSchemaJson =
      schema === undefined
        ? existing.schema_json
        : (schema == null ? null : (typeof schema === "string" ? schema : JSON.stringify(schema)));
    const nextVersion = version !== undefined && Number.isFinite(+version) ? +version : existing.version;

    const now = nowISO();
    await db.prepare(
      `UPDATE app_forms
       SET name = ?, schema_json = ?, version = ?, status = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name != null ? String(name).trim() : existing.name,
      nextSchemaJson,
      nextVersion,
      nextStatus,
      now,
      req.user?.id || null,
      req.params.formId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_forms WHERE id = ?").get(req.params.formId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── GET /:formId — single form ───────────────────────────
router.get("/:formId", async (req, res, next) => {
  try {
    const row = await db.prepare(
      "SELECT * FROM app_forms WHERE id = ? AND app_id = ?"
    ).get(req.params.formId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "表单不存在" });
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── POST /:formId/submit — public submit (no auth) ───────
//   本端点不通过 authenticate 中间件 — 在 apps.js 单独挂载在公开路径下.
//   这里保留 POST 作为受保护版本, 让"内部提交"也能走到.
router.post("/:formId/submit", async (req, res, next) => {
  try {
    const form = await db.prepare(
      "SELECT * FROM app_forms WHERE id = ? AND app_id = ?"
    ).get(req.params.formId, req.params.id);
    if (!form) return res.status(404).json({ success: false, error: "表单不存在" });
    if (form.status !== "published") {
      return res.status(403).json({ success: false, error: "表单未发布" });
    }
    const { values, submitterEmail, submitterName } = req.body || {};
    if (values == null || typeof values !== "object") {
      return res.status(400).json({ success: false, error: "提交内容(values)必须为对象" });
    }
    // P3-5: server-side 字段必填校验 (以 schema 里的 required 标记为主)
    try {
      const schema = safeJSON(form.schema_json, {});
      const fields = Array.isArray(schema?.fields)
        ? schema.fields
        : (Array.isArray(schema?.sections) ? schema.sections.flatMap((s) => s?.fields || []) : []);
      const missing = fields.filter((f) => f?.required && (values?.[f.name] === undefined || values?.[f.name] === "" || values?.[f.name] === null));
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段: ${missing.map((m) => m.label || m.name).join(", ")}`,
          missingFields: missing.map((m) => m.name),
        });
      }
    } catch (ve) {
      // 校验出错时不应阻断提交, 但写一行 audit 警告
      try {
        await db.prepare(
          `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
           VALUES (?, ?, ?, 'submit_form_validation_skipped', 'form', ?, ?, ?, 'warning', ?)`
        ).run(uuid(), null, null, form.id, JSON.stringify({ reason: String(ve?.message ?? ve) }), req.ip || '127.0.0.1', now);
      } catch (auditErr) { /* ignore */ }
    }
    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO form_submissions
         (id, app_id, form_id, version, submitter_email, submitter_name,
          submitter_user_id, values_json, metadata_json, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      id, req.params.id, form.id,
      form.version ?? 1,
      (submitterEmail && String(submitterEmail).trim().toLowerCase()) || (req.user?.email || null),
      (submitterName && String(submitterName).trim()) || (req.user?.name || null),
      req.user?.id || null,
      JSON.stringify(values),
      JSON.stringify({
        ip: req.ip,
        ua: req.headers['user-agent'],
        via: req.user ? "auth" : "public",
      }),
      now,
    );

    // 顺便写一条 audit_logs (form 提交不一定是 modification; 但 owner 会想看到流量)
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(
        uuid(),
        req.user?.id || null,
        req.user?.email || null,
        'submit_form',
        'form',
        form.id,
        JSON.stringify({ values: Object.keys(values || {}).length }),
        req.ip || '127.0.0.1',
        now,
      );
    } catch (e) { /* ignore */ }

    res.status(201).json({ success: true, data: { id, status: "pending" } });
  } catch (err) { next(err); }
});

// ─── GET /:formId/submissions — list submissions ──────────
router.get("/:formId/submissions", async (req, res, next) => {
  try {
    const form = await db.prepare(
      "SELECT id FROM app_forms WHERE id = ? AND app_id = ?"
    ).get(req.params.formId, req.params.id);
    if (!form) return res.status(404).json({ success: false, error: "表单不存在" });
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const rows = await db.prepare(
      "SELECT * FROM form_submissions WHERE form_id = ? AND app_id = ? ORDER BY submitted_at DESC LIMIT ?"
    ).all(form.id, req.params.id, limit);
    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        values: safeJSON(r.values_json, {}),
        metadata: safeJSON(r.metadata_json, {}),
      })),
    });
  } catch (err) { next(err); }
});

// ─── DELETE /:formId — delete form ────────────────────────
router.delete("/:formId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_forms WHERE id = ? AND app_id = ?"
    ).run(req.params.formId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "表单不存在" });
    }
    // 级联删 submissions
    try {
      await db.prepare("DELETE FROM form_submissions WHERE form_id = ?").run(req.params.formId);
    } catch (e) { /* 表可能不存在 */ }
    res.json({ success: true, data: { id: req.params.formId } });
  } catch (err) { next(err); }
});

export default router;