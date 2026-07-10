/**
 * RelationshipDiagram — 规范化对象关系图
 * ============================================================================
 * 设计语言参考 Linear / Figma / MongoDB Atlas / React Flow 官方 ER 示例.
 *
 * - 节点: 数据模型风卡片 (类型色块 / 状态点 / 字段列表 / 页脚统计)
 * - 边: ER/crow's-foot 风格 (1:1 双箭头 / 1:N 单箭头 / N:M 双线无端点)
 * - 背景: 浅灰底 + 圆点背景
 * - 控件: 圆角风格, 与站点主题匹配
 * - 布局: 拓扑层 BFS 网格 + 每层垂直居中
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  MiniMap,
  Handle, Position, useReactFlow,
  Controls,
  type Node, type Edge, type NodeProps, type ConnectionMode,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ontologyApi, type OntologyObject, type OntologyRelation, type OntologyProperty } from "@/lib/api";
import {
  Loader2, Link2, AlertCircle, Maximize2, RefreshCw, Database,
  Settings2, FileCode2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ────────────────────────────────────────────────────────────────
   ObjectNode — 业务对象数据模型卡 (Linear / DB 风格)
   ──────────────────────────────────────────────────────────────── */
interface ObjectNodeData extends Record<string, unknown> {
  label: string;
  name: string;
  fieldsCount: number;
  relationsCount: number;
  idShort: string;
  status: string;
  properties: Array<{ id: string; name: string; label: string; type: string; required?: boolean }>;
  onOpenDetail?: () => void;
}

/** 类型 → 浅色 chip 配色 */
const TYPE_COLOR: Record<string, string> = {
  text:       "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  multiline:  "bg-stone-500/15 text-stone-700 dark:text-stone-300",
  number:     "bg-primary/15 text-amber-700 dark:text-amber-300",
  currency:   "bg-primary/15 text-yellow-700 dark:text-yellow-300",
  date:       "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  datetime:   "bg-primary/15 text-indigo-700 dark:text-indigo-300",
  boolean:    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  select:     "bg-primary/15 text-rose-700 dark:text-rose-300",
  multiselect:"bg-primary/15 text-pink-700 dark:text-pink-300",
  reference:  "bg-primary/15 text-violet-700 dark:text-violet-300",
  phone:      "bg-primary/15 text-cyan-700 dark:text-cyan-300",
  email:      "bg-primary/15 text-sky-700 dark:text-sky-300",
  url:        "bg-primary/15 text-teal-700 dark:text-teal-300",
  file:       "bg-primary/15 text-fuchsia-700 dark:text-fuchsia-300",
  json:       "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

function propTypeChip(type?: string) {
  const t = (type ?? "text").toLowerCase();
  return TYPE_COLOR[t] ?? TYPE_COLOR.text;
}

function ObjectNode({ data, selected }: NodeProps) {
  const d = data as ObjectNodeData;
  const isActive = d.status === "active";
  const isDraft = !isActive;
  return (
    <div
      className={`relative bg-card text-card-foreground rounded-lg shadow-sm transition-all
                  ring-1 ring-border
                  ${selected ? "ring-2 ring-primary shadow-lg shadow-primary/10 -translate-y-px" : "hover:ring-primary/40 hover:shadow-md"}`}
      style={{ width: 260 }}
    >
      {/* 左缘状态条 (status dot + slim bar) */}
      <div className="flex">
        <div
          className={`w-1 rounded-l-lg shrink-0 ${isActive ? "bg-emerald-500" : isDraft ? "bg-primary" : "bg-muted-foreground/30"}`}
        />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <Handle
              type="target" position={Position.Left}
              className="!bg-primary !border-card !w-3 !h-3 !-ml-1.5"
            />
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-primary/15" : "bg-muted"}`}>
              <Database className={`size-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm truncate" title={d.label}>{d.label || d.name}</h3>
                {isDraft && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/15 text-amber-700 dark:text-amber-300">
                    DRAFT
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-muted-foreground truncate mt-0.5" title={d.name}>
                {d.name}
                <span className="text-muted-foreground/50"> · #{d.idShort}</span>
              </div>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
          </div>

          {/* Section: Fields */}
          <div className="border-t border-border/60">
            <div className="px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider">
              <span>字段 ({d.properties.length}{d.fieldsCount > d.properties.length ? `/${d.fieldsCount}` : ""})</span>
              {d.fieldsCount > d.properties.length && (
                <span className="text-xs lowercase tracking-normal text-primary/70">+{d.fieldsCount - d.properties.length}</span>
              )}
            </div>
            <ul className="px-3 pb-2 space-y-0.5 max-h-[120px] overflow-hidden">
              {d.properties.length === 0 && (
                <li className="text-xs text-muted-foreground/70 italic py-2">无字段</li>
              )}
              {d.properties.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    {p.required && <span className="text-rose-500 font-bold shrink-0" title="必填">*</span>}
                    <span className="truncate" title={p.label || p.name}>{p.label || p.name}</span>
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${propTypeChip(p.type)}`}>
                    {p.type || "text"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 bg-muted/30 px-3 py-2 flex items-center justify-between gap-2 text-xs rounded-b-lg">
            <span className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileCode2 className="size-3" />
                <span className="font-semibold text-foreground">{d.fieldsCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <Settings2 className="size-3" />
                <span className="font-semibold text-foreground">{d.relationsCount}</span>
              </span>
            </span>
            {d.onOpenDetail && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); d.onOpenDetail?.(); }}
                className="text-primary hover:underline flex items-center gap-0.5"
              >
                查看 <ChevronRight className="size-3" />
              </button>
            )}
          </div>
        </div>
        <Handle
          type="source" position={Position.Right}
          className="!bg-primary !border-card !w-3 !h-3 !-mr-1.5"
        />
      </div>
    </div>
  );
}

