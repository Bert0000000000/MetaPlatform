/**
 * UV / PV / 申请 数据看板 API
 * 路径：/admin/analytics
 *
 * 当前实现：mock 数据（后端 mate-tech-analytics 域尚未实现），
 * 全部用 Promise.resolve() 立即返回。函数签名与真实接口一致，
 * 未来直接替换 mock 块为 apiClient.get() 即可。
 *
 * 接口路径约定（与后端 Pydantic router 对齐）：
 *   GET /api/v1/admin/analytics/uv-pv/summary
 *   GET /api/v1/admin/analytics/uv-pv/trend
 *   GET /api/v1/admin/analytics/application/summary
 *   GET /api/v1/admin/analytics/application/trend
 *   GET /api/v1/admin/analytics/application/funnel
 *   GET /api/v1/admin/analytics/distribution
 */
import { apiClient } from '../client';
import { ADMIN_BASE } from './base';
import type { ApiEnvelope } from '@/types';
import type {
  ApplicationSummary,
  ApplicationTrendPoint,
  DistributionResponse,
  FunnelStep,
  UvPvSummary,
  UvPvTrendPoint,
  AnalyticsRange,
} from '@/types/analytics';

const MOCK_ENABLED = true; // 后端就绪后改为 false

// ============================================================
// Mock 数据生成
// ============================================================

const SEED_BASE = 20260101;

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pastDays(n: number, end: Date = new Date()): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

/**
 * 构造 30 天带周末效应 + 缓慢上升趋势 + 微小日噪声的序列。
 * 周末 UV/PV 略低于工作日。
 */
function build30DaySeries(
  range: AnalyticsRange,
  base: number,
  amplitude: number,
  growthPerDay: number,
  rangeMin: [number, number],
  rangeMax: [number, number],
  weekendsWeaken = 0.18,
): number[] {
  const rand = seededRandom(SEED_BASE + Math.floor(base));
  const total = 30;
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    const dayOffset = i - (total - 1);
    const trend = growthPerDay * dayOffset;
    const seasonal = Math.sin((i / 7) * Math.PI * 2) * amplitude * 0.15;
    const noise = (rand() - 0.5) * amplitude * 0.5;
    let v = base + trend + seasonal + noise;
    // 周末弱化
    const d = new Date();
    d.setDate(d.getDate() - (total - 1 - i));
    const dow = d.getDay();
    if (dow === 0 || dow === 6) v *= 1 - weekendsWeaken;
    // 截断到给定区间
    v = Math.max(rangeMin[0], Math.min(rangeMax[1], v));
    out.push(Math.round(v));
  }
  // 按 range 裁剪
  if (range === 'today') return out.slice(-1);
  if (range === '7d') return out.slice(-7);
  return out;
}

function getMockUvPvSummary(range: AnalyticsRange): UvPvSummary {
  const uvSeries = build30DaySeries(range, 1100, 300, 6, [800, 1500], [600, 6000]);
  const pvSeries = build30DaySeries(range, 5200, 1500, 28, [3000, 8000], [2500, 12000]);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const last = uvSeries[uvSeries.length - 1] ?? 0;
  const last7 = sum(uvSeries.slice(-7));
  const last30 = sum(uvSeries);
  const todayPv = pvSeries[pvSeries.length - 1] ?? 0;
  const last7Pv = sum(pvSeries.slice(-7));
  const last30Pv = sum(pvSeries);
  return {
    uv: { today: last, last7d: last7, last30d: last30 },
    pv: { today: todayPv, last7d: last7Pv, last30d: last30Pv },
    pvPerUv: {
      today: last ? +(todayPv / last).toFixed(2) : 0,
      last7d: last7 ? +(last7Pv / last7).toFixed(2) : 0,
      last30d: last30 ? +(last30Pv / last30).toFixed(2) : 0,
    },
    checkedAt: new Date().toISOString(),
  };
}

function getMockApplicationSummary(range: AnalyticsRange): ApplicationSummary {
  // 申请数 5-25 之间
  const series = build30DaySeries(range, 14, 8, 0.12, [5, 25], [3, 60]);
  const sum = series.reduce((a, b) => a + b, 0);
  const today = series[series.length - 1] ?? 0;
  const last7 = series.slice(-7).reduce((a, b) => a + b, 0);
  return {
    applicationsToday: today,
    applicationsLast7d: last7,
    applicationsLast30d: sum,
    approvedRate: 0.72, // 72%
    approvedRateDelta: 0.018, // +1.8pp 较上一周期
    approvalDurationHours: 6.4,
    checkedAt: new Date().toISOString(),
  };
}

