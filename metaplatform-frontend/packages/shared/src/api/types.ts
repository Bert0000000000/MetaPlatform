/**
 * 后端通用响应与分页结构（与 com.metaplatform.*.common.ApiResponse / PageResponse 对齐）
 */

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
}

export interface PageResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 业务错误异常（HTTP 200 但 code != 0）
 */
export class BizError extends Error {
  readonly code: number;
  readonly traceId?: string;
  readonly payload?: unknown;
  constructor(code: number, message: string, traceId?: string, payload?: unknown) {
    super(message);
    this.name = 'BizError';
    this.code = code;
    this.traceId = traceId;
    this.payload = payload;
  }
}

/**
 * HTTP 层错误（4xx/5xx）
 */
export class HttpError extends Error {
  readonly status: number;
  readonly traceId?: string;
  readonly payload?: unknown;
  constructor(status: number, message: string, traceId?: string, payload?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.traceId = traceId;
    this.payload = payload;
  }
}
