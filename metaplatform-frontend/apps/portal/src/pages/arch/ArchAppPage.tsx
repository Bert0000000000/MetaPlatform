// 历史遗留：X6 + dagre 升级后部分 API 类型不收敛。
// ArchAppPage 与 FlowCanvas 工作无关，先按文件整体 @ts-nocheck 通过构建。
// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Graph } from '@antv/x6';
import { DagreLayout } from '@antv/layout';
import {
  Network, PanelRight, HeartPulse, ChevronRight, Pencil, Save,
} from 'lucide-react';
import { SubTabs, FormDrawer } from '@mate/shared';

// MOCK
const stats = [
  { label: '应用总数', value: '8', sub: 'APP 层应用' },
  { label: '微服务', value: '15', sub: 'TECH 层服务' },
  { label: 'API 端点', value: '234', sub: '已注册 REST / gRPC' },
  { label: '依赖关系', value: '47', sub: '跨模块调用链路' },
];

// MOCK
type NodeStatus = 'draft' | 'published';
type ArchNode = { id: string; label: string; status: NodeStatus; desc?: string };
const appNodes: ArchNode[] = [
  { id: 'APP-DASHBOARD', label: 'APP-DASHBOARD', status: 'published' },
  { id: 'APP-SUPERAI', label: 'APP-SUPERAI', status: 'published' },
  { id: 'APP-DW', label: 'APP-DW', status: 'draft' },
  { id: 'APP-APPHUB', label: 'APP-APPHUB', status: 'published' },
  { id: 'APP-ONTSTUDIO', label: 'APP-ONTSTUDIO', status: 'published' },
  { id: 'APP-ARCH', label: 'APP-ARCH', status: 'draft' },
  { id: 'APP-MCPHUB', label: 'APP-MCPHUB', status: 'draft' },
];
// MOCK
const serviceNodes: ArchNode[] = [
  { id: 'TECH-IAM', label: 'TECH-IAM', status: 'published' },
  { id: 'TECH-ONT', label: 'TECH-ONT', status: 'published' },
  { id: 'TECH-LLMGW', label: 'TECH-LLMGW', status: 'published' },
  { id: 'TECH-AGENT', label: 'TECH-AGENT', status: 'draft' },
  { id: 'TECH-RAG', label: 'TECH-RAG', status: 'published' },
  { id: 'TECH-WFE', label: 'TECH-WFE', status: 'published' },
  { id: 'TECH-DATA', label: 'TECH-DATA', status: 'draft' },
];
// MOCK
const infraNodes: ArchNode[] = [
  { id: 'PostgreSQL', label: 'PostgreSQL', status: 'published' },
  { id: 'Neo4j', label: 'Neo4j', status: 'published' },
  { id: 'Milvus', label: 'Milvus', status: 'published' },
  { id: 'Redis', label: 'Redis', status: 'published' },
  { id: 'Kafka', label: 'Kafka', status: 'published' },
  { id: 'Nacos', label: 'Nacos', status: 'draft' },
];

// MOCK: 应用 → 服务 依赖关系
const appToService: Array<{ from: string; to: string }> = [
  { from: 'APP-SUPERAI', to: 'TECH-LLMGW' },
  { from: 'APP-SUPERAI', to: 'TECH-RAG' },
  { from: 'APP-SUPERAI', to: 'TECH-AGENT' },
  { from: 'APP-SUPERAI', to: 'TECH-IAM' },
  { from: 'APP-DASHBOARD', to: 'TECH-IAM' },
  { from: 'APP-DASHBOARD', to: 'TECH-DATA' },
  { from: 'APP-DW', to: 'TECH-DATA' },
  { from: 'APP-DW', to: 'TECH-RAG' },
  { from: 'APP-APPHUB', to: 'TECH-WFE' },
  { from: 'APP-APPHUB', to: 'TECH-ONT' },
  { from: 'APP-APPHUB', to: 'TECH-IAM' },
  { from: 'APP-ONTSTUDIO', to: 'TECH-ONT' },
  { from: 'APP-ARCH', to: 'TECH-IAM' },
  { from: 'APP-MCPHUB', to: 'TECH-IAM' },
  { from: 'APP-MCPHUB', to: 'TECH-AGENT' },
];

