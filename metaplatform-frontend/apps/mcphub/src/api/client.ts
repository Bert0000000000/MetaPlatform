import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { getToken, removeToken } from '@mate/shared';
export const apiClient = axios.create({
  baseURL: '/api',
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
    const data = response.data as { code?: string | number; message?: string };
    if (
      data &&
      typeof data.code !== 'undefined' &&
      data.code !== 'SUCCESS' &&
      data.code !== '200' &&
      data.code !== 0
    ) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return response;
  },
  (error: AxiosError<{ code?: string | number; message?: string }>) => {
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
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get(url, { params });
  return (response.data as { data: T }).data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.post(url, body);
  return (response.data as { data: T }).data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.put(url, body);
  return (response.data as { data: T }).data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.patch(url, body);
  return (response.data as { data: T }).data;
}

export async function del<T>(url: string): Promise<T> {
  const response = await apiClient.delete(url);
  return (response.data as { data: T }).data;
}

export async function download(url: string, params?: Record<string, unknown>): Promise<Blob> {
  const response = await apiClient.get(url, {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
}
