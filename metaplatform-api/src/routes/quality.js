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

// POST /api/quality/test-cases/:id/run — Simulate test execution
// Sets status to "running", then after a delay resolves to "passed" or "failed"
router.post("/test-cases/:id/run", (req, res) => {
  const testCase = db.prepare("SELECT * FROM test_cases WHERE id = ?").get(req.params.id);
  if (!testCase) {
    return res.status(404).json({ success: false, error: "Test case not found" });
  }

  // Set status to "running"
  db.prepare(
    "UPDATE test_cases SET status = 'running', result = NULL, updated_at = datetime('now') WHERE id = ?",
  ).run(req.params.id);

  // Simulate test execution with a brief delay (1-2 seconds based on test type)
  const delay = testCase.type === "performance" ? 2000 : testCase.type === "integration" ? 1500 : 1000;

  setTimeout(() => {
    // Determine result: P0 + UI tests have higher chance of failure, otherwise pass
    const isP0 = testCase.priority === "high";
    const isUI = testCase.type === "functional" && testCase.name && testCase.name.toLowerCase().includes("ui");
    const result = (isP0 && isUI) ? "failed" : "passed";
    const duration = delay + Math.floor(Math.random() * 500);

    db.prepare(
      "UPDATE test_cases SET status = 'completed', result = ?, duration = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(result, duration, req.params.id);

    // Return the updated test case
    const updated = db.prepare("SELECT * FROM test_cases WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: updated });
  }, delay);
});

// PUT /api/quality/cases/:id
router.put("/cases/:id", (req, res) => {
  const testCase = db.prepare("SELECT * FROM test_cases WHERE id = ?").get(req.params.id);
  if (!testCase) {
    return res.status(404).json({ success: false, message: "Test case not found" });
  }
  const { status, result, notes } = req.body;
  db.prepare(
    "UPDATE test_cases SET status = ?, result = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(
    status ?? testCase.status,
    result ?? testCase.result,
    notes ?? testCase.notes,
    req.params.id,
  );
  res.json({ success: true, data: { id: req.params.id } });
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
  const bug = db.prepare("SELECT * FROM bugs WHERE id = ?").get(req.params.id);
  if (!bug) {
    return res.status(404).json({ success: false, message: "Bug not found" });
  }
  const { status, severity, assignee, notes } = req.body;
  const updates = [];
  const params = [];
  if (status !== undefined) {
    updates.push("status = ?");
    params.push(status);
  }
  if (severity !== undefined) {
    updates.push("severity = ?");
    params.push(severity);
  }
  if (assignee !== undefined) {
    updates.push("assignee = ?");
    params.push(assignee);
  }
  if (notes !== undefined) {
    updates.push("notes = ?");
    params.push(notes);
  }
  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: "No fields to update" });
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE bugs SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/quality/bugs/:id
router.delete("/bugs/:id", (req, res) => {
  const bug = db.prepare("SELECT * FROM bugs WHERE id = ?").get(req.params.id);
  if (!bug) {
    return res.status(404).json({ success: false, message: "Bug not found" });
  }
  db.prepare("DELETE FROM bugs WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
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

// GET / — quality module overview
router.get("/", (req, res) => {
  try {
    const cases = db.prepare("SELECT COUNT(*) AS cnt FROM test_cases").get().cnt;
    const bugs = db.prepare("SELECT COUNT(*) AS cnt FROM bugs").get().cnt;
    res.json({ success: true, data: { cases, bugs } });
  } catch (err) {
    res.json({ success: true, data: { cases: 0, bugs: 0 } });
  }
});

export default router;
