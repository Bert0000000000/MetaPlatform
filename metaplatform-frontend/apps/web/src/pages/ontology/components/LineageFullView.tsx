import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  GitBranch, Database, Filter, Search, X, ZoomIn, ZoomOut,
  Maximize2, ChevronRight, ChevronDown, Layers, Share2, Box,
} from 'lucide-react';

// ============== 节点类型与数据 ==============
const NODE_TYPE_META = {
  source:    { label: '源系统',  color: '#06b6d4' },
  cdc:       { label: 'CDC 同步',  color: '#8b5cf6' },
  ods:       { label: '原始层',   color: '#10b981' },
  dwd:       { label: '明细层',   color: '#3b82f6' },
  dws:       { label: '汇总层',   color: '#f59e0b' },
  ads:       { label: '应用层',   color: '#ef4444' },
  metric:    { label: '指标',     color: '#a855f7' },
};


type LineageLayer = keyof typeof NODE_TYPE_META;
type LineageNode = {
  id: string;
  name: string;
  type: LineageLayer;
  layer: LineageLayer;
  system: string;
  rows: string;
};
type LineageEdge = { from: string; to: string; type: string };
type Position = { x: number; y: number };
type ForcePosition = Position & { vx: number; vy: number };
type PositionMap = Record<string, Position>;
type ForcePositionMap = Record<string, ForcePosition>;
const LAYER_ORDER: LineageLayer[] = ['source', 'cdc', 'ods', 'dwd', 'dws', 'ads', 'metric'];
const LAYER_LABEL: Record<LineageLayer, string> = {
  source: '源系统', cdc: 'CDC', ods: 'ODS', dwd: 'DWD', dws: 'DWS', ads: 'ADS', metric: '指标',
};

const NODES: LineageNode[] = [
  { id: 'src-mysql-orders',   name: 'MySQL.orders',     type: 'source',  layer: 'source', system: 'MySQL',     rows: '2.3M' },
  { id: 'src-mysql-users',    name: 'MySQL.users',      type: 'source',  layer: 'source', system: 'MySQL',     rows: '560K' },
  { id: 'src-pg-events',      name: 'PostgreSQL.events',type: 'source',  layer: 'source', system: 'PostgreSQL',rows: '8.9M' },
  { id: 'src-kafka-raw',      name: 'Kafka.raw_topic',  type: 'source',  layer: 'source', system: 'Kafka',     rows: '124M' },
  { id: 'src-api-partner',    name: 'REST API.partner', type: 'source',  layer: 'source', system: 'API',       rows: '12K' },
  { id: 'cdc-orders',         name: 'Hudi.orders_cdc',  type: 'cdc',     layer: 'cdc',    system: 'Hudi',      rows: '2.3M' },
  { id: 'cdc-events',         name: 'Hudi.events_cdc',  type: 'cdc',     layer: 'cdc',    system: 'Hudi',      rows: '8.9M' },
  { id: 'ods-orders',        name: 'Iceberg.ods.orders',   type: 'ods', layer: 'ods', system: 'Iceberg', rows: '2.3M' },
  { id: 'ods-events',        name: 'Iceberg.ods.events',   type: 'ods', layer: 'ods', system: 'Iceberg', rows: '8.9M' },
  { id: 'ods-users',         name: 'Iceberg.ods.users',    type: 'ods', layer: 'ods', system: 'Iceberg', rows: '560K' },
  { id: 'dwd-orders',        name: 'Iceberg.dwd.orders',   type: 'dwd', layer: 'dwd', system: 'Iceberg', rows: '2.3M' },
  { id: 'dwd-events',        name: 'Iceberg.dwd.events',   type: 'dwd', layer: 'dwd', system: 'Iceberg', rows: '8.9M' },
  { id: 'dwd-users',         name: 'Iceberg.dwd.users',    type: 'dwd', layer: 'dwd', system: 'Iceberg', rows: '560K' },
  { id: 'dws-orders-agg',    name: 'ClickHouse.dws.orders_agg', type: 'dws', layer: 'dws', system: 'ClickHouse', rows: '1.2M' },
  { id: 'dws-user-profile',  name: 'ClickHouse.dws.user_profile',type: 'dws',layer: 'dws', system: 'ClickHouse', rows: '560K' },
  { id: 'ads-daily-orders',  name: 'ClickHouse.ads.daily_orders', type: 'ads', layer: 'ads', system: 'ClickHouse', rows: '30K' },
  { id: 'ads-realtime',      name: 'Doris.ads.realtime_metrics',  type: 'ads', layer: 'ads', system: 'Doris',      rows: '10K' },
  { id: 'm-dau',             name: 'biz_dau',                type: 'metric', layer: 'metric', system: 'ClickHouse', rows: '-' },
  { id: 'm-revenue',         name: 'biz_revenue_daily',      type: 'metric', layer: 'metric', system: 'ClickHouse', rows: '-' },
  { id: 'm-conversion',       name: 'biz_conversion_rate',    type: 'metric', layer: 'metric', system: 'ClickHouse', rows: '-' },
];

