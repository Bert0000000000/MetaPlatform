/**
 * 业务错误封装 —— Sprint 1 主线程落地
 * ────────────────────────────────────────────────────────────
 *  - Domain / Service 层抛 AppError
 *  - 路由层用 asyncHandler → 冒到 error-handler.middleware.ts
 *  - errorHandlerMiddleware 已经能识别 err.status，把数字当 HTTP code
 *
 * 设计参考 docs/v1.0.x/v1.0.1/05-app-service-architecture.md §4.1：
 *   业务错误 = 4xx（带 message，可直接呈现给用户）
 *   系统错误 = 5xx（隐藏内部细节，仅 traceId）
 */

/** 标准业务错误：携带 HTTP status + 业务 code + 可选 details */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 400 Bad Request：入参校验失败 */
export class BadRequestAppError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
    this.name = "BadRequestAppError";
  }
}

/** 401 Unauthorized：未登录 */
export class UnauthorizedAppError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedAppError";
  }
}

/** 403 Forbidden：当前角色不允许该操作 */
export class ForbiddenAppError extends AppError {
  constructor(message: string, details?: unknown) {
    super(403, "FORBIDDEN", message, details);
    this.name = "ForbiddenAppError";
  }
}

/** 404 Not Found：资源不存在或跨租户访问（避免泄漏存在性） */
export class NotFoundAppError extends AppError {
  constructor(message = "Not Found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundAppError";
  }
}

/** 409 Conflict：唯一约束冲突（应用 code、表单 code 等） */
export class ConflictAppError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
    this.name = "ConflictAppError";
  }
}

/** 500 Internal Server Error：兜底用，隐藏内部细节 */
export class InternalAppError extends AppError {
  constructor(message = "Internal Server Error", details?: unknown) {
    super(500, "INTERNAL", message, details);
    this.name = "InternalAppError";
  }
}

/**
 * 类型守卫：判断一个值是否为 AppError（或带 status 字段的 HttpError）
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * 把任意未知异常归一化：业务错误保持原状，其他包成 500。
 * 用于 Service 层最外层 try/catch。
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    const e = err as { status: number; message?: string };
    return new AppError(
      e.status,
      e.status >= 500 ? "INTERNAL" : "BUSINESS",
      e.message ?? "Request Failed",
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new InternalAppError(msg);
}