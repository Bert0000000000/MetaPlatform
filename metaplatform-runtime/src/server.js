/**
 * Runtime entrypoint.
 *
 * The image is built to be the smallest possible HTTP shell:
 *   - single Express app
 *   - single SQLite handle
 *   - one GET-only API surface
 *   - listening on 0.0.0.0:3000 by default (overridable with PORT)
 *
 * No auth, no admin, no outbound network, no background jobs. If you
 * want to add features, take them to the platform process instead.
 */
import express from "express";
import cors from "cors";
import routes from "./routes.js";
import { RUNTIME_META } from "./runtime-db.js";
import { accessLog } from "./access-log.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.disable("x-powered-by");
app.disable("etag");
app.set("trust proxy", true);            // honour X-Forwarded-For for ip logging
app.use(accessLog);                      // FIRST — log everything
app.use(cors({ exposedHeaders: ["x-request-id"] }));
app.use(express.json({ limit: "256kb" })); // runtime never takes large bodies
app.use("/", routes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      runtime: "metaplatform-runtime",
      version: "0.1.0",
      ...RUNTIME_META,
    },
  });
});

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    level: "info",
    msg: "runtime.started",
    slug: RUNTIME_META.app_slug,
    app_id: RUNTIME_META.app_id,
    port: PORT,
    host: HOST,
  }));
});

/**
 * Graceful shutdown. The platform orchestrator sends SIGTERM when it
 * needs to stop or replace this runtime; we close the HTTP socket
 * and let SQLite flush before the kernel takes us down.
 */
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", msg: "runtime.shutdown", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
