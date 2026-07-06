import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ─── Test Cases ──────────────────────────────────────────

// GET /api/quality/cases
router.get("/cases", (_req, res) => {
  const rows = db.prepare("SELECT * FROM test_cases ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /api/quality/cases
router.post("/cases", (req, res) => {
  const { name, module, type, priority, steps, expected } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO test_cases (id, name, module, type, priority, steps, expected) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, name, module, type, priority, steps, expected);
  res.json({ success: true, data: { id, name } });
});

// PUT /api/quality/cases/:id/run
router.put("/cases/:id/run", (req, res) => {
  const { result, duration } = req.body;
  db.prepare(
    "UPDATE test_cases SET status = ?, result = ?, duration = ?, updated_at = datetime('now') WHERE id = ?",
  ).run("completed", result, duration, req.params.id);
  res.json({ success: true });
});

// ─── Bugs ────────────────────────────────────────────────

// GET /api/quality/bugs
router.get("/bugs", (_req, res) => {
  const rows = db.prepare("SELECT * FROM bugs ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /api/quality/bugs
router.post("/bugs", (req, res) => {
  const { title, description, severity, assignee, module, steps_to_reproduce } = req.body;
  const id = uuidv4();
  db.prepare(
    "INSERT INTO bugs (id, title, description, severity, assignee, module, steps_to_reproduce) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, title, description, severity, assignee, module, steps_to_reproduce);
  res.json({ success: true, data: { id, title } });
});

// PUT /api/quality/bugs/:id
router.put("/bugs/:id", (req, res) => {
  const { status, severity, assignee } = req.body;
  const updates = [];
  const params = [];
  if (status) {
    updates.push("status = ?");
    params.push(status);
  }
  if (severity) {
    updates.push("severity = ?");
    params.push(severity);
  }
  if (assignee) {
    updates.push("assignee = ?");
    params.push(assignee);
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE bugs SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

// GET /api/quality/stats
router.get("/stats", (_req, res) => {
  const totalCases = db.prepare("SELECT COUNT(*) as count FROM test_cases").get().count;
  const passedCases = db.prepare("SELECT COUNT(*) as count FROM test_cases WHERE result = 'passed'").get().count;
  const failedCases = db.prepare("SELECT COUNT(*) as count FROM test_cases WHERE result = 'failed'").get().count;
  const totalBugs = db.prepare("SELECT COUNT(*) as count FROM bugs").get().count;
  const openBugs = db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'open'").get().count;

  res.json({
    success: true,
    data: {
      totalCases,
      passedCases,
      failedCases,
      passRate: totalCases > 0 ? ((passedCases / totalCases) * 100).toFixed(1) : "0",
      totalBugs,
      openBugs,
    },
  });
});

export default router;
