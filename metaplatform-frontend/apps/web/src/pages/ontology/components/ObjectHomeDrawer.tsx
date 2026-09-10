// ObjectHomeDrawer - 对象主页（ONT-UI-01，Palantir Object Views 对位）。
//
// 单个 Individual 的"主页"：
//   1. 头部：类型 display_name + 主键值 + rid + 状态标记
//   2. 图谱视图（G42）：ego 径向布局 SVG（中心=当前对象，一环=searchAround
//      peers 按 link 分组扇形分布），默认收起
//   3. 属性区：按 ObjectType.properties 元数据渲染（slug 短键 + format 徽标）；
//      latlon → mini 投影图，geojson → SVG 投影（Point/LineString/Polygon）
//   4. 关联对象区（Search Around）：GET /individuals/{rid}/around 按
//      (link_type, direction) 分组；分组名用方向性显示名
//      （出边 src_display_name / 入边 dst_display_name）
//   5. 对端可点击 → onNavigate(peerRid) 在同一抽屉内跳转（父组件维护栈）
//
// 严格原生 button（dev 模式 Semi Button onClick 截 noop，见 CLAUDE.md 记忆）。

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Boxes, Loader2, Network, X, Zap } from 'lucide-react';
import {
  getIndividual, getObjectType, listActionTypes, propSlug, queryTimeseries,
  searchAround,
  type KernelActionType, type KernelIndividual, type KernelObjectType,
  type SearchAroundGroup, type TimeseriesPoint,
} from '@/api/ont/kernel';
import ActionFormDrawer from './ActionFormDrawer';

export interface ObjectHomeDrawerProps {
  open: boolean;
  rid: string | null;
  /** 访问栈（父组件维护）：栈底是最初打开的对象。 */
  stack: string[];
  /** 点击关联对象：父组件 push 新 rid（抽屉不关，内容切换）。 */
  onNavigate: (rid: string) => void;
  /** 后退一步（栈 pop；栈空时关抽屉）。 */
  onBack: () => void;
  onClose: () => void;
}

