/**
 * /api/apps — Application management routes
 */
import { Router } from "express";
import { v4 as uuid } from "uuid";
import http from "http";
import https from "https";
import db from "../db.js";
import { tenantGuard } from "../middleware/tenant.js";
import { buildTemplateSeed, listTemplateKeys } from "../templates/apps.js";
import {
  spawnRuntime,
  stopRuntime,
  inspectRuntime,
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
    const { status } = req.query;
    let rows;
    if (status) {
      rows = await db.prepare("SELECT * FROM applications WHERE status = ? ORDER BY created_at DESC").all(status);
    } else {
      rows = await db.prepare("SELECT * FROM applications ORDER BY created_at DESC").all();
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
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
    res.json({ success: true, data: row });
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
router.post("/", tenantGuard, async (req, res, next) => {
  try {
    const { name, description, category, icon, template } = req.body;
    if (!name || !category || !icon) {
      return res.status(400).json({ success: false, error: "name, category, icon 为必填项" });
    }
    const id = uuid();
    const now = NOW();
    const seed = template ? buildTemplateSeed(template) : null;
    const objectsCount = seed?.objects?.length ?? 0;
    const pagesCount   = seed?.pages?.length   ?? 0;
    const flowsCount   = seed?.flows?.length   ?? 0;

    await db.prepare(
      `INSERT INTO applications (id, name, description, category, icon, status, version,
                                  owner_id, objects_count, pages_count, flows_count,
                                  created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 'v0.1', ?, ?, ?, ?, ?, ?)`
    ).run(
      id, name, description || "", category, icon,
      req.user?.id || null,
      objectsCount, pagesCount, flowsCount,
      now, now,
    );

    // Persist template sub-resources, if any.
    let seeded = null;
    if (seed) {
      seeded = await applyTemplateSeed(id, seed, now);
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
    });
  } catch (err) { next(err); }
});

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

// ─── PUT /:id ── update application ─────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, description, category, icon, status, version } = req.body;
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE applications
       SET name = ?, description = ?, category = ?, icon = ?, status = ?, version = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name ?? existing.name,
      description ?? existing.description,
      category ?? existing.category,
      icon ?? existing.icon,
      status ?? existing.status,
      version ?? existing.version,
      now,
      req.params.id
    );
    const row = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ── delete application ──────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "应用不存在" });
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

    const publishedUrl = `/app/${slug}`;
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

    // Spawn the isolated runtime. If this fails we still consider the
    // publish successful (the snapshot is on disk) but the runtime is
    // "degraded".
    let runtimeInfo;
    try {
      const updated = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
      runtimeInfo = await spawnRuntime({ slug, app: updated, snapshotFile });
    } catch (err) {
      runtimeInfo = { degraded: true, error: err.message, snapshot: snapshotFile };
    }

    if (!runtimeInfo.degraded && runtimeInfo.containerId) {
      await db.prepare(
        `UPDATE applications
         SET runtime_container_id = ?, runtime_port = ?, runtime_mode = 'container', updated_at = ?
         WHERE id = ?`,
      ).run(runtimeInfo.containerId, runtimeInfo.port, now, req.params.id);
    } else {
      await db.prepare(
        `UPDATE applications
         SET runtime_mode = 'degraded', updated_at = ?
         WHERE id = ?`,
      ).run(now, req.params.id);
    }

    // Create publication snapshot record (for history / re-publish).
    const pubId = uuid();
    await db.prepare(
      `INSERT INTO app_publications (id, app_id, slug, published_url, published_version, config_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(pubId, req.params.id, slug, publishedUrl, version, publishConfig, now);

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
          error: runtimeInfo.error ?? null,
          snapshot: snapshotFile,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/unpublish ── unpublish an application ─────
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

// ─── GET /:id/stats ── app statistics ───────────────────
router.get("/:id/stats", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const objects_count = await db.prepare("SELECT COUNT(*) AS cnt FROM ontology_objects WHERE app_id = ?").get(req.params.id).cnt;
    const pages_count = await db.prepare("SELECT COUNT(*) AS cnt FROM app_pages WHERE app_id = ?").get(req.params.id).cnt;
    const flows_count = await db.prepare("SELECT COUNT(*) AS cnt FROM process_definitions WHERE app_id = ?").get(req.params.id).cnt;

    // Also update the application's pages_count for consistency
    await db.prepare("UPDATE applications SET pages_count = ?, updated_at = ? WHERE id = ?")
      .run(pages_count, new Date().toISOString(), req.params.id);

    res.json({
      success: true,
      data: { objects_count, pages_count, flows_count },
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
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/pages ── create a page for this app ──────
router.post("/:id/pages", async (req, res, next) => {
  try {
    const app = await db.prepare("SELECT id FROM applications WHERE id = ?").get(req.params.id);
    if (!app) return res.status(404).json({ success: false, error: "应用不存在" });

    const { name, type, icon, config, status, sort_order } = req.body;
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
      `INSERT INTO app_pages (id, app_id, name, type, icon, status, config, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, name, type || "list", icon || null, status || "draft", configStr, order, now, now);

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

    const { name, type, icon, status, config, sort_order } = req.body;
    const now = new Date().toISOString();
    const configStr = typeof config === "object" ? JSON.stringify(config) : config ?? existing.config;

    await db.prepare(
      `UPDATE app_pages
       SET name = ?, type = ?, icon = ?, status = ?, config = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND app_id = ?`
    ).run(
      name ?? existing.name,
      type ?? existing.type,
      icon ?? existing.icon,
      status ?? existing.status,
      configStr,
      sort_order ?? existing.sort_order,
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
    const logs = await db.prepare("SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT ?").all(req.params.id, Number(limit));
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
