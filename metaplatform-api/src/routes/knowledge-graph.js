/**
 * /api/knowledge/graph — Knowledge Graph nodes & edges
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../db.js";

const router = Router();

// ════════════════════════════════════════════════════════
//  Graph Nodes
// ════════════════════════════════════════════════════════

// GET /nodes — list all nodes
router.get("/nodes", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM knowledge_graph_nodes ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /nodes — create node
router.post("/nodes", (req, res, next) => {
  try {
    const { name, type, description, metadata } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_graph_nodes (id, name, type, description, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, type || "concept", description || null, metadata ? JSON.stringify(metadata) : null, now);
    const row = db.prepare("SELECT * FROM knowledge_graph_nodes WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Graph Edges
// ════════════════════════════════════════════════════════

// GET /edges — list all edges
router.get("/edges", (_req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM knowledge_graph_edges ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /edges — create edge
router.post("/edges", (req, res, next) => {
  try {
    const { source_id, target_id, relation_type, description } = req.body;
    if (!source_id || !target_id) return res.status(400).json({ success: false, error: "source_id, target_id 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_graph_edges (id, source_id, target_id, relation_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, source_id, target_id, relation_type || "related", description || null, now);
    const row = db.prepare("SELECT * FROM knowledge_graph_edges WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

export default router;
