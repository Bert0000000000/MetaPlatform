// DataGraphView.tsx
// 数据血缘图谱：Semi DOM 渲染（原 canvas 图谱版本已移除）
// 渲染架构（三层）：
//   画布容器（relative + overflow hidden）
//     → 滚动层（absolute inset 0 + overflow auto，滚轮/拖拽平移）
//       → scaled-viewport（width/height × zoom）
//         → world 层（transform: scale(zoom), transform-origin: 0 0）
//           → SVG 边层（z-index 0：贝塞尔曲线 path + marker 方向箭头，上游→下游）
//           → DOM 节点层（z-index 1：Semi Card = 表名 + Tag 层级徽标 + Tooltip 元数据，left/top 由布局算出）
// 布局：
//   dagre（主力）：@dagrejs/dagre 分层布局，同层节点同 rank——dagre 无硬 rank 约束，
//   通过「不可见链边」（相邻非空层节点与层代表两两相连）按 LAYER_ORDER 强制层级顺序；
//   circular：环形坐标公式；concentric：按度数同心圆；force：降级为 dagre。
// 缩放：CSS transform scale（0.3x–2.5x），fit = min(vw/gw, vh/gh)。
// 主题：颜色全部使用 var(--semi-color-*)/var(--background)/var(--card)/var(--border)/var(--muted-foreground)
//       或 NODE_TYPE_META 已有色值，无硬编码深色 monochrome 值。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Network, Search, X, ZoomIn, ZoomOut, Maximize2, Filter, Layers,
  Circle, Box, ChevronRight, ArrowRight,
  RefreshCw, Download, Eye, EyeOff,
} from 'lucide-react';
import { Card, Tag, Tooltip, Button, Empty, Spin } from '@douyinfe/semi-ui';
import dagre from '@dagrejs/dagre';
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
  force:      { label: '力导向', icon: Network, desc: '原 G6 力导向已简化：等价于层次布局' },
  dagre:      { label: '层次布局', icon: Layers, desc: '按数据流向自上而下分层展示（dagre）' },
  circular:   { label: '环形布局', icon: Circle, desc: '节点呈环状均匀分布' },
  concentric: { label: '同心圆',   icon: Box,    desc: '按度数分层，中心为枢纽节点' },
};

// ============== 布局 ==============
const NODE_W = 230;
const NODE_H = 40;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

type Position = { x: number; y: number };
type LayoutResult = { positions: Map<string, Position>; width: number; height: number };

const EMPTY_LAYOUT: LayoutResult = { positions: new Map(), width: 320, height: 320 };

/**
 * dagre 分层布局。dagre 无硬 rank 约束（minRank/maxRank 仅用于复合图嵌套），
 * 用「不可见链边」强制同层同 rank：对每对相邻非空层 (Lk, Lk+1)，
 *   ① Lk 每个节点 → Lk+1 代表节点（推代表下行）
 *   ② Lk 代表节点 → Lk+1 每个节点（推层内全部下行）
 * 由此 rank(Lk 全部节点) = k（层序严格、同层同 rank，空层自动压缩）。
 */
function computeDagreLayout(nodes: NodeRow[], edges: EdgeRow[]): LayoutResult {
  if (nodes.length === 0) return EMPTY_LAYOUT;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70, edgesep: 24, marginx: 32, marginy: 32 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.source, e.target)) {
      g.setEdge(e.source, e.target);
    }
  }
  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const k = Math.max(0, LAYER_ORDER.indexOf(n.layer));
    const arr = byLayer.get(k);
    if (arr) arr.push(n.id);
    else byLayer.set(k, [n.id]);
  }
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  for (let i = 0; i < layerKeys.length - 1; i++) {
    const cur = byLayer.get(layerKeys[i])!;
    const next = byLayer.get(layerKeys[i + 1])!;
    const repCur = cur[0];
    const repNext = next[0];
    for (const u of cur) if (!g.hasEdge(u, repNext)) g.setEdge(u, repNext, { style: 'invis', weight: 0 });
    for (const v of next) if (!g.hasEdge(repCur, v)) g.setEdge(repCur, v, { style: 'invis', weight: 0 });
  }
  dagre.layout(g);
  const positions = new Map<string, Position>();
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    const lbl = g.node(n.id) as { x: number; y: number };
    positions.set(n.id, { x: lbl.x, y: lbl.y });
    maxX = Math.max(maxX, lbl.x + NODE_W / 2);
    maxY = Math.max(maxY, lbl.y + NODE_H / 2);
  }
  return { positions, width: Math.ceil(maxX) + 24, height: Math.ceil(maxY) + 24 };
}

