import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { getToken, removeToken } from '@/utils/auth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
        message.error(data.message || '请求失败');
        return Promise.reject(new Error(data.message || '请求失败'));
      }
    }
    return response;
  },
  (error: AxiosError<{ code?: string; message?: string }>) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message || '网络错误';
    if (status === 401) {
      removeToken();
      message.error('登录已过期，请重新登录');
      window.location.href = '/login';
    } else {
      message.error(msg);
    }
    return Promise.reject(error);
  }
);

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
