/**
 * /api/flowable — Flowable BPMN REST API proxy
 */
import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const FLOWABLE_BASE = process.env.FLOWABLE_REST_URL || "http://localhost:8081/flowable-rest/service";
const FLOWABLE_AUTH = "Basic " + Buffer.from("admin:test").toString("base64");

/**
 * Generic proxy helper — forwards request to Flowable REST API
 */
async function proxyToFlowable(req, res, { method = "GET", path, body, contentType, rawBody } = {}) {
  const url = new URL(`${FLOWABLE_BASE}${path}`);

  // Forward query parameters
  for (const [key, value] of Object.entries(req.query)) {
    url.searchParams.set(key, value);
  }

  const headers = {
    Authorization: FLOWABLE_AUTH,
  };

  const fetchOpts = { method, headers };

  if (rawBody) {
    // Raw binary / multipart body
    headers["Content-Type"] = contentType;
    fetchOpts.body = rawBody;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), fetchOpts);
    const text = await response.text();

    // Some Flowable endpoints return empty body on 204
    if (!text || response.status === 204) {
      return res.status(response.status).json({ success: true, data: null });
    }

    try {
      const json = JSON.parse(text);
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: json.message || text });
      }
      return res.json({ success: true, data: json });
    } catch {
      // Non-JSON response (e.g. XML)
      return res.status(response.status).json({ success: response.ok, data: text });
    }
  } catch (err) {
    console.error("[Flowable Proxy Error]", err.message);
    return res.status(502).json({ success: false, error: "Flowable 服务不可达: " + err.message });
  }
}

// ─── Deployments ──────────────────────────────────────────

/**
 * POST /process-definitions/deploy — Deploy BPMN XML
 * Expects multipart form with field "file" containing the .bpmn or .bpmn20.xml file
 */
router.post("/process-definitions/deploy", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "请上传 BPMN 文件 (field: file)" });
  }

  const boundary = "----FlowableBoundary" + Date.now();
  const fileName = req.file.originalname || "process.bpmn";

  // Build multipart body manually (lightweight, no extra dependency)
  const parts = [];
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/xml\r\n\r\n`
  );
  parts.push(req.file.buffer);
  parts.push(`\r\n--${boundary}--\r\n`);

  const rawBody = Buffer.concat(parts.map(p => (typeof p === "string" ? Buffer.from(p) : p)));

  return proxyToFlowable(req, res, {
    method: "POST",
    path: "/deployments",
    rawBody,
    contentType: `multipart/form-data; boundary=${boundary}`,
  });
});

// ─── Process Definitions ──────────────────────────────────

/** GET /process-definitions — List deployed process definitions */
router.get("/process-definitions", async (req, res) => {
  return proxyToFlowable(req, res, { path: "/repository/process-definitions" });
});

/** GET /process-definitions/:id — Get single process definition */
router.get("/process-definitions/:id", async (req, res) => {
  return proxyToFlowable(req, res, { path: `/repository/process-definitions/${req.params.id}` });
});

/** GET /process-definitions/:id/xml — Get BPMN XML */
router.get("/process-definitions/:id/xml", async (req, res) => {
  return proxyToFlowable(req, res, { path: `/repository/process-definitions/${req.params.id}/resourcedata` });
});

/** DELETE /deployments/:id — Delete a deployment */
router.delete("/deployments/:id", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "DELETE",
    path: `/repository/deployments/${req.params.id}`,
  });
});

// ─── Process Instances ────────────────────────────────────

/** POST /process-instances — Start a process instance */
router.post("/process-instances", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "POST",
    path: "/runtime/process-instances",
    body: req.body,
  });
});

/** GET /process-instances — List process instances */
router.get("/process-instances", async (req, res) => {
  return proxyToFlowable(req, res, { path: "/runtime/process-instances" });
});

/** GET /process-instances/:id — Get single instance details */
router.get("/process-instances/:id", async (req, res) => {
  return proxyToFlowable(req, res, { path: `/runtime/process-instances/${req.params.id}` });
});

/** DELETE /process-instances/:id — Cancel an instance */
router.delete("/process-instances/:id", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "DELETE",
    path: `/runtime/process-instances/${req.params.id}`,
  });
});

// ─── Tasks ────────────────────────────────────────────────

/** GET /tasks — List tasks (with optional assignee filter) */
router.get("/tasks", async (req, res) => {
  return proxyToFlowable(req, res, { path: "/runtime/tasks" });
});

/** POST /tasks/:id/complete — Complete a task with variables */
router.post("/tasks/:id/complete", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "POST",
    path: `/runtime/tasks/${req.params.id}`,
    body: { action: "complete", variables: req.body.variables || [] },
  });
});

/** POST /tasks/:id/claim — Claim a task */
router.post("/tasks/:id/claim", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "POST",
    path: `/runtime/tasks/${req.params.id}`,
    body: { action: "claim", assignee: req.body.assignee },
  });
});

/** POST /tasks/:id/delegate — Delegate a task */
router.post("/tasks/:id/delegate", async (req, res) => {
  return proxyToFlowable(req, res, {
    method: "POST",
    path: `/runtime/tasks/${req.params.id}`,
    body: { action: "delegate", assignee: req.body.assignee },
  });
});

// ─── History ──────────────────────────────────────────────

/** GET /history/process-instances — List historical process instances */
router.get("/history/process-instances", async (req, res) => {
  return proxyToFlowable(req, res, { path: "/history/historic-process-instances" });
});

// GET /processes — alias for process-definitions (proxied to Flowable REST)
router.get("/processes", async (req, res) => {
  return proxyToFlowable(req, res, { path: "/repository/process-definitions" });
});

export default router;
