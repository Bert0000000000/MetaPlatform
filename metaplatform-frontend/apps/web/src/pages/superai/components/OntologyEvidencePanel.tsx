// OntologyEvidencePanel - 本体证据的「关系图 + 对象数据」展示。
//
// 聊天里的证据若指向具体本体对象（evidence.objectId），就把它当焦点对象，
// 拉两样东西：
//   - searchAround(rid) → 一跳关联（按 link_type / direction 分组，含对端属性）
//   - getIndividual(rid) → 焦点对象自身属性
// 左边画关系图（SemiGraphCanvas），右边列对象数据；点邻居节点可重新居中下钻。
//
// 类型级证据（list_classes 等没有 objectId 的）不走这里，仍由 EvidenceRenderer 平铺。

import { useEffect, useMemo, useState } from 'react';
import { Tag, Typography } from '@douyinfe/semi-ui';
import SemiGraphCanvas, {
  type GraphEdgeSpec,
  type GraphNodeSpec,
} from '@/components/SemiGraphCanvas';
import {
  getIndividual,
  searchAround,
  type KernelIndividual,
  type SearchAroundGroup,
} from '@/api/ont/kernel';
import type { Evidence } from '@/api/superai/types';

const { Text } = Typography;

const WORLD_W = 560;
const WORLD_H = 300;
const GRAPH_H = 300;
/** 图上最多画多少个对端节点（超出的只在数据区列出）。 */
const MAX_GRAPH_PEERS = 12;

/** 关系方向 → 图上的连线语义色。 */
const EDGE_COLOR: Record<string, string> = {
  out: 'var(--semi-color-primary)',
  in: 'var(--semi-color-success)',
};

export interface OntologyEvidencePanelProps {
  evidence: Evidence[];
}

/** 值 → 可读文本（对象/数组降级为紧凑 JSON）。 */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** 只保留有意义的属性（跳过 rid 类内部字段，它们单独展示）。 */
function propEntries(props: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(props ?? {}).filter(([k]) => k !== '__rid__' && k !== 'rid');
}

/**
 * 属性键 → 可读名。
 * getIndividual 返回的键是属性全 rid（`ont.<t>.prop.<class>-<name>.v1`），
 * 全量展示太啰嗦；取 slug 段并去掉类名前缀（`sopbench-dg-product-id` → `product-id`）。
 */
function shortPropKey(key: string, classSlug?: string): string {
  if (!key.startsWith('ont.')) return key;
  const slug = key.split('.').slice(-2)[0] ?? key;
  if (classSlug && slug.startsWith(`${classSlug}-`)) {
    return slug.slice(classSlug.length + 1);
  }
  return slug;
}

