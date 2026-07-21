import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Select, Space, Typography, Tooltip, Tag, message } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExpandAltOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { Graph, Shape } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import type { GraphData, GraphNode } from '@/types';
import { expandGraphNode } from '@/api/ontology';

interface KnowledgeGraphProps {
  data: GraphData;
  height?: number;
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

const WIDTH = 800;

/** 按布局类型计算节点坐标。 */
function computeLayout(nodes: GraphNode[], layout: LayoutType, height: number): PositionedNode[] {
  const centerX = WIDTH / 2;
  const centerY = height / 2;
  if (nodes.length === 0) return [];

  if (layout === 'circular') {
    const radius = Math.min(WIDTH, height) * 0.35;
    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      return { ...node, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
    });
  }
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = Math.min(WIDTH / (cols + 1), height / (Math.ceil(nodes.length / cols) + 1));
    return nodes.map((node, i) => ({
      ...node,
      x: spacing * ((i % cols) + 1),
      y: spacing * (Math.floor(i / cols) + 1),
    }));
  }
  // force：用圆形随机扰动初始化，后续 tick 由简易弹簧模型迭代
  const radius = Math.min(WIDTH, height) * 0.3;
  return nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
      y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
    };
  });
}

/** 简易力导向迭代（不依赖外部库）。 */
interface ForceNode extends PositionedNode {
  vx: number;
  vy: number;
}

