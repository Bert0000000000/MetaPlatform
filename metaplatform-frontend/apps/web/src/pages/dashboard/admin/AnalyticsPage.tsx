import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Radio, Skeleton, Tag } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  getAnalyticsDistribution,
  getApplicationFunnel,
  getApplicationSummary,
  getUvPvSummary,
  getUvPvTrend,
} from '@/api/admin';
import type {
  AnalyticsRange,
  ApplicationSummary,
  DistributionResponse,
  FunnelStep,
  UvPvSummary,
  UvPvTrendPoint,
} from '@/types/analytics';
import { EmptyState, PageHeader } from '@/components/skeleton';
import UvPvTrendChart from './components/UvPvTrendChart';
import FunnelCard from './components/FunnelCard';
import DistributionCard from './components/DistributionCard';
import './admin.css';

const RANGE_OPTIONS: Array<{ label: string; value: AnalyticsRange }> = [
  { label: '今日', value: 'today' },
  { label: '7 日', value: '7d' },
  { label: '30 日', value: '30d' },
];

function rangeLabel(r: AnalyticsRange): string {
  switch (r) {
    case 'today':
      return '今日';
    case '7d':
      return '7 日';
    case '30d':
      return '30 日';
    default:
      return r;
  }
}

/** 按选中时间范围取三元组（今日 / 7 日 / 30 日）。 */
function pickTriple(t: { today: number; last7d: number; last30d: number }, r: AnalyticsRange): number {
  if (r === 'today') return t.today;
  if (r === '7d') return t.last7d;
  return t.last30d;
}