/** 从 class_rid 取 slug（`ont.t.obj.<slug>.v1` → `<slug>`）。 */
function classSlugOf(classRid?: string): string | undefined {
  if (!classRid || !classRid.startsWith('ont.')) return undefined;
  const parts = classRid.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

export default function OntologyEvidencePanel({ evidence }: OntologyEvidencePanelProps) {
  const objects = useMemo(
    () => evidence.filter((e) => e.type === 'ONTOLOGY_OBJECT' && e.objectId),
    [evidence],
  );
  const rids = useMemo(
    () => Array.from(new Set(objects.map((o) => o.objectId as string))),
    [objects],
  );

  const [focusRid, setFocusRid] = useState<string | null>(null);
  const [focal, setFocal] = useState<KernelIndividual | null>(null);
  const [groups, setGroups] = useState<SearchAroundGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 随证据变化重置焦点（避免沿用上一轮的 rid）
  useEffect(() => {
    setFocusRid(rids.length > 0 ? rids[0] : null);
  }, [rids]);

  useEffect(() => {
    if (!focusRid) {
      setFocal(null);
      setGroups([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getIndividual(focusRid), searchAround(focusRid, 50)])
      .then(([ind, gs]) => {
        if (cancelled) return;
        setFocal(ind);
        setGroups(gs ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '本体关系读取失败');
        setFocal(null);
        setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focusRid]);

  const graph = useMemo(() => {
    if (!focusRid) return null;
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;

    const peers: Array<{ rid: string; label: string; group: SearchAroundGroup }> = [];
    for (const g of groups) {
      for (const p of g.peers ?? []) {
        const rid = typeof p.__rid__ === 'string' ? p.__rid__ : '';
        if (!rid) continue;
        const labelKey = Object.keys(p).find((k) => k !== '__rid__');
        peers.push({
          rid,
          label: labelKey ? displayValue(p[labelKey]) : rid.split('.').pop() || rid,
          group: g,
        });
        if (peers.length >= MAX_GRAPH_PEERS) break;
      }
      if (peers.length >= MAX_GRAPH_PEERS) break;
    }

    const nodes: GraphNodeSpec[] = [
      {
        id: focusRid,
        label: focal?.primary_key || focusRid.split('.').pop() || focusRid,
        sublabel: focal?.class_rid,
        title: focusRid,
        x: cx,
        y: cy,
        w: 168,
        h: 58,
        color: 'var(--semi-color-primary)',
        solid: true,
      },
    ];
    const edges: GraphEdgeSpec[] = [];

    // 放射布局：对端均布在焦点周围
    const radius = Math.min(WORLD_W, WORLD_H) / 2 - 46;
    peers.forEach((peer, index) => {
      const angle = (2 * Math.PI * index) / Math.max(peers.length, 1) - Math.PI / 2;
      nodes.push({
        id: peer.rid,
        label: peer.label,
        sublabel: peer.group.link_display,
        title: peer.rid,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        w: 132,
        h: 46,
        color: EDGE_COLOR[peer.group.direction] ?? 'var(--semi-color-text-2)',
      });
      edges.push({
        id: `${focusRid}->${peer.rid}`,
        source: focusRid,
        target: peer.rid,
        label: peer.group.link_display,
        color: EDGE_COLOR[peer.group.direction] ?? 'var(--semi-color-text-2)',
        width: 1.5,
      });
    });

    return { nodes, edges, peerCount: peers.length };
  }, [focusRid, focal, groups]);

  if (rids.length === 0) return null;

  return (
    <div className="mp-onto-ev">
      {rids.length > 1 ? (
        <div className="mp-onto-ev-chips">
          <Text type="tertiary" className="mp-onto-ev-chips-label">焦点对象</Text>
          {rids.slice(0, 8).map((rid) => (
            <button
              key={rid}
              type="button"
              className={`mp-onto-ev-chip${rid === focusRid ? ' is-active' : ''}`}
              onClick={() => setFocusRid(rid)}
              title={rid}
            >
              {rid.split('.').pop()}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <div className="mp-onto-ev-error">{error}</div> : null}

      {graph ? (
        <>
          <div className="mp-onto-ev-pane">
            <div className="mp-onto-ev-pane-title">
              本体关系图
              <Text type="tertiary" className="mp-onto-ev-pane-sub">
                {loading ? '加载中…' : `${graph.peerCount} 个关联对象`}
              </Text>
            </div>
            <SemiGraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              worldWidth={WORLD_W}
              worldHeight={WORLD_H}
              height={GRAPH_H}
              autoFit
              showGrid
              onNodeClick={(id) => {
                if (id !== focusRid) setFocusRid(id);
              }}
            />
          </div>

          <div className="mp-onto-ev-pane">
            <div className="mp-onto-ev-pane-title">对象数据</div>
            <div className="mp-onto-ev-obj">
              <div className="mp-onto-ev-obj-head">
                <Text strong>{focal?.primary_key || focusRid}</Text>
                <Tag color="blue" type="light">{focal?.class_rid ?? '本体对象'}</Tag>
              </div>
              <code className="mp-onto-ev-rid">{focusRid}</code>
              <div className="mp-onto-ev-props">
                {propEntries(focal?.props ?? {}).map(([key, value]) => (
                  <div key={key} className="mp-onto-ev-prop">
                    <span className="mp-onto-ev-prop-key">
                      {shortPropKey(key, classSlugOf(focal?.class_rid))}
                    </span>
                    <span className="mp-onto-ev-prop-val">{displayValue(value)}</span>
                  </div>
                ))}
                {propEntries(focal?.props ?? {}).length === 0 ? (
                  <Text type="tertiary">（该对象无属性数据）</Text>
                ) : null}
              </div>
            </div>

            {groups.map((g) => (
              <div key={`${g.link_type_rid}-${g.direction}`} className="mp-onto-ev-group">
                <div className="mp-onto-ev-group-head">
                  <Tag color={g.direction === 'out' ? 'blue' : 'green'} type="light">
                    {g.direction === 'out' ? '出边' : '入边'}
                  </Tag>
                  <Text strong>{g.link_display}</Text>
                  <Text type="tertiary">{g.peers?.length ?? 0} 个</Text>
                </div>
                {(g.peers ?? []).slice(0, 10).map((p, i) => {
                  const rid = typeof p.__rid__ === 'string' ? p.__rid__ : `peer-${i}`;
                  const entries = propEntries(p);
                  return (
                    <div key={rid} className="mp-onto-ev-peer">
                      <code className="mp-onto-ev-rid">{rid}</code>
                      <div className="mp-onto-ev-props">
                        {entries.map(([key, value]) => (
                          <div key={key} className="mp-onto-ev-prop">
                            <span className="mp-onto-ev-prop-key">{key}</span>
                            <span className="mp-onto-ev-prop-val">{displayValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {!loading && groups.length === 0 ? (
              <Text type="tertiary">该对象当前没有一跳关联。</Text>
            ) : null}
          </div>
        </>
      ) : loading ? (
        <Text type="tertiary">正在读取本体关系…</Text>
      ) : null}
    </div>
  );
}
