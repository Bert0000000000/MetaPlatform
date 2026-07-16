/**
 * /api/tenants — 租户 CRUD
 *
 * 不与 /apps/:id 嵌套, 因为租户是平台级共享资源 (灰度发布, 多租户运维).
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT * FROM tenants ORDER BY created_at ASC"
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, code, plan, status, description } = req.body || {};
    if (!name || !code) return res.status(400).json({ success: false, error: "name 与 code 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO tenants (id, name, code, plan, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, code, plan || "free", status || "active", description || null, now, now);
    const row = await db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, plan, status, description } = req.body || {};
    const now = new Date().toISOString();
    const result = await db.prepare(
      `UPDATE tenants SET
         name = COALESCE(?, name),
         plan = COALESCE(?, plan),
         status = COALESCE(?, status),
         description = COALESCE(?, description),
         updated_at = ?
       WHERE id = ?`
    ).run(name, plan, status, description, now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: "租户不存在" });
    const row = await db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await db.prepare("DELETE FROM tenants WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: "租户不存在" });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