function getMockUvPvTrend(): UvPvTrendPoint[] {
  const days = pastDays(30);
  const uvSeries = build30DaySeries('30d', 1100, 300, 6, [800, 1500], [600, 6000]);
  const pvSeries = build30DaySeries('30d', 5200, 1500, 28, [3000, 8000], [2500, 12000]);
  const appSeries = build30DaySeries('30d', 14, 8, 0.12, [5, 25], [3, 60]);
  return days.map((d, i) => ({
    date: dateKey(d),
    uv: uvSeries[i] ?? 0,
    pv: pvSeries[i] ?? 0,
    applications: appSeries[i] ?? 0,
  }));
}

function getMockApplicationTrend(): ApplicationTrendPoint[] {
  const days = pastDays(30);
  const submitted = build30DaySeries('30d', 14, 8, 0.12, [5, 25], [3, 60]);
  const rand = seededRandom(SEED_BASE + 909);
  return days.map((d, i) => {
    const s = submitted[i] ?? 0;
    const approved = Math.round(s * (0.65 + rand() * 0.2));
    const rejected = Math.max(0, s - approved);
    return {
      date: dateKey(d),
      submitted: s,
      approved,
      rejected,
    };
  });
}

function getMockApplicationFunnel(): FunnelStep[] {
  const visit = 12480;
  const demoClick = Math.round(visit * 0.42);
  const formFill = Math.round(demoClick * 0.55);
  const submitted = Math.round(formFill * 0.68);
  return [
    { key: 'visit', label: '访问', value: visit, conversion: 1 },
    { key: 'demo_click', label: 'Demo 点击', value: demoClick, conversion: +(demoClick / visit).toFixed(3) },
    { key: 'form_fill', label: '表单填写', value: formFill, conversion: +(formFill / demoClick).toFixed(3) },
    { key: 'application_submit', label: '申请提交', value: submitted, conversion: +(submitted / formFill).toFixed(3) },
  ];
}

function getMockDistribution(): DistributionResponse {
  // 真实可信的分布：来源 top5、地域 top5、设备占比
  const source: DistributionResponse['source'] = [
    { key: 'baidu', label: '百度搜索', value: 1820, ratio: 0.27 },
    { key: 'direct', label: '直接访问', value: 1460, ratio: 0.215 },
    { key: 'google', label: '谷歌搜索', value: 1180, ratio: 0.174 },
    { key: 'wechat', label: '微信分享', value: 980, ratio: 0.144 },
    { key: 'github', label: 'GitHub', value: 620, ratio: 0.091 },
  ];
  const region: DistributionResponse['region'] = [
    { key: 'beijing', label: '北京', value: 1240, ratio: 0.182 },
    { key: 'shanghai', label: '上海', value: 1080, ratio: 0.158 },
    { key: 'guangdong', label: '广东', value: 920, ratio: 0.135 },
    { key: 'zhejiang', label: '浙江', value: 640, ratio: 0.094 },
    { key: 'sichuan', label: '四川', value: 480, ratio: 0.07 },
  ];
  const device: DistributionResponse['device'] = [
    { key: 'mobile', label: '移动端', value: 4380, ratio: 0.643 },
    { key: 'desktop', label: '桌面端', value: 2120, ratio: 0.311 },
    { key: 'tablet', label: '平板', value: 320, ratio: 0.046 },
  ];
  return {
    source,
    region,
    device,
    checkedAt: new Date().toISOString(),
  };
}

// ============================================================
// 真实 API 实现（mock 阶段直接返回 mock 数据）
// ============================================================

async function getReal<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await apiClient.get(ADMIN_BASE + path, { params });
  return (data as ApiEnvelope<T>).data;
}

export async function getUvPvSummary(range: AnalyticsRange): Promise<UvPvSummary> {
  if (MOCK_ENABLED) return getMockUvPvSummary(range);
  return getReal<UvPvSummary>('/analytics/uv-pv/summary', { range });
}

export async function getUvPvTrend(): Promise<UvPvTrendPoint[]> {
  if (MOCK_ENABLED) return getMockUvPvTrend();
  return getReal<UvPvTrendPoint[]>('/analytics/uv-pv/trend');
}

export async function getApplicationSummary(range: AnalyticsRange): Promise<ApplicationSummary> {
  if (MOCK_ENABLED) return getMockApplicationSummary(range);
  return getReal<ApplicationSummary>('/analytics/application/summary', { range });
}

export async function getApplicationTrend(): Promise<ApplicationTrendPoint[]> {
  if (MOCK_ENABLED) return getMockApplicationTrend();
  return getReal<ApplicationTrendPoint[]>('/analytics/application/trend');
}

export async function getApplicationFunnel(range: AnalyticsRange): Promise<FunnelStep[]> {
  if (MOCK_ENABLED) return getMockApplicationFunnel();
  return getReal<FunnelStep[]>('/analytics/application/funnel', { range });
}

export async function getAnalyticsDistribution(range: AnalyticsRange): Promise<DistributionResponse> {
  if (MOCK_ENABLED) return getMockDistribution();
  return getReal<DistributionResponse>('/analytics/distribution', { range });
}
