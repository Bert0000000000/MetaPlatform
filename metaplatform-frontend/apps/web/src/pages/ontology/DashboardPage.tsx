// DashboardPage - 本体仪表盘（L6 应用层，Palantir Carbon 对位）。
//
// 多卡片组装工作台：
//   1. 我的分析卡片：读取 localStorage（ont-analysis-pins），每个 Pin 重新调
//      object-query 聚合渲染实时迷你图表（只存查询配置不存结果 → 数据始终最新）；
//      卡片操作：× 移除 / 刷新
//   2. 系统卡片（自动展示，不来自 Pin）：
//      - 类型统计卡：listObjectTypes → 并发 listIndividuals({classRid}) 取 length
//      - 最近 Action 卡：GET /ont/v2/action-audit?limit=10 时间线
//      - 健康度卡：GET /ont/v2/datasources/sync-status + GET /ont/v2/lint/anti-patterns
//        → 绿 / 黄 / 红指示灯
//   3. 空态引导：先去分析工作台创建图表，然后 Pin 过来
//
// 纪律：原生 button + 内联样式 + CSS 变量；Semi Card 仅容器（只读可用）。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@douyinfe/semi-ui';
import {
  BarChart3, History, LayoutDashboard, Loader2, MapPin, Pin, RefreshCw, ShieldCheck, X,
} from 'lucide-react';
import {
  errDetailText, getDatasourceSyncStatus, getObjectQueryAggregation,
  lintAntiPatterns, listActionAudit, listIndividuals, listObjectTypes,
  type ActionAuditRow, type KernelObjectType, type LintFinding, type SyncStatusRow,
} from '@/api/ont/kernel';
import ChartSvg, { type ChartDatum, type ChartType } from './components/ChartSvg';
import { readAnalysisPins, removeAnalysisPin, type AnalysisPin } from './components/analysisPins';
import './ontology.css';

/** rid 尾段（版本号前一段）作短名。 */
function shortRid(rid: string): string {
  const parts = rid.split('.');
  return parts.length >= 2 ? parts[parts.length - 2]! : rid;
}

// ── Pin 实时卡片 ──

function PinCard({
  pin, typeNames, reloadKey, onRemove,
}: {
  pin: AnalysisPin;
  typeNames: Record<string, string>;
  reloadKey: number;
  onRemove: (id: string) => void;
}) {
  const [data, setData] = useState<ChartDatum[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      // 与 AnalysisPage 相同口径：field 为空串 = count *
      const field = pin.config.metric || null;
      const res = await getObjectQueryAggregation({
        source: pin.config.source,
        group_by: [pin.config.dimension],
        metrics: [{ fn: pin.config.fn, field }],
        paging_limit: 100,
      });
      const metricKey = field ? `${pin.config.fn}_${field}` : pin.config.fn;
      const raw = res.kind === 'aggregates' ? res.rows : [];
      let chart: ChartDatum[] = raw.map((r) => ({
        label: r[pin.config.dimension] === null || r[pin.config.dimension] === undefined
          || r[pin.config.dimension] === '' ? '（空）' : String(r[pin.config.dimension]),
        value: Number(r[metricKey] ?? 0) || 0,
      }));
      chart = pin.config.chartType === 'line'
        ? chart.sort((a, b) => a.label.localeCompare(b.label))
        : chart.sort((a, b) => b.value - a.value);
      setData(chart);
    } catch (e) {
      setData(null);
      setErr(errDetailText(e, '聚合查询失败'));
    } finally {
      setBusy(false);
    }
  }, [pin]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  return (
    <Card bodyStyle={{ padding: 0 }} className="mp-w-full mp-hidden mp-flex-1">
      <div className="mp-onto-card-head">
        <Pin className="mp-text-primary mp-shrink-0 mp-icon-12"  />
        <div className="mp-flex-1">
          <div className="mp-hidden mp-fw-600 mp-text-body mp-nowrap mp-ellipsis-text"  title={pin.title}>
            {pin.title}
          </div>
          <div className="mp-hidden mp-text-2 mp-nowrap mp-text-xs mp-mono mp-ellipsis-text" >
            {typeNames[pin.config.source] ?? shortRid(pin.config.source)} · {pin.config.dimension}
          </div>
        </div>
        <button type="button" title="刷新" onClick={() => void load()} className="mp-onto-icon-btn">
          <RefreshCw className="mp-icon-12" />
        </button>
        <button type="button" title="移除" onClick={() => onRemove(pin.id)} className="mp-onto-icon-btn">
          <X className="mp-icon-12" />
        </button>
      </div>
      <div className="mp-py-2 mp-px-3">
        {busy ? (
          <div className="mp-gap-2 mp-text-sm mp-text-2 mp-flex-center mp-justify-center mp-onto-card-fill">
            <Loader2 className="mp-icon-12 mp-spin" /> 加载中…
          </div>
        ) : err ? (
          <div className="mp-gap-2 mp-flex-center mp-justify-center mp-flex-col mp-onto-card-fill">
            <div className="mp-text-center mp-text-sm mp-text-danger mp-break-all mp-px-3">{err}</div>
            <button type="button" onClick={() => void load()} className="mp-text-xs mp-onto-icon-btn mp-onto-icon-btn--wide">重试</button>
          </div>
        ) : (
          <ChartSvg
            type={pin.config.chartType as ChartType}
            data={data ?? []}
            baseWidth={320} height={190} mini
          />
        )}
      </div>
    </Card>
  );
}

