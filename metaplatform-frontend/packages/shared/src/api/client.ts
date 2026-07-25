/**
 * 统一 axios 客户端
 *
 * 功能：
 * - 请求拦截：注入 Bearer token / 注入 traceId / 注入租户 ID
 * - 响应拦截：解包 ApiResponse（取 data 字段）/ 统一错误抛出 BizError/HttpError
 * - 401 自动刷新 token（调用 /api/v1/iam/auth/refresh）并重放当前请求
 */

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from '../config/apiConfig';
import { BizError, HttpError, type ApiResponse } from './types';
import { getToken, getRefreshToken, getTenantId, setToken, setRefreshToken, removeToken } from '../auth/token';

function genTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createApiClient(opts: { baseURL?: string } = {}): AxiosInstance {
  const instance = axios.create({
    baseURL: opts.baseURL ?? API_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  // === 请求拦截器 ===
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getToken();
      if (token && config.headers) {
        config.headers.set('Authorization', 'Bearer ' + token);
      }
      const traceId = config.headers.get('X-Trace-Id') || genTraceId();
      config.headers.set('X-Trace-Id', traceId);
      const tenantId = getTenantId();
      if (tenantId && config.headers) {
        config.headers.set('X-Tenant-Id', tenantId);
      }
      return config;
    },
    (err) => Promise.reject(err)
  );

  // === 响应拦截器 ===
  instance.interceptors.response.use(
    (resp) => {
      const data = resp.data;
      if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
        const wrapped = data as ApiResponse<unknown>;
        if (wrapped.code === 0) {
          resp.data = wrapped.data;
          return resp;
        }
        throw new BizError(wrapped.code, wrapped.message || '业务错误', wrapped.traceId, wrapped);
      }
      return resp;
    },
    async (err: AxiosError) => {
      const status = err.response?.status ?? 0;
      const traceId = (err.response?.headers?.['x-trace-id'] as string | undefined) ?? undefined;
      let message = err.message || '网络错误';
      const payload = err.response?.data;
      if (payload && typeof payload === 'object' && 'message' in payload) {
        message = (payload as { message?: string }).message ?? message;
      }

      if (status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          const original = err.config as AxiosRequestConfig | undefined;
          if (original) {
            original.headers = {
              ...(original.headers ?? {}),
              Authorization: 'Bearer ' + getToken(),
            } as any;
            return instance.request(original);
          }
        } else {
          removeToken();
        }
      }

      throw new HttpError(status, message, traceId, payload);
    }
  );

  return instance;
}

let _refreshInflight: Promise<boolean> | null = null;
async function tryRefreshToken(): Promise<boolean> {
  if (_refreshInflight) return _refreshInflight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  _refreshInflight = (async () => {
    try {
      const resp = await axios.post(API_BASE + '/iam/auth/refresh', { refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const data = resp.data?.data ?? resp.data;
      if (data && data.accessToken) {
        setToken(data.accessToken);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshInflight = null;
    }
  })();
  return _refreshInflight;
}

/** 默认客户端实例 */
export const apiClient: AxiosInstance = createApiClient();
