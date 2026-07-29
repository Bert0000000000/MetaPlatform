import { createApiClient, apiPath } from '@mate/shared/api';

const client = createApiClient({ baseURL: apiPath('ea', '/v1') });
const data = <T>(resp: { data: T }): T => resp.data;
async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return data(await client.get<T>(url, params ? { params } : undefined)); }
async function post<T>(url: string, body?: unknown): Promise<T> { return data(await client.post<T>(url, body)); }
async function put<T>(url: string, body?: unknown): Promise<T> { return data(await client.put<T>(url, body)); }
async function del<T>(url: string): Promise<T> { return data(await client.delete<T>(url)); }

import type { ValueStream, ValueStreamStage, ValueStreamCreateRequest, ValueStreamUpdateRequest, ValueStreamStageCreateRequest, ValueStreamStageUpdateRequest } from './types';

export async function listValueStreams(): Promise<ValueStream[]> {
  return get<ValueStream[]>('/v1/ea/value-streams');
}

export async function createValueStream(req: ValueStreamCreateRequest): Promise<ValueStream> {
  return post<ValueStream>('/v1/ea/value-streams', req);
}

export async function updateValueStream(id: string, req: ValueStreamUpdateRequest): Promise<ValueStream> {
  return put<ValueStream>(`/v1/ea/value-streams/${id}`, req);
}

export async function deleteValueStream(id: string): Promise<void> {
  await del<void>(`/v1/ea/value-streams/${id}`);
}

export async function linkCapabilities(id: string, capabilityIds: string[], stageName?: string): Promise<void> {
  await post<void>(`/v1/ea/value-streams/${id}/capabilities`, { capabilityIds, stageName });
}

export async function listStages(valueStreamId: string): Promise<ValueStreamStage[]> {
  return get<ValueStreamStage[]>(`/v1/ea/value-streams/${valueStreamId}/stages`);
}

export async function createStage(valueStreamId: string, req: ValueStreamStageCreateRequest): Promise<ValueStreamStage> {
  return post<ValueStreamStage>(`/v1/ea/value-streams/${valueStreamId}/stages`, req);
}

export async function updateStage(valueStreamId: string, stageId: string, req: ValueStreamStageUpdateRequest): Promise<ValueStreamStage> {
  return put<ValueStreamStage>(`/v1/ea/value-streams/${valueStreamId}/stages/${stageId}`, req);
}

export async function deleteStage(valueStreamId: string, stageId: string): Promise<void> {
  await del<void>(`/v1/ea/value-streams/${valueStreamId}/stages/${stageId}`);
}
