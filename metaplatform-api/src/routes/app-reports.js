/**
 * /api/apps/:id/reports — 应用级报表设计器持久化
 *
 *  Mounted from apps.js:
 *    router.use("/:id/reports", appReportsRoutes)
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

function rowToDto(row) {
  if (!row) return row;
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    datasetId: row.dataset_id,
    layout: safeJSON(row.layout_json, {}),
    schedule: safeJSON(row.schedule_json, {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ALLOWED_STATUS = ["draft", "published", "archived"];

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list reports for an app ──────────────────────
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_reports WHERE app_id = ? ORDER BY updated_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) { next(err); }
});

// ─── POST / — create a new report ─────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, datasetId, layout, schedule, status } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }
    const safeStatus = ALLOWED_STATUS.includes(status) ? status : "draft";
    const layoutJson = layout == null ? null : (typeof layout === "string" ? layout : JSON.stringify(layout));
    const scheduleJson = schedule == null ? null : (typeof schedule === "string" ? schedule : JSON.stringify(schedule));

    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO app_reports (id, app_id, name, dataset_id, layout_json, schedule_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, name.trim(), datasetId || null, layoutJson, scheduleJson, safeStatus, now, now);

    const row = await db.prepare("SELECT * FROM app_reports WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:reportId — update report ───────────────────────
router.put("/:reportId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_reports WHERE id = ? AND app_id = ?"
    ).get(req.params.reportId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "报表不存在" });

    const { name, datasetId, layout, schedule, status } = req.body || {};
    const nextStatus = status && ALLOWED_STATUS.includes(status) ? status : existing.status;
    const nextLayoutJson =
      layout === undefined
        ? existing.layout_json
        : (layout == null ? null : (typeof layout === "string" ? layout : JSON.stringify(layout)));
    const nextScheduleJson =
      schedule === undefined
        ? existing.schedule_json
        : (schedule == null ? null : (typeof schedule === "string" ? schedule : JSON.stringify(schedule)));

    const now = nowISO();
    await db.prepare(
      `UPDATE app_reports
       SET name = ?, dataset_id = ?, layout_json = ?, schedule_json = ?, status = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name != null ? String(name).trim() : existing.name,
      datasetId !== undefined ? (datasetId || null) : existing.dataset_id,
      nextLayoutJson,
      nextScheduleJson,
      nextStatus,
      now,
      req.params.reportId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_reports WHERE id = ?").get(req.params.reportId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── GET /:reportId — single report ───────────────────────
router.get("/:reportId", async (req, res, next) => {
  try {
    const row = await db.prepare(
      "SELECT * FROM app_reports WHERE id = ? AND app_id = ?"
    ).get(req.params.reportId, req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "报表不存在" });
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── POST /:reportId/run — 执行报表, 返回 dataset rows ───
//   这是一个数据集中地; 实际数据查询 / SQL 在 app-datasets.js 处理.
//   本路由仅: 1) 校验 datasetId 存在; 2) 转发到 dataset.run; 3) 写 report_runs; 4) 返回 rows.
router.post("/:reportId/run", async (req, res, next) => {
  try {
    const report = await db.prepare(
      "SELECT * FROM app_reports WHERE id = ? AND app_id = ?"
    ).get(req.params.reportId, req.params.id);
    if (!report) return res.status(404).json({ success: false, error: "报表不存在" });
    if (!report.dataset_id) {
      return res.status(400).json({ success: false, error: "报表未绑定数据集" });
    }

    // 校验 dataset 是否在同一应用下
    const dataset = await db.prepare(
      "SELECT * FROM app_datasets WHERE id = ? AND app_id = ?"
    ).get(report.dataset_id, req.params.id);
    if (!dataset) {
      return res.status(400).json({ success: false, error: "数据集不存在或不在本应用下" });
    }

    // 通过 appDatasetsRoutes 暴露的 alias handler 没法直接复用, 这里再次拼 query path:
    // 简单实现: 直接执行 dataset 的 ontology_object / form / sql 路径.
    const params = req.body && typeof req.body === "object" ? req.body : {};
    const limit = Math.min(Math.max(Number(params.limit || 200), 1), 2000);

    const runId = uuid();
    const startTime = Date.now();
    let rows = [];
    let rowCount = 0;
    let status = "success";
    let error = null;

    try {
      // 由 dataset.source_type 决定实际取数 — 经共享 _shared/runDataset.js
      rows = await runDataset(dataset, req.params.id, limit);
      rowCount = Array.isArray(rows) ? rows.length : 0;

      // 截取预览快照 (限 200 行)
      const previewRows = rows.slice(0, 200);
      await db.prepare(
        `INSERT INTO report_runs (id, app_id, report_id, dataset_id, status, row_count, rows_json, started_at, finished_at)
         VALUES (?, ?, ?, ?, 'success', ?, ?, ?, ?)`
      ).run(
        runId,
        req.params.id,
        report.id,
        dataset.id,
        rowCount,
        JSON.stringify(previewRows),
        new Date(startTime).toISOString(),
        new Date().toISOString(),
      );
    } catch (err2) {
      status = "failed";
      error = String(err2?.message ?? err2);
      await db.prepare(
        `INSERT INTO report_runs (id, app_id, report_id, dataset_id, status, error, started_at, finished_at)
         VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)`
      ).run(
        runId,
        req.params.id,
        report.id,
        dataset.id,
        error,
        new Date(startTime).toISOString(),
        new Date().toISOString(),
      );
    }

    if (status === "failed") {
      return res.status(500).json({ success: false, error });
    }
    res.json({
      success: true,
      data: {
        runId,
        rowCount,
        rows,
        datasetId: dataset.id,
        took: Date.now() - startTime,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /:reportId/runs — list recent runs ───────────────
router.get("/:reportId/runs", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const rows = await db.prepare(
      "SELECT id, app_id, dataset_id, status, error, row_count, started_at, finished_at FROM report_runs WHERE report_id = ? AND app_id = ? ORDER BY started_at DESC LIMIT ?"
    ).all(req.params.reportId, req.params.id, limit);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * 由 dataset 配置拉行 — 实现已迁移到 _shared/runDataset.js.
 * 这是个 thin wrapper 维持向后兼容 (params 已被 caller 接管).
 */
async function runDatasetForReport(dataset, params) {
  return await runDataset(dataset, dataset.app_id, params.limit);
}

// ─── DELETE /:reportId — delete report ────────────────────
router.delete("/:reportId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_reports WHERE id = ? AND app_id = ?"
    ).run(req.params.reportId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "报表不存在" });
    }
    try { await db.prepare("DELETE FROM report_runs WHERE report_id = ?").run(req.params.reportId); } catch (e) { /* 表可能不存在 */ }
    res.json({ success: true, data: { id: req.params.reportId } });
  } catch (err) { next(err); }
});

export default router;