/** 环形布局：按节点序均布在圆周上。 */
function computeCircularLayout(nodes: NodeRow[]): LayoutResult {
  if (nodes.length === 0) return EMPTY_LAYOUT;
  const n = nodes.length;
  const radius = Math.max(180, (n * (NODE_W + 40)) / (2 * Math.PI));
  const cx = radius + NODE_W / 2 + 32;
  const cy = radius + NODE_H / 2 + 32;
  const positions = new Map<string, Position>();
  nodes.forEach((nd, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    positions.set(nd.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  });
  return { positions, width: Math.ceil(cx * 2), height: Math.ceil(cy * 2) };
}

/** 同心圆布局：按度数降序，度数高的在中心环。 */
function computeConcentricLayout(nodes: NodeRow[], edges: EdgeRow[]): LayoutResult {
  if (nodes.length === 0) return EMPTY_LAYOUT;
  const degree = new Map<string, number>();
  for (const nd of nodes) degree.set(nd.id, 0);
  for (const e of edges) {
    if (degree.has(e.source)) degree.set(e.source, degree.get(e.source)! + 1);
    if (degree.has(e.target)) degree.set(e.target, degree.get(e.target)! + 1);
  }
  const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const perRing = 10;
  const ringCount = Math.max(1, Math.ceil(sorted.length / perRing));
  const ringGap = 110;
  const baseR = 120;
  const maxR = baseR + (ringCount - 1) * ringGap;
  const cx = maxR + NODE_W / 2 + 32;
  const cy = maxR + NODE_H / 2 + 32;
  const positions = new Map<string, Position>();
  sorted.forEach((nd, i) => {
    const ring = Math.floor(i / perRing);
    const countInRing = Math.min(perRing, sorted.length - ring * perRing);
    const r = baseR + ring * ringGap;
    const angle = ((i % perRing) / countInRing) * Math.PI * 2;
    positions.set(nd.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });
  return { positions, width: Math.ceil(cx * 2), height: Math.ceil(cy * 2) };
}

function computeLayout(type: LayoutType, nodes: NodeRow[], edges: EdgeRow[]): LayoutResult {
  switch (type) {
    case 'circular': return computeCircularLayout(nodes);
    case 'concentric': return computeConcentricLayout(nodes, edges);
    case 'force': // 力导向降级为 dagre（G6 移除后的简化实现）
    case 'dagre':
    default: return computeDagreLayout(nodes, edges);
  }
}

/** 上游（源节点底部中心）→ 下游（目标节点顶部中心）三次贝塞尔曲线。 */
function buildEdgePath(src: Position, dst: Position): string {
  const sx = src.x;
  const sy = src.y + NODE_H / 2;
  const tx = dst.x;
  const ty = dst.y - NODE_H / 2;
  const dy = ty - sy;
  if (dy > 4) {
    const k = Math.max(36, dy * 0.5);
    return `M ${sx} ${sy} C ${sx} ${sy + k}, ${tx} ${ty - k}, ${tx} ${ty}`;
  }
  // 同层/回退边：横向 S 曲线
  const dx = tx - sx;
  return `M ${sx} ${sy} C ${sx + dx * 0.5} ${sy}, ${tx - dx * 0.5} ${ty}, ${tx} ${ty}`;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

// ============== 主组件 ==============
export default function DataGraphView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean } | null>(null);
  const wasDragRef = useRef(false);
  const scrollRafRef = useRef(0);

  const [keyword, setKeyword] = useState('');
  const [filterLayer, setFilterLayer] = useState('all');
  const [filterSystem, setFilterSystem] = useState('all');
  const [layoutType, setLayoutType] = useState<LayoutType>('dagre');
  const [selectedNode, setSelectedNode] = useState<NodeRow | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMinimap, setShowMinimap] = useState(true);
  const [panning, setPanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrollInfo, setScrollInfo] = useState({ left: 0, top: 0, vw: 0, vh: 0 });
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [edges, setEdges] = useState<LineageGraphEdge[]>([]);

  // 从真实数据平台控制面（数据源 + CDC + 数据产品）加载图谱
  const loadGraph = async () => {
    setLoading(true);
    try {
      const [src, cdc, prd] = await Promise.all([listBigDataSources(), listCDCTasks(), listDataProducts()]);
      const g = deriveLineageGraph(src, cdc, prd);
      setNodes(g.nodes);
      setEdges(g.edges);
    } catch (e) {
      console.warn('数据图谱加载失败', e);
    } finally {
      setLoading(false);
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

  // ============== 布局计算 ==============
  const layout = useMemo(
    () => computeLayout(layoutType, filteredNodes, filteredEdges),
    [layoutType, filteredNodes, filteredEdges]
  );

  // ============== 高亮（hover 优先于选中，G6 hover-activate 等价） ==============
  const focusId = hoverId ?? selectedNode?.id ?? null;
  const { relatedNodeIds, relatedEdgeKeys } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIdx = new Set<number>();
    if (focusId) {
      nodeIds.add(focusId);
      filteredEdges.forEach((e, i) => {
        if (e.source === focusId) { nodeIds.add(e.target); edgeIdx.add(i); }
        if (e.target === focusId) { nodeIds.add(e.source); edgeIdx.add(i); }
      });
    }
    return { relatedNodeIds: nodeIds, relatedEdgeKeys: edgeIdx };
  }, [focusId, filteredEdges]);

  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const nd of filteredNodes) m.set(nd.id, 0);
    for (const e of filteredEdges) {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    }
    return m;
  }, [filteredNodes, filteredEdges]);

  // 过滤后选中/hover 节点可能已被移除
  useEffect(() => {
    if (selectedNode && !filteredNodes.some((n) => n.id === selectedNode.id)) setSelectedNode(null);
    if (hoverId && !filteredNodes.some((n) => n.id === hoverId)) setHoverId(null);
  }, [filteredNodes, selectedNode, hoverId]);

  // 布局切换后回到左上角
  useEffect(() => {
    const el = containerRef.current;
    if (el) { el.scrollLeft = 0; el.scrollTop = 0; }
  }, [layoutType]);

  // ============== 缩放（CSS transform scale） ==============
  const zoomTo = useCallback((nextRaw: number) => {
    const next = clampZoom(nextRaw);
    const el = containerRef.current;
    const prev = zoomRef.current;
    if (el && prev !== next) {
      // 以视口中心为锚点缩放，保持中心内容不漂移
      const cx = (el.scrollLeft + el.clientWidth / 2) / prev;
      const cy = (el.scrollTop + el.clientHeight / 2) / prev;
      zoomRef.current = next;
      setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = cx * next - el.clientWidth / 2;
        el.scrollTop = cy * next - el.clientHeight / 2;
      });
    } else {
      zoomRef.current = next;
      setZoom(next);
    }
  }, []);

  const handleZoomIn = () => zoomTo(zoomRef.current * 1.2);
  const handleZoomOut = () => zoomTo(zoomRef.current / 1.2);
  const handleFit = () => {
    const el = containerRef.current;
    if (!el) return;
    const fit = clampZoom(Math.min(el.clientWidth / layout.width, el.clientHeight / layout.height));
    zoomTo(Math.min(fit, 1));
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (layout.width * zoomRef.current - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (layout.height * zoomRef.current - el.clientHeight) / 2);
    });
  };

  // ============== 拖拽平移（drag-canvas 等价） ==============
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-id]')) return; // 节点交互不触发平移
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, moved: false };
    setPanning(true);
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    const el = containerRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) {
      el.scrollLeft = d.scrollLeft - dx;
      el.scrollTop = d.scrollTop - dy;
    }
  };
  const onCanvasMouseUp = () => {
    wasDragRef.current = dragRef.current?.moved ?? false;
    dragRef.current = null;
    setPanning(false);
  };
  const onCanvasClick = () => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    setSelectedNode(null); // canvas:click 等价：取消选中
  };

  const syncScrollInfo = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = containerRef.current;
      if (el) setScrollInfo({ left: el.scrollLeft, top: el.scrollTop, vw: el.clientWidth, vh: el.clientHeight });
    });
  }, []);
  useEffect(() => syncScrollInfo(), [layout, syncScrollInfo]);
  useEffect(() => () => cancelAnimationFrame(scrollRafRef.current), []);

  const handleNodeClick = (n: NodeRow) => setSelectedNode(n);
  const handleRefresh = () => {
    loadGraph();
    setKeyword('');
    setFilterLayer('all');
    setFilterSystem('all');
    setSelectedNode(null);
    setHoverId(null);
  };
  const handleExport = () => {
    const data = { nodes: filteredNodes, edges: filteredEdges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lineage-graph-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============== 小地图（G6 minimap 等价，DOM 简化实现） ==============
  const MINIMAP_W = 180;
  const MINIMAP_H = 120;
  const mmScale = Math.min((MINIMAP_W - 8) / layout.width, (MINIMAP_H - 8) / layout.height);
  const viewportWorldW = scrollInfo.vw > 0 ? Math.min(scrollInfo.vw / zoom, layout.width) : 0;
  const viewportWorldH = scrollInfo.vh > 0 ? Math.min(scrollInfo.vh / zoom, layout.height) : 0;
  const viewportWorldL = Math.min(Math.max(scrollInfo.left / zoom, 0), layout.width - viewportWorldW);
  const viewportWorldT = Math.min(Math.max(scrollInfo.top / zoom, 0), layout.height - viewportWorldH);
  const onMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - rect.left - 4) / mmScale;
    const wy = (e.clientY - rect.top - 4) / mmScale;
    el.scrollLeft = Math.max(0, wx * zoom - el.clientWidth / 2);
    el.scrollTop = Math.max(0, wy * zoom - el.clientHeight / 2);
  };

  const totalNodes = nodes.length;
  const visibleNodes = filteredNodes.length;
  const totalEdges = edges.length;
  const visibleEdges = filteredEdges.length;

  const inEdges = selectedNode ? filteredEdges.filter((e) => e.target === selectedNode.id) : [];
  const outEdges = selectedNode ? filteredEdges.filter((e) => e.source === selectedNode.id) : [];

  const isEmpty = !loading && filteredNodes.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <style>{`
        .dg-node-card { border: 1px solid var(--border); background: var(--card); transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .dg-node-card:hover { border-color: var(--lineage-accent, var(--semi-color-primary)); }
        .dg-node-card.dg-node-selected { border-color: var(--lineage-accent, var(--semi-color-primary)); box-shadow: 0 0 0 2px var(--lineage-accent-soft, var(--semi-color-primary-light-default)); }
      `}</style>

      <Card style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
              <Button
                key={key}
                size="small"
                theme={isActive ? 'solid' : 'borderless'}
                type={isActive ? 'primary' : 'tertiary'}
                icon={<Icon style={{ width: 14, height: 14 }} />}
                onClick={() => setLayoutType(key)}
                title={opt.desc}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <Button size="small" theme="borderless" type="tertiary" icon={<ZoomOut style={{ width: 16, height: 16 }} />} onClick={handleZoomOut} title="缩小" />
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <Button size="small" theme="borderless" type="tertiary" icon={<ZoomIn style={{ width: 16, height: 16 }} />} onClick={handleZoomIn} title="放大" />
          <Button size="small" theme="borderless" type="tertiary" icon={<Maximize2 style={{ width: 16, height: 16 }} />} onClick={handleFit} title="适应画布" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <Button
            size="small"
            theme="borderless"
            type={showMinimap ? 'primary' : 'tertiary'}
            icon={showMinimap ? <Eye style={{ width: 16, height: 16 }} /> : <EyeOff style={{ width: 16, height: 16 }} />}
            onClick={() => setShowMinimap((v) => !v)}
            title="小地图"
          />
          <Button size="small" theme="borderless" type="tertiary" icon={<RefreshCw style={{ width: 16, height: 16 }} />} onClick={handleRefresh} title="重置" />
          <Button size="small" theme="borderless" type="tertiary" icon={<Download style={{ width: 16, height: 16 }} />} onClick={handleExport} title="导出" />
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总节点', value: totalNodes, color: 'var(--foreground)' },
          { label: '可见节点', value: visibleNodes, color: '#3b82f6' },
          { label: '总边', value: totalEdges, color: 'var(--foreground)' },
          { label: '可见边', value: visibleEdges, color: '#10b981' },
        ].map((s) => (
          <Card key={s.label} style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.04 + 'em' as any }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 320px' : '1fr', gap: 12, flex: 1, minHeight: 360 }}>
        {/* ============== 画布容器（relative + overflow hidden） ============== */}
        <div style={{ position: 'relative', overflow: 'hidden', minHeight: 360, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 6 }}>
          {/* 滚动层（overflow auto：滚轮 + 拖拽平移） */}
          <div
            ref={containerRef}
            style={{ position: 'absolute', inset: 0, overflow: 'auto', cursor: panning ? 'grabbing' : 'default', userSelect: panning ? 'none' : 'auto' }}
            onScroll={syncScrollInfo}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onClick={onCanvasClick}
          >
            {/* scaled-viewport：占位真实缩放后的尺寸，保证滚动条正确 */}
            <div style={{ position: 'relative', width: layout.width * zoom, height: layout.height * zoom }}>
              {/* world 层：transform scale 实现缩放 */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                {/* SVG 边层（z-index 0）：贝塞尔曲线 + marker 箭头，上游→下游 */}
                <svg width={layout.width} height={layout.height} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0, pointerEvents: 'none', overflow: 'visible' }}>
                  <defs>
                    <marker id="dg-arrow-default" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--border)' }} />
                    </marker>
                    <marker id="dg-arrow-active" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 9 4.5 L 0 9 Z" style={{ fill: 'var(--semi-color-primary)' }} />
                    </marker>
                  </defs>
                  {filteredEdges.map((e, i) => {
                    const s = layout.positions.get(e.source);
                    const t = layout.positions.get(e.target);
                    if (!s || !t) return null;
                    const isRelated = focusId ? relatedEdgeKeys.has(i) : false;
                    const dimmed = focusId !== null && !isRelated;
                    return (
                      <path
                        key={i}
                        d={buildEdgePath(s, t)}
                        fill="none"
                        stroke={isRelated ? 'var(--semi-color-primary)' : 'var(--border)'}
                        strokeOpacity={dimmed ? 0.12 : isRelated ? 0.9 : 0.55}
                        strokeWidth={isRelated ? 2 : 1.4}
                        markerEnd={isRelated ? 'url(#dg-arrow-active)' : 'url(#dg-arrow-default)'}
                      />
                    );
                  })}
                </svg>
                {/* DOM 节点层（z-index 1）：Semi Card 节点 */}
                {filteredNodes.map((n) => {
                  const pos = layout.positions.get(n.id);
                  if (!pos) return null;
                  const meta = NODE_TYPE_META[n.type] || NODE_TYPE_META.source;
                  const isSelected = selectedNode?.id === n.id;
                  const dimmed = focusId !== null && !relatedNodeIds.has(n.id);
                  const accentStyle = {
                    '--lineage-accent': meta.color,
                    '--lineage-accent-soft': meta.bg,
                  } as React.CSSProperties;
                  return (
                    <div
                      key={n.id}
                      data-node-id={n.id}
                      style={{
                        position: 'absolute',
                        left: pos.x - NODE_W / 2,
                        top: pos.y - NODE_H / 2,
                        zIndex: isSelected ? 3 : 2,
                        opacity: dimmed ? 0.28 : 1,
                        transition: 'opacity 0.15s ease',
                        ...accentStyle,
                      }}
                    >
                      <Tooltip content={renderNodeTooltip(n, degreeMap.get(n.id) ?? 0)} position="top" mouseEnterDelay={0.25}>
                        <div
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); handleNodeClick(n); }}
                          onMouseEnter={() => setHoverId(n.id)}
                          onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                        >
                          <Card
                            bordered={false}
                            className={'dg-node-card' + (isSelected ? ' dg-node-selected' : '')}
                            title={<span style={{ display: 'block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600 }}>{n.name}</span>}
                            headerExtraContent={
                              <Tag style={{ background: meta.bg, color: meta.color, border: 'none', borderRadius: 9999, padding: '2px 8px', fontSize: 10, fontWeight: 600, lineHeight: '16px' }}>
                                {meta.label}
                              </Tag>
                            }
                            style={{ width: NODE_W, height: NODE_H, overflow: 'hidden' }}
                            headerStyle={{ padding: '8px 12px' }}
                            bodyStyle={{ display: 'none' }}
                          />
                        </div>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 加载态 / 空态覆盖层 */}
          {loading && filteredNodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
              <Spin size="large" />
            </div>
          )}
          {isEmpty && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
              <Empty description={nodes.length === 0 ? '暂无数据血缘数据' : '无匹配节点，请调整筛选条件'} />
            </div>
          )}

          {/* 小地图（G6 minimap 等价，DOM 简化实现） */}
          {showMinimap && !isEmpty && (
            <div
              onClick={onMinimapClick}
              title="点击定位视图"
              style={{
                position: 'absolute', right: 12, bottom: 12, width: MINIMAP_W, height: MINIMAP_H, zIndex: 10,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
                overflow: 'hidden', cursor: 'pointer', padding: 4, opacity: 0.92,
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {filteredNodes.map((n) => {
                  const pos = layout.positions.get(n.id);
                  if (!pos) return null;
                  const meta = NODE_TYPE_META[n.type] || NODE_TYPE_META.source;
                  return (
                    <span
                      key={n.id}
                      style={{
                        position: 'absolute',
                        left: pos.x * mmScale - 2,
                        top: pos.y * mmScale - 2,
                        width: 4, height: 4, borderRadius: 2,
                        background: meta.color,
                      }}
                    />
                  );
                })}
                {scrollInfo.vw > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: viewportWorldL * mmScale,
                      top: viewportWorldT * mmScale,
                      width: Math.max(6, viewportWorldW * mmScale),
                      height: Math.max(6, viewportWorldH * mmScale),
                      border: '1px solid var(--semi-color-primary)',
                      background: 'var(--semi-color-primary-light-default)',
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            inEdges={inEdges}
            outEdges={outEdges}
            nodes={nodes}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <Card style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
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
      </Card>
    </div>
  );
}

/** 节点 Tooltip：显示类型/层级/系统/行数/关联边元数据 */
function renderNodeTooltip(n: NodeRow, degree: number) {
  const meta = NODE_TYPE_META[n.type] || NODE_TYPE_META.source;
  const muted = 'var(--semi-color-text-2)';
  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, minWidth: 170 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{n.name}</div>
      <div><span style={{ color: muted }}>类型：</span>{meta.label}</div>
      <div><span style={{ color: muted }}>层级：</span>{LAYER_LABEL[n.layer] ?? n.layer}</div>
      <div><span style={{ color: muted }}>系统：</span>{n.system}</div>
      <div><span style={{ color: muted }}>行数：</span>{n.rows}</div>
      <div><span style={{ color: muted }}>关联边：</span>{degree}</div>
    </div>
  );
}

// ============== 节点详情侧栏 ==============
function NodeDetailPanel({ node, inEdges, outEdges, nodes, onClose }: { node: NodeRow; inEdges: EdgeRow[]; outEdges: EdgeRow[]; nodes: NodeRow[]; onClose: () => void }) {
  const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.source;
  return (
    <Card style={{ padding: 16, overflow: 'auto' }}>
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
    </Card>
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
