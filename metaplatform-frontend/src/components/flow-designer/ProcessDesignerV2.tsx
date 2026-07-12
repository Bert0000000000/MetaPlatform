/**
 * ProcessDesignerV2 - Complete BPMN 2.0 process designer using React Flow.
 * Combines NodePalette (left), ReactFlow canvas (center), PropertiesPanel (right),
 * with a toolbar and status bar.
 */
import { useCallback, useRef, useState, useMemo, type DragEvent, useEffect } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type NodeChange,
  type EdgeChange,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { bpmnNodeTypes } from "./BpmnNodes";
import { NodePalette } from "./NodePalette";
import { PropertiesPanel } from "./PropertiesPanel";
import { generateBpmnXml, parseBpmnXml } from "@/lib/bpmn-generator";
import { flowableApi } from "@/lib/flowable-api";

import { Button } from "@/components/ui/button";
import {
  Save,
  Download,
  Upload,
  Rocket,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Copy,
} from "lucide-react";

// ---------- ID Generator ----------

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

// ---------- Default start/end nodes ----------

const defaultNodes: Node[] = [
  // Start Event
  { id: "start_1", type: "startEvent", position: { x: 80, y: 220 }, data: { label: "开始" } },

  // User Task
  { id: "user_task_1", type: "userTask", position: { x: 220, y: 210 }, data: { label: "用户任务" } },

  // XOR Gateway (exclusive)
  { id: "gateway_xor", type: "exclusiveGateway", position: { x: 430, y: 224 }, data: { label: "互斥" } },

  // Service Task (upper branch)
  { id: "service_task_1", type: "serviceTask", position: { x: 580, y: 110 }, data: { label: "服务任务" } },

  // Script Task (lower branch)
  { id: "script_task_1", type: "scriptTask", position: { x: 580, y: 310 }, data: { label: "脚本任务" } },

  // AND Gateway (parallel)
  { id: "gateway_and", type: "parallelGateway", position: { x: 790, y: 224 }, data: { label: "并行" } },

  // Approval Task
  { id: "user_task_2", type: "userTask", position: { x: 940, y: 210 }, data: { label: "审批" } },

  // End Event
  { id: "end_1", type: "endEvent", position: { x: 1140, y: 220 }, data: { label: "结束" } },
];

const defaultEdges: Edge[] = [
  // Start → User Task
  { id: "e_start_ut1", source: "start_1", target: "user_task_1", type: "default" },
  // User Task → XOR Gateway
  { id: "e_ut1_gw1", source: "user_task_1", target: "gateway_xor", type: "default" },
  // XOR Gateway → Service Task (upper branch, via bottom source handle)
  { id: "e_gw1_st1", source: "gateway_xor", target: "service_task_1", type: "default", sourceHandle: "bottom" },
  // XOR Gateway → Script Task (lower branch, via bottom source handle)
  { id: "e_gw1_sc1", source: "gateway_xor", target: "script_task_1", type: "default", sourceHandle: "bottom" },
  // Service Task → AND Gateway
  { id: "e_st1_gw2", source: "service_task_1", target: "gateway_and", type: "default" },
  // Script Task → AND Gateway
  { id: "e_sc1_gw2", source: "script_task_1", target: "gateway_and", type: "default" },
  // AND Gateway → Approval
  { id: "e_gw2_ut2", source: "gateway_and", target: "user_task_2", type: "default" },
  // Approval → End
  { id: "e_ut2_end", source: "user_task_2", target: "end_1", type: "default" },
];

// ---------- Props ----------

interface ProcessDesignerV2Props {
  initialBpmnXml?: string;
  definitionId?: string;
  onDeploy?: (xml: string) => void;
  className?: string;
  /** 可选：当前工作流所属模块下的相关页面，供节点 Form Key 选择 */
  formPageOptions?: { value: string; label: string }[];
}

