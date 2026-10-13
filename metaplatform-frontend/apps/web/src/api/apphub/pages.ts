import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}


import type { PageResponse } from './types';

export type DashboardWidgetType =
  | 'table'
  | 'chart-bar'
  | 'chart-line'
  | 'chart-pie'
  | 'chart-area'
  | 'chart-scatter'
  | 'gauge'
  | 'iframe'
  | 'rich-text'
  | 'stat'
  | 'text';

export type DataSourceType = 'ontology' | 'rag' | 'data' | 'static' | 'api';

export interface DataSourceBinding {
  type: DataSourceType;
  sourceId?: string;
  query?: string;
  filter?: Record<string, unknown>;
  refreshInterval?: number;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  dataSource?: DataSourceBinding;
  apiExample?: string;
  config?: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface PageScripts {
  onLoad?: string;
  onShow?: string;
}

export interface PageDesignerConfig {
  application_metadata_updated?: boolean;
  binding?: OrderBinding;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout?: 'grid' | 'free';
  scripts?: PageScripts;
}

export async function getPage(id: string): Promise<PageDesignerConfig> {
  return get<PageDesignerConfig>(`/pages/${id}`);
}

export async function savePage(id: string, config: PageDesignerConfig): Promise<PageDesignerConfig> {
  return put<PageDesignerConfig>(`/pages/${id}`, config);
}

export async function deletePage(id: string): Promise<void> {
  return del<void>(`/pages/${id}`);
}

export async function listPages(): Promise<PageResponse<{ id: string; name: string; module_code: string }>> {
  return get<PageResponse<{ id: string; name: string; module_code: string }>>('/pages');
}


export interface OrderBinding {
  object_type: string;
  model_checksum: string;
  customer_type: string;
  customer_checksum: string;
  fields: string[];
  link_type: string;
  action_rid: string;
  action_checksum?: string;
  link_checksum?: string;
  object_set: { filter_expr: string; paging_limit: number };
  field_metadata?: Array<{ rid: string; title?: string; format: string }>;
  action_parameters?: Array<{ rid: string; title?: string; format: string; nullable: boolean }>;
}


export class OrderPageCreationError extends Error {
  constructor(public readonly moduleCode: string, cause: unknown) {
    super(`模块已创建（${moduleCode}），页面创建未确认成功：${cause instanceof Error ? cause.message : '请求失败'}。可重试并复用此模块。`);
  }
}

export async function createOrderReviewPage(appCode: string, resumeModuleCode?: string): Promise<{ id: string }> {
  const code = resumeModuleCode || 'review-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  if (!resumeModuleCode) {
    await client.post('/modules', { name: '订单审核', code, app_code: appCode, description: '订单审核页面', entry_path: '' });
  }
  try {
    if (resumeModuleCode) {
      const existing = (await listPages()).items.find(p => p.module_code === code);
      if (existing) return { id: existing.id };
    }
    return data(await client.post<{ id: string }>('/pages', { name: '订单审核', code, module_code: code, layout: 'grid' }));
  } catch (error) { throw new OrderPageCreationError(code, error); }
}
