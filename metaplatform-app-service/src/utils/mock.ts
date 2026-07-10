/**
 * 通用工具：把异步路由函数包成 Express 错误转发格式，
 * 这样抛出/拒绝的异常会冒到 error-handler 中间件统一处理。
 *
 * 参考 metaplatform-api/src/index.js 中的 asyncHandler 实现。
 */
import { Request, Response, NextFunction, RequestHandler } from "express";

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 路由级 mock：开发期间统一返回固定结构，便于前端联调。
 * Sprint 1+ 将逐步替换为真实 Service 调用。
 */
export function stubNotImplemented(
  res: Response,
  traceId: string,
  endpoint: string,
): Response {
  return res.status(200).json({
    code: 0,
    data: {
      __stub: true,
      endpoint,
      note: "Sprint 0 stub. Real implementation lands in Sprint 1+.",
    },
    traceId,
  });
}
