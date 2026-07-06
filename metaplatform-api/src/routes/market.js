import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// GET /api/market/templates
router.get("/templates", (req, res) => {
  const { category, limit = 20 } = req.query;
  let sql = "SELECT * FROM market_templates WHERE status = ?";
  const params = ["active"];
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  sql += " ORDER BY downloads DESC LIMIT ?";
  params.push(Number(limit));
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// POST /api/market/templates
router.post("/templates", (req, res) => {
  const { name, description, category, author, price = 0 } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO market_templates (id, name, description, category, author, price) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, name, description, category, author, price);
  res.json({ success: true, data: { id, name } });
});

// PUT /api/market/templates/:id
router.put("/templates/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM market_templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "模板不存在" });
  const { name, description, category, icon, config } = req.body;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE market_templates SET name = ?, description = ?, category = ?, icon = ?, config = ?, updated_at = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    description !== undefined ? description : existing.description,
    category ?? existing.category,
    icon !== undefined ? icon : existing.icon,
    config !== undefined ? config : existing.config,
    now,
    req.params.id
  );
  const row = db.prepare("SELECT * FROM market_templates WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// DELETE /api/market/templates/:id
router.delete("/templates/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM market_templates WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: "模板不存在" });
  db.prepare("DELETE FROM market_templates WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

// POST /api/market/templates/:id/install
router.post("/templates/:id/install", (req, res) => {
  db.prepare(
    "UPDATE market_templates SET downloads = downloads + 1 WHERE id = ?",
  ).run(req.params.id);
  res.json({ success: true, data: { message: "Template installed" } });
});

// GET / — marketplace overview
router.get("/", (req, res) => {
  try {
    const templates = db.prepare("SELECT COUNT(*) AS cnt FROM market_templates").get().cnt;
    res.json({ success: true, data: { templates } });
  } catch (err) {
    res.json({ success: true, data: { templates: 0 } });
  }
});

export default router;
