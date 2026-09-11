// OverviewPage - 本体引擎首页总览（驾驶舱）。
//
// 布局：
//   1. 四张指标卡（顶部等宽 grid）：对象类型数 / 实例总数 / Action 类型数 / 关系类型数
//      —— 实例总数：并发对前 10 个类型 listIndividuals(limit=100) 求和
//         （类型 > 10 或单类触顶 100 时为截断值，显示 ">N"）
//   2. 各 tab 快捷入口（卡片网格 3 列 × N 行）：图标 + 名称 + 一句话描述 +
//      已加载到的活跃指标（如果有）；点击 window.location 跳转对应 tab
//   3. 健康度面板（底部）：反模式 lint / 近 7 天活跃类型 / 数据源同步健康
//   4. 最近活动（右栏）：action-audit 时间线（时间 / 动作名 / 执行者 / 编辑数）
//
// 全部数据 Promise.allSettled 并发加载：任何单个请求失败不阻塞其余
// （失败指标显示「—」并附不可用提示）。
//
// 纪律：原生 button + 内联样式 + CSS 变量；交互不依赖 Semi 组件。

import { useEffect, useState } from 'react';
import {
  AlertTriangle, Boxes, CheckCircle2, ChevronRight, Database, GitBranch,
  Hexagon, History, Layers, Link2, Loader2, PlayCircle, ShieldCheck, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  getDatasourceSyncStatus, getUsageSummary, listActionAudit, listActionTypes,
  listIndividuals, listLinkTypes, listObjectTypes, lintAntiPatterns, propSlug,
  type ActionAuditRow, type KernelObjectType, type SyncStatusRow,
} from '@/api/ont/kernel';

/** tab 快捷入口卡配置（path 与 OntologyShellPage TABS 对齐）。 */
interface EntryCard {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  path: string;
}

const ENTRY_CARDS: EntryCard[] = [
  { key: 'concept', label: '概念模型', icon: Hexagon, path: '/ontology?tab=concept', description: '类型 schema 管理：属性 / 主键 / 层级 / 版本' },
  { key: 'objects', label: '对象数据', icon: Boxes, path: '/ontology?tab=objects', description: '实例浏览与语义搜索，一跳关系遍历' },
  { key: 'relationship-types', label: '关系类型', icon: Link2, path: '/ontology?tab=relationship-types', description: '关系模型：基数 / 方向 / 关系属性' },
  { key: 'action-types', label: '动作类型', icon: Zap, path: '/ontology?tab=action-types', description: 'Action 模型：参数 / 提交条件 / 副作用' },
  { key: 'action', label: 'Action 编排', icon: PlayCircle, path: '/ontology?tab=action', description: 'FlowGram 流程编排与执行历史' },
  { key: 'datacenter', label: '数据中心', icon: Database, path: '/ontology?tab=datacenter', description: '数据源绑定 / CDC 同步 / 物化' },
  { key: 'graph', label: '知识图谱', icon: GitBranch, path: '/ontology?tab=graph', description: '图谱可视化：领域视角全量浏览' },
  { key: 'interfaces', label: '接口', icon: Layers, path: '/ontology?tab=interfaces', description: 'Interface 契约与实现清单' },
  { key: 'governance', label: '治理', icon: ShieldCheck, path: '/ontology?tab=governance', description: '使用量 / 反模式 lint / 生命周期' },
];

/** 实例总数探测：最多取前 10 个类型，单类 limit=100。 */
const INSTANCE_PROBE_TYPES = 10;
const INSTANCE_PROBE_LIMIT = 100;

interface MetricsState {
  objectTypes: number | null;
  instances: number | null;
  /** true = 求和被截断（类型 > 10 或单类触顶），显示 ">N"。 */
  instancesTruncated: boolean;
  actionTypes: number | null;
  linkTypes: number | null;
}

interface HealthState {
  /** null = 未加载/失败；数字 = 反模式发现数。 */
  antiPatterns: number | null;
  /** null = 未加载/失败；数字 = 近 7 天有读写的类型数。 */
  activeTypes7d: number | null;
  /** null = 未加载/失败；空数组 = 无同步任务。 */
  sync: SyncStatusRow[] | null;
}

const METRIC_LABEL_STYLE = { fontSize: 12, color: 'var(--muted-foreground)' } as const;

