/**
 * 审批 (approval) 路由 —— Sprint 0 stub
 * ────────────────────────────────────────────────────────────
 * 端点：
 *   POST /api/workflow/instances/:id/approve
 *   POST /api/workflow/instances/:id/reject
 */
import { Router } from "express";
import { asyncHandler } from "../utils/mock";
import { ensureTraceId, ok, badRequest } from "../utils/response";

export const approvalRouter = Router();

function parseId(value: string, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error(`${label} 必须为正整数`), { status: 400 });
  }
  return n;
}

approvalRouter.post(
  "/instances/:id/approve",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const instanceId = parseId(req.params.id, "流程实例 id");
    const body = (req.body ?? {}) as { comment?: unknown };
    return ok(res, traceId, {
      instanceId,
      action: "approve",
      comment: typeof body.comment === "string" ? body.comment : "",
      approvedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);

approvalRouter.post(
  "/instances/:id/reject",
  asyncHandler(async (req, res) => {
    const traceId = ensureTraceId(req);
    const instanceId = parseId(req.params.id, "流程实例 id");
    const body = (req.body ?? {}) as { comment?: unknown };
    if (typeof body.comment !== "string" || body.comment.length === 0) {
      return badRequest(res, traceId, "驳回必须填写意见 comment");
    }
    return ok(res, traceId, {
      instanceId,
      action: "reject",
      comment: body.comment,
      rejectedAt: new Date().toISOString(),
      __stub: true,
    });
  }),
);
