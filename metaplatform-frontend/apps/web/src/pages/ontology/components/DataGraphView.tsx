// DataGraphView.tsx
// 数据图谱：基于 @antv/g6 v5 的数据血缘图谱可视化
// 沿用 UI 规范：v-card / v-btn / v-btn-ghost / v-btn-sm / v-input / lucide-react / CSS 变量
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Network, Search, X, ZoomIn, ZoomOut, Maximize2, Filter, Layers,
  Circle, Box, ChevronRight, ArrowRight,
  RefreshCw, Download, Eye, EyeOff,
} from 'lucide-react';
import { Toast } from '@douyinfe/semi-ui';
import { Graph } from '@antv/g6';
import { listBigDataSources, listCDCTasks, listDataProducts, deriveLineageGraph, type LineageGraphNode, type LineageGraphEdge } from '../../../api/ontology-bigdata';

// ============== 节点类型元数据 ==============
const NODE_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  source: { label: '源系统',  color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  cdc:    { label: 'CDC 同步', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  ods:    { label: '原始层',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  dwd:    { label: '明细层',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  dws:    { label: '汇总层',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ads:    { label: '应用层',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  metric: { label: '指标',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
};

const LAYER_ORDER: string[] = ['source', 'cdc', 'ods', 'dwd', 'dws', 'ads', 'metric'];
const LAYER_LABEL: Record<string, string> = {
  source: '源系统', cdc: 'CDC', ods: 'ODS', dwd: 'DWD', dws: 'DWS', ads: 'ADS', metric: '指标',
};

// ============== 节点/边类型（真实数据派生） ==============
type NodeRow = LineageGraphNode;
type EdgeRow = LineageGraphEdge;
type LayoutType = 'force' | 'dagre' | 'circular' | 'concentric';

const LAYOUT_OPTIONS: Record<LayoutType, { label: string; icon: any; desc: string }> = {
  force:      { label: '力导向', icon: Network, desc: '节点相互排斥、边相互吸引，自由布局' },
  dagre:      { label: '层次布局', icon: Layers, desc: '按数据流向自上而下分层展示' },
  circular:   { label: '环形布局', icon: Circle, desc: '节点呈环状均匀分布' },
  concentric: { label: '同心圆',   icon: Box,    desc: '按度数分层，中心为枢纽节点' },
};

// ============== 工具函数 ==============
function buildGraphData(nodes: NodeRow[], edges: EdgeRow[]) {
  return {
    nodes: nodes.map((n) => ({ id: n.id, data: { ...n } })),
    edges: edges.map((e, i) => ({ id: 'e' + i, source: e.source, target: e.target, data: { type: e.type } })),
  };
}

function getLayoutConfig(type: LayoutType): any {
  switch (type) {
    case 'force':
      return {
        type: 'force',
        preventOverlap: true,
        nodeSize: 48,
        linkDistance: 130,
        nodeStrength: -120,
        edgeStrength: 0.8,
        alphaDecay: 0.04,
        animate: false,
      };
    case 'dagre':
      return { type: 'dagre', rankdir: 'TB', nodesep: 30, ranksep: 80, animate: false };
    case 'circular':
      return { type: 'circular', animate: false };
    case 'concentric':
      return { type: 'concentric', nodeSize: 40, preventOverlap: true, animate: false };
    default:
      return { type: 'force', animate: false };
  }
}

function highlightConnected(graph: Graph | null, nodeId: string) {
  if (!graph) return;
  try {
    const allNodes: any[] = graph.getNodeData();
    const allEdges: any[] = graph.getEdgeData();
    const related = new Set<string>([nodeId]);
    allEdges.forEach((e: any) => {
      if (e.source === nodeId) related.add(e.target);
      if (e.target === nodeId) related.add(e.source);
    });
    allNodes.forEach((n: any) => {
      graph.setElementState(n.id, related.has(n.id) ? 'active' : 'inactive', false);
    });
    allEdges.forEach((e: any) => {
      const isRelated = e.source === nodeId || e.target === nodeId;
      graph.setElementState(e.id, isRelated ? 'active' : 'inactive', false);
    });
  } catch { /* noop */ }
}

function resetHighlight(graph: Graph | null) {
  if (!graph) return;
  try {
    const allNodes: any[] = graph.getNodeData();
    const allEdges: any[] = graph.getEdgeData();
    allNodes.forEach((n: any) => graph.setElementState(n.id, [], false));
    allEdges.forEach((e: any) => graph.setElementState(e.id, [], false));
  } catch { /* noop */ }
}

// ============== 主组件 ==============
export default function DataGraphView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const [keyword, setKeyword] = useState('');
  const [filterLayer, setFilterLayer] = useState('all');
  const [filterSystem, setFilterSystem] = useState('all');
  const [layoutType, setLayoutType] = useState<LayoutType>('force');
  const [selectedNode, setSelectedNode] = useState<NodeRow | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMinimap, setShowMinimap] = useState(true);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [edges, setEdges] = useState<LineageGraphEdge[]>([]);

  // 从真实数据平台控制面（数据源 + CDC + 数据产品）加载图谱
  const loadGraph = async () => {
    try {
      const [src, cdc, prd] = await Promise.all([listBigDataSources(), listCDCTasks(), listDataProducts()]);
      const g = deriveLineageGraph(src, cdc, prd);
      setNodes(g.nodes);
      setEdges(g.edges);
    } catch (e) {
      console.warn('数据图谱加载失败', e);
    }
  };
  useEffect(() => { loadGraph(); }, []);

  const allSystems = useMemo(
    () => [...new Set(nodes.map((n) => n.system))].sort(),
    [nodes]
  );

  const { filteredNodes, filteredEdges } = useMemo(() => {
    const nds = nodes.filter((n) => {
      if (keyword && !n.name.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (filterLayer !== 'all' && n.layer !== filterLayer) return false;
      if (filterSystem !== 'all' && n.system !== filterSystem) return false;
      return true;
    });
    const ids = new Set(nds.map((n) => n.id));
    const edgs = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { filteredNodes: nds, filteredEdges: edgs };
  }, [keyword, filterLayer, filterSystem, nodes, edges]);

  // ============== 初始化 G6 Graph ==============
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let disposed = false;

    const raf = requestAnimationFrame(() => {
      if (disposed || !container.isConnected) return;
      const initW = container.offsetWidth || container.clientWidth || 800;
      const initH = container.offsetHeight || container.clientHeight || 560;

      const graph = new Graph({
        container,
        width: initW,
        height: initH,
        autoResize: false,
        background: 'transparent',
        data: buildGraphData(nodes, edges),
        node: {
          type: 'circle',
          style: {
            size: 36,
            fill: (d: any) => NODE_TYPE_META[d.data?.type]?.color || '#06b6d4',
            fillOpacity: 0.85,
            stroke: (d: any) => NODE_TYPE_META[d.data?.type]?.color || '#06b6d4',
            strokeOpacity: 0.4,
            lineWidth: 2,
            labelText: (d: any) => d.data?.name || d.id,
            labelFill: '#fafafa',
            labelFontSize: 11,
            labelFontWeight: 500,
            labelFontFamily: 'Geist, sans-serif',
            labelPlacement: 'bottom',
            labelOffsetY: 8,
            labelBackground: false,
            cursor: 'pointer',
          },
        },
        edge: {
          type: 'line',
          style: {
            stroke: '#52525b',
            strokeOpacity: 0.5,
            lineWidth: 1.2,
            endArrow: true,
            endArrowSize: 8,
            endArrowFill: '#52525b',
            cursor: 'pointer',
          },
        },
        layout: getLayoutConfig('force'),
        behaviors: [
          'drag-canvas',
          'zoom-canvas',
          'drag-element',
          'click-select',
          'hover-activate',
        ],
        plugins: [
          {
            type: 'minimap',
            key: 'minimap',
            size: [180, 120],
            position: 'right-bottom',
            background: 'rgba(15,15,15,0.85)',
            viewportStyle: { fill: 'rgba(167,139,250,0.18)', stroke: '#a78bfa', lineWidth: 1 },
            nodeStyle: {
              fill: (d: any) => NODE_TYPE_META[d.data?.type]?.color || '#06b6d4',
              fillOpacity: 0.5,
              lineWidth: 0,
            },
          },
        ],
        animation: false,
      } as any);

      graphRef.current = graph;

      graph.render().then(() => {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              try { graph.setSize(width, height); } catch { /* noop */ }
            }
          }
        });
        ro.observe(container);
        (graph as any)._ro = ro;

        graph.on('node:click', (e: any) => {
          const id = e?.target?.id;
          const node = nodes.find((n) => n.id === id);
          if (node) {
            setSelectedNode(node);
            highlightConnected(graph, id);
          }
        });
        graph.on('canvas:click', () => {
          setSelectedNode(null);
          resetHighlight(graph);
        });
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      const g = graphRef.current;
      if (g) {
        try {
          const ro = (g as any)._ro;
          ro?.disconnect();
          g.destroy();
        } catch { /* noop */ }
      }
      graphRef.current = null;
    };
  }, []);

  // ============== 过滤变化时增量更新数据 ==============
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.setData(buildGraphData(filteredNodes, filteredEdges));
    g.render().catch((error) => { console.warn('[DataGraphView] render failed', error); Toast.warning('图谱渲染失败，请稍后重试'); });
    setSelectedNode(null);
  }, [filteredNodes, filteredEdges]);

  // ============== 布局切换 ==============
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    g.setLayout(getLayoutConfig(layoutType));
    g.render().catch((error) => { console.warn('[DataGraphView] render failed', error); Toast.warning('图谱渲染失败，请稍后重试'); });
  }, [layoutType]);

  // ============== 工具栏操作 ==============
  const handleZoomIn = () => {
    const g = graphRef.current;
    if (!g) return;
    g.zoomBy(1.2);
    setZoom((z) => Math.min(2.5, +(z * 1.2).toFixed(2)));
  };
  const handleZoomOut = () => {
    const g = graphRef.current;
    if (!g) return;
    g.zoomBy(1 / 1.2);
    setZoom((z) => Math.max(0.3, +(z / 1.2).toFixed(2)));
  };
  const handleFit = () => {
    const g = graphRef.current;
    if (!g) return;
    g.fitView({ when: 'always' } as any);
    setZoom(1);
  };
  const handleRefresh = () => {
    loadGraph();
    setKeyword('');
    setFilterLayer('all');
    setFilterSystem('all');
    setSelectedNode(null);
  };
  const handleExport = () => {
    const g = graphRef.current;
    if (!g) return;
    const data = g.getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lineage-graph-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalNodes = nodes.length;
  const visibleNodes = filteredNodes.length;
  const totalEdges = edges.length;
  const visibleEdges = filteredEdges.length;

  const inEdges = selectedNode ? filteredEdges.filter((e) => e.target === selectedNode.id) : [];
  const outEdges = selectedNode ? filteredEdges.filter((e) => e.source === selectedNode.id) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: 10, width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          <input
            placeholder="搜索节点名 (如 orders, users)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, height: 36 }}
          />
        </div>
        <select
          value={filterLayer}
          onChange={(e) => setFilterLayer(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, height: 36 }}
        >
          <option value="all">所有层级</option>
          {LAYER_ORDER.map((l) => (
            <option key={l} value={l}>{LAYER_LABEL[l]}</option>
          ))}
        </select>
        <select
          value={filterSystem}
          onChange={(e) => setFilterSystem(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, height: 36 }}
        >
          <option value="all">所有系统</option>
          {allSystems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          {(Object.keys(LAYOUT_OPTIONS) as LayoutType[]).map((key) => {
            const opt = LAYOUT_OPTIONS[key];
            const Icon = opt.icon;
            const isActive = layoutType === key;
            return (
              <button
                key={key}
                onClick={() => setLayoutType(key)}
                title={opt.desc}
                style={{
                  padding: '6px 10px',
                  border: '1px solid ' + (isActive ? 'var(--border)' : 'transparent'),
                  borderRadius: 6,
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500,
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <button onClick={handleZoomOut} title="缩小" style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <ZoomOut style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={handleZoomIn} title="放大" style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <ZoomIn style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={handleFit} title="适应画布" style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <Maximize2 style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <button onClick={() => setShowMinimap((v) => !v)} title="小地图" style={{ padding: 6, background: 'transparent', border: 'none', color: showMinimap ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer' }}>
            {showMinimap ? <Eye style={{ width: 16, height: 16 }} /> : <EyeOff style={{ width: 16, height: 16 }} />}
          </button>
          <button onClick={handleRefresh} title="重置" style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <RefreshCw style={{ width: 16, height: 16 }} />
          </button>
          <button onClick={handleExport} title="导出" style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <Download style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总节点', value: totalNodes, color: 'var(--foreground)' },
          { label: '可见节点', value: visibleNodes, color: '#3b82f6' },
          { label: '总边', value: totalEdges, color: 'var(--foreground)' },
          { label: '可见边', value: visibleEdges, color: '#10b981' },
        ].map((s) => (
          <div key={s.label} className="v-card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.04 + 'em' as any }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 320px' : '1fr', gap: 12, flex: 1, minHeight: 360 }}>
        <div
          ref={containerRef}
          className="v-card"
          style={{ position: 'relative', padding: 0, overflow: 'hidden', minHeight: 360, background: 'var(--background)' }}
        />
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            inEdges={inEdges}
            outEdges={outEdges}
            nodes={nodes}
            onClose={() => { setSelectedNode(null); resetHighlight(graphRef.current); }}
          />
        )}
      </div>

      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{ color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Filter style={{ width: 12, height: 12 }} />图例
        </span>
        {LAYER_ORDER.map((l) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: NODE_TYPE_META[l].color }} />
            {LAYER_LABEL[l]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
          布局: {LAYOUT_OPTIONS[layoutType].label} · 节点 {visibleNodes}/{totalNodes} · 边 {visibleEdges}/{totalEdges}
        </span>
      </div>
    </div>
  );
}

// ============== 节点详情侧栏 ==============
function NodeDetailPanel({ node, inEdges, outEdges, nodes, onClose }: { node: NodeRow; inEdges: EdgeRow[]; outEdges: EdgeRow[]; nodes: NodeRow[]; onClose: () => void }) {
  const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.source;
  return (
    <div className="v-card" style={{ padding: 16, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: meta.color }} />
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 600 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>{node.name}</div>
        </div>
        <button onClick={onClose} style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11, marginBottom: 12 }}>
        <Field label="系统">{node.system}</Field>
        <Field label="层级">{LAYER_LABEL[node.layer]}</Field>
        <Field label="行数">{node.rows}</Field>
        <Field label="度">{inEdges.length + outEdges.length}</Field>
      </div>

      {outEdges.length > 0 && (
        <DetailEdgeList title="下游" icon={<ArrowRight style={{ width: 12, height: 12 }} />} edges={outEdges} direction="out" nodes={nodes} />
      )}
      {inEdges.length > 0 && (
        <DetailEdgeList title="上游" icon={<ChevronRight style={{ width: 12, height: 12, transform: 'rotate(180deg)' }} />} edges={inEdges} direction="in" nodes={nodes} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: 'var(--muted-foreground)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.05 + 'em' as any }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--foreground)' }}>{children}</div>
    </div>
  );
}

function DetailEdgeList({ title, icon, edges, direction, nodes }: { title: string; icon: React.ReactNode; edges: EdgeRow[]; direction: 'in' | 'out'; nodes: NodeRow[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 6 }}>
        {icon} {title} ({edges.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
        {edges.slice(0, 8).map((e, i) => {
          const otherId = direction === 'out' ? e.target : e.source;
          const other = nodes.find((n) => n.id === otherId);
          if (!other) return null;
          const otherMeta = NODE_TYPE_META[other.type] || NODE_TYPE_META.source;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--muted)', borderRadius: 4, fontSize: 11 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: otherMeta.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.name}</span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>{e.type}</span>
            </div>
          );
        })}
        {edges.length > 8 && (
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: 4 }}>...+{edges.length - 8} more</div>
        )}
      </div>
    </div>
  );
}