// ── 系统卡 1：类型统计 ──

function TypeStatsCard({ types, reloadKey }: { types: KernelObjectType[]; reloadKey: number }) {
  const [counts, setCounts] = useState<Array<{ label: string; value: number }> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (types.length === 0) { setCounts([]); return; }
    let cancelled = false;
    setErr('');
    // 并发拉各类型实例数（listIndividuals({classRid}) 取 length）
    Promise.all(types.map(async (t) => {
      try {
        const items = await listIndividuals({ classRid: t.rid });
        return { label: t.display_name || t.rid, value: items.length };
      } catch {
        return { label: t.display_name || t.rid, value: 0 };
      }
    }))
      .then((rows) => {
        if (!cancelled) setCounts(rows.sort((a, b) => b.value - a.value));
      })
      .catch((e) => {
        if (!cancelled) { setCounts([]); setErr(errDetailText(e, '实例统计失败')); }
      });
    return () => { cancelled = true; };
  }, [types, reloadKey]);

  const total = useMemo(
    () => (counts ?? []).reduce((s, r) => s + r.value, 0), [counts],
  );

  return (
    <Card bodyStyle={{ padding: 0 }} className="mp-hidden">
      <div className="mp-onto-card-head">
        <BarChart3 className="mp-icon-14" />
        <h4 className="mp-fw-600 mp-flex-1 mp-m-0 mp-text-body">类型统计</h4>
        <span className="mp-text-xs mp-text-2">
          {types.length} 类型 · {total} 实例
        </span>
      </div>
      <div className="mp-py-2 mp-px-3">
        {counts === null ? (
          <div className="mp-gap-2 mp-text-sm mp-text-2 mp-flex-center mp-justify-center mp-onto-card-fill">
            <Loader2 className="mp-icon-12 mp-spin" /> 统计中…
          </div>
        ) : err ? (
          <div className="mp-text-sm mp-text-danger mp-flex-center mp-justify-center mp-onto-card-fill">{err}</div>
        ) : (
          <ChartSvg type="bar" data={counts.slice(0, 12)} baseWidth={320} height={190} mini />
        )}
      </div>
    </Card>
  );
}

// ── 系统卡 2：最近 Action ──

