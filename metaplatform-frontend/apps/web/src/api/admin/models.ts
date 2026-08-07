// AI 模型注册表 API（后台 AI Providers 页「获取模型」）
import { apiClient } from '@/api/client';

const ADMIN_BASE = '/admin';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function unwrap<T>(envelope: ApiEnvelope<T> | T): T {
  if (envelope && typeof envelope === 'object' && 'code' in envelope && 'data' in envelope) {
    return (envelope as ApiEnvelope<T>).data;
  }
  return envelope as T;
}

export interface AiModelItem {
  id?: number;
  provider: string;
  modelId: string;
  displayName?: string | null;
  modality: string;
  enabled: boolean;
}

interface AiModelListResponse {
  items: AiModelItem[];
  total: number;
}

export async function listAiModels(params?: {
  provider?: string;
  modality?: string;
}): Promise<AiModelItem[]> {
  const { data } = await apiClient.get(ADMIN_BASE + '/ai/models', {
    params: params ?? undefined,
  });
  const resp = unwrap<AiModelListResponse>(data);
  return resp?.items ?? [];
}

export async function saveAiModelsBulk(
  provider: string,
  items: Array<{ modelId: string; displayName?: string; modality?: string; enabled?: boolean }>,
): Promise<{ created: number }> {
  const { data } = await apiClient.post(ADMIN_BASE + '/ai/models/bulk', {
    provider,
    items: items.map((it) => ({
      provider,
      model_id: it.modelId,
      display_name: it.displayName,
      modality: it.modality ?? 'text',
      enabled: it.enabled ?? true,
    })),
  });
  return unwrap<{ created: number }>(data);
}

export async function updateAiModel(
  id: number,
  patch: Partial<Omit<AiModelItem, 'id'>>,
): Promise<AiModelItem> {
  const { data } = await apiClient.put(ADMIN_BASE + '/ai/models/' + id, {
    provider: patch.provider ?? '',
    model_id: patch.modelId ?? '',
    display_name: patch.displayName,
    modality: patch.modality ?? 'text',
    enabled: patch.enabled ?? true,
  });
  return unwrap<AiModelItem>(data);
}

export async function deleteAiModel(id: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete(ADMIN_BASE + '/ai/models/' + id);
  return unwrap<{ deleted: number }>(data);
}
