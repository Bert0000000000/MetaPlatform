import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Database, Server, Layers, GitBranch, FileText, Plus, Network, Cpu, Workflow, Box, ArrowRight, ArrowDown, BarChart3, Filter, Download, Link, Lightbulb, RefreshCw, User, Zap, Package, Megaphone, FlaskConical, Truck, Factory, Briefcase, Headphones, Smartphone, ClipboardList, DollarSign, Users, Handshake, X, Eye, Search, ChevronDown, Shield, Upload, Lock, Globe, ToggleLeft, ToggleRight, Loader2, Edit, Save, RotateCcw,
} from "lucide-react";
import { architectureApi } from "@/lib/api";

/**
 * Architecture-layer color tokens (per docs/brainstorm/design-spec §4.1).
 * Each architecture layer gets a single accent color so deployment /
 * dependency diagrams are legible at a glance. Tokens are HSL so they
 * compose with Tailwind's dark-mode and tint utilities.
 *
 *   blue   = L1 用户面 / 流程自动化
 *   orange = L2-1 业务对象
 *   green  = L2-2 本体引擎 + 知识图谱
 *   red    = L2-3 数据 / 知识统一层
 *   violet = L3-1 AI Substrate（横切基质）
 *   slate  = L3-3 平台底座
 *   zinc   = L3-4 存储与基础设施
 */
type ArchLayer = "blue" | "orange" | "green" | "red" | "violet" | "slate" | "zinc";

function layerColor(layer: ArchLayer) {
  const map: Record<ArchLayer, { fill: string; stroke: string; text: string; dot: string }> = {
    blue:   { fill: "hsl(217 91% 96%)", stroke: "hsl(217 91% 60%)",  text: "hsl(217 91% 30%)", dot: "bg-blue-500"    },
    orange: { fill: "hsl(25 95% 96%)",  stroke: "hsl(25 95% 53%)",   text: "hsl(25 95% 28%)",  dot: "bg-orange-500"  },
    green:  { fill: "hsl(142 71% 95%)", stroke: "hsl(142 71% 45%)",  text: "hsl(142 71% 25%)", dot: "bg-green-500"   },
    red:    { fill: "hsl(0 86% 96%)",   stroke: "hsl(0 86% 60%)",   text: "hsl(0 86% 30%)",   dot: "bg-red-500"     },
    violet: { fill: "hsl(258 90% 96%)", stroke: "hsl(258 90% 60%)",  text: "hsl(258 90% 30%)", dot: "bg-violet-500"  },
    slate:  { fill: "hsl(215 16% 95%)", stroke: "hsl(215 16% 47%)",  text: "hsl(215 25% 27%)", dot: "bg-slate-500"   },
    zinc:   { fill: "hsl(220 14% 96%)", stroke: "hsl(220 9% 46%)",   text: "hsl(220 13% 25%)", dot: "bg-zinc-500"    },
  };
  return map[layer];
}

/**
 * Small dot+label chip used below each diagram so the color tokens
 * are not arbitrary — every diagram now carries an explicit legend.
 */
/**
 * Read-only preview of a Topology used in the dashboard cards.
 * Renders edges + nodes from the persisted state without any
 * interaction handlers. Auto-fits the viewBox to the union of
 * node bounds so adding new nodes never crops off-screen.
 */
