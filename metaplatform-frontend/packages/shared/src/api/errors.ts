import { BizError, HttpError, type ApiResponse } from './types';

export type ApiErrorKind = BizError | HttpError;

export function isApiError(value: unknown): value is BizError | HttpError {
  return value instanceof BizError || value instanceof HttpError;
}

export function isBizError(value: unknown): value is BizError {
  return value instanceof BizError;
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}

export type { ApiResponse, BizError, HttpError };
