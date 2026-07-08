/**
 * Tiny access-log middleware for the runtime.
 *
 * Goal: produce structured JSON lines to stdout so the platform's
 * log shipper (Loki / Promtail / Datadog Agent) can pick them up
 * without per-app config. We do NOT log request bodies — the
 * runtime is read-only data and bodies would just be a privacy
 * risk. We also do NOT log paths that contain secrets.
 *
 * Format: one JSON object per request
 *   {
 *     t:        ISO timestamp,
 *     rid:      random request id,
 *     app:      app_id (from RUNTIME_META),
 *     slug:     app_slug (from RUNTIME_META),
 *     pod:      POD_NAME env (k8s),
 *     ns:       POD_NAMESPACE env (k8s),
 *     method:   GET/POST/...,
 *     path:     req.path,
 *     qs:       req.originalUrl (no body),
 *     status:   res.statusCode,
 *     bytes:    bytes written,
 *     ms:       duration in ms,
 *     ip:       client IP (x-forwarded-for aware),
 *     ua:       user agent
 *   }
 *
 * We expose no Prometheus counters in the runtime itself (the
 * `ServiceMonitor` is wired for `/metrics` in a follow-up patch);
 * the access log is intentionally minimal.
 */
import crypto from "node:crypto";

export function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  const rid = crypto.randomBytes(6).toString("hex");
  res.locals.rid = rid;
  res.setHeader("x-request-id", rid);

  // Path blacklist — never log these even if someone hits them.
  // Defends against admin-token leakage via log aggregators.
  const secretPath = /^\/(health|metrics|admin)(\/|$)/;
  if (secretPath.test(req.path)) {
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const line = {
        t: new Date().toISOString(),
        rid,
        app: process.env.APP_ID,
        slug: process.env.APP_SLUG,
        pod: process.env.POD_NAME,
        ns: process.env.POD_NAMESPACE,
        method: req.method,
        path: "<redacted>",
        status: res.statusCode,
        ms: Math.round(ms * 10) / 10,
        ip: clientIp(req),
      };
      console.log(JSON.stringify({ evt: "access", ...line }));
    });
    return next();
  }

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = {
      t: new Date().toISOString(),
      rid,
      app: process.env.APP_ID,
      slug: process.env.APP_SLUG,
      pod: process.env.POD_NAME,
      ns: process.env.POD_NAMESPACE,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      bytes: Number(res.getHeader("content-length") || 0),
      ms: Math.round(ms * 10) / 10,
      ip: clientIp(req),
      ua: (req.headers["user-agent"] || "").slice(0, 120),
    };
    console.log(JSON.stringify({ evt: "access", ...line }));
  });
  next();
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) {
    return fwd.split(",")[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || "").slice(0, 64);
}
