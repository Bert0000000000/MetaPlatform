/**
 * 全局错误处理中间件 —— Sprint 0 骨架（基础版已可用）
 * ────────────────────────────────────────────────────────────
 * 后续 Sprint 任务：
 * 1. 区分业务错误（code 4xx，含 message）与系统错误（code 500，仅输出 traceId）；
 * 2. 把 stack 与 ctx 写入结构化日志（traceId + path + method + status + latency）；
 * 3. 接 prom-client 上报异常计数。
 */
import { Request, Response, NextFunction } from "express";
import { ensureTraceId, fail } from "../utils/response";

export interface HttpError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export function errorHandlerMiddleware(
  err: HttpError,
  req: Request,
  res: Response,
  // 必须保留 4 个参数，Express 才会识别为 error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const traceId = ensureTraceId(req);
  const status = err.status ?? 500;
  const message =
    status >= 500
      ? "Internal Server Error"
      : err.message || "Request Failed";

  // TODO(Sprint 1): 结构化日志输出
  // logger.error({ traceId, path: req.path, method: req.method, status, err });

  fail(res, traceId, status, message);
}

export class BadRequestError extends Error implements HttpError {
  status = 400;
  constructor(message = "Bad Request") {
    super(message);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends Error implements HttpError {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error implements HttpError {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error implements HttpError {
  status = 404;
  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundError";
  }
}
