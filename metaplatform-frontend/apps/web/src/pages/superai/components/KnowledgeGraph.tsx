// 知识图谱（SuperAI）— Semi DOM 渲染（SemiGraphCanvas，X6 已移除）。
// 保留能力：力导向/环形/网格布局（force 带动画）、类型筛选、
// 节点点击回调、展开/折叠（后端 expand）、撤销/重做、PNG/SVG/JSON 导出。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select, Space, Typography, Tooltip, Tag, Toast } from '@douyinfe/semi-ui';
import {
  UndoOutlined,
  RedoOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExpandAltOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import SemiGraphCanvas, {
  graphSpecsToPngDataUrl, graphSpecsToSvg,
  type GraphNodeSpec, type GraphEdgeSpec,
} from '@/components/SemiGraphCanvas';
import type { GraphData, GraphNode, GraphEdge } from '@/api/superai/types';
import { expandGraphNode } from '@/api/superai/ontology';

interface KnowledgeGraphProps {
  data: GraphData;
  height?: number;
  /** 固定画布宽度（px）。不传则自适应容器宽度。 */
  width?: number;
  /** 节点点击回调（用于 REQ-033 跳转概念详情）。 */
  onNodeClick?: (nodeId: string, nodeType: string) => void;
}

type LayoutType = 'force' | 'circular' | 'grid';
type ExportFormat = 'png' | 'svg' | 'json';

const NODE_COLORS: Record<string, string> = {
  concept: '#1677ff',
  entity: '#52c41a',
  relation: '#faad14',
};

const NODE_SIZES: Record<string, number> = {
  concept: 60,
  entity: 44,
  relation: 36,
};

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

/** 按布局类型计算节点坐标（center 坐标）。 */
function computeLayout(nodes: GraphNode[], layout: LayoutType, height: number, width: number): PositionedNode[] {
  const centerX = width / 2;
  const centerY = height / 2;
  if (nodes.length === 0) return [];

  if (layout === 'circular') {
    const radius = Math.min(width, height) * 0.35;
    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      return { ...node, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    });
  }
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(width / (cols + 1), height / (Math.ceil(nodes.length / cols) + 1));
    return nodes.map((node, i) => ({
      ...node,
      x: spacing * ((i % cols) + 1),
      y: spacing * (Math.floor(i / cols) + 1),
    }));
  }
  // force：圆形初始化（后续 tick 由弹簧模型动画收敛）
  const radius = Math.min(width, height) * 0.3;
  return nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });
}

/** 简易力导向迭代（不依赖外部库）。 */
function forceLayoutTick(
  nodes: PositionedNode[],
  edges: { source: string; target: string }[],
  width: number,
  height: number,
): PositionedNode[] {
  const next = nodes.map((n) => ({ ...n, vx: 0, vy: 0 }));
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const dx = next[j].x - next[i].x;
      const dy = next[j].y - next[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 3000 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      next[i].vx -= fx;
      next[i].vy -= fy;
      next[j].vx += fx;
      next[j].vy += fy;
    }
  }

  const nodeMap = new Map(next.map((n) => [n.id, n]));
  for (const edge of edges) {
    const s = nodeMap.get(edge.source);
    const t = nodeMap.get(edge.target);
    if (!s || !t) continue;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 120) * 0.05;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    s.vx += fx;
    s.vy += fy;
    t.vx -= fx;
    t.vy -= fy;
  }

  for (const n of next) {
    n.vx += (centerX - n.x) * 0.005;
    n.vy += (centerY - n.y) * 0.005;
    n.vx *= 0.85;
    n.vy *= 0.85;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(40, Math.min(width - 40, n.x));
    n.y = Math.max(30, Math.min(height - 30, n.y));
  }
  return next;
}