const nodeTypes = { object: ObjectNode };
const connectionMode: ConnectionMode = "loose";

/* ────────────────────────────────────────────────────────────────
   自动布局 (拓扑层 BFS)
   ──────────────────────────────────────────────────────────────── */
const NODE_W = 260;
const ROW_GAP = 32;
const COL_GAP = 64;
const PADDING_X = 40;
const PADDING_Y = 40;
const ESTIMATED_NODE_H = 220;

function calcLayout(objects: OntologyObject[], relations: OntologyRelation[]) {
  const adj = new Map<string, Set<string>>();
  objects.forEach(o => adj.set(o.id, new Set()));
  relations.forEach(r => {
    if (adj.has(r.source_object_id)) adj.get(r.source_object_id)!.add(r.target_object_id);
  });

  const indeg = new Map<string, number>();
  objects.forEach(o => indeg.set(o.id, 0));
  relations.forEach(r => {
    if (indeg.has(r.target_object_id))
      indeg.set(r.target_object_id, (indeg.get(r.target_object_id) ?? 0) + 1);
  });

  const layers: string[][] = [];
  const remain = new Set(objects.map(o => o.id));
  let frontier = objects.filter(o => (indeg.get(o.id) ?? 0) === 0).map(o => o.id);
  if (frontier.length === 0 && remain.size > 0) frontier = [objects[0].id];

  while (remain.size > 0) {
    if (frontier.length === 0) {
      layers.push(Array.from(remain));
      remain.clear();
      break;
    }
    layers.push(frontier);
    frontier.forEach(id => remain.delete(id));
    const next = new Set<string>();
    frontier.forEach(id => (adj.get(id) ?? new Set()).forEach(n => { if (remain.has(n)) next.add(n); }));
    frontier = Array.from(next);
  }

  type Positioned = { id: string; x: number; y: number };
  const positioned: Positioned[] = [];
  layers.forEach((layerIds, ci) => {
    layerIds.forEach((id, ri) => {
      positioned.push({
        id,
        x: PADDING_X + ci * (NODE_W + COL_GAP),
        y: PADDING_Y + ri * (ESTIMATED_NODE_H + ROW_GAP),
      });
    });
  });
  return positioned;
}

/* ────────────────────────────────────────────────────────────────
   边 cardinality 推断
   ──────────────────────────────────────────────────────────────── */
function inferCardinality(r: OntologyRelation): "one_one" | "one_many" | "many_many" {
  const t = ((r as any).type ?? (r as any).relation_type ?? "").toString().toLowerCase();
  if (t.includes("many_to_many") || t.includes("many-to-many") || t.includes("m:n") || t.includes("n:m")) return "many_many";
  if (t.includes("has_one") || t.includes("belongs_to") || t.includes("1:1") || t.includes("one-to-one")) return "one_one";
  if (t.includes("has_many") || t.includes("many") || t.includes("1:n") || t.includes("1-")) return "one_many";
  return "one_many";
}

