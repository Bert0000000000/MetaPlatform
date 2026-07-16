import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/triggers
router.get("/", async (_req, res) => {
  const rows = await db.prepare("SELECT * FROM process_triggers ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /api/triggers
router.post("/", async (req, res) => {
  const { process_id, name, type = "timer", config } = req.body;
  const id = uuidv4();
  await db.prepare(
    "INSERT INTO process_triggers (id, process_id, name, type, config) VALUES (?, ?, ?, ?, ?)",
  ).run(id, process_id, name, type, config);
  res.json({ success: true, data: { id, name } });
});

// PUT /api/triggers/:id
router.put("/:id", async (req, res) => {
  const existing = await db.prepare("SELECT * FROM process_triggers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "触发器不存在" });
  const { name, event_type, action_type, config, enabled } = req.body;
  await db.prepare(
    `UPDATE process_triggers SET name = ?, event_type = ?, type = ?, config = ?, enabled = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    event_type !== undefined ? event_type : existing.event_type,
    action_type ?? existing.type,
    config !== undefined ? config : existing.config,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    req.params.id
  );
  const row = await db.prepare("SELECT * FROM process_triggers WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// DELETE /api/triggers/:id
router.delete("/:id", async (req, res) => {
  await db.prepare("DELETE FROM process_triggers WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
