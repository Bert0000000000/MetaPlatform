/**
 * /api/apps/:id/dashboards — 应用级仪表盘持久化
 *
 *  Mounted from apps.js:
 *    router.use("/:id/dashboards", appDashboardsRoutes)
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

const ALLOWED_STATUS = ["draft", "published", "archived"];

function rowToDto(row) {
  if (!row) return row;
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    layout: safeJSON(row.layout_json, {}),
    widgets: safeJSON(row.widgets_json, []),
    status: row.status || "draft",
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list dashboards for an app ───────────────────
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_dashboards WHERE app_id = ? ORDER BY updated_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) { next(err); }
});

// ─── POST / — create a new dashboard ──────────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, layout, widgets, status } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }
    const layoutJson = layout == null ? null : (typeof layout === "string" ? layout : JSON.stringify(layout));
    const widgetsJson = widgets == null ? null : (typeof widgets === "string" ? widgets : JSON.stringify(widgets));
    const safeStatus = ALLOWED_STATUS.includes(status) ? status : "draft";

    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO app_dashboards (id, app_id, name, layout_json, widgets_json, status, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      name.trim(),
      layoutJson,
      widgetsJson,
      safeStatus,
      req.user?.id || null,
      req.user?.id || null,
      now,
      now,
    );

    const row = await db.prepare("SELECT * FROM app_dashboards WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── GET /:dashboardId — single dashboard ─────────────────
router.get("/:dashboardId", async (req, res, next) => {
  try {
    const row = await db.prepare(
      "SELECT * FROM app_dashboards WHERE id = ? AND app_id = ?"
    ).get(req.params.dashboardId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "仪表盘不存在" });
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:dashboardId — update dashboard ─────────────────
router.put("/:dashboardId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_dashboards WHERE id = ? AND app_id = ?"
    ).get(req.params.dashboardId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "仪表盘不存在" });

    const { name, layout, widgets, status } = req.body || {};
    const nextLayoutJson =
      layout === undefined
        ? existing.layout_json
        : (layout == null ? null : (typeof layout === "string" ? layout : JSON.stringify(layout)));
    const nextWidgetsJson =
      widgets === undefined
        ? existing.widgets_json
        : (widgets == null ? null : (typeof widgets === "string" ? widgets : JSON.stringify(widgets)));
    const nextStatus = status && ALLOWED_STATUS.includes(status) ? status : (existing.status || "draft");

    const now = nowISO();
    await db.prepare(
      `UPDATE app_dashboards
       SET name = ?, layout_json = ?, widgets_json = ?, status = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name != null ? String(name).trim() : existing.name,
      nextLayoutJson,
      nextWidgetsJson,
      nextStatus,
      now,
      req.user?.id || null,
      req.params.dashboardId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_dashboards WHERE id = ?").get(req.params.dashboardId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── POST /:dashboardId/widgets/data — 批量取 widget 数据 ───
//   body: { widgets: [{id, datasetId, type, ...}] } 或 空时使用 dashboard.widgets
//   返回: { widgets: [{ widgetId, status, rows, error?, took }] }
router.post("/:dashboardId/widgets/data", async (req, res, next) => {
  try {
    const dashboard = await db.prepare(
      "SELECT * FROM app_dashboards WHERE id = ? AND app_id = ?"
    ).get(req.params.dashboardId, req.params.id);
    if (!dashboard) return res.status(404).json({ success: false, error: "仪表盘不存在" });

    let widgetsList = Array.isArray(req.body?.widgets) ? req.body.widgets : null;
    if (!widgetsList) {
      widgetsList = safeJSON(dashboard.widgets_json, []);
    }

    const out = [];
    for (const widget of widgetsList) {
      const widgetId = widget.id || widget.widgetId || widget._id;
      const dsId = widget.datasetId || widget.dataset_id;
      const startedAt = new Date().toISOString();
      const t0 = Date.now();
      try {
        if (!dsId) {
          out.push({
            widgetId, status: "skipped",
            note: "widget 未绑定 dataset",
            took: Date.now() - t0,
          });
          continue;
        }
        const dataset = await db.prepare(
          "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
        ).get(dsId, req.params.id);
        if (!dataset) {
          out.push({ widgetId, status: "failed", error: "dataset 不存在", took: Date.now() - t0 });
          continue;
        }
        // 复用共享 dataset → rows 实现 (与 app-reports.run 同步)
        let rows = [];
        try {
          const allRows = await runDataset(dataset, req.params.id, 200);
          rows = Array.isArray(allRows) ? allRows : [];
        } catch (e) {
          rows = [];
        }
        const runId = uuid();
        await db.prepare(
          `INSERT INTO report_runs (id, app_id, dashboard_id, widget_id, dataset_id, status, row_count, rows_json, started_at, finished_at)
           VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?)`
        ).run(
          runId, req.params.id, dashboard.id, widgetId || null, dataset.id,
          rows.length, JSON.stringify(rows.slice(0, 200)), startedAt, new Date().toISOString(),
        );
        out.push({
          widgetId, status: "success", rows,
          rowCount: rows.length, took: Date.now() - t0, runId,
        });
      } catch (err2) {
        out.push({
          widgetId, status: "failed",
          error: String(err2?.message ?? err2),
          took: Date.now() - t0,
        });
      }
    }
    res.json({ success: true, data: { widgets: out } });
  } catch (err) { next(err); }
});

// ─── DELETE /:dashboardId — delete dashboard ──────────────
router.delete("/:dashboardId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_dashboards WHERE id = ? AND app_id = ?"
    ).run(req.params.dashboardId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "仪表盘不存在" });
    }
    res.json({ success: true, data: { id: req.params.dashboardId } });
  } catch (err) { next(err); }
});

export default router;