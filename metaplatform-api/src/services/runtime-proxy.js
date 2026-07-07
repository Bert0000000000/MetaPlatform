/**
 * Reverse-proxy middleware.
 *
 * The PublishedApp page lives at `/app/:slug` on the platform frontend.
 * We want every published app to be served from a *dedicated* Docker
 * container, not from the platform process. So the platform's express
 * server intercepts any `/app/:slug/*` request, asks the orchestrator
 * where the slug lives (container / degraded-snapshot / missing), and
 * either:
 *
 *   - forwards the request to the right container port,
 *   - serves a degraded read-only response from the platform process
 *     using a small inline sqlite handle, or
 *   - returns 503 telling the user the app hasn't been published.
 *
 * Per-app isolation is the headline behavior of this middleware: a
 * runaway or buggy runtime container cannot touch the platform data,
 * the platform process, or any other runtime.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import http from "node:http";
import { snapshotPath } from "../services/publish-snapshot.js";
import { resolveTarget } from "../services/runtime-orchestrator.js";

/**
 * Forward a single request to the runtime container behind `port`.
 * Both req and res are streamed directly so behavior matches a
 * typical HTTP proxy (no buffering, no body parsing).
 */
function forwardToContainer(req, res, port) {
  const upstreamPath = req.originalUrl.replace(/^\/app\/[^/]+/, "") || "/";
  const options = {
    host: "127.0.0.1",
    port,
    method: req.method,
    path: upstreamPath + (req.url.includes("?") ? "" : ""),
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
  };
  const upstream = http.request(options, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: `Runtime unreachable: ${err.message}` });
    } else {
      res.end();
    }
  });
  req.pipe(upstream);
}

/**
 * Read-only HTTP-style handler that pulls answers from the per-app
 * snapshot sqlite. We only implement the small handful of routes the
 * PublishedApp page actually uses — anything else returns 404 to keep
 * the surface tight.
 */
function mountDegradedApp(app, slug, snapshot) {
  const db = new Database(snapshot, { fileMustExist: true, readonly: true });
  app.get("/app/slug/:slug", (req, res) => {
    const row = db.prepare("SELECT * FROM applications WHERE app_slug = ? AND status = 'published'").get(req.params.slug);
    if (!row) return res.status(404).json({ success: false, error: "Application not found" });
    let pages = [];
    if (row.publish_config) { try { pages = JSON.parse(row.publish_config).pages || []; } catch {} }
    if (!pages.length) {
      pages = db.prepare("SELECT id, name, type, icon, sort_order FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC").all(row.id);
    }
    res.json({ success: true, data: { ...row, pages } });
  });
  app.get("/ontology/objects", (req, res) => {
    const { app_id } = req.query;
    const rows = app_id
      ? db.prepare("SELECT * FROM ontology_objects WHERE app_id = ? ORDER BY created_at DESC").all(app_id)
      : db.prepare("SELECT * FROM ontology_objects ORDER BY created_at DESC").all();
    res.json({ success: true, data: rows });
  });
  app.get("/ontology/objects/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM ontology_objects WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Object not found" });
    res.json({ success: true, data: row });
  });
  app.get("/ontology/objects/:id/properties", (req, res) => {
    const rows = db.prepare("SELECT * FROM ontology_properties WHERE object_id = ? ORDER BY sort_order ASC, created_at ASC").all(req.params.id);
    res.json({ success: true, data: rows });
  });
  app.get("/apps/:id/pages", (req, res) => {
    const rows = db.prepare("SELECT * FROM app_pages WHERE app_id = ? ORDER BY sort_order ASC, created_at ASC").all(req.params.id);
    res.json({ success: true, data: rows });
  });
  app.get("/processes", (req, res) => {
    const { app_id } = req.query;
    let sql = "SELECT * FROM process_definitions WHERE 1=1";
    const params = [];
    if (app_id) { sql += " AND app_id = ?"; params.push(app_id); }
    sql += " ORDER BY created_at DESC";
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  });
  app.get("/processes/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM process_definitions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: "Process not found" });
    res.json({ success: true, data: row });
  });
  app.get("/health", (_req, res) => res.json({ success: true, data: { snapshot: snapshot, mode: "degraded" } }));
}

export function runtimeProxy(options = {}) {
  const router = express.Router();

  router.use(async (req, res, next) => {
    // Only react to /app/:slug and /api/... paths the runtime would
    // understand. Anything else falls through to the platform API.
    const appMatch = /^\/app\/([^/]+)(\/.*)?$/.exec(req.path);
    if (!appMatch) return next();

    const slug = appMatch[1];
    const target = await resolveTarget(slug);

    if (target.mode === "container") {
      return forwardToContainer(req, res, target.port);
    }
    if (target.mode === "degraded") {
      // Recurse into an inline router scoped to this slug. The slug
      // becomes part of the URL the renderer sees (so the PublishedApp
      // page behaves identically whether the runtime was a container
      // or the in-process fallback).
      const subApp = express();
      mountDegradedApp(subApp, slug, target.snapshot);
      const subReq = Object.create(req);
      subReq.url = req.originalUrl.replace(/^\/app\/[^/]+/, "");
      subReq.originalUrl = subReq.url;
      subReq.baseUrl = "";
      subReq.path = subReq.url.split("?")[0];
      return subApp.handle(subReq, res, next);
    }
    res.status(503).json({
      success: false,
      error: `App "${slug}" has not been published yet.`,
    });
  });

  return router;
}
