/**
 * FlowCanvas
 * --------------------------------------------------
 * 轻量自绘 fixed-layout 画布：
 * - 节点可拖拽、单击选中、双击/面板编辑（见 FlowPropertyPanel）
 * - 工具栏支持缩放 + 适应屏幕
 * - 拖入面板节点生成新节点
 * - 节点右侧输出端口拖到目标节点左侧输入端口建立连线
 *
 * 当前阶段不耦合 FlowGram fixed-layout-editor 内部 Inversify 容器，
 * 数据模型仍可与 FlowGram JSON 通过 flow-adapter.ts 双向转换。
 *
 * 后续若启用 FlowGram 全套渲染，只需把这里的 <g> 节点替换为
 * `<NodeRenderer>` 并将节点数据集通过 FlowGramDocumentJSON.fromJSON 注入。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useFlowContext } from './FlowContext';
import { PALETTE_DRAG_MIME } from './FlowPalette';
import type { FlowEdge, FlowNode, FlowNodeMaterial } from './flow-types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

interface NodePosition {
  x: number;
  y: number;
}

interface PendingEdge {
  sourceId: string;
  pointer: { x: number; y: number };
}

export interface FlowCanvasProps {
  materialsByType: Record<string, FlowNodeMaterial>;
  materials: FlowNodeMaterial[];
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

function nanoId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getDefaultSize(material: FlowNodeMaterial | undefined, fallback = { width: 120, height: 60 }) {
  return {
    width: material?.defaultWidth ?? fallback.width,
    height: material?.defaultHeight ?? fallback.height,
  };
}

export function FlowCanvas({
  materialsByType,
  materials,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
  zoomStep = ZOOM_STEP,
  zoom: zoomProp,
  onZoomChange,
}: FlowCanvasProps) {
  const { data, setData, selectedNodeId, setSelectedNodeId } = useFlowContext();

  const [zoom, setZoom] = useState(zoomProp ?? 1);
  const [pan, setPan] = useState<NodePosition>({ x: 40, y: 40 });
  const [dragNode, setDragNode] = useState<{ id: string; offset: NodePosition } | null>(null);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (zoomProp !== undefined) setZoom(zoomProp);
  }, [zoomProp]);

  const emitZoom = useCallback(
    (next: number) => {
      setZoom(next);
      onZoomChange?.(next);
    },
    [onZoomChange],
  );

  const zoomIn = () => emitZoom(Math.min(zoom + zoomStep, maxZoom));
  const zoomOut = () => emitZoom(Math.max(zoom - zoomStep, minZoom));
  const fitView = () => {
    emitZoom(1);
    setPan({ x: 40, y: 40 });
  };

  const handleNodeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
    node: FlowNode,
  ) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode({
      id: node.id,
      offset: {
        x: (event.clientX - rect.left - pan.x) / zoom - node.x,
        y: (event.clientY - rect.top - pan.y) / zoom - node.y,
      },
    });
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragNode) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (event.clientX - rect.left - pan.x) / zoom - dragNode.offset.x;
      const y = (event.clientY - rect.top - pan.y) / zoom - dragNode.offset.y;
      setData({
        ...data,
        nodes: data.nodes.map((n) => (n.id === dragNode.id ? { ...n, x, y } : n)),
      });
    }
    if (pendingEdge && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - pan.x) / zoom;
      const y = (event.clientY - rect.top - pan.y) / zoom;
      setPendingEdge({ ...pendingEdge, pointer: { x, y } });
    }
  };

  const handleMouseUp = () => {
    setDragNode(null);
    setPendingEdge(null);
  };

  const handleCanvasClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) setSelectedNodeId(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData(PALETTE_DRAG_MIME);
    if (!raw) return;
    let parsed: { type: string } | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed) return;
    const material = materialsByType[parsed.type];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;
    const id = nanoId(parsed.type.replace(/\./g, '_'));
    const { width, height } = getDefaultSize(material);
    const newNode: FlowNode = {
      id,
      type: parsed.type,
      name: material?.name ?? '节点',
      x,
      y,
      width,
      height,
      data: material?.defaultData ? { ...material.defaultData } : undefined,
    };
    setData({ ...data, nodes: [...data.nodes, newNode] });
    setSelectedNodeId(id);
  };

  const handlePortMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
    node: FlowNode,
  ) => {
    event.stopPropagation();
    setPendingEdge({
      sourceId: node.id,
      pointer: { x: node.x + (node.width ?? 100), y: node.y + (node.height ?? 60) / 2 },
    });
  };

  const handlePortMouseUp = (
    event: ReactMouseEvent<HTMLDivElement>,
    node: FlowNode,
  ) => {
    if (!pendingEdge) return;
    if (pendingEdge.sourceId === node.id) return;
    event.stopPropagation();
    const exists = data.edges.some(
      (e) => e.source === pendingEdge.sourceId && e.target === node.id,
    );
    if (exists) {
      setPendingEdge(null);
      return;
    }
    const newEdge: FlowEdge = {
      id: nanoId('edge'),
      source: pendingEdge.sourceId,
      target: node.id,
    };
    setData({
      ...data,
      edges: [...data.edges, newEdge],
    });
    setPendingEdge(null);
  };

  const renderNode = (node: FlowNode) => {
    const material = materialsByType[node.type];
    const Component = material?.component;
    const selected = node.id === selectedNodeId;
    const width = node.width ?? material?.defaultWidth ?? 120;
    const height = node.height ?? material?.defaultHeight ?? 60;
    return (
      <div
        key={node.id}
        onMouseDown={(e) => handleNodeMouseDown(e, node)}
        onMouseUp={(e) => handlePortMouseUp(e, node)}
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
          width,
          minHeight: height,
          userSelect: 'none',
        }}
      >
        <div
          className="flow-node"
          data-selected={selected}
          style={{
            position: 'relative',
            minHeight: height,
            padding: Component ? undefined : '10px 12px',
          }}
        >
          {Component ? (
            <Component node={node} selected={selected} />
          ) : (
            <div>
              <div className="flow-node__title">{node.name}</div>
              <div className="flow-node__subtitle">未注册类型：{node.type}</div>
            </div>
          )}
          {/* 输出端口（右侧） */}
          <div
            onMouseDown={(e) => handlePortMouseDown(e, node)}
            className="flow-port"
            style={{
              position: 'absolute',
              right: -6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--flow-port-fill)',
              border: '1px solid var(--flow-port-border)',
              cursor: 'crosshair',
            }}
            aria-label="输出端口"
          />
        </div>
      </div>
    );
  };

  const renderEdges = useMemo(() => {
    return data.edges.map((edge) => {
      const source = data.nodes.find((n) => n.id === edge.source);
      const target = data.nodes.find((n) => n.id === edge.target);
      if (!source || !target) return null;
      const x1 = source.x + (source.width ?? 120);
      const y1 = source.y + (source.height ?? 60) / 2;
      const x2 = target.x;
      const y2 = target.y + (target.height ?? 60) / 2;
      const mid = Math.max(20, Math.abs(x2 - x1) / 2);
      const path = `M ${x1},${y1} C ${x1 + mid},${y1} ${x2 - mid},${y2} ${x2},${y2}`;
      const labelX = (x1 + x2) / 2;
      const labelY = (y1 + y2) / 2 - 6;
      return (
        <g key={edge.id}>
          <path className="flow-edge" d={path} fill="none" />
          {edge.label && (
            <text className="flow-edge__label" x={labelX} y={labelY} textAnchor="middle">
              {edge.label}
            </text>
          )}
        </g>
      );
    });
  }, [data.edges, data.nodes]);

  return (
    <div
      ref={containerRef}
      className="flow-canvas__main-inner"
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        style={{
          position: 'absolute',
          left: pan.x,
          top: pan.y,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'auto',
        }}
      >
        <svg
          width={1}
          height={1}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <marker
              id="flow-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="auto"
            >
              <path d="M 0,0 L 8,4 L 0,8 z" fill="var(--flow-edge)" />
            </marker>
          </defs>
          {renderEdges}
          {pendingEdge && (() => {
            const source = data.nodes.find((n) => n.id === pendingEdge.sourceId);
            if (!source) return null;
            const x1 = source.x + (source.width ?? 120);
            const y1 = source.y + (source.height ?? 60) / 2;
            const { x: x2, y: y2 } = pendingEdge.pointer;
            const mid = Math.max(20, Math.abs(x2 - x1) / 2);
            return (
              <path
                className="flow-edge--active"
                d={`M ${x1},${y1} C ${x1 + mid},${y1} ${x2 - mid},${y2} ${x2},${y2}`}
                fill="none"
                markerEnd="url(#flow-arrow)"
              />
            );
          })()}
        </svg>
        {data.nodes.map(renderNode)}
      </div>
      {/* 数据集下挂引用 materials 保证 tree-shaking 可感知 */}
      {materials.length === 0 && null}
    </div>
  );
}

export function useFlowZoomApi(
  initial = 1,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
  zoomStep: number = ZOOM_STEP,
) {
  const [zoom, setZoom] = useState(initial);
  return {
    zoom,
    setZoom,
    zoomIn: () => setZoom((z) => Math.min(z + zoomStep, maxZoom)),
    zoomOut: () => setZoom((z) => Math.max(z - zoomStep, minZoom)),
    fitView: () => setZoom(1),
  };
}
