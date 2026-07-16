import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* -- Data Model -- */
interface ProcessNode {
  id: string;
  type: "start" | "end" | "task" | "gateway" | "ai_decision";
  label: string;
  x: number;
  y: number;
  assignee?: string;
  sla?: string;
  description?: string;
}

interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

interface ProcessDesign {
  id?: string;
  name: string;
  description?: string;
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

/* -- Palette Item Definitions -- */
interface PaletteItemDef {
  type: ProcessNode["type"];
  label: string;
  icon: string;
}

const PALETTE_ITEMS: PaletteItemDef[] = [
  { type: "start", label: "开始节点", icon: "G" },
  { type: "end", label: "结束节点", icon: "R" },
  { type: "task", label: "普通节点", icon: "[]" },
  { type: "gateway", label: "条件判断", icon: "<>" },
  { type: "ai_decision", label: "AI 决策节点", icon: "AI" },
];

/* -- Default Process -- */
function createDefaultProcess(): ProcessDesign {
  const n1: ProcessNode = { id: "node-start", type: "start", label: "开始", x: 80, y: 240 };
  const n2: ProcessNode = { id: "node-submit", type: "task", label: "审批提交", x: 240, y: 240, assignee: "", sla: "1h", description: "提交审批申请" };
  const n3: ProcessNode = { id: "node-gateway", type: "gateway", label: "金额", x: 430, y: 240, description: "amount > 10000" };
  const n4: ProcessNode = { id: "node-manager", type: "task", label: "经理审批", x: 600, y: 140, assignee: "manager", sla: "24h", description: "经理人工审批" };
  const n5: ProcessNode = { id: "node-ai", type: "ai_decision", label: "AI 自动审批", x: 600, y: 340, description: "AI 自动决策审批" };
  const n6: ProcessNode = { id: "node-end1", type: "end", label: "结束", x: 800, y: 140 };
  const n7: ProcessNode = { id: "node-end2", type: "end", label: "结束", x: 800, y: 340 };

  return {
    name: "费用审批流程",
    description: "标准费用审批流程，金额大于10000需经理审批，否则AI自动审批",
    nodes: [n1, n2, n3, n4, n5, n6, n7],
    edges: [
      { id: "edge-1", source: "node-start", target: "node-submit" },
      { id: "edge-2", source: "node-submit", target: "node-gateway" },
      { id: "edge-3", source: "node-gateway", target: "node-manager", label: "金额>10000", condition: "amount > 10000" },
      { id: "edge-4", source: "node-gateway", target: "node-ai", label: "金额<=10000", condition: "amount <= 10000" },
      { id: "edge-5", source: "node-manager", target: "node-end1" },
      { id: "edge-6", source: "node-ai", target: "node-end2" },
    ],
  };
}

/* -- Helper: SVG mouse position -- */
function getMousePosition(e: React.MouseEvent, svg: SVGSVGElement) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: e.clientX, y: e.clientY };
  return pt.matrixTransform(ctm.inverse());
}

/* -- Helper: node dimensions by type -- */
function getNodeDimensions(type: ProcessNode["type"]) {
  switch (type) {
    case "start":
    case "end":
      return { w: 60, h: 60 };
    case "gateway":
      return { w: 60, h: 60 };
    case "task":
      return { w: 140, h: 56 };
    case "ai_decision":
      return { w: 150, h: 56 };
    default:
      return { w: 120, h: 50 };
  }
}

function getNodeCenter(node: ProcessNode) {
  const dim = getNodeDimensions(node.type);
  return { cx: node.x + dim.w / 2, cy: node.y + dim.h / 2 };
}

/* -- Helper: edge endpoint offset -- */
function getEdgeEndpoint(node: ProcessNode, otherCx: number, otherCy: number) {
  const center = getNodeCenter(node);
  const dim = getNodeDimensions(node.type);
  const dx = otherCx - center.cx;
  const dy = otherCy - center.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return center;

  if (node.type === "start" || node.type === "end") {
    const r = dim.w / 2;
    return { cx: center.cx + (dx / dist) * r, cy: center.cy + (dy / dist) * r };
  }

  if (node.type === "gateway") {
    const half = dim.w / 2 + 4;
    const t = half / (Math.abs(dx) + Math.abs(dy) || 1);
    return { cx: center.cx + dx * t, cy: center.cy + dy * t };
  }

  const hw = dim.w / 2 + 2;
  const hh = dim.h / 2 + 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { cx: center.cx + dx * scale, cy: center.cy + dy * scale };
}

