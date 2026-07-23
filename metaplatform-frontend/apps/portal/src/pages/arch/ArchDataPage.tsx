import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Graph } from '@antv/x6';
import {
  FolderTree, Database, ArrowRightLeft, Info, ShieldCheck, LayoutGrid,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const stats = [
  { label: '数据源', value: '12', sub: '已接入并纳管' },
  { label: '数据模型', value: '48', sub: '跨域数据实体' },
  { label: '同步任务', value: '15', sub: 'CDC + 批量 ETL' },
  { label: '数据质量', value: '94.2%', sub: '综合质量评分', valueColor: 'var(--success)' },
];

// MOCK
const treeGroups = [
  {
    label: '关系型数据库', icon: 'database',
    items: [
      { name: 'PostgreSQL 主库', status: 'on', active: true },
      { name: 'PostgreSQL 只读', status: 'on' },
      { name: 'MySQL 业务库', status: 'on' },
    ],
  },
  {
    label: 'NoSQL', icon: 'fork',
    items: [
      { name: 'Neo4j 5.x', status: 'on' },
      { name: 'Redis 7.4', status: 'on' },
      { name: 'Milvus 2.5', status: 'on' },
    ],
  },
  {
    label: '消息队列', icon: 'radio',
    items: [
      { name: 'Kafka 3.9', status: 'on' },
      { name: 'RabbitMQ 4.x', status: 'on' },
    ],
  },
  {
    label: '文件 / 对象', icon: 'archive',
    items: [
      { name: 'MinIO', status: 'on' },
      { name: 'Hudi 数据湖', status: 'warn' },
    ],
  },
  {
    label: '外部 API', icon: 'globe',
    items: [{ name: 'LLM Provider API', status: 'on' }],
  },
];

// MOCK
const qualityRows = [
  { name: 'PostgreSQL 主库', type: '关系型', complete: '99.2%', accurate: '98.7%', timely: '99.5%', score: '99.1%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Neo4j 5.x', type: '图数据库', complete: '96.8%', accurate: '95.3%', timely: '97.1%', score: '96.4%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Milvus 2.5', type: '向量库', complete: '94.1%', accurate: '92.8%', timely: '98.4%', score: '95.1%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Hudi 数据湖', type: '数据湖', complete: '91.6%', accurate: '93.2%', timely: '88.4%', score: '91.1%', scoreColor: 'var(--warning)', status: '关注', badge: 'warning', cBar: 'warning', aBar: 'success', tBar: 'warning' },
  { name: 'StarRocks 3.4', type: 'OLAP', complete: '97.5%', accurate: '96.1%', timely: '95.8%', score: '96.5%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Kafka 3.9', type: '消息队列', complete: '99.8%', accurate: '99.6%', timely: '99.9%', score: '99.8%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'Redis 7.4', type: '缓存', complete: '98.1%', accurate: '97.9%', timely: '99.2%', score: '98.4%', scoreColor: 'var(--success)', status: '优秀', badge: 'success', cBar: 'success', aBar: 'success', tBar: 'success' },
  { name: 'MinIO', type: '对象存储', complete: '89.3%', accurate: '91.7%', timely: '94.5%', score: '91.8%', scoreColor: 'var(--warning)', status: '关注', badge: 'warning', cBar: 'warning', aBar: 'warning', tBar: 'success' },
];

// MOCK: 数据流图节点 + 边
type FgKind = 'main' | 'branch';
const NODE_W = { main: 150, branch: 120 } as const;
const NODE_H = { main: 80, branch: 48 } as const;
const fgNodes: Array<{ id: string; name: string; sub?: string; tp?: string; kind: FgKind; muted?: boolean }> = [
  { id: 'src', name: '源系统', sub: '业务数据库 + 外部 API', kind: 'main' },
  { id: 'cdc', name: 'CDC', sub: 'Debezium + Flink', tp: '~12K events/s', kind: 'main' },
  { id: 'lake', name: '数据湖', sub: 'Hudi (CDC/upsert)', tp: '吞吐 2.1TB', kind: 'main' },
  { id: 'wh', name: '数据仓库', sub: 'StarRocks 3.4 OLAP', tp: '查询 <3s P99', kind: 'main' },
  { id: 'app', name: '应用层', sub: 'APP / TECH 服务消费', kind: 'main' },
  { id: 'doc', name: '文档', kind: 'branch' },
  { id: 'rag', name: 'TECH-RAG', kind: 'branch' },
  { id: 'milvus', name: 'Milvus 2.5', kind: 'branch', muted: true },
  { id: 'ont', name: '本体', kind: 'branch' },
  { id: 'ontsvc', name: 'TECH-ONT', kind: 'branch' },
];

const fgEdges: Array<{ id: string; from: string; to: string; branch?: 'vector' | 'graph' }> = [
  { id: 'e1', from: 'src', to: 'cdc' },
  { id: 'e2', from: 'cdc', to: 'lake' },
  { id: 'e3', from: 'lake', to: 'wh' },
  { id: 'e4', from: 'wh', to: 'app' },
  { id: 'e5', from: 'lake', to: 'doc', branch: 'vector' },
  { id: 'e6', from: 'lake', to: 'ont', branch: 'graph' },
  { id: 'e7', from: 'doc', to: 'rag', branch: 'vector' },
  { id: 'e8', from: 'rag', to: 'milvus', branch: 'vector' },
  { id: 'e9', from: 'ont', to: 'ontsvc', branch: 'graph' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchDataPage() {
  const location = useLocation();
  const [selectedDs, setSelectedDs] = useState('PostgreSQL 主库');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  selectedNodeRef.current = selectedNode;

  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<Graph | null>(null);

  // 选中节点 → 高亮相关联的边和节点
  const reachable = useMemo(() => {
    const fwd = new Map<string, string[]>();
    fgEdges.forEach((e) => {
      if (!fwd.has(e.from)) fwd.set(e.from, []);
      fwd.get(e.from)!.push(e.to);
    });
    if (!selectedNode) return { nodes: new Set<string>(), edges: new Set<string>() };
    const nodes = new Set<string>([selectedNode]);
    const edges = new Set<string>();
    const stack = [selectedNode];
    while (stack.length) {
      const cur = stack.pop()!;
      const next = fwd.get(cur) ?? [];
      next.forEach((t) => {
        const edgeId = fgEdges.find((e) => e.from === cur && e.to === t)?.id;
        if (edgeId && !edges.has(edgeId)) edges.add(edgeId);
        if (!nodes.has(t)) {
          nodes.add(t);
          stack.push(t);
        }
      });
    }
    return { nodes, edges };
  }, [selectedNode]);

  // 节点 / 边颜色
  const colorOf = (n: { kind: FgKind; muted?: boolean }) => {
    if (n.kind === 'branch') return { border: '#94a3b8', bg: '#1a1d24', text: '#e5e7eb' };
    return { border: '#60a5fa', bg: '#141824', text: '#60a5fa' };
  };

  // 手动布局：2 行 5 列填满容器，边线最短无交叉
  // main 行：src, cdc, lake, wh, app（列 0-4）
  // branch 行：milvus(0), rag(1), doc(2), ont(3), ontsvc(4)
  // 这样 lake(列2)→doc(列2) 垂直，lake(列2)→ont(列3) 仅 1 列斜线
  const branchColMap: Record<string, number> = {
    milvus: 0, rag: 1, doc: 2, ont: 3, ontsvc: 4,
  };
  const computeLayout = (w: number, h: number) => {
    const positions = new Map<string, { x: number; y: number }>();
    const colW = w / 5;
    // main 行贴顶，branch 行贴底，垂直铺满容器
    const mainY = 16;
    const branchY = h - NODE_H.branch - 16;
    const mainNodes = fgNodes.filter((n) => n.kind === 'main');
    fgNodes.forEach((n) => {
      if (n.kind === 'main') {
        const col = mainNodes.indexOf(n);
        positions.set(n.id, {
          x: col * colW + (colW - NODE_W.main) / 2,
          y: mainY,
        });
      } else {
        const col = branchColMap[n.id] ?? 0;
        positions.set(n.id, {
          x: col * colW + (colW - NODE_W.branch) / 2,
          y: branchY,
        });
      }
    });
    return positions;
  };

  const applyStyles = (graph: Graph) => {
    const sel = selectedNodeRef.current;
    const { nodes: activeNodes, edges: activeEdges } = sel
      ? { nodes: reachable.nodes, edges: reachable.edges }
      : { nodes: new Set<string>(), edges: new Set<string>() };

    fgNodes.forEach((n) => {
      const cell = graph.getCellById(n.id) as any;
      if (!cell) return;
      const colors = colorOf(n);
      const isSelected = sel === n.id;
      const isActive = !sel || activeNodes.has(n.id);

      if (isSelected) {
        cell.attr('body', { stroke: '#60a5fa', strokeWidth: 2, fill: '#141824' });
      } else if (isActive) {
        cell.attr('body', { stroke: colors.border, strokeWidth: 1.5, fill: colors.bg });
      } else {
        cell.attr('body', { stroke: 'var(--border)', strokeWidth: 1, fill: 'var(--card)' });
      }

      const textColor = isActive ? colors.text : 'var(--muted-foreground)';
      cell.attr('label/name', { text: n.name, fill: textColor, fontSize: n.kind === 'branch' ? 11 : 12, fontWeight: n.kind === 'branch' ? 500 : 600 });
      if (n.sub) cell.attr('label/sub', { text: n.sub, fill: isActive ? 'var(--muted-foreground)' : 'var(--muted-foreground)', fontSize: 10 });
      if (n.tp) cell.attr('label/tp', { text: n.tp, fill: 'var(--muted-foreground)', fontSize: 10 });
    });

    fgEdges.forEach((e) => {
      const cell = graph.getCellById(e.id) as any;
      if (!cell) return;
      const active = !sel || activeEdges.has(e.id);
      if (active) {
        let stroke = '#60a5fa';
        if (e.branch === 'vector') stroke = '#a78bfa';
        if (e.branch === 'graph') stroke = '#34d399';
        cell.attr('line/stroke', stroke);
        cell.attr('line/strokeWidth', 1.5);
        cell.attr('line/opacity', 0.9);
        cell.attr('line/strokeDasharray', 6);
        cell.attr('line/style', { animation: 'ad-edge-flow 1s linear infinite' });
      } else {
        cell.attr('line/stroke', 'var(--border)');
        cell.attr('line/strokeWidth', 1);
        cell.attr('line/opacity', 0.3);
        cell.attr('line/strokeDasharray', 0);
        cell.attr('line/style', { animation: 'none' });
      }
    });
  };

  // 初始化 X6 (X6 3.x)
  useEffect(() => {
    if (!graphRef.current) return;
    const container = graphRef.current;
    let graph: Graph | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    const init = () => {
      if (disposed || !container.isConnected) return;
      // 优先用 container 实际尺寸；若 flex 布局未完成则回退到父容器
      const parent = container.parentElement;
      const w = (container.offsetWidth || parent?.offsetWidth || 698);
      const h = (container.offsetHeight || parent?.offsetHeight || 520);
      graph = new Graph({
        container,
        width: w,
        height: h,
        autoResize: false,
        background: { color: 'transparent' },
        panning: { enabled: true, modifiers: [] },
        mousewheel: { enabled: true, zoomAtMousePosition: true, modifiers: [] },
        interacting: { nodeMovable: true, edgeMovable: false },
        connecting: { connector: 'normal' as any, router: 'normal' as any },
        highlighting: {},
      } as any);
      try { graph.resize(w, h); } catch {}
      graphInstanceRef.current = graph;

      // 手动布局：填满整个容器区域
      const layoutPositions = computeLayout(w, h);

      fgNodes.forEach((n) => {
        const colors = colorOf(n);
        const isBranch = n.kind === 'branch';
        const width = NODE_W[n.kind];
        const height = NODE_H[n.kind];
        const pos = layoutPositions.get(n.id) ?? { x: 0, y: 0 };

        graph!.addNode({
          id: n.id,
          shape: 'rect',
          x: pos.x,
          y: pos.y,
          width,
          height,
          data: { kind: n.kind, muted: n.muted },
          attrs: {
            body: {
              rx: isBranch ? 6 : 8,
              ry: isBranch ? 6 : 8,
              stroke: colors.border,
              strokeWidth: 1.5,
              fill: colors.bg,
            },
            label: {
              text: n.name,
              refX: 0.5,
              refY: isBranch ? 0.5 : 0.25,
              textAnchor: 'middle',
              textVerticalAnchor: 'middle',
              fontSize: isBranch ? 11 : 12,
              fontWeight: isBranch ? 500 : 600,
              fill: colors.text,
            },
            ...(n.sub && {
              sub: {
                text: n.sub,
                refX: 0.5,
                refY: 0.55,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              },
            }),
            ...(n.tp && {
              tp: {
                text: n.tp,
                refX: 0.5,
                refY: 0.78,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
                fontFamily: 'var(--font-mono)',
              },
            }),
          },
        });
      });

      fgEdges.forEach((e) => {
        let stroke = '#60a5fa';
        if (e.branch === 'vector') stroke = '#a78bfa';
        if (e.branch === 'graph') stroke = '#34d399';
        graph!.addEdge({
          id: e.id,
          source: e.from,
          target: e.to,
          shape: 'edge',
          attrs: {
            line: {
              stroke,
              strokeWidth: 1.5,
              targetMarker: null,
              strokeDasharray: 6,
              style: { animation: 'ad-edge-flow 1s linear infinite' },
            },
          },
        });
      });

      applyStyles(graph!);

      graph!.on('node:click', ({ node }: any) => {
        const id = node.id;
        setSelectedNode((prev) => (prev === id ? null : id));
      });

      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: nw, height: nh } = entry.contentRect;
          if (nw > 0 && nh > 0) {
            try {
              graph?.resize(nw, nh);
              // 容器尺寸变化时重新计算布局，填满新尺寸
              const newPositions = computeLayout(nw, nh);
              fgNodes.forEach((n) => {
                const cell = graph?.getCellById(n.id) as any;
                const pos = newPositions.get(n.id);
                if (cell && pos) cell.position(pos.x, pos.y);
              });
            } catch {}
          }
        }
      });
      ro.observe(container.parentElement || container);
    };

    const raf = requestAnimationFrame(init);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (graph) graph.dispose();
      graphInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const graph = graphInstanceRef.current;
    if (!graph) return;
    applyStyles(graph);
  }, [selectedNode]);

  const zoomIn = () => graphInstanceRef.current?.zoom(0.2);
  const zoomOut = () => graphInstanceRef.current?.zoom(-0.2);
  const resetView = () => {
    const graph = graphInstanceRef.current;
    if (!graph) return;
    graph.zoomToFit({ padding: 32, maxScale: 1 });
  };
  const relayout = () => {
    const graph = graphInstanceRef.current;
    if (!graph || !graphRef.current) return;
    const w = graphRef.current.offsetWidth || 698;
    const h = graphRef.current.offsetHeight || 520;
    const positions = computeLayout(w, h);
    fgNodes.forEach((n) => {
      const cell = graph.getCellById(n.id) as any;
      const pos = positions.get(n.id);
      if (cell && pos) cell.position(pos.x, pos.y);
    });
    graph.zoomToFit({ padding: 32, maxScale: 1 });
    applyStyles(graph);
  };

  return (
    <>
      <style>{`
        :root { --info:#60a5fa; --info-subtle:#141824; }
        .ad-page-header { margin-bottom:24px; }
        .ad-page-header h1 { font-size:22px; font-weight:700; margin-bottom:6px; }
        .ad-page-header p { font-size:14px; color:var(--muted-foreground); }
        .ad-v-card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .ad-v-card-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .ad-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .ad-stat-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
        .ad-stat-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; }
        .ad-stat-value { font-size:28px; font-weight:700; }
        .ad-stat-sub { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ad-data-layout { display:flex; gap:16px; margin-bottom:20px; align-items:stretch; height:520px; }
        .ad-tree-group { margin-bottom:16px; }
        .ad-tree-group:last-child { margin-bottom:0; }
        .ad-tree-group-label { font-size:11px; font-weight:500; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted-foreground); padding:8px 0 6px; display:flex; align-items:center; gap:6px; }
        .ad-tree-group-label svg { width:12px; height:12px; color:var(--muted-foreground); }
        .ad-tree-item { padding:7px 10px 7px 18px; border-radius:var(--radius); cursor:pointer; font-size:13px; color:var(--muted-foreground); border:1px solid transparent; transition:all .15s; display:flex; align-items:center; gap:8px; }
        .ad-tree-item:hover { background:var(--muted); color:var(--foreground); }
        .ad-tree-item.active { background:var(--muted); color:var(--foreground); border-color:var(--border); }
        .ad-tree-item .ds-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .ad-tree-item .ds-dot.on { background:var(--success); }
        .ad-tree-item .ds-dot.warn { background:var(--warning); }
        .ad-graph {
          background:var(--muted);
          border:1px solid var(--border);
          border-radius:var(--radius);
          position:relative;
          flex:1;
          min-height:340px;
          overflow:hidden;
        }
        .ad-graph-canvas { width:100%; height:100%; overflow:hidden; }
        .ad-graph-toolbar {
          position:absolute; top:12px; right:12px; z-index:10;
          display:flex; gap:6px;
        }
        .ad-graph-toolbar-btn {
          width:28px; height:28px;
          display:inline-flex; align-items:center; justify-content:center;
          background:var(--card); border:1px solid var(--border);
          border-radius:4px; color:var(--muted-foreground);
          cursor:pointer; transition:all .15s;
          font-size:12px;
        }
        .ad-graph-toolbar-btn:hover { color:var(--foreground); border-color:var(--muted-foreground); }
        .ad-graph-legend {
          position:absolute; bottom:12px; left:12px; z-index:10;
          display:flex; gap:14px;
          background:var(--card); border:1px solid var(--border);
          padding:6px 12px; border-radius:var(--radius);
          font-size:11px; color:var(--muted-foreground);
        }
        .ad-graph-legend-item { display:inline-flex; align-items:center; gap:6px; }
        .ad-graph-legend-swatch { width:18px; height:2px; border-radius:1px; }
        .ad-graph-legend-swatch.main { background:#60a5fa; }
        .ad-graph-legend-swatch.vector { background:#a78bfa; }
        .ad-graph-legend-swatch.graph { background:#34d399; }
        .ad-detail-section { margin-bottom:16px; }
        .ad-detail-section:last-child { margin-bottom:0; }
        .ad-detail-title { font-size:16px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
        .ad-detail-title .status-dot { width:8px; height:8px; border-radius:50%; background:var(--success); flex-shrink:0; }
        .ad-detail-desc { font-size:13px; color:var(--muted-foreground); margin-bottom:14px; line-height:1.5; }
        .ad-detail-field { margin-bottom:12px; }
        .ad-detail-field-label { font-size:11px; color:var(--muted-foreground); margin-bottom:3px; text-transform:uppercase; letter-spacing:0.04em; }
        .ad-detail-field-value { font-size:13px; color:var(--foreground); }
        .ad-detail-field-value.mono { font-family:var(--font-mono); font-size:12px; }
        .ad-detail-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .ad-detail-metric { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center; }
        .ad-detail-metric-value { font-size:22px; font-weight:700; }
        .ad-detail-metric-label { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ad-v-table { width:100%; border-collapse:collapse; }
        .ad-v-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); }
        .ad-v-table td { padding:10px 14px; font-size:13px; color:var(--foreground); border-bottom:1px solid var(--border); }
        .ad-v-table tr:last-child td { border-bottom:none; }
        .ad-v-table tr:hover td { background:var(--muted); }
        .ad-q-bar-track { width:64px; height:4px; background:var(--card); border-radius:2px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px; }
        .ad-q-bar-fill { height:100%; border-radius:2px; }
        @keyframes ad-edge-flow {
          from { stroke-dashoffset: 12; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="ad-page-header">
          <h1>数据架构</h1>
          <p>数据源、数据流向与数据质量全景</p>
        </div>

        {/* Stats */}
        <div className="ad-stats-row">
          {stats.map((s) => (
            <div className="ad-stat-card" key={s.label}>
              <div className="ad-stat-label">{s.label}</div>
              <div className="ad-stat-value" style={s.valueColor ? { color: s.valueColor } : undefined}>{s.value}</div>
              <div className="ad-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Three-column layout */}
        <div className="ad-data-layout">
          {/* Left: Data source tree */}
          <div className="v-card" style={{ width: 200, flexShrink: 0, padding: 16, overflowY: 'auto' }}>
            <div className="ad-v-card-title" style={{ fontSize: 13, marginBottom: 8 }}><FolderTree />数据源</div>
            {treeGroups.map((group) => (
              <div className="ad-tree-group" key={group.label}>
                <div className="ad-tree-group-label"><Database />{group.label}</div>
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className={`ad-tree-item${item.name === selectedDs ? ' active' : ''}`}
                    onClick={() => setSelectedDs(item.name)}
                  >
                    <span className={`ds-dot ${item.status}`} />
                    {item.name}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Middle: Data flow diagram */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', height: '100%' }}>
            <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="ad-v-card-title" style={{ flexShrink: 0 }}>
                <ArrowRightLeft />数据流向图
              </div>
              <div className="ad-graph">
                <div ref={graphRef} className="ad-graph-canvas" />
                <div className="ad-graph-toolbar">
                  <button className="ad-graph-toolbar-btn" onClick={zoomOut} title="缩小">－</button>
                  <button className="ad-graph-toolbar-btn" onClick={resetView} title="重置视图">⟲</button>
                  <button className="ad-graph-toolbar-btn" onClick={zoomIn} title="放大">＋</button>
                  <button className="ad-graph-toolbar-btn" onClick={relayout} title="自动布局"><LayoutGrid size={14} /></button>
                </div>
                <div className="ad-graph-legend">
                  <span className="ad-graph-legend-item"><span className="ad-graph-legend-swatch main" />主链路</span>
                  <span className="ad-graph-legend-item"><span className="ad-graph-legend-swatch vector" />向量链路</span>
                  <span className="ad-graph-legend-item"><span className="ad-graph-legend-swatch graph" />图谱链路</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Data source detail */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div className="v-card" style={{ height: '100%' }}>
              <div className="ad-v-card-title"><Info />数据源详情</div>
              <div className="ad-detail-section">
                <div className="ad-detail-title"><span className="status-dot" />{selectedDs}</div>
                <div className="ad-detail-desc">平台核心关系型数据库，承载本体元数据、业务对象持久化与事务处理。</div>
                <div className="ad-detail-field">
                  <div className="ad-detail-field-label">连接信息</div>
                  <div className="ad-detail-field-value mono">mate-pg-primary.cluster:5432</div>
                </div>
                <div className="ad-detail-field">
                  <div className="ad-detail-field-label">版本</div>
                  <div className="ad-detail-field-value">PostgreSQL 17</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />
              <div className="ad-detail-metrics">
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">23</div><div className="ad-detail-metric-label">表数量</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">2.1TB</div><div className="ad-detail-metric-label">数据量</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value">08:32</div><div className="ad-detail-metric-label">最近同步</div></div>
                <div className="ad-detail-metric"><div className="ad-detail-metric-value" style={{ color: 'var(--success)' }}>&lt;5s</div><div className="ad-detail-metric-label">同步延迟</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Data quality */}
        <div className="v-card">
          <div className="ad-v-card-title"><ShieldCheck />数据质量面板</div>
          <table className="ad-v-table">
            <thead>
              <tr>
                <th>数据源</th><th>类型</th><th>完整率</th><th>准确率</th><th>及时率</th><th>综合评分</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {qualityRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{row.name}</td>
                  <td><span className="v-badge v-badge-neutral">{row.type}</span></td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.complete, background: `var(--${row.cBar})` }} /></span>{row.complete}</td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.accurate, background: `var(--${row.aBar})` }} /></span>{row.accurate}</td>
                  <td><span className="ad-q-bar-track"><span className="ad-q-bar-fill" style={{ width: row.timely, background: `var(--${row.tBar})` }} /></span>{row.timely}</td>
                  <td style={{ fontWeight: 600, color: row.scoreColor }}>{row.score}</td>
                  <td><span className={`v-badge v-badge-${row.badge}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}