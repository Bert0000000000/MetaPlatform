import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('apphub', '') });
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


import type { FlowConfig, FlowValidationResult, FlowTestResult, PageResponse, ModuleItem } from './types';

export async function getFlow(moduleId: string): Promise<FlowConfig> {
  return get<FlowConfig>(`/v1/wfe/flows/${moduleId}`);
}

export async function saveFlow(moduleId: string, config: FlowConfig): Promise<FlowConfig> {
  return put<FlowConfig>(`/v1/wfe/flows/${moduleId}`, config);
}

export async function validateFlow(config: FlowConfig): Promise<FlowValidationResult> {
  return post<FlowValidationResult>('/wfe/flows/validate', config);
}

export async function testFlow(config: FlowConfig): Promise<FlowTestResult> {
  return post<FlowTestResult>('/wfe/flows/test', config);
}

export async function publishFlow(moduleId: string, config: FlowConfig): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>(`/v1/wfe/flows/${moduleId}/publish`, config);
}

export async function listFormModules(appId: string): Promise<ModuleItem[]> {
  const res = await get<PageResponse<ModuleItem>>('/modules', { appId, type: 'FORM' });
  return res.items;
}
