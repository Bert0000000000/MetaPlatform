/**
 * Express 应用工厂 —— 单独导出便于 supertest 测试
 */
import express, { Application } from "express";
import cors from "cors";

import { appsRouter } from "./routes/apps.routes";
import { objectsRouter } from "./routes/objects.routes";
import { formsRouter } from "./routes/forms.routes";
import { approvalRouter } from "./routes/approval.routes";
import { todoRouter } from "./routes/todo.routes";

import { jwtAuth } from "./middleware/jwt-auth.middleware";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware";
import { auditLogMiddleware } from "./middleware/audit-log.middleware";
import { SERVICE_VERSION } from "./config";
import { ok, ensureTraceId } from "./utils/response";

export function createApp(): Application {
  const app = express();

  // ─── 基础中间件 ───
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // ─── Health check（任务约定：返回 { status: 'ok', version }）───
  // 注意：必须在 jwtAuth 之前，否则健康检查会 401
  app.get("/health", (req, res) => {
    const traceId = ensureTraceId(req);
    return ok(res, traceId, {
      status: "ok",
      version: SERVICE_VERSION,
    });
  });

  // ─── 横切中间件（按顺序：audit → auth）───
  app.use(auditLogMiddleware);
  app.use(jwtAuth());
  // rbac 在 Sprint 0 暂未挂到具体路由，由 Sprint 1 在需要权限的 POST/PUT/DELETE 上注入

  // ─── 应用中心 18 个端点 ───
  app.use("/api/apps", appsRouter);
  app.use("/api/apps/:id/objects", objectsRouter);
  app.use("/api/apps/:id/forms", formsRouter); // formsRouter 同时承载 submit/list/csv/workflow
  app.use("/api/workflow", approvalRouter);
  app.use("/api/todos", todoRouter);

  // 兜底：未匹配路由 → 404（统一响应包）
  app.use((req, res) => {
    return res.status(404).json({
      code: 404,
      message: `Route not found: ${req.method} ${req.path}`,
      traceId: req.header("x-trace-id") ?? "",
    });
  });

  // 错误处理（必须放在最后）
  app.use(errorHandlerMiddleware);

  return app;
}
