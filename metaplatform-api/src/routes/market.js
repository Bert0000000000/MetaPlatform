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

// POST /api/market/templates/:id/install
router.post("/templates/:id/install", (req, res) => {
  db.prepare(
    "UPDATE market_templates SET downloads = downloads + 1 WHERE id = ?",
  ).run(req.params.id);
  res.json({ success: true, data: { message: "Template installed" } });
});

export default router;
