/**
 * Mate Platform BFF (ST-6.4.1 / ST-6.4.2).
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./env.js";
import { register_routes, type RouteConfig } from "./modes.js";

const ROUTES: RouteConfig[] = [
  { method: "GET", path: "/api/v1/iam/users", upstream: "/api/v1/iam/users" },
  { method: "GET", path: "/api/v1/kb/knowledge-bases", upstream: "/api/v1/kb/knowledge-bases" },
  { method: "POST", path: "/api/v1/kb/knowledge-bases", upstream: "/api/v1/kb/knowledge-bases" },
  { method: "GET", path: "/api/v1/ont/classes", upstream: "/api/v1/ont/classes" },
  { method: "GET", path: "/api/v1/rag/search", upstream: "/api/v1/rag/search" },
  { method: "POST", path: "/api/v1/agent/chat", upstream: "/api/v1/agent/chat" },
  { method: "POST", path: "/api/v1/agent/chat/stream", upstream: "/api/v1/agent/chat/stream" },
  { method: "POST", path: "/api/v1/llmgw/chat", upstream: "/api/v1/llmgw/chat" },
  { method: "GET", path: "/api/v1/msg/topics", upstream: "/api/v1/msg/topics" },
];

async function build() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  app.get("/healthz", async () => ({
    status: "ok",
    api_mode: env.API_MODE,
    upstream: env.UPSTREAM_BASE,
  }));

  register_routes(app, ROUTES);
  return app;
}

async function start() {
  const app = await build();
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info({ api_mode: env.API_MODE, port: env.PORT }, "BFF started");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();