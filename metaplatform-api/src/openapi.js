/**
 * OpenAPI 3 spec generator for MetaPlatform API.
 *
 * Strategy:
 *   - Scan every Express Router registered in routes/
 *   - Use stack introspection to extract HTTP method + path
 *   - Annotate with tags / summaries from this file
 *   - Output full spec at GET /api/openapi.json
 *   - Serve Swagger UI at GET /api/docs
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Hand-written summaries per route file (best-effort) ───
const ROUTE_META = {
  "routes/auth.js":            { tag: "Auth",           summary: "认证与授权 (JWT登录、token刷新)" },
  "routes/apps.js":            { tag: "Apps",           summary: "应用中心 (CRUD、导出、版本)" },
  "routes/ontology.js":        { tag: "Ontology",       summary: "本体引擎 (对象/属性/关系/函数)" },
  "routes/processes.js":       { tag: "Processes",      summary: "流程引擎 (BPMN 实例、待办)" },
  "routes/data.js":            { tag: "Data",           summary: "数据建模 (数据库、表、字段)" },
  "routes/knowledge.js":       { tag: "Knowledge",      summary: "知识库 (文档、订阅)" },
  "routes/agents.js":          { tag: "Agents",         summary: "AI 智能体市场与协作" },
  "routes/admin.js":           { tag: "Admin",          summary: "管理后台 (用户、租户、备份)" },
  "routes/messages.js":        { tag: "Messages",       summary: "站内消息" },
  "routes/flowable.js":        { tag: "Flowable",       summary: "Flowable 流程引擎适配" },
  "routes/pages.js":           { tag: "Pages",          summary: "低代码页面生成" },
  "routes/export.js":          { tag: "Export",         summary: "应用导出 (导入/导出)" },
  "routes/llm.js":             { tag: "LLM",            summary: "LLM 统一调用 (兼容 LiteLLM)" },
  "routes/dispatch.js":        { tag: "Dispatch",       summary: "调度分发" },
  "routes/announcements.js":   { tag: "Announcements",  summary: "系统公告" },
  "routes/todos.js":           { tag: "Todos",          summary: "待办任务" },
  "routes/quality.js":         { tag: "Quality",        summary: "质量中心 (用例、报告、Bug)" },
  "routes/versions.js":        { tag: "Versions",       summary: "版本管理" },
  "routes/triggers.js":        { tag: "Triggers",       summary: "触发器 (Webhook、定时器)" },
  "routes/export-history.js":  { tag: "Export History", summary: "导出历史记录" },
  "routes/knowledge-qa.js":    { tag: "Knowledge QA",   summary: "知识问答" },
  "routes/knowledge-graph.js": { tag: "Knowledge Graph",summary: "知识图谱查询" },
  "routes/market.js":          { tag: "Market",         summary: "应用市场" },
  "routes/filesystem.js":      { tag: "Filesystem",     summary: "虚拟文件系统" },
  "routes/orchestrations.js":  { tag: "Orchestrations", summary: "编排流程" },
  "routes/ocr.js":             { tag: "OCR",            summary: "OCR 文本识别" },
  "routes/architecture.js":    { tag: "Architecture",   summary: "架构视图" },
  "routes/storage.js":         { tag: "Storage",        summary: "统一存储抽象 (PG/Neo4j/ES/MinIO/Kafka)" },
  "routes/ai.js":              { tag: "AI",             summary: "AI 基质 (Embeddings/LLM/Agent/RAG/OCR)" },
  "routes/analytics.js":       { tag: "Analytics",      summary: "数据栈 (ClickHouse/NL2SQL/CDC/Quality/Sim)" },
  "routes/observability.js":   { tag: "Observability",  summary: "可观测性 (Metrics/Logs/Traces/Audit)" },
};

// ─── Build the spec ────────────────────────────────────────
function buildSpec() {
  const routesDir = path.join(__dirname, "routes");
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith(".js"));

  const paths = {};
  const tags = [];

  for (const file of files) {
    const rel = `routes/${file}`;
    const meta = ROUTE_META[rel] || { tag: "Misc", summary: rel };
    if (!tags.find((t) => t.name === meta.tag)) {
      tags.push({ name: meta.tag, description: meta.summary });
    }

    // We can't import the router at spec-build time without booting Express.
    // Instead, we provide a curated list of well-known routes here.
    // For unknown routes, the docs endpoint still returns the spec.
    const known = KNOWN_ROUTES[rel] || [];
    for (const route of known) {
      const fullPath = route.path;
      if (!paths[fullPath]) paths[fullPath] = {};
      paths[fullPath][route.method.toLowerCase()] = {
        tags: [meta.tag],
        summary: route.summary || meta.summary,
        description: route.description,
        security: route.public ? [] : [{ bearerAuth: [] }],
        parameters: route.parameters || [],
        requestBody: route.requestBody,
        responses: route.responses || {
          200: { description: "OK" },
          401: { description: "Unauthorized" },
          500: { description: "Server Error" },
        },
      };
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "MetaPlatform API",
      version: "1.6.0",
      description:
        "Enterprise AI Middleware Platform — REST API for the MetaPlatform backend.\n\n" +
        "Sections: Auth · Apps · Ontology · Processes · Data · Knowledge · Agents · Admin · " +
        "Storage · AI · Analytics · Observability.",
      contact: { name: "MetaPlatform Team", email: "team@metaplatform.example.com" },
      license: { name: "Apache-2.0" },
    },
    servers: [
      { url: "http://localhost:3001", description: "Local dev" },
      { url: "https://app.metaplatform.example.com", description: "Production" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" },
          },
          required: ["success", "error"],
        },
        Success: {
          type: "object",
          properties: { success: { type: "boolean", example: true }, data: {} },
          required: ["success"],
        },
        LoginRequest: {
          type: "object",
          properties: { email: { type: "string", example: "admin@metaplatform.com" }, password: { type: "string", example: "admin123" } },
          required: ["email", "password"],
        },
        LoginResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                token: { type: "string", description: "JWT bearer token" },
                user: { type: "object" },
              },
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                status: { type: "string", example: "ok" },
                uptime: { type: "number" },
                timestamp: { type: "string", format: "date-time" },
                services: { type: "object" },
              },
            },
          },
        },
        ChatRequest: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["system", "user", "assistant"] },
                  content: { type: "string" },
                },
              },
            },
            temperature: { type: "number" },
            maxTokens: { type: "integer" },
          },
          required: ["messages"],
        },
      },
    },
    tags,
    paths,
  };
}

// ─── Curated route catalog ────────────────────────────────
// Each entry: { method, path, summary, public, parameters, requestBody, responses }
const KNOWN_ROUTES = {
  "routes/auth.js": [
    { method: "POST", path: "/api/auth/login", summary: "User login", public: true,
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
      responses: { 200: { description: "Login success", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } }, 401: { description: "Invalid credentials" } } },
    { method: "POST", path: "/api/auth/register", summary: "Register new user", public: true },
    { method: "GET",  path: "/api/auth/me", summary: "Get current user", responses: { 200: { description: "OK" } } },
    { method: "POST", path: "/api/auth/refresh", summary: "Refresh JWT token", public: true },
    { method: "POST", path: "/api/auth/logout", summary: "Logout" },
  ],
  "routes/storage.js": [
    { method: "GET",  path: "/api/storage/health", summary: "Storage health check" },
    { method: "POST", path: "/api/storage/neo4j/query", summary: "Execute Cypher query" },
    { method: "POST", path: "/api/storage/neo4j/subgraph", summary: "Get subgraph around a node" },
    { method: "POST", path: "/api/storage/es/index", summary: "Index document into Elasticsearch" },
    { method: "POST", path: "/api/storage/es/search", summary: "Search Elasticsearch" },
    { method: "POST", path: "/api/storage/minio/upload", summary: "Upload object to MinIO" },
    { method: "GET",  path: "/api/storage/minio/list", summary: "List objects in bucket" },
    { method: "POST", path: "/api/storage/kafka/publish", summary: "Publish event to Kafka" },
  ],
  "routes/ai.js": [
    { method: "GET",  path: "/api/ai/status", summary: "AI subsystems status" },
    { method: "POST", path: "/api/ai/embed", summary: "Embed single text" },
    { method: "POST", path: "/api/ai/embed/batch", summary: "Embed multiple texts" },
    { method: "POST", path: "/api/ai/chat", summary: "Chat completion",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChatRequest" } } } } },
    { method: "POST", path: "/api/ai/chat/stream", summary: "Streaming chat (SSE)" },
    { method: "POST", path: "/api/ai/agent", summary: "Run AI agent (think-act-observe loop)" },
    { method: "GET",  path: "/api/ai/agent/tools", summary: "List available agent tools" },
    { method: "POST", path: "/api/ai/rag/index", summary: "Index documents into RAG" },
    { method: "POST", path: "/api/ai/rag/retrieve", summary: "Retrieve relevant chunks" },
    { method: "POST", path: "/api/ai/rag/answer", summary: "End-to-end RAG answer" },
    { method: "POST", path: "/api/ai/ocr", summary: "OCR an uploaded image (multipart)" },
    { method: "POST", path: "/api/ai/ocr/detect", summary: "Detect language from text" },
  ],
  "routes/analytics.js": [
    { method: "GET",  path: "/api/analytics/status", summary: "ClickHouse + CDC status" },
    { method: "POST", path: "/api/analytics/clickhouse/query", summary: "Run a SELECT query against ClickHouse" },
    { method: "POST", path: "/api/analytics/clickhouse/insert", summary: "Insert rows into a ClickHouse table" },
    { method: "POST", path: "/api/analytics/clickhouse/create-table", summary: "Create a ClickHouse table" },
    { method: "POST", path: "/api/analytics/clickhouse/truncate", summary: "Truncate a ClickHouse table" },
    { method: "GET",  path: "/api/analytics/clickhouse/tables", summary: "List tables in ClickHouse" },
    { method: "POST", path: "/api/analytics/nl2sql", summary: "Natural-language → SQL query" },
    { method: "GET",  path: "/api/analytics/cdc/status", summary: "CDC pipeline status" },
    { method: "POST", path: "/api/analytics/cdc/poll", summary: "Trigger one CDC poll" },
    { method: "POST", path: "/api/analytics/cdc/start", summary: "Start CDC polling loop" },
    { method: "POST", path: "/api/analytics/cdc/stop", summary: "Stop CDC polling loop" },
    { method: "POST", path: "/api/analytics/quality/score", summary: "Score data quality against rules" },
    { method: "POST", path: "/api/analytics/quality/infer-rules", summary: "Auto-infer rules from sample" },
    { method: "GET",  path: "/api/analytics/quality/rule-types", summary: "List available rule types" },
    { method: "POST", path: "/api/analytics/simulate", summary: "Run a Monte Carlo discrete-event simulation" },
  ],
  "routes/observability.js": [
    { method: "GET",  path: "/api/observability/metrics", summary: "Prometheus metrics (text)", public: true },
    { method: "GET",  path: "/api/observability/status", summary: "Observability subsystems status", public: true },
    { method: "GET",  path: "/api/observability/logs", summary: "Recent log lines" },
    { method: "GET",  path: "/api/observability/logs/by-trace/:id", summary: "Logs filtered by traceId" },
    { method: "GET",  path: "/api/observability/traces", summary: "List recent request traces" },
    { method: "GET",  path: "/api/observability/traces/:id", summary: "Full trace detail" },
    { method: "GET",  path: "/api/observability/audit", summary: "Query audit trail" },
    { method: "POST", path: "/api/observability/audit/test", summary: "Record a synthetic audit event" },
  ],
  "routes/health.js": [
    { method: "GET", path: "/api/health", summary: "Liveness/readiness check", public: true,
      responses: { 200: { description: "Healthy", content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } } } } },
  ],
  "routes/apps.js": [
    { method: "GET",    path: "/api/apps",            summary: "List apps" },
    { method: "POST",   path: "/api/apps",            summary: "Create app" },
    { method: "GET",    path: "/api/apps/:id",        summary: "Get app by id" },
    { method: "PUT",    path: "/api/apps/:id",        summary: "Update app" },
    { method: "DELETE", path: "/api/apps/:id",        summary: "Delete app" },
    { method: "POST",   path: "/api/apps/:id/publish",summary: "Publish app" },
    { method: "POST",   path: "/api/apps/:id/export", summary: "Export app definition" },
    { method: "POST",   path: "/api/apps/import",     summary: "Import app from JSON" },
  ],
  "routes/ontology.js": [
    { method: "GET",  path: "/api/ontology/objects",     summary: "List ontology objects" },
    { method: "POST", path: "/api/ontology/objects",     summary: "Create ontology object" },
    { method: "GET",  path: "/api/ontology/objects/:id", summary: "Get object detail" },
    { method: "PUT",  path: "/api/ontology/objects/:id", summary: "Update object" },
    { method: "DELETE", path: "/api/ontology/objects/:id", summary: "Delete object" },
    { method: "GET",  path: "/api/ontology/relations",   summary: "List relations" },
    { method: "GET",  path: "/api/ontology/functions",   summary: "List functions" },
    { method: "GET",  path: "/api/ontology/actions",     summary: "List actions" },
    { method: "GET",  path: "/api/ontology/attributes",  summary: "List attributes" },
    { method: "GET",  path: "/api/ontology/security",    summary: "List security rules" },
    { method: "GET",  path: "/api/ontology/governance",  summary: "List governance rules" },
    { method: "GET",  path: "/api/ontology/processrules",summary: "List process rules" },
  ],
  "routes/processes.js": [
    { method: "GET",    path: "/api/processes",           summary: "List processes" },
    { method: "POST",   path: "/api/processes",           summary: "Create process" },
    { method: "GET",    path: "/api/processes/instances", summary: "List instances" },
    { method: "POST",   path: "/api/processes/instances", summary: "Start a process instance" },
    { method: "GET",    path: "/api/processes/instances/:id", summary: "Get instance detail" },
    { method: "POST",   path: "/api/processes/instances/:id/complete", summary: "Complete a task" },
    { method: "GET",    path: "/api/processes/orchestration", summary: "List orchestrations" },
    { method: "POST",   path: "/api/processes/orchestration", summary: "Create orchestration" },
    { method: "GET",    path: "/api/processes/analytics", summary: "Process analytics" },
    { method: "GET",    path: "/api/processes/business",  summary: "Business rules" },
    { method: "GET",    path: "/api/processes/middleware",summary: "Process middleware" },
    { method: "GET",    path: "/api/processes/approval-center", summary: "Approval center" },
    { method: "GET",    path: "/api/processes/approval",  summary: "List approvals" },
    { method: "GET",    path: "/api/processes/triggers",  summary: "Process triggers" },
    { method: "GET",    path: "/api/processes/export",    summary: "Export process definition" },
  ],
  "routes/data.js": [
    { method: "GET",    path: "/api/data",            summary: "Data sources list" },
    { method: "GET",    path: "/api/data/lakehouse",  summary: "Lakehouse stats" },
    { method: "GET",    path: "/api/data/metrics",    summary: "Data metrics" },
    { method: "POST",   path: "/api/data/ask",        summary: "Ask data question (NL)" },
    { method: "GET",    path: "/api/data/dashboard",  summary: "Data dashboard" },
    { method: "GET",    path: "/api/data/knowledge",  summary: "Data knowledge base" },
    { method: "GET",    path: "/api/data/decisions",  summary: "Data decisions" },
  ],
  "routes/knowledge.js": [
    { method: "GET",    path: "/api/knowledge/documents",    summary: "List knowledge documents" },
    { method: "POST",   path: "/api/knowledge/documents",    summary: "Create document" },
    { method: "GET",    path: "/api/knowledge/subscribe",    summary: "Subscriptions" },
    { method: "POST",   path: "/api/knowledge/search",       summary: "Search knowledge base" },
    { method: "GET",    path: "/api/knowledge/process",      summary: "Process knowledge" },
  ],
  "routes/agents.js": [
    { method: "GET",    path: "/api/agents",          summary: "List agents" },
    { method: "POST",   path: "/api/agents",          summary: "Create agent" },
    { method: "GET",    path: "/api/agents/workspace",summary: "Agent workspace" },
    { method: "GET",    path: "/api/agents/mine",     summary: "My agents" },
    { method: "GET",    path: "/api/agents/collab",   summary: "Collaborative agents" },
    { method: "GET",    path: "/api/agents/identity", summary: "Agent identity" },
    { method: "GET",    path: "/api/agents/permissions", summary: "Agent permissions" },
    { method: "GET",    path: "/api/agents/usage",    summary: "Agent usage stats" },
  ],
  "routes/admin.js": [
    { method: "GET",    path: "/api/admin/users",     summary: "List users" },
    { method: "POST",   path: "/api/admin/users",     summary: "Create user" },
    { method: "GET",    path: "/api/admin/orgs",      summary: "List organizations" },
    { method: "GET",    path: "/api/admin/permissions",summary: "List permissions" },
    { method: "GET",    path: "/api/admin/logs",      summary: "Admin logs" },
    { method: "GET",    path: "/api/admin/backup",    summary: "Backups" },
    { method: "POST",   path: "/api/admin/backup",    summary: "Trigger backup" },
    { method: "GET",    path: "/api/admin/billing",   summary: "Billing info" },
    { method: "GET",    path: "/api/admin/plugins",   summary: "Plugins" },
    { method: "GET",    path: "/api/admin/deploy",    summary: "Deployment status" },
  ],
  "routes/market.js": [
    { method: "GET",    path: "/api/market/apps",         summary: "Market apps" },
    { method: "GET",    path: "/api/market/agents",       summary: "Market agents" },
    { method: "GET",    path: "/api/market/templates",    summary: "Market templates" },
    { method: "GET",    path: "/api/market/workflows",    summary: "Market workflows" },
    { method: "GET",    path: "/api/market/skills",       summary: "Market skills" },
    { method: "GET",    path: "/api/market/api",          summary: "Market APIs" },
    { method: "GET",    path: "/api/market/knowledge",    summary: "Market knowledge" },
  ],
  "routes/llm.js": [
    { method: "POST", path: "/api/llm/chat", summary: "LLM chat completion" },
    { method: "POST", path: "/api/llm/embed",summary: "LLM embedding" },
    { method: "POST", path: "/api/llm/rerank",summary: "LLM rerank" },
  ],
  "routes/ocr.js": [
    { method: "POST", path: "/api/ocr/recognize", summary: "Recognize text from image (multipart)" },
  ],
  "routes/quality.js": [
    { method: "GET",    path: "/api/quality/testcases",  summary: "List test cases" },
    { method: "POST",   path: "/api/quality/testcases",  summary: "Create test case" },
    { method: "GET",    path: "/api/quality/reports",    summary: "Quality reports" },
    { method: "GET",    path: "/api/quality/bugfix",     summary: "Bug fix tracking" },
    { method: "GET",    path: "/api/quality/ontology",   summary: "Ontology quality" },
    { method: "GET",    path: "/api/quality/process",    summary: "Process quality" },
    { method: "GET",    path: "/api/quality/aiui",       summary: "AI UI quality" },
  ],
  "routes/architecture.js": [
    { method: "GET", path: "/api/architecture/app",     summary: "App architecture view" },
    { method: "GET", path: "/api/architecture/business",summary: "Business architecture" },
    { method: "GET", path: "/api/architecture/data",    summary: "Data architecture" },
    { method: "GET", path: "/api/architecture/tech",    summary: "Tech architecture" },
  ],
};

// ─── Router ────────────────────────────────────────────────
const router = Router();

let cachedSpec = null;
function getSpec() {
  if (!cachedSpec) cachedSpec = buildSpec();
  return cachedSpec;
}

router.get("/openapi.json", (_req, res) => {
  res.json(getSpec());
});

// Swagger UI: serve static assets directly via express
import swaggerUi from "swagger-ui-express";
const swaggerHandler = swaggerUi.setup(getSpec, {
  customSiteTitle: "MetaPlatform API Docs",
  customCss: ".swagger-ui .topbar { background: #2c3e50; }",
});

router.use("/docs", swaggerUi.serve, swaggerHandler);
router.get("/docs", swaggerHandler);

export default router;
export { buildSpec, getSpec };