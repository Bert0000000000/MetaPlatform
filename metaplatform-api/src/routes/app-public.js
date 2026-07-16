/**
 * /api/public/apps/:appSlug — 公开访问端点 (无需 auth, 仅可读 + 表单提交)
 *
 *  公开访问只读:
 *    GET  /api/public/forms/:formId       — 拉已发布的表单 schema (anchor: id, 仅 status='published')
 *    GET  /api/public/dashboards/:dashId  — 拉已发布的仪表盘配置
 *    POST /api/public/forms/:formId/submit — 提交表单 (替代 auth 路径)
 *
 *  注意: 这个 mount 不走 authenticate, 也没有 rate-limit (后续加).
 *  由于这些端点的 URL 是公开的 (含 id), 也建议未来加 slug 别名, 见 apps.js runtime_alias_slug.
 */
import { Router } from "express";
import db from "../db.js";

const router = Router();

function safeJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function findPublishedForm(formId) {
  return await db.prepare(
    "SELECT id, app_id, name, schema_json, version, status FROM app_forms WHERE id = ?"
  ).get(formId);
}

// ─── GET /forms/:formId — 已发布表单 schema ──────────────────
router.get("/forms/:formId", async (req, res) => {
  try {
    const form = await findPublishedForm(req.params.formId);
    if (!form) return res.status(404).json({ success: false, error: "表单不存在" });
    if (form.status !== "published") {
      return res.status(403).json({ success: false, error: "表单未发布" });
    }
    res.json({
      success: true,
      data: {
        id: form.id,
        appId: form.app_id,
        name: form.name,
        version: form.version,
        schema: safeJSON(form.schema_json, {}),
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── POST /forms/:formId/submit — 公开提交 (无 auth) ──────────
router.post("/forms/:formId/submit", async (req, res) => {
  try {
    const form = await findPublishedForm(req.params.formId);
    if (!form) return res.status(404).json({ success: false, error: "表单不存在" });
    if (form.status !== "published") {
      return res.status(403).json({ success: false, error: "表单未发布" });
    }
    const { values, submitterEmail, submitterName } = req.body || {};
    if (values == null || typeof values !== "object") {
      return res.status(400).json({ success: false, error: "提交内容(values)必须为对象" });
    }
    // server-side required 字段校验
    try {
      const schema = typeof form.schema_json === "string" ? JSON.parse(form.schema_json) : (form.schema_json || {});
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
    } catch (ve) { /* schema 不合法, 不阻断 */ }
    const { v4: uuid } = await import("uuid");
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO form_submissions
         (id, app_id, form_id, version, submitter_email, submitter_name,
          values_json, metadata_json, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      id, form.app_id, form.id, form.version ?? 1,
      (submitterEmail && String(submitterEmail).trim().toLowerCase()) || null,
      (submitterName && String(submitterName).trim()) || null,
      JSON.stringify(values),
      JSON.stringify({ ip: req.ip, ua: req.headers["user-agent"], via: "public" }),
      now,
    );
    res.status(201).json({ success: true, data: { id, status: "pending" } });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── GET /forms/:formId/submissions — 公开提交记录（只读）─────
router.get("/forms/:formId/submissions", async (req, res) => {
  try {
    const form = await findPublishedForm(req.params.formId);
    if (!form) return res.status(404).json({ success: false, error: "表单不存在" });
    if (form.status !== "published") {
      return res.status(403).json({ success: false, error: "表单未发布" });
    }

    const allowedSortFields = ["id", "submitter_email", "submitter_name", "status", "submitted_at"];
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 200);
    const sortField = allowedSortFields.includes(req.query.sortField) ? req.query.sortField : "submitted_at";
    const sortOrder = req.query.sortOrder === "asc" ? "ASC" : "DESC";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = ["form_id = ?", "app_id = ?"];
    const params = [form.id, form.app_id];
    if (q) {
      where.push("(submitter_email LIKE ? OR submitter_name LIKE ? OR values_json LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (req.query.status) {
      where.push("status = ?");
      params.push(req.query.status);
    }

    const whereSql = where.join(" AND ");
    const { total } = await db.prepare(
      `SELECT COUNT(*) AS total FROM form_submissions WHERE ${whereSql}`
    ).get(...params);
    const offset = (page - 1) * pageSize;
    const rows = await db.prepare(
      `SELECT id, app_id, form_id, version, submitter_email, submitter_name,
              values_json, metadata_json, status, submitted_at
       FROM form_submissions WHERE ${whereSql} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          appId: r.app_id,
          formId: r.form_id,
          version: r.version,
          submitterEmail: r.submitter_email,
          submitterName: r.submitter_name,
          values: safeJSON(r.values_json, {}),
          metadata: safeJSON(r.metadata_json, {}),
          status: r.status,
          submittedAt: r.submitted_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── GET /dashboards/:dashId — 公开只读仪表盘配置 ────────────
router.get("/dashboards/:dashId", async (req, res) => {
  try {
    const dash = await db.prepare(
      "SELECT id, app_id, name, layout_json, widgets_json, status FROM app_dashboards WHERE id = ?"
    ).get(req.params.dashId);
    if (!dash) return res.status(404).json({ success: false, error: "仪表盘不存在" });
    if (dash.status !== "published") {
      return res.status(403).json({ success: false, error: "仪表盘未发布" });
    }
    res.json({
      success: true,
      data: {
        id: dash.id,
        appId: dash.app_id,
        name: dash.name,
        layout: safeJSON(dash.layout_json, {}),
        widgets: safeJSON(dash.widgets_json, []),
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── POST /dashboards/:dashId/widgets/data — 公开只读 widget data ──────
import runDataset from "./_shared/runDataset.js";
router.post("/dashboards/:dashId/widgets/data", async (req, res) => {
  try {
    const dash = await db.prepare(
      "SELECT id, app_id FROM app_dashboards WHERE id = ?"
    ).get(req.params.dashId);
    if (!dash) return res.status(404).json({ success: false, error: "仪表盘不存在" });
    if (!dash.status || dash.status !== "published") {
      return res.status(403).json({ success: false, error: "仪表盘未发布" });
    }
    const widgets = Array.isArray(req.body?.widgets) ? req.body.widgets : [];
    const out = [];
    for (const widget of widgets) {
      const widgetId = widget.id || widget.widgetId;
      const dsId = widget.datasetId;
      try {
        if (!dsId) {
          out.push({ widgetId, status: "skipped", note: "未绑定 dataset" });
          continue;
        }
        const dataset = await db.prepare(
          "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
        ).get(dsId, dash.app_id);
        if (!dataset) {
          out.push({ widgetId, status: "failed", error: "dataset 不存在" });
          continue;
        }
        const rows = await runDataset(dataset, dash.app_id, 200);
        out.push({
          widgetId, status: "success",
          rows, rowCount: Array.isArray(rows) ? rows.length : 0,
        });
      } catch (err2) {
        out.push({
          widgetId, status: "failed",
          error: String(err2?.message ?? err2),
        });
      }
    }
    res.json({ success: true, data: { widgets: out } });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── GET /aliases/:slug — 公开 redirect alias ───────
router.get("/aliases/:slug", async (req, res) => {
  try {
    const alias = await db.prepare(
      "SELECT slug, app_id, kind, target_id, status FROM app_public_aliases WHERE slug = ? AND status = 'active'"
    ).get(req.params.slug);
    if (!alias) return res.status(404).json({ success: false, error: "alias 不存在或已下线" });
    res.json({
      success: true,
      data: {
        slug: alias.slug,
        appId: alias.app_id,
        kind: alias.kind,
        targetId: alias.target_id,
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── GET /r/:slug — 短链解析 (无 auth, 返回目标 URL + 渲染数据) ───
// 返回:
//   { success, data: { slug, kind, targetId, appId, url: "/apps/<id>/public/<kind>?<kind>Id=<id>" } }
router.get("/r/:slug", async (req, res) => {
  try {
    const alias = await db.prepare(
      "SELECT slug, app_id, kind, target_id, status FROM app_public_aliases WHERE slug = ? AND status = 'active'"
    ).get(req.params.slug);
    if (!alias) return res.status(404).json({ success: false, error: "alias 不存在或已下线" });

    // 校验 target 必须存在 + 已发布
    let targetStatus = null;
    let targetName = null;
    if (alias.kind === "form") {
      const r = await db.prepare("SELECT name, status FROM app_forms WHERE id = ? AND app_id = ?").get(alias.target_id, alias.app_id);
      if (!r) return res.status(404).json({ success: false, error: "目标表单不存在" });
      targetStatus = r.status; targetName = r.name;
      if (r.status !== "published") return res.status(403).json({ success: false, error: `表单 "${r.name}" 未发布` });
    } else if (alias.kind === "report") {
      const r = await db.prepare("SELECT name, status FROM app_reports WHERE id = ? AND app_id = ?").get(alias.target_id, alias.app_id);
      if (!r) return res.status(404).json({ success: false, error: "目标报表不存在" });
      targetStatus = r.status; targetName = r.name;
      if (r.status !== "published") return res.status(403).json({ success: false, error: `报表 "${r.name}" 未发布` });
    } else if (alias.kind === "dashboard") {
      const r = await db.prepare("SELECT name, status FROM app_dashboards WHERE id = ? AND app_id = ?").get(alias.target_id, alias.app_id);
      if (!r) return res.status(404).json({ success: false, error: "目标仪表盘不存在" });
      targetStatus = r.status; targetName = r.name;
      if (r.status !== "published") return res.status(403).json({ success: false, error: `仪表盘 "${r.name}" 未发布` });
    } else {
      return res.status(400).json({ success: false, error: `未知 alias kind: ${alias.kind}` });
    }

    // 短链对应 url
    let url = null;
    if (alias.kind === "form") url = `/apps/${alias.app_id}/public/form?formId=${alias.target_id}`;
    else if (alias.kind === "report") url = `/apps/${alias.app_id}/public/report?reportId=${alias.target_id}`;
    else if (alias.kind === "dashboard") url = `/apps/${alias.app_id}/public/dashboard?dashboardId=${alias.target_id}`;

    // 增加访问计数
    try {
      const now = new Date().toISOString();
      await db.prepare(
        "UPDATE app_public_aliases SET hit_count = COALESCE(hit_count, 0) + 1, last_hit_at = ? WHERE slug = ?"
      ).run(now, req.params.slug);
    } catch { /* ignore */ }

    res.json({
      success: true,
      data: {
        slug: alias.slug,
        appId: alias.app_id,
        kind: alias.kind,
        targetId: alias.target_id,
        targetName,
        targetStatus,
        url,
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err?.message ?? err) }); }
});

// ─── GET /published-apps — 列出所有已发布的应用 (公开, 无 auth) ──────
// 用途: 公开应用市场 / 应用展示页
router.get("/published-apps", async (_req, res) => {
  try {
    const rows = await db.prepare(
      "SELECT id, name, description, category, icon, app_slug, published_url, published_version, published_at FROM applications WHERE status = 'published' ORDER BY published_at DESC"
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
});

// ─── GET /apps/:slug — 公开应用详情 (无 auth) ───────────────────
// 用途: 公开访问已发布应用, 返回 config + 公开 widgets/forms 列表
router.get("/apps/:slug", async (req, res) => {
  try {
    const row = await db.prepare(
      "SELECT id, name, description, category, icon, app_slug, published_url, published_version, published_at, publish_config FROM applications WHERE app_slug = ? AND status = 'published'"
    ).get(req.params.slug);
    if (!row) return res.status(404).json({ success: false, error: "App not found or not published" });
    // 解析 publish_config
    let config = {};
    try { config = JSON.parse(row.publish_config ?? "{}"); } catch {}
    // 列出公开表单
    const forms = await db.prepare(
      "SELECT id, name, schema_json, version FROM app_forms WHERE app_id = ? AND status = 'published' ORDER BY created_at DESC"
    ).all(row.id);
    // 列出公开仪表盘
    const dashboards = await db.prepare(
      "SELECT id, name, layout_json, widgets_json FROM app_dashboards WHERE app_id = ? AND status = 'published' ORDER BY created_at DESC"
    ).all(row.id);
    // 列出公开报表
    const reports = await db.prepare(
      "SELECT id, name, dataset_id, layout_json FROM app_reports WHERE app_id = ? AND status = 'published' ORDER BY created_at DESC"
    ).all(row.id);
    res.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        icon: row.icon,
        app_slug: row.app_slug,
        published_url: row.published_url,
        published_version: row.published_version,
        published_at: row.published_at,
        config,
        forms: forms.map((f) => ({
          id: f.id,
          name: f.name,
          schema: safeJSON(f.schema_json, {}),
          version: f.version,
        })),
        dashboards: dashboards.map((d) => ({
          id: d.id,
          name: d.name,
          layout: safeJSON(d.layout_json, {}),
          widgets: safeJSON(d.widgets_json, []),
        })),
        reports: reports.map((r) => ({
          id: r.id,
          name: r.name,
          dataset_id: r.dataset_id,
          layout: safeJSON(r.layout_json, {}),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err?.message ?? err) });
  }
});

export default router;
