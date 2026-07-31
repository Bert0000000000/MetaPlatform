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

export async function listPages(): Promise<PageResponse<{ id: string; name: string }>> {
  return get<PageResponse<{ id: string; name: string }>>('/pages');
}