function TopologyPreview({ topology, ariaLabel }: { topology: Topology; ariaLabel: string }) {
  if (!topology.nodes.length) {
    return <div className="text-xs text-muted-foreground italic py-6 text-center border border-dashed rounded">暂无数据</div>;
  }
  // Compute viewBox that fits every node (with a small padding so the
  // last pixel of stroke isn't clipped).
  const PAD = 16;
  const xs = topology.nodes.flatMap((n) => [n.x, n.x + n.w]);
  const ys = topology.nodes.flatMap((n) => [n.y, n.y + n.h]);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
      {topology.edges.map((edge) => {
        const fromN = topology.nodes.find((n) => n.id === edge.from);
        const toN = topology.nodes.find((n) => n.id === edge.to);
        if (!fromN || !toN) return null;
        const fc = { x: fromN.x + fromN.w / 2, y: fromN.y + fromN.h / 2 };
        const tc = { x: toN.x + toN.w / 2, y: toN.y + toN.h / 2 };
        return (
          <line key={edge.id} x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
                stroke="hsl(215 14% 65%)" strokeWidth="1.5" />
        );
      })}
      {topology.nodes.map((n) => {
        const c = layerColor(n.layer);
        const isContainer = n.kind === "container";
        return (
          <g key={n.id}>
            {isContainer ? (
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                    fill={c.fill} stroke={c.stroke} strokeWidth="1" strokeDasharray="6 4" />
            ) : (
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
                    fill={c.fill} stroke={c.stroke} strokeWidth="1.5" />
            )}
            <text x={n.x + 8} y={n.y + (isContainer ? 16 : Math.min(20, n.h - 8))}
                  fontSize={isContainer ? 11 : 10} fontWeight="600" fill={c.text}>{n.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Small dot+label chip used below each diagram so the color tokens
 * are not arbitrary — every diagram now carries an explicit legend.
 */
function LegendChip({ color, label }: { color: ArchLayer; label: string }) {
  const c = layerColor(color);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${c.dot}`} aria-hidden />
      {label}
    </span>
  );
}

/**
 * TopologyCanvas
 * ──────────────
 * SVG-based interactive canvas for editing a {nodes, edges} topology.
 *
 * Used in two flavors from TechArchitecture:
 *   - canvasOpen === "deploy" → editor for ta.deployTopology
 *   - canvasOpen === "deps"   → editor for ta.svcDeps
 *
 * Interactions (design-mode only):
 *   • Drag a node           — reposition; updates node.x / node.y on mouseup
 *   • Click a node          — selects it; right panel shows editable name + layer
 *   • Delete key on selected— removes the node (and any edges that reference it)
 *   • "连线" mode toggle    — clicking source node then target node adds an edge
 *   • "+ 节点" / "+ 容器"   — appends a new node at a free spot
 *   • Save                  — persists via architectureApi.updateSection
 *   • Reset                 — restores the fallback topology
 *
 * Outside design-mode the same component renders the layout read-only.
 */
function TopologyCanvas({
  topology,
  onChange,
  onPersist,
  title,
  allowContainers = true,
}: {
  topology: Topology;
  onChange: (t: Topology) => void;
  onPersist: (t: Topology) => Promise<void> | void;
  title: string;
  allowContainers?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function nodeCenter(n: TopologyNode) {
    return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  }
  function portPoint(from: TopologyNode, to: TopologyNode) {
    // Pick the side of the source node that points most directly at the
    // target's center, then the matching side of the target. Gives clean
    // arrows instead of lines crossing the node body.
    const fc = nodeCenter(from);
    const tc = nodeCenter(to);
    const dx = tc.x - fc.x;
    const dy = tc.y - fc.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      const x = dx > 0 ? from.x + from.w : from.x;
      const y = fc.y + (dy / Math.abs(dx)) * (from.w / 2);
      return { start: { x, y }, end: { x: dx > 0 ? to.x : to.x + to.w, y: tc.y } };
    }
    const y = dy > 0 ? from.y + from.h : from.y;
    const x = fc.x + (dx / Math.abs(dy)) * (from.h / 2);
    return { start: { x, y }, end: { x: tc.x, y: dy > 0 ? to.y : to.y + to.h } };
  }

  /* Drag state */
  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null);
  function onNodeMouseDown(e: React.MouseEvent, n: TopologyNode) {
    if (linkFrom) {
      // In link-mode, clicks are interpreted as link endpoints, not drags.
      if (linkFrom !== n.id) {
        const edge: TopologyEdge = {
          id: `e-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          from: linkFrom,
          to: n.id,
        };
        onChange({ ...topology, edges: [...topology.edges, edge] });
        setToast(`已添加连线：${topology.nodes.find((x) => x.id === linkFrom)?.name} → ${n.name}`);
        setLinkFrom(null);
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setSelectedId(n.id);
    const pt = svgPointFromEvent(svgRef.current, e);
    drag.current = { id: n.id, offX: pt.x - n.x, offY: pt.y - n.y };
    e.preventDefault();
  }
  function onSvgMouseMove(e: React.MouseEvent) {
    if (!drag.current) return;
    const pt = svgPointFromEvent(svgRef.current, e);
    const next = topology.nodes.map((n) =>
      n.id === drag.current!.id ? { ...n, x: Math.max(0, pt.x - drag.current!.offX), y: Math.max(0, pt.y - drag.current!.offY) } : n
    );
    onChange({ ...topology, nodes: next });
  }
  function onSvgMouseUp() {
    if (drag.current) {
      drag.current = null;
      setDirty(true);
    }
  }

  function svgPointFromEvent(svg: SVGSVGElement | null, e: React.MouseEvent): { x: number; y: number } {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((e.clientX - rect.left) / rect.width) * vb.width,
      y: ((e.clientY - rect.top) / rect.height) * vb.height,
    };
  }

  function addNode(layer: ArchLayer, kind: "service" | "pod" | "container") {
    const id = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const defaults = kind === "container"
      ? { w: 200, h: 120, name: "新容器" }
      : { w: 120, h: 48,  name: "新节点" };
    const newNode: TopologyNode = {
      id, x: 60 + Math.random() * 200, y: 60 + Math.random() * 200, ...defaults, layer, kind,
    };
    onChange({ ...topology, nodes: [...topology.nodes, newNode] });
    setSelectedId(id);
    setDirty(true);
    setToast(`已新增${kind === "container" ? "容器" : "节点"}：${defaults.name}`);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const target = topology.nodes.find((n) => n.id === selectedId);
    if (!target) return;
    if (target.kind === "container" && topology.nodes.some((c) => c !== target && c.kind === "container")) {
      if (!window.confirm("删除容器会保留内部节点（不会被自动删除），确认？")) return;
    }
    onChange({
      nodes: topology.nodes.filter((n) => n.id !== selectedId),
      edges: topology.edges.filter((e) => e.from !== selectedId && e.to !== selectedId),
    });
    setSelectedId(null);
    setDirty(true);
    setToast(`已删除：${target.name}`);
  }

  function updateSelected(patch: Partial<TopologyNode>) {
    if (!selectedId) return;
    onChange({
      ...topology,
      nodes: topology.nodes.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)),
    });
    setDirty(true);
  }

  function resetToDefault() {
    if (!window.confirm("重置会丢弃当前画布上的所有节点/连线，确认？")) return;
    const fresh = title.includes("部署") ? DEPLOY_TOPOLOGY_FALLBACK : SVC_DEPS_FALLBACK;
    onChange(fresh);
    setSelectedId(null);
    setDirty(true);
    setToast("画布已重置为默认拓扑");
  }

  async function save() {
    await onPersist(topology);
    setDirty(false);
  }

  /* Keyboard: Delete removes selected */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, topology]);

  const selectedNode = topology.nodes.find((n) => n.id === selectedId) || null;

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs">
        <span className="text-muted-foreground mr-1">{title}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => addNode("blue",   "pod")}>
          <Plus className="size-3 mr-1" />L1 节点
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={() => addNode("violet", "pod")}>
          <Plus className="size-3 mr-1" />AI 节点
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={() => addNode("zinc",   "pod")}>
          <Plus className="size-3 mr-1" />基建
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={() => addNode("slate",  "pod")}>
          <Plus className="size-3 mr-1" />平台底座
        </Button>
        {allowContainers && (
          <Button size="sm" variant="outline" className="h-7" onClick={() => addNode("slate", "container")}>
            <Plus className="size-3 mr-1" />容器
          </Button>
        )}
        <span className="w-px h-5 bg-border mx-1" />
        <Button
          size="sm"
          variant={linkFrom ? "default" : "outline"}
          className="h-7"
          onClick={() => setLinkFrom(linkFrom ? null : (selectedId || topology.nodes[0]?.id || null))}
          disabled={topology.nodes.length < 2}
        >
          <ArrowRight className="size-3 mr-1" />{linkFrom ? "选择目标节点" : "连线"}
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={deleteSelected} disabled={!selectedId}>
          <X className="size-3 mr-1" />删除所选
        </Button>
        <span className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="ghost" className="h-7" onClick={resetToDefault}>
          <RotateCcw className="size-3 mr-1" />重置
        </Button>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {topology.nodes.length} 节点 · {topology.edges.length} 连线
            {dirty && <span className="text-amber-500 ml-1">● 未保存</span>}
          </span>
          <Button size="sm" className="h-7" onClick={save} disabled={!dirty}>
            <Save className="size-3 mr-1" />保存
          </Button>
        </span>
      </div>

      {/* Canvas + side panel */}
      <div className="flex-1 grid grid-cols-[1fr_220px] gap-2 min-h-0">
        <div className="relative rounded-md border bg-muted/20 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 800 600"
            className="w-full h-full select-none"
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={onSvgMouseUp}
            onClick={() => { setSelectedId(null); setLinkFrom(null); }}
          >
            {/* Edges */}
            {topology.edges.map((edge) => {
              const fromN = topology.nodes.find((n) => n.id === edge.from);
              const toN = topology.nodes.find((n) => n.id === edge.to);
              if (!fromN || !toN) return null;
              const { start, end } = portPoint(fromN, toN);
              const mx = (start.x + end.x) / 2;
              const my = (start.y + end.y) / 2;
              return (
                <g key={edge.id}>
                  <defs>
                    <marker id={`arrow-${edge.id}`} markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">
                      <polygon points="0 0, 6 2.5, 0 5" fill="hsl(215 14% 55%)" />
                    </marker>
                  </defs>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                        stroke="hsl(215 14% 55%)" strokeWidth="1.5"
                        markerEnd={`url(#arrow-${edge.id})`} />
                  {edge.label && (
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="9" fill="hsl(215 14% 45%)">{edge.label}</text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {topology.nodes.map((n) => {
              const c = layerColor(n.layer);
              const isContainer = n.kind === "container";
              const isSelected = selectedId === n.id;
              const isLinkSource = linkFrom === n.id;
              return (
                <g key={n.id}
                   onMouseDown={(e) => onNodeMouseDown(e, n)}
                   onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}
                   style={{ cursor: isContainer ? "default" : (linkFrom ? "crosshair" : "move") }}>
                  {isContainer ? (
                    <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="8"
                          fill={c.fill} stroke={c.stroke}
                          strokeWidth={isSelected ? 2 : 1}
                          strokeDasharray="6 4" />
                  ) : (
                    <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
                          fill={c.fill} stroke={isSelected ? "hsl(var(--primary))" : c.stroke}
                          strokeWidth={isSelected ? 2 : 1.5} />
                  )}
                  <text x={n.x + 10} y={n.y + 18} fontSize={isContainer ? 11 : 10} fontWeight="600" fill={c.text}>
                    {n.name}
                  </text>
                  {isContainer && (
                    <text x={n.x + n.w - 8} y={n.y + 18} textAnchor="end" fontSize="9" fill="hsl(215 14% 50%)">
                      容器 · {(topology.nodes.filter((x) => x !== n && x.x > n.x && x.y > n.y && x.x + x.w < n.x + n.w && x.y + x.h < n.y + n.h)).length}
                    </text>
                  )}
                  {isLinkSource && (
                    <circle cx={n.x + n.w - 8} cy={n.y + 8} r="4" fill="hsl(var(--primary))" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side panel */}
        <div className="rounded-md border bg-card p-2 overflow-auto">
          {selectedNode ? (
            <div className="space-y-2 text-xs">
              <div className="text-[11px] text-muted-foreground">选中节点</div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">名称</div>
                <input
                  value={selectedNode.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  className="w-full rounded border bg-background px-1.5 py-1 text-xs focus:border-primary/40 focus:outline-none"
                />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">尺寸 (宽 × 高)</div>
                <div className="flex items-center gap-1">
                  <input type="number" value={selectedNode.w} onChange={(e) => updateSelected({ w: Number(e.target.value) })} className="w-1/2 rounded border bg-background px-1.5 py-1 text-xs" />
                  <input type="number" value={selectedNode.h} onChange={(e) => updateSelected({ h: Number(e.target.value) })} className="w-1/2 rounded border bg-background px-1.5 py-1 text-xs" />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">层级颜色</div>
                <div className="flex flex-wrap gap-1">
                  {(["blue","violet","zinc","slate","orange","green","red"] as ArchLayer[]).map((l) => {
                    const cc = layerColor(l);
                    return (
                      <button key={l} onClick={() => updateSelected({ layer: l })}
                              className={`size-5 rounded ${cc.dot} ${selectedNode.layer === l ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"}`}
                              title={l} />
                    );
                  })}
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-[10px] text-muted-foreground mb-0.5">关联边</div>
                <div className="space-y-0.5 text-[10px]">
                  {topology.edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).map((e) => {
                    const other = topology.nodes.find((n) => n.id === (e.from === selectedNode.id ? e.to : e.from));
                    return (
                      <div key={e.id} className="flex items-center justify-between rounded bg-muted/40 px-1.5 py-0.5">
                        <span>{e.from === selectedNode.id ? "→ " : "← "}{other?.name ?? "?"}</span>
                        <button onClick={() => {
                          onChange({ ...topology, edges: topology.edges.filter((x) => x.id !== e.id) });
                          setDirty(true);
                        }} className="text-muted-foreground hover:text-destructive">
                          <X className="size-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-[11px] text-muted-foreground leading-4">
              <p>提示：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>拖拽节点调整位置</li>
                <li>点击节点选中（右侧面板可改名称 / 尺寸 / 颜色）</li>
                <li>按 Delete / Backspace 删除选中节点</li>
                <li>点工具栏「连线」+ 选中源节点，再点目标节点</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function EditableText({
  value,
  onChange,
  className = "",
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Keep draft in sync if the parent value changes (e.g. from server reload).
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          rows={2}
          className={`w-full rounded border border-primary/40 bg-background px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/40 ${className}`}
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={`w-full rounded border border-primary/40 bg-background px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/40 ${className}`}
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      className={`rounded px-1 py-0.5 -mx-1 -my-0.5 cursor-text hover:bg-muted/60 ${className}`}
      title="点击编辑"
    >
      {value || <span className="text-muted-foreground/60">（点击编辑）</span>}
    </div>
  );
}

/* ═══════════════════════ Toast helper ═══════════════════════ */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

/* ═══════════════════════ Export helper ═══════════════════════ */
function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════ Business Architecture Data ═══════════════════════ */
interface BALayer {
  level: string;
  name: string;
  desc: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

/* Icon/color lookup maps for API data (frontend-only properties) */
const BA_LEVEL_META: Record<string, { icon: React.ElementType; color: string }> = {
  L1: { icon: Link, color: "bg-red-500" },
  L2: { icon: Lightbulb, color: "bg-orange-500" },
  L3: { icon: RefreshCw, color: "bg-amber-500" },
  L4: { icon: User, color: "bg-green-500" },
  L5: { icon: Zap, color: "bg-blue-500" },
  L6: { icon: Package, color: "bg-purple-500" },
};

const VALUE_CHAIN_ICON_MAP: Record<string, React.ElementType> = {
  "市场获取": Megaphone,
  "产品研发": FlaskConical,
  "采购供应": Truck,
  "生产制造": Factory,
  "营销销售": Briefcase,
  "客户服务": Headphones,
};

const INITIAL_BA_LAYERS_FALLBACK: BALayer[] = [
  { level: "L1", name: "价值链", desc: "端到端价值流", count: 5, icon: Link, color: "bg-red-500" },
  { level: "L2", name: "业务能力", desc: "可独立提供价值的业务能力", count: 28, icon: Lightbulb, color: "bg-orange-500" },
  { level: "L3", name: "业务流程", desc: "端到端业务流程图", count: 64, icon: RefreshCw, color: "bg-amber-500" },
  { level: "L4", name: "业务角色", desc: "执行流程的角色", count: 18, icon: User, color: "bg-green-500" },
  { level: "L5", name: "业务事件", desc: "业务事件触发", count: 42, icon: Zap, color: "bg-blue-500" },
  { level: "L6", name: "业务对象", desc: "业务层面的核心对象", count: 56, icon: Package, color: "bg-purple-500" },
];

const VALUE_CHAIN_FALLBACK = [
  { name: "市场获取", apps: ["CRM", "营销"], icon: Megaphone },
  { name: "产品研发", apps: ["PLM", "项目管理"], icon: FlaskConical },
  { name: "采购供应", apps: ["SRM", "WMS"], icon: Truck },
  { name: "生产制造", apps: ["MES", "ERP"], icon: Factory },
  { name: "营销销售", apps: ["CRM", "电商"], icon: Briefcase },
  { name: "客户服务", apps: ["客服", "工单"], icon: Headphones },
];

/* ═══════════════════════ Application Architecture Data ═══════════════════════ */
const APP_DEPENDENCIES_FALLBACK = [
  { from: "客户管理 CRM", to: "数据中台", calls: 1240, type: "数据查询" },
  { from: "报销审批", to: "财务系统", calls: 580, type: "凭证写入" },
  { from: "销售看板", to: "客户管理 CRM", calls: 920, type: "API 调用" },
  { from: "智能体助手", to: "数据中台", calls: 1850, type: "LLM 查询" },
  { from: "采购流程", to: "ERP", calls: 432, type: "数据同步" },
];

const APP_FLOW_MATRIX_FALLBACK = [
  { app: "客户管理 CRM", flows: 5, data: 3, pages: 12 },
  { app: "报销审批", flows: 3, data: 2, pages: 8 },
  { app: "销售看板", flows: 10, data: 5, pages: 15 },
  { app: "智能体助手", flows: 8, data: 1, pages: 3 },
  { app: "数字员工小秘", flows: 6, data: 0, pages: 2 },
  { app: "VibeCoding Demo", flows: 0, data: 0, pages: 1 },
];

/* ═══════════════════════ Data Architecture Data ═══════════════════════ */
const DATA_DOMAIN_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  "客户域": { icon: Handshake, color: "bg-blue-500" },
  "订单域": { icon: ClipboardList, color: "bg-green-500" },
  "产品域": { icon: Package, color: "bg-orange-500" },
  "财务域": { icon: DollarSign, color: "bg-yellow-500" },
  "人事域": { icon: Users, color: "bg-purple-500" },
  "运营域": { icon: BarChart3, color: "bg-pink-500" },
};

const DATA_DOMAINS_FALLBACK = [
  { name: "客户域", objects: 8, apps: ["CRM", "销售看板"], icon: Handshake, color: "bg-blue-500" },
  { name: "订单域", objects: 12, apps: ["CRM", "ERP"], icon: ClipboardList, color: "bg-green-500" },
  { name: "产品域", objects: 6, apps: ["PLM", "电商"], icon: Package, color: "bg-orange-500" },
  { name: "财务域", objects: 10, apps: ["ERP", "报销"], icon: DollarSign, color: "bg-yellow-500" },
  { name: "人事域", objects: 7, apps: ["HR"], icon: Users, color: "bg-purple-500" },
  { name: "运营域", objects: 13, apps: ["BI"], icon: BarChart3, color: "bg-pink-500" },
];

/* ═══════════════════════ Tech Architecture Data ═══════════════════════ */
const TECH_STACK_FALLBACK = [
  { layer: "前端", items: ["React 19", "Tailwind 4", "Vite 7", "shadcn/ui", "React Router 7"] },
  { layer: "后端", items: ["Java 21", "Spring Boot 3", "Spring Cloud", "Flowable 7", "GraphQL"] },
  { layer: "数据库", items: ["PostgreSQL 16", "Neo4j 5", "Milvus 2.4", "Redis 7", "ClickHouse"] },
  { layer: "消息", items: ["Apache Kafka 3.6", "RocketMQ 5"] },
  { layer: "部署", items: ["Kubernetes 1.29", "Helm", "ArgoCD", "Istio"] },
  { layer: "AI", items: ["LLM Gateway", "LangGraph", "DeepSeek", "Qwen", "BGE-M3"] },
];

/* ── Topology data shape ─────────────────────────────────────────────
   Two artifacts in the ta section share this shape:
     ta.deployTopology  — 部署拓扑图 (Region → LB → K8s → pods)
     ta.svcDeps         — 服务依赖图 (microservices + arrows)
   Each artifact is { nodes, edges }. Nodes have an explicit (x,y) so
   the canvas can persist layout across reloads. Edges reference nodes
   by id. layer drives the colour token (see ArchLayer). kind="container"
   draws a dashed frame around its children — used for Region / K8s
   cluster in the deployment view. */
type TopologyNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  layer: ArchLayer;
  kind?: "container" | "service" | "pod";
};
type TopologyEdge = { id: string; from: string; to: string; label?: string };
type Topology = { nodes: TopologyNode[]; edges: TopologyEdge[] };

const DEPLOY_TOPOLOGY_FALLBACK: Topology = {
  nodes: [
    { id: "region",   x: 20,  y: 10,  w: 760, h: 580, name: "Region: China-East-2",  layer: "slate",  kind: "container" },
    { id: "lb",       x: 320, y: 50,  w: 160, h: 40,  name: "Nginx + Istio",          layer: "slate"  },
    { id: "k8s",      x: 50,  y: 130, w: 700, h: 440, name: "K8s 1.29 Cluster (3 Nodes)", layer: "slate", kind: "container" },
    { id: "api-gw",   x: 80,  y: 170, w: 130, h: 60,  name: "API Gateway",   layer: "blue"   },
    { id: "app-svc",  x: 240, y: 170, w: 130, h: 60,  name: "App Service",   layer: "blue"   },
    { id: "ai-svc",   x: 400, y: 170, w: 130, h: 60,  name: "AI Service",    layer: "violet" },
    { id: "flowable", x: 560, y: 170, w: 130, h: 60,  name: "Flowable",      layer: "violet" },
    { id: "db-pri",   x: 80,  y: 270, w: 130, h: 60,  name: "DB Primary",    layer: "zinc"   },
    { id: "db-rep",   x: 240, y: 270, w: 130, h: 60,  name: "DB Replica",    layer: "zinc"   },
    { id: "redis",    x: 400, y: 270, w: 130, h: 60,  name: "Redis Cache",   layer: "zinc"   },
    { id: "minio",    x: 560, y: 270, w: 130, h: 60,  name: "MinIO S3",      layer: "zinc"   },
    { id: "pg",       x: 80,  y: 380, w: 130, h: 60,  name: "Postgres",      layer: "zinc"   },
    { id: "monitor",  x: 240, y: 380, w: 130, h: 60,  name: "Prometheus",    layer: "zinc"   },
    { id: "loki",     x: 400, y: 380, w: 130, h: 60,  name: "Loki",          layer: "zinc"   },
    { id: "argo",     x: 560, y: 380, w: 130, h: 60,  name: "ArgoCD",        layer: "blue"   },
  ],
  edges: [
    { id: "e1",  from: "lb",     to: "api-gw" },
    { id: "e2",  from: "lb",     to: "app-svc" },
    { id: "e3",  from: "lb",     to: "ai-svc" },
    { id: "e4",  from: "lb",     to: "flowable" },
    { id: "e5",  from: "api-gw", to: "app-svc" },
    { id: "e6",  from: "app-svc", to: "db-pri" },
    { id: "e7",  from: "db-pri", to: "db-rep" },
    { id: "e8",  from: "app-svc", to: "redis" },
    { id: "e9",  from: "ai-svc", to: "redis" },
    { id: "e10", from: "flowable", to: "pg" },
    { id: "e11", from: "monitor", to: "loki" },
    { id: "e12", from: "argo",    to: "k8s", label: "deploys" },
  ],
};

const SVC_DEPS_FALLBACK: Topology = {
  nodes: [
    { id: "api-gw",   x: 320, y: 30,  w: 140, h: 50, name: "API Gateway",  layer: "slate",  kind: "service" },
    { id: "user",     x: 70,  y: 130, w: 130, h: 50, name: "User Service", layer: "blue",   kind: "service" },
    { id: "order",    x: 240, y: 130, w: 130, h: 50, name: "Order Service", layer: "blue",  kind: "service" },
    { id: "ai",       x: 410, y: 130, w: 130, h: 50, name: "AI Service",   layer: "violet", kind: "service" },
    { id: "flowable", x: 580, y: 130, w: 140, h: 50, name: "Flowable",     layer: "violet", kind: "service" },
    { id: "auth",     x: 70,  y: 230, w: 130, h: 50, name: "Auth Service", layer: "slate",  kind: "service" },
    { id: "db",       x: 240, y: 230, w: 130, h: 50, name: "DB Service",   layer: "zinc",   kind: "service" },
    { id: "llm-gw",   x: 410, y: 230, w: 130, h: 50, name: "LLM Gateway",  layer: "violet", kind: "service" },
    { id: "cache",    x: 580, y: 230, w: 140, h: 50, name: "Cache",        layer: "zinc",   kind: "service" },
  ],
  edges: [
    { id: "d1",  from: "api-gw",  to: "user" },
    { id: "d2",  from: "api-gw",  to: "order" },
    { id: "d3",  from: "api-gw",  to: "ai" },
    { id: "d4",  from: "api-gw",  to: "flowable" },
    { id: "d5",  from: "user",    to: "auth" },
    { id: "d6",  from: "order",   to: "db" },
    { id: "d7",  from: "ai",      to: "llm-gw" },
    { id: "d8",  from: "flowable", to: "db" },
    { id: "d9",  from: "llm-gw",  to: "cache" },
    { id: "d10", from: "order",   to: "cache" },
  ],
};

/* The original simple {label, value} list shape is kept for the
   read-only summary card below the diagram. The new editor stores
   the canvas layout under `ta.deployTopology` and `ta.svcDeps`. */
const DEPLOY_TOPOLOGY_SUMMARY_FALLBACK = [
  { label: "集群", value: "K8s 1.29 (3 节点)" },
  { label: "负载均衡", value: "Nginx + Istio" },
  { label: "服务网格", value: "Istio 1.20" },
  { label: "CI/CD", value: "GitHub Actions + ArgoCD" },
];

const OBSERVABILITY_FALLBACK = [
  { label: "日志", value: "ELK 8.x" },
  { label: "监控", value: "Prometheus + Grafana" },
  { label: "链路追踪", value: "Jaeger" },
  { label: "告警", value: "AlertManager" },
];

const CAPABILITY_LIST_FALLBACK = [
  "营销管理", "销售管理", "客户服务", "采购管理", "生产管理", "仓储物流",
  "财务管理", "人力资源", "研发管理", "质量管理", "法务合规", "战略规划",
];

const ROLES_FALLBACK = [
  { role: "销售经理", dept: "销售部", caps: ["商机管理", "报价管理", "客户画像"], flows: 5, apps: 2 },
  { role: "采购主管", dept: "采购部", caps: ["供应商管理", "采购申请", "比价管理"], flows: 4, apps: 2 },
  { role: "生产主管", dept: "制造部", caps: ["生产计划", "质量检测", "库存管理"], flows: 6, apps: 2 },
  { role: "财务主管", dept: "财务部", caps: ["应收应付", "总账管理", "预算管控"], flows: 3, apps: 2 },
  { role: "HR 主管", dept: "人力资源", caps: ["招聘管理", "薪酬绩效", "培训发展"], flows: 4, apps: 1 },
  { role: "客服主管", dept: "客服中心", caps: ["工单管理", "满意度调查", "知识库"], flows: 3, apps: 2 },
  { role: "研发主管", dept: "研发中心", caps: ["项目管理", "需求管理", "版本发布"], flows: 5, apps: 1 },
  { role: "合规专员", dept: "法务部", caps: ["合同审查", "合规审计", "风险管理"], flows: 2, apps: 1 },
];

const EVENTS_FALLBACK = [
  { name: "客户创建", trigger: "CRM 新建客户", type: "业务事件", process: "客户审核流程", freq: 32 },
  { name: "订单生成", trigger: "下单完成", type: "业务事件", process: "订单确认流程", freq: 128 },
  { name: "库存预警", trigger: "库存低于阈值", type: "系统事件", process: "自动补货流程", freq: 8 },
  { name: "审批超时", trigger: "审批节点超 48h", type: "异常事件", process: "升级通知流程", freq: 5 },
  { name: "合同到期", trigger: "合同到期前 30 天", type: "时间事件", process: "续约提醒流程", freq: 3 },
  { name: "支付成功", trigger: "支付回调", type: "系统事件", process: "订单状态更新", freq: 96 },
  { name: "质量不合格", trigger: "检验不通过", type: "异常事件", process: "退货处理流程", freq: 2 },
  { name: "员工入职", trigger: "HR 系统新增", type: "业务事件", process: "入职审批流程", freq: 4 },
];

const OBJECTS_FALLBACK = [
  { name: "客户", domain: "客户域", fields: 24, relations: 8, icon: Users },
  { name: "订单", domain: "订单域", fields: 32, relations: 12, icon: ClipboardList },
  { name: "产品", domain: "产品域", fields: 18, relations: 6, icon: Package },
  { name: "供应商", domain: "采购域", fields: 20, relations: 5, icon: Truck },
  { name: "员工", domain: "人事域", fields: 28, relations: 10, icon: User },
  { name: "合同", domain: "法务域", fields: 15, relations: 4, icon: FileText },
  { name: "发票", domain: "财务域", fields: 12, relations: 3, icon: DollarSign },
  { name: "工单", domain: "客服域", fields: 16, relations: 6, icon: ClipboardList },
  { name: "项目", domain: "研发域", fields: 22, relations: 8, icon: Briefcase },
];

const BIZ_APP_MATRIX_FALLBACK = [
  { process: "客户跟进", crm: true, erp: false, hr: false, bi: true, oa: false, bpm: false },
  { process: "采购审批", crm: false, erp: true, hr: false, bi: false, oa: true, bpm: true },
  { process: "员工入职", crm: false, erp: false, hr: true, bi: false, oa: true, bpm: true },
  { process: "报销流程", crm: false, erp: true, hr: false, bi: false, oa: true, bpm: true },
  { process: "销售预测", crm: true, erp: true, hr: false, bi: true, oa: false, bpm: false },
  { process: "绩效考核", crm: false, erp: false, hr: true, bi: true, oa: true, bpm: false },
  { process: "合同审批", crm: true, erp: true, hr: false, bi: false, oa: true, bpm: true },
  { process: "库存盘点", crm: false, erp: true, hr: false, bi: true, oa: false, bpm: false },
];

const APP_DATA_MATRIX_FALLBACK = [
  { app: "CRM", domains: [true, true, false, false, false, true] },
  { app: "ERP", domains: [false, true, true, true, false, false] },
  { app: "HR", domains: [false, false, false, false, true, false] },
  { app: "BI", domains: [true, true, true, true, true, true] },
  { app: "OA", domains: [false, false, false, true, true, false] },
  { app: "BPM", domains: [false, false, false, false, false, false] },
];

const LAKE_WAREHOUSE_FALLBACK = [
  { layer: "ODS", name: "原始层", count: 38, color: "border-l-blue-500", desc: "原始数据同步" },
  { layer: "DWD", name: "明细层", count: 24, color: "border-l-green-500", desc: "清洗 & 去重" },
  { layer: "DWS", name: "汇总层", count: 12, color: "border-l-orange-500", desc: "主题汇总" },
  { layer: "ADS", name: "应用层", count: 18, color: "border-l-red-500", desc: "面向应用" },
];

const DATA_DISTRIBUTION_FALLBACK = {
  dataLake: [
    { name: "原始日志", size: "2.4 TB", tables: 128 },
    { name: "埋点数据", size: "1.8 TB", tables: 64 },
    { name: "外部数据", size: "640 GB", tables: 32 },
  ],
  dataWarehouse: [
    { name: "ODS 原始层", size: "1.2 TB", tables: 38 },
    { name: "DWD 明细层", size: "860 GB", tables: 24 },
    { name: "DWS 汇总层", size: "320 GB", tables: 12 },
    { name: "ADS 应用层", size: "480 GB", tables: 18 },
  ],
  realtime: [
    { name: "Kafka Topics", size: "128 GB", tables: 16 },
    { name: "Redis 缓存", size: "32 GB", tables: 8 },
    { name: "ClickHouse", size: "256 GB", tables: 6 },
  ],
};

const TECH_SELECTION_FALLBACK = [
  { layer: "前端框架", a: "React 19", b: "Vue 3.4", chosen: "React 19", score: 92 },
  { layer: "UI 组件库", a: "shadcn/ui", b: "Ant Design 5", chosen: "shadcn/ui", score: 88 },
  { layer: "后端框架", a: "Spring Boot 3", b: "NestJS 10", chosen: "Spring Boot 3", score: 90 },
  { layer: "关系数据库", a: "PostgreSQL 16", b: "MySQL 8", chosen: "PostgreSQL 16", score: 95 },
  { layer: "图数据库", a: "Neo4j 5", b: "ArangoDB", chosen: "Neo4j 5", score: 85 },
  { layer: "向量数据库", a: "Milvus 2.4", b: "Weaviate", chosen: "Milvus 2.4", score: 87 },
  { layer: "消息队列", a: "Kafka 3.6", b: "RocketMQ 5", chosen: "Kafka 3.6", score: 91 },
  { layer: "容器编排", a: "Kubernetes", b: "Docker Swarm", chosen: "Kubernetes", score: 96 },
  { layer: "AI 模型", a: "DeepSeek", b: "Qwen 2", chosen: "DeepSeek", score: 89 },
];

/* ═══════════════════════ BusinessArchitecture ═══════════════════════ */
export function BusinessArchitecture() {
  const [baLayers, setBALayers] = useState<BALayer[]>(INITIAL_BA_LAYERS_FALLBACK);
  const [valueChain, setValueChain] = useState(INITIAL_BA_LAYERS_FALLBACK.length ? VALUE_CHAIN_FALLBACK : []);
  const [capabilityList, setCapabilityList] = useState<string[]>(CAPABILITY_LIST_FALLBACK);
  const [roles, setRoles] = useState(ROLES_FALLBACK);
  const [events, setEvents] = useState(EVENTS_FALLBACK);
  const [objects, setObjects] = useState(OBJECTS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<BALayer | null>(null);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerDesc, setNewLayerDesc] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [designMode, setDesignMode] = useState(true);
  const { toast, setToast } = useToast();

  // Value chain editing
  const [showVCEditDialog, setShowVCEditDialog] = useState(false);
  const [editingVCIndex, setEditingVCIndex] = useState<number | null>(null);
  const [vcEditName, setVCEditName] = useState("");
  const [vcEditDesc, setVCEditDesc] = useState("");
  const [vcEditApps, setVCEditApps] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  /* Fetch data from API on mount */
  useEffect(() => {
    architectureApi.getSection("ba").then((sectionData) => {
      if (sectionData?.layers) {
        const apiLayers: BALayer[] = (sectionData.layers as Record<string, unknown>[]).map((l) => {
          const level = l.level as string;
          const meta = BA_LEVEL_META[level] || { icon: Layers, color: "bg-gray-500" };
          return { ...l, icon: meta.icon, color: meta.color } as unknown as BALayer;
        });
        setBALayers(apiLayers);
      }
      if (sectionData?.valueChain) {
        const apiVC = (sectionData.valueChain as Record<string, unknown>[]).map((v) => {
          const name = v.name as string;
          const icon = VALUE_CHAIN_ICON_MAP[name] || Link;
          return { ...v, icon } as { name: string; apps: string[]; icon: React.ElementType };
        });
        setValueChain(apiVC);
      }
      if (sectionData?.capabilityList) {
        setCapabilityList(sectionData.capabilityList as string[]);
      }
      if (sectionData?.roles) setRoles(sectionData.roles as typeof ROLES_FALLBACK);
      if (sectionData?.events) setEvents(sectionData.events as typeof EVENTS_FALLBACK);
      if (sectionData?.objects) setObjects(sectionData.objects as typeof OBJECTS_FALLBACK);
    }).catch(() => { /* use fallback */ }).finally(() => setLoading(false));
  }, []);

  /* ── Value chain helpers ── */
  const saveValueChain = (newVC: typeof valueChain) => {
    setValueChain(newVC);
    architectureApi.updateSection("ba", {
      valueChain: newVC.map(({ icon: _i, ...rest }) => rest)
    }).catch(() => {});
  };

  const handleAddVCStage = () => {
    const newStage = { name: "新阶段", apps: ["系统A"], icon: Box, desc: "阶段描述" };
    const newVC = [...valueChain, newStage];
    saveValueChain(newVC);
    setToast("已添加阶段");
  };

  const handleEditVCStage = (index: number) => {
    const v = valueChain[index];
    setEditingVCIndex(index);
    setVCEditName(v.name);
    setVCEditDesc((v as any).desc || "");
    setVCEditApps(v.apps.join(", "));
    setShowVCEditDialog(true);
  };

  const handleSaveVCEdit = () => {
    if (editingVCIndex === null) return;
    const newVC = [...valueChain];
    newVC[editingVCIndex] = {
      ...newVC[editingVCIndex],
      name: vcEditName,
      desc: vcEditDesc,
      apps: vcEditApps.split(",").map(s => s.trim()).filter(Boolean),
    } as any;
    saveValueChain(newVC);
    setShowVCEditDialog(false);
    setToast("已保存");
  };

  const handleDeleteVCStage = (index: number) => {
    const newVC = valueChain.filter((_, i) => i !== index);
    saveValueChain(newVC);
    setToast("已删除阶段");
  };

  const handleDragStart = (index: number) => { setDragIndex(index); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const newVC = [...valueChain];
    const [moved] = newVC.splice(dragIndex, 1);
    newVC.splice(targetIndex, 0, moved);
    saveValueChain(newVC);
    setDragIndex(null);
  };

  /* Filter */
  const filteredLayers = filterLevel
    ? baLayers.filter((l) => l.level === filterLevel)
    : baLayers;

  /* Export */
  function handleExport() {
    const data = baLayers.map((l) => ({ level: l.level, name: l.name, desc: l.desc, count: l.count }));
    downloadJSON(data, "business-architecture-layers.json");
    setToast("导出成功：business-architecture-layers.json");
  }

  function handleExportCSV() {
    const headers = ["层级", "名称", "描述", "数量"];
    const rows = baLayers.map((l) => [l.level, l.name, l.desc, l.count]);
    downloadCSV(headers, rows, "business-architecture-layers.csv");
    setToast("导出成功：business-architecture-layers.csv");
  }

  /* Add layer */
  async function handleAddLayer() {
    if (!newLayerName.trim()) return;
    const nextLevel = `L${baLayers.length + 1}`;
    const newLayer: BALayer = {
      level: nextLevel,
      name: newLayerName.trim(),
      desc: newLayerDesc.trim() || "自定义层级",
      count: 0,
      icon: Layers,
      color: "bg-gray-500",
    };
    const updated = [...baLayers, newLayer];
    setBALayers(updated);
    setNewLayerName("");
    setNewLayerDesc("");
    setShowAddDialog(false);
    setToast(`已新增层级：${newLayer.level} ${newLayer.name}`);
    /* Persist to API (fire-and-forget, strip icon/color) */
    architectureApi.updateSection("ba", { layers: updated.map(({ icon: _i, color: _c, ...rest }) => rest) }).catch(() => {});
  }

  /* Inline-edit layer name / description (design mode only) */
  function updateLayerName(level: string, v: string) {
    const updated = baLayers.map((l) => (l.level === level ? { ...l, name: v } : l));
    setBALayers(updated);
    architectureApi.updateSection("ba", { layers: updated.map(({ icon: _i, color: _c, ...rest }) => rest) }).catch(() => {});
  }
  function updateLayerDesc(level: string, v: string) {
    const updated = baLayers.map((l) => (l.level === level ? { ...l, desc: v } : l));
    setBALayers(updated);
    architectureApi.updateSection("ba", { layers: updated.map(({ icon: _i, color: _c, ...rest }) => rest) }).catch(() => {});
  }
  function handleDeleteLayer(level: string) {
    const target = baLayers.find((l) => l.level === level);
    if (!target) return;
    if (!window.confirm(`确认删除 ${target.level} ${target.name}？`)) return;
    const updated = baLayers.filter((l) => l.level !== level);
    setBALayers(updated);
    architectureApi.updateSection("ba", { layers: updated.map(({ icon: _i, color: _c, ...rest }) => rest) }).catch(() => {});
    setToast(`已删除层级：${target.level}`);
  }

  /* Row click */
  function handleRowClick(layer: BALayer) {
    setSelectedLayer(layer);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> 加载中...
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> 业务架构
          </h1>
          <p className="text-sm text-muted-foreground">企业业务架构 L1-L6 层模型 + 价值链</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="size-3 mr-1" />筛选
            {filterLevel && <Badge variant="secondary" className="ml-1 text-xs">{filterLevel}</Badge>}
          </Button>
          {/* F3.5.4 设计态/运行态切换 */}
          <Button variant={designMode ? "default" : "outline"} size="sm" onClick={() => setDesignMode(!designMode)}>
            {designMode ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
            {designMode ? "设计态" : "运行态"}
          </Button>
          {/* F3.1.7 导入 */}
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="size-3 mr-1" />导入
          </Button>
          {/* F3.1.7 导出 */}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
          {designMode && (
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="size-3 mr-1" />新增层级
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">按层级筛选：</span>
              <Button
                variant={filterLevel === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterLevel("")}
              >
                全部
              </Button>
              {baLayers.map((l) => (
                <Button
                  key={l.level}
                  variant={filterLevel === l.level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterLevel(l.level)}
                >
                  {l.level}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setFilterLevel(""); setShowFilter(false); }}>
                <X className="size-3 mr-1" /> 关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="layers">
        <TabsList>
          <TabsTrigger value="layers">L1-L6 分层</TabsTrigger>
          <TabsTrigger value="value">L1 价值链图</TabsTrigger>
          <TabsTrigger value="capability">L2 能力地图</TabsTrigger>
          <TabsTrigger value="roles">L4 业务角色</TabsTrigger>
          <TabsTrigger value="events">L5 业务事件</TabsTrigger>
          <TabsTrigger value="objects">L6 业务对象</TabsTrigger>
        </TabsList>
        <TabsContent value="layers" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">业务架构分层模型</CardTitle>
                  <CardDescription className="text-xs">
                    {designMode
                      ? "设计态：可拖拽重排，点击名称 / 描述可重命名。"
                      : "运行态：点击行查看详情。"}
                  </CardDescription>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">{filteredLayers.length} 层</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Compaction note: previous version used size-12 (48px) avatar
                  circles + size-6 (24px) icons + p-3 (12px) row padding,
                  which made the whole stack feel heavy. Switched to size-8
                  + size-4 + py-2 for a denser list that fits the same
                  amount of detail on one screen. */}
              <div className="space-y-1.5">
                {filteredLayers.map((l, i) => {
                  const LayerIcon = l.icon;
                  const editable = designMode;
                  return (
                    <div
                      key={l.level}
                      draggable={editable}
                      onDragStart={(e) => { if (editable) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); } }}
                      onDragOver={(e) => { if (editable) e.preventDefault(); }}
                      onDrop={(e) => {
                        if (!editable) return;
                        e.preventDefault();
                        const from = Number(e.dataTransfer.getData("text/plain"));
                        if (Number.isNaN(from) || from === i) return;
                        const next = [...filteredLayers];
                        const [moved] = next.splice(from, 1);
                        next.splice(i, 0, moved);
                        setBALayers(next);
                        architectureApi.updateSection("ba", { layers: next.map(({ icon: _i, color: _c, ...rest }) => rest) }).catch(() => {});
                        setToast(`已调整层级顺序`);
                      }}
                      className={`group flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 transition-colors ${editable ? "cursor-grab active:cursor-grabbing hover:border-primary/40" : "cursor-pointer hover:border-primary/40"}`}
                      onClick={() => { if (!editable) handleRowClick(l); }}
                    >
                      {/* Layer badge — 32px instead of 48px */}
                      <div className={`size-8 rounded ${l.color} text-white flex items-center justify-center font-semibold text-[10px] shrink-0`}>
                        {l.level}
                      </div>

                      {/* Icon — 16px instead of 24px */}
                      <LayerIcon className="size-4 text-muted-foreground shrink-0" />

                      {/* Name + desc — inline-editable in design mode */}
                      <div className="flex-1 min-w-0">
                        {editable ? (
                          <EditableText
                            value={l.name}
                            onChange={(v) => updateLayerName(l.level, v)}
                            className="text-sm font-medium leading-5"
                          />
                        ) : (
                          <div className="text-sm font-medium truncate">{l.name}</div>
                        )}
                        {editable ? (
                          <EditableText
                            value={l.desc}
                            onChange={(v) => updateLayerDesc(l.level, v)}
                            className="text-[11px] text-muted-foreground leading-4"
                            multiline
                          />
                        ) : (
                          <div className="text-[11px] text-muted-foreground truncate">{l.desc}</div>
                        )}
                      </div>

                      {/* Count badge */}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{l.count}</Badge>

                      {/* Edit affordances in design mode */}
                      {editable ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLayer(l.level); }}
                          className="size-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除该层级"
                        >
                          <X className="size-3" />
                        </button>
                      ) : (
                        <Eye className="size-3.5 text-muted-foreground shrink-0" />
                      )}

                      {/* Down arrow between rows */}
                      {i < filteredLayers.length - 1 && <ArrowDown className="size-3 text-muted-foreground shrink-0" />}
                    </div>
                  );
                })}

                {/* Inline add row (only in design mode) */}
                {designMode && (
                  <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                    <div className="size-8 rounded bg-muted inline-flex items-center justify-center">
                      <Plus className="size-4" />
                    </div>
                    <input
                      value={newLayerName}
                      onChange={(e) => setNewLayerName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddLayer(); }}
                      placeholder={`新增 L${baLayers.length + 1} 层（Enter 确认）`}
                      className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                    />
                  </div>
                )}
              </div>
              {filteredLayers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="size-8 mb-2" />
                  <p className="text-sm">没有匹配的层级</p>
                  <Button variant="link" size="sm" onClick={() => setFilterLevel("")}>清除筛选</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="value" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">端到端价值链</CardTitle>
                  <CardDescription>
                    {designMode
                      ? "设计态 — 拖拽调整顺序，点击编辑节点属性"
                      : "Michael Porter 价值链模型 — 从市场获取到客户服务的完整价值流转"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {designMode && (
                    <Button size="sm" variant="outline" onClick={handleAddVCStage} className="h-7 text-xs">
                      <Plus className="size-3 mr-1" /> 添加阶段
                    </Button>
                  )}
                  <Badge variant="outline" className="text-xs">{valueChain.length} 阶段</Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => downloadJSON(valueChain.map(({ icon: _i, ...rest }) => rest), "value-chain.json")}>
                    <Download className="size-3 mr-1" /> 导出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {designMode ? (
                /* ── Design Mode: Editable Canvas ── */
                <div className="px-4 pt-2 pb-4">
                  {/* Canvas area */}
                  {/* Compaction note: stage card was 160×~140px with p-3 +
                      6px icons + "编辑" button at the bottom that did nothing
                      useful (handleEditVCStage opens the same dialog as the
                      row click in read mode). Removed that button and shrunk
                      the card to minWidth 124 + p-2 so 6 stages fit on a
                      1280-wide screen without horizontal scroll. */}
                  <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-2.5 min-h-[80px]">
                    <div className="flex flex-wrap items-start gap-2">
                      {valueChain.map((v, i) => {
                        const colors = ["#3b82f6", "#f97316", "#eab308", "#22c55e", "#8b5cf6", "#ec4899"];
                        const color = colors[i % colors.length];
                        const Icon = v.icon;
                        return (
                          <div key={`${v.name}-${i}`} className="flex items-center">
                            <div
                              draggable
                              onDragStart={() => handleDragStart(i)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(i)}
                              onDoubleClick={() => handleEditVCStage(i)}
                              className="group relative rounded-md border bg-card hover:shadow-sm transition-all"
                              style={{ borderColor: "#d6d4d0", minWidth: 124 }}
                            >
                              {/* Drag handle */}
                              <div className="absolute top-0.5 left-1.5 text-[9px] text-muted-foreground cursor-grab select-none" aria-hidden>⋮⋮</div>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteVCStage(i)}
                                className="absolute top-0.5 right-0.5 size-4 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                title="删除该阶段"
                              >
                                <X className="size-2.5" />
                              </button>

                              {/* Content */}
                              <div className="px-2 pt-2 pb-1.5">
                                {/* Step number + icon */}
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="size-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: color }}>
                                    {i + 1}
                                  </div>
                                  <div className="size-5 rounded inline-flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                    <Icon className="size-3" style={{ color }} />
                                  </div>
                                </div>
                                {/* Name — inline editable */}
                                <EditableText
                                  value={v.name}
                                  onChange={(val) => {
                                    const next = [...valueChain];
                                    next[i] = { ...next[i], name: val };
                                    setValueChain(next);
                                    setToast(`已修改阶段 ${i + 1} 名称`);
                                  }}
                                  className="text-[11px] font-medium leading-4 mb-0.5"
                                />
                                {/* Apps — inline editable tags */}
                                <div className="flex flex-wrap gap-0.5">
                                  {v.apps.map(app => (
                                    <span key={app} className="inline-flex items-center gap-0.5 rounded border bg-muted/50 px-1 py-px text-[9px] font-mono">
                                      {app}
                                      <button
                                        onClick={() => {
                                          const next = [...valueChain];
                                          next[i] = { ...next[i], apps: next[i].apps.filter((a) => a !== app) };
                                          setValueChain(next);
                                          setToast(`已从 ${v.name} 移除：${app}`);
                                        }}
                                        className="text-muted-foreground hover:text-destructive"
                                        title="移除该应用"
                                      >
                                        <X className="size-2" />
                                      </button>
                                    </span>
                                  ))}
                                  <input
                                    placeholder="+ app"
                                    className="inline-flex w-12 rounded border border-dashed bg-transparent px-1 py-px text-[9px] font-mono text-muted-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const val = (e.currentTarget.value || "").trim();
                                        if (!val) return;
                                        const next = [...valueChain];
                                        next[i] = { ...next[i], apps: [...next[i].apps, val] };
                                        setValueChain(next);
                                        e.currentTarget.value = "";
                                        setToast(`已添加应用：${val}`);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {/* Arrow between stages */}
                            {i < valueChain.length - 1 && (
                              <ArrowRight className="size-3 text-muted-foreground shrink-0 mx-0.5" />
                            )}
                          </div>
                        );
                      })}
                      {/* Add button at the end */}
                      <button
                        onClick={handleAddVCStage}
                        className="rounded-md border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-primary/5 hover:text-primary text-muted-foreground transition-colors"
                        style={{ minWidth: 72, minHeight: 72 }}
                      >
                        <Plus className="size-3.5" />
                        <span className="text-[9px]">添加阶段</span>
                      </button>
                    </div>
                  </div>

                  {/* Supporting systems */}
                  <div className="mt-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Server className="size-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">支撑系统</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {valueChain.map((v, i) => {
                        const colors = ["#3b82f6", "#f97316", "#eab308", "#22c55e", "#8b5cf6", "#ec4899"];
                        const color = colors[i % colors.length];
                        return (
                          <div key={`sup-${v.name}-${i}`} className="flex items-center gap-1">
                            <div className="rounded border border-border/60 bg-muted/30 px-1.5 py-1">
                              <div className="text-[10px] font-medium" style={{ color }}>{v.name}</div>
                              <div className="flex gap-0.5 mt-0.5">
                                {v.apps.slice(0, 3).map(app => (
                                  <code key={app} className="text-[9px] rounded px-0.5 border border-border/60 bg-background font-mono">{app}</code>
                                ))}
                                {v.apps.length > 3 && <span className="text-[9px] text-muted-foreground">+{v.apps.length - 3}</span>}
                              </div>
                            </div>
                            {i < valueChain.length - 1 && <ArrowRight className="size-2 text-muted-foreground shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Run Mode: SVG Visualization ── */
                <div>
                  <div className="px-4 pt-2">
                    <svg viewBox="0 0 1100 170" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <marker id="vc-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                        </marker>
                      </defs>
                      {valueChain.map((v, i) => {
                        const x = 10 + i * 180;
                        const w = 150;
                        const h = 80;
                        const cy = 15;
                        const colors = ["#3b82f6", "#f97316", "#eab308", "#22c55e", "#8b5cf6", "#ec4899"];
                        const color = colors[i % colors.length];
                        return (
                          <g key={v.name}>
                            {/* Node rect — same style as dependency graph: rx=8, fillOpacity=0.15, strokeWidth=2 */}
                            <rect x={x} y={cy} width={w} height={h} rx="8" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" />
                            {/* Icon badge — 24x24 circle, #f3f1ee bg, #d6d4d0 border */}
                            <circle cx={x + 20} cy={cy + 20} r="12" fill="#f3f1ee" stroke="#d6d4d0" strokeWidth="0.8" />
                            <text x={x + 20} y={cy + 24} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">{"▸"}</text>
                            {/* Name */}
                            <text x={x + 38} y={cy + 24} fontSize="12" fontWeight="600" fill={color}>{v.name}</text>
                            {/* Description */}
                            <text x={x + w / 2} y={cy + 44} textAnchor="middle" fontSize="9" fill="#666">
                              {["市场洞察与获客", "产品设计与研发", "供应商与物料管理", "制造与质量控制", "渠道销售与运营", "售后与客户成功"][i]}
                            </text>
                            {/* Apps as code tags */}
                            {v.apps.map((app, ai) => (
                              <g key={app}>
                                <rect x={x + 10 + ai * 65} y={cy + 54} width="60" height="18" rx="4" fill="#f8f7f5" stroke="#d6d4d0" strokeWidth="0.8" />
                                <text x={x + 40 + ai * 65} y={cy + 67} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#666">{app}</text>
                              </g>
                            ))}
                            {/* Flow arrow — same style as dep graph: stroke #94a3b8, strokeWidth 1.5, dashed */}
                            {i < valueChain.length - 1 && (
                              <>
                                <line x1={x + w + 2} y1={cy + h / 2} x2={x + w + 26} y2={cy + h / 2} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#vc-arrow)" />
                              </>
                            )}
                            {/* Step label */}
                            <text x={x + w / 2} y={cy + h + 16} textAnchor="middle" fontSize="9" fontWeight="500" fill="#94a3b8">L1 · 阶段 {i + 1}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* ── Supporting Systems (table style, consistent with project tables) ── */}
                  <div className="px-4 pt-4 pb-2 border-t mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="size-3.5" style={{ color: "#94a3b8" }} />
                      <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>支撑系统</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {valueChain.map((v, i) => {
                        const colors = ["#3b82f6", "#f97316", "#eab308", "#22c55e", "#8b5cf6", "#ec4899"];
                        const color = colors[i % colors.length];
                        return (
                          <div key={v.name} className="flex items-center gap-2">
                            <div className="rounded-lg border px-3 py-2" style={{ borderColor: "#d6d4d0", background: "#f8f7f5" }}>
                              <div className="text-[10px] font-medium" style={{ color }}>{v.name}</div>
                              <div className="flex gap-1 mt-1">
                                {v.apps.map((app) => (
                                  <code key={app} className="text-[10px] rounded px-1 py-0.5 border font-mono" style={{ borderColor: "#d1d5db", background: "#fff" }}>
                                    {app}
                                  </code>
                                ))}
                              </div>
                            </div>
                            {i < valueChain.length - 1 && (
                              <ArrowRight className="size-3 shrink-0" style={{ color: "#94a3b8" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Legend (consistent with project legend style) ── */}
                  <div className="px-4 py-3 border-t flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 rounded" style={{ border: "2px solid #3b82f6", background: "rgba(59,130,246,0.15)" }} />
                      <span className="text-[10px]" style={{ color: "#666" }}>价值流阶段节点</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-px" style={{ background: "#94a3b8", borderTop: "1.5px dashed #94a3b8" }} />
                      <span className="text-[10px]" style={{ color: "#666" }}>价值流转方向</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-3 rounded" style={{ border: "0.8px solid #d6d4d0", background: "#f8f7f5" }} />
                      <span className="text-[10px]" style={{ color: "#666" }}>应用系统</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Edit Dialog ── */}
          <Dialog open={showVCEditDialog} onOpenChange={setShowVCEditDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>编辑价值流阶段</DialogTitle>
                <DialogDescription>修改阶段名称、描述和关联应用</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">阶段名称</Label>
                  <Input value={vcEditName} onChange={e => setVCEditName(e.target.value)} placeholder="如：市场获取" className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">阶段描述</Label>
                  <Input value={vcEditDesc} onChange={e => setVCEditDesc(e.target.value)} placeholder="如：市场洞察与获客" className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">关联应用（逗号分隔）</Label>
                  <Input value={vcEditApps} onChange={e => setVCEditApps(e.target.value)} placeholder="如：CRM, 营销" className="h-8 text-sm mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setShowVCEditDialog(false)}>取消</Button>
                <Button size="sm" onClick={handleSaveVCEdit}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="capability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">业务能力地图</CardTitle>
              <CardDescription>28 项业务能力，按一级分类组织。{designMode ? "设计态 - 可拖拽调整" : "运行态 - 只读查看"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {capabilityList.map((c, i) => {
                  const subCaps = [
                    ["线索管理", "商机管理", "客户画像"],
                    ["订单管理", "报价管理", "合同管理"],
                    ["工单管理", "满意度调查", "知识库"],
                    ["供应商管理", "采购申请", "比价管理"],
                    ["生产计划", "质量检测", "库存管理"],
                    ["仓储管理", "物流配送", "库存盘点"],
                    ["应收应付", "总账管理", "预算管控"],
                    ["招聘管理", "薪酬绩效", "培训发展"],
                    ["项目管理", "需求管理", "版本发布"],
                    ["来料检验", "过程质量", "不良品处理"],
                    ["合同审查", "合规审计", "风险管理"],
                    ["战略规划", "经营分析", "KPI 管理"],
                  ][i] || ["子能力 A", "子能力 B"];
                  return (
                    <div key={c} className={`rounded border p-3 ${designMode ? "hover:border-primary cursor-pointer" : ""} transition-colors`}>
                      <div className="font-medium text-sm">{c}</div>
                      <div className="mt-2 space-y-1">
                        {subCaps.map((sub) => (
                          <div key={sub} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <div className="size-1.5 rounded-full bg-primary/40" />
                            {sub}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        {subCaps.length} 项子能力
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.4 L4 业务角色 */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L4 业务角色矩阵</CardTitle>
              <CardDescription>执行业务流程的角色定义及其能力映射</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">角色</th>
                    <th className="px-4 py-2 font-medium">所属部门</th>
                    <th className="px-4 py-2 font-medium">核心能力</th>
                    <th className="px-4 py-2 font-medium text-center">关联流程</th>
                    <th className="px-4 py-2 font-medium text-center">关联应用</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <User className="size-4 text-primary" /> {r.role}
                      </td>
                      <td className="px-4 py-3">{r.dept}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.caps.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{r.flows}</td>
                      <td className="px-4 py-3 text-center">{r.apps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.5 L5 业务事件 */}
        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L5 业务事件目录</CardTitle>
              <CardDescription>业务事件定义、触发条件和处理链</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">事件名称</th>
                    <th className="px-4 py-2 font-medium">触发条件</th>
                    <th className="px-4 py-2 font-medium">事件类型</th>
                    <th className="px-4 py-2 font-medium">处理流程</th>
                    <th className="px-4 py-2 font-medium text-center">频率/天</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.trigger}</td>
                      <td className="px-4 py-3">
                        <Badge variant={e.type === "异常事件" ? "destructive" : e.type === "系统事件" ? "default" : "secondary"}>
                          {e.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{e.process}</td>
                      <td className="px-4 py-3 text-center">{e.freq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.6 L6 业务对象 */}
        <TabsContent value="objects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L6 业务对象总览</CardTitle>
              <CardDescription>业务层面的核心对象及其所属域</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {objects.map((obj, i) => (
                  <div key={i} className="rounded-lg border p-4 hover:border-primary cursor-pointer transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <obj.icon className="size-5 text-primary" />
                        <span className="font-medium">{obj.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{obj.domain}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>{obj.fields} 字段</div>
                      <div>{obj.relations} 关系</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* F3.1.7 导入 Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" /> 导入业务架构
            </DialogTitle>
            <DialogDescription>上传 JSON 文件导入业务架构定义</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">点击或拖拽文件到此处</p>
              <p className="text-xs text-muted-foreground mt-1">支持 .json / .csv 格式</p>
              <Input type="file" accept=".json,.csv" className="mt-3 max-w-xs mx-auto" />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">导入说明</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>JSON 格式需包含 layers 数组</li>
                <li>CSV 需包含列：层级, 名称, 描述, 数量</li>
                <li>导入将覆盖现有数据</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>取消</Button>
            <Button onClick={() => { setShowImportDialog(false); setToast("导入成功（Mock）"); }}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Layer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增层级</DialogTitle>
            <DialogDescription>在业务架构分层模型中新增一个层级</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="layer-name">层级名称 *</Label>
              <Input
                id="layer-name"
                placeholder="例如：业务规则"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="layer-desc">描述</Label>
              <Input
                id="layer-desc"
                placeholder="例如：业务规则与约束"
                value={newLayerDesc}
                onChange={(e) => setNewLayerDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleAddLayer} disabled={!newLayerName.trim()}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLayer && <selectedLayer.icon className="size-5" />}
              {selectedLayer?.level} - {selectedLayer?.name}
            </DialogTitle>
            <DialogDescription>{selectedLayer?.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">包含项目数</div>
                  <div className="text-xl font-bold mt-1">{selectedLayer?.count}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">层级编号</div>
                  <div className="text-xl font-bold mt-1">{selectedLayer?.level}</div>
                </CardContent>
              </Card>
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">说明</p>
              <p className="text-muted-foreground">{selectedLayer?.desc}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ ApplicationArchitecture ═══════════════════════ */
export function ApplicationArchitecture() {
  const [appDeps, setAppDeps] = useState(APP_DEPENDENCIES_FALLBACK);
  const [appMatrix, setAppMatrix] = useState(APP_FLOW_MATRIX_FALLBACK);
  const [bizAppMatrix, setBizAppMatrix] = useState(BIZ_APP_MATRIX_FALLBACK);
  const [appDataMatrix, setAppDataMatrix] = useState(APP_DATA_MATRIX_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<(typeof APP_FLOW_MATRIX_FALLBACK)[number] | null>(null);
  const { toast, setToast } = useToast();

  /* Fetch data from API on mount */
  useEffect(() => {
    architectureApi.getSection("aa").then((sectionData) => {
      if (sectionData?.dependencies) setAppDeps(sectionData.dependencies as typeof APP_DEPENDENCIES_FALLBACK);
      if (sectionData?.matrix) setAppMatrix(sectionData.matrix as typeof APP_FLOW_MATRIX_FALLBACK);
      if (sectionData?.biz_app_matrix) setBizAppMatrix(sectionData.biz_app_matrix as typeof BIZ_APP_MATRIX_FALLBACK);
      if (sectionData?.app_data_matrix) setAppDataMatrix(sectionData.app_data_matrix as typeof APP_DATA_MATRIX_FALLBACK);
    }).catch(() => { /* use fallback */ }).finally(() => setLoading(false));
  }, []);

  const filteredDeps = filterType
    ? appDeps.filter((d) => d.type === filterType)
    : appDeps;

  const depTypes = [...new Set(appDeps.map((d) => d.type))];

  function handleExport() {
    const data = { dependencies: appDeps, matrix: appMatrix };
    downloadJSON(data, "application-architecture.json");
    setToast("导出成功：application-architecture.json");
  }

  function handleExportCSV() {
    const headers = ["调用方", "被调用方", "调用次数", "类型"];
    const rows = appDeps.map((d) => [d.from, d.to, d.calls, d.type]);
    downloadCSV(headers, rows, "application-dependencies.csv");
    setToast("导出成功：application-dependencies.csv");
  }

  function handleAppClick(app: (typeof APP_FLOW_MATRIX_FALLBACK)[number]) {
    setSelectedApp(app);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> 加载中...
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Server className="size-5 text-primary" /> 应用架构
          </h1>
          <p className="text-sm text-muted-foreground">应用全景 + 依赖关系 + 跨应用映射</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="size-3 mr-1" />筛选
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      {showFilter && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">按调用类型筛选：</span>
              <Button variant={filterType === "" ? "default" : "outline"} size="sm" onClick={() => setFilterType("")}>全部</Button>
              {depTypes.map((t) => (
                <Button key={t} variant={filterType === t ? "default" : "outline"} size="sm" onClick={() => setFilterType(t)}>{t}</Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setShowFilter(false); }}>
                <X className="size-3 mr-1" /> 关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { name: "应用总数", count: 6, icon: Smartphone, desc: "全部应用" },
          { name: "依赖关系", count: 18, icon: Link, desc: "调用次数 5,022/月" },
          { name: "流程映射", count: 32, icon: RefreshCw, desc: "应用-流程映射" },
          { name: "数据映射", count: 56, icon: BarChart3, desc: "应用-对象映射" },
        ].map((c) => (
          <Card key={c.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                  <div className="text-xl font-bold mt-1">{c.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
                </div>
                <c.icon className="size-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="deps">
        <TabsList>
          <TabsTrigger value="deps">应用依赖</TabsTrigger>
          <TabsTrigger value="matrix">应用矩阵</TabsTrigger>
          <TabsTrigger value="graph">依赖关系图</TabsTrigger>
          <TabsTrigger value="biz-app">业务-应用联动</TabsTrigger>
          <TabsTrigger value="app-data">应用-数据联动</TabsTrigger>
        </TabsList>
        <TabsContent value="deps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用调用依赖</CardTitle>
              <CardDescription>应用间 API/数据 调用统计</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">调用方</th>
                    <th className="px-4 py-2 font-medium">被调用方</th>
                    <th className="px-4 py-2 font-medium">调用次数</th>
                    <th className="px-4 py-2 font-medium">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeps.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{d.from}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="size-3 text-muted-foreground" />
                          {d.to}
                        </div>
                      </td>
                      <td className="px-4 py-3">{d.calls.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{d.type}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDeps.length === 0 && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">无匹配的依赖关系</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用 x 流程 x 数据 矩阵</CardTitle>
              <CardDescription>每个应用的能力映射，点击行查看详情</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">应用</th>
                    <th className="px-4 py-2 font-medium text-center"><Workflow className="size-3 inline mr-1" />流程</th>
                    <th className="px-4 py-2 font-medium text-center"><Box className="size-3 inline mr-1" />对象</th>
                    <th className="px-4 py-2 font-medium text-center"><FileText className="size-3 inline mr-1" />页面</th>
                    <th className="px-4 py-2 font-medium text-right">复杂度</th>
                  </tr>
                </thead>
                <tbody>
                  {appMatrix.map((m, i) => {
                    const complexity = m.flows * 2 + m.data * 3 + m.pages;
                    return (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleAppClick(m)}
                      >
                        <td className="px-4 py-3 font-medium">{m.app}</td>
                        <td className="px-4 py-3 text-center">{m.flows}</td>
                        <td className="px-4 py-3 text-center">{m.data}</td>
                        <td className="px-4 py-3 text-center">{m.pages}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant={complexity > 30 ? "destructive" : complexity > 15 ? "default" : "secondary"}>
                            {complexity > 30 ? "高" : complexity > 15 ? "中" : "低"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用依赖关系图</CardTitle>
              <CardDescription>应用间调用关系的力导向图可视化</CardDescription>
            </CardHeader>
            <CardContent>
              {/* F3.2.2 SVG 依赖关系图 */}
              <svg viewBox="0 0 700 400" className="w-full h-auto bg-muted/20 rounded-lg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="dep-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
                {/* Nodes - positioned in a circular layout */}
                {[
                  { name: "CRM", x: 350, y: 60, color: "#3b82f6" },
                  { name: "数据中台", x: 150, y: 200, color: "#22c55e" },
                  { name: "报销审批", x: 550, y: 200, color: "#f97316" },
                  { name: "销售看板", x: 250, y: 340, color: "#8b5cf6" },
                  { name: "智能体助手", x: 450, y: 340, color: "#ec4899" },
                  { name: "采购流程", x: 100, y: 100, color: "#eab308" },
                  { name: "ERP", x: 600, y: 100, color: "#14b8a6" },
                ].map((node) => (
                  <g key={node.name}>
                    <rect x={node.x - 50} y={node.y - 20} width="100" height="40" rx="8" fill={node.color} fillOpacity="0.15" stroke={node.color} strokeWidth="2" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="12" fontWeight="600" fill={node.color}>{node.name}</text>
                  </g>
                ))}
                {/* Dependency arrows */}
                {appDeps.map((dep, i) => {
                  const nodeMap: Record<string, { x: number; y: number }> = {
                    "客户管理 CRM": { x: 350, y: 60 },
                    "数据中台": { x: 150, y: 200 },
                    "报销审批": { x: 550, y: 200 },
                    "销售看板": { x: 250, y: 340 },
                    "智能体助手": { x: 450, y: 340 },
                    "采购流程": { x: 100, y: 100 },
                    "ERP": { x: 600, y: 100 },
                    "财务系统": { x: 550, y: 200 },
                  };
                  const from = nodeMap[dep.from] || { x: 350, y: 200 };
                  const to = nodeMap[dep.to] || { x: 350, y: 200 };
                  return (
                    <g key={i}>
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#dep-arrow)" />
                      <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fontSize="9" fill="#666">{dep.calls}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-6 h-0.5 bg-gray-400" style={{ borderTop: "1.5px dashed #94a3b8" }} /> 调用依赖</div>
                <div>节点 = 应用系统</div>
                <div>数字 = 月调用次数</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.5.1 业务-应用联动 */}
        <TabsContent value="biz-app" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">业务-应用联动矩阵</CardTitle>
              <CardDescription>业务流程与应用系统的映射关系</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">业务流程</th>
                    <th className="px-4 py-2 font-medium text-center">CRM</th>
                    <th className="px-4 py-2 font-medium text-center">ERP</th>
                    <th className="px-4 py-2 font-medium text-center">HR</th>
                    <th className="px-4 py-2 font-medium text-center">BI</th>
                    <th className="px-4 py-2 font-medium text-center">OA</th>
                    <th className="px-4 py-2 font-medium text-center">BPM</th>
                  </tr>
                </thead>
                <tbody>
                  {bizAppMatrix.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.process}</td>
                      {([row.crm, row.erp, row.hr, row.bi, row.oa, row.bpm]).map((v, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          <div className={`size-4 rounded mx-auto ${v ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.5.2 应用-数据联动 */}
        <TabsContent value="app-data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用-数据联动矩阵</CardTitle>
              <CardDescription>应用系统与数据源的映射关系</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">应用系统</th>
                    <th className="px-4 py-2 font-medium text-center">客户域</th>
                    <th className="px-4 py-2 font-medium text-center">订单域</th>
                    <th className="px-4 py-2 font-medium text-center">产品域</th>
                    <th className="px-4 py-2 font-medium text-center">财务域</th>
                    <th className="px-4 py-2 font-medium text-center">人事域</th>
                    <th className="px-4 py-2 font-medium text-center">运营域</th>
                  </tr>
                </thead>
                <tbody>
                  {appDataMatrix.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.app}</td>
                      {row.domains.map((v, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          <div className={`size-4 rounded mx-auto ${v ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* App Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5" />
              {selectedApp?.app}
            </DialogTitle>
            <DialogDescription>应用资产详情</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Workflow className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.flows}</div>
                <div className="text-xs text-muted-foreground">流程</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Box className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.data}</div>
                <div className="text-xs text-muted-foreground">对象</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.pages}</div>
                <div className="text-xs text-muted-foreground">页面</div>
              </CardContent>
            </Card>
          </div>
          {selectedApp && (
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium">复杂度评估</p>
              <p className="text-muted-foreground mt-1">
                综合得分: {(selectedApp.flows * 2 + selectedApp.data * 3 + selectedApp.pages)} 分
                (流程 x2 + 对象 x3 + 页面 x1)
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ DataArchitecture ═══════════════════════ */
interface DataDomainItem {
  name: string;
  objects: number;
  apps: string[];
  icon: React.ElementType;
  color: string;
}

export function DataArchitecture() {
  const [dataDomains, setDataDomains] = useState<DataDomainItem[]>(DATA_DOMAINS_FALLBACK);
  const [lakeWarehouse, setLakeWarehouse] = useState(LAKE_WAREHOUSE_FALLBACK);
  const [dataDistribution, setDataDistribution] = useState(DATA_DISTRIBUTION_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DataDomainItem | null>(null);
  const { toast, setToast } = useToast();

  /* Fetch data from API on mount */
  useEffect(() => {
    architectureApi.getSection("da").then((sectionData) => {
      if (sectionData?.domains) {
        const apiDomains: DataDomainItem[] = (sectionData.domains as Record<string, unknown>[]).map((d) => {
          const name = d.name as string;
          const meta = DATA_DOMAIN_ICON_MAP[name] || { icon: Database, color: "bg-gray-500" };
          return { ...d, icon: meta.icon, color: meta.color } as unknown as DataDomainItem;
        });
        setDataDomains(apiDomains);
      }
      if (sectionData?.lake_warehouse) setLakeWarehouse(sectionData.lake_warehouse as typeof LAKE_WAREHOUSE_FALLBACK);
      if (sectionData?.data_distribution) setDataDistribution(sectionData.data_distribution as typeof DATA_DISTRIBUTION_FALLBACK);
    }).catch(() => { /* use fallback */ }).finally(() => setLoading(false));
  }, []);

  function handleExport() {
    downloadJSON(dataDomains.map(({ icon: _i, color: _c, ...rest }) => rest), "data-architecture-domains.json");
    setToast("导出成功：data-architecture-domains.json");
  }

  function handleExportCSV() {
    const headers = ["域", "对象数", "关联应用"];
    const rows = dataDomains.map((d) => [d.name, d.objects, d.apps.join("/")]);
    downloadCSV(headers, rows, "data-architecture-domains.csv");
    setToast("导出成功：data-architecture-domains.csv");
  }

  function handleDomainClick(domain: DataDomainItem) {
    setSelectedDomain(domain);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> 加载中...
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Database className="size-5 text-primary" /> 数据架构
          </h1>
          <p className="text-sm text-muted-foreground">数据主题域 + 数据模型 + 湖仓分布</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {dataDomains.map((d) => (
          <Card key={d.name} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleDomainClick(d)}>
            <CardContent className="p-4 text-center">
              <div className={`size-12 rounded-full ${d.color} text-white flex items-center justify-center mx-auto`}>
                <d.icon className="size-6" />
              </div>
              <div className="font-medium text-sm mt-2">{d.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.objects} 对象</div>
              <div className="text-xs text-primary mt-1">{d.apps.join(" · ")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">湖仓分布</CardTitle>
          <CardDescription>ODS / DWD / DWS / ADS 四层数据流转</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {lakeWarehouse.map((l) => (
              <div key={l.layer} className={`rounded border-l-4 ${l.color} border-y border-r p-3 cursor-pointer hover:border-primary transition-colors`}>
                <div className="text-xs text-muted-foreground">{l.layer}</div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xl font-bold mt-2">{l.count}</div>
                <div className="text-xs text-muted-foreground mt-1">{l.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* F3.3.4 数据分布（湖仓） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据分布总览</CardTitle>
          <CardDescription>数据在湖仓 / 实时 / 离线三层的分布情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 数据湖 */}
            <div className="rounded-lg border-2 border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="size-5 text-blue-500" />
                <span className="font-medium">数据湖 (Data Lake)</span>
              </div>
              <div className="space-y-2">
                {dataDistribution.dataLake.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-blue-50/50 dark:bg-blue-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} 表</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 224 张表</span>
                <span className="font-mono font-bold">4.84 TB</span>
              </div>
            </div>
            {/* 数仓 */}
            <div className="rounded-lg border-2 border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Box className="size-5 text-green-500" />
                <span className="font-medium">数仓 (Warehouse)</span>
              </div>
              <div className="space-y-2">
                {dataDistribution.dataWarehouse.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-green-50/50 dark:bg-green-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} 表</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 92 张表</span>
                <span className="font-mono font-bold">2.86 TB</span>
              </div>
            </div>
            {/* 实时 */}
            <div className="rounded-lg border-2 border-orange-200 dark:border-orange-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="size-5 text-orange-500" />
                <span className="font-medium">实时层 (Realtime)</span>
              </div>
              <div className="space-y-2">
                {dataDistribution.realtime.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-orange-50/50 dark:bg-orange-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} Topic</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 30 个实例</span>
                <span className="font-mono font-bold">416 GB</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedDomain && <selectedDomain.icon className="size-5" />}
              {selectedDomain?.name}
            </DialogTitle>
            <DialogDescription>数据域详情</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">数据对象数</div>
                  <div className="text-xl font-bold mt-1">{selectedDomain?.objects}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">关联应用数</div>
                  <div className="text-xl font-bold mt-1">{selectedDomain?.apps.length}</div>
                </CardContent>
              </Card>
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">关联应用</p>
              <div className="flex gap-2 flex-wrap">
                {selectedDomain?.apps.map((app) => (
                  <Badge key={app} variant="secondary">{app}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ TechArchitecture ═══════════════════════ */
export function TechArchitecture() {
  const [techStack, setTechStack] = useState(TECH_STACK_FALLBACK);
  const [deployTopology, setDeployTopology] = useState<Topology>(DEPLOY_TOPOLOGY_FALLBACK);
  const [svcDeps, setSvcDeps] = useState<Topology>(SVC_DEPS_FALLBACK);
  const [observability, setObservability] = useState(OBSERVABILITY_FALLBACK);
  const [techSelection, setTechSelection] = useState(TECH_SELECTION_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedStack, setSelectedStack] = useState<(typeof TECH_STACK_FALLBACK)[number] | null>(null);
  const [designMode, setDesignMode] = useState(true);
  /* Canvas editor dialogs */
  const [canvasOpen, setCanvasOpen] = useState<"deploy" | "deps" | null>(null);
  const { toast, setToast } = useToast();

  /* Fetch data from API on mount */
  useEffect(() => {
    architectureApi.getSection("ta").then((sectionData: any) => {
      if (sectionData?.techStack) setTechStack(sectionData.techStack as typeof TECH_STACK_FALLBACK);
      // ta.deploy  legacy: list of {label,value}; new shape: Topology {nodes,edges}
      if (sectionData?.deploy) {
        const d = sectionData.deploy;
        if (Array.isArray(d?.nodes) && Array.isArray(d?.edges)) {
          setDeployTopology(d as Topology);
        }
        // legacy list-shape silently falls back to Topology default
      }
      if (sectionData?.svcDeps) setSvcDeps(sectionData.svcDeps as Topology);
      if (sectionData?.observability) setObservability(sectionData.observability as typeof OBSERVABILITY_FALLBACK);
      if (sectionData?.tech_selection) setTechSelection(sectionData.tech_selection as typeof TECH_SELECTION_FALLBACK);
    }).catch(() => { /* use fallback */ }).finally(() => setLoading(false));
  }, []);

  function handleExport() {
    const data = { techStack, deploy: deployTopology, observability };
    downloadJSON(data, "tech-architecture.json");
    setToast("导出成功：tech-architecture.json");
  }

  function handleExportCSV() {
    const headers = ["层级", "技术"];
    const rows: (string | number)[][] = [];
    techStack.forEach((s) => s.items.forEach((t) => rows.push([s.layer, t])));
    downloadCSV(headers, rows, "tech-architecture.csv");
    setToast("导出成功：tech-architecture.csv");
  }

  function handleStackClick(stack: (typeof TECH_STACK_FALLBACK)[number]) {
    setSelectedStack(stack);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> 加载中...
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Cpu className="size-5 text-primary" /> 技术架构
          </h1>
          <p className="text-sm text-muted-foreground">技术栈 + 部署拓扑 + 服务依赖</p>
        </div>
        <div className="flex gap-2">
          {/* F3.5.4 设计态/运行态切换 */}
          <Button variant={designMode ? "default" : "outline"} size="sm" onClick={() => setDesignMode(!designMode)}>
            {designMode ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
            {designMode ? "设计态" : "运行态"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">技术栈总览</CardTitle>
          <CardDescription className="text-xs">
            {designMode
              ? "设计态：拖拽技术 chip 调整顺序 / 点击 × 删除 / 输入回车新增。点击技术查看详情。"
              : "运行态：点击层级或技术查看详情。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Compaction note: was p-3 + gap-2 + text-xs chip + mb-2 between
              header and chip row. Halved to py-2 + gap-1.5 + text-[11px]
              so all six layers fit on one screen on a 13" laptop. */}
          <div className="space-y-2">
            {techStack.map((s) => (
              <div
                key={s.layer}
                className="rounded-md border px-2 py-2 hover:border-primary/40 transition-colors"
                onClick={() => !designMode && handleStackClick(s)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.layer}</Badge>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{s.items.length} 项</span>
                  {designMode && (
                    <span className="ml-auto text-[10px] text-muted-foreground/70">设计态可编辑</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.items.map((t, ti) => (
                    <span
                      key={t}
                      draggable={designMode}
                      onDragStart={(e) => {
                        if (!designMode) return;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("application/x-tech-chip", JSON.stringify({ layer: s.layer, idx: ti }));
                      }}
                      onDragOver={(e) => { if (designMode) e.preventDefault(); }}
                      onDrop={(e) => {
                        if (!designMode) return;
                        e.preventDefault();
                        const raw = e.dataTransfer.getData("application/x-tech-chip");
                        if (!raw) return;
                        const data = JSON.parse(raw);
                        if (data.layer !== s.layer) return; // single-layer reorder only
                        const items = [...s.items];
                        const [moved] = items.splice(data.idx, 1);
                        items.splice(ti, 0, moved);
                        const updated = techStack.map((row) => row.layer === s.layer ? { ...row, items } : row);
                        setTechStack(updated);
                        architectureApi.updateSection("ta", { techStack: updated }).catch(() => {});
                        setToast(`已调整 ${s.layer} 内的顺序`);
                      }}
                      className={`group inline-flex items-center gap-1 rounded border bg-muted/50 px-1.5 py-0.5 text-[11px] font-mono ${designMode ? "cursor-grab active:cursor-grabbing hover:border-primary/40" : "cursor-pointer hover:border-primary/40"}`}
                      onClick={(e) => { e.stopPropagation(); if (!designMode) handleStackClick(s); }}
                    >
                      {t}
                      {designMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = techStack
                              .map((row) => row.layer === s.layer ? { ...row, items: row.items.filter((_, i) => i !== ti) } : row);
                            setTechStack(updated);
                            architectureApi.updateSection("ta", { techStack: updated }).catch(() => {});
                            setToast(`已从 ${s.layer} 删除：${t}`);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          title="删除该技术"
                        >
                          <X className="size-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {designMode && (
                    <input
                      placeholder="+ 新增技术"
                      className="inline-flex items-center rounded border border-dashed bg-transparent px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.currentTarget.value || "").trim();
                          if (!v) return;
                          const updated = techStack.map((row) =>
                            row.layer === s.layer ? { ...row, items: [...row.items, v] } : row);
                          setTechStack(updated);
                          architectureApi.updateSection("ta", { techStack: updated }).catch(() => {});
                          setToast(`已新增到 ${s.layer}：${v}`);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* F3.4.2 部署拓扑图 */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-slate-900" aria-hidden />
              <CardTitle className="text-base">部署拓扑图</CardTitle>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {deployTopology.nodes.length} 节点 · {deployTopology.edges.length} 连线
              </span>
              {designMode && (
                <Button size="sm" variant="outline" className="h-7" onClick={() => setCanvasOpen("deploy")}>
                  <Edit className="size-3 mr-1" />进入画布
                </Button>
              )}
            </div>
            <CardDescription className="pl-4 text-xs">
              服务器 / 容器 / 区域部署架构（L3-5 部署层）
              {designMode ? " · 设计态可点击「进入画布」编辑。" : " · 运行态只读。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Read-only preview rendered from ta.deployTopology. The full
                editable canvas lives behind the dialog opened by the
                "进入画布" button above (design mode only). */}
            <TopologyPreview topology={deployTopology} ariaLabel="部署拓扑图" />

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              <LegendChip color="slate"  label="L3-3 平台底座" />
              <LegendChip color="blue"   label="L1 用户面" />
              <LegendChip color="violet" label="L3-1 AI Substrate" />
              <LegendChip color="zinc"   label="L3-4 基础设施" />
            </div>
          </CardContent>
        </Card>

        {/* F3.4.3 服务依赖图 */}
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500" aria-hidden />
              <CardTitle className="text-base">服务依赖图</CardTitle>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {svcDeps.nodes.length} 服务 · {svcDeps.edges.length} 依赖
              </span>
              {designMode && (
                <Button size="sm" variant="outline" className="h-7" onClick={() => setCanvasOpen("deps")}>
                  <Edit className="size-3 mr-1" />进入画布
                </Button>
              )}
            </div>
            <CardDescription className="pl-4 text-xs">
              微服务间通信关系（L1 用户面 + L3 底座）
              {designMode ? " · 设计态可点击「进入画布」编辑。" : " · 运行态只读。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TopologyPreview topology={svcDeps} ariaLabel="服务依赖图" />

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              <LegendChip color="blue"   label="L1 业务微服务" />
              <LegendChip color="slate"  label="L3-3 平台底座" />
              <LegendChip color="violet" label="L3-1 AI Substrate" />
              <LegendChip color="zinc"   label="L3-4 基础设施" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* F3.4.4 技术选型矩阵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">技术选型对比矩阵</CardTitle>
          <CardDescription>各技术层候选方案对比评估</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">技术层</th>
                <th className="px-4 py-2 font-medium">候选方案 A</th>
                <th className="px-4 py-2 font-medium">候选方案 B</th>
                <th className="px-4 py-2 font-medium">选定方案</th>
                <th className="px-4 py-2 font-medium text-center">评分</th>
              </tr>
            </thead>
            <tbody>
              {techSelection.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{row.layer}</td>
                  <td className="px-4 py-3">{row.a}</td>
                  <td className="px-4 py-3">{row.b}</td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{row.chosen}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={row.score >= 90 ? "default" : row.score >= 85 ? "secondary" : "outline"}>
                      {row.score}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部署拓扑</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {deployTopology.map((item) => (
                <div key={item.label} className="flex justify-between p-2 border rounded">
                  <span>{item.label}</span><span className="font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">可观测性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {observability.map((item) => (
                <div key={item.label} className="flex justify-between p-2 border rounded">
                  <span>{item.label}</span><span className="font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topology Canvas Dialog (design mode only) — full-bleed editor
          for the deployment / service-dependency diagrams. The dialog
          stores its own working copy so closing without saving does
          not mutate the parent's state. */}
      <Dialog open={canvasOpen !== null} onOpenChange={(o) => !o && setCanvasOpen(null)}>
        <DialogContent className="max-w-[min(1400px,95vw)] w-[95vw] h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-4 pt-3 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              {canvasOpen === "deploy" ? <Network className="size-4" /> : <GitBranch className="size-4" />}
              {canvasOpen === "deploy" ? "部署拓扑 — 画布编辑器" : "服务依赖 — 画布编辑器"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              拖拽节点调整位置 · 点击节点选中可改名称 / 尺寸 / 颜色 · 点「连线」+ 选源 / 目标 · Delete 删除所选 · 点击「保存」持久化
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-3">
            {canvasOpen === "deploy" && (
              <TopologyCanvas
                topology={deployTopology}
                onChange={setDeployTopology}
                onPersist={async (t) => {
                  setDeployTopology(t);
                  await architectureApi.updateSection("ta", { deploy: t });
                  setToast("部署拓扑已保存");
                }}
                title="部署拓扑"
              />
            )}
            {canvasOpen === "deps" && (
              <TopologyCanvas
                topology={svcDeps}
                onChange={setSvcDeps}
                onPersist={async (t) => {
                  setSvcDeps(t);
                  await architectureApi.updateSection("ta", { svcDeps: t });
                  setToast("服务依赖已保存");
                }}
                title="服务依赖"
                allowContainers={false}
              />
            )}
          </div>
          <DialogFooter className="px-4 py-2 border-t">
            <Button variant="outline" onClick={() => setCanvasOpen(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tech Stack Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="size-5" />
              {selectedStack?.layer} 层技术栈
            </DialogTitle>
            <DialogDescription>包含 {selectedStack?.items.length} 项技术选型</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedStack?.items.map((item) => (
              <div key={item} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium text-sm">{item}</span>
                <Badge variant="outline">{selectedStack.layer}</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
