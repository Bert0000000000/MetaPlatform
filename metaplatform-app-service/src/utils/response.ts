/**
 * 标准响应包装（参考 docs/v1.0.x/v1.0.1/05-app-service-architecture.md §5.3）
 *
 * 成功：{ code: 0, data: {...}, traceId: "..." }
 * 失败：{ code: 4xx/5xx, message: "...", traceId: "..." }
 */
import { Request, Response } from "express";
import { randomUUID } from "crypto";

export const TRACE_HEADER = "x-trace-id";

/** 生成或沿用请求的 traceId */
export function ensureTraceId(req: Request): string {
  const incoming = req.header(TRACE_HEADER);
  if (incoming && incoming.length > 0 && incoming.length <= 64) return incoming;
  return randomUUID();
}

export interface SuccessEnvelope<T> {
  code: 0;
  data: T;
  traceId: string;
}

export interface ErrorEnvelope {
  code: number;
  message: string;
  traceId: string;
}

/** 业务成功响应 */
export function ok<T>(res: Response, traceId: string, data: T): Response {
  const payload: SuccessEnvelope<T> = { code: 0, data, traceId };
  return res.status(200).json(payload);
}

/** 业务创建成功（201） */
export function created<T>(res: Response, traceId: string, data: T): Response {
  const payload: SuccessEnvelope<T> = { code: 0, data, traceId };
  return res.status(201).json(payload);
}

/** 业务错误响应 */
export function fail(
  res: Response,
  traceId: string,
  status: number,
  message: string,
): Response {
  const payload: ErrorEnvelope = { code: status, message, traceId };
  return res.status(status).json(payload);
}

/**
 * 入参校验失败 → 400
 * 约定所有路由内的同步/异步校验都通过该方法返回错误
 */
export function badRequest(res: Response, traceId: string, message: string): Response {
  return fail(res, traceId, 400, message);
}

/** 404 工具方法 */
export function notFound(res: Response, traceId: string, message = "Not Found"): Response {
  return fail(res, traceId, 404, message);
}
