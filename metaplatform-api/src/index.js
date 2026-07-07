/**
 * MetaPlatform API — Main entry point
 */
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authenticate, optionalAuth } from "./middleware/auth.js";

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
import storageRoutes from "./routes/storage.js";
import { cacheMiddleware, redisHealthCheck } from "./middleware/cache.js";
import { initAll, healthCheckAll } from "./integrations/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Rate Limiters ────────────────────────────────────────
// General rate limiter: 100 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});

// Auth rate limiter: 10 requests per minute per IP (stricter for login/register)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication attempts, please try again later" },
});

// ─── Middleware ──────────────────────────────────────────
app.use(cors());                          // Allow all origins (dev mode)
app.use(express.json());                  // Parse JSON bodies
app.use(generalLimiter);                  // Apply general rate limiting

// ─── Routes ──────────────────────────────────────────────
// Auth routes — PUBLIC for login/register, rate-limited separately
app.use("/api/auth", authLimiter, authRoutes);

// Protected API routes — require Bearer token
app.use("/api/apps", authenticate, cacheMiddleware(30), appsRoutes);
app.use("/api/ontology", authenticate, cacheMiddleware(30), ontologyRoutes);
app.use("/api/processes", authenticate, cacheMiddleware(30), processesRoutes);
app.use("/api/data", authenticate, cacheMiddleware(30), dataRoutes);
app.use("/api/knowledge", authenticate, cacheMiddleware(30), knowledgeRoutes);
app.use("/api/agents", authenticate, cacheMiddleware(30), agentsRoutes);
app.use("/api/admin", authenticate, cacheMiddleware(30), adminRoutes);
app.use("/api/messages", authenticate, cacheMiddleware(15), messagesRoutes);
app.use("/api/flowable", authenticate, cacheMiddleware(30), flowableRoutes);
app.use("/api/pages", authenticate, cacheMiddleware(30), pagesRoutes);
app.use("/api/export", authenticate, exportRoutes);
app.use("/api/llm", authenticate, cacheMiddleware(30), llmRoutes);
app.use("/api/dispatch", authenticate, dispatchRoutes);
app.use("/api/announcements", authenticate, cacheMiddleware(15), announcementsRoutes);
app.use("/api/todos", authenticate, cacheMiddleware(15), todosRoutes);
app.use("/api/quality", authenticate, cacheMiddleware(30), qualityRoutes);
app.use("/api/versions", authenticate, cacheMiddleware(30), versionsRoutes);
app.use("/api/triggers", authenticate, cacheMiddleware(30), triggersRoutes);
app.use("/api/export-history", authenticate, cacheMiddleware(30), exportHistoryRoutes);
app.use("/api/knowledge/qa", authenticate, cacheMiddleware(15), knowledgeQaRoutes);
app.use("/api/knowledge/graph", authenticate, cacheMiddleware(60), knowledgeGraphRoutes);
app.use("/api/market", authenticate, cacheMiddleware(30), marketRoutes);
app.use("/api/filesystem", authenticate, cacheMiddleware(30), filesystemRoutes);
app.use("/api/orchestrations", authenticate, cacheMiddleware(30), orchestrationsRoutes);
app.use("/api/ocr", authenticate, cacheMiddleware(30), ocrRoutes);
app.use("/api/architecture", authenticate, cacheMiddleware(60), architectureRoutes);

// Phase 2: Unified storage layer endpoints (Neo4j / ES / Milvus / MinIO / Kafka)
app.use("/api/storage", authenticate, storageRoutes);

// ─── Health check (public, optional auth) ────────────────
app.get("/api/health", optionalAuth, async (_req, res) => {
  try {
    const redisStatus = await redisHealthCheck();
    const dbStatus = process.env.DATABASE_URL ? "postgresql" : "sqlite";
    const storageHealth = await healthCheckAll().catch((e) => ({ error: e.message }));
    res.json({
      success: true,
      data: {
        status: "ok",
        database: dbStatus,
        cache: redisStatus.status,
        storage: storageHealth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[API Error]", err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

// ─── Initialize storage backends ───────────────────────
async function bootstrap() {
  try {
    await initAll();
  } catch (err) {
    console.warn("[Bootstrap] initAll failed:", err.message);
  }

  // ─── Start server ───────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n  MetaPlatform API server running at:`);
    console.log(`  -> http://localhost:${PORT}`);
    console.log(`  -> Press Ctrl+C to stop\n`);
  });
}

bootstrap().catch((err) => {
  console.error("[Bootstrap] Fatal error:", err);
  process.exit(1);
});