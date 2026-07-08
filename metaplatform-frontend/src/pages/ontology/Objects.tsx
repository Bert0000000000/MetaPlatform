import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/stat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ontologyApi, type OntologyObject } from "@/lib/api";
import {
  Plus, Sparkles, Search, Edit, Trash2, Link2, Loader2, AlertCircle,
  User, Package, Tag, Users, FileText, Receipt, Box, Settings,
  Hash, Copy, Check, ShieldCheck, GitMerge, AlertOctagon, Activity, CopyMinus, RotateCcw,
  ZoomIn, ZoomOut, Maximize2, Move,
} from "lucide-react";

/** Map icon string names from the API to Lucide components */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Package, Tag, Users, FileText, Receipt, Box, Settings,
};

function DynamicIcon({ name, className }: { name?: string; className?: string }) {
  if (name && ICON_MAP[name]) {
    const Icon = ICON_MAP[name];
    return <Icon className={className} />;
  }
  return <Box className={className} />;
}

/* ────────── 去重算法 (同 OntologyTab 但独立) ────────── */
function normalizeNameDedup(s: string): string {
  return s
    .replace(/[_-]/g, "")
    .replace(/\s+/g, "")
    .replace(/[()（）【】\[\]·,，.。]/g, "")
    .toLowerCase();
}
function findDuplicates(objects: OntologyObject[]): { key: string; reason: string; members: OntologyObject[] }[] {
  const groups: { key: string; reason: string; members: OntologyObject[] }[] = [];
  const used = new Set<string>();
  objects.forEach((a, i) => {
    if (used.has(a.id)) return;
    const group: OntologyObject[] = [a];
    const reasons = new Set<string>();
    const na = normalizeNameDedup(a.name || "");
    const la = normalizeNameDedup(a.label || "");
    objects.forEach((b, j) => {
      if (j <= i || used.has(b.id)) return;
      const nb = normalizeNameDedup(b.name || "");
      const lb = normalizeNameDedup(b.label || "");
      if (na && nb && na === nb) {
        group.push(b);
        reasons.add(`name 相同: "${a.name}" = "${b.name}"`);
        return;
      }
      if (la && lb && (la.includes(lb) || lb.includes(la))) {
        group.push(b);
        reasons.add(`label 相似: "${a.label}" ≈ "${b.label}"`);
        return;
      }
      if (na && nb && na !== nb && (na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 4) {
        group.push(b);
        reasons.add(`name 包含: "${a.name}" ⊃ "${b.name}"`);
      }
    });
    if (group.length > 1) {
      group.forEach((g) => used.add(g.id));
      groups.push({ key: `grp-${a.id}`, reason: [...reasons].join(" / "), members: group });
    }
  });
  return groups;
}

/* 复制按钮 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex size-5 rounded hover:bg-muted items-center justify-center transition-colors align-middle"
      title={`复制 ${label}: ${value}`}
    >
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3 text-muted-foreground" />}
    </button>
  );
}

/* ═════════════ E-R 关系图对话框 ═════════════
 *
 * 自动布局: 把对象按圆形均匀分布, 画 SVG 节点 + 边
 * 交互: 拖动节点 / 滚轮缩放 / 平移画布 / 点节点跳详情
 *
 * 节点 = 矩形 (label/name)
 * 边   = 关系 (后端 OntologyRelation, 暂时从 relations API 拉)
 *       没有 relations 时按 name 启发式推断 (e.g. Customer → Order)
 */
function ERGraphDialog({
  open,
  onOpenChange,
  objects,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  objects: OntologyObject[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [relations, setRelations] = useState<{ source: string; target: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const navigate = useNavigate();

  // 打开时拉 relations
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    ontologyApi.listRelations()
      .then((rels) => {
        setRelations(rels.map((r) => ({ source: r.source_object_id, target: r.target_object_id, type: r.type || r.label || "关联" })));
      })
      .catch(() => {
        // 失败时用启发式补一些, 至少图能看
        setRelations(inferHeuristicRelations(objects));
      })
      .finally(() => setLoading(false));
    // 重置视图
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [open, objects]);

  // 圆形布局节点
  useEffect(() => {
    if (!open || objects.length === 0) return;
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      const cx = 500;
      const cy = 360;
      const r = Math.min(280, 100 + objects.length * 15);
      objects.forEach((o, i) => {
        // 保留用户拖动后的位置
        if (prev[o.id]) {
          next[o.id] = prev[o.id];
          return;
        }
        const angle = (i / objects.length) * Math.PI * 2 - Math.PI / 2;
        next[o.id] = {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        };
      });
      return next;
    });
  }, [open, objects]);

  function inferHeuristicRelations(objs: OntologyObject[]): { source: string; target: string; type: string }[] {
    const r: { source: string; target: string; type: string }[] = [];
    const findByName = (n: string) => objs.find((o) => o.name.toLowerCase().includes(n.toLowerCase()));
    // 常见业务关系
    const pairs: [string, string, string][] = [
      ["Customer", "Order", "下单"],
      ["Customer", "Opportunity", "潜客"],
      ["Order", "Product", "包含"],
      ["Order", "Invoice", "生成"],
      ["Opportunity", "Activity", "跟进"],
      ["Contract", "Customer", "签约"],
      ["Employee", "Customer", "负责"],
    ];
    pairs.forEach(([a, b, type]) => {
      const oa = findByName(a);
      const ob = findByName(b);
      if (oa && ob) r.push({ source: oa.id, target: ob.id, type });
    });
    return r;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-node]")) return; // 点在节点上不 pan
    setPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (dragNodeId) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      setPositions((prev) => ({ ...prev, [dragNodeId]: { x: newX, y: newY } }));
      return;
    }
    if (panning) {
      setPan({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function handleCanvasMouseUp() {
    setDragNodeId(null);
    setPanning(false);
  }

  function handleNodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[id];
    if (!pos) return;
    setDragNodeId(id);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - pos.x,
      y: (e.clientY - rect.top - pan.y) / zoom - pos.y,
    });
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPositions({});
  }

  const nodeW = 130;
  const nodeH = 56;
  const relCount = relations.length;
  const objCount = objects.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="size-5" />
                关系图 (E-R)
              </DialogTitle>
              <DialogDescription>
                {loading ? "加载关系中..." : `${objCount} 个对象, ${relCount} 条关系`}
                {relCount === 0 && !loading && " (无后端关系, 已用业务启发式推断)"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(3, z * 1.2))} title="放大">
                <ZoomIn className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))} title="缩小">
                <ZoomOut className="size-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={resetView} title="重置">
                <Maximize2 className="size-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground ml-2 font-mono tabular-nums">
                {(zoom * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-gradient-to-br from-muted/30 to-muted/10 relative" style={{ height: "70vh" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <svg
            ref={svgRef}
            className="w-full h-full select-none"
            style={{ cursor: panning ? "grabbing" : dragNodeId ? "grabbing" : "grab" }}
            onWheel={handleWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--muted-foreground))" />
              </marker>
              <marker id="arrowhead-hover" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--primary))" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 边 */}
              {relations.map((rel, i) => {
                const s = positions[rel.source];
                const t = positions[rel.target];
                if (!s || !t) return null;
                // 节点边缘
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.hypot(dx, dy) || 1;
                const ux = dx / dist;
                const uy = dy / dist;
                const sx = s.x + ux * (nodeW / 2);
                const sy = s.y + uy * (nodeH / 2);
                const tx = t.x - ux * (nodeW / 2 + 6);
                const ty = t.y - uy * (nodeH / 2 + 6);
                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;
                const isHighlighted = hoverNodeId === rel.source || hoverNodeId === rel.target;
                return (
                  <g key={i} className="pointer-events-none">
                    <line
                      x1={sx} y1={sy} x2={tx} y2={ty}
                      stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                      strokeWidth={isHighlighted ? 2.5 : 1.5}
                      markerEnd={isHighlighted ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
                      opacity={hoverNodeId ? (isHighlighted ? 1 : 0.3) : 0.7}
                    />
                    {/* 关系标签 */}
                    <rect
                      x={midX - rel.type.length * 4.5}
                      y={midY - 9}
                      width={rel.type.length * 9}
                      height={18}
                      fill="hsl(var(--background))"
                      stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={1}
                      rx={4}
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      textAnchor="middle"
                      className="text-[10px] fill-foreground pointer-events-none"
                    >
                      {rel.type}
                    </text>
                  </g>
                );
              })}

              {/* 节点 */}
              {objects.map((o) => {
                const pos = positions[o.id];
                if (!pos) return null;
                const isDup = o.name === o.name.toLowerCase() && o.name === o.name.toLowerCase(); // 简化
                const isHover = hoverNodeId === o.id;
                const connectedIds = new Set<string>();
                relations.forEach((r) => {
                  if (r.source === o.id) connectedIds.add(r.target);
                  if (r.target === o.id) connectedIds.add(r.source);
                });
                const hasConnections = connectedIds.size > 0;
                return (
                  <g
                    key={o.id}
                    data-node={o.id}
                    transform={`translate(${pos.x - nodeW / 2}, ${pos.y - nodeH / 2})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, o.id)}
                    onMouseEnter={() => setHoverNodeId(o.id)}
                    onMouseLeave={() => setHoverNodeId(null)}
                    onDoubleClick={() => { onOpenChange(false); navigate(`/ontology/object/${o.id}`); }}
                    className="cursor-pointer"
                  >
                    {/* 阴影 */}
                    <rect
                      x={1} y={2} width={nodeW} height={nodeH}
                      fill="hsl(var(--background))"
                      opacity={0.6}
                      rx={8}
                    />
                    {/* 主体 */}
                    <rect
                      x={0} y={0} width={nodeW} height={nodeH}
                      fill={isHover ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))"}
                      stroke={isHover ? "hsl(var(--primary))" : hasConnections ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))"}
                      strokeWidth={isHover ? 2 : 1.5}
                      rx={8}
                    />
                    {/* 图标 */}
                    <foreignObject x={8} y={8} width={20} height={20}>
                      <DynamicIcon name={o.icon} className="size-5 text-primary" />
                    </foreignObject>
                    {/* 标签 */}
                    <text x={34} y={22} className="text-[12px] font-medium fill-foreground pointer-events-none">
                      {o.label.length > 8 ? o.label.slice(0, 8) + "…" : o.label}
                    </text>
                    <text x={34} y={38} className="text-[10px] fill-muted-foreground pointer-events-none font-mono">
                      {o.name.length > 10 ? o.name.slice(0, 10) + "…" : o.name}
                    </text>
                    <text x={34} y={50} className="text-[9px] fill-muted-foreground pointer-events-none">
                      {o.properties_count} 字段
                    </text>
                    {/* 无关系标记 */}
                    {!hasConnections && (
                      <circle cx={nodeW - 8} cy={8} r={3} fill="hsl(var(--orange-500, #f97316))" />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* 图例 */}
          <div className="absolute bottom-2 left-2 bg-background/90 border rounded p-2 text-[10px] space-y-0.5">
            <div className="font-medium mb-1">图例</div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded border border-primary/40 bg-card" />
              <span>对象 (双击查看)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-0.5 h-2 bg-muted-foreground" />
              <span>关系</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-orange-500" />
              <span>无关联</span>
            </div>
          </div>

          {/* 操作提示 */}
          <div className="absolute top-2 right-2 bg-background/90 border rounded p-2 text-[10px] space-y-0.5">
            <div>🖱️ 拖动节点移动</div>
            <div>🖱️ 拖动空白平移</div>
            <div>🖱️ 滚轮缩放</div>
            <div>🖱️ 双击节点查看详情</div>
          </div>
        </div>

        <DialogFooter className="px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground mr-auto">
            关系来源: {relations.length > 0 ? "后端 ontologyApi.listRelations() + 业务启发式补全" : "全部为业务启发式推断"}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Objects() {
  const navigate = useNavigate();
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", label: "", icon: "", description: "" });
  // 去重
  const [dedupOpen, setDedupOpen] = useState(false);
  const [targetPicks, setTargetPicks] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  // E-R 图
  const [erOpen, setErOpen] = useState(false);

  const fetchObjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ontologyApi.listObjects();
      setObjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  const handleCreate = async () => {
    if (!form.name || !form.label) return;
    try {
      setCreating(true);
      await ontologyApi.createObject({
        name: form.name,
        label: form.label,
        icon: form.icon || undefined,
        description: form.description || undefined,
      });
      setDialogOpen(false);
      setForm({ name: "", label: "", icon: "", description: "" });
      await fetchObjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除对象「${name}」?`)) return;
    try {
      await ontologyApi.deleteObject(id);
      await fetchObjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  /* ────────── 去重计算 ────────── */
  const groups = useMemo(() => findDuplicates(objects), [objects]);
  const dupMemberIds = useMemo(() => {
    const s = new Set<string>();
    groups.forEach((g) => g.members.forEach((m) => s.add(m.id)));
    return s;
  }, [groups]);
  // code 唯一性
  const codeDupIds = useMemo(() => {
    const codeCount = new Map<string, number>();
    objects.forEach((o) => {
      const c = (o.code || "").trim();
      if (!c) return;
      codeCount.set(c, (codeCount.get(c) || 0) + 1);
    });
    const dupIds = new Set<string>();
    const dupCodes: string[] = [];
    codeCount.forEach((cnt, code) => { if (cnt > 1) dupCodes.push(code); });
    objects.forEach((o) => { if (o.code && dupCodes.includes(o.code.trim())) dupIds.add(o.id); });
    return dupIds;
  }, [objects]);
  const noCodeCount = objects.filter((o) => !o.code || !o.code.trim()).length;

  // 选默认 target
  function pickDefaultTarget(members: OntologyObject[]): string {
    const sorted = [...members].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return (b.properties_count || 0) - (a.properties_count || 0);
    });
    return sorted[0].id;
  }

  async function doMergeOne(group: { key: string; members: OntologyObject[] }): Promise<{ merged: number; failed: string[] }> {
    const target = targetPicks[group.key] || pickDefaultTarget(group.members);
    const toDelete = group.members.filter((m) => m.id !== target);
    const failed: string[] = [];
    for (const m of toDelete) {
      try {
        await ontologyApi.deleteObject(m.id);
      } catch (e) {
        failed.push(`${m.label || m.name} (${m.id}): ${(e as Error).message || "未知错误"}`);
      }
    }
    return { merged: toDelete.length - failed.length, failed };
  }

  async function doMergeAll() {
    if (merging) return;
    setMerging(true);
    const allFailed: string[] = [];
    let totalMerged = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      setMergeProgress({ done: i, total: groups.length, current: g.members.map((m) => m.label || m.name).join(" / ") });
      const r = await doMergeOne(g);
      totalMerged += r.merged;
      allFailed.push(...r.failed);
    }
    setMergeProgress({ done: groups.length, total: groups.length, current: "" });
    setMerging(false);
    setTimeout(() => setMergeProgress(null), 1500);
    await fetchObjects();
    if (allFailed.length > 0) {
      alert(`合并完成: 成功 ${totalMerged} 条, 失败 ${allFailed.length} 条\n\n${allFailed.join("\n")}`);
    } else {
      alert(`✓ 合并完成: ${totalMerged} 条重复已删除`);
    }
  }

  const filtered = objects.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.code || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="对象(Objects)"
        description="本体 8 要素之第 1 要素: 业务对象建模"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" disabled>
              <Sparkles className="size-4" /> AI 对象生成
            </Button>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> 新建对象
            </Button>
          </div>
        }
      />

      {/* 概览条 */}
      <div className="flex items-center gap-3 text-sm flex-wrap p-3 rounded-lg border bg-muted/30">
        <span className="text-muted-foreground">对象总数</span>
        <span className="font-mono font-semibold text-lg tabular-nums">{objects.length}</span>
        {noCodeCount > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-orange-600 dark:text-orange-400">缺 code</span>
            <span className="font-mono font-semibold text-lg tabular-nums text-orange-600 dark:text-orange-400">{noCodeCount}</span>
          </>
        )}
        {codeDupIds.size > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-red-600 dark:text-red-400">code 重复</span>
            <span className="font-mono font-semibold text-lg tabular-nums text-red-600 dark:text-red-400">{codeDupIds.size}</span>
          </>
        )}
        {groups.length > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-amber-600 dark:text-amber-400">重复组</span>
            <span className="font-mono font-semibold text-lg tabular-nums text-amber-600 dark:text-amber-400">{groups.length}</span>
            <span className="text-amber-600 dark:text-amber-400 text-xs">({dupMemberIds.size} 条)</span>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchObjects}>
            <RotateCcw className="size-3.5 mr-1" /> 重新拉取
          </Button>
          {groups.length > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setDedupOpen(true)}>
              <ShieldCheck className="size-3.5 mr-1" /> 去重校验 ({groups.length})
            </Button>
          )}
        </div>
      </div>

      {/* 合并进度条 */}
      {mergeProgress && (
        <div className="p-3 rounded-lg border border-primary bg-primary/5 text-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-medium">
              {mergeProgress.done < mergeProgress.total
                ? `正在合并: ${mergeProgress.current}`
                : "✓ 合并完成"}
            </span>
            <span className="font-mono text-xs tabular-nums">
              {mergeProgress.done} / {mergeProgress.total}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${(mergeProgress.done / mergeProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索对象 (id/name/label/code)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setErOpen(true)}>
          <Link2 className="size-4 mr-2" /> 关系图(E-R)
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchObjects}>
            重试
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">所有对象({loading ? "..." : filtered.length})</CardTitle>
          <CardDescription>基于本体的业务对象, 存储于 Neo4j 图数据库</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
            </div>
          ) : objects.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Box className="size-10 mb-3 opacity-40" />
              <p className="text-sm">暂无对象, 点击「新建对象」创建第一个</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>唯一 ID</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>图标</TableHead>
                  <TableHead>对象名</TableHead>
                  <TableHead>中文名</TableHead>
                  <TableHead className="text-right">属性</TableHead>
                  <TableHead className="text-right">动作</TableHead>
                  <TableHead className="text-right">规则</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((obj) => {
                  const isDup = dupMemberIds.has(obj.id);
                  const isCodeDup = codeDupIds.has(obj.id);
                  const isNoCode = !obj.code || !obj.code.trim();
                  return (
                    <TableRow
                      key={obj.id}
                      className={`cursor-pointer ${
                        isCodeDup ? "bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/60" :
                        isDup ? "bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/60" : ""
                      }`}
                      onClick={() => navigate(`/ontology/object/${obj.id}`)}
                    >
                      <TableCell className="font-mono text-[10px] max-w-[180px]">
                        <div className="flex items-center gap-1">
                          <Hash className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate" title={obj.id}>{obj.id}</span>
                          <CopyButton value={obj.id} label="ID" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {obj.code ? (
                          <div className="flex items-center gap-1">
                            <code
                              className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                                isCodeDup
                                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold"
                                  : "bg-muted text-foreground/80"
                              }`}
                              title={obj.code}
                            >
                              {obj.code}
                            </code>
                            <CopyButton value={obj.code} label="Code" />
                            {isCodeDup && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1">重复</Badge>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-orange-600 dark:text-orange-400 italic text-[10px]">缺失</span>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-0 text-[9px] h-4 px-1">缺 code</Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DynamicIcon name={obj.icon} className="size-5" />
                          {isDup && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 text-[9px] h-4 px-1">重名</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{obj.name}</TableCell>
                      <TableCell>{obj.label}</TableCell>
                      <TableCell className="text-right">{obj.properties_count ?? 0}</TableCell>
                      <TableCell className="text-right">{obj.actions_count ?? 0}</TableCell>
                      <TableCell className="text-right">{obj.rules_count ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={obj.status === "active" ? "default" : "secondary"}>
                          {obj.status === "active" ? "已激活" : obj.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => { e.stopPropagation(); navigate(`/ontology/object/${obj.id}`); }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => { e.stopPropagation(); handleDelete(obj.id, obj.name); }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Object Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建对象</DialogTitle>
            <DialogDescription>创建一个新的本体对象</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="obj-name">对象名(英文标识)</Label>
              <Input id="obj-name" placeholder="e.g. Customer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-label">中文标签</Label>
              <Input id="obj-label" placeholder="e.g. 客户" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-icon">图标名称(可选)</Label>
              <Input id="obj-icon" placeholder="e.g. User, Package, Tag" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-desc">描述(可选)</Label>
              <Input id="obj-desc" placeholder="对象描述..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.label || creating}>
              {creating && <Loader2 className="size-4 animate-spin mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E-R 关系图 Dialog */}
      <ERGraphDialog open={erOpen} onOpenChange={setErOpen} objects={objects} />

      {/* 去重 Dialog */}
      <Dialog open={dedupOpen} onOpenChange={setDedupOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              对象去重校验
            </DialogTitle>
            <DialogDescription>
              检测到 <span className="font-semibold text-amber-600">{groups.length}</span> 组重复,
              涉及 <span className="font-semibold">{dupMemberIds.size}</span> 条 ObjectType。
              选 target (主记录) 后, 其他会被后端删除
              (<code className="text-[10px] bg-muted px-1 rounded">DELETE /api/ontology/objects/:id</code>)。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            {groups.map((g) => {
              const targetId = targetPicks[g.key] || pickDefaultTarget(g.members);
              const target = g.members.find((m) => m.id === targetId)!;
              const toDelete = g.members.filter((m) => m.id !== targetId);
              return (
                <div key={g.key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertOctagon className="size-4 text-amber-500" />
                    <span className="text-sm font-semibold">重复组 ({g.members.length} 条)</span>
                    <Badge variant="outline" className="text-[10px]">主记录: {target.label}</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2 px-1">
                    重复信号: {g.reason}
                  </div>
                  <div className="space-y-1.5">
                    {g.members.map((m) => {
                      const isTarget = targetId === m.id;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                            isTarget ? "border-primary bg-primary/5" : "bg-muted/20 hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`target-${g.key}`}
                            checked={isTarget}
                            onChange={() => setTargetPicks((prev) => ({ ...prev, [g.key]: m.id }))}
                            className="size-3.5 accent-primary shrink-0"
                          />
                          <div className="size-7 rounded-md bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-[10px] font-mono shrink-0">
                            {m.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.label}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                              <code className="font-mono">{m.name}</code>
                              {m.code && <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-mono">{m.code}</Badge>}
                              <span>·</span>
                              <span>{m.properties_count} 属性</span>
                              <span>·</span>
                              <span>{m.actions_count} 动作</span>
                              <span>·</span>
                              <span>{m.rules_count} 规则</span>
                              <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[9px] h-3.5 px-1">
                                {m.status}
                              </Badge>
                            </div>
                          </div>
                          {isTarget ? (
                            <Badge variant="default" className="text-[9px] h-4 px-1 shrink-0">主记录</Badge>
                          ) : (
                            <Trash2 className="size-3.5 text-red-500 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground px-1">
                    将删除: <span className="font-mono text-red-600 dark:text-red-400">{toDelete.length} 条</span>
                    {toDelete.length > 0 && (<> ({toDelete.map((d) => d.label).join(" / ")})</>)}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDedupOpen(false)} disabled={merging}>取消</Button>
            <Button variant="destructive" onClick={doMergeAll} disabled={merging || groups.length === 0}>
              {merging ? (
                <><Activity className="size-3.5 mr-1 animate-pulse" /> 合并中...</>
              ) : (
                <><GitMerge className="size-3.5 mr-1" /> 一键合并 {groups.length} 组</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
