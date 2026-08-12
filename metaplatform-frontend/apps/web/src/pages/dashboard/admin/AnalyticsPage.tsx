/**
 * UV / PV / 申请 数据看板
 * 路径：/admin/analytics
 *
 * 数据来源：apps/web/src/api/admin/analytics.ts（当前为 mock，后端就绪后切真实接口）
 * 4 个 SectionCard：
 *   1) 总览卡片：8 张 (2x4)，今日 / 7 日 / 30 日 UV · PV · 申请数 · 申请通过率
 *   2) 30 天趋势折线图：UV / PV / 申请数 三条线
 *   3) 申请漏斗：访问 -> Demo 点击 -> 表单填写 -> 申请提交
 *   4) 来源 / 地域 / 设备 三张分布图
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Radio, Space, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import { Row, Col } from '@douyinfe/semi-ui/lib/es/grid';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { PageContainer, SectionCard, EmptyState, ErrorState } from '@mate/shared';
import {
  getAnalyticsDistribution,
  getApplicationFunnel,
  getApplicationSummary,
  getUvPvSummary,
  getUvPvTrend,
} from '@/api/admin/analytics';
import type {
  AnalyticsRange,
  ApplicationSummary,
  DistributionResponse,
  FunnelStep,
  UvPvSummary,
  UvPvTrendPoint,
} from '@/types/analytics';
import { AdminLayout, StatCard, StatGrid } from './__AdminLayout';
import UvPvTrendChart from './components/UvPvTrendChart';
import FunnelCard from './components/FunnelCard';
import DistributionCard from './components/DistributionCard';

const { Text } = Typography;

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

function pickSummary(summary: UvPvSummary, r: AnalyticsRange) {
  return {
    uv: summary.uv[r === 'today' ? 'today' : r === '7d' ? 'last7d' : 'last30d'],
    pv: summary.pv[r === 'today' ? 'today' : r === '7d' ? 'last7d' : 'last30d'],
    pvPerUv:
      summary.pvPerUv[r === 'today' ? 'today' : r === '7d' ? 'last7d' : 'last30d'],
  };
}

function pickApplications(summary: ApplicationSummary, r: AnalyticsRange) {
  if (r === 'today') return summary.applicationsToday;
  if (r === '7d') return summary.applicationsLast7d;
  return summary.applicationsLast30d;
}

// 骨架屏（Skeleton 无 Semi 等价物，自建 shimmer 块）
function Shimmer({ rows, height = '14px' }: { rows: number; height?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
            backgroundSize: '200% 100%',
            animation: 'workbench-shimmer 1.4s ease-in-out infinite',
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  );
}

// 指标卡片（Statistic 无 Semi 等价物，自建 label + 大数字）
function Stat({
  title,
  value,
  suffix,
  prefix,
  precision,
  valueStyle,
}: {
  title: string;
  value: number | string;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  precision?: number;
  valueStyle?: React.CSSProperties;
}) {
  const shown = typeof value === 'number' && precision !== undefined ? value.toFixed(precision) : typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8, ...valueStyle }}>
        {prefix}
        {shown}
        {suffix}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d');

  // summary
  const [uvPvSummary, setUvPvSummary] = useState<UvPvSummary | null>(null);
  const [appSummary, setAppSummary] = useState<ApplicationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<Error | null>(null);

  // trend
  const [trend, setTrend] = useState<UvPvTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<Error | null>(null);

  // funnel
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelError, setFunnelError] = useState<Error | null>(null);

  // distribution
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionError, setDistributionError] = useState<Error | null>(null);

  const loadSummary = useCallback(async (r: AnalyticsRange) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const [uv, app] = await Promise.allSettled([
        getUvPvSummary(r),
        getApplicationSummary(r),
      ]);
      if (uv.status === 'fulfilled') setUvPvSummary(uv.value);
      else setSummaryError(uv.reason instanceof Error ? uv.reason : new Error(String(uv.reason)));
      if (app.status === 'fulfilled') setAppSummary(app.value);
      else setSummaryError(app.reason instanceof Error ? app.reason : new Error(String(app.reason)));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await getUvPvTrend();
      setTrend(Array.isArray(data) ? data : []);
    } catch (e) {
      setTrendError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const loadFunnel = useCallback(async (r: AnalyticsRange) => {
    setFunnelLoading(true);
    setFunnelError(null);
    try {
      const data = await getApplicationFunnel(r);
      setFunnel(Array.isArray(data) ? data : []);
    } catch (e) {
      setFunnelError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setFunnelLoading(false);
    }
  }, []);

  const loadDistribution = useCallback(async (r: AnalyticsRange) => {
    setDistributionLoading(true);
    setDistributionError(null);
    try {
      const data = await getAnalyticsDistribution(r);
      setDistribution(data);
    } catch (e) {
      setDistributionError(e instanceof Error ? e : new Error(String(e)));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  const summaryView = uvPvSummary ? pickSummary(uvPvSummary, range) : null;
  const appCount = appSummary ? pickApplications(appSummary, range) : 0;

  const headerExtra = (
    <Space spacing="tight">
      <Radio.Group
        type="button"
        options={RANGE_OPTIONS}
        value={range}
        onChange={(e) => setRange(e.target.value as AnalyticsRange)}
      />
      <Button icon={<ReloadOutlined />} onClick={reloadAll} loading={summaryLoading || trendLoading || funnelLoading || distributionLoading}>
        刷新
      </Button>
    </Space>
  );

  // ---- 总览 8 张卡片 ----
  const overviewGrid = (
    <Row gutter={[16, 16]}>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title={`今日 UV`} value={summaryView?.uv ?? 0} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            7 日 {uvPvSummary?.uv.last7d.toLocaleString() ?? '-'} · 30 日 {uvPvSummary?.uv.last30d.toLocaleString() ?? '-'}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title={`今日 PV`} value={summaryView?.pv ?? 0} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            7 日 {uvPvSummary?.pv.last7d.toLocaleString() ?? '-'} · 30 日 {uvPvSummary?.pv.last30d.toLocaleString() ?? '-'}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title={`今日申请数`} value={appCount} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            7 日 {appSummary?.applicationsLast7d.toLocaleString() ?? '-'} · 30 日 {appSummary?.applicationsLast30d.toLocaleString() ?? '-'}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat
            title="申请通过率"
            value={appSummary ? +(appSummary.approvedRate * 100).toFixed(1) : 0}
            suffix="%"
            valueStyle={{ color: 'var(--success)' }}
          />
          <Text
            style={{
              fontSize: 12,
              color:
                (appSummary?.approvedRateDelta ?? 0) >= 0 ? 'var(--success)' : 'var(--destructive)',
            }}
          >
            {(appSummary?.approvedRateDelta ?? 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{' '}
            较上期 {((appSummary?.approvedRateDelta ?? 0) * 100).toFixed(1)} pp
          </Text>
        </Card>
      </Col>

      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title="7 日 UV" value={uvPvSummary?.uv.last7d ?? 0} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较 7 日前 {uvPvSummary ? Math.round(uvPvSummary.uv.last7d * 0.06) : 0}（参考）
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title="7 日 PV" value={uvPvSummary?.pv.last7d ?? 0} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            人均 {summaryView?.pvPerUv ?? 0} 次访问
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat title="7 日申请数" value={appSummary?.applicationsLast7d ?? 0} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            日均 {appSummary ? Math.round(appSummary.applicationsLast7d / 7) : 0} 条
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6} lg={6} xl={6}>
        <Card style={{ height: '100%' }}>
          <Stat
            title="平均审批耗时"
            value={appSummary?.approvalDurationHours ?? 0}
            suffix="h"
            precision={1}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较上周期{' '}
            <span style={{ color: 'var(--muted-foreground)' }}>数据采集中</span>
          </Text>
        </Card>
      </Col>
    </Row>
  );

  const renderSummaryBody = () => {
    if (summaryError) {
      return <ErrorState description="总览数据加载失败" onRetry={() => void loadSummary(range)} />;
    }
    if (summaryLoading && !uvPvSummary && !appSummary) {
      return <Shimmer rows={4} />;
    }
    if (!uvPvSummary && !appSummary) {
      return <EmptyState description="暂无总览数据" />;
    }
    return overviewGrid;
  };

  const renderTrendBody = () => {
    if (trendError) {
      return <ErrorState description="趋势数据加载失败" onRetry={() => void loadTrend()} />;
    }
    if (trendLoading && trend.length === 0) {
      return <Shimmer rows={6} />;
    }
    if (trend.length === 0) {
      return <EmptyState description="暂无趋势数据" />;
    }
    return <UvPvTrendChart data={trend} height={300} />;
  };

  const renderFunnelBody = () => {
    if (funnelError) {
      return <ErrorState description="漏斗数据加载失败" onRetry={() => void loadFunnel(range)} />;
    }
    if (funnelLoading && funnel.length === 0) {
      return <Shimmer rows={4} />;
    }
    if (funnel.length === 0) {
      return <EmptyState description="暂无漏斗数据" />;
    }
    return <FunnelCard data={funnel} loading={funnelLoading} />;
  };

  const renderDistributionBody = () => {
    if (distributionError) {
      return (
        <ErrorState
          description="分布数据加载失败"
          onRetry={() => void loadDistribution(range)}
        />
      );
    }
    if (distributionLoading && !distribution) {
      return <Shimmer rows={4} />;
    }
    if (!distribution) {
      return <EmptyState description="暂无分布数据" />;
    }
    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}>
          <DistributionCard
            title="来源 Top 5"
            data={distribution.source}
            topN={5}
            loading={distributionLoading}
            height={220}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <DistributionCard
            title="地域 Top 5"
            data={distribution.region}
            topN={5}
            loading={distributionLoading}
            height={220}
          />
        </Col>
        <Col xs={24} md={12} lg={8}>
          <DistributionCard
            title="设备占比"
            data={distribution.device}
            topN={5}
            loading={distributionLoading}
            height={220}
          />
        </Col>
      </Row>
    );
  };

  return (
    <AdminLayout title="UV/PV/申请看板" extra={headerExtra}>
      <StatGrid>
        <StatCard label={`${rangeLabel(range)} UV`} value={summaryView?.uv ?? 0} />
        <StatCard label={`${rangeLabel(range)} PV`} value={summaryView?.pv ?? 0} />
        <StatCard label={`${rangeLabel(range)} 申请数`} value={appCount} color="warning" />
        <StatCard
          label="申请通过率"
          value={appSummary ? `${(appSummary.approvedRate * 100).toFixed(1)}%` : "0%"}
          color="success"
        />
      </StatGrid>
      <PageContainer
        title="数据分析"
        description={
          <Space spacing={8}>
            <Tooltip content="时间范围影响总览卡片、漏斗和分布数据；趋势图始终展示最近 30 天">
              <Tag color="blue">{rangeLabel(range)}</Tag>
            </Tooltip>
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
              实时反映官网 / 落地页 / 申请入口的访问与转化情况
            </span>
          </Space>
        }
      >
        <Space vertical spacing="loose" style={{ width: '100%' }}>
          <SectionCard title="总览" extra={<Tag color="grey">{rangeLabel(range)}</Tag>}>
            {renderSummaryBody()}
          </SectionCard>

          <SectionCard
            title="30 天趋势"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                每日 UV / PV / 申请数
              </Text>
            }
          >
            {renderTrendBody()}
          </SectionCard>

          <Row gutter={16}>
            <Col xs={24} lg={14}>
              <SectionCard
                title="申请漏斗"
                extra={<Tag color="grey">访问 → 提交</Tag>}
                style={{ height: '100%' }}
              >
                {renderFunnelBody()}
              </SectionCard>
            </Col>
            <Col xs={24} lg={10}>
              <SectionCard
                title="访问质量"
                extra={<Tag color="grey">{rangeLabel(range)}</Tag>}
                style={{ height: '100%' }}
              >
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Stat
                      title="PV / UV"
                      value={summaryView?.pvPerUv ?? 0}
                      precision={2}
                    />
                  </Col>
                  <Col span={12}>
                    <Stat title="申请 / UV" value={appSummary ? +((appCount / Math.max(1, summaryView?.uv ?? 0)) * 100).toFixed(2) : 0} suffix="%" />
                  </Col>
                  <Col span={12}>
                    <Stat title="日均 UV" value={uvPvSummary ? Math.round(uvPvSummary.uv.last7d / 7) : 0} />
                  </Col>
                  <Col span={12}>
                    <Stat
                      title="日均申请"
                      value={appSummary ? Math.round(appSummary.applicationsLast7d / 7) : 0}
                    />
                  </Col>
                </Row>
              </SectionCard>
            </Col>
          </Row>

          <SectionCard
            title="来源 / 地域 / 设备分布"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                基于 {rangeLabel(range)} 期间 UV 拆分
              </Text>
            }
          >
            {renderDistributionBody()}
          </SectionCard>
        </Space>
      </PageContainer>
    </AdminLayout>
  );
}
