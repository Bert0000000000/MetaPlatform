/**
 * Architecture Center routes — CRUD for 4 architecture sections
 * Stored in system_config as JSON (key: architecture_ba / aa / da / ta)
 */
import { Router } from "express";
import db from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const VALID_SECTIONS = ["ba", "aa", "da", "ta"];

// GET /api/architecture/:section
router.get("/:section", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `Invalid section: ${section}` });
  }
  const key = `architecture_${section}`;
  const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").get(key);
  if (!row) {
    return res.status(404).json({ success: false, message: `Section '${section}' not found` });
  }
  res.json({ success: true, data: JSON.parse(row.value) });
});

// PUT /api/architecture/:section  — replace entire section data
router.put("/:section", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `Invalid section: ${section}` });
  }
  const key = `architecture_${section}`;
  const incoming = req.body;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ success: false, message: "Request body must be a JSON object" });
  }
  const existing = await db.prepare("SELECT key FROM system_config WHERE key = ?").get(key);
  if (existing) {
    await db.prepare("UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = ?")
      .run(JSON.stringify(incoming), key);
  } else {
    await db.prepare(
      "INSERT INTO system_config (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(key, JSON.stringify(incoming), `Architecture center ${section} data`);
  }
  res.json({ success: true, data: incoming });
});

// ─── Item-level operations ──────────────────────────────────
// All item endpoints operate on a named array field within the section.
// POST  /api/architecture/:section/item        — body: { field, item }
// PUT   /api/architecture/:section/item        — body: { field, item }
// DELETE /api/architecture/:section/item/:id    — query: ?field=xxx

async function getSectionData(section) {
  const key = `architecture_${section}`;
  const row = await db.prepare("SELECT value FROM system_config WHERE key = ?").get(key);
  if (!row) return null;
  return JSON.parse(row.value);
}

async function saveSectionData(section, data) {
  const key = `architecture_${section}`;
  await db.prepare("UPDATE system_config SET value = ?, updated_at = datetime('now') WHERE key = ?")
    .run(JSON.stringify(data), key);
}

// POST /api/architecture/:section/item
router.post("/:section/item", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `Invalid section: ${section}` });
  }
  const { field, item } = req.body;
  if (!field || !item) {
    return res.status(400).json({ success: false, message: "Missing 'field' or 'item' in body" });
  }
  const data = await getSectionData(section);
  if (!data) {
    return res.status(404).json({ success: false, message: `Section '${section}' not found` });
  }
  if (!Array.isArray(data[field])) {
    return res.status(400).json({ success: false, message: `Field '${field}' is not an array` });
  }
  const newItem = { id: uuidv4(), ...item };
  data[field].push(newItem);
  await saveSectionData(section, data);
  res.json({ success: true, data: newItem });
});

// PUT /api/architecture/:section/item
router.put("/:section/item", async (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `Invalid section: ${section}` });
  }
  const { field, item } = req.body;
  if (!field || !item || !item.id) {
    return res.status(400).json({ success: false, message: "Missing 'field', 'item', or 'item.id'" });
  }
  const data = await getSectionData(section);
  if (!data) {
    return res.status(404).json({ success: false, message: `Section '${section}' not found` });
  }
  if (!Array.isArray(data[field])) {
    return res.status(400).json({ success: false, message: `Field '${field}' is not an array` });
  }
  const idx = data[field].findIndex((el) => el.id === item.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: `Item '${item.id}' not found in '${field}'` });
  }
  data[field][idx] = { ...data[field][idx], ...item };
  await saveSectionData(section, data);
  res.json({ success: true, data: data[field][idx] });
});

// DELETE /api/architecture/:section/item/:id
router.delete("/:section/item/:id", async (req, res) => {
  const { section, id } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ success: false, message: `Invalid section: ${section}` });
  }
  const field = req.query.field;
  if (!field) {
    return res.status(400).json({ success: false, message: "Missing '?field=' query parameter" });
  }
  const data = await getSectionData(section);
  if (!data) {
    return res.status(404).json({ success: false, message: `Section '${section}' not found` });
  }
  if (!Array.isArray(data[field])) {
    return res.status(400).json({ success: false, message: `Field '${field}' is not an array` });
  }
  const idx = data[field].findIndex((el) => el.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: `Item '${id}' not found in '${field}'` });
  }
  const removed = data[field].splice(idx, 1)[0];
  await saveSectionData(section, data);
  res.json({ success: true, data: removed });
});

export default router;