const EDGES: LineageEdge[] = [
  { from: 'src-mysql-orders', to: 'cdc-orders',  type: 'binlog' },
  { from: 'src-pg-events',    to: 'cdc-events',  type: 'wal' },
  { from: 'cdc-orders',       to: 'ods-orders',  type: 'snapshot+binlog' },
  { from: 'cdc-events',       to: 'ods-events',  type: 'snapshot+binlog' },
  { from: 'src-mysql-users',  to: 'ods-users',   type: 'jdbc' },
  { from: 'src-kafka-raw',    to: 'ods-events',  type: 'kafka' },
  { from: 'src-api-partner',  to: 'ods-events',  type: 'rest' },
  { from: 'ods-orders',       to: 'dwd-orders',  type: 'sql' },
  { from: 'ods-events',       to: 'dwd-events',  type: 'sql' },
  { from: 'ods-users',        to: 'dwd-users',   type: 'sql' },
  { from: 'dwd-orders',       to: 'dws-orders-agg',   type: 'sql' },
  { from: 'dwd-events',       to: 'dws-orders-agg',   type: 'sql' },
  { from: 'dwd-users',        to: 'dws-user-profile', type: 'sql' },
  { from: 'dws-orders-agg',   to: 'ads-daily-orders',  type: 'sql' },
  { from: 'dws-user-profile', to: 'ads-realtime',      type: 'sql' },
  { from: 'ads-daily-orders', to: 'm-dau',         type: 'metric' },
  { from: 'ads-daily-orders', to: 'm-revenue',     type: 'metric' },
  { from: 'ads-realtime',     to: 'm-conversion',   type: 'metric' },
];

// ============== 力导向算法 (轻量自实现) ==============
// 物理参数
const FORCE_PARAMS = {
  repulsion: 4500,    // 同类电荷排斥
  springLen: 130,     // 弹簧自然长度
  springK: 0.04,      // 弹簧刚度
  centerK: 0.012,    // 中心引力
  damping: 0.85,       // 阻尼
  maxVel: 8,          // 速度上限
  iterations: 350,    // 迭代步数
};

function runForceLayout(nodes: LineageNode[], edges: LineageEdge[], width: number, height: number): PositionMap {
  if (nodes.length === 0) return {};
  // 初始化: 随机位置 (但分层) 避免初始重叠
  const pos: ForcePositionMap = {};
  const cx = width / 2;
  const cy = height / 2;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    pos[n.id] = {
      x: cx + Math.cos(angle) * (100 + Math.random() * 50),
      y: cy + Math.sin(angle) * (100 + Math.random() * 50),
      vx: 0,
      vy: 0,
    };
  });

  // 构建邻接表
  const adj: Record<string, string[]> = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(e => {
    if (adj[e.from] && adj[e.to]) {
      adj[e.from].push(e.to);
      adj[e.to].push(e.from);
    }
  });

  // 模拟迭代
  for (let iter = 0; iter < FORCE_PARAMS.iterations; iter++) {
    // 1. 排斥力 (Coulomb)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const pa = pos[a.id], pb = pos[b.id];
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const dist = Math.sqrt(dist2);
        const force = FORCE_PARAMS.repulsion / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pa.vx += fx; pa.vy += fy;
        pb.vx -= fx; pb.vy -= fy;
      }
    }
    // 2. 弹簧力 (Hooke)
    edges.forEach(e => {
      const pa = pos[e.from], pb = pos[e.to];
      if (!pa || !pb) return;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = (dist - FORCE_PARAMS.springLen) * FORCE_PARAMS.springK;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      pa.vx += fx; pa.vy += fy;
      pb.vx -= fx; pb.vy -= fy;
    });
    // 3. 中心引力
    nodes.forEach(n => {
      const p = pos[n.id];
      p.vx += (cx - p.x) * FORCE_PARAMS.centerK;
      p.vy += (cy - p.y) * FORCE_PARAMS.centerK;
    });
    // 4. 更新位置 (限速 + 阻尼)
    nodes.forEach(n => {
      const p = pos[n.id];
      let vx = p.vx * FORCE_PARAMS.damping;
      let vy = p.vy * FORCE_PARAMS.damping;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > FORCE_PARAMS.maxVel) {
        vx = vx / speed * FORCE_PARAMS.maxVel;
        vy = vy / speed * FORCE_PARAMS.maxVel;
      }
      p.x += vx; p.y += vy;
      p.vx = vx; p.vy = vy;
    });
  }
  return pos;
}

