/**
 * MetaPlatform API — Main entry point
 */
import express from "express";
import cors from "cors";
import { authenticate } from "./middleware/auth.js";

/**
 * Wrap an async Express route handler so thrown/rejected errors
 * are forwarded to the Express error-handling middleware.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
import authRoutes from "./routes/auth.js";
import appsRoutes from "./routes/apps.js";
import ontologyRoutes from "./routes/ontology.js";
import processesRoutes from "./routes/processes.js";
import dataRoutes from "./routes/data.js";
import knowledgeRoutes from "./routes/knowledge.js";
import agentsRoutes from "./routes/agents.js";
import adminRoutes from "./routes/admin.js";
import messagesRoutes from "./routes/messages.js";
import flowableRoutes from "./routes/flowable.js";
import pagesRoutes from "./routes/pages.js";
import exportRoutes from "./routes/export.js";
import llmRoutes from "./routes/llm.js";
import dispatchRoutes from "./routes/dispatch.js";
import announcementsRoutes from "./routes/announcements.js";
import todosRoutes from "./routes/todos.js";
import qualityRoutes from "./routes/quality.js";
import versionsRoutes from "./routes/versions.js";
import triggersRoutes from "./routes/triggers.js";
import exportHistoryRoutes from "./routes/export-history.js";
import knowledgeQaRoutes from "./routes/knowledge-qa.js";
import knowledgeGraphRoutes from "./routes/knowledge-graph.js";
import marketRoutes from "./routes/market.js";
import filesystemRoutes from "./routes/filesystem.js";
import orchestrationsRoutes from "./routes/orchestrations.js";
import ocrRoutes from "./routes/ocr.js";
import architectureRoutes from "./routes/architecture.js";
import { cacheMiddleware, redisHealthCheck } from "./middleware/cache.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────
app.use(cors());                          // Allow all origins (dev mode)
app.use(express.json());                  // Parse JSON bodies
app.use(authenticate);                    // JWT authentication

// ─── Routes (with Redis cache for read-heavy endpoints) ─
app.use("/api/auth", authRoutes);
app.use("/api/apps", cacheMiddleware(30), appsRoutes);
app.use("/api/ontology", cacheMiddleware(30), ontologyRoutes);
app.use("/api/processes", cacheMiddleware(30), processesRoutes);
app.use("/api/data", cacheMiddleware(30), dataRoutes);
app.use("/api/knowledge", cacheMiddleware(30), knowledgeRoutes);
app.use("/api/agents", cacheMiddleware(30), agentsRoutes);
app.use("/api/admin", cacheMiddleware(30), adminRoutes);
app.use("/api/messages", cacheMiddleware(15), messagesRoutes);
app.use("/api/flowable", cacheMiddleware(30), flowableRoutes);
app.use("/api/pages", cacheMiddleware(30), pagesRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/llm", cacheMiddleware(30), llmRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/announcements", cacheMiddleware(15), announcementsRoutes);
app.use("/api/todos", cacheMiddleware(15), todosRoutes);
app.use("/api/quality", cacheMiddleware(30), qualityRoutes);
app.use("/api/versions", cacheMiddleware(30), versionsRoutes);
app.use("/api/triggers", cacheMiddleware(30), triggersRoutes);
app.use("/api/export-history", cacheMiddleware(30), exportHistoryRoutes);
app.use("/api/knowledge/qa", cacheMiddleware(15), knowledgeQaRoutes);
app.use("/api/knowledge/graph", cacheMiddleware(60), knowledgeGraphRoutes);
app.use("/api/market", cacheMiddleware(30), marketRoutes);
app.use("/api/filesystem", cacheMiddleware(30), filesystemRoutes);
app.use("/api/orchestrations", cacheMiddleware(30), orchestrationsRoutes);
app.use("/api/ocr", cacheMiddleware(30), ocrRoutes);
app.use("/api/architecture", cacheMiddleware(60), architectureRoutes);

// ─── Health check ───────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const redisStatus = await redisHealthCheck();
  const dbStatus = process.env.DATABASE_URL ? "postgresql" : "sqlite";
  res.json({
    success: true,
    data: {
      status: "ok",
      database: dbStatus,
      cache: redisStatus.status,
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[API Error]", err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ─── Start server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  MetaPlatform API server running at:`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Press Ctrl+C to stop\n`);
});
