import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/versions/app/:appId
router.get("/app/:appId", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM app_versions WHERE app_id = ? ORDER BY created_at DESC")
    .all(req.params.appId);
  res.json({ success: true, data: rows });
});

// POST /api/versions
router.post("/", (req, res) => {
  const { app_id, version, description, status = "draft" } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO app_versions (id, app_id, version, description, status) VALUES (?, ?, ?, ?, ?)",
  ).run(id, app_id, version, description, status);
  res.json({ success: true, data: { id, version } });
});

export default router;
