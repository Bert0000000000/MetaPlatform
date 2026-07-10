/**
 * 对象 (objects) 路由 —— Sprint 0 stub
 * ────────────────────────────────────────────────────────────
 * 端点：
 *   GET    /api/apps/:id/objects
 *   POST   /api/apps/:id/objects
 *   GET    /api/apps/:id/objects/:oid
 *   PUT    /api/apps/:id/objects/:oid
 *   DELETE /api/apps/:id/objects/:oid
 */
import { Router } from "express";
import { asyncHandler } from "../utils/mock";
import { ensureTraceId, ok, created, badRequest } from "../utils/response";

export const objectsRouter = Router({ mergeParams: true });

function parseId(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`${label} 必须为正整数`), { status: 400 });
  }
  return n;
}

objectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    return ok(res, traceId, {
      appId,
      items: [
        {
          id: 11,
          appId,
          code: "reimbursement",
          name: "报销单（stub）",
          description: "Sprint 0 stub 对象",
          fields: [
            { code: "amount", name: "金额", type: "number", required: true },
            { code: "remark", name: "事由", type: "string", required: false },
          ],
          ontologyObjectId: null,
          dataTableName: `app_demo_reimbursement`,
          version: 1,
        },
      ],
      total: 1,
      __stub: true,
    });
  }),
);

objectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const body = (req.body ?? {}) as {
      code?: unknown;
      name?: unknown;
      description?: unknown;
      fields?: unknown;
    };
    if (typeof body.code !== "string" || body.code.length === 0) {
      return badRequest(res, traceId, "code 必填且必须为字符串");
    }
    if (typeof body.name !== "string" || body.name.length === 0) {
      return badRequest(res, traceId, "name 必填且必须为字符串");
    }
    if (!Array.isArray(body.fields)) {
      return badRequest(res, traceId, "fields 必须为数组");
    }
    return created(res, traceId, {
      id: 2001,
      appId,
      code: body.code,
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      fields: body.fields,
      ontologyObjectId: null,
      dataTableName: `app_${appId}_${body.code}`,
      version: 1,
      __stub: true,
    });
  }),
);

objectsRouter.get(
  "/:oid",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const oid = parseId(req.params.oid, "对象 id");
    return ok(res, traceId, {
      id: oid,
      appId,
      code: "reimbursement",
      name: "报销单（stub）",
      description: "Sprint 0 stub",
      fields: [],
      ontologyObjectId: null,
      dataTableName: `app_${appId}_reimbursement`,
      version: 1,
      __stub: true,
    });
  }),
);

objectsRouter.put(
  "/:oid",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const oid = parseId(req.params.oid, "对象 id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    return ok(res, traceId, {
      id: oid,
      appId,
      ...body,
      updatedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

objectsRouter.delete(
  "/:oid",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const oid = parseId(req.params.oid, "对象 id");
    // Sprint 1: 同时调用 ontologyEngine.deleteObjectType()
    return ok(res, traceId, { id: oid, appId, deleted: true, __stub: true });
  }),
);
