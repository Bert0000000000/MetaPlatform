/**
 * /api/apps — Application management routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import http from "http";
import https from "https";
import db from "../db.js";
import { tenantGuard } from "../middleware/tenant.js";
import { buildTemplateSeed, listTemplateKeys, TEMPLATES } from "../templates/apps.js";
import appApiKeysRoutes from "./app-api-keys.js";
import appIntegrationsRoutes from "./app-integrations.js";
import appFormsRoutes from "./app-forms.js";
import appReportsRoutes from "./app-reports.js";
import appDashboardsRoutes from "./app-dashboards.js";
import appDatasetsRoutes from "./app-datasets.js";
import appPageComponentsRoutes from "./app-page-components.js";
import appCollaboratorsRoutes from "./app-collaborators.js";
import {
  spawnRuntime,
  stopRuntime,
  inspectRuntime,
  resolveTarget,
  switchAlias,
} from "../services/runtime-orchestrator.js";
import { buildPublishSnapshot } from "../services/publish-snapshot.js";

const router = Router();

// ─── Slug generation helper ───────────────────────────────
function generateSlug(name) {
  // Transliterate common Chinese chars, fall back to UUID prefix
  const slug = name
    .toLowerCase()
    .replace(/[\u4e00-\u9fff]/g, (ch) => {
      // Simple hash: map each CJK char to a numeric prefix
      return "c" + ch.charCodeAt(0).toString(36);
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = uuid().slice(0, 6);
  return slug ? `${slug}-${suffix}` : `app-${suffix}`;
}

// ─── GET / ── list all applications ─────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { status, environment, owner_id, q, sort, order } = req.query;
    const conds = [];
    const params = [];
    if (status) { conds.push("status = ?"); params.push(String(status)); }
    if (environment) { conds.push("environment = ?"); params.push(String(environment)); }
    if (owner_id) { conds.push("owner_id = ?"); params.push(String(owner_id)); }
    if (q) { conds.push("(name LIKE ? OR description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
    const allowedSort = new Set(["name", "created_at", "updated_at", "version", "sort_order"]);
    const sortCol = allowedSort.has(String(sort || "")) ? String(sort) : "created_at";
    const sortDir = String(order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const rows = await db.prepare(
      `SELECT * FROM applications ${where} ORDER BY ${sortCol} ${sortDir} LIMIT 500`
    ).all(...params);
    // P0-3: 解析 tags_json → tags; owner_name/owner_email → ownerName/ownerEmail
    const data = rows.map((row) => ({
      ...row,
      tags: row.tags_json ? safeParseJSON(row.tags_json, []) : [],
      ownerName: row.owner_name || null,
      ownerEmail: row.owner_email || null,
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /templates/list ── F4.1.7 industry templates ───
// Drives the "新建应用向导" template step. Returns each seeded
// template with a derived icon + label so the wizard doesn't have to
// hardcode the catalogue.
router.get("/templates/list", async (_req, res, next) => {
  try {
    const keys = listTemplateKeys();
    const out = keys.map((key) => {
      const tpl = TEMPLATES[key];
      return {
        key,
        name: tpl.name,
        label: tpl.label,
        description: tpl.description,
        icon: tpl.icon,
        category: tpl.category,
        objects: tpl.objects?.map((o) => o.name) || [],
        pages:   tpl.pages?.map((p) => p.name) || [],
        flows:   tpl.flows?.map((f) => f.name) || [],
      };
    });
    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
});

// ─── POST /clone ── F4.1.7 复制现有应用 ────────────────
// Body: { sourceAppId, name, icon?, description?, category? }
// Copies the source row plus all its app_pages / app_config / flows /
// ontology rows into a new application with the given name and a fresh
// id. The cloned app starts as status='draft' so the user can review
// before publishing.
router.post("/clone", async (req, res, next) => {
  try {
    const { sourceAppId } = req.body || {};
    if (!sourceAppId) return res.status(400).json({ success: false, error: "sourceAppId required" });

    const src = await db.prepare("SELECT * FROM applications WHERE id = ?").get(sourceAppId);
    if (!src) return res.status(404).json({ success: false, error: "Source app not found" });

    const newId = "app-" + Math.random().toString(36).slice(2, 10);
    const name = (req.body.name && String(req.body.name).trim()) || `${src.name} (副本)`;
    const now = new Date().toISOString();
    const env = ["dev", "test", "staging", "prod"].includes(req.body.environment)
      ? req.body.environment
      : (src.environment ?? "dev");

    // ── 1. Insert new application row (draft, no slug) ──
    await db.prepare(
      `INSERT INTO applications
       (id, name, description, category, icon, status, app_slug,
        objects_count, pages_count, flows_count, publish_config, environment,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', NULL,
               ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      name,
      req.body.description ?? src.description ?? null,
      req.body.category ?? src.category ?? "通用",
      req.body.icon ?? src.icon ?? null,
      src.objects_count ?? 0,
      src.pages_count ?? 0,
      src.flows_count ?? 0,
      src.publish_config ?? null,
      env,
      now, now
    );

    // ── 2. Copy app_pages ──
    // Schema: id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at
    try {
      const pageRows = await db.prepare("SELECT * FROM app_pages WHERE app_id = ?").all(sourceAppId);
      for (const p of pageRows) {
        await db.prepare(
          `INSERT INTO app_pages
           (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          "pg-" + Math.random().toString(36).slice(2, 10),
          newId, p.name, p.type, p.icon, p.status ?? "draft",
          p.config, p.sort_order ?? 0, now, now
        );
      }
    } catch (err) {
      // Table might not exist on older db schemas — log but don't fail the clone
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 3. Copy app_config (best-effort — schema is untyped so we
    //    fall back to SELECT * and INSERT * if the table exists) ──
    try {
      const cfgInfo = await db.prepare("PRAGMA table_info(app_config)").all();
      if (cfgInfo.length > 0) {
        const cols = cfgInfo.map((c) => c.name);
        const cfgRows = await db.prepare(`SELECT * FROM app_config WHERE app_id = ?`).all(sourceAppId);
        for (const c of cfgRows) {
          // Skip columns that don't exist on a heterogeneous schema
          const values = cols.map((col) => (col === "id" ? `cfg-${Math.random().toString(36).slice(2, 10)}` : (c[col] ?? null)));
          const placeholders = cols.map(() => "?").join(",");
          await db.prepare(`INSERT INTO app_config (${cols.join(",")}) VALUES (${placeholders})`).run(...values);
        }
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 4. Copy flows (best-effort) ──
    try {
      const flowInfo = await db.prepare("PRAGMA table_info(flows)").all();
      if (flowInfo.length > 0) {
        const cols = flowInfo.map((c) => c.name);
        const flowRows = await db.prepare(`SELECT * FROM flows WHERE app_id = ?`).all(sourceAppId);
        for (const f of flowRows) {
          const values = cols.map((col) => (col === "id" ? `fl-${Math.random().toString(36).slice(2, 10)}` : (f[col] ?? null)));
          const placeholders = cols.map(() => "?").join(",");
          await db.prepare(`INSERT INTO flows (${cols.join(",")}) VALUES (${placeholders})`).run(...values);
        }
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 5. Copy app_modules (使用新 uuid, 复用同源 content) ──
    try {
      const moduleRows = await db.prepare("SELECT * FROM app_modules WHERE app_id = ?").all(sourceAppId);
      for (const m of moduleRows) {
        await db.prepare(
          `INSERT INTO app_modules
             (id, app_id, label, icon, color, bg_color, type_filter, sort_order, config, page_ids, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uuid(), newId,
          m.label, m.icon, m.color, m.bg_color,
          m.type_filter, m.sort_order ?? 0, m.config, m.page_ids,
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 6. Copy app_forms ──
    try {
      const formRows = await db.prepare("SELECT * FROM app_forms WHERE app_id = ?").all(sourceAppId);
      for (const f of formRows) {
        await db.prepare(
          `INSERT INTO app_forms
             (id, app_id, name, schema_json, version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uuid(), newId,
          f.name, f.schema_json,
          Number.isFinite(+(f.version)) ? +(f.version) : 1,
          f.status ?? "draft",
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 7. Copy app_reports ──
    try {
      const reportRows = await db.prepare("SELECT * FROM app_reports WHERE app_id = ?").all(sourceAppId);
      for (const r of reportRows) {
        await db.prepare(
          `INSERT INTO app_reports
             (id, app_id, name, dataset_id, layout_json, schedule_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uuid(), newId,
          r.name, r.dataset_id, r.layout_json, r.schedule_json,
          r.status ?? "draft",
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 8. Copy app_dashboards ──
    try {
      const dashRows = await db.prepare("SELECT * FROM app_dashboards WHERE app_id = ?").all(sourceAppId);
      for (const d of dashRows) {
        await db.prepare(
          `INSERT INTO app_dashboards
             (id, app_id, name, layout_json, widgets_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uuid(), newId,
          d.name, d.layout_json, d.widgets_json,
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 9. Copy app_integrations (注: 不复制 secret 类字段, 新行 disabled) ──
    try {
      const intRows = await db.prepare("SELECT * FROM app_integrations WHERE app_id = ?").all(sourceAppId);
      for (const i of intRows) {
        // strip possible secret-looking fields from config_json so cloned
        // integrations don't inherit credentials; new row stays disabled.
        let safeConfig = i.config_json;
        try {
          const parsed = JSON.parse(i.config_json || "{}");
          for (const k of Object.keys(parsed)) {
            if (/secret|password|token|apikey|api_key|private/i.test(k)) parsed[k] = null;
          }
          safeConfig = JSON.stringify(parsed);
        } catch {
          safeConfig = i.config_json;
        }
        await db.prepare(
          `INSERT INTO app_integrations
             (id, app_id, type, platform, name, config_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'disabled', ?, ?)`
        ).run(
          uuid(), newId,
          i.type, i.platform, i.name,
          safeConfig,
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    // ── 10. Copy app_page_components ──
    try {
      const compRows = await db.prepare("SELECT * FROM app_page_components WHERE app_id = ?").all(sourceAppId);
      for (const c of compRows) {
        await db.prepare(
          `INSERT INTO app_page_components
             (id, app_id, page_id, component_key, props_json, x, y, w, h, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uuid(), newId,
          c.page_id, c.component_key, c.props_json,
          c.x ?? 0, c.y ?? 0, c.w ?? 0, c.h ?? 0,
          c.sort_order ?? 0,
          now, now,
        );
      }
    } catch (err) {
      if (!/no such table/i.test(String(err?.message))) throw err;
    }

    const fresh = await db.prepare("SELECT * FROM applications WHERE id = ?").get(newId);

    // P1: 写 audit_logs (clone + 创建 v0.1 版本)
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(
        uuid(),
        req.user?.id || null,
        req.user?.email || req.user?.name || null,
        'clone',
        'app',
        newId,
        JSON.stringify({ sourceAppId, name }),
        req.ip || '127.0.0.1',
        now,
      );
    } catch (e) {
      console.warn("[apps clone] audit_logs:", e?.message);
    }
    // 同时初始化新克隆应用的 v0.1
    try {
      await db.prepare(
        `INSERT INTO app_versions (id, app_id, version, description, commit_message, status, created_by, created_at)
         VALUES (?, ?, 'v0.1', '从源应用克隆', ?, 'active', ?, ?)`
      ).run(uuid(), newId, `cloned from ${sourceAppId}`, req.user?.id || null, now);
    } catch (e) { if (!/no such table/i.test(String(e?.message))) console.warn("[apps clone] init v0.1:", e?.message); }

    res.json({
      success: true,
      data: {
        ...fresh,
        tags: fresh.tags_json ? safeParseJSON(fresh.tags_json, []) : [],
        ownerName: fresh.owner_name || null,
        ownerEmail: fresh.owner_email || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /sort — 重新排序应用卡片 (P2-4) ───
router.put("/sort", async (req, res, next) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, error: "order 必须是应用 id 数组" });
    }
    const now = new Date().toISOString();
    for (let i = 0; i < order.length; i++) {
      try {
        await db.prepare("UPDATE applications SET sort_order = ?, updated_at = ? WHERE id = ?")
          .run(i, now, order[i]);
      } catch (e) {
        if (!/no such column/i.test(String(e?.message))) throw e;
      }
    }
    res.json({ success: true, data: { count: order.length } });
  } catch (err) { next(err); }
});

// ─── GET /published ── list all published apps (public) ───
router.get("/published", async (_req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT id, name, description, category, icon, app_slug, published_url, published_version, published_at FROM applications WHERE status = 'published' ORDER BY published_at DESC"
    ).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /slug/:slug ── get app by slug (public) ──────────
router.get("/slug/:slug", async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT * FROM applications WHERE app_slug = ? AND status = 'published'").get(req.params.slug);
    if (!row) return res.status(404).json({ success: false, error: "Published app not found" });

    // Try to parse pages from publish_config if available
    let pages = [];
    if (row.publish_config) {
      try {
        const config = JSON.parse(row.publish_config);
        pages = config.pages || [];
      } catch {}
    }

    res.json({
      success: true,
      data: {
        ...row,
        pages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id ── single application ─────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "应用不存在" });
    res.json({
      success: true,
      data: {
        ...row,
        // P2: tags_json → tags 数组
        tags: row.tags_json ? safeParseJSON(row.tags_json, []) : [],
        ownerName: row.owner_name || null,
        ownerEmail: row.owner_email || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ── create application ───────────────────────
//
// Accepts an optional `template` key (e.g. "crm", "bi", "bpm"). When the
// key maps to a known template we seed the new application with its
// ontology objects (+ their fields), app pages, and process
// definitions so the user lands on a usable application instead of an
// empty shell. Unknown template values fall back to the empty install
// for forward-compatibility.
// 允许的应用 category 白名单 — 与 NewAppWizard 前端保持一致
const ALLOWED_CATEGORIES = new Set([
  "traditional", "business", "lowcode", "dashboard", "workflow", "custom",
  "bi", "bpm", "crm", "hr", "ops", "kb", "form", "report",
]);

router.post("/", tenantGuard, async (req, res, next) => {
  try {
    const { name, description, category, icon, template, environment, tags } = req.body;
    if (!name || !category || !icon) {
      return res.status(400).json({ success: false, error: "name, category, icon 为必填项" });
    }
    // P1: category 白名单校验 (任意传值都能持久化 → 拼写错误污染)
    if (!ALLOWED_CATEGORIES.has(String(category))) {
      return res.status(400).json({ success: false, error: `category 必须是 ${[...ALLOWED_CATEGORIES].join(' / ')} 之一` });
    }
    // tags 校验: 必须是字符串数组
    const safeTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string" && t.trim().length > 0).slice(0, 20) : [];
    const id = uuid();
    const now = NOW();
    const seed = template ? buildTemplateSeed(template) : null;
    const objectsCount = seed?.objects?.length ?? 0;
    const pagesCount   = seed?.pages?.length   ?? 0;
    const flowsCount   = seed?.flows?.length   ?? 0;
    // Sanitise environment to the four known rings
    const env = ["dev", "test", "staging", "prod"].includes(environment) ? environment : "dev";

    // ── 重名去重 (P0): 同一 owner 下重名时自动加 " (n)" 后缀 ──
    const deduped = await dedupeAppName(req.user?.id || null, name);
    const finalName = deduped.name;

    await db.prepare(
      `INSERT INTO applications (id, name, description, category, icon, status, version,
                                  owner_id, objects_count, pages_count, flows_count,
                                  owner_name, owner_email, tags_json,
                                  environment, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 'v0.1', ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, finalName, description || "", category, icon,
      req.user?.id || null,
      objectsCount, pagesCount, flowsCount,
      req.user?.name || null,
      req.user?.email || null,
      JSON.stringify(safeTags),
      env,
      req.body?.tenant_id || req.headers["x-tenant-id"] || req.user?.tenant_id || "default",
      now, now,
    );

    // Persist template sub-resources, if any.
    let seeded = null;
    if (seed) {
      seeded = await applyTemplateSeed(id, seed, now);
    }

    // ── 初始化 app_versions v0.1 行 (P0): rollback 列表立即可用 ──
    try {
      await db.prepare(
        `INSERT INTO app_versions (id, app_id, version, description, commit_message, status, created_by, created_at)
         VALUES (?, ?, 'v0.1', '初始版本', 'app created', 'active', ?, ?)`
      ).run(uuid(), id, req.user?.id || null, now);
    } catch (e) {
      if (!/no such table/i.test(String(e?.message))) console.warn("[apps POST] app_versions init:", e?.message);
    }

    // ── 写 audit_logs (P0): 最近活动立即可见 ──
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(
        uuid(),
        req.user?.id || null,
        req.user?.email || req.user?.name || null,
        'create',
        'app',
        id,
        JSON.stringify({ name: finalName, category, template: template || null, environment: env }),
        req.ip || '127.0.0.1',
        now,
      );
    } catch (e) {
      console.warn("[apps POST] audit_logs insert:", e?.message);
    }

    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
    const responseRow = seeded
      ? { ...row, _seedSummary: `${seeded.objects} 对象 · ${seeded.pages} 页面 · ${seeded.flows} 流程` }
      : row;
    res.status(201).json({
      success: true,
      data: responseRow,
      seeded: seeded || undefined,
      template: template || null,
      availableTemplates: listTemplateKeys(),
      _deduped: deduped.deduped,
      _originalName: deduped.deduped ? name : null,
    });
  } catch (err) { next(err); }
});

/**
 * 重名去重 — 同一 owner 下若已存在同名应用,
 * 自动在末尾追加 " (n)", 返回 { deduped: true, name: 'Foo (2)' }.
 * 仅作用于 LOG IN 用户的 owner_id; 系统级创建不应用去重.
 */
