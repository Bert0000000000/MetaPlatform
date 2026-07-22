import { apiClient, get, post } from './client';
import type {
  DataSource,
  ExecutionPlan,
  ExportFormat,
  QueryExecuteRequest,
  QueryExecuteResult,
  QueryHistoryItem,
} from '@/types';

export async function listDataSources(): Promise<DataSource[]> {
  const resp = await get<{ items: DataSource[]; total: number }>('/v1/data/datasources');
  return resp.items;
}

export async function executeQuery(req: QueryExecuteRequest): Promise<QueryExecuteResult> {
  return post<QueryExecuteResult>('/v1/data/queries/execute', req);
}

export async function getExecutionPlan(queryId: string): Promise<ExecutionPlan> {
  return get<ExecutionPlan>(`/v1/data/queries/${queryId}/execution-plan`);
}

export async function exportQueryResult(
  queryId: string,
  format: ExportFormat,
): Promise<Blob> {
  const response = await apiClient.post(
    `/v1/data/queries/${queryId}/export?format=${format}`,
    undefined,
    { responseType: 'blob' },
  );
  return response.data as Blob;
}

export async function listQueryHistory(): Promise<QueryHistoryItem[]> {
  const resp = await get<{ items: QueryHistoryItem[]; total: number }>(
    '/v1/data/queries/history',
  );
  return resp.items;
}
