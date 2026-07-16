/**
 * /api/apps/:id/page-components — 页面编辑器组件级持久化
 *
 *  Mounted from apps.js:
 *    router.use("/:id/page-components", appPageComponentsRoutes)
 *
 *  `mergeParams: true` 让嵌套路由拿到父路由的 `req.params.id` (即 app id).
 *
 *  说明: page_id 仅作为软关联 (允许跨页面组件复用), 不强制外键到 app_pages.
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
    pageId: row.page_id,
    componentKey: row.component_key,
    props: safeJSON(row.props_json, {}),
    x: row.x ?? 0,
    y: row.y ?? 0,
    w: row.w ?? 0,
    h: row.h ?? 0,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list page components for an app ─────────────
//
//  支持 ?pageId=xxx 过滤 (前端按当前页面筛选). 不传 pageId 时返回 app
//  下所有组件.
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { pageId } = req.query;
    let rows;
    if (pageId) {
      rows = await db.prepare(
        "SELECT * FROM app_page_components WHERE app_id = ? AND page_id = ? ORDER BY sort_order ASC, created_at ASC"
      ).all(req.params.id, pageId);
    } else {
      rows = await db.prepare(
        "SELECT * FROM app_page_components WHERE app_id = ? ORDER BY page_id ASC, sort_order ASC, created_at ASC"
      ).all(req.params.id);
    }
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) { next(err); }
});

// ─── POST / — create a new page component ─────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { pageId, componentKey, props, x, y, w, h, sortOrder } = req.body || {};
    if (!componentKey || typeof componentKey !== "string" || !componentKey.trim()) {
      return res.status(400).json({ success: false, error: "componentKey 为必填项" });
    }
    const propsJson = props == null ? null : (typeof props === "string" ? props : JSON.stringify(props));

    const id = uuid();
    const now = nowISO();
    await db.prepare(
      `INSERT INTO app_page_components
         (id, app_id, page_id, component_key, props_json, x, y, w, h, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      pageId || null,
      componentKey.trim(),
      propsJson,
      Number.isFinite(+x) ? +x : 0,
      Number.isFinite(+y) ? +y : 0,
      Number.isFinite(+w) ? +w : 0,
      Number.isFinite(+h) ? +h : 0,
      Number.isFinite(+sortOrder) ? +sortOrder : 0,
      now, now,
    );

    const row = await db.prepare("SELECT * FROM app_page_components WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:componentId — update page component ────────────
router.put("/:componentId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_page_components WHERE id = ? AND app_id = ?"
    ).get(req.params.componentId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "组件不存在" });

    const { pageId, componentKey, props, x, y, w, h, sortOrder } = req.body || {};
    const nextPropsJson =
      props === undefined
        ? existing.props_json
        : (props == null ? null : (typeof props === "string" ? props : JSON.stringify(props)));

    const now = nowISO();
    await db.prepare(
      `UPDATE app_page_components
       SET page_id = ?, component_key = ?, props_json = ?,
           x = ?, y = ?, w = ?, h = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      pageId !== undefined ? (pageId || null) : existing.page_id,
      componentKey != null ? String(componentKey).trim() : existing.component_key,
      nextPropsJson,
      x !== undefined && Number.isFinite(+x) ? +x : existing.x,
      y !== undefined && Number.isFinite(+y) ? +y : existing.y,
      w !== undefined && Number.isFinite(+w) ? +w : existing.w,
      h !== undefined && Number.isFinite(+h) ? +h : existing.h,
      sortOrder !== undefined && Number.isFinite(+sortOrder) ? +sortOrder : existing.sort_order,
      now,
      req.params.componentId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_page_components WHERE id = ?").get(req.params.componentId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── DELETE /:componentId — delete page component ─────────
router.delete("/:componentId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_page_components WHERE id = ? AND app_id = ?"
    ).run(req.params.componentId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "组件不存在" });
    }
    res.json({ success: true, data: { id: req.params.componentId } });
  } catch (err) { next(err); }
});

export default router;