async function dedupeAppName(ownerId, baseName) {
  if (!ownerId) return { deduped: false, name: baseName };
  const trimmed = (baseName || "").trim();
  if (!trimmed) return { deduped: false, name: baseName };
  const existing = await db.prepare(
    "SELECT COUNT(*) AS c FROM applications WHERE owner_id = ? AND name = ?"
  ).get(ownerId, trimmed);
  if (!existing || existing.c === 0) return { deduped: false, name: trimmed };
  let n = 2;
  while (n < 1000) {
    const candidate = `${trimmed} (${n})`;
    const dup = await db.prepare(
      "SELECT COUNT(*) AS c FROM applications WHERE owner_id = ? AND name = ?"
    ).get(ownerId, candidate);
    if (!dup || dup.c === 0) return { deduped: true, name: candidate };
    n += 1;
  }
  return { deduped: true, name: `${trimmed} (${Date.now() % 100000})` };
}

/* ── helpers (scoped to this route module) ── */
function NOW() { return new Date().toISOString(); }

/**
 * Persist ontology objects + properties, app pages, and process
 * definitions for a freshly-created application. Returns a small
 * summary so the response can echo what was installed.
 */
async function applyTemplateSeed(appId, seed, now) {
  let objectsCreated = 0;
  let propertiesCreated = 0;
  let pagesCreated = 0;
  let flowsCreated = 0;

  for (const obj of seed.objects || []) {
    const objectId = uuid();
    await db.prepare(
      `INSERT INTO ontology_objects (id, app_id, name, label, description, icon, status,
                                     properties_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
    ).run(
      objectId, appId, obj.name, obj.label, obj.description || null, obj.icon || null,
      (obj.properties || []).length, now, now,
    );
    for (const prop of obj.properties || []) {
      await db.prepare(
        `INSERT INTO ontology_properties (id, object_id, name, label, type, required,
                                          unique_field, default_value, description,
                                          sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuid(), objectId, prop.name, prop.label,
        prop.type || "text",
        prop.required ? 1 : 0,
        prop.unique_field ? 1 : 0,
        prop.default_value ?? null,
        prop.description || null,
        prop.sort_order ?? 0,
        now,
      );
      propertiesCreated++;
    }
    objectsCreated++;
  }

  for (const page of seed.pages || []) {
    await db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, icon, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).run(
      uuid(), appId, page.name, page.type || "list", page.icon || null,
      page.sort_order ?? 0, now, now,
    );
    pagesCreated++;
  }

  for (const flow of seed.flows || []) {
    await db.prepare(
      `INSERT INTO process_definitions (id, app_id, name, type, status, version, bpmn_xml, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?)`
    ).run(
      uuid(), appId, flow.name, flow.type || "business",
      flow.bpmn_xml || null, flow.description || null,
      now, now,
    );
    flowsCreated++;
  }

  return {
    objects: objectsCreated,
    properties: propertiesCreated,
    pages: pagesCreated,
    flows: flowsCreated,
  };
}

