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

const GRID_STYLE = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16,
} as const;

const CARD_HEAD_STYLE = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 16px', borderBottom: '1px solid var(--border)',
} as const;

const opBtnStyle = {
  width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 6,
  color: 'var(--muted-foreground)', cursor: 'pointer', padding: 0, flexShrink: 0,
} as const;

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
    <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
      <div style={CARD_HEAD_STYLE}>
        <Pin style={{ width: 13, height: 13, color: 'var(--primary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pin.title}>
            {pin.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {typeNames[pin.config.source] ?? shortRid(pin.config.source)} · {pin.config.dimension}
          </div>
        </div>
        <button type="button" title="刷新" onClick={() => void load()} style={opBtnStyle}>
          <RefreshCw style={{ width: 12, height: 12 }} />
        </button>
        <button type="button" title="移除" onClick={() => onRemove(pin.id)} style={opBtnStyle}>
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div style={{ padding: '10px 12px' }}>
        {busy ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', height: 150, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 style={{ width: 13, height: 13, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
          </div>
        ) : err ? (
          <div style={{ height: 150, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--destructive)', padding: '0 12px', textAlign: 'center', wordBreak: 'break-all' }}>{err}</div>
            <button type="button" onClick={() => void load()} style={{ ...opBtnStyle, width: 'auto', height: 26, padding: '0 12px', fontSize: 11 }}>重试</button>
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
    <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
      <div style={CARD_HEAD_STYLE}>
        <BarChart3 style={{ width: 14, height: 14 }} />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>类型统计</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          {types.length} 类型 · {total} 实例
        </span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        {counts === null ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', height: 150, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 style={{ width: 13, height: 13, animation: 'osp-spin 1s linear infinite' }} /> 统计中…
          </div>
        ) : err ? (
          <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--destructive)' }}>{err}</div>
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
    <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
      <div style={CARD_HEAD_STYLE}>
        <History style={{ width: 14, height: 14 }} />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>最近 Action</h4>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>近 10 条</span>
      </div>
      <div style={{ padding: '8px 16px 12px', maxHeight: 210, overflowY: 'auto' }}>
        {rows === null ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', height: 150, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 style={{ width: 13, height: 13, animation: 'osp-spin 1s linear infinite' }} /> 加载中…
          </div>
        ) : err ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 150, fontSize: 12, color: 'var(--destructive)' }}>{err}</div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 150, fontSize: 12, color: 'var(--muted-foreground)' }}>暂无执行记录</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => (
              <div key={r.audit_id} style={{ display: 'flex', gap: 10 }}>
                {/* 时间线：竖线 + 圆点 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 12 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 6,
                    background: 'var(--primary)', boxShadow: '0 0 0 2px var(--card), 0 0 0 3px var(--border)',
                  }} />
                  {i < rows.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--border)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '4px 0 10px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.action_rid}>
                      {shortRid(r.action_rid)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto', flexShrink: 0 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
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

const LIGHT_COLOR: Record<LightLevel, string> = {
  green: 'var(--success)',
  yellow: 'var(--warning)',
  red: 'var(--destructive)',
};
const LIGHT_LABEL: Record<LightLevel, string> = { green: '健康', yellow: '关注', red: '异常' };

function LightDot({ level }: { level: LightLevel }) {
  return (
    <span style={{
      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
      background: LIGHT_COLOR[level], display: 'inline-block',
    }} />
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
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <LightDot level={level} />
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--muted-foreground)', marginLeft: 'auto', textAlign: 'right' }}>{detail}</span>
    </div>
  );

  return (
    <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
      <div style={CARD_HEAD_STYLE}>
        <ShieldCheck style={{ width: 14, height: 14 }} />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, flex: 1 }}>健康度</h4>
        <span style={{ fontSize: 11, color: LIGHT_COLOR[overall] }}>{LIGHT_LABEL[overall]}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 210, overflowY: 'auto' }}>
        {err && <div style={{ fontSize: 12, color: 'var(--destructive)' }}>{err}</div>}
        {sync === null || lint === null ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 style={{ width: 13, height: 13, animation: 'osp-spin 1s linear infinite' }} /> 检查中…
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
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sync.slice(0, 6).map((r) => (
                  <div key={`${r.tenant_id}/${r.class_rid}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <LightDot level={(r.consecutive_failures ?? 0) > 0 || (r.last_error ?? '') !== '' ? 'red' : 'green'} />
                    <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.class_rid}>
                      {shortRid(r.class_rid)}
                    </span>
                    <span style={{ color: 'var(--muted-foreground)', marginLeft: 'auto', flexShrink: 0 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LayoutDashboard style={{ width: 16, height: 16 }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>本体仪表盘</h3>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          分析卡片实时聚合 + 类型 / Action / 健康度概览
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          style={{
            marginLeft: 'auto', height: 30, padding: '0 14px', fontSize: 12, borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--card)',
            color: 'var(--foreground)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw style={{ width: 12, height: 12 }} /> 刷新全部
        </button>
      </div>

      {/* 我的分析卡片 */}
      {pins.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
          padding: '36px 24px', textAlign: 'center',
        }}>
          <Pin style={{ width: 22, height: 22, color: 'var(--muted-foreground)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>还没有分析卡片</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>
            先去分析工作台创建图表，然后 Pin 过来
          </div>
        </div>
      ) : (
        <div style={GRID_STYLE}>
          {pins.map((pin) => (
            <PinCard key={pin.id} pin={pin} typeNames={typeNames} reloadKey={reloadKey} onRemove={removePin} />
          ))}
        </div>
      )}

      {/* 系统卡片 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MapPin style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>系统概览（自动展示）</span>
      </div>
      <div style={GRID_STYLE}>
        <TypeStatsCard types={types} reloadKey={reloadKey} />
        <RecentActionsCard reloadKey={reloadKey} />
        <HealthCard reloadKey={reloadKey} />
      </div>
    </div>
  );
}