// ============== 主组件 ==============
export default function LineageFullView() {
  const [keyword, setKeyword] = useState('');
  const [filterLayer, setFilterLayer] = useState('all');
  const [filterSystem, setFilterSystem] = useState('all');
  const [viewMode, setViewMode] = useState('hierarchical'); // hierarchical | force
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    return NODES.filter(n => {
      if (keyword && !n.name.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (filterLayer !== 'all' && n.layer !== filterLayer) return false;
      if (filterSystem !== 'all' && n.system !== filterSystem) return false;
      return true;
    });
  }, [keyword, filterLayer, filterSystem]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() =>
    EDGES.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to)),
    [filteredNodeIds]
  );

  // 力导向布局 (仅 force 模式)
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(700);
  const forceLayout = useMemo(() => {
    if (viewMode !== 'force') return {};
    return runForceLayout(filteredNodes, filteredEdges, canvasWidth, canvasHeight);
  }, [viewMode, filteredNodes, filteredEdges, canvasWidth, canvasHeight]);

  // 分层视图节点按层分组
  const nodesByLayer = useMemo(() => {
    return LAYER_ORDER.map(layer => ({
      layer,
      nodes: filteredNodes.filter(n => n.layer === layer),
    })).filter(g => g.nodes.length > 0);
  }, [filteredNodes]);

  // 统计
  const totalNodes = NODES.length;
  const visibleNodes = filteredNodes.length;
  const totalEdges = EDGES.length;
  const visibleEdges = filteredEdges.length;
  const allSystems = useMemo(() => [...new Set(NODES.map(n => n.system))].sort(), []);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  // 拖拽
  const onMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (viewMode !== 'force') return;
    e.stopPropagation();
    setDragNode(nodeId);
    setIsDragging(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragNode) {
      setIsDragging(true);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setForcePos(prev => ({
        ...prev,
        [dragNode]: {
          x: prev[dragNode].x + (e.clientX - dragStart.x) / zoom,
          y: prev[dragNode].y + (e.clientY - dragStart.y) / zoom,
        },
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (e.buttons === 1) {
      // 平移
      setPan(prev => ({ x: prev.x + e.movementX / zoom, y: prev.y + e.movementY / zoom }));
    }
  };
  const onMouseUp = () => setDragNode(null);

  // 合并力布局 + 用户拖拽覆盖
  const [forcePos, setForcePos] = useState<PositionMap>({});
  const effectivePos = useMemo(() => {
    const merged: PositionMap = {};
    filteredNodes.forEach(n => {
      const base = forceLayout[n.id] || { x: 0, y: 0 };
      merged[n.id] = forcePos[n.id] || base;
    });
    return merged;
  }, [forceLayout, forcePos, filteredNodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* 工具栏 */}
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: 10, width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          <input
            placeholder="搜索节点名 (如 orders, users)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
          />
        </div>
        <select
          value={filterLayer}
          onChange={(e) => setFilterLayer(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
        >
          <option value="all">所有层级</option>
          {LAYER_ORDER.map(l => <option key={l} value={l}>{LAYER_LABEL[l]}</option>)}
        </select>
        <select
          value={filterSystem}
          onChange={(e) => setFilterSystem(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}
        >
          <option value="all">所有系统</option>
          {allSystems.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <button onClick={() => setViewMode(viewMode === 'force' ? 'hierarchical' : 'force')}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: viewMode === 'force' ? 'var(--primary)' : 'var(--background)', color: viewMode === 'force' ? 'var(--primary-foreground)' : 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
            title="切换视图模式"
          >
            {viewMode === 'force' ? <Layers style={{ width: 14, height: 14 }} /> : <Share2 style={{ width: 14, height: 14 }} />}
            {viewMode === 'force' ? '层级视图' : '力导向'}
          </button>
        </div>
        {viewMode === 'force' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
            <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="缩小">
              <ZoomOut style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2.5, zoom + 0.1))} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="放大">
              <ZoomIn style={{ width: 16, height: 16 }} />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setForcePos({}); }} style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} title="重置">
              <Maximize2 style={{ width: 16, height: 16 }} />
            </button>
          </div>
        )}
      </div>

      {/* 统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总节点', value: totalNodes, color: 'var(--foreground)' },
          { label: '可见节点', value: visibleNodes, color: '#3b82f6' },
          { label: '总边', value: totalEdges, color: 'var(--foreground)' },
          { label: '可见边', value: visibleEdges, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="v-card" style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 图谱主区域 */}
      {viewMode === 'force' ? (
        <ForceGraphView
          nodes={filteredNodes}
          edges={filteredEdges}
          positions={effectivePos}
          zoom={zoom}
          pan={pan}
          expanded={expanded}
          toggleExpand={toggleExpand}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          svgRef={svgRef}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          setCanvasSize={(w: number, h: number) => { setCanvasWidth(w); setCanvasHeight(h); }}
          onNodeDrag={onMouseDown}
          onSvgMouseMove={onMouseMove}
          onSvgMouseUp={onMouseUp}
        />
      ) : (
        <div className="v-card" style={{ padding: 16, overflow: 'auto', flex: 1, minHeight: 360 }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: '100%' }}>
            {nodesByLayer.map((group, layerIdx) => (
              <div key={group.layer} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
                    borderRadius: 4, background: NODE_TYPE_META[group.layer].color + '20',
                    color: NODE_TYPE_META[group.layer].color, fontSize: 11, fontWeight: 600,
                  }}>{LAYER_LABEL[group.layer]}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{group.nodes.length} 个节点</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {group.nodes.map(node => (
                    <NodeCard key={node.id} node={node} edges={filteredEdges.filter(e => e.from === node.id || e.to === node.id)}
                      expanded={expanded.has(node.id)} onToggle={(e) => toggleExpand(node.id, e)} />
                  ))}
                </div>
                {layerIdx < nodesByLayer.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0', color: 'var(--muted-foreground)', fontSize: 14 }}>↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 节点详情侧栏 */}
      {selectedNode && viewMode === 'force' && (
        <NodeDetailPanel
          node={selectedNode}
          edges={filteredEdges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* 图例 */}
      <div className="v-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{ color: 'var(--muted-foreground)' }}>图例:</span>
        {LAYER_ORDER.map(l => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: NODE_TYPE_META[l].color }} />
            {LAYER_LABEL[l]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)' }}>
          节点: {visibleNodes}/{totalNodes} | 边: {visibleEdges}/{totalEdges} | 视图: {viewMode === 'force' ? '力导向' : '层级'}
        </span>
      </div>
    </div>
  );
}

// ============== 力导向图组件 (SVG) ==============
type ForceGraphViewProps = {
  nodes: LineageNode[];
  edges: LineageEdge[];
  positions: PositionMap;
  zoom: number;
  pan: Position;
  expanded: Set<string>;
  toggleExpand: (id: string, event: React.MouseEvent) => void;
  selectedNode: LineageNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<LineageNode | null>>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (width: number, height: number) => void;
  onNodeDrag: (event: React.MouseEvent, nodeId: string) => void;
  onSvgMouseMove: (event: React.MouseEvent) => void;
  onSvgMouseUp: () => void;
};
function ForceGraphView({
  nodes, edges, positions, zoom, pan, expanded, toggleExpand, selectedNode, setSelectedNode,
  svgRef, canvasWidth, canvasHeight, setCanvasSize, onNodeDrag, onSvgMouseMove, onSvgMouseUp,
}: ForceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 测量容器尺寸
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasSize(e.contentRect.width, e.contentRect.height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [setCanvasSize]);

  // 计算边的路径
  const edgePaths = edges.map((e, i) => {
    const a = positions[e.from];
    const b = positions[e.to];
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 曲线控制点 (弧度)
    const cx1 = a.x + dx * 0.3;
    const cy1 = a.y + dy * 0.3 - 20;
    const cx2 = a.x + dx * 0.7;
    const cy2 = a.y + dy * 0.7 + 20;
    return {
      key: e.from + '-' + e.to + '-' + i,
      d: `M ${a.x} ${a.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${b.x} ${b.y}`,
      type: e.type,
    };
  });

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flex: 1, minHeight: 360, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}
      onMouseMove={onSvgMouseMove}
      onMouseUp={onSvgMouseUp}
      onMouseLeave={onSvgMouseUp}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${-pan.x} ${-pan.y} ${canvasWidth / zoom} ${canvasHeight / zoom}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: 'grab' }}
      >
        {/* 边 */}
        <g>
          {edgePaths.map(p => p && (
            <path key={p.key} d={p.d} stroke="var(--muted-foreground)" strokeOpacity="0.4" strokeWidth="1" fill="none" />
          ))}
        </g>
        {/* 箭头 (简化: 不画箭头头, 用颜色区分) */}
        {/* 节点 */}
        <g>
          {nodes.map(node => {
            const p = positions[node.id];
            if (!p) return null;
            const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.source;
            const isSelected = selectedNode?.id === node.id;
            const isExpanded = expanded.has(node.id);
            const degree = edges.filter(e => e.from === node.id || e.to === node.id).length;
            // 节点大小按度数
            const radius = Math.min(40, 20 + degree * 2);
            return (
              <g
                key={node.id}
                transform={`translate(${p.x}, ${p.y})`}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => onNodeDrag(e, node.id)}
                onClick={() => setSelectedNode(node)}
                onDoubleClick={(event) => toggleExpand(node.id, event)}
              >
                <circle r={radius} fill={meta.color} fillOpacity="0.15" stroke={meta.color} strokeWidth={isSelected ? 3 : 1.5} />
                <circle r="4" fill={meta.color} />
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 500, fill: 'var(--foreground)' }}
                >
                  {node.name}
                </text>
                <text
                  y={radius + 28}
                  textAnchor="middle"
                  style={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                >
                  {node.system} {node.rows !== '-' ? `· ${node.rows}` : ''}
                </text>
                {isExpanded && degree > 0 && (
                  <text y={-radius - 8} textAnchor="middle" style={{ fontSize: 9, fill: meta.color, fontWeight: 600 }}>
                    {degree} edges
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ============== 节点卡片 (层级视图) ==============
function NodeCard({ node, edges, expanded, onToggle }: { node: LineageNode; edges: LineageEdge[]; expanded: boolean; onToggle: React.MouseEventHandler<HTMLDivElement> }) {
  const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.source;
  const outEdges = edges.filter(e => e.from === node.id);
  const inEdges = edges.filter(e => e.to === node.id);
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
      padding: 10, cursor: 'pointer', transition: 'all 0.2s',
    }}
    onClick={onToggle}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        {expanded ? <ChevronDown style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} /> : <ChevronRight style={{ width: 12, height: 12, color: 'var(--muted-foreground)' }} />}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{node.system}</span>
        <span>{node.rows} 行</span>
      </div>
      {expanded && (outEdges.length + inEdges.length > 0) && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10 }}>
          {outEdges.length > 0 && <div style={{ color: 'var(--muted-foreground)' }}>出边 {outEdges.length}</div>}
          {inEdges.length > 0 && <div style={{ color: 'var(--muted-foreground)' }}>入边 {inEdges.length}</div>}
        </div>
      )}
    </div>
  );
}

