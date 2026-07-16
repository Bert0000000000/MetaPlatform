import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { PageAgentPanel } from "@/components/PageAgentPanel";
import { AGENT_OBJECTS } from "@/components/PageAgents";
import { LineageCanvas } from "@/components/lineage/LineageCanvas";
import { OntologyObjectNode } from "@/components/ontology/OntologyObjectNode";
import {
  layoutCircular,
  layoutGrid,
  layoutHierarchical,
  type LayoutMode,
} from "@/lib/layout/position";
// PageAgentPanel 暂时保留给 Objects 页面作为 quick action 入口

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
 * 由原 660 行自绘 SVG 重构为 React Flow 包装版 (与 DataLineage 同款画布)。
 *
 * 改造要点：
 *   - 节点拖拽 / 缩放 / 平移 由 React Flow 自动接管
 *   - 节点形状抽到 OntologyObjectNode
 *   - 3 种布局算法搬至 src/lib/layout/position.ts 复用
 *   - 关系类型标签通过 React Flow Edge.label 直接渲染
 *   - 详情跳转通过节点 hover 「打开详情」按钮 (保留双击触发)
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
  const navigate = useNavigate();
  const [relations, setRelations] = useState<{ source: string; target: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("circular");
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 加载 relations (失败 fallback 到启发式)
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    ontologyApi.listRelations()
      .then((rels) => {
        setRelations(
          rels.map((r) => ({
            source: r.source_object_id,
            target: r.target_object_id,
            type: r.type || r.label || "关联",
          })),
        );
      })
      .catch(() => {
        setRelations(inferHeuristicRelations(objects));
      })
      .finally(() => setLoading(false));
  }, [open, objects]);

  // 切换布局时重算
  const applyLayout = React.useCallback(
    (mode: LayoutMode) => {
      if (objects.length === 0) return;
      const ids = objects.map((o) => o.id);
      let next: Record<string, { x: number; y: number }>;
      if (mode === "circular") next = layoutCircular({ ids });
      else if (mode === "grid") next = layoutGrid({ ids });
      else next = layoutHierarchical({ ids, relations });
      setPositions(next);
    },
    [objects, relations],
  );

  useEffect(() => {
    if (!open || objects.length === 0) return;
    applyLayout(layoutMode);
  }, [open, objects, layoutMode, applyLayout]);

  function inferHeuristicRelations(objs: OntologyObject[]): { source: string; target: string; type: string }[] {
    const r: { source: string; target: string; type: string }[] = [];
    const findByName = (...keywords: string[]) =>
      objs.find((o) => {
        const n = o.name.toLowerCase().replace(/^obj[-_]?/, "").replace(/[-_]/g, "");
        return keywords.some((k) => n.includes(k.toLowerCase()));
      });
    const pairs: [string[], string[], string][] = [
      [["customer", "client", "客户"], ["order", "订单"], "下单"],
      [["customer", "客户"], ["opportunity", "deal", "销售机会"], "潜客"],
      [["order", "订单"], ["product", "goods", "产品"], "包含"],
      [["order", "订单"], ["invoice", "发票"], "生成"],
      [["opportunity", "销售机会"], ["activity", "follow", "活动", "跟进"], "跟进"],
      [["contract", "合同"], ["customer", "客户"], "签约"],
      [["employee", "staff", "员工"], ["customer", "客户"], "负责"],
      [["employee", "员工"], ["order", "订单"], "处理"],
      [["kpi"], ["employee", "员工"], "考核"],
    ];
    pairs.forEach(([aKeys, bKeys, type]) => {
      const oa = findByName(...aKeys);
      const ob = findByName(...bKeys);
      if (oa && ob && oa.id !== ob.id) r.push({ source: oa.id, target: ob.id, type });
    });
    return r;
  }

  // 转 React Flow 的契约
  const lineageNodes: import("@/components/lineage/LineageCanvas").LineageNodeDatum[] = React.useMemo(
    () =>
      objects.map((o) => ({
        id: o.id,
        name: o.label || o.name,
        type: "ontology-object",
        description: o.description ?? "",
        status: (o.status as "active" | "inactive" | "error") ?? "active",
      })),
    [objects],
  );
  const lineageEdges: import("@/components/lineage/LineageCanvas").LineageEdgeDatum[] = React.useMemo(
    () => relations.map((r) => ({ from: r.source, to: r.target })),
    [relations],
  );
  const edgeLabels = React.useMemo(() => {
    const m: Record<string, string> = {};
    relations.forEach((r) => {
      m[`${r.source}->${r.target}`] = r.type;
    });
    return m;
  }, [relations]);
  const edgeDashed = React.useMemo(() => {
    const m: Record<string, boolean> = {};
    relations.forEach((r) => {
      m[`${r.source}->${r.target}`] = true;
    });
    return m;
  }, [relations]);

  // 选中态：lineage 自身 dim 没传入 selectedLabel — 在 OntologyObjectNode 内部处理
  const visibleIds = useMemo(() => new Set(objects.map((o) => o.id)), [objects]);

  const onObjectSelect = React.useCallback((id: string | null) => setSelectedNodeId(id), []);
  const onOpenDetail = React.useCallback(
    (id: string) => {
      onOpenChange(false);
      navigate(`/ontology/object/${id}`);
    },
    [onOpenChange, navigate],
  );

  /**
   * 让 OntologyObjectNode 接收 onOpenDetail 闭包
   * 用 React.useMemo 锁住引用 + useCallback 锁住依赖，避免拖拽时反复重建导致节点闪烁
   */
  const ontologyObjectNodeType = React.useMemo(
    () => (props: import("@xyflow/react").NodeProps) => (
      <OntologyObjectNode
        {...props}
        data={{
          ...(props.data as Record<string, unknown>),
          onOpenDetail,
        }}
      />
    ),
    [onOpenDetail],
  );

  const relCount = relations.length;
  const objCount = objects.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] p-0">
        <DialogHeader className="px-4 py-3 border-b pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            关系图 (E-R)
          </DialogTitle>
          <DialogDescription>
            {loading
              ? "加载关系中..."
              : `${objCount} 个对象, ${relCount} 条关系`}
            {relCount === 0 && !loading && " (无后端关系, 已用业务启发式推断)"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative" style={{ height: "70vh" }}>
          {/* 顶部居中工具栏 - 仅留布局切换 (缩放/重置 React Flow 自带) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg p-1 backdrop-blur">
            <div className="flex items-center gap-0.5 bg-muted/40 rounded p-0.5">
              {(
                [
                  { key: "circular", title: "圆形布局", text: "圆形" },
                  { key: "grid", title: "网格布局", text: "网格" },
                  { key: "hierarchical", title: "分层布局 (减边交叉)", text: "分层" },
                ] as { key: LayoutMode; title: string; text: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    layoutMode === opt.key
                      ? "bg-white shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setLayoutMode(opt.key)}
                  title={opt.title}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* ── 主画布 ── */}
          <LineageCanvas
            nodes={lineageNodes}
            edges={lineageEdges}
            edgeLabels={edgeLabels}
            edgeDashed={edgeDashed}
            visibleNodeIds={visibleIds}
            selectedNodeId={selectedNodeId}
            onNodeSelect={(n) => onObjectSelect(n?.id ?? null)}
            precomputedPositions={positions}
            nodeType="ontology-object"
            nodeTypes={{ "ontology-object": ontologyObjectNodeType }}
            nodesDraggable
            positions={positions}
            onNodesPositionsChange={setPositions}
            resetOnDataChange={false}
            height="100%"
            className="border-0 rounded-none bg-background"
          />

          {/* 图例 */}
          <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg p-2.5 text-xs space-y-1.5 backdrop-blur">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">图例</div>
            <div className="flex items-center gap-2">
              <div className="size-4 rounded border-2 border-blue-500 bg-white" />
              <span className="text-slate-700 dark:text-slate-300">对象 (拖动 / 点打开按钮)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.px border-t-2 border-dashed border-slate-400" style={{ borderTopStyle: "dashed" }} />
              <span className="text-slate-700 dark:text-slate-300">关系</span>
            </div>
          </div>
          {/* 操作提示 */}
          <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-md rounded-lg p-2.5 text-xs space-y-1 backdrop-blur">
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs mb-1">操作</div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span>🖱️</span><span>拖动节点移动</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span>🖱️</span><span>拖动空白平移</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span>🖱️</span><span>滚轮缩放</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span>🖱️</span><span>点击节点右上角打开</span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-2 border-t flex items-center gap-3">
          <div className="text-xs text-muted-foreground mr-auto flex items-center gap-2 flex-wrap">
            <span>关系来源:</span>
            <Badge variant="outline" className="text-xs font-normal">
              {relations.length > 0
                ? "后端 ontologyApi.listRelations() + 业务启发式补全"
                : "全部为业务启发式推断"}
            </Badge>
            <span className="text-muted-foreground/60">|</span>
            <span className="font-mono tabular-nums">{objCount} 对象 / {relCount} 关系</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => applyLayout(layoutMode)}>
            <Maximize2 className="size-3.5 mr-1" /> 重排
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
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
            <PageAgentPanel
              config={{
                ...AGENT_OBJECTS,
                quickActions: [
                  { label: "AI 对象生成", icon: "✨", onClick: () => setDialogOpen(true), variant: "outline" },
                  { label: "打开去重校验", icon: "🔍", onClick: () => setDedupOpen(true), variant: "outline" },
                  { label: "关系图 (E-R)", icon: "📊", onClick: () => setErOpen(true), variant: "outline" },
                ],
              }}
              context={{
                objectsCount: objects.length,
                propertiesTotal: objects.reduce((a, o) => a + o.properties_count, 0),
                duplicates: (() => {
                  const seen = new Set<string>();
                  const dupNames = new Set<string>();
                  objects.forEach((o) => {
                    const k = o.name.toLowerCase().replace(/[-_]/g, "");
                    if (seen.has(k)) dupNames.add(k);
                    seen.add(k);
                  });
                  return dupNames.size;
                })(),
                sampleObjects: objects.slice(0, 5).map((o) => ({
                  name: o.name, label: o.label, properties: o.properties_count,
                })),
              }}
            />
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
                        isDup ? "bg-primary/40 dark:bg-primary/10 hover:bg-primary/60" : ""
                      }`}
                      onClick={() => navigate(`/ontology/object/${obj.id}`)}
                    >
                      <TableCell className="font-mono text-xs max-w-[180px]">
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
                              <Badge variant="destructive" className="text-xs h-4 px-1">重复</Badge>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-orange-600 dark:text-orange-400 italic text-xs">缺失</span>
                            <Badge variant="secondary" className="bg-primary text-orange-700 dark:bg-primary/40 dark:text-orange-400 border-0 text-xs h-4 px-1">缺 code</Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DynamicIcon name={obj.icon} className="size-5" />
                          {isDup && (
                            <Badge variant="secondary" className="bg-primary text-amber-700 dark:bg-primary/40 dark:text-amber-400 border-0 text-xs h-4 px-1">重名</Badge>
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
              (<code className="text-xs bg-muted px-1 rounded">DELETE /api/ontology/objects/:id</code>)。
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
                    <Badge variant="outline" className="text-xs">主记录: {target.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 px-1">
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
                          <div className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-mono shrink-0">
                            {m.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{m.label}</div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                              <code className="font-mono">{m.name}</code>
                              {m.code && <Badge variant="outline" className="text-xs h-3.5 px-1 font-mono">{m.code}</Badge>}
                              <span>·</span>
                              <span>{m.properties_count} 属性</span>
                              <span>·</span>
                              <span>{m.actions_count} 动作</span>
                              <span>·</span>
                              <span>{m.rules_count} 规则</span>
                              <Badge variant={m.status === "active" ? "default" : "outline"} className="text-xs h-3.5 px-1">
                                {m.status}
                              </Badge>
                            </div>
                          </div>
                          {isTarget ? (
                            <Badge variant="default" className="text-xs h-4 px-1 shrink-0">主记录</Badge>
                          ) : (
                            <Trash2 className="size-3.5 text-red-500 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground px-1">
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
