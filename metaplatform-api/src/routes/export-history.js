/**
 * /api/export-history — Export history CRUD
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const router = Router();

// GET / — list export history records
router.get("/", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM export_history ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST / — create export history record
router.post("/", async (req, res, next) => {
  try {
    const { app_id, type, format, status, file_path } = req.body;
    const id = uuidv4();
    await db.prepare(
      "INSERT INTO export_history (id, app_id, type, format, status, file_path) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, app_id, type, format, status || "completed", file_path);
    res.json({ success: true, data: { id, app_id, type, format, status: status || "completed", file_path } });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete export history record
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM export_history WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "记录不存在" });
    await db.prepare("DELETE FROM export_history WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
