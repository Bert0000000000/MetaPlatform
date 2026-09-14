import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Tag, Toast } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import {
  getOpsCapacity,
  getOpsHealth,
  getOpsSelfMetrics,
  listAlertRules,
  queryPrometheus,
} from '@/api/admin';
import type { OpsAlertRule, OpsCapacityResponse, OpsHealthReport, OpsSelfMetrics } from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';
import './admin.css';

/** Prometheus 即时查询返回体（后端透传原始 PromQL 响应）。 */
interface PromResult {
  query: string;
  status: string;
  result_type?: string;
  value?: unknown;
  error?: string;
}

function formatNumber(v: number | undefined, digits = 2): string {
  if (v === undefined || v === null) return '—';
  if (Math.abs(v) >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(digits)} MB`;
  if (Math.abs(v) >= 1024) return `${(v / 1024).toFixed(digits)} KB`;
  return v.toFixed(digits);
}

/**
 * 平台管理 · 运营监控（DESIGN-SPEC §5 版式 E：页头 + KPI 行 + 表格 + 区块）。
 * 数据面沿用 src/api/admin/operations.ts，30s 轮询；PromQL 结果为原始 JSON，走 mp-admin-pre。
 */
export default function OperationsPage() {
  const [health, setHealth] = useState<OpsHealthReport | null>(null);
  const [metrics, setMetrics] = useState<OpsSelfMetrics | null>(null);
  const [rules, setRules] = useState<OpsAlertRule[]>([]);
  const [capacity, setCapacity] = useState<OpsCapacityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promQuery, setPromQuery] = useState('up');
  const [promResult, setPromResult] = useState<PromResult | null>(null);
  const [promLoading, setPromLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [h, m, r, c] = await Promise.allSettled([
        getOpsHealth(),
        getOpsSelfMetrics(),
        listAlertRules(),
        getOpsCapacity(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value ?? null);
      else setError(h.reason instanceof Error ? h.reason.message : String(h.reason));
      if (m.status === 'fulfilled') setMetrics(m.value ?? null);
      if (r.status === 'fulfilled') setRules(r.value ?? []);
      if (c.status === 'fulfilled') setCapacity(c.value ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const runQuery = async () => {
    setPromLoading(true);
    try {
      const r = await queryPrometheus(promQuery);
      setPromResult(r as PromResult);
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPromLoading(false);
    }
  };

  const healthColumns = useMemo(
    () => [
      {
        title: '组件',
        dataIndex: 'name',
        width: 220,
        render: (v: string) => <span className="mp-admin-mono">{v}</span>,
      },
      {
        title: '状态',
        dataIndex: 'healthy',
        render: (v: boolean, row: OpsHealthReport['components'][number]) => (
          <span className="mp-admin-cell">
            <Tag color={v ? 'green' : 'red'} type="light">
              {v ? '健康' : '异常'}
            </Tag>
            <span className="mp-admin-faint">{row.detail}</span>
          </span>
        ),
      },
      {
        title: '延迟',
        dataIndex: 'latencyMs',
        width: 120,
        render: (v?: number) => (
          <span className="mp-admin-mono">{v != null ? `${v.toFixed(1)} ms` : '—'}</span>
        ),
      },
    ],
    [],
  );

  const ruleColumns = useMemo(
    () => [
      {
        title: '规则',
        dataIndex: 'alert',
        width: 220,
        render: (v: string) => <span className="mp-admin-mono">{v}</span>,
      },
      {
        title: '严重度',
        dataIndex: 'severity',
        width: 110,
        render: (v: string) => (
          <Tag color={v === 'critical' ? 'red' : 'orange'} type="light">
            {v}
          </Tag>
        ),
      },
      { title: '持续时间', dataIndex: 'for', width: 120 },
      { title: '摘要', dataIndex: 'summary' },
      {
        title: '说明',
        dataIndex: 'description',
        render: (v: string) => <span className="mp-admin-muted">{v}</span>,
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="运营监控"
        desc="组件健康 · 告警规则 · Prometheus 即时查询，每 30 秒自动刷新"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="监控数据加载失败"
          desc={error}
          actions={<Button onClick={() => void load()}>重试</Button>}
        />
      ) : (
        <>
          <div className="mp-admin-kpis">
            <Card>
              <div className="mp-admin-kpi-label">健康服务</div>
              <div className="mp-admin-kpi-value">
                {health ? `${health.summary.healthy} / ${health.summary.total}` : '—'}
              </div>
            </Card>
            <Card>
              <div className="mp-admin-kpi-label">告警规则</div>
              <div className="mp-admin-kpi-value">{rules.length}</div>
            </Card>
            <Card>
              <div className="mp-admin-kpi-label">常驻内存</div>
              <div className="mp-admin-kpi-value">
                {metrics?.processResidentMemoryBytes !== undefined
                  ? formatNumber(metrics.processResidentMemoryBytes, 1)
                  : '—'}
              </div>
            </Card>
            <Card>
              <div className="mp-admin-kpi-label">Prometheus</div>
              <div className="mp-admin-kpi-value">
                {capacity?.prometheus?.configured ? '运行中' : '待配置'}
              </div>
            </Card>
          </div>

          <div className="mp-admin-section">
            <Card title="组件健康">
              <DataTablePro<OpsHealthReport['components'][number]>
                columns={healthColumns}
                dataSource={health?.components ?? []}
                rowKey="name"
                loading={loading}
                empty={
                  <EmptyState
                    illustration="no-result"
                    title="暂无组件健康数据"
                    desc={health ? '当前没有可上报的组件。' : '监控服务尚未返回数据。'}
                  />
                }
              />
            </Card>

            <Card title="mate-tech-obs 自监控指标">
              <div className="mp-admin-kpis">
                <div>
                  <div className="mp-admin-kpi-label">CPU 时间</div>
                  <div className="mp-admin-kpi-value">{formatNumber(metrics?.processCpuSecondsTotal, 3)}</div>
                </div>
                <div>
                  <div className="mp-admin-kpi-label">常驻内存</div>
                  <div className="mp-admin-kpi-value">{formatNumber(metrics?.processResidentMemoryBytes, 1)}</div>
                </div>
                <div>
                  <div className="mp-admin-kpi-label">GC 对象回收</div>
                  <div className="mp-admin-kpi-value">{metrics?.pythonGcObjectsCollectedTotal ?? '—'}</div>
                </div>
                <div>
                  <div className="mp-admin-kpi-label">HTTP 请求累计</div>
                  <div className="mp-admin-kpi-value">{metrics?.httpRequestsTotal ?? '—'}</div>
                </div>
              </div>
            </Card>

            <Card title="告警规则">
              <DataTablePro<OpsAlertRule>
                columns={ruleColumns}
                dataSource={rules}
                rowKey="alert"
                loading={loading}
                empty={
                  <EmptyState
                    illustration="no-result"
                    title="暂无告警规则"
                    desc="Prometheus 中未发现可用的告警规则。"
                  />
                }
              />
            </Card>

            <Card title="Prometheus 即时查询">
              <FilterBar
                search={{
                  value: promQuery,
                  onChange: setPromQuery,
                  placeholder: 'PromQL 表达式，如 up',
                }}
                right={
                  <Button
                    theme="solid"
                    type="primary"
                    loading={promLoading}
                    onClick={() => void runQuery()}
                  >
                    查询
                  </Button>
                }
              />
              {promResult && promResult.status === 'unavailable' ? (
                <p className="mp-admin-muted">
                  {promResult.error ?? 'Prometheus 未配置，无法执行即时查询。'}
                </p>
              ) : null}
              {promResult ? (
                <pre className="mp-admin-pre">{JSON.stringify(promResult, null, 2)}</pre>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
