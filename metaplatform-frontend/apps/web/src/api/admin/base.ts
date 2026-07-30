/**
 * Admin API client (shared base). All admin endpoints live under /api/v1/admin/*
 * and require a platform-admin role. The shared Axios client attaches the bearer
 * token automatically.
 */
import { apiClient } from "../client";
import type { ApiEnvelope, PageResult } from "@/types";

export const ADMIN_BASE = "/api/v1/admin";

export function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (
    payload &&
    typeof payload === "object" &&
    "code" in (payload as ApiEnvelope<T>) &&
    "data" in (payload as ApiEnvelope<T>)
  ) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export interface AdminListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export async function adminGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get(ADMIN_BASE + path, { params });
  return unwrap<T>(res.data);
}

export async function adminPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.post(ADMIN_BASE + path, body);
  return unwrap<T>(res.data);
}

export async function adminPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiClient.put(ADMIN_BASE + path, body);
  return unwrap<T>(res.data);
}

export async function adminDel<T>(path: string): Promise<T> {
  const res = await apiClient.delete(ADMIN_BASE + path);
  return unwrap<T>(res.data);
}

export async function adminGetPage<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<PageResult<T>> {
  const data = await adminGet<PageResult<T>>(path, params);
  return data;
}