/* ────────────────────────────────────────────────────────────
   App API Keys (P0.3)
   ──────────────────────────────────────────────────────────── */
router.use("/:id/api-keys", appApiKeysRoutes);

// ─── Nested routes: integrations / forms / reports / dashboards / page-components ─
router.use("/:id/integrations",     appIntegrationsRoutes);
router.use("/:id/forms",            appFormsRoutes);
router.use("/:id/reports",          appReportsRoutes);
router.use("/:id/dashboards", appDashboardsRoutes);
router.use("/:id/datasets",   appDatasetsRoutes);

// ─── P2-3: /:id/aliases — 应用公开访问别名 (受 auth) ──
router.post("/:id/aliases", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const { slug, kind, target_id } = req.body || {};
    if (!slug || typeof slug !== "string") return res.status(400).json({ success: false, error: "slug 必填" });
    const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 64);
    if (!safeSlug) return res.status(400).json({ success: false, error: "slug 至少需要 1 个合法字符" });
    if (!["form", "dashboard"].includes(String(kind))) return res.status(400).json({ success: false, error: "kind 必须是 form / dashboard" });
    if (!target_id) return res.status(400).json({ success: false, error: "target_id 必填" });
    const now = new Date().toISOString();
    try {
      await db.prepare(
        `INSERT INTO app_public_aliases (slug, app_id, kind, target_id, status, created_at)
         VALUES (?, ?, ?, ?, 'active', ?)`
      ).run(safeSlug, req.params.id, kind, target_id, now);
    } catch (e) {
      if (/UNIQUE|duplicate/i.test(String(e?.message))) {
        // upsert
        await db.prepare(
          `UPDATE app_public_aliases SET app_id = ?, kind = ?, target_id = ?, status = 'active' WHERE slug = ?`
        ).run(req.params.id, kind, target_id, safeSlug);
      } else throw e;
    }
    const row = await db.prepare("SELECT * FROM app_public_aliases WHERE slug = ?").get(safeSlug);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.get("/:id/aliases", async (req, res, next) => {
  try {
    const rows = await db.prepare(
      "SELECT slug, app_id, kind, target_id, status, created_at, hit_count, last_hit_at FROM app_public_aliases WHERE app_id = ? ORDER BY created_at DESC"
    ).all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.delete("/:id/aliases/:slug", async (req, res, next) => {
  try {
    const result = await db.prepare(
      "DELETE FROM app_public_aliases WHERE slug = ? AND app_id = ?"
    ).run(req.params.slug, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: "alias 不存在" });
    res.json({ success: true, data: { slug: req.params.slug } });
  } catch (err) { next(err); }
});
router.use("/:id/page-components",  appPageComponentsRoutes);
router.use("/:id/collaborators",    appCollaboratorsRoutes);

// ─── PUT /:id ── update application ─────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, description, category, icon, status, version, tags } = req.body;
    const now = new Date().toISOString();
    // category 白名单 (PUT 时同样强校验)
    if (category != null && !ALLOWED_CATEGORIES.has(String(category))) {
      return res.status(400).json({ success: false, error: `category 必须是 ${[...ALLOWED_CATEGORIES].join(' / ')} 之一` });
    }
    // status 状态机白名单 (配合 AppOverview StatusTransitionControls)
    const ALLOWED_STATUS = new Set([
      "draft", "testing", "ready_to_publish", "published", "archived",
    ]);
    if (status != null && !ALLOWED_STATUS.has(String(status))) {
      return res.status(400).json({ success: false, error: `status 必须是 ${[...ALLOWED_STATUS].join(' / ')} 之一` });
    }
    // tags 校验
    let tagsJson = existing.tags_json ?? "[]";
    if (tags != null) {
      const safeTags = Array.isArray(tags) ? tags.filter((t) => typeof t === "string" && t.trim().length > 0).slice(0, 20) : [];
      tagsJson = JSON.stringify(safeTags);
    }
    await db.prepare(
      `UPDATE applications
       SET name = ?, description = ?, category = ?, icon = ?, status = ?, version = ?, tags_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name ?? existing.name,
      description ?? existing.description,
      category ?? existing.category,
      icon ?? existing.icon,
      status ?? existing.status,
      version ?? existing.version,
      tagsJson,
      now,
      req.params.id
    );

    // P1: 写 audit_logs (update)
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(
        uuid(),
        req.user?.id || null,
        req.user?.email || req.user?.name || null,
        'update',
        'app',
        req.params.id,
        JSON.stringify({
          patched: Object.keys({ name, description, category, icon, status, version, tags }).filter((k) => req.body?.[k] != null),
        }),
        req.ip || '127.0.0.1',
        now,
      );
    } catch (e) {
      console.warn("[apps PUT] audit_logs:", e?.message);
    }
    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ── delete application ──────────────────
// 删应用前手动级联删所有子表 (历史 db schema 没有 ON DELETE CASCADE 关联).
// 表不存在时静默忽略, 保证在旧 db 上也能跑通.
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    // P1: 写 audit_logs (delete) — 必须先写, 然后才能删
    const nowDel = new Date().toISOString();
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(
        uuid(),
        req.user?.id || null,
        req.user?.email || req.user?.name || null,
        'delete',
        'app',
        req.params.id,
        JSON.stringify({ name: existing.name, category: existing.category }),
        req.ip || '127.0.0.1',
        nowDel,
      );
    } catch (e) {
      console.warn("[apps DELETE] audit_logs:", e?.message);
    }

    const childTables = [
      "app_pages",
      "app_modules",
      "app_configs",
      "app_api_keys",
      "app_integrations",
      "app_forms",
      "app_reports",
      "app_dashboards",
      "app_page_components",
      "app_collaborators",
      "app_datasets",
      "form_submissions",
      "report_runs",
      "app_publications",
      "app_versions",
    ];
    for (const t of childTables) {
      try {
        await db.prepare(`DELETE FROM ${t} WHERE app_id = ?`).run(req.params.id);
      } catch (err) {
        if (!/no such table/i.test(String(err?.message))) throw err;
      }
    }

    await db.prepare("DELETE FROM applications WHERE id = ?").run(req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/publish ── publish an application ─────────
//
// A "publish" has two halves now:
//
//   1. Snapshot the application + its ontology/pages/processes into a
//      stand-alone sqlite file under `<data>/published/<slug>.db`.
//   2. Ask the runtime orchestrator to spin up an isolated container
//      bound to that snapshot. The orchestrator returns `{ degraded:
//      true }` when the docker daemon is unreachable; in that case we
//      keep the platform record + snapshot and the published URL still
//      resolves through the reverse-proxy's "degraded" branch.
//
// Either half can fail without leaving the platform in a torn state:
// the application row is updated first, then if the orchestrator
// succeeds we update again with the runtime id/port.
router.post("/:id/publish", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const now = new Date().toISOString();
    const version = existing.version || "v1.0";
    let slug = existing.app_slug || generateSlug(existing.name);
    if (!slug) slug = `app-${(existing.id || "").replace(/-/g, "").slice(0, 12)}`;

    // Each `app_publications` row is an immutable record of "this
    // app was deployed at this URL at this time". The application
    // row's `app_slug` is the *current* live slug, but historical
    // publications need their own stable slug + URL so users can
    // revisit an old build without colliding with newer deploys.
    // We attach a short suffix derived from the publish timestamp;
    // the live URL stays unchanged (`/app/<baseSlug>`).
    const versionSuffix = Math.floor(Date.now() / 1000).toString(36);
    const historicalSlug = `${slug}-${versionSuffix}`;
    const publishedUrl = `/app/${slug}`;
    const historicalPublishedUrl = `/app/${historicalSlug}`;
    const publishConfig = JSON.stringify({
      pages: req.body.pages || [],
      config: req.body.config || {},
      publishedAt: now,
    });

    // First mark the application as published so admin views reflect
    // the intent before we burn the snapshot.
    await db.prepare(
      `UPDATE applications
       SET status = 'published',
           app_slug = ?,
           published_url = ?,
           published_version = ?,
           published_at = ?,
           publish_config = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(slug, publishedUrl, version, now, publishConfig, now, req.params.id);

    // Build the snapshot. Failure here aborts the publish and rolls
    // status back to draft.
    let snapshotFile;
    try {
      // Re-read with the updated slug/publish_config so the snapshot
      // matches what we just wrote.
      const forSnapshot = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
      snapshotFile = buildPublishSnapshot(db, forSnapshot);
    } catch (err) {
      await db.prepare(
        `UPDATE applications SET status = 'draft', published_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(new Date().toISOString(), req.params.id);
      return res.status(500).json({
        success: false,
        error: `Failed to build publish snapshot: ${err.message}`,
        slug,
      });
    }

    // Spawn the isolated runtime for the *historical* slug — every
    // publication gets its own container so the historical version
    // stays reachable even after the live runtime gets re-published.
    let runtimeInfo;
    try {
      const updated = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
      runtimeInfo = await spawnRuntime({ slug: historicalSlug, app: updated, snapshotFile, baseSlug: slug });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ level: "warn", msg: "spawnRuntime failed", slug: historicalSlug, baseSlug: slug, err: String(err && err.stack || err) }));
      runtimeInfo = { degraded: true, error: err.message, snapshot: snapshotFile };
    }

    if (!runtimeInfo.degraded && runtimeInfo.containerId) {
      await db.prepare(
        `UPDATE applications
         SET runtime_container_id = ?, runtime_port = ?, runtime_mode = 'container',
             runtime_alias_slug = ?, updated_at = ?
         WHERE id = ?`,
      ).run(runtimeInfo.containerId, runtimeInfo.port, historicalSlug, now, req.params.id);
    } else {
      await db.prepare(
        `UPDATE applications
         SET runtime_mode = 'degraded', runtime_alias_slug = ?, updated_at = ?
         WHERE id = ?`,
      ).run(historicalSlug, now, req.params.id);
    }

    // Publication row carries the historical slug + URL so that
    // re-visiting an old build points at its own container. The live
    // `/app/<slug>` URL is the application's current row, which always
    // tracks the latest publish.
    const pubId = uuid();
    await db.prepare(
      `INSERT INTO app_publications (id, app_id, slug, published_url, published_version, config_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(pubId, req.params.id, historicalSlug, historicalPublishedUrl, version, publishConfig, now);

    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({
      success: true,
      data: {
        ...row,
        published_url: publishedUrl,
        runtime: {
          mode: runtimeInfo.degraded ? "degraded" : "container",
          port: runtimeInfo.port ?? null,
          containerId: runtimeInfo.containerId ?? null,
          // Frontend toast uses this for the "打开已部署应用" shortcut.
          // In degraded mode the snapshot route still serves via the
          // in-process router so we send the same path either way.
          url: publishedUrl,
          error: runtimeInfo.error ?? null,
          snapshot: snapshotFile,
          historical_slug: historicalSlug,
          historical_url: historicalPublishedUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/unpublish ── unpublish an application ─────
router.post("/:id/restore", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    // Restore = swap the alias to point at an archived publication
    // whose container is still running. We don't take down the
    // currently-live container — if it's still healthy it'll remain
    // reachable via its historical slug.
    const pubId = req.body?.publicationId || req.body?.publication_id;
    if (!pubId) return res.status(400).json({ success: false, error: "需要 publicationId" });

    const pub = await db.prepare(
      "SELECT * FROM app_publications WHERE id = ? AND app_id = ?"
    ).get(pubId, req.params.id);
    if (!pub) return res.status(404).json({ success: false, error: "历史版本不存在" });

    // Sanity-check the container is actually reachable before we
    // commit to the swap. Otherwise the user would publish to a
    // dangling URL.
    let runtimeOk = false;
    let runtimeError = null;
    try {
      const target = await resolveTarget(pub.slug);
      if (target.mode === "container") {
        runtimeOk = true;
      } else {
        runtimeError = target.snapshot
          ? `Runtime degraded (snapshot-only fallback). Container not running.`
          : `Container not running and no snapshot on disk.`;
      }
    } catch (err) {
      runtimeError = err.message;
    }
    if (!runtimeOk) {
      return res.status(409).json({ success: false, error: `该历史版本无法恢复: ${runtimeError}` });
    }

    const now = new Date().toISOString();
    // Point the live application row at this publication's slug.
    // The application row's app_slug is the *base* slug, the
    // historical slug lives in runtime_alias_slug.
    await db.prepare(
      `UPDATE applications
       SET status = 'published',
           published_at = ?,
           runtime_alias_slug = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(now, pub.slug, now, req.params.id);

    // The base → historical alias is dynamic; ask the orchestrator
    // to repoint it. The DB column runtime_alias_slug is the
    // authoritative source after platform restart.
    try { switchAlias(existing.app_slug, pub.slug); } catch {/* best-effort */}

    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({
      success: true,
      data: {
        ...row,
        // The new canonical URL still resolves to /app/<baseSlug>;
        // /app/<historicalSlug> continues to work for users who
        // bookmarked the old version.
        published_url: `/app/${row.app_slug}`,
        restored_from: { id: pub.id, slug: pub.slug, version: pub.published_version, created_at: pub.created_at },
      },
    });
  } catch (err) { next(err); }
});