/* -- Type label map -- */
const NODE_TYPE_LABELS: Record<ProcessNode["type"], string> = {
  start: "开始",
  end: "结束",
  task: "活动",
  gateway: "网关",
  ai_decision: "AI 决策",
};

/* -- Component -- */
const ProcessDesigner: React.FC = () => {
  const [design, setDesign] = useState<ProcessDesign>(createDefaultProcess);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeMode, setEdgeMode] = useState(false);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Toast */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  /* Selection helpers */
  const selectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, []);

  const selectEdge = useCallback((id: string) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  /* -- Node dragging -- */
  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (edgeMode) return;
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      const pos = getMousePosition(e, svg);
      const node = design.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setDragging({ nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y });
      selectNode(nodeId);
    },
    [edgeMode, design.nodes, selectNode]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !svgRef.current) return;
      const pos = getMousePosition(e, svgRef.current);
      setDesign((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === dragging.nodeId ? { ...n, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY } : n
        ),
      }));
    },
    [dragging]
  );

  const onMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  /* -- Edge mode -- */
  const onNodeClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (edgeMode) {
        if (!edgeSourceId) {
          setEdgeSourceId(nodeId);
        } else if (edgeSourceId !== nodeId) {
          const exists = design.edges.some(
            (ed) => ed.source === edgeSourceId && ed.target === nodeId
          );
          if (!exists) {
            const newEdge: ProcessEdge = {
              id: `edge-${Date.now()}`,
              source: edgeSourceId,
              target: nodeId,
            };
            setDesign((prev) => ({ ...prev, edges: [...prev.edges, newEdge] }));
            showToast("边已创建");
          } else {
            showToast("该边已存在");
          }
          setEdgeSourceId(null);
        }
      } else {
        selectNode(nodeId);
      }
    },
    [edgeMode, edgeSourceId, design.edges, selectNode, showToast]
  );

  /* -- Double-click to edit label -- */
  const onNodeDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const node = design.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setEditingNodeId(nodeId);
      setEditingLabel(node.label);
    },
    [design.nodes]
  );

  const onLabelChangeConfirm = useCallback(() => {
    if (!editingNodeId) return;
    setDesign((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === editingNodeId ? { ...n, label: editingLabel } : n)),
    }));
    setEditingNodeId(null);
    setEditingLabel("");
  }, [editingNodeId, editingLabel]);

  /* -- Canvas click -- */
  const onCanvasClick = useCallback(() => {
    if (edgeMode) {
      setEdgeSourceId(null);
    } else {
      clearSelection();
    }
  }, [edgeMode, clearSelection]);

  /* -- Edge click -- */
  const onEdgeClick = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation();
      selectEdge(edgeId);
    },
    [selectEdge]
  );

  /* -- Delete selected -- */
  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setDesign((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
        edges: prev.edges.filter((ed) => ed.source !== selectedNodeId && ed.target !== selectedNodeId),
      }));
      setSelectedNodeId(null);
      showToast("节点已删除");
    } else if (selectedEdgeId) {
      setDesign((prev) => ({
        ...prev,
        edges: prev.edges.filter((ed) => ed.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
      showToast("边已删除");
    }
  }, [selectedNodeId, selectedEdgeId, showToast]);

  /* -- Keyboard shortcut -- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingNodeId) return;
        deleteSelected();
      }
      if (e.key === "Escape") {
        setEdgeMode(false);
        setEdgeSourceId(null);
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, editingNodeId, clearSelection]);

  /* -- Drag from palette to canvas -- */
  const onPaletteDragStart = useCallback((e: React.DragEvent, type: ProcessNode["type"]) => {
    e.dataTransfer.setData("application/node-type", type);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/node-type") as ProcessNode["type"];
      if (!type || !svgRef.current) return;
      const pos = getMousePosition(e as unknown as React.MouseEvent, svgRef.current);
      const dim = getNodeDimensions(type);
      const newNode: ProcessNode = {
        id: `node-${Date.now()}`,
        type,
        label: NODE_TYPE_LABELS[type],
        x: pos.x - dim.w / 2,
        y: pos.y - dim.h / 2,
      };
      setDesign((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
      selectNode(newNode.id);
      showToast(`已添加${NODE_TYPE_LABELS[type]}`);
    },
    [selectNode, showToast]
  );

  const onCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  /* -- Properties panel update -- */
  const updateNode = useCallback((id: string, updates: Partial<ProcessNode>) => {
    setDesign((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  }, []);

  const updateEdge = useCallback((id: string, updates: Partial<ProcessEdge>) => {
    setDesign((prev) => ({
      ...prev,
      edges: prev.edges.map((ed) => (ed.id === id ? { ...ed, ...updates } : ed)),
    }));
  }, []);

  const updateProcess = useCallback((updates: Partial<ProcessDesign>) => {
    setDesign((prev) => ({ ...prev, ...updates }));
  }, []);

  /* -- Save / Load / JSON -- */
  const saveJson = useCallback(() => {
    const json = JSON.stringify(design, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.name || "process"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("已保存为 JSON 文件");
  }, [design, showToast]);

  const loadJson = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string) as ProcessDesign;
          if (parsed.nodes && parsed.edges) {
            setDesign(parsed);
            clearSelection();
            showToast("已加载流程定义");
          } else {
            showToast("无效的流程文件");
          }
        } catch {
          showToast("JSON 解析失败");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [clearSelection, showToast]
  );

  /* -- New process -- */
  const newProcess = useCallback(() => {
    setDesign({
      name: "新建流程",
      description: "",
      nodes: [
        { id: `node-${Date.now()}`, type: "start", label: "开始", x: 100, y: 200 },
      ],
      edges: [],
    });
    clearSelection();
    showToast("已创建新流程");
  }, [clearSelection, showToast]);

  /* -- Selected data -- */
  const selectedNode = selectedNodeId ? design.nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? design.edges.find((ed) => ed.id === selectedEdgeId) : null;

  /* -- Render SVG Node -- */
  const renderNode = (node: ProcessNode) => {
    const isSelected = selectedNodeId === node.id;
    const isEdgeSource = edgeMode && edgeSourceId === node.id;
    const dim = getNodeDimensions(node.type);
    const cx = node.x + dim.w / 2;
    const cy = node.y + dim.h / 2;
    const isEditing = editingNodeId === node.id;

    const commonGroupProps = {
      onMouseDown: (e: React.MouseEvent) => onNodeMouseDown(e, node.id),
      onClick: (e: React.MouseEvent) => onNodeClick(e, node.id),
      onDoubleClick: (e: React.MouseEvent) => onNodeDoubleClick(e, node.id),
      style: { cursor: edgeMode ? "crosshair" : "grab" },
    };

    const selectedStroke = isSelected ? "#3b82f6" : isEdgeSource ? "#f59e0b" : undefined;

    /* Start / End -- circle */
    if (node.type === "start" || node.type === "end") {
      const r = dim.w / 2;
      return (
        <g key={node.id} {...commonGroupProps}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={node.type === "start" ? "#22c55e" : "#ef4444"}
            stroke={selectedStroke || (node.type === "start" ? "#16a34a" : "#dc2626")}
            strokeWidth={isSelected ? 3 : 2}
          />
          {isEditing ? (
            <foreignObject x={cx - 40} y={cy - 12} width={80} height={24}>
              <input
                autoFocus
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={onLabelChangeConfirm}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLabelChangeConfirm();
                  if (e.key === "Escape") setEditingNodeId(null);
                }}
                style={{ width: "100%", fontSize: "11px", textAlign: "center", border: "1px solid #3b82f6", borderRadius: "3px", outline: "none", padding: "1px 2px" }}
              />
            </foreignObject>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
              {node.label}
            </text>
          )}
        </g>
      );
    }

    /* Gateway -- diamond */
    if (node.type === "gateway") {
      const half = dim.w / 2;
      const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
      return (
        <g key={node.id} {...commonGroupProps}>
          <polygon points={points} fill="#fef9c3" stroke={selectedStroke || "#eab308"} strokeWidth={isSelected ? 3 : 2} />
          {isEditing ? (
            <foreignObject x={cx - 35} y={cy - 12} width={70} height={24}>
              <input autoFocus value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} onBlur={onLabelChangeConfirm} onKeyDown={(e) => { if (e.key === "Enter") onLabelChangeConfirm(); if (e.key === "Escape") setEditingNodeId(null); }} style={{ width: "100%", fontSize: "11px", textAlign: "center", border: "1px solid #3b82f6", borderRadius: "3px", outline: "none", padding: "1px 2px" }} />
            </foreignObject>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#92400e" fontSize={11} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
              {node.label}
            </text>
          )}
        </g>
      );
    }

    /* AI Decision -- purple rect */
    if (node.type === "ai_decision") {
      return (
        <g key={node.id} {...commonGroupProps}>
          <defs>
            <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ede9fe" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          <rect x={node.x} y={node.y} width={dim.w} height={dim.h} rx={8} ry={8} fill="url(#ai-gradient)" stroke={selectedStroke || "#8b5cf6"} strokeWidth={isSelected ? 3 : 2} />
          {isEditing ? (
            <foreignObject x={cx - 55} y={cy - 12} width={110} height={24}>
              <input autoFocus value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} onBlur={onLabelChangeConfirm} onKeyDown={(e) => { if (e.key === "Enter") onLabelChangeConfirm(); if (e.key === "Escape") setEditingNodeId(null); }} style={{ width: "100%", fontSize: "12px", textAlign: "center", border: "1px solid #3b82f6", borderRadius: "3px", outline: "none", padding: "1px 2px" }} />
            </foreignObject>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#5b21b6" fontSize={12} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
              {node.label}
            </text>
          )}
          {!isEditing && (
            <text x={node.x + 8} y={node.y + 14} fontSize={10} fill="#7c3aed" style={{ pointerEvents: "none" }}>
              AI
            </text>
          )}
        </g>
      );
    }

    /* Task -- rounded rect */
    return (
      <g key={node.id} {...commonGroupProps}>
        <rect x={node.x} y={node.y} width={dim.w} height={dim.h} rx={8} ry={8} fill="#ffffff" stroke={selectedStroke || "#3b82f6"} strokeWidth={isSelected ? 3 : 1.5} />
        {isEditing ? (
          <foreignObject x={cx - 55} y={cy - 12} width={110} height={24}>
            <input autoFocus value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} onBlur={onLabelChangeConfirm} onKeyDown={(e) => { if (e.key === "Enter") onLabelChangeConfirm(); if (e.key === "Escape") setEditingNodeId(null); }} style={{ width: "100%", fontSize: "12px", textAlign: "center", border: "1px solid #3b82f6", borderRadius: "3px", outline: "none", padding: "1px 2px" }} />
          </foreignObject>
        ) : (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#1e293b" fontSize={12} fontWeight={500} style={{ pointerEvents: "none", userSelect: "none" }}>
            {node.label}
          </text>
        )}
      </g>
    );
  };

  /* -- Render SVG Edge -- */
  const renderEdge = (edge: ProcessEdge) => {
    const sourceNode = design.nodes.find((n) => n.id === edge.source);
    const targetNode = design.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const sourceCenter = getNodeCenter(sourceNode);
    const targetCenter = getNodeCenter(targetNode);
    const sp = getEdgeEndpoint(sourceNode, targetCenter.cx, targetCenter.cy);
    const tp = getEdgeEndpoint(targetNode, sourceCenter.cx, sourceCenter.cy);

    const isSelected = selectedEdgeId === edge.id;

    const midX = (sp.cx + tp.cx) / 2;
    const midY = (sp.cy + tp.cy) / 2;

    const dx = tp.cx - sp.cx;
    const dy = tp.cy - sp.cy;
    const perpX = -dy * 0.1;
    const perpY = dx * 0.1;
    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;
    const pathD = `M ${sp.cx} ${sp.cy} Q ${ctrlX} ${ctrlY} ${tp.cx} ${tp.cy}`;

    return (
      <g key={edge.id}>
        <path d={pathD} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: "pointer" }} onClick={(e) => onEdgeClick(e, edge.id)} />
        <path d={pathD} fill="none" stroke={isSelected ? "#3b82f6" : "#94a3b8"} strokeWidth={isSelected ? 2.5 : 1.5} markerEnd="url(#arrowhead)" onClick={(e) => onEdgeClick(e, edge.id)} style={{ cursor: "pointer" }} />
        {edge.label && (
          <g>
            <rect x={ctrlX - (edge.label.length * 5 + 8)} y={ctrlY - 10} width={edge.label.length * 10 + 16} height={20} rx={4} fill="#ffffff" stroke="#e2e8f0" strokeWidth={1} />
            <text x={ctrlX} y={ctrlY + 1} textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize={10} fontWeight={500} style={{ pointerEvents: "none", userSelect: "none" }}>
              {edge.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  /* -- Properties Panel Content -- */
  const renderProperties = () => {
    if (selectedNode) {
      return (
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">节点属性</div>
          <div className="space-y-1">
            <Label>名称</Label>
            <Input value={selectedNode.label} onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>类型</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedNode.type}
              onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as ProcessNode["type"] })}
            >
              <option value="start">开始节点</option>
              <option value="end">结束节点</option>
              <option value="task">活动节点</option>
              <option value="gateway">网关</option>
              <option value="ai_decision">AI 决策</option>
            </select>
          </div>
          {(selectedNode.type === "task" || selectedNode.type === "ai_decision") && (
            <>
              <div className="space-y-1">
                <Label>处理人</Label>
                <Input value={selectedNode.assignee || ""} onChange={(e) => updateNode(selectedNode.id, { assignee: e.target.value })} placeholder="输入处理人" />
              </div>
              <div className="space-y-1">
                <Label>SLA</Label>
                <Input value={selectedNode.sla || ""} onChange={(e) => updateNode(selectedNode.id, { sla: e.target.value })} placeholder="如: 24h, 3d" />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>描述</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedNode.description || ""}
              onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
              placeholder="节点描述"
              rows={3}
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            ID: {selectedNode.id}
          </div>
        </div>
      );
    }

    if (selectedEdge) {
      return (
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">边属性</div>
          <div className="space-y-1">
            <Label>标签</Label>
            <Input value={selectedEdge.label || ""} onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })} placeholder="边标签" />
          </div>
          <div className="space-y-1">
            <Label>条件表达式</Label>
            <Input value={selectedEdge.condition || ""} onChange={(e) => updateEdge(selectedEdge.id, { condition: e.target.value })} placeholder="如: amount > 10000" />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            源: {selectedEdge.source}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            目标: {selectedEdge.target}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">流程属性</div>
        <div className="space-y-1">
          <Label>流程名称</Label>
          <Input value={design.name} onChange={(e) => updateProcess({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>描述</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={design.description || ""}
            onChange={(e) => updateProcess({ description: e.target.value })}
            placeholder="流程描述"
            rows={4}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          节点数: {design.nodes.length} | 边数: {design.edges.length}
        </div>
      </div>
    );
  };

  /* -- Main Render -- */
  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={onFileChange} />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">流程设计器</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-48"
            value={design.name}
            onChange={(e) => updateProcess({ name: e.target.value })}
            placeholder="流程名称"
          />
          {edgeMode && (
            <span className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded">
              {edgeSourceId ? "请点击目标节点" : "请点击源节点"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={newProcess}>新建</Button>
          <Button
            variant={edgeMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setEdgeMode(!edgeMode); setEdgeSourceId(null); }}
          >
            {edgeMode ? "退出连线" : "添加连线"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteSelected}
            disabled={!selectedNodeId && !selectedEdgeId}
          >
            删除
          </Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button variant="outline" size="sm" onClick={saveJson}>保存</Button>
          <Button variant="outline" size="sm" onClick={loadJson}>加载</Button>
          <Button variant="outline" size="sm" onClick={() => setShowJson(true)}>JSON</Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Palette */}
        <aside className="w-44 border-r bg-muted/30 flex flex-col shrink-0">
          <div className="px-3 py-2 text-sm font-medium text-muted-foreground">节点组件</div>
          <div className="px-3 pb-1 text-xs text-muted-foreground">拖拽到画布添加节点</div>
          <Separator />
          <div className="flex-1 overflow-auto p-2 flex flex-col gap-1">
            {PALETTE_ITEMS.map((item) => (
              <div
                key={item.type}
                className="flex items-center gap-2 px-3 py-2 rounded-md cursor-grab text-sm hover:bg-accent transition-colors"
                draggable
                onDragStart={(e) => onPaletteDragStart(e, item.type)}
              >
                <span className="w-6 text-center text-muted-foreground">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 overflow-hidden bg-background">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ display: "block", minHeight: 500 }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={onCanvasClick}
            onDrop={onCanvasDrop}
            onDragOver={onCanvasDragOver}
          >
            <defs>
              <marker id="arrowhead" markerWidth={10} markerHeight={7} refX={10} refY={3.5} orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
              <marker id="arrowhead-selected" markerWidth={10} markerHeight={7} refX={10} refY={3.5} orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {design.edges.map(renderEdge)}

            {/* Nodes */}
            {design.nodes.map(renderNode)}

            {/* Empty state */}
            {design.nodes.length === 0 && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize={14}>
                从左侧拖拽节点到画布开始设计
              </text>
            )}
          </svg>
        </div>

        {/* Right Properties */}
        <aside className="w-72 border-l bg-muted/30 flex flex-col shrink-0 overflow-auto">
          <div className="px-4 py-3 text-sm font-medium text-muted-foreground">
            {selectedNode ? "节点属性" : selectedEdge ? "边属性" : "流程属性"}
          </div>
          <Separator />
          <div className="p-4">
            {renderProperties()}
          </div>
        </aside>
      </div>

      {/* JSON Preview Dialog */}
      <Dialog open={showJson} onOpenChange={setShowJson}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>流程 JSON 数据</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted rounded-md p-4 text-xs font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
            {JSON.stringify(design, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessDesigner;
