import { get } from './client';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/types';

export async function getMetricCards(): Promise<MetricCard[]> {
  return get<MetricCard[]>('/v1/dashboard/metrics');
}

export async function getMetricTrend(range: TimeRange): Promise<MetricTrendPoint[]> {
  return get<MetricTrendPoint[]>('/v1/dashboard/metrics/trend', { range });
}