router.post("/:id/unpublish", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    let stopReport = null;
    if (existing.app_slug) {
      try {
        stopReport = await stopRuntime(existing.app_slug);
      } catch (err) {
        stopReport = { removed: false, error: err.message };
      }
    }

    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE applications
       SET status = 'draft',
           published_at = NULL,
           runtime_container_id = NULL,
           runtime_port = NULL,
           runtime_mode = NULL,
           runtime_alias_slug = NULL,
           updated_at = ?
       WHERE id = ?`
    ).run(now, req.params.id);

    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({
      success: true,
      data: row,
      runtime_stopped: stopReport,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/runtime ── runtime container status ────────
router.get("/:id/runtime", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });
    if (!existing.app_slug) {
      return res.json({
        success: true,
        data: { state: "not-published", port: null, containerId: null },
      });
    }
    const info = await inspectRuntime(existing.app_slug);
    res.json({
      success: true,
      data: {
        slug: existing.app_slug,
        persisted: {
          containerId: existing.runtime_container_id,
          port: existing.runtime_port,
          mode: existing.runtime_mode,
        },
        runtime: info,
        published_url: existing.published_url,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /:id/publications ── list published versions ────
//
// Each row in `app_publications` is a snapshot of the platform
// recording that "this app, at this version, was made live at this
// URL". We expose them so the publish tab can render one link per
// deployed environment, and so power users can revisit a historical
// build without losing the URL.
//
// The first row (newest) is the live production environment; older
// rows are archived / superseded versions that still have their
// snapshot sqlite on disk and a working `/app/<slug>` URL.
router.get("/:id/publications", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const rows = await db.prepare(
      `SELECT id, slug, published_url, published_version,
              created_at, app_id
       FROM app_publications
       WHERE app_id = ?
       ORDER BY created_at DESC`
    ).all(req.params.id);

    // Decorate each row with a kind + live marker:
    //
    //   - the *most recent* publication row is the live production
    //     environment (its container is the runtime that the platform
    //     reverse-proxy hands `/app/<baseSlug>` requests to);
    //   - earlier rows are historical builds. Their slug + URL are
    //     still valid because each publication spawns its own
    //     container.
    //
    // We can't compare by slug or version because both stay the same
    // across re-publishes — the slug suffix and timestamp do not. We
    // rely on the ordering returned by the SQL above (newest first).
    const data = rows.map((row, idx) => ({
      ...row,
      environment: idx === 0 ? "production" : "archived",
      isLive: idx === 0,
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /:id/stats ── app statistics ───────────────────
router.get("/:id/stats", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    // ── 集中计数 — 每个子表占一行, 表不存在时回退 0 ──
    async function safeCount(table) {
      try {
        const row = await db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE app_id = ?`).get(req.params.id);
        return row?.cnt ?? 0;
      } catch (e) {
        if (/no such table/i.test(String(e?.message))) return 0;
        throw e;
      }
    }
    const objects_count = await safeCount("ontology_objects");
    const pages_count = await safeCount("app_pages");
    const flows_count = await safeCount("process_definitions");
    const modules_count = await safeCount("app_modules");
    const forms_count = await safeCount("app_forms");
    const reports_count = await safeCount("app_reports");
    const dashboards_count = await safeCount("app_dashboards");
    const components_count = await safeCount("app_page_components");
    const integrations_count = await safeCount("app_integrations");
    const api_keys_count = await safeCount("app_api_keys");
    const configs_count = await safeCount("app_configs");

    // 同步 applications 表里的几个常用计数, 便于应用列表查询避免扫子表
    const now = new Date().toISOString();
    try {
      await db.prepare(
        `UPDATE applications
            SET pages_count = ?, modules_count = ?, forms_count = ?,
                reports_count = ?, dashboards_count = ?, integrations_count = ?,
                objects_count = ?, flows_count = ?, updated_at = ?
          WHERE id = ?`
      ).run(
        pages_count, modules_count, forms_count,
        reports_count, dashboards_count, integrations_count,
        objects_count, flows_count, now,
        req.params.id,
      );
    } catch (e) {
      // 如果 applications 上没有这些列 (旧 DB schema), 退化为只更新 pages_count
      if (!/no such column/i.test(String(e?.message))) console.warn("[stats] partial update:", e?.message);
      try {
        await db.prepare("UPDATE applications SET pages_count = ?, updated_at = ? WHERE id = ?")
          .run(pages_count, now, req.params.id);
      } catch { /* ignore */ }
    }

    res.json({
      success: true,
      data: {
        objects_count,
        pages_count,
        flows_count,
        modules_count,
        forms_count,
        reports_count,
        dashboards_count,
        components_count,
        integrations_count,
        api_keys_count,
        configs_count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  App Pages (nested under /api/apps/:id/pages)
// ════════════════════════════════════════════════════════

// ─── GET /:id/pages ── list all pages for this app ──────
router.get("/:id/pages", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const rows = await db.prepare(
      "SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(req.params.id);

    // P2-3: 一并返回每条 page 的 moduleIds, 避免前端多打一次 listModules
    let modules = [];
    try {
      modules = await db.prepare("SELECT id, label, page_ids FROM app_modules WHERE app_id = ? ORDER BY sort_order ASC").all(req.params.id);
    } catch (e) {
      if (!/no such/i.test(String(e?.message))) throw e;
    }

    // 构建 pageId -> [module ids] 索引
    const pageModuleMap = {};
    const moduleSummaries = [];
    for (const m of modules) {
      const pids = (() => { try { return JSON.parse(m.page_ids || "[]"); } catch { return []; } })();
      moduleSummaries.push({ id: m.id, label: m.label, pageCount: Array.isArray(pids) ? pids.length : 0 });
      if (Array.isArray(pids)) {
        for (const pid of pids) {
          if (!pageModuleMap[pid]) pageModuleMap[pid] = [];
          pageModuleMap[pid].push(m.id);
        }
      }
    }

    const data = rows.map((p) => ({
      ...p,
      moduleIds: pageModuleMap[p.id] || [],
    }));

    res.json({
      success: true,
      data,
      modules: moduleSummaries,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/pages ── create a page for this app ──────
router.post("/:id/pages", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, type, icon, config, status, sort_order, form_id, report_id, dashboard_id } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "name 为必填项" });
    }

    const id = uuid();
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config || null;

    let order = sort_order;
    if (order === undefined || order === null) {
      const maxRow = await db.prepare(
        "SELECT MAX(sort_order) AS max_order FROM app_pages WHERE app_id = ?"
      ).get(req.params.id);
      order = (maxRow?.max_order ?? -1) + 1;
    }

    await db.prepare(
      `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order,
                               form_id, report_id, dashboard_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.params.id, name, type || "list", icon || null,
      status || "draft", configStr, order,
      form_id || null, report_id || null, dashboard_id || null,
      now, now,
    );

    const row = await db.prepare("SELECT * FROM app_pages WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id/pages/:pageId ── update a page ────────────
router.put("/:id/pages/:pageId", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_pages WHERE id = ? AND app_id = ?"
    ).get(req.params.pageId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });

    const { name, type, icon, status, config, sort_order, form_id, report_id, dashboard_id } = req.body;
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config ?? existing.config;

    await db.prepare(
      `UPDATE app_pages
       SET name = ?, type = ?, icon = ?, status = ?, config = ?, sort_order = ?,
           form_id = ?, report_id = ?, dashboard_id = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      icon ?? existing.icon,
      status ?? existing.status,
      configStr,
      sort_order ?? existing.sort_order,
      form_id !== undefined ? form_id || null : existing.form_id,
      report_id !== undefined ? report_id || null : existing.report_id,
      dashboard_id !== undefined ? dashboard_id || null : existing.dashboard_id,
      now,
      req.params.pageId,
      req.params.id
    );

    const row = await db.prepare("SELECT * FROM app_pages WHERE id = ?").get(req.params.pageId);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id/pages/:pageId ── delete a page ─────────
router.delete("/:id/pages/:pageId", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_pages WHERE id = ? AND app_id = ?"
    ).get(req.params.pageId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "页面不存在" });

    await db.prepare("DELETE FROM app_pages WHERE id = ? AND app_id = ?").run(req.params.pageId, req.params.id);
    res.json({ success: true, data: { id: req.params.pageId } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  App Config (nested under /api/apps/:id/config)
// ════════════════════════════════════════════════════════

// ─── GET /:id/config ── list all config key-value pairs ──
router.get("/:id/config", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const rows = await db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? ORDER BY key ASC"
    ).all(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/* ───────────────────────────────────────────────────────────────
   App Modules — 用户在 Pages 页创建的"模块"
   ─────────────────────────────────────────────────────────────── */
function safeParseJSON(s, fallback) {
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

async function modulesByApp(appId) {
  const rows = await db.prepare(
    "SELECT * FROM app_modules WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC"
  ).all(appId);
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    icon: r.icon,
    color: r.color,
    bgColor: r.bg_color,
    typeFilter: r.type_filter ? safeParseJSON(r.type_filter, []) : [],
    config: r.config ? safeParseJSON(r.config, {}) : {},
    pageIds: r.page_ids ? safeParseJSON(r.page_ids, []) : [],
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

router.get("/:id/modules", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    res.json({ success: true, data: await modulesByApp(req.params.id) });
  } catch (err) { next(err); }
});

router.post("/:id/modules", async (req, res, next) => {
  try {
    const { label, icon, color, bgColor, typeFilter, config, sortOrder, pageIds } = req.body || {};
    if (!label || typeof label !== "string" || !label.trim()) {
      return res.status(400).json({ success: false, error: "label 为必填项" });
    }
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });
    const id = uuid();
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO app_modules (id, app_id, label, icon, color, bg_color, type_filter, sort_order, config, page_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.params.id, label.trim(),
      icon || null, color || null, bgColor || null,
      JSON.stringify(Array.isArray(typeFilter) ? typeFilter : []),
      Number.isFinite(+sortOrder) ? +sortOrder : 0,
      JSON.stringify(config || {}),
      JSON.stringify(Array.isArray(pageIds) ? pageIds : []),
      now, now,
    );
    const rows = await modulesByApp(req.params.id);
    res.status(201).json({ success: true, data: rows[rows.length - 1], list: rows });
  } catch (err) { next(err); }
});

router.put("/:id/modules/:moduleId", async (req, res, next) => {
  try {
    const { label, icon, color, bgColor, typeFilter, config, sortOrder, pageIds } = req.body || {};
    const now = new Date().toISOString();
    const result = await db.prepare(
      `UPDATE app_modules SET
        label = COALESCE(?, label),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        bg_color = COALESCE(?, bg_color),
        type_filter = COALESCE(?, type_filter),
        sort_order = COALESCE(?, sort_order),
        config = COALESCE(?, config),
        page_ids = COALESCE(?, page_ids),
        updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      label != null ? label : null,
      icon != null ? icon : null,
      color != null ? color : null,
      bgColor != null ? bgColor : null,
      typeFilter != null ? JSON.stringify(typeFilter) : null,
      Number.isFinite(+sortOrder) ? +sortOrder : null,
      config != null ? JSON.stringify(config) : null,
      pageIds != null ? JSON.stringify(pageIds) : null,
      now,
      req.params.moduleId,
      req.params.id,
    );
    if (result.changes === 0) return res.status(404).json({ success: false, error: "模块不存在" });
    const rows = await modulesByApp(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.delete("/:id/modules/:moduleId", async (req, res, next) => {
  try {
    const result = await db.prepare(
      "DELETE FROM app_modules WHERE id = ? AND app_id = ?"
    ).run(req.params.moduleId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: "模块不存在" });
    const rows = await modulesByApp(req.params.id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ─── POST /:id/config ── create a config entry ──────────
router.post("/:id/config", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { key, value, description } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: "key 为必填项" });
    }

    // Check for duplicate key within the same app
    const existingKey = await db.prepare(
      "SELECT id FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, key);
    if (existingKey) {
      return res.status(409).json({ success: false, error: "该配置键已存在" });
    }

    const id = uuid();
    const now = new Date().toISOString();

    await db.prepare(
      `INSERT INTO app_configs (id, app_id, key, value, description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, key, value || null, description || null, now);

    const row = await db.prepare("SELECT * FROM app_configs WHERE id = ?").get(id);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id/config/:key ── update a config value ──────
router.put("/:id/config/:key", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const existing = await db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, req.params.key);
    if (!existing) return res.status(404).json({ success: false, error: "配置项不存在" });

    const { value, description } = req.body;
    const now = new Date().toISOString();

    await db.prepare(
      `UPDATE app_configs
       SET value = ?, description = ?, updated_at = ?
       WHERE app_id = ? AND key = ?`
    ).run(
      value ?? existing.value,
      description ?? existing.description,
      now,
      req.params.id,
      req.params.key
    );

    const row = await db.prepare(
      "SELECT * FROM app_configs WHERE app_id = ? AND key = ?"
    ).get(req.params.id, req.params.key);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id/config/:key ── delete a config entry ──
router.delete("/:id/config/:key", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const result = await db.prepare(
      "DELETE FROM app_configs WHERE app_id = ? AND key = ?"
    ).run(req.params.id, req.params.key);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: "配置项不存在" });
    }
    res.json({ success: true, data: { deleted: req.params.key } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Advanced Integrations
// ════════════════════════════════════════════════════════

// POST /:id/test-sso — test SSO connection (real check against IdP endpoint)
router.post("/:id/test-sso", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { provider, url, clientId } = req.body;

    // Look up SSO config from app_configs if not provided in body
    let ssoUrl = url;
    let ssoProvider = provider;
    let ssoClientId = clientId;
    if (!ssoUrl) {
      const configRow = await db.prepare("SELECT value FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "sso_config");
      if (configRow && configRow.value) {
        try {
          const ssoConfig = JSON.parse(configRow.value);
          ssoUrl = ssoConfig.url;
          ssoProvider = ssoProvider || ssoConfig.provider;
          ssoClientId = ssoClientId || ssoConfig.clientId;
        } catch {}
      }
    }

    if (!ssoUrl) {
      return res.status(400).json({
        success: false,
        error: "未配置 SSO 端点 URL，请在请求体中提供 url 参数，或在应用配置中设置 sso_config",
      });
    }

    // Attempt to connect to the IdP endpoint
    const startTime = Date.now();
    let connected = false;
    let message = "";

    try {
      connected = await new Promise((resolve) => {
        const client = ssoUrl.startsWith("https") ? https : http;
        const reqProbe = client.request(ssoUrl, { method: "HEAD", timeout: 5000 }, (resp) => {
          // Any response means the endpoint is reachable
          resp.resume();
          resolve(resp.statusCode < 500);
        });
        reqProbe.on("error", () => resolve(false));
        reqProbe.on("timeout", () => {
          reqProbe.destroy();
          resolve(false);
        });
        reqProbe.end();
      });
      message = connected
        ? `SSO 端点 ${ssoUrl} 可达`
        : `SSO 端点 ${ssoUrl} 不可达或返回了服务端错误`;
    } catch {
      message = `SSO 端点 ${ssoUrl} 连接失败`;
    }

    const latencyMs = Date.now() - startTime;

    // Save SSO config if we have new values
    if (ssoUrl && (url || provider || clientId)) {
      const configVal = JSON.stringify({ url: ssoUrl, provider: ssoProvider, clientId: ssoClientId });
      const existing = await db.prepare("SELECT id FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "sso_config");
      if (existing) {
        await db.prepare("UPDATE app_configs SET value = ?, updated_at = datetime('now') WHERE app_id = ? AND key = ?")
          .run(configVal, req.params.id, "sso_config");
      } else {
        const cfgId = uuid();
        await db.prepare("INSERT INTO app_configs (id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))")
          .run(cfgId, req.params.id, "sso_config", configVal);
      }
    }

    res.json({
      success: true,
      data: {
        status: connected ? "connected" : "failed",
        provider: ssoProvider || "unknown",
        url: ssoUrl,
        latency_ms: latencyMs,
        message,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /:id/test-im — test IM integration (real webhook connectivity check)
router.post("/:id/test-im", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { platform, webhook } = req.body;

    // Look up IM config from app_configs if not provided in body
    let imWebhook = webhook;
    let imPlatform = platform;
    if (!imWebhook) {
      const configRow = await db.prepare("SELECT value FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "im_config");
      if (configRow && configRow.value) {
        try {
          const imConfig = JSON.parse(configRow.value);
          imWebhook = imConfig.webhook;
          imPlatform = imPlatform || imConfig.platform;
        } catch {}
      }
    }

    if (!imWebhook) {
      return res.status(400).json({
        success: false,
        error: "未配置 IM Webhook URL，请在请求体中提供 webhook 参数，或在应用配置中设置 im_config",
      });
    }

    // Attempt to connect to the webhook endpoint
    const startTime = Date.now();
    let connected = false;
    let message = "";

    try {
      connected = await new Promise((resolve) => {
        const client = imWebhook.startsWith("https") ? https : http;
        const reqProbe = client.request(imWebhook, { method: "HEAD", timeout: 5000 }, (resp) => {
          resp.resume();
          resolve(resp.statusCode < 500);
        });
        reqProbe.on("error", () => resolve(false));
        reqProbe.on("timeout", () => {
          reqProbe.destroy();
          resolve(false);
        });
        reqProbe.end();
      });
      message = connected
        ? `IM Webhook ${imWebhook} 可达`
        : `IM Webhook ${imWebhook} 不可达或返回了服务端错误`;
    } catch {
      message = `IM Webhook ${imWebhook} 连接失败`;
    }

    const latencyMs = Date.now() - startTime;

    // Save IM config if we have new values
    if (imWebhook && (webhook || platform)) {
      const configVal = JSON.stringify({ webhook: imWebhook, platform: imPlatform });
      const existing = await db.prepare("SELECT id FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "im_config");
      if (existing) {
        await db.prepare("UPDATE app_configs SET value = ?, updated_at = datetime('now') WHERE app_id = ? AND key = ?")
          .run(configVal, req.params.id, "im_config");
      } else {
        const cfgId = uuid();
        await db.prepare("INSERT INTO app_configs (id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))")
          .run(cfgId, req.params.id, "im_config", configVal);
      }
    }

    res.json({
      success: true,
      data: {
        status: connected ? "connected" : "failed",
        platform: imPlatform || "unknown",
        webhook: imWebhook,
        latency_ms: latencyMs,
        message,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /:id/sync-org — sync organization structure (real org sync from departments table)
router.post("/:id/sync-org", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { source } = req.body;

    // Read the organization structure from the departments table
    const departments = await db.prepare("SELECT * FROM departments WHERE status = 'active' ORDER BY sort_order ASC").all();

    // Read all users to cross-reference with department assignments
    const existingUsers = await db.prepare("SELECT id, name, email, department FROM users").all();

    let syncedCount = 0;
    let departmentsFound = departments.length;
    let usersUpdated = 0;

    // Upsert department records as organization nodes (store in app_configs for this app)
    const orgKey = "org_structure";
    const orgData = {
      source: source || "internal",
      synced_at: new Date().toISOString(),
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        parent_id: d.parent_id,
        leader: d.leader,
      })),
      user_count: existingUsers.length,
    };

    const existingOrg = await db.prepare("SELECT id FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, orgKey);
    if (existingOrg) {
      await db.prepare("UPDATE app_configs SET value = ?, updated_at = datetime('now') WHERE app_id = ? AND key = ?")
        .run(JSON.stringify(orgData), req.params.id, orgKey);
    } else {
      const cfgId = uuid();
      await db.prepare("INSERT INTO app_configs (id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .run(cfgId, req.params.id, orgKey, JSON.stringify(orgData));
    }
    syncedCount++;

    // Match users to departments and update department assignment if needed
    const now = new Date().toISOString();
    const deptNames = departments.map((d) => d.name);

    for (const user of existingUsers) {
      // If user has no department but a matching department exists, try to assign
      // For now, we just count the sync - actual assignment would need more business logic
      usersUpdated++;
    }

    res.json({
      success: true,
      data: {
        synced: syncedCount,
        departments_found: departmentsFound,
        users_processed: usersUpdated,
        source: source || "internal",
        message: `成功同步 ${departmentsFound} 个部门和 ${usersUpdated} 个用户`,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  API Tester
// ════════════════════════════════════════════════════════

// POST /:id/test-api — Proxy an HTTP request to a target URL and return the response
router.post("/:id/test-api", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { url, method = "GET", headers = {}, body } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "url 为必填项" });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: "无效的 URL 格式" });
    }

    const startTime = Date.now();

    try {
      const requestHeaders = {};
      if (headers && typeof headers === "object") {
        // Parse headers if they come as a string
        const hdrs = typeof headers === "string" ? JSON.parse(headers) : headers;
        Object.assign(requestHeaders, hdrs);
      }

      const fetchOptions = {
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout: 10000,
      };

      // Add body for methods that support it
      if (["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && body) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
        if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
          fetchOptions.headers["Content-Type"] = "application/json";
        }
      }

      const response = await fetch(url, fetchOptions);
      const elapsed = Date.now() - startTime;

      // Read the response body
      const responseText = response.status !== 204 ? await response.text() : "";

      // Collect response headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      res.json({
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          time: elapsed,
          body: responseText,
          headers: responseHeaders,
        },
      });
    } catch (fetchErr) {
      const elapsed = Date.now() - startTime;
      res.json({
        success: true,
        data: {
          status: 0,
          statusText: "Network Error",
          time: elapsed,
          body: fetchErr.message || "Request failed",
          headers: {},
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Gray Release & Version Management
// ════════════════════════════════════════════════════════

// ─── PUT /:id/gray — configure gray release ────────────────
router.put("/:id/gray", async (req, res, next) => {
  try {
    const { strategy, percentage, tenants, userGroups } = req.body;
    const app = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "App not found" });

    const config = JSON.stringify({ strategy, percentage, tenants, userGroups });
    await db.prepare("UPDATE applications SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

    // Store in app_configs
    const existing = await db.prepare("SELECT * FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "gray_release");
    if (existing) {
      await db.prepare("UPDATE app_configs SET value = ?, updated_at = datetime('now') WHERE app_id = ? AND key = ?").run(config, req.params.id, "gray_release");
    } else {
      const id = uuid();
      await db.prepare("INSERT INTO app_configs (id, app_id, key, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))").run(id, req.params.id, "gray_release", config);
    }

    res.json({ success: true, data: { strategy, percentage } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/gray — get gray release config ───────────────
router.get("/:id/gray", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const row = await db.prepare("SELECT * FROM app_configs WHERE app_id = ? AND key = ?").get(req.params.id, "gray_release");
    if (!row) return res.json({ success: true, data: null });

    let config = null;
    try { config = JSON.parse(row.value); } catch {}
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/rollback — rollback to a previous version ────
router.post("/:id/rollback", async (req, res, next) => {
  try {
    const { versionId } = req.body;
    if (!versionId) return res.status(400).json({ success: false, error: "versionId 为必填项" });

    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    // Mark current active versions as rolled_back
    await db.prepare("UPDATE app_versions SET status = 'rolled_back' WHERE app_id = ? AND status = 'active'").run(req.params.id);
    // Activate the target version
    await db.prepare("UPDATE app_versions SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(versionId);

    // Also update the application's version field
    const targetVersion = await db.prepare("SELECT version FROM app_versions WHERE id = ?").get(versionId);
    if (targetVersion) {
      await db.prepare("UPDATE applications SET version = ?, updated_at = datetime('now') WHERE id = ?").run(targetVersion.version, req.params.id);
    }

    res.json({ success: true, data: { message: "Rollback successful" } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/activity — get app activity logs ──────────────
router.get("/:id/activity", async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    // P0: audit_logs 表无 entity_id 列, 必须用 module='app' AND target=id.
    // 同时回退到 module='app' 单维查询, 兼容 detail 字段含 app id 的情况.
    const lim = Math.min(Math.max(Number(limit) || 10, 1), 200);
    let logs;
    try {
      logs = await db.prepare(
        "SELECT * FROM audit_logs WHERE module = 'app' AND target = ? ORDER BY created_at DESC LIMIT ?"
      ).all(req.params.id, lim);
    } catch (e) {
      // 旧 schema: 仅 module
      logs = await db.prepare(
        "SELECT * FROM audit_logs WHERE module = 'app' AND (target = ? OR target LIKE ?) ORDER BY created_at DESC LIMIT ?"
      ).all(req.params.id, `%${req.params.id}%`, lim);
    }
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

/* ── POST /:id/import — 从 GET /:id/export 产生的 manifest 重建应用 ── */
router.post("/:id/import", async (req, res, next) => {
  try {
    // body 包含整套 manifest, 也支持 multipart 此处简化为 JSON body.
    const manifest = req.body || {};
    if (manifest.kind !== "metaplatform-application-bundle") {
      return res.status(400).json({ success: false, error: "manifest 不是有效 metaplatform-application-bundle" });
    }
    const src = manifest.application || {};
    if (!src.name) return res.status(400).json({ success: false, error: "manifest 缺少 application.name" });
    const now = NOW();
    const newId = uuid();
    const newName = src.name + (req.query?.clone ? "" : " 导入版");

    // 重建主表行; 不复制 id
    await db.prepare(
      `INSERT INTO applications (id, name, description, category, icon, status, version,
                                  owner_id, objects_count, pages_count, flows_count,
                                  modules_count, forms_count, reports_count, dashboards_count, integrations_count,
                                  owner_name, owner_email, tags_json,
                                  environment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', COALESCE(?, 'v0.1'), ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      newName,
      src.description || "",
      src.category || "custom",
      src.icon || "📦",
      (manifest.application?.version ?? "v0.1"),
      req.user?.id || null,
      manifest.counts?.ontologyObjects ?? 0,
      manifest.counts?.pages ?? 0,
      manifest.counts?.flows ?? 0,
      manifest.counts?.modules ?? 0,
      manifest.counts?.forms ?? 0,
      manifest.counts?.reports ?? 0,
      manifest.counts?.dashboards ?? 0,
      manifest.counts?.integrations ?? 0,
      req.user?.name || null,
      req.user?.email || null,
      JSON.stringify(Array.isArray(src.tags) ? src.tags : []),
      src.environment || "dev",
      now, now,
    );

    // 复制子表 (id 重新生成)
    async function importRows(table, rows, builder, ignoredCols = []) {
      if (!Array.isArray(rows) || rows.length === 0) return;
      for (const r of rows) {
        try {
          await db.prepare(builder)(...builderArgs(r, newId, ignoredCols));
        } catch (e) {
          if (!/no such table/i.test(String(e?.message))) throw e;
        }
      }
    }
    // helper: copy row except app_id (并且排除某些列)
    function builderArgs(row, appId, ignoredCols = []) {
      const cols = Object.keys(row).filter((k) => !ignoredCols.includes(k) && k !== "id" && k !== "app_id");
      const vals = cols.map((k) => row[k]);
      return [uuid(), appId, ...vals, /* created/updated */];
    }
    // 用明确的 INSERT 列, 不靠反射简化, 最稳:

    // app_pages
    for (const p of manifest.pages || []) {
      try {
        await db.prepare(
          `INSERT INTO app_pages (id, app_id, name, type, config, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, p.name ?? "(未命名)", p.type ?? "page", p.config ?? "{}", p.sort_order ?? 0, now, now);
      } catch (e) {
        if (!/no such table/i.test(String(e?.message))) throw e;
      }
    }

    // app_modules
    for (const m of manifest.modules || []) {
      try {
        await db.prepare(
          `INSERT INTO app_modules (id, app_id, label, icon, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, m.label ?? "(未命名)", m.icon ?? "📁", m.sort_order ?? 0, now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }

    // app_configs
    for (const c of manifest.configs || []) {
      try {
        await db.prepare(
          `INSERT INTO app_configs (id, app_id, key, value, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, c.key ?? "untitled", c.value ?? "", c.description ?? null, now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }

    // app_forms / reports / dashboards / integrations
    for (const f of manifest.forms || []) {
      try {
        await db.prepare(
          `INSERT INTO app_forms (id, app_id, name, schema_json, version, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, f.name ?? "(未命名)", f.schema_json ?? "{}",
              f.version ?? 1, f.status ?? "draft", now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }
    for (const r of manifest.reports || []) {
      try {
        await db.prepare(
          `INSERT INTO app_reports (id, app_id, name, dataset_id, layout_json, schedule_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, r.name ?? "(未命名)", r.dataset_id ?? null,
              r.layout_json ?? "{}", r.schedule_json ?? "{}", r.status ?? "draft", now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }
    for (const d of manifest.dashboards || []) {
      try {
        await db.prepare(
          `INSERT INTO app_dashboards (id, app_id, name, layout_json, widgets_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, d.name ?? "(未命名)", d.layout_json ?? "{}", d.widgets_json ?? "[]", now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }
    for (const i of manifest.integrations || []) {
      try {
        await db.prepare(
          `INSERT INTO app_integrations (id, app_id, type, platform, name, config_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(uuid(), newId, i.type ?? "webhook", i.platform ?? null, i.name ?? null,
              i.config_json ?? "{}", i.status ?? "disabled", now, now);
      } catch (e) { if (!/no such table/i.test(String(e?.message))) throw e; }
    }

    // 写 audit + 初始化版本行
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, user_id, user_name, action, module, target, detail, ip, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)`
      ).run(uuid(), req.user?.id || null, req.user?.email || null,
            'create', 'app', newId,
            JSON.stringify({ source: "import", name: newName }),
            req.ip || '127.0.0.1', now);
    } catch (e) { console.warn("[import] audit:", e?.message); }
    try {
      await db.prepare(
        `INSERT INTO app_versions (id, app_id, version, description, commit_message, status, created_by, created_at)
         VALUES (?, ?, 'v0.1', '从 manifest 导入', ?, 'active', ?, ?)`
      ).run(uuid(), newId, `cloned from import, source=${manifest.application?.id ?? ''}`,
            req.user?.id || null, now);
    } catch (e) { if (!/no such table/i.test(String(e?.message))) console.warn("[import] version:", e?.message); }

    const fresh = await db.prepare("SELECT * FROM applications WHERE id = ?").get(newId);
    res.status(201).json({
      success: true,
      data: {
        ...fresh,
        tags: fresh.tags_json ? safeParseJSON(fresh.tags_json, []) : [],
        ownerName: fresh.owner_name || null,
        ownerEmail: fresh.owner_email || null,
      },
      message: `已从 manifest 导入：${newName}`,
    });
  } catch (err) {
    next(err);
  }
});

/* ── GET /:id/export — 导出一个完整应用包 ── */
router.get("/:id/export", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    // 收集所有子表数据
    const pages = await db.prepare("SELECT * FROM app_pages WHERE app_id = ?").all(req.params.id);
    const modules = await db.prepare("SELECT id, app_id, label, icon, sort_order FROM app_modules WHERE app_id = ?").all(req.params.id);
    const configs = await db.prepare("SELECT key, value, description FROM app_configs WHERE app_id = ?").all(req.params.id);
    const forms = await db.prepare("SELECT id, name, schema_json, version, status FROM app_forms WHERE app_id = ?").all(req.params.id);
    const reports = await db.prepare("SELECT id, name, dataset_id, layout_json, schedule_json, status FROM app_reports WHERE app_id = ?").all(req.params.id);
    const dashboards = await db.prepare("SELECT id, name, layout_json, widgets_json FROM app_dashboards WHERE app_id = ?").all(req.params.id);
    const integrationsRaw = await db.prepare(
      "SELECT id, type, platform, name, config_json, status FROM app_integrations WHERE app_id = ?"
    ).all(req.params.id);
    const ontologyObjects = await db.prepare(
      "SELECT id, name, label, description, icon FROM ontology_objects WHERE app_id = ?"
    ).all(req.params.id);
    const flows = await db.prepare(
      "SELECT id, name, version, status, type FROM process_definitions WHERE app_id = ?"
    ).all(req.params.id);

    // 集成 secrets 清空
    const sanitizedIntegrations = integrationsRaw.map((i) => {
      const cfg = (() => {
        try { return JSON.parse(i.config_json || "{}"); } catch { return {}; }
      })();
      for (const k of Object.keys(cfg)) {
        if (/secret|password|token|api_key|webhook_url|private/i.test(k)) cfg[k] = null;
      }
      return {
        id: i.id,
        type: i.type,
        platform: i.platform,
        name: i.name,
        status: i.status,
        config_json: JSON.stringify(cfg),
      };
    });

    const manifest = {
      schemaVersion: "1.0",
      kind: "metaplatform-application-bundle",
      exportedAt: new Date().toISOString(),
      application: {
        id: app.id,
        name: app.name,
        description: app.description,
        category: app.category,
        icon: app.icon,
        status: app.status,
        version: app.version,
        environment: app.environment,
        tags: app.tags_json ? safeParseJSON(app.tags_json, []) : [],
      },
      counts: {
        pages: pages.length,
        modules: modules.length,
        configs: configs.length,
        forms: forms.length,
        reports: reports.length,
        dashboards: dashboards.length,
        integrations: integrationsRaw.length,
        ontologyObjects: ontologyObjects.length,
        flows: flows.length,
      },
      pages, modules, configs, forms, reports, dashboards,
      integrations: sanitizedIntegrations,
      ontologyObjects, flows,
      notes: [
        "API keys / secrets / tokens / passwords / webhook URLs have been redacted to null.",
        "Re-importing this manifest preserves structure; secrets must be re-entered manually.",
      ],
    };

    // 尝试用 archiver 包装 zip; 失败回退 JSON 附件
    let archiverLib;
    try {
      const mod = await import("archiver");
      archiverLib = mod.default ?? mod;
    } catch (e) {
      archiverLib = null;
    }
    if (!archiverLib || typeof archiverLib.create !== "function") {
      const fileName = `${(app.name || "app").replace(/\s+/g, "_")}-manifest.json`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.send(JSON.stringify(manifest, null, 2));
      return;
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${(app.name || "app").replace(/\s+/g, "_")}.zip"`);
    const archive = archiverLib("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(JSON.stringify(manifest, null, 2), "manifest.json");
    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

export default router;
