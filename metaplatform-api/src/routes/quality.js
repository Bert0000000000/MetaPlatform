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

// ─── Ontology Tests ──────────────────────────────────────

// GET /ontology-tests
router.get("/ontology-tests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM quality_ontology_tests ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /ontology-tests/:id/run — run ontology test
router.post("/ontology-tests/:id/run", (req, res) => {
  const test = db.prepare("SELECT * FROM quality_ontology_tests WHERE id = ?").get(req.params.id);
  if (!test) return res.status(404).json({ success: false, error: "测试不存在" });
  const now = new Date().toISOString();
  const passed = test.checks - Math.floor(Math.random() * 3);
  const failed = test.checks - passed;
  const status = failed === 0 ? "passed" : "failed";
  db.prepare(
    "UPDATE quality_ontology_tests SET passed = ?, failed = ?, status = ?, last_run = ? WHERE id = ?"
  ).run(passed, failed, status, now, req.params.id);
  const row = db.prepare("SELECT * FROM quality_ontology_tests WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// ─── UI Tests ────────────────────────────────────────────

// GET /ui-tests
router.get("/ui-tests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM quality_ui_tests ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /ui-tests/:id/run — run UI test
router.post("/ui-tests/:id/run", (req, res) => {
  const test = db.prepare("SELECT * FROM quality_ui_tests WHERE id = ?").get(req.params.id);
  if (!test) return res.status(404).json({ success: false, error: "测试不存在" });
  const now = new Date().toISOString();
  const duration = (1 + Math.random() * 4).toFixed(1) + "s";
  const status = Math.random() > 0.2 ? "passed" : "failed";
  db.prepare(
    "UPDATE quality_ui_tests SET status = ?, duration = ?, last_run = ? WHERE id = ?"
  ).run(status, duration, now, req.params.id);
  const row = db.prepare("SELECT * FROM quality_ui_tests WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// ─── Process Tests ───────────────────────────────────────

// GET /process-tests
router.get("/process-tests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM quality_process_tests ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /process-tests/:id/run — run process test
router.post("/process-tests/:id/run", (req, res) => {
  const test = db.prepare("SELECT * FROM quality_process_tests WHERE id = ?").get(req.params.id);
  if (!test) return res.status(404).json({ success: false, error: "测试不存在" });
  const now = new Date().toISOString();
  const coverage = (70 + Math.random() * 30).toFixed(1);
  const status = parseFloat(coverage) >= 80 ? "passed" : "failed";
  db.prepare(
    "UPDATE quality_process_tests SET coverage = ?, status = ?, last_run = ? WHERE id = ?"
  ).run(parseFloat(coverage), status, now, req.params.id);
  const row = db.prepare("SELECT * FROM quality_process_tests WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// ─── AI Fixes ────────────────────────────────────────────

// GET /ai-fixes
router.get("/ai-fixes", (_req, res) => {
  const rows = db.prepare("SELECT * FROM quality_ai_fixes ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /ai-fixes/:id/apply — apply AI fix
router.post("/ai-fixes/:id/apply", (req, res) => {
  const fix = db.prepare("SELECT * FROM quality_ai_fixes WHERE id = ?").get(req.params.id);
  if (!fix) return res.status(404).json({ success: false, error: "修复建议不存在" });
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE quality_ai_fixes SET status = 'applied', applied_at = ? WHERE id = ?"
  ).run(now, req.params.id);
  const row = db.prepare("SELECT * FROM quality_ai_fixes WHERE id = ?").get(req.params.id);
  res.json({ success: true, data: row });
});

// ─── Reports ─────────────────────────────────────────────

// GET /reports
router.get("/reports", (_req, res) => {
  const rows = db.prepare("SELECT * FROM quality_reports ORDER BY created_at DESC").all();
  res.json({ success: true, data: rows });
});

// POST /reports — create report
router.post("/reports", (req, res) => {
  const { name, version, total_cases, passed_cases, failed_cases, bug_count, coverage } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
  const result = db.prepare(
    "INSERT INTO quality_reports (name, version, total_cases, passed_cases, failed_cases, bug_count, coverage) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(name, version || null, total_cases ?? 0, passed_cases ?? 0, failed_cases ?? 0, bug_count ?? 0, coverage ?? 0);
  const row = db.prepare("SELECT * FROM quality_reports WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
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