// ============== 节点详情侧栏 ==============
function NodeDetailPanel({ node, edges, onClose }: { node: LineageNode; edges: LineageEdge[]; onClose: () => void }) {
  const outEdges = edges.filter(e => e.from === node.id);
  const inEdges = edges.filter(e => e.to === node.id);
  const meta = NODE_TYPE_META[node.type];
  return (
    <div className="v-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: meta.color }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{node.name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>({LAYER_LABEL[node.layer]})</span>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X style={{ width: 14, height: 14 }} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11, marginBottom: 12 }}>
        <div><div style={{ color: 'var(--muted-foreground)' }}>系统</div><div>{node.system}</div></div>
        <div><div style={{ color: 'var(--muted-foreground)' }}>行数</div><div>{node.rows}</div></div>
        <div><div style={{ color: 'var(--muted-foreground)' }}>层级</div><div>{LAYER_LABEL[node.layer]}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11 }}>
        <div>
          <div style={{ color: 'var(--muted-foreground)', marginBottom: 4 }}>出边 ({outEdges.length})</div>
          {outEdges.slice(0, 5).map((e, i) => {
            const target = NODES.find(n => n.id === e.to);
            return <div key={i} style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>→ {target?.name || e.to} ({e.type})</div>;
          })}
          {outEdges.length > 5 && <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>...+{outEdges.length - 5} more</div>}
        </div>
        <div>
          <div style={{ color: 'var(--muted-foreground)', marginBottom: 4 }}>入边 ({inEdges.length})</div>
          {inEdges.slice(0, 5).map((e, i) => {
            const source = NODES.find(n => n.id === e.from);
            return <div key={i} style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>← {source?.name || e.from} ({e.type})</div>;
          })}
          {inEdges.length > 5 && <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>...+{inEdges.length - 5} more</div>}
        </div>
      </div>
    </div>
  );
}
