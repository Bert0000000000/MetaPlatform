/**
 * 应用 (apps) 路由 —— Sprint 0 stub
 * ────────────────────────────────────────────────────────────
 * 端点（参考 05-app-service-architecture.md §2.4）：
 *   GET    /api/apps
 *   POST   /api/apps
 *   GET    /api/apps/:id
 *   PUT    /api/apps/:id
 *   DELETE /api/apps/:id
 *
 * Sprint 0：所有方法签名 + 入参校验 + 路由结构正确，handler 返回 mock 数据。
 * Sprint 1 落地：T1-1 替换为真实 Service 调用 + 写入 apps 表（由 T0-2 建表）。
 */
import { Router } from "express";
import { asyncHandler } from "../utils/mock";
import { ensureTraceId, ok, created, badRequest } from "../utils/response";

export const appsRouter = Router();

function parseId(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`${label} 必须为正整数`), { status: 400 });
  }
  return n;
}

appsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    return ok(res, traceId, {
      items: [
        {
          id: 1,
          code: "demo",
          name: "Demo 应用（stub）",
          icon: "app",
          description: "Sprint 0 stub 数据",
          version: 1,
          status: "active",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    });
  }),
);

appsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const body = (req.body ?? {}) as { code?: unknown; name?: unknown; icon?: unknown; description?: unknown };
    if (typeof body.code !== "string" || body.code.length === 0) {
      return badRequest(res, traceId, "code 必填且必须为字符串");
    }
    if (typeof body.name !== "string" || body.name.length === 0) {
      return badRequest(res, traceId, "name 必填且必须为字符串");
    }
    return created(res, traceId, {
      id: 1001,
      code: body.code,
      name: body.name,
      icon: typeof body.icon === "string" ? body.icon : "app",
      description: typeof body.description === "string" ? body.description : null,
      version: 1,
      status: "active",
      createdAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

appsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const id = parseId(req.params.id, "应用 id");
    return ok(res, traceId, {
      id,
      code: "demo",
      name: "Demo 应用（stub）",
      icon: "app",
      description: "Sprint 0 stub",
      version: 1,
      status: "active",
      __stub: true,
    });
  }),
);

appsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const id = parseId(req.params.id, "应用 id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    return ok(res, traceId, {
      id,
      ...body,
      updatedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

appsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const id = parseId(req.params.id, "应用 id");
    // Sprint 1: 软删 —— 把 apps.status 置为 'archived'
    return ok(res, traceId, { id, deleted: true, __stub: true });
  }),
);