function MetricValue({ value, loading }: { value: number | null; loading: boolean }) {
  if (loading) {
    return <Loader2 style={{ width: 20, height: 20, animation: 'osp-spin 1s linear infinite', color: 'var(--muted-foreground)' }} />;
  }
  return <span style={{ fontSize: 28, fontWeight: 700, lineHeight: '32px', color: 'var(--foreground)' }}>{value === null ? '—' : value.toLocaleString()}</span>;
}

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<MetricsState>({
    objectTypes: null, instances: null, instancesTruncated: false, actionTypes: null, linkTypes: null,
  });
  const [health, setHealth] = useState<HealthState>({ antiPatterns: null, activeTypes7d: null, sync: null });
  const [audit, setAudit] = useState<ActionAuditRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 第一批：所有指标 / 健康度 / 活动请求并发，单个失败不阻塞其余
      const [otsR, atsR, ltsR, lintR, usageR, syncR, auditR] = await Promise.allSettled([
        listObjectTypes(),
        listActionTypes(),
        listLinkTypes(),
        lintAntiPatterns(),
        getUsageSummary(7),
        getDatasourceSyncStatus(),
        listActionAudit(8),
      ]);
      if (cancelled) return;

      const nextMetrics: MetricsState = {
        objectTypes: otsR.status === 'fulfilled' ? otsR.value.length : null,
        instances: null,
        instancesTruncated: false,
        actionTypes: atsR.status === 'fulfilled' ? atsR.value.length : null,
        linkTypes: ltsR.status === 'fulfilled' ? ltsR.value.length : null,
      };
      setMetrics(nextMetrics);

      const nextHealth: HealthState = {
        antiPatterns: lintR.status === 'fulfilled' ? lintR.value.length : null,
        activeTypes7d: usageR.status === 'fulfilled'
          ? usageR.value.filter((u) => (u.reads ?? 0) > 0 || (u.writes ?? 0) > 0).length
          : null,
        sync: syncR.status === 'fulfilled' ? syncR.value : null,
      };
      setHealth(nextHealth);
      setAudit(auditR.status === 'fulfilled' ? auditR.value : null);

      // 第二批：实例总数依赖对象类型清单（第一批完成后才发）
      if (otsR.status === 'fulfilled' && otsR.value.length > 0) {
        const types: KernelObjectType[] = otsR.value.slice(0, INSTANCE_PROBE_TYPES);
        const probes = await Promise.allSettled(
          types.map((t) => listIndividuals({ classRid: t.rid, limit: INSTANCE_PROBE_LIMIT })),
        );
        if (cancelled) return;
        let total = 0;
        let truncated = otsR.value.length > INSTANCE_PROBE_TYPES;
        probes.forEach((p) => {
          if (p.status === 'fulfilled') {
            total += p.value.length;
            // 单类取满 100 条说明可能被分页截断
            if (p.value.length >= INSTANCE_PROBE_LIMIT) truncated = true;
          }
        });
        setMetrics((prev) => ({ ...prev, instances: total, instancesTruncated: truncated }));
      } else if (otsR.status === 'fulfilled') {
        setMetrics((prev) => ({ ...prev, instances: 0, instancesTruncated: false }));
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // ── 健康度派生 ──
  const syncFailed = (health.sync ?? []).filter((r) => (r.consecutive_failures ?? 0) > 0);
  const syncOk = health.sync !== null && health.sync.length > 0 && syncFailed.length === 0;
  const syncEmpty = health.sync !== null && health.sync.length === 0;
  const syncUnknown = health.sync === null;

  const lintOk = health.antiPatterns === 0;
  const lintWarn = (health.antiPatterns ?? 0) > 0;

  const openEntry = (path: string) => { window.location.assign(path); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. 四张指标卡 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', boxShadow: 'var(--shadow-1)' }}>
          <div style={METRIC_LABEL_STYLE}>对象类型数</div>
          <div style={{ marginTop: 8 }}><MetricValue value={metrics.objectTypes} loading={loading && metrics.objectTypes === null} /></div>
        </div>
        <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', boxShadow: 'var(--shadow-1)' }}>
          <div style={METRIC_LABEL_STYLE}>实例总数（前 {INSTANCE_PROBE_TYPES} 类）</div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 2 }}>
            {metrics.instancesTruncated && metrics.instances !== null && (
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>&gt;</span>
            )}
            <MetricValue value={metrics.instances} loading={loading && metrics.instances === null} />
          </div>
        </div>
        <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', boxShadow: 'var(--shadow-1)' }}>
          <div style={METRIC_LABEL_STYLE}>Action 类型数</div>
          <div style={{ marginTop: 8 }}><MetricValue value={metrics.actionTypes} loading={loading && metrics.actionTypes === null} /></div>
        </div>
        <div style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', boxShadow: 'var(--shadow-1)' }}>
          <div style={METRIC_LABEL_STYLE}>关系类型数</div>
          <div style={{ marginTop: 8 }}><MetricValue value={metrics.linkTypes} loading={loading && metrics.linkTypes === null} /></div>
        </div>
      </div>

      {/* ── 2. 快捷入口 + 4. 最近活动（左右分栏） ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 快捷入口卡（3 × 3） */}
        <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>模块导航</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {ENTRY_CARDS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => openEntry(entry.path)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                    padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--card)', color: 'var(--foreground)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Icon style={{ width: 15, height: 15, color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.label}</span>
                    <ChevronRight style={{ width: 12, height: 12, marginLeft: 'auto', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: '16px' }}>{entry.description}</span>
                  {entry.key === 'concept' && metrics.objectTypes !== null && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{metrics.objectTypes} 个类型</span>
                  )}
                  {entry.key === 'objects' && metrics.instances !== null && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      {metrics.instancesTruncated ? '>' : ''}{metrics.instances} 条实例（探测口径）
                    </span>
                  )}
                  {entry.key === 'relationship-types' && metrics.linkTypes !== null && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{metrics.linkTypes} 个关系</span>
                  )}
                  {entry.key === 'action-types' && metrics.actionTypes !== null && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{metrics.actionTypes} 个 Action</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 最近活动时间线 */}
        <div style={{ width: 380, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History style={{ width: 14, height: 14 }} /> 最近活动
          </h3>
          {audit === null ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '12px 0' }}>
              {loading ? '加载中…' : '执行历史不可用'}
            </div>
          ) : audit.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '12px 0' }}>暂无 Action 执行记录</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {audit.slice(0, 8).map((row, i) => {
                const edits = row.result?.applied_count;
                return (
                  <li
                    key={row.audit_id}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2,
                      padding: '8px 0 8px 14px', position: 'relative',
                      borderBottom: i < Math.min(audit.length, 8) - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {/* 时间线节点与竖线 */}
                    <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 14, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                    {i < Math.min(audit.length, 8) - 1 && (
                      <span aria-hidden="true" style={{ position: 'absolute', left: 2.5, top: 22, bottom: -6, width: 1, background: 'var(--border)' }} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }} title={row.action_rid}>
                      {propSlug(row.action_rid) || row.action_rid}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span title={row.created_at}>{new Date(row.created_at).toLocaleString()}</span>
                      <span>执行者 {row.actor_id || '—'}</span>
                      <span>编辑数 {typeof edits === 'number' ? edits : (edits !== undefined ? String(edits) : '—')}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── 3. 健康度面板 ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: '16px 18px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>健康度</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {/* 反模式 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {lintOk ? (
              <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
            ) : lintWarn ? (
              <AlertTriangle style={{ width: 16, height: 16, color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
            ) : (
              <span style={{ width: 16, height: 16, flexShrink: 0, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, lineHeight: '16px' }}>—</span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>反模式检查</div>
              <div style={{ fontSize: 12, color: lintOk ? 'var(--success)' : lintWarn ? 'var(--warning)' : 'var(--muted-foreground)' }}>
                {health.antiPatterns === null
                  ? (loading ? '检查中…' : '不可用')
                  : lintOk
                    ? '未发现反模式'
                    : `${health.antiPatterns} 项发现（详见治理 tab）`}
              </div>
            </div>
          </div>

          {/* 近 7 天活跃类型 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <Hexagon style={{ width: 16, height: 16, color: health.activeTypes7d !== null && health.activeTypes7d > 0 ? 'var(--success)' : 'var(--muted-foreground)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>近 7 天活跃类型</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {health.activeTypes7d === null
                  ? (loading ? '统计中…' : '不可用')
                  : `${health.activeTypes7d} 个类型有读写`}
              </div>
            </div>
          </div>

          {/* 数据源同步 */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            {syncOk ? (
              <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
            ) : syncFailed.length > 0 ? (
              <XCircle style={{ width: 16, height: 16, color: 'var(--destructive)', flexShrink: 0, marginTop: 1 }} />
            ) : (
              <Database style={{ width: 16, height: 16, color: 'var(--muted-foreground)', flexShrink: 0, marginTop: 1 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>数据源同步</div>
              <div style={{ fontSize: 12, color: syncFailed.length > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                {syncUnknown
                  ? (loading ? '查询中…' : '不可用')
                  : syncEmpty
                    ? '暂无数据源同步任务'
                    : syncOk
                      ? `全部正常（${health.sync!.length} 个类型）`
                      : `${syncFailed.length} / ${health.sync!.length} 个类型连续失败`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