const FORMAT_BADGE_COLOR: Record<string, string> = {
  timeseries: '#c084fc',
  geojson: '#4dd0e1',
  latlon: '#4dd0e1',
  image: '#fb923c',
  audio: '#fb923c',
  video: '#fb923c',
  struct: '#62d178',
  vector: '#fbbf24',
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function ObjectHomeDrawer({
  open, rid, stack, onNavigate, onBack, onClose,
}: ObjectHomeDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [individual, setIndividual] = useState<KernelIndividual | null>(null);
  const [objectType, setObjectType] = useState<KernelObjectType | null>(null);
  const [groups, setGroups] = useState<SearchAroundGroup[]>([]);
  // UI-02：可执行 Action（on 命中该类）+ 表单抽屉
  const [applicableActions, setApplicableActions] = useState<KernelActionType[]>([]);
  const [formAction, setFormAction] = useState<KernelActionType | null>(null);
  // UI-05：时序 sparkline（series_rid -> points）
  const [series, setSeries] = useState<Record<string, TimeseriesPoint[]>>({});
  // G42：ego 图谱视图折叠态（默认收起）
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    if (!open || !rid) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setIndividual(null);
    setObjectType(null);
    setGroups([]);
    (async () => {
      try {
        const ind = await getIndividual(rid);
        if (cancelled) return;
        setIndividual(ind);
        const [ot, around, ats] = await Promise.all([
          getObjectType(ind.class_rid).catch(() => null),
          searchAround(rid).catch(() => [] as SearchAroundGroup[]),
          listActionTypes().catch(() => [] as KernelActionType[]),
        ]);
        if (cancelled) return;
        setObjectType(ot);
        setGroups(around);
        setApplicableActions(ats.filter((at) => at.on.includes(ind.class_rid)));
        if (ot) {
          for (const pr of ot.properties) {
            if (pr.format !== 'timeseries') continue;
            const v = ind.props[pr.rid];
            if (typeof v === 'string' && v) {
              queryTimeseries(v).then((pts) => {
                if (!cancelled) setSeries((m) => ({ ...m, [v]: pts }));
              }).catch(() => undefined);
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, rid]);

  if (!open) return null;

  const typeLabel = objectType?.display_name || individual?.class_rid || '';
  const propMeta = new Map<string, { title: string; format: string }>();
  objectType?.properties.forEach((p) => {
    propMeta.set(p.rid, { title: p.title || propSlug(p.rid), format: p.format });
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '60%', minWidth: 680, maxWidth: 900,
          height: '100%',
          background: 'var(--background)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>
              对象主页 · {typeLabel}
              {objectType?.status && objectType.status !== 'active' && (
                <span style={{ marginLeft: 8, color: '#fbbf24' }}>{objectType.status}</span>
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {individual?.primary_key ?? rid}
            </h3>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, fontFamily: 'monospace' }}>
              {rid}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {stack.length > 1 && (
              <button
                type="button"
                onClick={onBack}
                title="返回上一个对象"
                style={{
                  width: 32, height: 32, borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ArrowLeft style={{ width: 14, height: 14 }} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              style={{
                width: 32, height: 32, borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--muted-foreground)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 60, justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
              <Loader2 className="osp-spin" style={{ width: 16, height: 16, animation: 'osp-spin 1s linear infinite' }} />
              加载对象…
            </div>
          )}
          {error && (
            <div style={{ padding: 16, border: '1px solid var(--destructive)', borderRadius: 8, color: 'var(--destructive)', fontSize: 13 }}>
              {error}
            </div>
          )}
          {individual && !loading && (
            <>
              {/* 可执行 Action（UI-02）*/}
              {applicableActions.length > 0 && (
                <section style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap style={{ width: 14, height: 14, color: '#fbbf24' }} /> 可执行动作
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {applicableActions.map((at) => (
                      <button
                        key={at.rid}
                        type="button"
                        onClick={() => setFormAction(at)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', fontSize: 12, borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--card)',
                          color: 'var(--foreground)', cursor: 'pointer',
                        }}
                      >
                        <Zap style={{ width: 11, height: 11, color: '#fbbf24' }} />
                        {at.title || at.rid.split('.')[3] || at.rid}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 图谱视图（G42 ego 径向布局，默认收起） */}
              <section style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Network style={{ width: 14, height: 14 }} /> 图谱视图
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowGraph((s) => !s)}
                    style={{
                      padding: '3px 12px', fontSize: 12, borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--card)',
                      color: 'var(--foreground)', cursor: 'pointer',
                    }}
                  >
                    {showGraph ? '收起' : '展开'}
                  </button>
                </div>
                {showGraph && (
                  groups.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无一跳关联，无法构图</div>
                  ) : (
                    <EgoGraph
                      groups={groups}
                      centerLabel={individual?.primary_key ?? rid ?? ''}
                      centerSub={typeLabel}
                      centerColor={egoTypeColor(individual?.class_rid ?? '')}
                      onNavigate={onNavigate}
                    />
                  )
                )}
              </section>

              {/* 属性区 */}
              <section style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: 'var(--foreground)' }}>属性</h4>
                {Object.keys(individual.props).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无属性值</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {Object.entries(individual.props).map(([prid, v]) => {
                      const meta = propMeta.get(prid);
                      const badge = meta?.format && FORMAT_BADGE_COLOR[meta.format];
                      return (
                        <div key={prid} style={{
                          border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
                          background: 'var(--card)', minWidth: 0,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                              {meta?.title || propSlug(prid)}
                            </span>
                            {badge && (
                              <span style={{
                                fontSize: 10, padding: '0 6px', borderRadius: 999,
                                border: `1px solid ${FORMAT_BADGE_COLOR[meta!.format]}`,
                                color: FORMAT_BADGE_COLOR[meta!.format],
                              }}>
                                {meta!.format}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--foreground)', wordBreak: 'break-all' }}>
                            {meta?.format === 'timeseries' && typeof v === 'string' && series[v]
                              ? <Sparkline points={series[v]} />
                              : meta?.format === 'latlon' && isLatLon(v)
                                ? <LatlonMiniMap lat={v[0]} lon={v[1]} />
                                : meta?.format === 'geojson' && v !== null && typeof v === 'object'
                                  ? <GeoJsonMiniMap value={v} />
                                  : formatValue(v)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 关联对象区（Search Around） */}
              <section>
                <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Boxes style={{ width: 14, height: 14 }} /> 关联对象
                </h4>
                {groups.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无一跳关联</div>
                ) : (
                  groups.map((g) => (
                    <div key={`${g.link_type_rid}|${g.direction}`} style={{
                      border: '1px solid var(--border)', borderRadius: 8,
                      padding: '10px 12px', marginBottom: 10, background: 'var(--card)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{g.link_display}</span>
                        <span style={{
                          fontSize: 10, padding: '0 6px', borderRadius: 999,
                          background: 'var(--muted)', color: 'var(--muted-foreground)',
                        }}>
                          {g.direction === 'out' ? '出边' : '入边'} · {g.peers.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {g.peers.map((peer) => {
                          const peerRid = String(peer.__rid__ ?? '');
                          const label = Object.entries(peer)
                            .filter(([k]) => k !== '__rid__')
                            .map(([, v]) => formatValue(v))
                            .find((x) => x !== '—') ?? peerRid;
                          return (
                            <button
                              key={peerRid}
                              type="button"
                              onClick={() => peerRid && onNavigate(peerRid)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', fontSize: 12,
                                border: '1px solid var(--border)', borderRadius: 999,
                                background: 'var(--background)', color: 'var(--foreground)',
                                cursor: 'pointer', maxWidth: 320,
                              }}
                              title={peerRid}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                              </span>
                              <ArrowUpRight style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--muted-foreground)' }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
        {/* Action 执行表单（UI-02 D7 预览即确认）*/}
        <ActionFormDrawer
          open={formAction !== null}
          action={formAction}
          targetIid={rid}
          targetLabel={individual?.primary_key}
          onClose={() => setFormAction(null)}
          onApplied={() => {
            setFormAction(null);
            if (rid) {
              const cur = rid;
              setGroups([]);
              setIndividual(null);
              getIndividual(cur).then(setIndividual).catch(() => undefined);
            }
          }}
        />
      </div>
    </div>
  );
}

/** UI-05：时序 mini 折线（SVG，无第三方依赖）。 */
function Sparkline({ points }: { points: TimeseriesPoint[] }) {
  if (points.length === 0) return <span>（空序列）</span>;
  const w = 160, h = 28;
  const values = points.map((pp) => pp.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const path = points.map((pp, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * (w - 4) + 2;
    const y = h - 3 - ((pp.value - min) / span) * (h - 6);
    return (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={path} fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
      </svg>
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
        {points.length} 点 · {min.toFixed(2)}~{max.toFixed(2)}
      </span>
    </span>
  );
}

// ── G42：ego 径向布局图谱（纯 SVG，无第三方库） ──

const EGO_LINK_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c', '#a3e635'];
const EGO_TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ef4444', '#d946ef'];
/** 防重叠兜底：一环最多展示节点数（超出部分图例处提示）。 */
const EGO_MAX_NODES = 48;

/** 类型色：class_rid 哈希到固定调色板（同类型同色）。 */
function egoTypeColor(rid: string): string {
  let h = 0;
  for (let i = 0; i < rid.length; i++) h = (h * 31 + rid.charCodeAt(i)) >>> 0;
  return EGO_TYPE_COLORS[h % EGO_TYPE_COLORS.length] ?? '#3b82f6';
}

/** 标签截断（默认 12 字符）。 */
function egoTruncate(s: string, n = 12): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** peer 行第一个非 __rid__ 的有效值作为节点标签（与关联对象区口径一致）。 */
function peerLabelOf(peer: Record<string, unknown> & { __rid__?: string }): string {
  const ridStr = String(peer.__rid__ ?? '');
  return Object.entries(peer)
    .filter(([k]) => k !== '__rid__')
    .map(([, v]) => formatValue(v))
    .find((x) => x !== '—') ?? ridStr;
}

/**
 * G42：ego 图 —— 中心 = 当前对象（主键值 + 类型色），一环 = searchAround 的
 * peers 按 link 分组扇形分布（每组连续弧段、组内均匀角度）；边按分组着色，
 * 点击一环节点调用 onNavigate(rid) 抽屉内跳转。
 */
function EgoGraph({ groups, centerLabel, centerSub, centerColor, onNavigate }: {
  groups: SearchAroundGroup[];
  centerLabel: string;
  centerSub: string;
  centerColor: string;
  onNavigate: (rid: string) => void;
}) {
  const w = 640, h = 360, cx = w / 2, cy = h / 2;
  const all: Array<{ rid: string; label: string; gi: number }> = [];
  groups.forEach((g, gi) => {
    g.peers.forEach((peer) => {
      all.push({ rid: String(peer.__rid__ ?? ''), label: peerLabelOf(peer), gi });
    });
  });
  const nodes = all.slice(0, EGO_MAX_NODES);
  const hidden = all.length - nodes.length;
  const n = nodes.length;
  if (n === 0) {
    return <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>无一跳关联，无法构图</div>;
  }
  const r = 132;                       // 一环半径（垂直方向受 360 高度约束）
  const nodeR = n > 28 ? 7 : 10;       // 节点多时缩小半径防重叠
  // 分组扇形：每组占连续弧段（弧长 ∝ 组内节点数），组内再均匀角度分布
  const groupCount = new Map<number, number>();
  nodes.forEach((nd) => groupCount.set(nd.gi, (groupCount.get(nd.gi) ?? 0) + 1));
  const groupStart = new Map<number, number>();
  let acc = 0;
  Array.from(groupCount.keys()).sort((a, b) => a - b).forEach((gi) => {
    groupStart.set(gi, acc / n);
    acc += groupCount.get(gi) ?? 0;
  });
  const within = new Map<number, number>();
  const placed = nodes.map((nd) => {
    const k = within.get(nd.gi) ?? 0;
    within.set(nd.gi, k + 1);
    const t = (groupStart.get(nd.gi) ?? 0) + (k + 0.5) / n;
    const angle = t * Math.PI * 2 - Math.PI / 2; // 起点在正上方
    return {
      ...nd,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      color: EGO_LINK_COLORS[nd.gi % EGO_LINK_COLORS.length] ?? '#60a5fa',
    };
  });
  const legend = groups
    .map((g, gi) => ({
      label: g.link_display,
      count: groupCount.get(gi) ?? 0,
      color: EGO_LINK_COLORS[gi % EGO_LINK_COLORS.length] ?? '#60a5fa',
    }))
    .filter((l) => l.count > 0);
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', maxWidth: w, height: 'auto', display: 'block', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}
      >
        {/* 边（按 link 分组着色） */}
        {placed.map((nd, i) => (
          <line key={`e${i}`} x1={cx} y1={cy} x2={nd.x} y2={nd.y}
            stroke={nd.color} strokeWidth={1.2} opacity={0.65} />
        ))}
        {/* 中心节点：当前对象（类型色） */}
        <circle cx={cx} cy={cy} r={30} fill={centerColor} stroke="var(--background)" strokeWidth={2} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff">
          {egoTruncate(centerLabel, 6)}
        </text>
        <text x={cx} y={cy + 48} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">
          {egoTruncate(centerLabel)}
        </text>
        <text x={cx} y={cy + 64} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
          {egoTruncate(centerSub, 16)}
        </text>
        {/* 一环节点：圆 + 下方文字，点击跳转 */}
        {placed.map((nd, i) => (
          <g key={`n${i}`} onClick={() => nd.rid && onNavigate(nd.rid)} style={{ cursor: nd.rid ? 'pointer' : 'default' }}>
            <title>{`${nd.label}\n${nd.rid}`}</title>
            <circle cx={nd.x} cy={nd.y} r={nodeR} fill={nd.color} stroke="var(--background)" strokeWidth={1.5} />
            <text x={nd.x} y={nd.y + nodeR + 12} textAnchor="middle" fontSize={10} fill="var(--foreground)">
              {egoTruncate(nd.label)}
            </text>
          </g>
        ))}
      </svg>
      {/* 图例：按 link 分组 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
        {legend.map((l) => (
          <span key={`${l.label}|${l.color}|${l.count}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: l.color, display: 'inline-block', flexShrink: 0 }} />
            {l.label} · {l.count}
          </span>
        ))}
        {hidden > 0 && <span>共 {all.length} 个关联，仅显示前 {EGO_MAX_NODES} 个</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>点击一环节点可在抽屉内跳转到该对象</div>
    </div>
  );
}

// ── G42：地理属性渲染（latlon / geojson mini 投影） ──

/** latlon 值判定：[lat, lon] 两个有限数字。 */
function isLatLon(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length >= 2
    && typeof v[0] === 'number' && Number.isFinite(v[0])
    && typeof v[1] === 'number' && Number.isFinite(v[1]);
}

/** latlon（[lat, lon]）mini 投影图：经纬线性投影到 200x120 + 经纬网格 + 中心点 + 坐标文本。 */
function LatlonMiniMap({ lat, lon }: { lat: number; lon: number }) {
  const w = 200, h = 120, pad = 3;
  // 负经度 → 左；纬度 → 上（y 轴翻转）
  const px = (lo: number) => pad + ((lo + 180) / 360) * (w - pad * 2);
  const py = (la: number) => pad + ((90 - la) / 180) * (h - pad * 2);
  const x = px(lon), y = py(lat);
  const lonTicks = [-150, -120, -90, -60, -30, 30, 60, 90, 120, 150]; // 0° 单独加粗
  const latTicks = [-60, -30, 30, 60];                                // 0° 单独加粗
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', flexShrink: 0 }}>
        {lonTicks.map((lo) => (
          <line key={`lo${lo}`} x1={px(lo)} y1={0} x2={px(lo)} y2={h} stroke="var(--border)" strokeWidth={0.5} opacity={0.7} />
        ))}
        {latTicks.map((la) => (
          <line key={`la${la}`} x1={0} y1={py(la)} x2={w} y2={py(la)} stroke="var(--border)" strokeWidth={0.5} opacity={0.7} />
        ))}
        <line x1={px(0)} y1={0} x2={px(0)} y2={h} stroke="var(--border)" strokeWidth={0.9} />
        <line x1={0} y1={py(0)} x2={w} y2={py(0)} stroke="var(--border)" strokeWidth={0.9} />
        <circle cx={x} cy={y} r={4.5} fill="#f87171" stroke="var(--card)" strokeWidth={1.5} />
      </svg>
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>
        {lat.toFixed(4)}, {lon.toFixed(4)}
      </span>
    </span>
  );
}

type LonLat = [number, number];

/** 解析 GeoJSON（支持裸 Geometry 或 Feature 包装；仅 Point / LineString / Polygon）。 */
function parseGeoJson(value: unknown): {
  kind: 'Point' | 'LineString' | 'Polygon';
  positions: LonLat[];
  point?: LonLat;
  line?: LonLat[];
  rings?: LonLat[][];
} {
  let g = value as { type?: unknown; coordinates?: unknown; geometry?: unknown };
  if (g && typeof g === 'object' && g.type === 'Feature' && g.geometry && typeof g.geometry === 'object') {
    g = g.geometry as { type?: unknown; coordinates?: unknown };
  }
  const pos = (p: unknown): LonLat => {
    if (Array.isArray(p) && p.length >= 2
      && typeof p[0] === 'number' && Number.isFinite(p[0])
      && typeof p[1] === 'number' && Number.isFinite(p[1])) {
      return [p[0], p[1]];
    }
    throw new Error('bad position');
  };
  const t = g?.type;
  const coords = g?.coordinates;
  if (t === 'Point') {
    const point = pos(coords);
    return { kind: 'Point', positions: [point], point };
  }
  if (t === 'LineString' && Array.isArray(coords)) {
    const line = coords.map(pos);
    if (line.length < 2) throw new Error('too few points');
    return { kind: 'LineString', positions: line, line };
  }
  if (t === 'Polygon' && Array.isArray(coords)) {
    const rings = coords.map((ring) => {
      if (!Array.isArray(ring)) throw new Error('bad ring');
      return ring.map(pos);
    });
    if (rings.length === 0) throw new Error('empty polygon');
    return { kind: 'Polygon', positions: rings.flat(), rings };
  }
  throw new Error(`unsupported geojson type: ${String(t)}`);
}

/**
 * geojson mini 投影：Point 画点 / LineString 折线 / Polygon 环填充
 * （bbox 归一化 + 保持纵横比；负经度→左、纬度→上）。渲染失败回落 JSON 文本。
 */
function GeoJsonMiniMap({ value }: { value: unknown }) {
  try {
    const { kind, positions, point, line, rings } = parseGeoJson(value);
    const w = 200, h = 120, pad = 12;
    const lons = positions.map((p) => p[0]);
    const lats = positions.map((p) => p[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const dLon = maxLon - minLon || 1;
    const dLat = maxLat - minLat || 1;
    // bbox 归一化（等比缩放居中；退化 bbox 时单点居中）
    const scale = Math.min((w - pad * 2) / dLon, (h - pad * 2) / dLat);
    const ox = (w - dLon * scale) / 2;
    const oy = (h - dLat * scale) / 2;
    const X = (lon: number) => ox + (lon - minLon) * scale;
    const Y = (lat: number) => oy + (maxLat - lat) * scale; // 纬度 → 上
    let path = '';
    if (kind === 'Polygon' && rings) {
      path = rings.map((ring) => ring
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`)
        .join(' ') + ' Z').join(' ');
    } else if (kind === 'LineString' && line) {
      path = line
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`)
        .join(' ');
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
        <svg width={w} height={h} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--card)', flexShrink: 0 }}>
          {/* 简易经纬网格 */}
          {[1, 2].map((i) => (
            <line key={`vx${i}`} x1={(w / 3) * i} y1={0} x2={(w / 3) * i} y2={h} stroke="var(--border)" strokeWidth={0.5} opacity={0.7} />
          ))}
          {[1, 2].map((i) => (
            <line key={`hz${i}`} x1={0} y1={(h / 3) * i} x2={w} y2={(h / 3) * i} stroke="var(--border)" strokeWidth={0.5} opacity={0.7} />
          ))}
          {kind === 'Polygon' && (
            <path d={path} fill="rgba(77,208,225,0.18)" stroke="#4dd0e1" strokeWidth={1.2} fillRule="evenodd" />
          )}
          {kind === 'LineString' && (
            <path d={path} fill="none" stroke="#4dd0e1" strokeWidth={1.5} />
          )}
          {kind === 'Point' && point && (
            <circle cx={X(point[0])} cy={Y(point[1])} r={4.5} fill="#f87171" stroke="var(--card)" strokeWidth={1.5} />
          )}
        </svg>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          GeoJSON · {kind === 'Point' ? '点' : kind === 'LineString' ? '线' : '面'} · {positions.length} 点
        </span>
      </span>
    );
  } catch {
    return <span style={{ fontSize: 12, wordBreak: 'break-all' }}>{formatValue(value)}</span>;
  }
}
