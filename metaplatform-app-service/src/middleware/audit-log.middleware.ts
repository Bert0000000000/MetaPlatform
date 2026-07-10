/**
 * 审计日志中间件 —— Sprint 0 主线程完成
 * ────────────────────────────────────────────────────────────
 *  - 拦截 POST/PUT/DELETE/PATCH
 *  - 写入 app_audit_logs 表（fire-and-forget）
 *  - 不阻塞主流程；失败仅记录 stderr
 */
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection";

export type AuditableMethod = "POST" | "PUT" | "DELETE" | "PATCH";

const AUDITABLE: Set<string> = new Set([
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
]);

/**
 * 推断 resource_type（基于 URL 前缀）
 */
function inferResourceType(path: string): string {
  const m = path.match(/\/api\/apps\/\d+\/([^/?]+)/);
  if (m) {
    if (m[1] === "objects") return "object";
    if (m[1] === "forms") return "form";
    if (m[1] === "workflow") return "workflow";
    if (m[1] === "submit") return "form_data";
  }
  if (path.match(/^\/api\/apps\/?$/)) return "app";
  if (path.startsWith("/api/workflow/instances/")) return "workflow_instance";
  if (path.startsWith("/api/todos")) return "todo";
  return "other";
}

function inferResourceId(path: string): number | null {
  const m = path.match(/\/apps\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function inferAction(method: string): string {
  switch (method) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return "unknown";
  }
}

export function recordAudit(req: Request): void {
  try {
    const db = getDb();
    const actor = req.user?.id ?? "anonymous";
    const traceId = req.traceId ?? req.header("x-trace-id") ?? uuidv4();
    db.prepare(
      `INSERT INTO app_audit_logs
        (resource_type, resource_id, action, actor, payload, trace_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      inferResourceType(req.path),
      inferResourceId(req.path),
      inferAction(req.method),
      actor,
      JSON.stringify({ body: req.body, query: req.query, params: req.params }),
      traceId,
    );
  } catch (err) {
    console.error("[audit] write failed:", (err as Error).message);
  }
}

export function auditLogMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (AUDITABLE.has(req.method)) {
    // fire-and-forget；表结构在迁移脚本里
    try {
      recordAudit(req);
    } catch {
      // 静默
    }
  }
  next();
}
