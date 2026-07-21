import { get, post, put, del } from './client';
import type { ValueStream, ValueStreamStage, ValueStreamCreateRequest, ValueStreamStageCreateRequest, ValueStreamStageUpdateRequest } from '@/types';

export async function listValueStreams(): Promise<ValueStream[]> {
  return get<ValueStream[]>('/v1/ea/value-streams');
}

export async function createValueStream(req: ValueStreamCreateRequest): Promise<ValueStream> {
  return post<ValueStream>('/v1/ea/value-streams', req);
}

export async function updateValueStream(id: string, req: Partial<ValueStreamCreateRequest>): Promise<ValueStream> {
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