export function ProcessDesignerV2({
  initialBpmnXml,
  definitionId,
  onDeploy,
  className,
  formPageOptions,
}: ProcessDesignerV2Props) {
  // ---- React Flow state ----
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // ---- UI state ----
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ---- Process config ----
  const [processConfig, setProcessConfig] = useState({ id: "myProcess", name: "我的流程" });

  // ---- Undo/Redo ----
  const historyRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const historyIndexRef = useRef(-1);

  const pushHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      const snapshot = { nodes: JSON.parse(JSON.stringify(newNodes)), edges: JSON.parse(JSON.stringify(newEdges)) };
      const history = historyRef.current;
      const idx = historyIndexRef.current;
      // Truncate future
      historyRef.current = history.slice(0, idx + 1);
      historyRef.current.push(snapshot);
      historyIndexRef.current = historyRef.current.length - 1;
    },
    []
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    const snap = historyRef.current[idx - 1];
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const history = historyRef.current;
    if (idx >= history.length - 1) return;
    historyIndexRef.current = idx + 1;
    const snap = history[idx + 1];
    setNodes(snap.nodes);
    setEdges(snap.edges);
  }, [setNodes, setEdges]);

  // Track changes for undo
  const wrappedOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const wrappedOnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Push history on significant changes (debounced via effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      pushHistory(nodes, edges);
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges, pushHistory]);

  // ---- Load initial BPMN XML ----
  useEffect(() => {
    if (initialBpmnXml) {
      const parsed = parseBpmnXml(initialBpmnXml);
      if (parsed) {
        setProcessConfig({ id: parsed.id, name: parsed.name });
        const rfNodes: Node[] = parsed.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: { label: n.name || n.id, ...n.data },
        }));
        const rfEdges: Edge[] = parsed.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          data: { condition: e.condition },
        }));
        setNodes(rfNodes);
        setEdges(rfEdges);
      }
    }
  }, [initialBpmnXml, setNodes, setEdges]);

  // ---- Connection handler ----
  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeId = generateId("flow");
      const newEdge: Edge = {
        ...connection,
        id: edgeId,
        type: "smoothstep",
        animated: false,
        style: { strokeWidth: 1, stroke: "#94a3b8" },
        data: {},
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // ---- Drag & Drop from palette ----
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/bpmn-node-type");
      if (!nodeType || !rfInstance || !reactFlowWrapper.current) return;

      const defaultDataStr = event.dataTransfer.getData("application/bpmn-node-data");
      let defaultData: Record<string, unknown> = {};
      try {
        defaultData = JSON.parse(defaultDataStr);
      } catch {
        /* ignore */
      }

      // screenToFlowPosition expects screen (viewport) coordinates directly
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: generateId(nodeType),
        type: nodeType,
        position,
        data: defaultData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  // ---- Selection handlers ----
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setSelectedEdge(null);
    },
    []
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge);
      setSelectedNode(null);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const deselect = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // ---- Property update handlers ----
  const onUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
      // Update selected node reference
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      );
    },
    [setNodes]
  );

  const onUpdateEdge = useCallback(
    (edgeId: string, data: Record<string, unknown>) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          return {
            ...e,
            label: (data.label as string) || e.label,
            data: { ...e.data, condition: data.condition },
          };
        })
      );
      setSelectedEdge((prev) => {
        if (!prev || prev.id !== edgeId) return prev;
        return {
          ...prev,
          label: (data.label as string) || prev.label,
          data: { ...prev.data, condition: data.condition },
        };
      });
    },
    [setEdges]
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const onDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [setEdges]
  );

  // ---- BPMN XML Export ----
  const getBpmnXml = useCallback((): string => {
    const bpmnNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type || "userTask",
      name: (n.data as Record<string, unknown>)?.label as string,
      data: n.data as Record<string, unknown>,
      position: n.position,
    }));
    const bpmnEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label as string | undefined,
      condition: (e.data as Record<string, unknown>)?.condition as string | undefined,
    }));
    return generateBpmnXml({
      id: processConfig.id,
      name: processConfig.name,
      nodes: bpmnNodes,
      edges: bpmnEdges,
    });
  }, [nodes, edges, processConfig]);

  const handleExport = useCallback(() => {
    const xml = getBpmnXml();
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${processConfig.id}.bpmn20.xml`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("BPMN XML 已导出");
    setTimeout(() => setStatusMessage(null), 3000);
  }, [getBpmnXml, processConfig.id]);

  const handleCopyXml = useCallback(() => {
    const xml = getBpmnXml();
    navigator.clipboard.writeText(xml).then(() => {
      setStatusMessage("BPMN XML 已复制到剪贴板");
      setTimeout(() => setStatusMessage(null), 3000);
    });
  }, [getBpmnXml]);

  // ---- BPMN XML Import ----
  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml,.bpmn,.bpmn20.xml";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const xml = ev.target?.result as string;
        const parsed = parseBpmnXml(xml);
        if (parsed) {
          setProcessConfig({ id: parsed.id, name: parsed.name });
          const rfNodes: Node[] = parsed.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: { label: n.name || n.id, ...n.data },
          }));
          const rfEdges: Edge[] = parsed.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            data: { condition: e.condition },
          }));
          setNodes(rfNodes);
          setEdges(rfEdges);
          setStatusMessage("BPMN XML 导入成功");
        } else {
          setStatusMessage("BPMN XML 解析失败");
        }
        setTimeout(() => setStatusMessage(null), 3000);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges]);

  // ---- Deploy to Flowable ----
  const handleDeploy = useCallback(async () => {
    setIsDeploying(true);
    setStatusMessage("部署中…");
    try {
      const xml = getBpmnXml();
      if (onDeploy) {
        onDeploy(xml);
      } else {
        await flowableApi.deployProcess({
          name: processConfig.name,
          bpmnXml: xml,
        });
        setStatusMessage("部署到 Flowable 成功！");
      }
    } catch (err) {
      setStatusMessage(`部署失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeploying(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }, [getBpmnXml, processConfig.name, onDeploy]);

  // ---- Zoom controls ----
  const zoomIn = useCallback(() => rfInstance?.zoomIn(), [rfInstance]);
  const zoomOut = useCallback(() => rfInstance?.zoomOut(), [rfInstance]);
  const fitView = useCallback(() => rfInstance?.fitView({ padding: 0.2 }), [rfInstance]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        } else if (e.key === "s") {
          e.preventDefault();
          handleExport();
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNode) {
          onDeleteNode(selectedNode.id);
        } else if (selectedEdge) {
          onDeleteEdge(selectedEdge.id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, handleExport, selectedNode, selectedEdge, onDeleteNode, onDeleteEdge]);

  // ---- Computed values ----
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  return (
    <div className={`flex flex-col h-full w-full bg-background ${className || ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-card shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowLeftPanel((v) => !v)} title="切换面板">
            {showLeftPanel ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={undo} title="撤销 (Ctrl+Z)">
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={redo} title="重做 (Ctrl+Shift+Z)">
            <Redo2 className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={zoomIn} title="放大">
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={zoomOut} title="缩小">
            <ZoomOut className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={fitView} title="适应视图">
            <Maximize className="size-4" />
          </Button>
          <Button
            variant={showGrid ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={() => setShowGrid((v) => !v)}
            title="切换网格"
          >
            <Grid3X3 className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleImport} title="导入 BPMN XML">
            <Upload className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={handleExport} title="导出 BPMN XML (Ctrl+S)">
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={handleCopyXml} title="复制 BPMN XML">
            <Copy className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowRightPanel((v) => !v)} title="切换属性面板">
            {showRightPanel ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
          <Button size="sm" onClick={handleDeploy} disabled={isDeploying} className="ml-1">
            <Rocket className="size-3.5 mr-1" />
            {isDeploying ? "部署中…" : "部署"}
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Node Palette */}
        {showLeftPanel && (
          <div className="w-52 border-r bg-card shrink-0 overflow-hidden">
            <NodePalette />
          </div>
        )}

        {/* Center - Canvas */}
        <div className="flex-1 min-w-0" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={wrappedOnNodesChange}
            onEdgesChange={wrappedOnEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={bpmnNodeTypes}
            snapToGrid
            snapGrid={[15, 15]}
            fitView
            deleteKeyCode={null} /* We handle delete ourselves */
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { strokeWidth: 1, stroke: "#94a3b8" },
              animated: false,
            }}
            proOptions={{ hideAttribution: true }}
          >
            {showGrid && (
              <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#cbd5e1" />
            )}
            <Controls showInteractive={false} />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              style={{ background: "#f8fafc" }}
            />

            {/* Canvas label */}
            <Panel position="top-left">
              <div className="text-xs text-muted-foreground bg-card/80 backdrop-blur px-2 py-1 rounded border">
                {processConfig.name}
                {definitionId && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    （正在编辑：{definitionId}）
                  </span>
                )}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Panel - Properties */}
        {showRightPanel && (
          <div className="w-64 border-l bg-card shrink-0 overflow-hidden">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNode={onUpdateNode}
              onUpdateEdge={onUpdateEdge}
              onDeleteNode={onDeleteNode}
              onDeleteEdge={onDeleteEdge}
              onDeselect={deselect}
              processConfig={processConfig}
              onUpdateProcess={setProcessConfig}
              formPageOptions={formPageOptions}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-card text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span>节点: {nodeCount}</span>
          <span>连线: {edgeCount}</span>
          <span>流程: {processConfig.id}</span>
        </div>
        <div className="flex items-center gap-3">
          {statusMessage && (
            <span className="text-foreground font-medium">{statusMessage}</span>
          )}
          <span>v2.0</span>
        </div>
      </div>
    </div>
  );
}
