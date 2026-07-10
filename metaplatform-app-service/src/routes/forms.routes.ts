/**
 * 表单 (forms) 路由 —— Sprint 0 stub
 * ────────────────────────────────────────────────────────────
 * 端点：
 *   GET    /api/apps/:id/forms
 *   POST   /api/apps/:id/forms
 *   GET    /api/apps/:id/forms/:fid
 *   PUT    /api/apps/:id/forms/:fid
 *   POST   /api/apps/:id/forms/:fid/publish
 *   POST   /api/apps/:id/forms/:fid/submit
 *   GET    /api/apps/:id/forms/:fid/list
 *   GET    /api/apps/:id/forms/:fid/csv
 *   POST   /api/apps/:id/forms/:fid/workflow
 *   GET    /api/apps/:id/forms/:fid/workflow
 *
 * 注意：submit / list / csv / workflow 这些子路径必须和 :fid 路由同处一个 Router，
 * 否则 Express 会因为路径匹配不到而被 formsRouter 截胡返回 404。
 */
import { Router } from "express";
import { asyncHandler } from "../utils/mock";
import { ensureTraceId, ok, created, badRequest } from "../utils/response";

export const formsRouter = Router({ mergeParams: true });

function parseId(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`${label} 必须为正整数`), { status: 400 });
  }
  return n;
}

// ─── 表单列表 / 新建表单 ──────────────────────────────────────
formsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    return ok(res, traceId, {
      appId,
      items: [
        {
          id: 21,
          appId,
          objectId: 11,
          code: "reimbursement_form",
          name: "报销单表单（stub）",
          schema: { version: 1, widgets: [] },
          status: "draft",
          version: 1,
        },
      ],
      total: 1,
      __stub: true,
    });
  }),
);

formsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const body = (req.body ?? {}) as {
      objectId?: unknown;
      code?: unknown;
      name?: unknown;
      schema?: unknown;
    };
    if (typeof body.objectId !== "number") {
      return badRequest(res, traceId, "objectId 必填且必须为数字");
    }
    if (typeof body.code !== "string" || body.code.length === 0) {
      return badRequest(res, traceId, "code 必填且必须为字符串");
    }
    if (typeof body.name !== "string" || body.name.length === 0) {
      return badRequest(res, traceId, "name 必填且必须为字符串");
    }
    if (body.schema === undefined || body.schema === null) {
      return badRequest(res, traceId, "schema 必填");
    }
    return created(res, traceId, {
      id: 3001,
      appId,
      objectId: body.objectId,
      code: body.code,
      name: body.name,
      schema: body.schema,
      status: "draft",
      version: 1,
      __stub: true,
    });
  }),
);

// ─── 表单详情 / 更新 ──────────────────────────────────────────
formsRouter.get(
  "/:fid",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    return ok(res, traceId, {
      id: fid,
      appId,
      objectId: 11,
      code: "reimbursement_form",
      name: "报销单表单（stub）",
      schema: { version: 1, widgets: [] },
      status: "draft",
      version: 1,
      __stub: true,
    });
  }),
);

formsRouter.put(
  "/:fid",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    const body = (req.body ?? {}) as Record<string, unknown>;
    return ok(res, traceId, {
      id: fid,
      appId,
      ...body,
      updatedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

// ─── 发布表单 ────────────────────────────────────────────────
formsRouter.post(
  "/:fid/publish",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    // Sprint 2: 同步调用 pageGenerator.validateSchema()
    return ok(res, traceId, {
      id: fid,
      appId,
      status: "published",
      publishedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

// ─── 提交 / 列表 / CSV ───────────────────────────────────────
formsRouter.post(
  "/:fid/submit",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    const body = (req.body ?? {}) as { data?: unknown };
    if (body.data === undefined || body.data === null) {
      return badRequest(res, traceId, "data 必填");
    }
    return created(res, traceId, {
      appId,
      formId: fid,
      instanceId: 4001,
      data: body.data,
      submittedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

formsRouter.get(
  "/:fid/list",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    return ok(res, traceId, {
      appId,
      formId: fid,
      page,
      pageSize,
      total: 1,
      items: [
        {
          id: 1,
          data: { amount: 1000, remark: "Sprint 0 stub" },
          createdAt: new Date().toISOString(),
        },
      ],
      __stub: true,
    });
  }),
);

formsRouter.get(
  "/:fid/csv",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    // Sprint 2: 真实导出走 CSV 流；Sprint 0 仅占位
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="form-${fid}.csv"`);
    res.status(200).send(
      `app_id,form_id,trace_id\n${appId},${fid},${traceId}\n# Sprint 0 stub\n`,
    );
  }),
);

// ─── 流程 ───────────────────────────────────────────────────
formsRouter.post(
  "/:fid/workflow",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    const body = (req.body ?? {}) as { code?: unknown; name?: unknown; nodes?: unknown; edges?: unknown };
    if (typeof body.code !== "string" || body.code.length === 0) {
      return badRequest(res, traceId, "code 必填且必须为字符串");
    }
    if (typeof body.name !== "string" || body.name.length === 0) {
      return badRequest(res, traceId, "name 必填且必须为字符串");
    }
    if (!Array.isArray(body.nodes)) {
      return badRequest(res, traceId, "nodes 必须为数组");
    }
    if (!Array.isArray(body.edges)) {
      return badRequest(res, traceId, "edges 必须为数组");
    }
    return created(res, traceId, {
      id: 5001,
      appId,
      formId: fid,
      code: body.code,
      name: body.name,
      nodes: body.nodes,
      edges: body.edges,
      status: "draft",
      version: 1,
      __stub: true,
    });
  }),
);

formsRouter.get(
  "/:fid/workflow",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const appId = parseId(req.params.id, "应用 id");
    const fid = parseId(req.params.fid, "表单 id");
    return ok(res, traceId, {
      appId,
      formId: fid,
      code: "default_workflow",
      name: "默认流程（stub）",
      nodes: [
        { id: "start", type: "start" },
        { id: "approve", type: "userTask" },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "approve" },
        { from: "approve", to: "end" },
      ],
      status: "draft",
      version: 1,
      __stub: true,
    });
  }),
);
