import { apiClient } from "../client";
import { ADMIN_BASE, unwrap } from "./base";
import type {
  AdminSystemConfig,
  ApiEnvelope,
  ConfigCategory,
  PageResult,
} from "@/types";

export interface ListConfigsParams {
  category?: ConfigCategory;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function listConfigs(p?: ListConfigsParams): Promise<PageResult<AdminSystemConfig>> {
  const params: Record<string, unknown> = {};
  if (p?.category) params.category = p.category;
  if (p?.keyword) params.keyword = p.keyword;
  if (p?.page) params.page = p.page;
  if (p?.pageSize) params.pageSize = p.pageSize;
  const { data } = await apiClient.get(ADMIN_BASE + "/configs", { params });
  return unwrap<PageResult<AdminSystemConfig>>(data as ApiEnvelope<PageResult<AdminSystemConfig>>);
}

export async function listConfigCategories(): Promise<{ value: string; count: number }[]> {
  const { data } = await apiClient.get(ADMIN_BASE + "/configs/categories");
  return unwrap<{ value: string; count: number }[]>(data as ApiEnvelope<{ value: string; count: number }[]>);
}

export async function updateConfig(key: string, value: unknown, note?: string): Promise<AdminSystemConfig> {
  const { data } = await apiClient.put(ADMIN_BASE + "/configs/" + key, { value, note });
  return unwrap<AdminSystemConfig>(data as ApiEnvelope<AdminSystemConfig>);
}
