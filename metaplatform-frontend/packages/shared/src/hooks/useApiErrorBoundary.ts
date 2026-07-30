import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { App, message } from 'antd';
import { BizError, HttpError, isApiError } from '../api/errors';

interface UseApiErrorOptions {
  /** When provided, attach error to App.useApp().message context. */
  context?: 'global' | 'local';
  /** When true, do not show toast automatically (caller will surface). */
  silent?: boolean;
  /** Optional fallback message when the error has no friendly text. */
  fallback?: string;
  /** When provided, fire callback with normalized error instead of toast. */
  onError?: (e: NormalizedError) => void;
}

export interface NormalizedError {
  code: string;
  message: string;
  traceId?: string;
  status: number;
  fieldErrors?: Record<string, string>;
  raw: unknown;
}

const FRIENDLY_HEADERS = ['操作失败', '加载失败', '提交失败', '请求失败'];

function normalize(err: unknown): NormalizedError {
  if (isApiError(err)) {
    const e = err as BizError | HttpError;
    const bizCode = (e as BizError).code;
    const httpStatus = (e as HttpError).status;
    const code: string = String(bizCode ?? `HTTP_${httpStatus ?? 0}`);
    const message: string = e.message || '????';
    const traceId: string | undefined = e.traceId;
    const status: number = httpStatus ?? 0;
    return { code, message, traceId, status, raw: err };
  }
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message, status: 0, raw: err };
  }
  return { code: 'UNKNOWN', message: '请求失败', status: 0, raw: err };
}

function friendlyPrefix(status: number): string {
  if (status === 401) return '未授权';
  if (status === 403) return '没有权限';
  if (status === 404) return '资源不存在';
  if (status >= 500) return '服务异常';
  return '操作失败';
}

/**
 * useApiErrorBoundary — single hook every page should call to normalize
 * server errors. Pairs well with `try { ... } catch (e) { handleError(e) }`.
 *
 * It does not throw or call any boundary; it toasts and exposes a manual
 * surfacing hook for use inside a route-level ErrorBoundary.
 */
export function useApiErrorBoundary(opts: UseApiErrorOptions = {}) {
  const { message: msgApi, modal } = App.useApp();
  const location = useLocation();
  const lastErrorRef = useRef<NormalizedError | null>(null);
  const [lastError, setLastError] = useState<NormalizedError | null>(null);

  const report = useCallback(
    (err: unknown) => {
      const norm = normalize(err);
      lastErrorRef.current = norm;
      setLastError(norm);
      if (opts.onError) {
        opts.onError(norm);
      }
      if (opts.silent) return norm;
      if (norm.status === 401) {
        msgApi.error('登录已过期，请重新登录');
        return norm;
      }
      const header = FRIENDLY_HEADERS.find((h) => norm.message.startsWith(h)) ?? friendlyPrefix(norm.status);
      const detail = norm.message ? `：${norm.message}` : '';
      msgApi.error(`${header}${detail}`);
      if (norm.status === 403) {
        // no-op: page should render forbidden state via lastError
      }
      return norm;
    },
    [msgApi, opts],
  );

  const dismiss = useCallback(() => {
    lastErrorRef.current = null;
    setLastError(null);
  }, []);

  useEffect(() => {
    // Reset last error on route change so each page starts clean.
    dismiss();
  }, [location.pathname, dismiss]);

  return {
    report,
    dismiss,
    lastError,
    /** Convenience: prompts the user with a confirmation modal. */
    confirm: (desc: string, danger = false) =>
      modal.confirm({
        title: '确认操作',
        content: desc,
        okText: '确认',
        okButtonProps: { danger },
        cancelText: '取消',
      }),
  };
}