function buildEdgeStyle(r: OntologyRelation): Partial<Edge> {
  const card = inferCardinality(r);
  const label = (r as any).type ?? "";
  const base: Partial<Edge> = { type: "smoothstep", label };

  if (card === "many_many") {
    return {
      ...base,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5, strokeDasharray: "5 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 12, height: 12 },
      markerStart: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 12, height: 12, orient: "auto-start-reverse" },
      animated: true,
    };
  }
  if (card === "one_one") {
    return {
      ...base,
      style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))", width: 12, height: 12 },
      markerStart: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))", width: 12, height: 12, orient: "auto-start-reverse" },
    };
  }
  return {
    ...base,
    style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 14, height: 14 },
    markerStart: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 10, height: 10, orient: "auto-start-reverse" },
  };
}

/* ────────────────────────────────────────────────────────────────
   DiagramInner
   ──────────────────────────────────────────────────────────────── */
interface DiagramInnerProps {
  objects: OntologyObject[];
  relations: OntologyRelation[];
  fieldsByObject: Record<string, OntologyProperty[]>;
  onNodeClick?: (obj: OntologyObject) => void;
}
function DiagramInner({ objects, relations, fieldsByObject, onNodeClick }: DiagramInnerProps) {
  const rf = useReactFlow();
  const [zoomPercent, setZoomPercent] = useState(100);

  const { nodes, edges } = useMemo(() => {
    if (objects.length === 0) return { nodes: [], edges: [] };
    const positioned = calcLayout(objects, relations);
    const nodeMap = new Map(positioned.map(p => [p.id, p]));

    const relCount = new Map<string, number>();
    objects.forEach(o => relCount.set(o.id, 0));
    relations.forEach(r => {
      relCount.set(r.source_object_id, (relCount.get(r.source_object_id) ?? 0) + 1);
      relCount.set(r.target_object_id, (relCount.get(r.target_object_id) ?? 0) + 1);
    });

    const nodes: Node<ObjectNodeData>[] = objects.map(o => {
      const pos = nodeMap.get(o.id);
      const props = (fieldsByObject[o.id] ?? []).map(p => ({
        id: p.id, name: p.name, label: p.label,
        type: (p as any).type ?? (p as any).data_type ?? "text",
        required: p.required,
      }));
      return {
        id: o.id,
        type: "object",
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        data: {
          label: o.label || o.name,
          name: o.name,
          fieldsCount: props.length || (o.properties_count ?? 0),
          relationsCount: relCount.get(o.id) ?? 0,
          idShort: (o.id ?? "").slice(-6),
          status: o.status ?? "draft",
          properties: props,
          onOpenDetail: () => onNodeClick?.(o),
        },
        draggable: true,
        selectable: true,
      };
    });

    const edges: Edge[] = relations
      .filter(r => nodeMap.has(r.source_object_id) && nodeMap.has(r.target_object_id))
      .map(r => ({
        id: r.id,
        source: r.source_object_id,
        target: r.target_object_id,
        ...buildEdgeStyle(r),
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.95 },
      }));

    return { nodes, edges };
  }, [objects, relations, fieldsByObject, onNodeClick]);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const obj = objects.find(o => o.id === node.id);
    if (obj) onNodeClick?.(obj);
  }, [objects, onNodeClick]);

  useEffect(() => {
    const id = setInterval(() => {
      setZoomPercent(Math.round(rf.getZoom() * 100));
    }, 250);
    return () => clearInterval(id);
  }, [rf]);

  return (
    <div className="relative w-full h-[min(72vh,640px)] rounded-xl border bg-primary overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionMode={connectionMode}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.25}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        onNodeClick={handleNodeClick}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="hsl(var(--muted-foreground) / 0.25)"
        />
        <MiniMap
          nodeColor={(n) => {
            const status = (n.data as any)?.status;
            return status === "active" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
          }}
          nodeStrokeColor="#fff"
          nodeStrokeWidth={2}
          pannable
          zoomable
          maskColor="hsl(var(--background) / 0.65)"
          className="!bg-white !border !border-border !shadow-sm !rounded-lg"
          style={{
            background: "#ffffff",
            backgroundColor: "#ffffff",
            bottom: 12,
            right: 12,
            width: 160,
            height: 100,
          }}
        />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="!border !bg-card !border-border !shadow-sm !rounded-lg"
          style={{ bottom: 124, right: 12 }}
        />
      </ReactFlow>

      {/* 顶部 Left 统计 chip */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-xs bg-card/90 backdrop-blur rounded-md shadow-sm border px-3 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-muted-foreground">
          节点 <strong className="text-foreground">{nodes.length}</strong> · 关系 <strong className="text-foreground">{edges.length}</strong>
        </span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-muted-foreground font-mono">{zoomPercent}%</span>
      </div>

      {/* 顶部 Right 操作 */}
      <div className="absolute top-3 right-3 z-10 flex gap-1 bg-card/90 backdrop-blur rounded-md shadow-sm border p-0.5">
        <Button variant="ghost" size="icon" className="size-7 hover:bg-muted" onClick={() => rf.fitView({ padding: 0.18, duration: 300 })} title="适应画布">
          <Maximize2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7 hover:bg-muted" onClick={() => rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })} title="重置视图">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* 底部图例 (锚定左下, minimap 锚定右下, 不互相挤压) */}
      <div className="absolute bottom-3 left-3 z-20 text-xs text-muted-foreground bg-card/95 backdrop-blur rounded-md shadow-sm border px-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-primary/15 ring-1 ring-primary/40" />
          <span>业务对象</span>
        </div>
        <span className="text-muted-foreground/30">·</span>
        <LegendOneMany />
        <LegendOneOne />
        <LegendManyMany />
        <span className="text-xs text-muted-foreground/70 ml-1 self-end">· 拖拽 · 缩放 · 单击查看</span>
      </div>
    </div>
  );
}

