/**
 * /api/flowable — Transparent proxy to Flowable 8 REST API.
 *
 * Every /api/flowable/<x> call is forwarded as-is to the Flowable engine
 * at <FLOWABLE_REST_URL><x>, preserving method, query params, headers
 * (Content-Type for multipart, Accept, etc.), and raw body bytes.
 *
 * Response shape is wrapped in { success, data } for the API's standard
 * envelope (matches the rest of the MetaPlatform API).
 */
import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const FLOWABLE_BASE =
  process.env.FLOWABLE_REST_URL || "http://localhost:8081/flowable-rest/service";
const FLOWABLE_AUTH = "Basic " + Buffer.from("admin:test").toString("base64");

/**
 * Strip "/api/flowable" or "/flowable" prefix from req.path so we get the
 * bare Flowable path (e.g. "/runtime/tasks" from "/api/flowable/runtime/tasks").
 */
function flowablePath(req) {
  return req.path.replace(/^\/api\/flowable/, "").replace(/^\/flowable/, "");
}

async function proxyToFlowable(req, res, { method, path, body, rawBody, contentType } = {}) {
  const url = new URL(`${FLOWABLE_BASE}${path}`);

  for (const [k, v] of Object.entries(req.query || {})) {
    url.searchParams.set(k, v);
  }

  const headers = { Authorization: FLOWABLE_AUTH };

  const fetchOpts = { method: method || req.method, headers };

  if (rawBody) {
    // Caller supplied pre-built bytes (e.g. multipart) — pass through.
    if (contentType) headers["Content-Type"] = contentType;
    fetchOpts.body = rawBody;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(body);
  } else if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    // JSON body from upstream client — let fetch set content-type
    fetchOpts.body = JSON.stringify(req.body);
    headers["Content-Type"] = "application/json";
  }

  try {
    const upstream = await fetch(url.toString(), fetchOpts);
    const text = await upstream.text();

    if (!text || upstream.status === 204) {
      return res.status(upstream.status).json({ success: true, data: null });
    }

    // Try JSON first
    try {
      const json = JSON.parse(text);
      if (!upstream.ok) {
        return res.status(upstream.status).json({
          success: false,
          error: json.message || json.exception || text,
        });
      }
      return res.json({ success: true, data: json });
    } catch {
      // Non-JSON (BPMN XML, raw bytes, etc.) — wrap as data string
      return res
        .status(upstream.status)
        .json({ success: upstream.ok, data: text });
    }
  } catch (err) {
    console.error("[Flowable Proxy Error]", err.message);
    return res.status(502).json({
      success: false,
      error: "Flowable 服务不可达: " + err.message,
    });
  }
}

// ─── Multipart deploy helper ────────────────────────────────────
// Frontend sends JSON { name, bpmnXml, tenantId? }; we wrap the BPMN XML
// into a multipart/form-data POST to Flowable 8's /repository/deployments
// endpoint, which is the only way to deploy via REST in v8.
//
// IMPORTANT: Flowable 8's strict XML parser rejects UTF-8 BOM (the EF BB BF
// byte-order-mark PowerShell / Notepad sometimes prepend). Strip any leading
// whitespace + BOM before assembling the multipart body.
function handleDeploy(req, res) {
  const { name, bpmnXml, tenantId } = req.body || {};
  if (!name || !bpmnXml) {
    return res.status(400).json({
      success: false,
      error: "需要 { name, bpmnXml } 两个字段",
    });
  }

  // Strip UTF-8 BOM and leading whitespace so Flowable's XMLStreamReader
  // doesn't throw "Content is not allowed in prolog".
  const cleanedXml = bpmnXml.replace(/^\uFEFF/, "").replace(/^\s+/, "");

  const boundary = "----FlowableBoundary" + Date.now();
  const parts = [];

  parts.push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${name}.bpmn20.xml"\r\n` +
      `Content-Type: application/xml\r\n\r\n`
  );
  parts.push(cleanedXml);
  parts.push(`\r\n--${boundary}--\r\n`);

  const rawBody = Buffer.concat(
    parts.map((p) => (typeof p === "string" ? Buffer.from(p, "utf-8") : p))
  );

  return proxyToFlowable(req, res, {
    method: "POST",
    path: "/repository/deployments",
    rawBody,
    contentType: `multipart/form-data; boundary=${boundary}`,
  });
}

// ─── Catch-all transparent proxy ────────────────────────────────
// Order matters: specific routes first, then catch-all for everything
// else. The catch-all forwards the request verb + body verbatim.

router.post("/deployments", upload.single("file"), handleDeploy);

// All other verbs go through this catch-all.
router.all(/^\/(?!deployments).*/, async (req, res) => {
  // POST/PUT/DELETE that arrive without a body should still get a body slot.
  return proxyToFlowable(req, res, { method: req.method, path: flowablePath(req) });
});

export default router;