export default function KnowledgeGraph({ data, height = 400, width, onNodeClick }: KnowledgeGraphProps) {
  const expandedNodesRef = useRef<Set<string>>(new Set());
  const forceAnimRef = useRef<number | null>(null);
  const historyRef = useRef<{ past: Array<{ nodes: GraphNode[]; edges: GraphEdge[] }>; future: Array<{ nodes: GraphNode[]; edges: GraphEdge[] }> }>({ past: [], future: [] });

  const [layout, setLayout] = useState<LayoutType>('force');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [historyStack, setHistoryStack] = useState({ canUndo: false, canRedo: false });
  const [expanding, setExpanding] = useState(false);
  // 数据版本：仅在数据真正变化（展开/折叠/撤销/重做）时 bump，供 memo 与 force effect 感知就地修改
  const [dataVersion, setDataVersion] = useState(0);
  // force 动画坐标（state：每帧更新触发重渲染，但不进入 effect 依赖）
  const [forcePos, setForcePos] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  /** 画布宽度：固定 width 优先。 */
  const graphWidth = useCallback((): number => {
    if (width) return width;
    return 800;
  }, [width]);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const vn = data.nodes.filter((n) => {
      if (typeFilter.length > 0 && !typeFilter.includes(n.type)) return false;
      if (collapsedNodes.has(n.id)) return false;
      return true;
    });
    const visibleIds = new Set(vn.map((n) => n.id));
    const ve = data.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
    return { visibleNodes: vn, visibleEdges: ve };
  }, [data, collapsedNodes, typeFilter, dataVersion]);

  const pushHistory = useCallback(() => {
    historyRef.current.past.push({ nodes: [...data.nodes], edges: [...data.edges] });
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
    setHistoryStack({ canUndo: true, canRedo: false });
  }, [data]);

  const restoreSnapshot = useCallback((snap: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
    data.nodes.length = 0;
    data.nodes.push(...snap.nodes);
    data.edges.length = 0;
    data.edges.push(...snap.edges);
    setDataVersion((v) => v + 1);
  }, [data]);

  /** 展开节点（REQ-035）：调用后端 expand 接口获取邻居子图；再点折叠。 */
  const handleExpand = useCallback(
    async (nodeId: string) => {
      if (expandedNodesRef.current.has(nodeId)) {
        pushHistory();
        expandedNodesRef.current.delete(nodeId);
        setCollapsedNodes((prev) => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
        setDataVersion((v) => v + 1);
        return;
      }
      setExpanding(true);
      try {
        const sub = await expandGraphNode(nodeId, 1);
        const existingIds = new Set(data.nodes.map((n) => n.id));
        const newNodes = sub.nodes.filter((n) => !existingIds.has(n.id));
        const existingEdgeIds = new Set(data.edges.map((e) => e.id));
        const newEdges = sub.edges.filter((e) => !existingEdgeIds.has(e.id));
        if (newNodes.length === 0 && newEdges.length === 0) {
          Toast.info('节点没有更多可展开的邻居');
        } else {
          pushHistory();
          data.nodes.push(...newNodes);
          data.edges.push(...newEdges);
          expandedNodesRef.current.add(nodeId);
          setCollapsedNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          setForcePos(null); // 新节点重新布局
          Toast.success(`展开成功：新增 ${newNodes.length} 节点 / ${newEdges.length} 边`);
          setDataVersion((v) => v + 1);
        }
      } finally {
        setExpanding(false);
      }
    },
    [data, pushHistory],
  );

  /** 撤销/重做（REQ-037）：快照栈。 */
  const handleUndo = useCallback(() => {
    const h = historyRef.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push({ nodes: [...data.nodes], edges: [...data.edges] });
    restoreSnapshot(prev);
    setHistoryStack({ canUndo: h.past.length > 0, canRedo: true });
  }, [data, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const h = historyRef.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push({ nodes: [...data.nodes], edges: [...data.edges] });
    restoreSnapshot(next);
    setHistoryStack({ canUndo: true, canRedo: h.future.length > 0 });
  }, [data, restoreSnapshot]);

  /** 节点/边规格。force 模式下先取动画坐标 state，没有则初始布局。 */
  const { nodeSpecs, edgeSpecs } = useMemo(() => {
    const w = graphWidth();
    let positioned = computeLayout(visibleNodes, layout, height, w);
    if (layout === 'force' && forcePos) {
      positioned = visibleNodes.map((n) => ({
        ...n,
        x: forcePos.get(n.id)?.x ?? w / 2,
        y: forcePos.get(n.id)?.y ?? height / 2,
      }));
    }
    const specs: GraphNodeSpec[] = positioned.map((node) => {
      const size = NODE_SIZES[node.type] || 40;
      const color = NODE_COLORS[node.type] || '#999';
      const hasHiddenNeighbors = data.edges.some(
        (e) =>
          (e.source === node.id || e.target === node.id) &&
          (collapsedNodes.has(e.source === node.id ? e.target : e.source) ||
            (typeFilter.length > 0 &&
              !typeFilter.includes(
                (data.nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source))?.type || ''),
              ))),
      );
      return {
        id: node.id,
        x: node.x,
        y: node.y,
        w: size,
        h: size,
        shape: 'ellipse',
        label: node.label,
        color,
        solid: selectedNode === node.id,
        dashed: hasHiddenNeighbors,
        selected: selectedNode === node.id,
        labelBelow: true,
        title: `${node.label}（${node.type}）`,
      };
    });
    const posMap = new Map(specs.map((s) => [s.id, s]));
    const especs: GraphEdgeSpec[] = visibleEdges
      .filter((e) => posMap.has(e.source) && posMap.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, width: 1.5 }));
    return { nodeSpecs: specs, edgeSpecs: especs };
  }, [visibleNodes, visibleEdges, layout, height, graphWidth, selectedNode, data, collapsedNodes, typeFilter, forcePos]);

  const worldWidth = graphWidth();
  const worldHeight = height;

  // force 动画读取最新可见集的 ref 通道（effect 只依赖布局参数与数据版本，
  // 动画自身每帧 setForcePos 触发重渲染，不会重启 effect，帧计数可正常终止）
  const visibleRef = useRef({ visibleNodes, visibleEdges });
  visibleRef.current = { visibleNodes, visibleEdges };

  /** 力导向动画：每帧迭代坐标并通过 setForcePos 触发重渲染。 */
  useEffect(() => {
    if (layout !== 'force') return;
    const w = graphWidth();
    // 初始坐标（圆形），每帧在闭包内迭代
    const init = computeLayout(visibleRef.current.visibleNodes, 'force', height, w);
    let positions = new Map(init.map((n) => [n.id, { x: n.x, y: n.y }]));
    setForcePos(new Map(positions));
    let frames = 0;
    const tick = () => {
      const positioned: PositionedNode[] = visibleRef.current.visibleNodes.map((n) => ({
        ...n,
        x: positions.get(n.id)?.x ?? w / 2,
        y: positions.get(n.id)?.y ?? height / 2,
      }));
      const edgePairs = visibleRef.current.visibleEdges.map((e) => ({ source: e.source, target: e.target }));
      const next = forceLayoutTick(positioned, edgePairs, w, height);
      positions = new Map(next.map((n) => [n.id, { x: n.x, y: n.y }]));
      frames += 1;
      setForcePos(positions);
      if (frames < 180) {
        forceAnimRef.current = requestAnimationFrame(tick);
      } else {
        forceAnimRef.current = null;
      }
    };
    forceAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (forceAnimRef.current) cancelAnimationFrame(forceAnimRef.current);
      forceAnimRef.current = null;
    };
  }, [layout, height, graphWidth, dataVersion]);

  /** 导出图谱（REQ-036）。 */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (format === 'json') {
        const json = { nodes: visibleNodes.map((n) => ({ id: n.id, label: n.label, type: n.type })), edges: visibleEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })) };
        downloadBlob(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `knowledge-graph-${Date.now()}.json`);
        Toast.success('已导出 JSON');
        return;
      }
      const svg = graphSpecsToSvg(nodeSpecs, edgeSpecs, worldWidth, worldHeight);
      if (format === 'svg') {
        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `knowledge-graph-${Date.now()}.svg`);
        Toast.success('已导出 SVG');
        return;
      }
      try {
        const dataUrl = await graphSpecsToPngDataUrl(svg);
        const link = document.createElement('a');
        link.download = `knowledge-graph-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        Toast.success('已导出 PNG');
      } catch {
        Toast.error('PNG 导出失败（椭圆节点图片跨域限制），请改用 SVG/JSON');
      }
    },
    [visibleNodes, visibleEdges, nodeSpecs, edgeSpecs, worldWidth, worldHeight],
  );

  return (
    <div>
      <Space style={{ marginBottom: 8, flexWrap: 'wrap' }} spacing="tight">
        <Typography.Text type="secondary">布局：</Typography.Text>
        <Select
          size="small"
          value={layout}
          onChange={(v) => { setForcePos(null); setLayout(v as LayoutType); }}
          style={{ width: 100 }}
          optionList={[
            { label: '力导向', value: 'force' },
            { label: '环形', value: 'circular' },
            { label: '网格', value: 'grid' },
          ]}
        />
        <Typography.Text type="secondary">类型：</Typography.Text>
        <Select
          size="small"
          multiple
          showClear
          placeholder="全部"
          value={typeFilter}
          onChange={(vals) => setTypeFilter((vals as string[]) ?? [])}
          style={{ minWidth: 140 }}
          optionList={[
            { label: '概念', value: 'concept' },
            { label: '实体', value: 'entity' },
            { label: '关系', value: 'relation' },
          ]}
        />
        <Tooltip content="撤销 (Undo)">
          <Button size="small" icon={<UndoOutlined />} disabled={!historyStack.canUndo} onClick={handleUndo} />
        </Tooltip>
        <Tooltip content="重做 (Redo)">
          <Button size="small" icon={<RedoOutlined />} disabled={!historyStack.canRedo} onClick={handleRedo} />
        </Tooltip>
        <Tooltip content="导出 PNG">
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleExport('png')} />
        </Tooltip>
        <Tooltip content="导出 SVG">
          <Button size="small" onClick={() => handleExport('svg')}>SVG</Button>
        </Tooltip>
        <Tooltip content="导出 JSON">
          <Button size="small" onClick={() => handleExport('json')}>JSON</Button>
        </Tooltip>
        <Tooltip content={expanding ? '正在展开...' : '展开/折叠选中节点'}>
          <Button
            size="small"
            icon={selectedNode && expandedNodesRef.current.has(selectedNode) ? <CompressOutlined /> : <ExpandAltOutlined />}
            disabled={!selectedNode || expanding}
            loading={expanding}
            onClick={() => selectedNode && handleExpand(selectedNode)}
          />
        </Tooltip>
        <Tooltip content="重置视图">
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setResetSignal((s) => s + 1)} />
        </Tooltip>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {visibleNodes.length} 节点 / {visibleEdges.length} 边
          {selectedNode && <Tag color="blue" style={{ marginLeft: 8 }}>已选: {selectedNode.slice(0, 8)}</Tag>}
        </Typography.Text>
      </Space>
      <SemiGraphCanvas
        nodes={nodeSpecs}
        edges={edgeSpecs}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        height={height}
        width={width}
        resetSignal={resetSignal}
        showGrid
        background="var(--muted)"
        onNodeClick={(id) => {
          setSelectedNode(id);
          const node = data.nodes.find((n) => n.id === id);
          onNodeClick?.(id, node?.type || 'entity');
        }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
        提示：单击节点查看详情 / 拖拽平移 / 点击展开按钮加载子节点
      </Typography.Text>
    </div>
  );
}

/** 触发浏览器下载 Blob。 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
