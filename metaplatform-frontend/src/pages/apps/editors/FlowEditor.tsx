import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Play, Square as SquareIcon, Diamond, StopCircle,
  Trash2, Settings, Plus,
} from "lucide-react";
import type { BaseEditorProps, PageComponent } from "./types";

// ── Flow node types ──
interface FlowNode {
  id: string;
  type: "start" | "task" | "gateway" | "end";
  label: string;
  x: number;
  y: number;
}

interface FlowConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

const NODE_PALETTE = [
  { type: "start"   as const, label: "开始节点", icon: Play },
  { type: "task"    as const, label: "任务节点", icon: SquareIcon },
  { type: "gateway" as const, label: "网关",     icon: Diamond },
  { type: "end"     as const, label: "结束节点", icon: StopCircle },
];

const NODE_COLORS: Record<string, { bg: string; stroke: string; text: string; fill: string }> = {
  start:   { bg: "#dcfce7", stroke: "#22c55e", text: "#166534", fill: "rgba(34,197,94,0.1)" },
  task:    { bg: "#dbeafe", stroke: "#3b82f6", text: "#1e40af", fill: "rgba(59,130,246,0.1)" },
  gateway: { bg: "#fef3c7", stroke: "#f59e0b", text: "#92400e", fill: "rgba(245,158,11,0.1)" },
  end:     { bg: "#fee2e2", stroke: "#ef4444", text: "#991b1b", fill: "rgba(239,68,68,0.1)" },
};

const DEFAULT_NODES: FlowNode[] = [
  { id: "start",    type: "start",   label: "开始",     x: 50,  y: 200 },
  { id: "task1",    type: "task",    label: "提交申请", x: 220, y: 200 },
  { id: "gateway",  type: "gateway", label: "审批判断", x: 390, y: 200 },
  { id: "approve",  type: "task",    label: "审批通过", x: 560, y: 120 },
  { id: "reject",   type: "task",    label: "审批驳回", x: 560, y: 280 },
  { id: "end",      type: "end",     label: "结束",     x: 730, y: 200 },
];

const DEFAULT_CONNECTIONS: FlowConnection[] = [
  { id: "c1", from: "start",   to: "task1",   label: "" },
  { id: "c2", from: "task1",   to: "gateway", label: "" },
  { id: "c3", from: "gateway", to: "approve", label: "通过" },
  { id: "c4", from: "gateway", to: "reject",  label: "驳回" },
  { id: "c5", from: "approve", to: "end",     label: "" },
  { id: "c6", from: "reject",  to: "end",     label: "" },
];

const NODE_W = 120;
const NODE_H = 40;

/**
 * FlowEditor -- workflow / process editor
 *
 * Enhancements over PageEditor.tsx:
 * - Mouse drag support for nodes (mousedown/mousemove/mouseup)
 * - Bezier curve connections (cubic bezier instead of straight lines)
 * - Connection labels
 * - Delete connections
 * - Proper TypeScript types
 */
