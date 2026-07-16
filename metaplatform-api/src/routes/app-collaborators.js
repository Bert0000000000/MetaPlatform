/* ─── app_collaborators — 多用户协作 ─── */
import { Router } from "express";
import db from "../db.js";
import { v4 as uuid } from "uuid";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT * FROM app_collaborators WHERE app_id = ? ORDER BY created_at ASC"
    ).all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    // 表不存在时返回空数组而不是 500
    if (/no such table/i.test(String(err?.message))) return res.json({ success: true, data: [] });
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { userEmail, userName, role = "editor" } = req.body || {};
    if (!userEmail || typeof userEmail !== "string") {
      return res.status(400).json({ success: false, error: "userEmail 必填" });
    }
    const validRoles = new Set(["owner", "editor", "viewer"]);
    if (!validRoles.has(role)) {
      return res.status(400).json({ success: false, error: "role 必须是 owner / editor / viewer" });
    }
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO app_collaborators (id, app_id, user_email, user_name, role, invited_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.params.id,
      userEmail.trim().toLowerCase(),
      (userName && String(userName).trim()) || userEmail,
      role,
      req.user?.id || null,
      now,
    );
    const row = await db.prepare("SELECT * FROM app_collaborators WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (String(err?.message).includes("UNIQUE") || String(err?.message).includes("duplicate")) {
      return res.status(409).json({ success: false, error: "该用户已是本应用协作者" });
    }
    next(err);
  }
});

router.put("/:collabId", async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const validRoles = new Set(["owner", "editor", "viewer"]);
    if (!validRoles.has(String(role))) {
      return res.status(400).json({ success: false, error: "role 必须是 owner / editor / viewer" });
    }
    await db.prepare("UPDATE app_collaborators SET role = ? WHERE id = ? AND app_id = ?")
      .run(String(role), req.params.collabId, req.params.id);
    const row = await db.prepare("SELECT * FROM app_collaborators WHERE id = ?").get(req.params.collabId);
    if (!row) return res.status(404).json({ success: false, error: "协作者不存在" });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.delete("/:collabId", async (req, res, next) => {
  try {
    await db.prepare("DELETE FROM app_collaborators WHERE id = ? AND app_id = ?")
      .run(req.params.collabId, req.params.id);
    res.json({ success: true, data: { id: req.params.collabId } });
  } catch (err) { next(err); }
});

export default router;
