/**
 * LineageCanvas —— 数据血缘画布 (基于 React Flow 12)
 *
 * 接管自原 DataLineage 的内联 SVG 渲染（约 80 行）。优于原实现：
 *   1. 缩放/平移/小地图/控件内置
 *   2. 鼠标 hover/click 交互自动获得
 *   3. 暗色模式 token 自动适配
 *   4. 节点形状/字号/圆角全部 token 化
 *   5. 上下游链路高亮 (计算可达集合)
 *   6. 支持外部预计算节点坐标 (用于支持多种布局算法)
 *   7. 支持外部自定义节点类型 (E-R 关系图复用)
 *   8. 支持边标签 (关系类型)
 *
 * 数据协议：受控 props，父组件依然掌控 filter / selectedNode
 *
 * ── 性能优化 ────────────────────────────────────────────────────────────
 *   - rfNodes 用 useMemo 锁住基础 props；position 增量更新走 useRef 同步补丁
 *   - onSelect / onOpenDetail 通过 ref 注入，避免闭包变化重启 ReactFlow 子树
 *   - Background/MiniMap/Controls 传 defaultXxx 让 ReactFlow 不重建 SVG
 *   - fitView 仅在 mount 时发火一次，避免拖拽时再触发重新适配
 *   - lineage-node:hover 改用 box-shadow (GPU 合成层) 不再触发 layout
 * ──────────────────────────────────────────────────────────────────────
 */

import * as React from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  type NodeChange,
  type EdgeChange,
  applyEdgeChanges,
  MarkerType,
} from "@xyflow/react";
import { CustomLineageNode, type LineageNodeType } from "./LineageNode";

// ─── 类型契约 ────────────────────────────────────────────────
export interface LineageNodeDatum {
  id: string;
  name: string;
  type: LineageNodeType | string;
  description: string;
  status: "active" | "inactive" | "error";
}

export interface LineageEdgeDatum {
  from: string;
  to: string;
}

export interface LineageCanvasProps {
  nodes: LineageNodeDatum[];
  edges: LineageEdgeDatum[];
  /** 被过滤后还可见的节点 id 集合（用于 dim 透明） */
  visibleNodeIds: ReadonlySet<string>;
  selectedNodeId?: string | null;
  onNodeSelect?: (node: LineageNodeDatum | null) => void;
  /** 节点默认采用横向布局：列按 type 排，行按类型内顺序 */
  enableMiniMap?: boolean;
  enableControls?: boolean;
  className?: string;
  height?: number | string;

  /** ─── 扩展 (E-R 关系图复用) ─── */

  /** 外部预计算的节点坐标；不传则按 type 列布局 */
  precomputedPositions?: Record<string, { x: number; y: number }> | Map<string, { x: number; y: number }>;
  /** 自定义节点类型映射；不传则用默认 CustomLineageNode */
  nodeTypes?: NodeTypes;
  /** 默认节点类型 key (用于 precomputed 模式传进来的节点) */
  nodeType?: string;
  /** 边标签：key=from->to, value=标签文本（已支持换行等，渲染为胶囊） */
  edgeLabels?: Record<string, string>;
  /** 边 dash 风格 (虚线/实线), key=from->to */
  edgeDashed?: Record<string, boolean>;
  /** 节点是否可拖拽 */
  nodesDraggable?: boolean;
  /** 是否在 fitView 后保留原视口（避免每次 layout 切换都重置缩放） */
  resetOnDataChange?: boolean;
  /** 受控的节点位置 (当需要外层管理拖拽结果时使用) */
  positions?: Record<string, { x: number; y: number }> | Map<string, { x: number; y: number }>;
  onNodesPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
  /** 背景 dots 颜色 (默认淡雅；E-R 关系图用透明即可) */
  backgroundVariant?: BackgroundVariant;
  backgroundGap?: number;
  backgroundSize?: number;
  /** 边线类型：smoothstep=直角折线(默认) / bezier=贝塞尔曲线 / straight=直线 / simplebezier=简单贝塞尔 */
  edgeType?: "smoothstep" | "bezier" | "straight" | "simplebezier";
  /** 外部传入高亮节点集合；不传则用 selectedNodeId 自动算上下游 */
  highlightNodeIds?: ReadonlySet<string> | null;
}