export function FlowEditor({ components, setComponents, setDirty }: BaseEditorProps) {
  const existingData = components?.[0]?.props;
  const [nodes, setNodes] = useState<FlowNode[]>(existingData?.nodes || DEFAULT_NODES);
  const [connections, setConnections] = useState<FlowConnection[]>(
    existingData?.connections || DEFAULT_CONNECTIONS
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  /** Persist to parent */
  const persist = (ns: FlowNode[], cs: FlowConnection[]) => {
    setComponents((prev: PageComponent[]) => {
      if (prev.length === 0) {
        return [{ id: "flow-config", type: "flow-config", label: "流程配置", props: { nodes: ns, connections: cs } }];
      }
      return prev.map((c, i) =>
        i === 0 ? { ...c, props: { ...c.props, nodes: ns, connections: cs } } : c
      );
    });
    setDirty(true);
  };

  // ── Node drag handlers ──
  const handleMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = 800 / rect.width; // SVG viewBox is 800 wide
      dragOffset.current = {
        x: (e.clientX - rect.left) * scale - node.x,
        y: (e.clientY - rect.top) * scale - node.y,
      };
      setDragging(nodeId);
      setSelectedNode(nodeId);
    },
    [nodes]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = 800 / rect.width;
      const newX = Math.max(0, (e.clientX - rect.left) * scale - dragOffset.current.x);
      const newY = Math.max(0, (e.clientY - rect.top) * scale - dragOffset.current.y);
      setNodes((prev) =>
        prev.map((n) => (n.id === dragging ? { ...n, x: newX, y: newY } : n))
      );
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      persist(nodes, connections);
      setDragging(null);
    }
  }, [dragging, nodes, connections]);

  // ── Node CRUD ──
  const addNode = (type: FlowNode["type"]) => {
    const labels: Record<string, string> = {
      start: "开始",
      task: "新任务",
      gateway: "网关",
      end: "结束",
    };
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      label: labels[type] || "节点",
      x: 100 + nodes.length * 140,
      y: 200,
    };
    const next = [...nodes, newNode];
    setNodes(next);
    persist(next, connections);
  };

  const deleteNode = (id: string) => {
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextConns = connections.filter((c) => c.from !== id && c.to !== id);
    setNodes(nextNodes);
    setConnections(nextConns);
    setSelectedNode(null);
    persist(nextNodes, nextConns);
  };

  const updateNodeLabel = (id: string, label: string) => {
    const next = nodes.map((n) => (n.id === id ? { ...n, label } : n));
    setNodes(next);
    persist(next, connections);
  };

  const deleteConnection = (id: string) => {
    const next = connections.filter((c) => c.id !== id);
    setConnections(next);
    persist(nodes, next);
  };

  // ── Bezier path calculation ──
  const getBezierPath = (fromNode: FlowNode, toNode: FlowNode) => {
    const x1 = fromNode.x + NODE_W;
    const y1 = fromNode.y + NODE_H / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_H / 2;
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(dx * 0.4, 40);
    return {
      d: `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`,
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
    };
  };

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  return (
    <div className="flex gap-0 h-[calc(100vh-200px)] min-h-[400px]">
      {/* Left: Node Palette */}
      <div className="w-36 border-r pr-3 shrink-0 overflow-y-auto">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">
          节点库
        </h4>
        <div className="space-y-1">
          {NODE_PALETTE.map((n) => {
            const Icon = n.icon;
            const colors = NODE_COLORS[n.type];
            return (
              <button
                key={n.type}
                onClick={() => addNode(n.type)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors text-left"
              >
                <span
                  className="size-5 rounded flex items-center justify-center"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  <Icon className="size-3" />
                </span>
                <span>{n.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 pt-2 border-t text-[10px] text-muted-foreground space-y-1">
          <div>{nodes.length} 个节点</div>
          <div>{connections.length} 条连线</div>
        </div>
      </div>

      {/* Center: SVG Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <svg
          ref={svgRef}
          viewBox="0 0 800 400"
          className="w-full h-full bg-white"
          style={{ cursor: dragging ? "grabbing" : "default" }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedNode(null)}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
            </pattern>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="#94a3b8" />
            </marker>
          </defs>
          <rect width="800" height="400" fill="url(#grid)" />

          {/* Connections (bezier curves) */}
          {connections.map((conn) => {
            const fromNode = nodes.find((n) => n.id === conn.from);
            const toNode = nodes.find((n) => n.id === conn.to);
            if (!fromNode || !toNode) return null;
            const { d, midX, midY } = getBezierPath(fromNode, toNode);
            return (
              <g key={conn.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                  className="hover:stroke-primary cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConnection(conn.id);
                  }}
                />
                {/* Invisible wider path for easier clicking */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="10"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConnection(conn.id);
                  }}
                />
                {conn.label && (
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground pointer-events-none"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = NODE_COLORS[node.type];
            const isSelected = selectedNode === node.id;
            const isDragged = dragging === node.id;
            const rx = node.type === "start" || node.type === "end" ? 20 : node.type === "gateway" ? 4 : 6;
            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                className="cursor-grab active:cursor-grabbing"
                style={{ opacity: isDragged ? 0.8 : 1 }}
              >
                {isSelected && (
                  <rect
                    x={node.x - 3}
                    y={node.y - 3}
                    width={NODE_W + 6}
                    height={NODE_H + 6}
                    rx={rx + 2}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="2"
                    strokeDasharray="4,2"
                  />
                )}
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={rx}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + NODE_H / 2 + 4}
                  textAnchor="middle"
                  className="text-xs pointer-events-none select-none"
                  fill={colors.text}
                  fontSize="12"
                  fontWeight="500"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right: Node Properties */}
      <div className="w-52 border-l pl-3 shrink-0 overflow-y-auto">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
          <Settings className="size-3" /> 节点属性
        </h4>
        {selectedNodeData ? (
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{
                color: NODE_COLORS[selectedNodeData.type].text,
                borderColor: NODE_COLORS[selectedNodeData.type].stroke,
              }}
            >
              {selectedNodeData.type}
            </Badge>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                节点名称
              </Label>
              <Input
                value={selectedNodeData.label}
                onChange={(e) =>
                  updateNodeLabel(selectedNodeData.id, e.target.value)
                }
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                节点类型
              </Label>
              <select
                value={selectedNodeData.type}
                disabled
                className="w-full h-7 text-xs border rounded px-2 mt-0.5 bg-muted"
              >
                <option value="start">开始</option>
                <option value="task">任务</option>
                <option value="gateway">网关</option>
                <option value="end">结束</option>
              </select>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <span>坐标: ({Math.round(selectedNodeData.x)}, {Math.round(selectedNodeData.y)})</span>
            </div>
            <button
              onClick={() => deleteNode(selectedNodeData.id)}
              className="w-full text-xs py-1 border border-destructive/50 text-destructive rounded hover:bg-destructive/5 flex items-center justify-center gap-1"
            >
              <Trash2 className="size-3" /> 删除节点
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] text-muted-foreground py-4 text-center">
              点击节点查看属性
            </p>
            <div>
              <p className="text-[11px] font-medium mb-2">快速添加</p>
              <div className="grid grid-cols-2 gap-1">
                {NODE_PALETTE.map((n) => {
                  const Icon = n.icon;
                  const colors = NODE_COLORS[n.type];
                  return (
                    <button
                      key={n.type}
                      onClick={() => addNode(n.type)}
                      className="flex items-center gap-1 px-2 py-1.5 text-[10px] border rounded hover:opacity-80 transition text-left"
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.stroke,
                      }}
                    >
                      <Icon className="size-2.5" /> {n.label.replace("节点", "")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
