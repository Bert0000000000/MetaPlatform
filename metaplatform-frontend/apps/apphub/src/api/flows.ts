import { get, post, put } from './client';
import type { FlowConfig, FlowValidationResult, FlowTestResult, PageResponse, ModuleItem } from '@/types';

export async function getFlow(moduleId: string): Promise<FlowConfig> {
  return get<FlowConfig>(`/v1/wfe/flows/${moduleId}`);
}

export async function saveFlow(moduleId: string, config: FlowConfig): Promise<FlowConfig> {
  return put<FlowConfig>(`/v1/wfe/flows/${moduleId}`, config);
}

export async function validateFlow(config: FlowConfig): Promise<FlowValidationResult> {
  return post<FlowValidationResult>('/v1/wfe/flows/validate', config);
}

export async function testFlow(config: FlowConfig): Promise<FlowTestResult> {
  return post<FlowTestResult>('/v1/wfe/flows/test', config);
}

export async function publishFlow(moduleId: string, config: FlowConfig): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>(`/v1/wfe/flows/${moduleId}/publish`, config);
}

export async function listFormModules(appId: string): Promise<ModuleItem[]> {
  const res = await get<PageResponse<ModuleItem>>('/v1/apphub/modules', { appId, type: 'FORM' });
  return res.items;
}
