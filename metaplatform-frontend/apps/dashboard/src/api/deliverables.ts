import { get, post, del } from './client';
import type { Deliverable, DeliverableType, PageResponse } from '@/types';

export async function listDeliverables(params?: { keyword?: string; type?: DeliverableType }): Promise<PageResponse<Deliverable>> {
  return get<PageResponse<Deliverable>>('/v1/dashboard/deliverables', params as Record<string, unknown> | undefined);
}

export async function searchDeliverables(keyword: string): Promise<Deliverable[]> {
  const res = await listDeliverables({ keyword });
  return res.items;
}

export async function downloadDeliverable(id: string, format: string): Promise<{ downloadUrl: string; message: string }> {
  return post<{ downloadUrl: string; message: string }>(`/v1/dashboard/deliverables/${id}/download`, { format });
}

export async function deleteDeliverable(id: string): Promise<void> {
  await del<void>(`/v1/dashboard/deliverables/${id}`);
}