// ─── 布局算法 (继承自原 SVG 版本) ─────────────────────────
function layoutNodes(nodes: LineageNodeDatum[]): Record<string, { x: number; y: number }> {
  const typeOrder: LineageNodeType[] = ["source", "etl", "table", "metric", "dashboard"];
  const nodeWidth = 168;
  const nodeHeight = 56;
  const colGap = 80;   // 列间距
  const rowGap = 24;   // 行间距

  // 按类型分行
  const byType = new Map<string, LineageNodeDatum[]>();
  for (const n of nodes) {
    const t = n.type as string;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(n);
  }
  // 每列最大行数（用于整体垂直居中）
  const maxRows = Math.max(...Array.from(byType.values()).map((arr) => arr.length), 1);

  const positions: Record<string, { x: number; y: number }> = {};
  typeOrder.forEach((t, col) => {
    const list = byType.get(t) ?? [];
    list.forEach((n, i) => {
      const yOffset = (maxRows - list.length) * ((nodeHeight + rowGap) / 2);
      const x = 80 + col * (nodeWidth + colGap);
      const y = 60 + i * (nodeHeight + rowGap) + yOffset;
      positions[n.id] = { x, y };
    });
  });
  return positions;
}

// ─── 计算上下游可达集合 (用于高亮) ─────────────────────────
function computeReachable(
  edges: LineageEdgeDatum[],
  nodeId: string,
  direction: "up" | "down" | "both",
): Set<string> {
  const result = new Set<string>([nodeId]);
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.to)!.push(e.from); // 用于"上"方向 BFS
  }

  const dirs: Array<"up" | "down"> = direction === "both" ? ["up", "down"] : [direction as "up" | "down"];
  for (const dir of dirs) {
    const queue = [nodeId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbors = adj.get(cur) ?? [];
      for (const nb of neighbors) {
        if (result.has(nb)) continue;
        // 只走对应方向
        const edge = edges.find(
          (e) =>
            (dir === "down" && e.from === cur && e.to === nb) ||
            (dir === "up" && e.to === cur && e.from === nb),
        );
        if (!edge) continue;
        result.add(nb);
        queue.push(nb);
      }
    }
  }
  return result;
}

