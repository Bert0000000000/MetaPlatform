import { get } from './client';
import type { OverviewResponse } from '@/types';

export async function getOverview(): Promise<OverviewResponse> {
  return get<OverviewResponse>('/v1/mcp/overview');
}
