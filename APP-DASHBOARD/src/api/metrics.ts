import { get } from './client';
import type { MetricCard, MetricTrendPoint, TimeRange } from '@/types';

const MOCK_CARDS: MetricCard[] = [
  { key: 'users', label: '总用户数', value: 1286, unit: '人', trend: 5.2, trendUp: true, icon: 'team' },
  { key: 'workflows', label: '活跃流程', value: 342, unit: '个', trend: 12.8, trendUp: true, icon: 'workflow' },
  { key: 'apiCalls', label: 'API 调用', value: 89654, unit: '次', trend: 8.3, trendUp: true, icon: 'api' },
  { key: 'errorRate', label: '错误率', value: 0.32, unit: '%', trend: 1.5, trendUp: false, icon: 'error' },
];

function generateTrendData(range: TimeRange): MetricTrendPoint[] {
  const points: MetricTrendPoint[] = [];
  const now = Date.now();
  let count = 24;
  let interval = 3600000;
  if (range === '1h') {
    count = 12;
    interval = 300000;
  } else if (range === '24h') {
    count = 24;
    interval = 3600000;
  } else if (range === '7d') {
    count = 7;
    interval = 86400000;
  } else if (range === '30d') {
    count = 30;
    interval = 86400000;
  }
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now - i * interval).toISOString();
    const base = 3000 + Math.random() * 2000;
    points.push({
      time,
      value: Math.round(base),
      apiCalls: Math.round(base * 10 + Math.random() * 1000),
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
    return await get<MetricTrendPoint[]>('/v1/obs/metrics/trend', { range });
  } catch {
    return generateTrendData(range);
  }
}
