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

// ════════════════════════════════════════════════════════
//  Developers
// ════════════════════════════════════════════════════════

// GET /developers — list developers
router.get("/developers", (_req, res) => {
  const rows = db.prepare("SELECT * FROM market_developers ORDER BY rank_num ASC").all();
  res.json({ success: true, data: rows });
});

// ════════════════════════════════════════════════════════
//  Skills
// ════════════════════════════════════════════════════════

// GET /skills — list skills
router.get("/skills", (_req, res) => {
  const rows = db.prepare("SELECT * FROM market_skills ORDER BY installs DESC").all();
  res.json({ success: true, data: rows });
});

// POST /skills — create skill
router.post("/skills", (req, res) => {
  const { name, author, desc, category, installs, rating } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
  const result = db.prepare(
    'INSERT INTO market_skills (name, author, "desc", category, installs, rating) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, author || null, desc || null, category || null, installs ?? 0, rating ?? 0);
  const row = db.prepare("SELECT * FROM market_skills WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// ════════════════════════════════════════════════════════
//  Workflow Templates
// ════════════════════════════════════════════════════════

// GET /workflow-templates — list workflow templates
router.get("/workflow-templates", (_req, res) => {
  const rows = db.prepare("SELECT * FROM market_workflow_templates ORDER BY installs DESC").all();
  res.json({ success: true, data: rows });
});

// POST /workflow-templates — create workflow template
router.post("/workflow-templates", (req, res) => {
  const { name, category, nodes, installs, rating } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
  const result = db.prepare(
    "INSERT INTO market_workflow_templates (name, category, nodes, installs, rating) VALUES (?, ?, ?, ?, ?)"
  ).run(name, category || null, nodes ?? 0, installs ?? 0, rating ?? 0);
  const row = db.prepare("SELECT * FROM market_workflow_templates WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// ════════════════════════════════════════════════════════
//  Knowledge Packages
// ════════════════════════════════════════════════════════

// GET /knowledge-packages — list knowledge packages
router.get("/knowledge-packages", (_req, res) => {
  const rows = db.prepare("SELECT * FROM market_knowledge_packages ORDER BY subscribers DESC").all();
  res.json({ success: true, data: rows });
});

// POST /knowledge-packages — create knowledge package
router.post("/knowledge-packages", (req, res) => {
  const { name, docs, author, category, subscribers, rating } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
  const result = db.prepare(
    "INSERT INTO market_knowledge_packages (name, docs, author, category, subscribers, rating) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, docs ?? 0, author || null, category || null, subscribers ?? 0, rating ?? 0);
  const row = db.prepare("SELECT * FROM market_knowledge_packages WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// ════════════════════════════════════════════════════════
//  API Library
// ════════════════════════════════════════════════════════

// GET /api-library — list API library
router.get("/api-library", (_req, res) => {
  const rows = db.prepare("SELECT * FROM market_api_library ORDER BY calls DESC").all();
  res.json({ success: true, data: rows });
});

// POST /api-library — create API library entry
router.post("/api-library", (req, res) => {
  const { name, category, endpoints, version, calls } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
  const result = db.prepare(
    "INSERT INTO market_api_library (name, category, endpoints, version, calls) VALUES (?, ?, ?, ?, ?)"
  ).run(name, category || null, endpoints ?? 0, version || "1.0", calls ?? 0);
  const row = db.prepare("SELECT * FROM market_api_library WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
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
