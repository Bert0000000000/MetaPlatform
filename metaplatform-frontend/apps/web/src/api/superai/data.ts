import { createApiClient, apiPath } from '@mate/shared/api';

export const apiClient = createApiClient({ baseURL: apiPath('copilot', '') });
const data = <T>(resp: { data: T }): T => resp.data;
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await apiClient.get<T>(url, params ? { params } : undefined)); }
export async function post<T>(url: string, body?: unknown): Promise<T> { return data(await apiClient.post<T>(url, body)); }
export async function put<T>(url: string, body?: unknown): Promise<T> { return data(await apiClient.put<T>(url, body)); }
export async function del<T>(url: string): Promise<T> { return data(await apiClient.delete<T>(url)); }

import type {
  DataSource,
  ExecutionPlan,
  ExportFormat,
  QueryExecuteRequest,
  QueryExecuteResult,
  QueryHistoryItem,
} from '@/api/superai/types';
export async function listDataSources(): Promise<DataSource[]> {
  const resp = await get<{ items: DataSource[]; total: number }>('/datasources');
  return resp.items;
}
export async function executeQuery(req: QueryExecuteRequest): Promise<QueryExecuteResult> {
  return post<QueryExecuteResult>('/queries/execute', req);
}
export async function getExecutionPlan(queryId: string): Promise<ExecutionPlan> {
  return get<ExecutionPlan>(`/queries/${queryId}/execution-plan`);
}
export async function exportQueryResult(
  queryId: string,
  format: ExportFormat,
): Promise<Blob> {
  const response = await apiClient.post(
    `/queries/${queryId}/export?format=${format}`,
    undefined,
    { responseType: 'blob' },
  );
  return response.data as Blob;
}
export async function listQueryHistory(): Promise<QueryHistoryItem[]> {
  const resp = await get<{ items: QueryHistoryItem[]; total: number }>(
    '/queries/history',
  );
  return resp.items;
}
