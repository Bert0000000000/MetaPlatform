/**
 * 待办 (todos) 路由 —— Sprint 0 stub
 * ────────────────────────────────────────────────────────────
 * 端点：
 *   GET /api/todos
 */
import { Router } from "express";
import { asyncHandler } from "../utils/mock";
import { ensureTraceId, ok } from "../utils/response";

export const todoRouter = Router();

todoRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    // Sprint 3: 按 req.user.id 过滤 app_todos 表
    return ok(res, traceId, {
      items: [
        {
          id: 1,
          workflowInstanceId: 4001,
          nodeId: "approve",
          assigneeId: "demo",
          status: "pending",
          title: "审批通过（stub）",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      __stub: true,
    });
  }),
);