function RecentActionsCard({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<ActionAuditRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setErr('');
    listActionAudit(10)
      .then((items) => { if (!cancelled) setRows(items); })
      .catch((e) => {
        if (!cancelled) { setRows([]); setErr(errDetailText(e, '执行历史加载失败')); }
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  return (
    <Card bodyStyle={{ padding: 0 }} className="mp-hidden">
      <div className="mp-onto-card-head">
        <History className="mp-icon-14" />
        <h4 className="mp-fw-600 mp-flex-1 mp-m-0 mp-text-body">最近 Action</h4>
        <span className="mp-text-xs mp-text-2">近 10 条</span>
      </div>
      <div className="mp-overflow-y-auto mp-pt-2 mp-px-4 mp-pb-3 mp-onto-list-panel">
        {rows === null ? (
          <div className="mp-gap-2 mp-text-sm mp-text-2 mp-flex-center mp-justify-center mp-onto-card-fill">
            <Loader2 className="mp-icon-12 mp-spin" /> 加载中…
          </div>
        ) : err ? (
          <div className="mp-text-sm mp-text-danger mp-flex-center mp-justify-center mp-onto-card-fill">{err}</div>
        ) : rows.length === 0 ? (
          <div className="mp-text-sm mp-text-2 mp-flex-center mp-justify-center mp-onto-card-fill">暂无执行记录</div>
        ) : (
          <div className="mp-flex mp-flex-col" >
            {rows.map((r, i) => (
              <div key={r.audit_id} className="mp-flex mp-gap-2" >
                {/* 时间线：竖线 + 圆点 */}
                <div className="mp-flex-center mp-shrink-0 mp-flex-col mp-onto-timeline-rail">
                  <span className="mp-mt-1 mp-icon-12 mp-onto-timeline-dot" />
                  {i < rows.length - 1 && <span className="mp-flex-1 mp-onto-timeline-line" />}
                </div>
                <div className="mp-flex-1 mp-pt-1 mp-pb-2">
                  <div className="mp-flex mp-gap-2 mp-onto-baseline">
                    <span className="mp-hidden mp-fw-600 mp-text-sm mp-nowrap mp-mono mp-ellipsis-text"  title={r.action_rid}>
                      {shortRid(r.action_rid)}
                    </span>
                    <span className="mp-text-xs mp-text-2 mp-shrink-0 mp-ml-auto" >
                      {r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div className="mp-text-xs mp-text-2">
                    {`执行者 ${r.actor_id || '—'} · 编辑 ${String((r.result as Record<string, unknown> | null)?.applied_count ?? '—')} 条`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── 系统卡 3：健康度（绿 / 黄 / 红指示灯） ──

type LightLevel = 'green' | 'yellow' | 'red';

const LIGHT_DOT_CLASS: Record<LightLevel, string> = {
  green: 'mp-onto-dot-success',
  yellow: 'mp-onto-dot-warning',
  red: 'mp-onto-dot-danger',
};
const LIGHT_TEXT_CLASS: Record<LightLevel, string> = {
  green: 'mp-text-success',
  yellow: 'mp-text-warning',
  red: 'mp-text-danger',
};
const LIGHT_LABEL: Record<LightLevel, string> = { green: '健康', yellow: '关注', red: '异常' };

function LightDot({ level }: { level: LightLevel }) {
  return (
    <span className={`mp-shrink-0 mp-icon-12 mp-onto-light-dot ${LIGHT_DOT_CLASS[level]}`} />
  );
}

function HealthCard({ reloadKey }: { reloadKey: number }) {
  const [sync, setSync] = useState<SyncStatusRow[] | null>(null);
  const [lint, setLint] = useState<LintFinding[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setErr('');
    Promise.all([
      getDatasourceSyncStatus().catch(() => [] as SyncStatusRow[]),
      lintAntiPatterns().catch(() => [] as LintFinding[]),
    ])
      .then(([s, l]) => {
        if (cancelled) return;
        setSync(s);
        setLint(l);
      })
      .catch((e) => {
        if (!cancelled) {
          setSync([]);
          setLint([]);
          setErr(errDetailText(e, '健康数据加载失败'));
        }
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const syncBad = useMemo(
    () => (sync ?? []).filter((r) => (r.consecutive_failures ?? 0) > 0 || (r.last_error ?? '') !== ''),
    [sync],
  );
  const syncLevel: LightLevel = syncBad.length > 0 ? 'red' : 'green';
  const lintLevel: LightLevel = (lint ?? []).length > 0 ? 'yellow' : 'green';
  const overall: LightLevel = syncLevel === 'red' ? 'red' : lintLevel;

  const lightRow = (level: LightLevel, label: string, detail: string, key: string) => (
    <div key={key} className="mp-gap-2 mp-text-sm mp-flex-center">
      <LightDot level={level} />
      <span className="mp-fw-600">{label}</span>
      <span className="mp-text-2 mp-ml-auto mp-text-right" >{detail}</span>
    </div>
  );

  return (
    <Card bodyStyle={{ padding: 0 }} className="mp-hidden">
      <div className="mp-onto-card-head">
        <ShieldCheck className="mp-icon-14" />
        <h4 className="mp-fw-600 mp-flex-1 mp-m-0 mp-text-body">健康度</h4>
        <span className={`mp-text-xs ${LIGHT_TEXT_CLASS[overall]}`}>{LIGHT_LABEL[overall]}</span>
      </div>
      <div className="mp-flex mp-overflow-y-auto mp-gap-2 mp-py-3 mp-px-4 mp-flex-col mp-onto-list-panel">
        {err && <div className="mp-text-sm mp-text-danger">{err}</div>}
        {sync === null || lint === null ? (
          <div className="mp-gap-2 mp-text-sm mp-text-2 mp-flex-center mp-justify-center mp-onto-card-fill-sm">
            <Loader2 className="mp-icon-12 mp-spin" /> 检查中…
          </div>
        ) : (
          <>
            {lightRow(
              sync.length === 0 ? 'green' : syncLevel,
              '数据源同步',
              sync.length === 0 ? '无数据源声明' : `${syncBad.length}/${sync.length} 异常`,
              'sync',
            )}
            {lightRow(lintLevel, '反模式 lint', `${lint.length} 项发现`, 'lint')}
            {lightRow(overall, '综合健康度', overall === 'red' ? '同步存在失败' : overall === 'yellow' ? '存在反模式' : '一切正常', 'overall')}
            {/* 各数据源最近同步明细 */}
            {sync.length > 0 && (
              <div className="mp-flex mp-border mp-gap-1 mp-pt-2 mp-flex-col" >
                {sync.slice(0, 6).map((r) => (
                  <div key={`${r.tenant_id}/${r.class_rid}`} className="mp-gap-2 mp-text-xs mp-flex-center">
                    <LightDot level={(r.consecutive_failures ?? 0) > 0 || (r.last_error ?? '') !== '' ? 'red' : 'green'} />
                    <span className="mp-hidden mp-nowrap mp-mono mp-ellipsis-text"  title={r.class_rid}>
                      {shortRid(r.class_rid)}
                    </span>
                    <span className="mp-text-2 mp-shrink-0 mp-ml-auto" >
                      {r.last_run_at ? new Date(r.last_run_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未同步'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ── 页面 ──

export default function DashboardPage() {
  const [pins, setPins] = useState<AnalysisPin[]>([]);
  const [types, setTypes] = useState<KernelObjectType[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setPins(readAnalysisPins()); }, []);

  // 类型清单（统计卡数据 + Pin 卡副标题的类型名映射）
  useEffect(() => {
    listObjectTypes()
      .then((ts) => setTypes(ts))
      .catch(() => setTypes([]));
  }, [reloadKey]);

  const typeNames = useMemo(() => {
    const m: Record<string, string> = {};
    types.forEach((t) => { m[t.rid] = t.display_name || t.rid; });
    return m;
  }, [types]);

  const removePin = (id: string) => {
    removeAnalysisPin(id);
    setPins(readAnalysisPins());
  };

  return (
    <div className="mp-flex mp-gap-4 mp-flex-col" >
      {/* 头部 */}
      <div className="mp-gap-2 mp-flex-center">
        <LayoutDashboard className="mp-icon-16" />
        <h3 className="mp-fw-600 mp-m-0 mp-text-md" >本体仪表盘</h3>
        <span className="mp-text-sm mp-text-2">
          分析卡片实时聚合 + 类型 / Action / 健康度概览
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mp-inline-flex mp-items-center mp-clickable mp-border mp-ml-auto mp-gap-1 mp-text-sm mp-text-1 mp-bg-1 mp-rounded mp-onto-btn mp-onto-btn--md"
        >
          <RefreshCw className="mp-icon-12" /> 刷新全部
        </button>
      </div>

      {/* 我的分析卡片 */}
      {pins.length === 0 ? (
        <div className="mp-text-center mp-rounded mp-py-7 mp-px-6 mp-onto-box-dashed">
          <Pin className="mp-text-2 mp-icon-20"  />
          <div className="mp-fw-600 mp-text-md mp-mt-2" >还没有分析卡片</div>
          <div className="mp-text-sm mp-text-2 mp-mt-1" >
            先去分析工作台创建图表，然后 Pin 过来
          </div>
        </div>
      ) : (
        <div className="mp-onto-grid-fill">
          {pins.map((pin) => (
            <PinCard key={pin.id} pin={pin} typeNames={typeNames} reloadKey={reloadKey} onRemove={removePin} />
          ))}
        </div>
      )}

      {/* 系统卡片 */}
      <div className="mp-gap-2 mp-flex-center">
        <MapPin className="mp-icon-14 mp-text-2" />
        <span className="mp-text-sm mp-text-2">系统概览（自动展示）</span>
      </div>
      <div className="mp-onto-grid-fill">
        <TypeStatsCard types={types} reloadKey={reloadKey} />
        <RecentActionsCard reloadKey={reloadKey} />
        <HealthCard reloadKey={reloadKey} />
      </div>
    </div>
  );
}