function pickApplications(summary: ApplicationSummary, r: AnalyticsRange): number {
  if (r === 'today') return summary.applicationsToday;
  if (r === '7d') return summary.applicationsLast7d;
  return summary.applicationsLast30d;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * 平台管理 · 使用分析（DESIGN-SPEC §5 版式 E：页头 + KPI 行 + 区块）。
 * 数据面沿用 src/api/admin/analytics.ts；趋势图固定展示最近 30 天，其余指标跟随时间范围。
 */
export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d');

  const [uvPvSummary, setUvPvSummary] = useState<UvPvSummary | null>(null);
  const [appSummary, setAppSummary] = useState<ApplicationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [trend, setTrend] = useState<UvPvTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');

  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [funnelError, setFunnelError] = useState('');

  const [distribution, setDistribution] = useState<DistributionResponse | null>(null);
  const [distributionLoading, setDistributionLoading] = useState(true);
  const [distributionError, setDistributionError] = useState('');

  const loadSummary = useCallback(async (r: AnalyticsRange) => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const [uv, app] = await Promise.all([getUvPvSummary(r), getApplicationSummary(r)]);
      setUvPvSummary(uv);
      setAppSummary(app);
    } catch (e) {
      setUvPvSummary(null);
      setAppSummary(null);
      setSummaryError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const data = await getUvPvTrend();
      setTrend(Array.isArray(data) ? data : []);
    } catch (e) {
      setTrend([]);
      setTrendError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const loadFunnel = useCallback(async (r: AnalyticsRange) => {
    setFunnelLoading(true);
    setFunnelError('');
    try {
      const data = await getApplicationFunnel(r);
      setFunnel(Array.isArray(data) ? data : []);
    } catch (e) {
      setFunnel([]);
      setFunnelError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunnelLoading(false);
    }
  }, []);

  const loadDistribution = useCallback(async (r: AnalyticsRange) => {
    setDistributionLoading(true);
    setDistributionError('');
    try {
      setDistribution(await getAnalyticsDistribution(r));
    } catch (e) {
      setDistribution(null);
      setDistributionError(e instanceof Error ? e.message : String(e));
    } finally {
      setDistributionLoading(false);
    }
  }, []);

  const reloadAll = useCallback(() => {
    void loadSummary(range);
    void loadTrend();
    void loadFunnel(range);
    void loadDistribution(range);
  }, [range, loadSummary, loadTrend, loadFunnel, loadDistribution]);

  useEffect(() => {
    void loadSummary(range);
    void loadFunnel(range);
    void loadDistribution(range);
  }, [range, loadSummary, loadFunnel, loadDistribution]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  const uvValue = uvPvSummary ? pickTriple(uvPvSummary.uv, range) : 0;
  const pvValue = uvPvSummary ? pickTriple(uvPvSummary.pv, range) : 0;
  const pvPerUv = uvPvSummary ? pickTriple(uvPvSummary.pvPerUv, range) : 0;
  const appCount = appSummary ? pickApplications(appSummary, range) : 0;
  const appPerUv = (appCount / Math.max(1, uvValue)) * 100;

  return (
    <>
      <PageHeader
        title="UV / PV / 申请看板"
        desc="实时反映官网 / 落地页 / 申请入口的访问与转化；趋势图固定展示最近 30 天"
        actions={
          <>
            <Radio.Group
              type="button"
              options={RANGE_OPTIONS}
              value={range}
              onChange={(e) => setRange(e.target.value as AnalyticsRange)}
            />
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={summaryLoading || trendLoading || funnelLoading || distributionLoading}
              onClick={reloadAll}
            >
              刷新
            </Button>
          </>
        }
      />

      <div className="mp-admin-kpis">
        <Card>
          <div className="mp-admin-kpi-label">{rangeLabel(range)} UV</div>
          <div className="mp-admin-kpi-value">{uvValue.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">{rangeLabel(range)} PV</div>
          <div className="mp-admin-kpi-value">{pvValue.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">{rangeLabel(range)} 申请数</div>
          <div className="mp-admin-kpi-value">{appCount.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">申请通过率</div>
          <div className="mp-admin-kpi-value">
            {appSummary ? formatPercent(appSummary.approvedRate) : '—'}
          </div>
        </Card>
      </div>

      <div className="mp-admin-section">
        <Card title="总览" headerExtraContent={<Tag color="grey" type="light">{rangeLabel(range)}</Tag>}>
          {summaryError ? (
            <EmptyState
              illustration="failure"
              title="总览数据加载失败"
              desc={summaryError}
              actions={<Button onClick={() => void loadSummary(range)}>重试</Button>}
            />
          ) : summaryLoading && !uvPvSummary ? (
            <Skeleton placeholder={<Skeleton.Paragraph rows={4} />} loading />
          ) : !uvPvSummary && !appSummary ? (
            <EmptyState illustration="no-content" title="暂无总览数据" />
          ) : (
            <div className="mp-admin-kpis">
              <div>
                <div className="mp-admin-kpi-label">{rangeLabel(range)} UV</div>
                <div className="mp-admin-kpi-value">{uvValue.toLocaleString()}</div>
                <span className="mp-admin-faint">
                  7 日 {uvPvSummary?.uv.last7d.toLocaleString() ?? '—'} · 30 日{' '}
                  {uvPvSummary?.uv.last30d.toLocaleString() ?? '—'}
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">{rangeLabel(range)} PV</div>
                <div className="mp-admin-kpi-value">{pvValue.toLocaleString()}</div>
                <span className="mp-admin-faint">
                  7 日 {uvPvSummary?.pv.last7d.toLocaleString() ?? '—'} · 30 日{' '}
                  {uvPvSummary?.pv.last30d.toLocaleString() ?? '—'}
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">{rangeLabel(range)} 申请数</div>
                <div className="mp-admin-kpi-value">{appCount.toLocaleString()}</div>
                <span className="mp-admin-faint">
                  7 日 {appSummary?.applicationsLast7d.toLocaleString() ?? '—'} · 30 日{' '}
                  {appSummary?.applicationsLast30d.toLocaleString() ?? '—'}
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">申请通过率</div>
                <div className="mp-admin-kpi-value">
                  {appSummary ? formatPercent(appSummary.approvedRate) : '—'}
                </div>
                <span className="mp-admin-faint">
                  较上期{' '}
                  {appSummary
                    ? `${appSummary.approvedRateDelta >= 0 ? '+' : ''}${(
                        appSummary.approvedRateDelta * 100
                      ).toFixed(1)} pp`
                    : '—'}
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">7 日 UV</div>
                <div className="mp-admin-kpi-value">
                  {uvPvSummary?.uv.last7d.toLocaleString() ?? '—'}
                </div>
                <span className="mp-admin-faint">人均 {uvPvSummary?.pvPerUv.last7d ?? '—'} 次访问</span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">7 日 PV</div>
                <div className="mp-admin-kpi-value">
                  {uvPvSummary?.pv.last7d.toLocaleString() ?? '—'}
                </div>
                <span className="mp-admin-faint">
                  日均 {uvPvSummary ? Math.round(uvPvSummary.pv.last7d / 7).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">7 日申请数</div>
                <div className="mp-admin-kpi-value">
                  {appSummary?.applicationsLast7d.toLocaleString() ?? '—'}
                </div>
                <span className="mp-admin-faint">
                  日均 {appSummary ? Math.round(appSummary.applicationsLast7d / 7) : '—'} 条
                </span>
              </div>
              <div>
                <div className="mp-admin-kpi-label">平均审批耗时</div>
                <div className="mp-admin-kpi-value">
                  {appSummary ? `${appSummary.approvalDurationHours.toFixed(1)} h` : '—'}
                </div>
                <span className="mp-admin-faint">来自申请汇总接口</span>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="30 天趋势"
          headerExtraContent={<Tag color="grey" type="light">每日 UV / PV / 申请数</Tag>}
        >
          {trendError ? (
            <EmptyState
              illustration="failure"
              title="趋势数据加载失败"
              desc={trendError}
              actions={<Button onClick={() => void loadTrend()}>重试</Button>}
            />
          ) : trendLoading && trend.length === 0 ? (
            <Skeleton placeholder={<Skeleton.Paragraph rows={6} />} loading />
          ) : trend.length === 0 ? (
            <EmptyState illustration="no-content" title="暂无趋势数据" />
          ) : (
            <UvPvTrendChart data={trend} height={300} />
          )}
        </Card>

        <Card title="申请漏斗" headerExtraContent={<Tag color="grey" type="light">访问 → 提交</Tag>}>
          {funnelError ? (
            <EmptyState
              illustration="failure"
              title="漏斗数据加载失败"
              desc={funnelError}
              actions={<Button onClick={() => void loadFunnel(range)}>重试</Button>}
            />
          ) : funnelLoading && funnel.length === 0 ? (
            <Skeleton placeholder={<Skeleton.Paragraph rows={4} />} loading />
          ) : funnel.length === 0 ? (
            <EmptyState illustration="no-content" title="暂无漏斗数据" />
          ) : (
            <FunnelCard data={funnel} loading={funnelLoading} />
          )}
        </Card>

        <Card title="访问质量" headerExtraContent={<Tag color="grey" type="light">{rangeLabel(range)}</Tag>}>
          <div className="mp-admin-kpis">
            <div>
              <div className="mp-admin-kpi-label">PV / UV</div>
              <div className="mp-admin-kpi-value">{pvPerUv}</div>
            </div>
            <div>
              <div className="mp-admin-kpi-label">申请 / UV</div>
              <div className="mp-admin-kpi-value">{`${appPerUv.toFixed(2)}%`}</div>
            </div>
            <div>
              <div className="mp-admin-kpi-label">日均 UV</div>
              <div className="mp-admin-kpi-value">
                {uvPvSummary ? Math.round(uvPvSummary.uv.last7d / 7).toLocaleString() : '—'}
              </div>
            </div>
            <div>
              <div className="mp-admin-kpi-label">日均申请</div>
              <div className="mp-admin-kpi-value">
                {appSummary ? Math.round(appSummary.applicationsLast7d / 7) : '—'}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="来源 / 地域 / 设备分布"
          headerExtraContent={
            <Tag color="grey" type="light">基于 {rangeLabel(range)} 期间 UV 拆分</Tag>
          }
        >
          {distributionError ? (
            <EmptyState
              illustration="failure"
              title="分布数据加载失败"
              desc={distributionError}
              actions={<Button onClick={() => void loadDistribution(range)}>重试</Button>}
            />
          ) : distributionLoading && !distribution ? (
            <Skeleton placeholder={<Skeleton.Paragraph rows={4} />} loading />
          ) : !distribution ? (
            <EmptyState illustration="no-content" title="暂无分布数据" />
          ) : (
            <div className="mp-admin-section">
              <DistributionCard
                title="来源 Top 5"
                data={distribution.source}
                topN={5}
                loading={distributionLoading}
                height={220}
              />
              <DistributionCard
                title="地域 Top 5"
                data={distribution.region}
                topN={5}
                loading={distributionLoading}
                height={220}
              />
              <DistributionCard
                title="设备占比"
                data={distribution.device}
                topN={5}
                loading={distributionLoading}
                height={220}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
