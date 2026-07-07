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
router.get("/nodes", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM knowledge_graph_nodes ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /nodes — create node
router.post("/nodes", async (req, res, next) => {
  try {
    const { name, type, description, metadata } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO knowledge_graph_nodes (id, name, type, description, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, type || "concept", description || null, metadata ? JSON.stringify(metadata) : null, now);
    const row = await db.prepare("SELECT * FROM knowledge_graph_nodes WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /nodes/:id — update node
router.put("/nodes/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_graph_nodes WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "节点不存在" });
    const { name, type, properties } = req.body;
    await db.prepare(
      `UPDATE knowledge_graph_nodes SET name = ?, type = ?, metadata = ? WHERE id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      properties !== undefined ? JSON.stringify(properties) : existing.metadata,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM knowledge_graph_nodes WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /nodes/:id — delete node and related edges
router.delete("/nodes/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_graph_nodes WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "节点不存在" });
    await db.prepare("DELETE FROM knowledge_graph_edges WHERE source_id = ? OR target_id = ?").run(req.params.id, req.params.id);
    await db.prepare("DELETE FROM knowledge_graph_nodes WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Graph Edges
// ════════════════════════════════════════════════════════

// GET /edges — list all edges
router.get("/edges", async (_req, res, next) => {
  try {
    const rows = await db.prepare("SELECT * FROM knowledge_graph_edges ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /edges — create edge
router.post("/edges", async (req, res, next) => {
  try {
    const { source_id, target_id, relation_type, description } = req.body;
    if (!source_id || !target_id) return res.status(400).json({ success: false, error: "source_id, target_id 为必填项" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO knowledge_graph_edges (id, source_id, target_id, relation_type, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, source_id, target_id, relation_type || "related", description || null, now);
    const row = await db.prepare("SELECT * FROM knowledge_graph_edges WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// PUT /edges/:id — update edge
router.put("/edges/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_graph_edges WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "边不存在" });
    const { relation_type, properties } = req.body;
    await db.prepare(
      `UPDATE knowledge_graph_edges SET relation_type = ?, description = ? WHERE id = ?`
    ).run(
      relation_type ?? existing.relation_type,
      properties !== undefined ? JSON.stringify(properties) : existing.description,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM knowledge_graph_edges WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /edges/:id — delete edge
router.delete("/edges/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM knowledge_graph_edges WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "边不存在" });
    await db.prepare("DELETE FROM knowledge_graph_edges WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// GET / — knowledge graph overview
router.get("/", async (req, res) => {
  try {
    const nodes = await db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_graph_nodes").get().cnt;
    const edges = await db.prepare("SELECT COUNT(*) AS cnt FROM knowledge_graph_edges").get().cnt;
    res.json({ success: true, data: { nodes, edges } });
  } catch (err) {
    res.json({ success: true, data: { nodes: 0, edges: 0 } });
  }
});

export default router;