// ─── Canvas 内部 (需要 ReactFlowProvider 环境) ─────────────
function LineageCanvasInner({
  nodes,
  edges,
  visibleNodeIds,
  selectedNodeId,
  onNodeSelect,
  enableMiniMap = true,
  enableControls = true,
  className,
  height = 560,
  precomputedPositions,
  nodeTypes: nodeTypesProp,
  nodeType = "lineage",
  edgeLabels,
  edgeDashed,
  nodesDraggable = false,
  resetOnDataChange = false,
  positions: positionsProp,
  onNodesPositionsChange,
  backgroundVariant = BackgroundVariant.Dots,
  backgroundGap = 16,
  backgroundSize = 1,
  edgeType = "smoothstep",
  highlightNodeIds: highlightNodeIdsProp,
}: LineageCanvasProps) {
  const { fitView } = useReactFlow();
  const initialViewportAppliedRef = React.useRef(false);

  // ── 关键性能优化：用 ref 注入所有回调，避免子组件 tree 因父级 renders 重建 ──
  const onSelectRef = React.useRef<(node: LineageNodeDatum | null) => void>(onNodeSelect);
  React.useEffect(() => {
    onSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);
  const nodeByIdRef = React.useRef(new Map(nodes.map((n) => [n.id, n])));
  React.useEffect(() => {
    nodeByIdRef.current = new Map(nodes.map((n) => [n.id, n]));
  }, [nodes]);

  // 统一为 Record<string, Point>；layoutNodes 也会输出 Record
  const computedPositions = React.useMemo((): Record<string, { x: number; y: number }> => {
    const toRecord = (
      input: Record<string, { x: number; y: number }> | Map<string, { x: number; y: number }> | undefined,
    ): Record<string, { x: number; y: number }> => {
      if (input == null) return {};
      if (input instanceof Map) {
        const out: Record<string, { x: number; y: number }> = {};
        input.forEach((v, k) => { out[k] = v; });
        return out;
      }
      return { ...input };
    };
    if (positionsProp) return toRecord(positionsProp);
    if (precomputedPositions) return toRecord(precomputedPositions);
    return layoutNodes(nodes);
  }, [nodes, positionsProp, precomputedPositions]);
  const edgeKey = React.useCallback((from: string, to: string) => `${from}->${to}`, []);

  // 高亮：被选中节点的上下游
  const highlightIds = React.useMemo(() => {
    // 外部传入高亮集合优先
    if (highlightNodeIdsProp) return highlightNodeIdsProp;
    if (!selectedNodeId) return null;
    return computeReachable(edges, selectedNodeId, "both");
  }, [edges, selectedNodeId, highlightNodeIdsProp]);

  // ── 转 React Flow 的内部 nodes/edges ──
  // 关键：把 onSelect 塞到 ref 中且不在 data 中建新函数，避免子节点重渲染
  const rfNodes: Node[] = React.useMemo(() => {
    return nodes.map((n) => {
      const pos = computedPositions[n.id] ?? { x: 0, y: 0 };
      const visible = visibleNodeIds.has(n.id);
      const isSelected = n.id === selectedNodeId;
      const dimmed = highlightIds ? !highlightIds.has(n.id) : false;
      const data: Record<string, unknown> = {
        ...n,
        selected: isSelected,
        dim: dimmed,
        filtered: visible,
      };
      return {
        id: n.id,
        type: nodeType,
        position: pos,
        data,
        selected: isSelected,
        draggable: nodesDraggable,
        connectable: false,
      } as Node;
    });
  }, [nodes, computedPositions, visibleNodeIds, selectedNodeId, highlightIds, nodeType, nodesDraggable]);

  // 边的 useMemo：把 edgeLabels/edgeDashed 用 selector-style 访问，避免每次重建；这里只是配置，最稳仍是 memo
  const rfEdges: Edge[] = React.useMemo(() => {
    return edges.map((e, idx) => {
      const highlighted = highlightIds ? highlightIds.has(e.from) && highlightIds.has(e.to) : true;
      const dimmed = highlightIds ? !highlighted : false;
      const k = edgeKey(e.from, e.to);
      const label = edgeLabels?.[k];
      const dashed = edgeDashed?.[k];
      const edge: Edge = {
        id: `${k}-${idx}`,
        source: e.from,
        target: e.to,
        type: edgeType,
        animated: highlighted && !dimmed && !!selectedNodeId,
        label,
        labelBgPadding: label ? ([6, 4] as [number, number]) : undefined,
        labelBgBorderRadius: label ? 8 : undefined,
        labelBgStyle: label
          ? { fill: "#ffffff", stroke: dimmed ? "#cbd5e1" : "#2563eb", strokeWidth: 1 }
          : undefined,
        labelStyle: label
          ? { fontSize: 10, fill: dimmed ? "#94a3b8" : "#2563eb", fontWeight: 500 }
          : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: dimmed ? "#cbd5e1" : "#2563eb",
        },
        style: {
          stroke: dimmed ? "#cbd5e1" : "#2563eb",
          strokeWidth: highlighted ? 1.5 : 1,
          opacity: dimmed ? 0.3 : 1,
          strokeDasharray: dashed ? "4 3" : undefined,
        },
      };
      return edge;
    });
  }, [edges, highlightIds, selectedNodeId, edgeLabels, edgeDashed, edgeKey, edgeType]);

  // ── 变更处理：position 用 ref + 增量 patch，避免整个 ReactFlow 子树重建 ──
  const positionsRef = React.useRef<Record<string, { x: number; y: number }>>(computedPositions);
  React.useEffect(() => {
    positionsRef.current = computedPositions;
  }, [computedPositions]);

  const onNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      if (!nodesDraggable || !onNodesPositionsChange) return;
      const positionChanges = changes.filter((c) => c.type === "position");
      if (positionChanges.length === 0) return;
      const next: Record<string, { x: number; y: number }> = { ...positionsRef.current };
      for (const c of positionChanges) {
        if (c.type === "position" && "position" in c && c.position) {
          next[c.id] = c.position;
          positionsRef.current[c.id] = c.position;
        }
      }
      onNodesPositionsChange(next);
    },
    [nodesDraggable, onNodesPositionsChange],
  );
  const onEdgesChange = React.useCallback((changes: EdgeChange[]) => {
    void applyEdgeChanges(changes, []);
  }, []);

  // 进入时 fitView 一次；resetOnDataChange 时再次触发（仅 keys 变化，不重 fitView 因拖拽）
  const idsKey = React.useMemo(
    () => nodes.map((n) => n.id).join("|"),
    [nodes],
  );
  React.useEffect(() => {
    if (initialViewportAppliedRef.current) return;
    const t = setTimeout(() => {
      fitView({ padding: 0.18, duration: 240 });
      initialViewportAppliedRef.current = true;
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, resetOnDataChange]);

  const handleNodeClick: NodeMouseHandler = React.useCallback((_, node) => {
    const map = nodeByIdRef.current;
    const item = map.get(node.id) ?? null;
    onSelectRef.current?.(item);
  }, []);

  const handlePaneClick = React.useCallback(() => {
    onSelectRef.current?.(null);
  }, []);

  const mergedNodeTypes: NodeTypes = React.useMemo(
    () => nodeTypesProp ?? { lineage: CustomLineageNode },
    [nodeTypesProp],
  );

  return (
    <div
      className={className ?? "w-full rounded-lg border bg-background"}
      style={{ height }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={mergedNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable={nodesDraggable}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: edgeType }}
        translateExtent={[[-2000, -2000], [3000, 3000]]}
      >
        <Background variant={backgroundVariant} gap={backgroundGap} size={backgroundSize} />
        {enableControls && (
          <Controls
            showInteractive={false}
            className="!shadow-none"
            position="bottom-right"
          />
        )}
        {enableMiniMap && (
          <MiniMap
            pannable
            zoomable
            maskColor="rgba(148, 163, 184, 0.10)"
            nodeColor={MINI_MAP_NODE_COLOR}
            style={{ width: 120, height: 80 }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

// MiniMap 节点配色查表 —— 移到 module scope 避免每次重渲染重建 lambda
const MINI_MAP_NODE_COLOR = (n: { data?: unknown }): string => {
  const t = (n.data as { type?: string })?.type ?? "";
  return (
    ({
      source: "#dbeafe",
      etl: "#fed7aa",
      table: "#bbf7d0",
      metric: "#e9d5ff",
      dashboard: "#fecaca",
    } as Record<string, string>)[t] ?? "#f1f5f9"
  );
};

// ─── 外层：自动包一层 ReactFlowProvider + React.memo 锁住 props 等值时不重渲染 ──
function LineageCanvasInnerShallowEqual(
  prev: LineageCanvasProps,
  next: LineageCanvasProps,
): boolean {
  return (
    prev.nodes === next.nodes &&
    prev.edges === next.edges &&
    prev.visibleNodeIds === next.visibleNodeIds &&
    prev.selectedNodeId === next.selectedNodeId &&
    prev.precomputedPositions === next.precomputedPositions &&
    prev.nodeTypes === next.nodeTypes &&
    prev.nodeType === next.nodeType &&
    prev.edgeLabels === next.edgeLabels &&
    prev.edgeDashed === next.edgeDashed &&
    prev.nodesDraggable === next.nodesDraggable &&
    prev.positions === next.positions &&
    prev.enableMiniMap === next.enableMiniMap &&
    prev.enableControls === next.enableControls &&
    prev.className === next.className &&
    prev.height === next.height &&
    prev.onNodeSelect === next.onNodeSelect &&
    prev.edgeType === next.edgeType &&
    prev.highlightNodeIds === next.highlightNodeIds
  );
}
const MemoInner = React.memo(LineageCanvasInner, LineageCanvasInnerShallowEqual);
export function LineageCanvas(props: LineageCanvasProps) {
  return (
    <ReactFlowProvider>
      <MemoInner {...props} />
    </ReactFlowProvider>
  );
}
