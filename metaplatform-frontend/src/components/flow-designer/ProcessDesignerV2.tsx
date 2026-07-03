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
  {
    id: "start_1",
    type: "startEvent",
    position: { x: 100, y: 250 },
    data: { label: "Start" },
  },
  {
    id: "end_1",
    type: "endEvent",
    position: { x: 700, y: 250 },
    data: { label: "End" },
  },
];

const defaultEdges: Edge[] = [];

// ---------- Props ----------

interface ProcessDesignerV2Props {
  initialBpmnXml?: string;
  definitionId?: string;
  onDeploy?: (xml: string) => void;
  className?: string;
}

export function ProcessDesignerV2({
  initialBpmnXml,
  definitionId,
  onDeploy,
  className,
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
  const [processConfig, setProcessConfig] = useState({ id: "myProcess", name: "My Process" });

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
        type: "default",
        animated: false,
        style: { strokeWidth: 2, stroke: "#64748b" },
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

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
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
    setStatusMessage("BPMN XML exported");
    setTimeout(() => setStatusMessage(null), 3000);
  }, [getBpmnXml, processConfig.id]);

  const handleCopyXml = useCallback(() => {
    const xml = getBpmnXml();
    navigator.clipboard.writeText(xml).then(() => {
      setStatusMessage("BPMN XML copied to clipboard");
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
          setStatusMessage("BPMN XML imported successfully");
        } else {
          setStatusMessage("Failed to parse BPMN XML");
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
    setStatusMessage("Deploying...");
    try {
      const xml = getBpmnXml();
      if (onDeploy) {
        onDeploy(xml);
      } else {
        await flowableApi.deployProcess({
          name: processConfig.name,
          bpmnXml: xml,
        });
        setStatusMessage("Deployed to Flowable successfully!");
      }
    } catch (err) {
      setStatusMessage(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`);
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
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowLeftPanel((v) => !v)} title="Toggle Palette">
            {showLeftPanel ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={undo} title="Undo (Ctrl+Z)">
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={redo} title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={zoomIn} title="Zoom In">
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={zoomOut} title="Zoom Out">
            <ZoomOut className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={fitView} title="Fit View">
            <Maximize className="size-4" />
          </Button>
          <Button
            variant={showGrid ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={() => setShowGrid((v) => !v)}
            title="Toggle Grid"
          >
            <Grid3X3 className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={handleImport} title="Import BPMN XML">
            <Upload className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={handleExport} title="Export BPMN XML (Ctrl+S)">
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={handleCopyXml} title="Copy BPMN XML">
            <Copy className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowRightPanel((v) => !v)} title="Toggle Properties">
            {showRightPanel ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
          <Button size="sm" onClick={handleDeploy} disabled={isDeploying} className="ml-1">
            <Rocket className="size-3.5 mr-1" />
            {isDeploying ? "Deploying..." : "Deploy"}
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
              type: "default",
              style: { strokeWidth: 2, stroke: "#64748b" },
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
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    (editing: {definitionId})
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
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-card text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span>Nodes: {nodeCount}</span>
          <span>Edges: {edgeCount}</span>
          <span>Process: {processConfig.id}</span>
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
