// ObjectHomeDrawer - 对象主页（ONT-UI-01，Palantir Object Views 对位）。
//
// 单个 Individual 的"主页"：
//   1. 头部：类型 display_name + 主键值 + rid + 状态标记
//   2. 属性区：按 ObjectType.properties 元数据渲染（slug 短键 + format 徽标）
//   3. 关联对象区（Search Around）：GET /individuals/{rid}/around 按
//      (link_type, direction) 分组；分组名用方向性显示名
//      （出边 src_display_name / 入边 dst_display_name）
//   4. 对端可点击 → onNavigate(peerRid) 在同一抽屉内跳转（父组件维护栈）
//
// 严格原生 button（dev 模式 Semi Button onClick 截 noop，见 CLAUDE.md 记忆）。

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Boxes, Loader2, X } from 'lucide-react';
import {
  getIndividual, getObjectType, propSlug, searchAround,
  type KernelIndividual, type KernelObjectType, type SearchAroundGroup,
} from '@/api/ont/kernel';

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
        const [ot, around] = await Promise.all([
          getObjectType(ind.class_rid).catch(() => null),
          searchAround(rid).catch(() => [] as SearchAroundGroup[]),
        ]);
        if (cancelled) return;
        setObjectType(ot);
        setGroups(around);
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
                            {formatValue(v)}
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
      </div>
    </div>
  );
}
