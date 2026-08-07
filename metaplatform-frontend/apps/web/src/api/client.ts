import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from '@mate/shared';
import { getToken, removeToken, getRefreshToken, setToken, setRefreshToken } from '@/utils/auth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Proactive refresh: access token TTL is 1h; if it is expired (or about
  // to expire within 10s), exchange the refresh token first so requests
  // never fire with a stale token. Expired tokens make admin endpoints
  // treat the caller as anonymous and return 403 (not 401), so a
  // 401-only refresh would miss them.
  const token = getToken();
  if (token && isJwtExpiring(token)) {
    await tryRefreshToken();
  }
  const fresh = getToken();
  if (fresh && config.headers) {
    config.headers.Authorization = `Bearer ${fresh}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    // Backend ApiResponse.success() returns code: 0 (number) with message: "success".
    // Treat 0 / "0" / "SUCCESS" / "200" as success; any other non-zero code is a business error.
    if (data && typeof data === 'object' && 'code' in data) {
      const code = data.code;
      const isSuccess =
        code === 0 ||
        code === '0' ||
        code === 'SUCCESS' ||
        code === '200' ||
        code === 200;
      if (!isSuccess) {
        toast(data.message || '请求失败', 'error');
        return Promise.reject(new Error(data.message || '请求失败'));
      }
    }
    return response;
  },
  (error: AxiosError<{ code?: string; message?: string }>) => {
    // Ignore browser-aborted requests (e.g. navigation/HMR/StrictMode unmount)
    // to avoid misleading error toasts and redirects.
    const isAborted =
      error.code === 'ERR_CANCELED' ||
      error.code === 'ECONNABORTED' ||
      error.message?.toLowerCase().includes('aborted') ||
      error.message?.toLowerCase().includes('canceled');
    if (isAborted) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || '网络错误';
    if (status === 401) {
      const onLoginPage =
        typeof window !== 'undefined' && window.location.pathname === '/login';
      // When on the login page, silently ignore 401s from best-effort calls
      // (e.g. SettingsContext probing /v1/dashboard/settings) to avoid loops/toasts.
      if (onLoginPage) {
        return Promise.reject(error);
      }
      // Try to refresh the access token and replay the original request
      // before giving up and forcing a re-login.
      return tryRefreshToken().then((refreshed) => {
        if (refreshed) {
          const original = error.config as InternalAxiosRequestConfig | undefined;
          if (original) {
            const fresh = getToken();
            original.headers.Authorization = fresh ? `Bearer ${fresh}` : undefined;
            return apiClient.request(original);
          }
        }
        removeToken();
        toast('登录已过期，请重新登录', 'error');
        window.location.href = '/login';
        return Promise.reject(error);
      });
    } else {
      toast(msg, 'error');
    }
    return Promise.reject(error);
  }
);

// ---- Token refresh (mirrors @mate/shared's client, using web auth utils) ----

let _refreshInflight: Promise<boolean> | null = null;

function isJwtExpiring(token: string, skewSeconds = 10): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return false;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshInflight) return _refreshInflight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  _refreshInflight = (async () => {
    try {
      const resp = await axios.post(
        '/api/v1/iam/auth/refresh',
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
      );
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

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get(url, { params });
  return response.data.data as T;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.post(url, body);
  return response.data.data as T;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.put(url, body);
  return response.data.data as T;
}

export async function del<T>(url: string): Promise<T> {
  const response = await apiClient.delete(url);
  return response.data.data as T;
}
