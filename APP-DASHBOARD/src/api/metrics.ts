import { get } from './client';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/types';

export async function getMetricCards(): Promise<MetricCard[]> {
  return get<MetricCard[]>('/v1/obs/metrics/cards');
}

export async function getMetricTrend(range: TimeRange): Promise<MetricTrendPoint[]> {
  return get<MetricTrendPoint[]>('/v1/obs/metrics/trend', { range });
}