function LegendOneMany() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="8">
        <defs>
          <marker id="leg-o1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
          </marker>
          <marker id="leg-o2" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
          </marker>
        </defs>
        <line x1="0" y1="4" x2="18" y2="4" stroke="hsl(var(--primary))" strokeWidth="1.5" markerStart="url(#leg-o2)" markerEnd="url(#leg-o1)" />
      </svg>
      1:N
    </div>
  );
}
function LegendOneOne() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="8">
        <defs>
          <marker id="leg-11a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
          </marker>
          <marker id="leg-11b" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>
        <line x1="0" y1="4" x2="18" y2="4" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" markerStart="url(#leg-11b)" markerEnd="url(#leg-11a)" />
      </svg>
      1:1
    </div>
  );
}
function LegendManyMany() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="8">
        <defs>
          <marker id="leg-nm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
          </marker>
        </defs>
        <line x1="0" y1="4" x2="18" y2="4" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" markerStart="url(#leg-nm)" markerEnd="url(#leg-nm)" />
      </svg>
      N:M
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   旧自绘 MiniMap 已移除, 改用 xyflow 自带 <MiniMap>
   ──────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────
   对外组件 (Provider + 数据加载 + 事件订阅)
   ──────────────────────────────────────────────────────────────── */
interface Props {
  appId: string;
  onNodeClick?: (obj: OntologyObject) => void;
}
export function RelationshipDiagram({ appId, onNodeClick }: Props) {
  const [objects, setObjects] = useState<OntologyObject[] | null>(null);
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [fieldsByObject, setFieldsByObject] = useState<Record<string, OntologyProperty[]>>({});
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!appId) return;
    try {
      const [objs, rels] = await Promise.all([
        ontologyApi.listObjects(appId),
        ontologyApi.listRelations(),
      ]);
      const data = objs ?? [];
      setObjects(data);
      const appIds = new Set(data.map(o => o.id));
      setRelations((rels ?? []).filter(r => appIds.has(r.source_object_id) && appIds.has(r.target_object_id)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, [appId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    if (!objects) return;
    (async () => {
      const map: Record<string, OntologyProperty[]> = {};
      await Promise.all(objects.map(async o => {
        try {
          const ps = await ontologyApi.listProperties(o.id);
          map[o.id] = ps ?? [];
        } catch { map[o.id] = []; }
      }));
      if (!cancelled) setFieldsByObject(map);
    })();
    return () => { cancelled = true; };
  }, [objects]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail === "object" && "appId" in detail && detail.appId && detail.appId !== appId) return;
      loadAll();
    };
    window.addEventListener("mp:ontology-changed", onChange as EventListener);
    return () => window.removeEventListener("mp:ontology-changed", onChange as EventListener);
  }, [appId, loadAll]);

  if (error) return (
    <div className="text-destructive text-sm flex items-center gap-2 p-4 border rounded">
      <AlertCircle className="size-4" /> 关系图加载失败: {error}
    </div>
  );
  if (objects === null) return (
    <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> 加载中...
    </div>
  );
  if (objects.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
      <Link2 className="size-10 opacity-30" />
      <p>暂无业务对象, 关系图无法绘制</p>
      <p className="text-xs">先去左侧"对象列表"中新建几个对象, 或找我(数字员工)帮你创建</p>
    </div>
  );

  return (
    <ReactFlowProvider>
      <DiagramInner
        objects={objects}
        relations={relations}
        fieldsByObject={fieldsByObject}
        onNodeClick={onNodeClick}
      />
    </ReactFlowProvider>
  );
}
