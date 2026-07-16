import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/versions/app/:appId
router.get("/app/:appId", async (req, res) => {
  const rows = db
    .prepare("SELECT * FROM app_versions WHERE app_id = ? ORDER BY created_at DESC")
    .all(req.params.appId);
  res.json({ success: true, data: rows });
});

// POST /api/versions
router.post("/", async (req, res) => {
  const { app_id, version, description, status = "draft" } = req.body;
  const id = uuidv4();
  await db.prepare(
    "INSERT INTO app_versions (id, app_id, version, description, status) VALUES (?, ?, ?, ?, ?)",
  ).run(id, app_id, version, description, status);
  res.json({ success: true, data: { id, version } });
});

// PUT /api/versions/:id
router.put("/:id", async (req, res) => {
  const appVersion = await db.prepare("SELECT * FROM app_versions WHERE id = ?").get(req.params.id);
  if (!appVersion) {
    return res.status(404).json({ success: false, message: "Version not found" });
  }
  const { description } = req.body;
  await db.prepare(
    "UPDATE app_versions SET description = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(description ?? appVersion.description, req.params.id);
  res.json({ success: true, data: { id: req.params.id, description: description ?? appVersion.description } });
});

// DELETE /api/versions/:id
router.delete("/:id", async (req, res) => {
  const appVersion = await db.prepare("SELECT * FROM app_versions WHERE id = ?").get(req.params.id);
  if (!appVersion) {
    return res.status(404).json({ success: false, message: "Version not found" });
  }
  if (appVersion.status !== "draft") {
    return res.status(400).json({ success: false, message: "Only draft versions can be deleted" });
  }
  await db.prepare("DELETE FROM app_versions WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

export default router;
