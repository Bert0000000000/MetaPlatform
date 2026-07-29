import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('dashboard', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return data(await client.get<T>(url, params ? { params } : undefined));
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.post<T>(url, body));
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  return data(await client.put<T>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return data(await client.delete<T>(url));
}



import type { MetricCard, MetricTrendPoint, TimeRange } from './types';

export async function getMetricCards(): Promise<MetricCard[]> {
  return get<MetricCard[]>('/v1/dashboard/metrics');
}

export async function getMetricTrend(range: TimeRange): Promise<MetricTrendPoint[]> {
  return get<MetricTrendPoint[]>('/v1/dashboard/metrics/trend', { range });
}
