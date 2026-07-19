import { get } from './client';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/types';

const MOCK_CARDS: MetricCard[] = [
  { key: 'users', label: '在线用户', value: 42, unit: '人', trend: 12, trendUp: true, icon: 'team' },
  { key: 'workflows', label: '运行中流程', value: 18, unit: '个', trend: 5, trendUp: true, icon: 'workflow' },
  { key: 'apis', label: 'API 调用', value: 12_580, unit: '次', trend: 8, trendUp: true, icon: 'api' },
  { key: 'errors', label: '错误率', value: 0.3, unit: '%', trend: 2, trendUp: false, icon: 'error' },
];

function buildMockTrend(_range: TimeRange): MetricTrendPoint[] {
  const points: MetricTrendPoint[] = [];
  const now = Date.now();
  const count = 12;
  for (let i = 0; i < count; i++) {
    const time = new Date(now - (count - i) * 3_600_000).toISOString();
    points.push({
      time,
      value: Math.round(1000 + Math.random() * 2000),
      apiCalls: Math.round(800 + Math.random() * 1500),
      errors: Math.round(Math.random() * 20),
    });
  }
  return points;
}

export async function getMetricCards(): Promise<MetricCard[]> {
  try {
    return await get<MetricCard[]>('/v1/obs/metrics/cards');
  } catch {
    return MOCK_CARDS;
  }
}

export async function getMetricTrend(range: TimeRange): Promise<MetricTrendPoint[]> {
  try {
    const data = await get<MetricTrendPoint[]>('/v1/obs/metrics/trend', { range });
    return Array.isArray(data) ? data : buildMockTrend(range);
  } catch {
    return buildMockTrend(range);
  }
}
