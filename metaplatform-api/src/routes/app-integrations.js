/**
 * /api/apps/:id/integrations — 应用级集成 (webhook / SSO / IM) 持久化
 *
 *  Mounted from apps.js:
 *    router.use("/:id/integrations", appIntegrationsRoutes)
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
    type: row.type,
    platform: row.platform,
    name: row.name,
    config: safeJSON(row.config_json, {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ALLOWED_TYPES = ["webhook", "sso", "im"];
const ALLOWED_STATUS = ["active", "disabled"];

async function assertApp(appId) {
  return await db.prepare("SELECT id FROM applications WHERE id = ?").get(appId);
}

// ─── GET / — list integrations for an app ──────────────────
router.get("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const rows = await db.prepare(
      "SELECT * FROM app_integrations WHERE app_id = ? ORDER BY created_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows.map(rowToDto) });
  } catch (err) { next(err); }
});

// ─── POST / — create a new integration ────────────────────
router.post("/", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { type, platform, name, config, status } = req.body || {};
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: `type 必须为 ${ALLOWED_TYPES.join("/")} 之一` });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }
    const safeStatus = ALLOWED_STATUS.includes(status) ? status : "active";

    const id = uuid();
    const now = nowISO();
    const configJson = config == null ? null : (typeof config === "string" ? config : JSON.stringify(config));

    await db.prepare(
      `INSERT INTO app_integrations (id, app_id, type, platform, name, config_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, type, platform || null, name.trim(), configJson, safeStatus, now, now);

    const row = await db.prepare("SELECT * FROM app_integrations WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── PUT /:integrationId — update integration ─────────────
router.put("/:integrationId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_integrations WHERE id = ? AND app_id = ?"
    ).get(req.params.integrationId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "集成不存在" });

    const { type, platform, name, config, status } = req.body || {};
    const nextType = type && ALLOWED_TYPES.includes(type) ? type : existing.type;
    const nextStatus = status && ALLOWED_STATUS.includes(status) ? status : existing.status;
    const nextConfigJson =
      config === undefined
        ? existing.config_json
        : (config == null ? null : (typeof config === "string" ? config : JSON.stringify(config)));

    const now = nowISO();
    await db.prepare(
      `UPDATE app_integrations
       SET type = ?, platform = ?, name = ?, config_json = ?, status = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      nextType,
      platform !== undefined ? (platform || null) : existing.platform,
      name != null ? String(name).trim() : existing.name,
      nextConfigJson,
      nextStatus,
      now,
      req.params.integrationId,
      req.params.id,
    );

    const row = await db.prepare("SELECT * FROM app_integrations WHERE id = ?").get(req.params.integrationId);
    res.json({ success: true, data: rowToDto(row) });
  } catch (err) { next(err); }
});

// ─── DELETE /:integrationId — delete integration ──────────
router.delete("/:integrationId", async (req, res, next) => {
  try {
    const app = await assertApp(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_integrations WHERE id = ? AND app_id = ?"
    ).run(req.params.integrationId, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "集成不存在" });
    }
    res.json({ success: true, data: { id: req.params.integrationId } });
  } catch (err) { next(err); }
});

export default router;