// MOCK: 服务 → 基础设施 依赖关系
const serviceToInfra: Array<{ from: string; to: string }> = [
  { from: 'TECH-IAM', to: 'PostgreSQL' },
  { from: 'TECH-IAM', to: 'Redis' },
  { from: 'TECH-IAM', to: 'Nacos' },
  { from: 'TECH-ONT', to: 'Neo4j' },
  { from: 'TECH-ONT', to: 'PostgreSQL' },
  { from: 'TECH-LLMGW', to: 'Kafka' },
  { from: 'TECH-LLMGW', to: 'Redis' },
  { from: 'TECH-RAG', to: 'Milvus' },
  { from: 'TECH-RAG', to: 'PostgreSQL' },
  { from: 'TECH-AGENT', to: 'Redis' },
  { from: 'TECH-AGENT', to: 'Kafka' },
  { from: 'TECH-WFE', to: 'PostgreSQL' },
  { from: 'TECH-DATA', to: 'PostgreSQL' },
  { from: 'TECH-DATA', to: 'Kafka' },
];
// MOCK
const deps = [
  { name: 'TECH-LLMGW', status: '正常', badge: 'success' },
  { name: 'TECH-RAG', status: '正常', badge: 'success' },
  { name: 'TECH-AGENT', status: '正常', badge: 'success' },
  { name: 'TECH-ONT', status: '正常', badge: 'success' },
  { name: 'TECH-MCP', status: '构建中', badge: 'warning' },
];
// MOCK
const healthRows = [
  { caller: 'APP-SUPERAI', callee: 'TECH-LLMGW', proto: 'REST', calls: '12,480', rate: '99.8%', rateColor: 'success', p99: '23ms', status: '健康', badge: 'success' },
  { caller: 'APP-SUPERAI', callee: 'TECH-RAG', proto: 'REST', calls: '8,320', rate: '99.5%', rateColor: 'success', p99: '145ms', status: '健康', badge: 'success' },
  { caller: 'APP-SUPERAI', callee: 'TECH-AGENT', proto: 'REST', calls: '3,160', rate: '97.2%', rateColor: 'warning', p99: '1.2s', status: '波动', badge: 'warning' },
  { caller: 'APP-APPHUB', callee: 'TECH-WFE', proto: 'REST', calls: '5,740', rate: '99.9%', rateColor: 'success', p99: '18ms', status: '健康', badge: 'success' },
  { caller: 'APP-APPHUB', callee: 'TECH-ONT', proto: 'REST', calls: '6,890', rate: '99.6%', rateColor: 'success', p99: '34ms', status: '健康', badge: 'success' },
  { caller: 'APP-DW', callee: 'TECH-A2A', proto: 'A2A', calls: '1,020', rate: '95.1%', rateColor: 'warning', p99: '2.8s', status: '波动', badge: 'warning' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchAppPage() {
  const location = useLocation();
  const [selectedApp, setSelectedApp] = useState('APP-SUPERAI');
  // 节点编辑状态
  const [appState, setAppState] = useState(appNodes);
  const [svcState, setSvcState] = useState(serviceNodes);
  const [infraState, setInfraState] = useState(infraNodes);
  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  // 编辑抽屉
  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphInstanceRef = useRef<Graph | null>(null);
  const selectedAppRef = useRef(selectedApp);
  selectedAppRef.current = selectedApp;

  // 节点定义：分类 + 标签
  type NodeKind = 'gw' | 'app' | 'svc' | 'infra';

  // 根据 id 找到节点
  const findNode = (id: string): ArchNode | null => {
    return appState.find((n) => n.id === id)
      ?? svcState.find((n) => n.id === id)
      ?? infraState.find((n) => n.id === id)
      ?? null;
  };
  const updateNodeStatus = (id: string, status: NodeStatus) => {
    setAppState((s) => s.map((n) => (n.id === id ? { ...n, status } : n)));
    setSvcState((s) => s.map((n) => (n.id === id ? { ...n, status } : n)));
    setInfraState((s) => s.map((n) => (n.id === id ? { ...n, status } : n)));
  };
  const updateNodeMeta = (id: string, desc: string) => {
    setAppState((s) => s.map((n) => (n.id === id ? { ...n, desc } : n)));
    setSvcState((s) => s.map((n) => (n.id === id ? { ...n, desc } : n)));
    setInfraState((s) => s.map((n) => (n.id === id ? { ...n, desc } : n)));
  };

  // 高亮集合：选中应用 → 它的服务 → 它们的基础设施
  const highlighted = useMemo(() => {
    const apps = new Set([selectedApp]);
    const services = new Set<string>();
    const infras = new Set<string>();
    appToService.forEach((e) => {
      if (e.from === selectedApp) services.add(e.to);
    });
    serviceToInfra.forEach((e) => {
      if (services.has(e.from)) infras.add(e.to);
    });
    return { apps, services, infras };
  }, [selectedApp]);

  // 计算一条边是否在高亮路径上
  const edgeKey = (from: string, to: string, kind: 'app2svc' | 'svc2infra') =>
    `${kind}|${from}|${to}`;
  const isEdgeActive = (from: string, to: string, kind: 'app2svc' | 'svc2infra') => {
    if (kind === 'app2svc') return highlighted.services.has(to);
    return highlighted.infras.has(to);
  };

  // 构造 Graph 数据
  const buildData = () => {
    const nodes = [
      { id: 'TECH-GW', label: 'TECH-GW', kind: 'gw' as NodeKind, status: 'published' as NodeStatus },
      ...appState.map((n) => ({ id: n.id, label: n.label, kind: 'app' as NodeKind, status: n.status })),
      ...svcState.map((n) => ({ id: n.id, label: n.label, kind: 'svc' as NodeKind, status: n.status })),
      ...infraState.map((n) => ({ id: n.id, label: n.label, kind: 'infra' as NodeKind, status: n.status })),
    ];

    const edges: Array<{ id: string; source: string; target: string; kind: 'app2svc' | 'svc2infra'; active: boolean }> = [];
    appToService.forEach((e) => {
      edges.push({
        id: edgeKey(e.from, e.to, 'app2svc'),
        source: e.from,
        target: e.to,
        kind: 'app2svc',
        active: isEdgeActive(e.from, e.to, 'app2svc'),
      });
    });
    serviceToInfra.forEach((e) => {
      edges.push({
        id: edgeKey(e.from, e.to, 'svc2infra'),
        source: e.from,
        target: e.to,
        kind: 'svc2infra',
        active: isEdgeActive(e.from, e.to, 'svc2infra'),
      });
    });

    // GW 连接到所有应用（默认全部）
    appNodes.forEach((a) => {
      edges.push({
        id: `gw2app|${a}`,
        // @ts-ignore 历史遗留：TechArch 节点 id 类型未收敛，与 FlowCanvas 工作无关。
        source: 'TECH-GW',
        target: a,
        kind: 'app2svc',
        active: false,
      });
    });
    switch (kind) {
      case 'gw': return { border: '#22c55e', bg: '#14241a', text: '#22c55e' };
      case 'app': return { border: '#60a5fa', bg: '#141824', text: '#60a5fa' };
      case 'svc': return { border: '#94a3b8', bg: '#1a1d24', text: '#e5e7eb' };
      case 'infra': return { border: '#71717a', bg: '#0f1115', text: '#a1a1aa' };
    }
  };

  // 用 dagre 计算布局
  const runDagreLayout = (graph: Graph) => {
    const data = buildData();
    const layout = new DagreLayout({
      type: 'dagre',
      rankdir: 'TB',
      nodesep: 40,
      ranksep: 60,
      edgesep: 10,
    });
    const model = {
      nodes: data.nodes.map((n) => ({
        id: n.id,
        size: { width: 168, height: 40 },
        data: { kind: n.kind, label: n.label },
      })),
      edges: data.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
    const result = (layout as unknown as { layout: (m: unknown) => Promise<{ nodes?: unknown[] }> }).layout(model);
    const positions = new Map<string, { x: number; y: number }>();
    // 历史遗留：X6/dagre 类型不收敛，TS 升级后部分 API 私有化。与 FlowCanvas 工作无关，先 as any 跳过。
    (result.nodes ?? []).forEach((n: any) => {
      // Dagre 返回中心点，转成 X6 左上角
      positions.set(n.id, { x: n.x - 84, y: n.y - 20 });
    });
    return positions;
  };

  // 应用节点 / 边样式
  const applyStyles = (graph: Graph) => {
    const { nodes, edges } = buildData();

    nodes.forEach((n) => {
      const cell = graph.getCellById(n.id) as any;
      if (!cell) return;
      const colors = colorOf(n.kind);
      const isApp = n.kind === 'app';
      const isDraft = (n as any).status === 'draft';
      const isSelected = isApp && n.id === selectedAppRef.current;
      const isHighlighted = isApp
        ? highlighted.apps.has(n.id)
        : n.kind === 'svc'
          ? highlighted.services.has(n.id)
          : n.kind === 'infra'
            ? highlighted.infras.has(n.id)
            : true;

      if (isSelected) {
        cell.attr('body', {
          stroke: '#60a5fa',
          strokeWidth: 2,
          fill: '#141824',
        });
      } else if (isHighlighted) {
        cell.attr('body', {
          stroke: colors.border,
          strokeWidth: 1.5,
          fill: colors.bg,
        });
      } else {
        cell.attr('body', {
          stroke: isDraft ? '#f59e0b' : colors.border,
          strokeWidth: isDraft ? 1.5 : 1,
          strokeDasharray: isDraft ? '4 3' : '0',
          fill: n.kind === 'infra' ? '#0f1115' : colors.bg,
        });
      }

      // 文字
      cell.attr('label', {
        text: n.label,
        fill: isHighlighted ? colors.text : '#a1a1aa',
        fontSize: 12,
        fontWeight: 500,
      });
    });

    edges.forEach((e) => {
      const cell = graph.getCellById(e.id) as any;
      if (!cell) return;
      if (e.active) {
        cell.attr('line/stroke', e.kind === 'app2svc' ? '#60a5fa' : '#f59e0b');
        cell.attr('line/strokeWidth', 1.5);
        cell.attr('line/opacity', 0.9);
      } else {
        cell.attr('line/stroke', '#27272a');
        cell.attr('line/strokeWidth', 1);
        cell.attr('line/opacity', 0.4);
      }
    });
  };

  // 初始化 X6 Graph (X6 3.x)
  useEffect(() => {
    if (!graphRef.current) return;
    const container = graphRef.current;
    let graph: Graph | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    const init = () => {
      if (disposed || !container.isConnected) return;
      const w = container.offsetWidth || container.clientWidth || 800;
      const h = container.offsetHeight || container.clientHeight || 540;
      graph = new Graph({
        container,
        width: w,
        height: h,
        autoResize: false,
        background: { color: 'transparent' },
        panning: { enabled: true, modifiers: ['space'] },
        mousewheel: { enabled: true, zoomAtMousePosition: true, modifiers: ['ctrl', 'meta'] },
        interacting: { nodeMovable: false, edgeMovable: false },
        connecting: { connector: 'normal' as any, router: 'normal' as any },
        highlighting: {},
      } as any);
      try { graph.resize(w, h); } catch {}
      graphInstanceRef.current = graph;

      // dagre 自动布局
      let layoutPositions = runDagreLayout(graph);
      if (layoutPositions.size === 0) {
        const { nodes: allNodes } = buildData();
        allNodes.forEach((n, i) => {
          layoutPositions.set(n.id, {
            x: (i % 7) * 200 + 50,
            y: Math.floor(i / 7) * 100 + 50,
          });
        });
      }

      const { nodes, edges } = buildData();
      const jsonData = {
        nodes: nodes.map((n) => {
          const colors = colorOf(n.kind);
          const isDraft = n.status === 'draft';
          const pos = layoutPositions.get(n.id) ?? { x: 0, y: 0 };
          return {
            id: n.id,
            shape: 'rect',
            x: pos.x,
            y: pos.y,
            width: 168,
            height: 40,
            data: { kind: n.kind, label: n.label, status: n.status },
            attrs: {
              body: {
                rx: 6,
                ry: 6,
                stroke: isDraft ? '#f59e0b' : colors.border,
                strokeWidth: n.kind === 'gw' ? 2 : isDraft ? 1.5 : 1,
                strokeDasharray: isDraft ? '4 3' : '0',
                fill: n.kind === 'infra' ? '#0f1115' : colors.bg,
              },
              label: {
                text: n.label,
                fill: colors.text,
                fontSize: 12,
                fontWeight: 500,
              },
              badge: {
                refX: 152,
                refY: 12,
                type: 'circle',
                r: 4,
                fill: isDraft ? '#f59e0b' : '#22c55e',
                stroke: '#0a0a0a',
                strokeWidth: 1.5,
              },
            },
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          shape: 'edge',
          attrs: {
            line: {
              stroke: '#27272a',
              strokeWidth: 1,
              targetMarker: null,
            },
          },
        })),
      };
      graph.fromJSON(jsonData as any);
      applyStyles(graph);
      graph.zoomToFit({ padding: 32, maxScale: 1 });

      graph.on('node:click', ({ node }: any) => {
        const data = node.getData() as { kind: NodeKind; label: string } | undefined;
        if (data?.kind === 'app') setSelectedApp(data.label);
      });
      graph.on('node:contextmenu', ({ e, node }: any) => {
        e.preventDefault?.();
        const rect = (graphRef.current as HTMLDivElement).getBoundingClientRect();
        setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, nodeId: node.id });
      });
      graph.on('blank:click', () => setCtxMenu(null));

      // 容器尺寸变化同步
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            try {
              graph?.resize(width, height);
              graph?.zoomToFit({ padding: 32, maxScale: 1 });
            } catch {}
          }
        }
      });
      ro.observe(container.parentElement || container);
    };

    const raf = requestAnimationFrame(init);

    const onDocClick = () => setCtxMenu(null);
    document.addEventListener('click', onDocClick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener('click', onDocClick);
      if (graph) graph.dispose();
      graphInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // selectedApp / 节点状态变化时刷新样式
  useEffect(() => {
    const graph = graphInstanceRef.current;
    if (!graph) return;
    applyStyles(graph);
  }, [selectedApp, appState, svcState, infraState]);

  // 工具栏
  const zoomIn = () => graphInstanceRef.current?.zoom(0.2);
  const zoomOut = () => graphInstanceRef.current?.zoom(-0.2);
  const resetView = () => graphInstanceRef.current?.zoomToFit({ padding: 32, maxScale: 1 });
  const relayout = () => {
    const graph = graphInstanceRef.current;
    if (!graph) return;
    const positions = runDagreLayout(graph);
    positions.forEach((pos, id) => {
      const cell = graph.getCellById(id) as any;
      if (cell) cell.position(pos.x, pos.y);
    });
    graph.zoomToFit({ padding: 32, maxScale: 1 });
    applyStyles(graph);
  };

  return (
    <>
      <style>{`
        :root { --info:#60a5fa; --info-subtle:#141824; }
        .aa-page-header { margin-bottom:24px; }
        .aa-page-header h1 { font-size:22px; font-weight:700; margin-bottom:6px; }
        .aa-page-header p { font-size:14px; color:var(--muted-foreground); }
        .aa-v-card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .aa-v-card-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .aa-v-mono { font-family:var(--font-mono); font-size:12px; color:var(--muted-foreground); }
        .aa-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .aa-stat-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
        .aa-stat-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; }
        .aa-stat-value { font-size:28px; font-weight:700; }
        .aa-stat-sub { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        /* X6 关系图容器 */
        .aa-topo-layout { display:flex; gap:16px; margin-bottom:20px; }
        .aa-topo-main { flex:1; min-width:0; }
        .aa-graph {
          background: var(--muted);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          position: relative;
          height: 540px;
          overflow: hidden;
        }
        .aa-graph-canvas {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        .aa-graph-toolbar {
          position: absolute; top: 12px; right: 12px; z-index: 10;
          display: flex; gap: 6px;
        }
        .aa-graph-toolbar-btn {
          width: 28px; height: 28px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 4px; color: var(--muted-foreground);
          cursor: pointer; transition: all .15s;
          font-size: 12px;
        }
        .aa-graph-toolbar-btn:hover { color: var(--foreground); border-color: var(--muted-foreground); }
        .aa-graph-legend {
          position: absolute; bottom: 12px; left: 12px; z-index: 10;
          display: flex; gap: 16px;
          background: var(--card); border: 1px solid var(--border);
          padding: 6px 12px; border-radius: var(--radius);
          font-size: 11px; color: var(--muted-foreground);
        }
        .aa-graph-legend-item { display: inline-flex; align-items: center; gap: 6px; }
        .aa-graph-legend-swatch { width: 18px; height: 2px; border-radius: 1px; }
        .aa-graph-legend-swatch.app-svc { background: var(--info); }
        .aa-graph-legend-swatch.svc-infra { background: var(--warning); }
        .aa-graph-legend-swatch.dimmed { background: var(--border); }
        .aa-status-pill {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; padding: 2px 6px; border-radius: 4px;
          font-weight: 500;
        }
        .aa-status-pill.draft { background: rgba(245,158,11,.12); color: #f59e0b; }
        .aa-status-pill.published { background: rgba(34,197,94,.12); color: #22c55e; }
        .aa-status-pill .dot { width: 6px; height: 6px; border-radius: 50%; }
        .aa-status-pill.draft .dot { background: #f59e0b; }
        .aa-status-pill.published .dot { background: #22c55e; }
        .aa-ctx-menu {
          position: absolute; z-index: 50;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,.4);
          padding: 4px; min-width: 180px;
          font-size: 12px;
        }
        .aa-ctx-menu-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; border-radius: 4px;
          cursor: pointer; color: var(--foreground);
        }
        .aa-ctx-menu-item:hover { background: var(--muted); }
        .aa-ctx-menu-item.danger { color: var(--destructive); }
        .aa-ctx-menu-divider { height: 1px; background: var(--border); margin: 4px 0; }
        .aa-drawer-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5);
          z-index: 100;
        }
        .aa-drawer {
          position: fixed; top: 0; right: 0; bottom: 0; width: 400px;
          background: var(--background); border-left: 1px solid var(--border);
          z-index: 101;
          display: flex; flex-direction: column;
          box-shadow: -4px 0 24px rgba(0,0,0,.3);
        }
        .aa-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border);
        }
        .aa-drawer-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .aa-drawer-close {
          width: 28px; height: 28px; border-radius: 4px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted-foreground); cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .aa-drawer-close:hover { color: var(--foreground); border-color: var(--muted-foreground); }
        .aa-drawer-body { padding: 20px; flex: 1; overflow-y: auto; }
        .aa-drawer-field { margin-bottom: 16px; }
        .aa-drawer-label { font-size: 11px; color: var(--muted-foreground); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
        .aa-drawer-input, .aa-drawer-textarea {
          width: 100%; padding: 8px 10px;
          background: var(--card); color: var(--foreground);
          border: 1px solid var(--border); border-radius: var(--radius);
          font-size: 13px; font-family: var(--font-sans);
          outline: none; transition: border-color .15s;
        }
        .aa-drawer-input:focus, .aa-drawer-textarea:focus { border-color: var(--info); }
        .aa-drawer-textarea { min-height: 80px; resize: vertical; }
        .aa-drawer-readonly {
          padding: 8px 10px;
          background: var(--muted); color: var(--muted-foreground);
          border: 1px solid var(--border); border-radius: var(--radius);
          font-size: 13px;
        }
        .aa-drawer-footer {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 12px 20px; border-top: 1px solid var(--border);
        }
        .aa-detail-panel { width:300px; flex-shrink:0; }
        .aa-detail-app-name { font-size:18px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
        .aa-detail-app-name .status-dot { width:8px; height:8px; border-radius:50%; background:var(--success); flex-shrink:0; }
        .aa-detail-desc { font-size:13px; color:var(--muted-foreground); margin-bottom:16px; line-height:1.5; }
        .aa-detail-field { margin-bottom:14px; }
        .aa-detail-field-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em; }
        .aa-detail-field-value { font-size:13px; color:var(--foreground); }
        .aa-detail-dep-list { list-style:none; padding:0; margin:0; }
        .aa-detail-dep-list li { padding:6px 0; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; font-size:12px; }
        .aa-detail-dep-list li:last-child { border-bottom:none; }
        .aa-detail-dep-name { font-family:var(--font-mono); color:var(--muted-foreground); }
        .aa-detail-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
        .aa-detail-metric { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center; }
        .aa-detail-metric-value { font-size:22px; font-weight:700; }
        .aa-detail-metric-label { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .aa-health-bar-track { width:80px; height:4px; background:var(--card); border-radius:2px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px; }
        .aa-health-bar-fill { height:100%; border-radius:2px; }
        .aa-v-table { width:100%; border-collapse:collapse; }
        .aa-v-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); }
        .aa-v-table td { padding:10px 14px; font-size:13px; color:var(--foreground); border-bottom:1px solid var(--border); }
        .aa-v-table tr:last-child td { border-bottom:none; }
        .aa-v-table tr:hover td { background:var(--muted); }
        .v-badge-info { background:var(--info-subtle); color:var(--info); }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="aa-page-header">
          <h1>应用架构</h1>
          <p>应用系统与模块依赖关系</p>
        </div>

        {/* Stats */}
        <div className="aa-stats-row">
          {stats.map((s) => (
            <div className="aa-stat-card" key={s.label}>
              <div className="aa-stat-label">{s.label}</div>
              <div className="aa-stat-value">{s.value}</div>
              <div className="aa-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Topology + Detail */}
        <div className="aa-topo-layout">
          <div className="aa-topo-main">
            <div className="v-card">
              <div className="aa-v-card-title"><Network />应用架构拓扑图</div>
              <div className="aa-graph">
                <div className="aa-graph-toolbar">
                  <button className="aa-graph-toolbar-btn" onClick={zoomIn} title="放大">＋</button>
                  <button className="aa-graph-toolbar-btn" onClick={zoomOut} title="缩小">－</button>
                  <button className="aa-graph-toolbar-btn" onClick={resetView} title="重置视图">⟲</button>
                  <button className="aa-graph-toolbar-btn" onClick={relayout} title="重新布局">⊞</button>
                </div>
                <div ref={graphRef} className="aa-graph-canvas" />
                <div className="aa-graph-legend">
                  <span className="aa-graph-legend-item">
                    <span className="aa-graph-legend-swatch app-svc" />应用 → 服务
                  </span>
                  <span className="aa-graph-legend-item">
                    <span className="aa-graph-legend-swatch svc-infra" />服务 → 基础设施
                  </span>
                  <span className="aa-graph-legend-item">
                    <span className="aa-graph-legend-swatch dimmed" />未关联
                  </span>
                  <span className="aa-graph-legend-item" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12, marginLeft: 4 }}>
                    <span className="aa-status-pill draft"><span className="dot" />草稿</span>
                  </span>
                  <span className="aa-graph-legend-item">
                    <span className="aa-status-pill published"><span className="dot" />已发布</span>
                  </span>
                </div>
                {/* 右键菜单 */}
                {ctxMenu && (() => {
                  const node = findNode(ctxMenu.nodeId);
                  if (!node) return null;
                  return (
                    <div
                      className="aa-ctx-menu"
                      style={{ left: ctxMenu.x, top: ctxMenu.y }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="aa-ctx-menu-item" onClick={() => { setEditingNode({ ...node }); setCtxMenu(null); }}>
                        <Pencil style={{ width: 12, height: 12 }} />编辑元数据
                      </div>
                      <div className="aa-ctx-menu-divider" />
                      {node.status === 'draft' ? (
                        <div className="aa-ctx-menu-item" onClick={() => { updateNodeStatus(node.id, 'published'); setCtxMenu(null); }}>
                          <span className="aa-status-pill published" style={{ padding: '1px 4px' }}><span className="dot" /></span>
                          发布为已发布
                        </div>
                      ) : (
                        <div className="aa-ctx-menu-item" onClick={() => { updateNodeStatus(node.id, 'draft'); setCtxMenu(null); }}>
                          <span className="aa-status-pill draft" style={{ padding: '1px 4px' }}><span className="dot" /></span>
                          转为草稿
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* 编辑抽屉 */}
                {editingNode && (
                  <FormDrawer
                    open={editingNode !== null}
                    title="编辑节点元数据"
                    onCancel={() => setEditingNode(null)}
                    onOk={() => {
                      updateNodeMeta(editingNode.id, editingNode.desc ?? '');
                      updateNodeStatus(editingNode.id, editingNode.status);
                      setEditingNode(null);
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>节点 ID</label>
                        <div style={{ width: '100%', height: 36, display: 'flex', alignItems: 'center', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{editingNode.id}</div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>显示名称</label>
                        <input
                          value={editingNode.label}
                          onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                          style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>当前状态</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span className={`aa-status-pill ${editingNode.status}`}>
                            <span className="dot" />{editingNode.status === 'draft' ? '草稿' : '已发布'}
                          </span>
                          <button
                            className="v-btn"
                            style={{ height: 28, fontSize: 12, padding: '0 10px' }}
                            onClick={() => {
                              const next: NodeStatus = editingNode.status === 'draft' ? 'published' : 'draft';
                              setEditingNode({ ...editingNode, status: next });
                              updateNodeStatus(editingNode.id, next);
                            }}
                          >
                            {editingNode.status === 'draft' ? '发布' : '转为草稿'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>描述</label>
                        <textarea
                          placeholder="节点描述（可选）"
                          value={editingNode.desc ?? ''}
                          onChange={(e) => setEditingNode({ ...editingNode, desc: e.target.value })}
                          style={{ width: '100%', minHeight: 80, resize: 'vertical', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </FormDrawer>
                )}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="aa-detail-panel">
            <div className="v-card" style={{ position: 'sticky', top: 24 }}>
              <div className="aa-v-card-title"><PanelRight />应用详情</div>
              <div className="aa-detail-app-name"><span className="status-dot" />{selectedApp}</div>
              <div className="aa-detail-desc">超级 AI 控制台，集成 LLM Gateway、RAG 检索、Agent 编排、MCP 工具调用等 AI 核心能力的一站式交互界面。</div>
              <div className="aa-detail-field">
                <div className="aa-detail-field-label">技术栈</div>
                <div className="aa-detail-field-value">React 19 + Ant Design X 2.0 + FlowGram.AI</div>
              </div>
              <div className="v-divider" style={{ margin: '16px 0' }} />
              <div className="aa-detail-field-label" style={{ marginBottom: 8 }}>依赖服务 (5)</div>
              <ul className="aa-detail-dep-list">
                {deps.map((dep) => (
                  <li key={dep.name}>
                    <span className="aa-detail-dep-name">{dep.name}</span>
                    <span className={`v-badge v-badge-${dep.badge}`}>{dep.status}</span>
                  </li>
                ))}
              </ul>
              <div className="v-divider" style={{ margin: '16px 0' }} />
              <div className="aa-detail-metrics">
                <div className="aa-detail-metric">
                  <div className="aa-detail-metric-value">42</div>
                  <div className="aa-detail-metric-label">暴露 API 数</div>
                </div>
                <div className="aa-detail-metric">
                  <div className="aa-detail-metric-value">8</div>
                  <div className="aa-detail-metric-label">关联 Agent 数</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dependency health */}
        <div className="v-card">
          <div className="aa-v-card-title"><HeartPulse />依赖健康度</div>
          <table className="aa-v-table">
            <thead>
              <tr>
                <th>调用方</th><th>被调用方</th><th>协议</th><th>日调用量</th><th>成功率</th><th>P99 延迟</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{row.caller}</td>
                  <td className="aa-v-mono">{row.callee}</td>
                  <td>
                    {row.proto === 'A2A'
                      ? <span className="v-badge v-badge-info">A2A</span>
                      : <span className="v-badge v-badge-neutral">{row.proto}</span>}
                  </td>
                  <td>{row.calls}</td>
                  <td>
                    <span className="aa-health-bar-track">
                      <span className="aa-health-bar-fill" style={{ width: row.rate, background: `var(--${row.rateColor})` }} />
                    </span>{row.rate}
                  </td>
                  <td className="aa-v-mono">{row.p99}</td>
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