function forceLayoutTick(
  nodes: PositionedNode[],
  edges: { source: string; target: string }[],
  width: number,
  height: number,
): PositionedNode[] {
  const next: ForceNode[] = nodes.map((n) => ({ ...n, vx: 0, vy: 0 }));
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

  // 弹簧吸引（沿边收缩）
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

export default function KnowledgeGraph({ data, height = 400, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const expandedNodesRef = useRef<Set<string>>(new Set());
  const forceAnimRef = useRef<number | null>(null);

  const [layout, setLayout] = useState<LayoutType>('force');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [historyStack, setHistoryStack] = useState<{ canUndo: boolean; canRedo: boolean }>({
    canUndo: false,
    canRedo: false,
  });
  const [expanding, setExpanding] = useState(false);

  /** 初始化 X6 图实例（含 History 插件）。 */
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      width: WIDTH,
      height,
      grid: { visible: true, type: 'dot', args: { color: '#f0f0f0', thickness: 1 } },
      background: { color: '#fafafa' },
      panning: { enabled: true, modifiers: [] },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'], minScale: 0.3, maxScale: 3 },
      interacting: { nodeMovable: true, edgeMovable: false, magnetConnectable: false },
    });

    graph.use(new History({ enabled: true }));

    graph.on('node:click', ({ node }) => {
      const nodeId = String(node.id);
      const nodeType = String(node.getData()?.type || 'entity');
      setSelectedNode(nodeId);
      onNodeClick?.(nodeId, nodeType);
    });

    graph.on('history:change', () => {
      setHistoryStack({ canUndo: graph.canUndo(), canRedo: graph.canRedo() });
    });

    graphRef.current = graph;
    return () => {
      if (forceAnimRef.current) {
        cancelAnimationFrame(forceAnimRef.current);
        forceAnimRef.current = null;
      }
      graph.dispose();
      graphRef.current = null;
    };
  }, [height, onNodeClick]);

  /** 计算当前可见节点/边（按折叠状态与类型筛选）。 */
  const computeVisible = useCallback(() => {
    const collapsed = collapsedNodes;
    const visibleNodes = data.nodes.filter((n) => {
      if (typeFilter.length > 0 && !typeFilter.includes(n.type)) return false;
      if (collapsed.has(n.id)) return false;
      return true;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = data.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );
    return { visibleNodes, visibleEdges };
  }, [data, collapsedNodes, typeFilter]);

  /** 渲染图谱到 X6。 */
  const renderGraph = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const { visibleNodes, visibleEdges } = computeVisible();
    const positioned = computeLayout(visibleNodes, layout, height);

    graph.clearCells();
    graph.startBatch('render');

    positioned.forEach((node) => {
      const size = NODE_SIZES[node.type] || 40;
      const color = NODE_COLORS[node.type] || '#999';
      const isSelected = selectedNode === node.id;
      const hasHiddenNeighbors = data.edges.some(
        (e) =>
          (e.source === node.id || e.target === node.id) &&
          (collapsedNodes.has(e.source === node.id ? e.target : e.source) ||
            (typeFilter.length > 0 &&
              !typeFilter.includes(
                (data.nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source))?.type || ''),
              ))),
      );

      graph.addNode({
        id: node.id,
        shape: 'ellipse',
        x: node.x - size / 2,
        y: node.y - size / 2,
        width: size,
        height: size,
        label: node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label,
        attrs: {
          body: {
            fill: isSelected ? color : `${color}33`,
            stroke: color,
            strokeWidth: isSelected ? 3 : 2,
            strokeDasharray: hasHiddenNeighbors ? '4,4' : null,
          },
          label: {
            fontSize: 11,
            fill: '#333',
            fontWeight: node.type === 'concept' ? 600 : 400,
            refY: size / 2 + 14,
          },
        },
        data: { type: node.type, label: node.label, properties: node.properties },
      });
    });

    visibleEdges.forEach((edge) => {
      graph.addEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        router: { name: 'normal' },
        attrs: {
          line: {
            stroke: '#bbb',
            strokeWidth: 1.5,
            targetMarker: { name: 'block', width: 8, height: 6 },
          },
          label: { fontSize: 10, fill: '#999' },
        },
      });
    });

    graph.stopBatch('render');
  }, [computeVisible, layout, height, selectedNode, data, collapsedNodes, typeFilter]);

  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  /** 力导向布局动画。 */
  useEffect(() => {
    if (layout !== 'force') {
      if (forceAnimRef.current) {
        cancelAnimationFrame(forceAnimRef.current);
        forceAnimRef.current = null;
      }
      return;
    }
    const graph = graphRef.current;
    if (!graph) return;

    const tick = () => {
      const nodes = graph.getNodes();
      if (nodes.length === 0) return;
      const positioned: PositionedNode[] = nodes.map((n) => {
        const pos = n.getPosition();
        return {
          id: String(n.id),
          label: String(n.getData()?.label || ''),
          type: n.getData()?.type || 'entity',
          x: pos.x + (n.getSize().width || 40) / 2,
          y: pos.y + (n.getSize().height || 40) / 2,
        };
      });
      const edges = graph.getEdges().map((e) => ({
        source: String(e.getSourceCellId()),
        target: String(e.getTargetCellId()),
      }));
      const next = forceLayoutTick(positioned, edges, WIDTH, height);
      next.forEach((n) => {
        const cell = graph.getCellById(n.id);
        if (cell && cell.isNode()) {
          const size = cell.getSize();
          cell.setPosition(n.x - size.width / 2, n.y - size.height / 2, { silent: true });
        }
      });
      forceAnimRef.current = requestAnimationFrame(tick);
    };
    forceAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (forceAnimRef.current) {
        cancelAnimationFrame(forceAnimRef.current);
        forceAnimRef.current = null;
      }
    };
  }, [layout, height, data]);

  /** 展开节点（REQ-035）：调用后端 expand 接口获取邻居子图。 */
  const handleExpand = useCallback(
    async (nodeId: string) => {
      const graph = graphRef.current;
      if (!graph) return;
      if (expandedNodesRef.current.has(nodeId)) {
        // 已展开则折叠
        expandedNodesRef.current.delete(nodeId);
        setCollapsedNodes((prev) => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
        return;
      }
      setExpanding(true);
      try {
        const sub = await expandGraphNode(nodeId, 1);
        // 将新节点合并入 data（通过 trigger data 重新渲染依赖）
        const existingIds = new Set(data.nodes.map((n) => n.id));
        const newNodes = sub.nodes.filter((n) => !existingIds.has(n.id));
        const existingEdgeIds = new Set(data.edges.map((e) => e.id));
        const newEdges = sub.edges.filter((e) => !existingEdgeIds.has(e.id));
        if (newNodes.length === 0 && newEdges.length === 0) {
          message.info('节点没有更多可展开的邻居');
        } else {
          data.nodes.push(...newNodes);
          data.edges.push(...newEdges);
          expandedNodesRef.current.add(nodeId);
          setCollapsedNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          message.success(`展开成功：新增 ${newNodes.length} 节点 / ${newEdges.length} 边`);
        }
      } finally {
        setExpanding(false);
      }
    },
    [data],
  );

  /** 导出图谱（REQ-036）。 */
  const handleExport = useCallback(
    (format: ExportFormat) => {
      const graph = graphRef.current;
      if (!graph) {
        message.error('图谱尚未初始化');
        return;
      }
      if (format === 'json') {
        const json = graph.toJSON();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `knowledge-graph-${Date.now()}.json`);
        message.success('已导出 JSON');
        return;
      }
      if (format === 'svg') {
        (graph as any).toSVG((svg: string) => {
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          downloadBlob(blob, `knowledge-graph-${Date.now()}.svg`);
          message.success('已导出 SVG');
        });
        return;
      }
      (graph as any).toPNG((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `knowledge-graph-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        message.success('已导出 PNG');
      });
    },
    [],
  );

  /** 撤销（REQ-037）。 */
  const handleUndo = useCallback(() => {
    graphRef.current?.undo();
  }, []);

  /** 重做（REQ-037）。 */
  const handleRedo = useCallback(() => {
    graphRef.current?.redo();
  }, []);

  const { visibleNodes, visibleEdges } = computeVisible();

  return (
    <div>
      <Space style={{ marginBottom: 8, flexWrap: 'wrap' }} size="small">
        <Typography.Text type="secondary">布局：</Typography.Text>
        <Select
          size="small"
          value={layout}
          onChange={(v) => setLayout(v)}
          style={{ width: 100 }}
          options={[
            { label: '力导向', value: 'force' },
            { label: '环形', value: 'circular' },
            { label: '网格', value: 'grid' },
          ]}
        />
        <Typography.Text type="secondary">类型：</Typography.Text>
        <Select
          size="small"
          mode="multiple"
          allowClear
          placeholder="全部"
          value={typeFilter}
          onChange={(vals) => setTypeFilter(vals as string[])}
          style={{ minWidth: 140 }}
          options={[
            { label: '概念', value: 'concept' },
            { label: '实体', value: 'entity' },
            { label: '关系', value: 'relation' },
          ]}
        />
        <Tooltip title="撤销 (Undo)">
          <Button
            size="small"
            icon={<UndoOutlined />}
            disabled={!historyStack.canUndo}
            onClick={handleUndo}
          />
        </Tooltip>
        <Tooltip title="重做 (Redo)">
          <Button
            size="small"
            icon={<RedoOutlined />}
            disabled={!historyStack.canRedo}
            onClick={handleRedo}
          />
        </Tooltip>
        <Tooltip title="导出 PNG">
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleExport('png')} />
        </Tooltip>
        <Tooltip title="导出 SVG">
          <Button size="small" onClick={() => handleExport('svg')}>
            SVG
          </Button>
        </Tooltip>
        <Tooltip title="导出 JSON">
          <Button size="small" onClick={() => handleExport('json')}>
            JSON
          </Button>
        </Tooltip>
        <Tooltip title={expanding ? '正在展开...' : '展开/折叠选中节点'}>
          <Button
            size="small"
            icon={selectedNode && expandedNodesRef.current.has(selectedNode) ? <CompressOutlined /> : <ExpandAltOutlined />}
            disabled={!selectedNode || expanding}
            loading={expanding}
            onClick={() => selectedNode && handleExpand(selectedNode)}
          />
        </Tooltip>
        <Tooltip title="重置视图">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              graphRef.current?.zoomTo(1);
              graphRef.current?.centerContent();
            }}
          />
        </Tooltip>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {visibleNodes.length} 节点 / {visibleEdges.length} 边
          {selectedNode && <Tag color="blue" style={{ marginLeft: 8 }}>已选: {selectedNode.slice(0, 8)}</Tag>}
        </Typography.Text>
      </Space>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fafafa',
        }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
        提示：单击节点查看详情 / Ctrl+滚轮缩放 / 拖拽平移 / 点击展开按钮加载子节点
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

/** 引用 Shape 防止 tree-shaking 移除内置形状注册。 */
void Shape;
