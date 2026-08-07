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
  // 兼容尚未重启的旧后端：当 category 不在已知枚举里时不要传，避免 422
  const known = new Set<string>([
    "SSO", "LICENSE", "MESSAGE", "RATE_LIMIT", "SECURITY", "BRANDING", "OTHER",
  ]);
  if (p?.category && known.has(p.category)) params.category = p.category;
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

export interface ConfigCreateItem {
  key: string;
  value?: string;
  value_type?: string;
  category?: string;
  label?: string;
  is_sensitive?: boolean;
}

export async function batchCreateConfigs(items: ConfigCreateItem[]): Promise<{ created: Array<{ key: string; label: string | null }>; count: number }> {
  const { data } = await apiClient.post(ADMIN_BASE + "/configs/batch", { items });
  return unwrap<{ created: Array<{ key: string; label: string | null }>; count: number }>(data as ApiEnvelope<{ created: Array<{ key: string; label: string | null }>; count: number }>);
}
