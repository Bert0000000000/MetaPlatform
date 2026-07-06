/**
 * MetaPlatform API — Main entry point
 */
import express from "express";
import cors from "cors";
import { authenticate } from "./middleware/auth.js";
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

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────
app.use(cors());                          // Allow all origins (dev mode)
app.use(express.json());                  // Parse JSON bodies
app.use(authenticate);                    // JWT authentication

// ─── Routes ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/apps", appsRoutes);
app.use("/api/ontology", ontologyRoutes);
app.use("/api/processes", processesRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/flowable", flowableRoutes);
app.use("/api/pages", pagesRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/llm", llmRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/todos", todosRoutes);
app.use("/api/quality", qualityRoutes);
app.use("/api/versions", versionsRoutes);
app.use("/api/triggers", triggersRoutes);
app.use("/api/export-history", exportHistoryRoutes);
app.use("/api/knowledge/qa", knowledgeQaRoutes);

// ─── Health check ───────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
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
