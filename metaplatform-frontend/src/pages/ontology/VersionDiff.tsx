import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GitCompare, Plus, Minus, Edit3, Box, Hash, GitBranch, Zap, Calculator, Settings, Save, Trash2 } from "lucide-react";

/* ════════════════════════════════════════════════════════════════════
 * VersionDiff: 本体版本对比
 *
 * 选两个版本 (from → to) → 显示 diff
 *   - 8 要素分类: 对象 / 属性 / 关系 / 动作 / 函数 / 规则
 *   - 增/删/改 标注
 *   - JSON 导出
 *
 * 版本快照存 localStorage (mp_ontology_snapshots)
 * ════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "mp_ontology_snapshots";

interface Snapshot {
  id: string;
  label: string;
  createdAt: string;
  description?: string;
  data: {
    objects: any[];
    properties: any[];
    relations: any[];
    actions: any[];
    functions: any[];
    rules: any[];
  };
}

type DiffOp = "added" | "removed" | "changed" | "unchanged";

function loadSnapshots(): Snapshot[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return [];
}

function saveSnapshots(arr: Snapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function diff<T extends { id: string }>(a: T[], b: T[]): { op: DiffOp; from?: T; to?: T }[] {
  const aMap = new Map(a.map((x) => [x.id, x]));
  const bMap = new Map(b.map((x) => [x.id, x]));
  const result: { op: DiffOp; from?: T; to?: T }[] = [];
  // added in b
  bMap.forEach((v, k) => { if (!aMap.has(k)) result.push({ op: "added", to: v }); });
  // removed from a
  aMap.forEach((v, k) => { if (!bMap.has(k)) result.push({ op: "removed", from: v }); });
  // changed
  aMap.forEach((va, k) => {
    const vb = bMap.get(k);
    if (vb) {
      if (JSON.stringify(va) === JSON.stringify(vb)) {
        result.push({ op: "unchanged", from: va, to: vb });
      } else {
        result.push({ op: "changed", from: va, to: vb });
      }
    }
  });
  return result;
}

export function VersionDiff() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  useEffect(() => {
    const list = loadSnapshots();
    if (list.length === 0) {
      // 初始化一个空快照避免报错
    } else {
      setSnapshots(list);
      setFromId(list[0].id);
      setToId(list[list.length - 1].id);
    }
  }, []);

  const from = snapshots.find((s) => s.id === fromId);
  const to = snapshots.find((s) => s.id === toId);

  const summary = useMemo(() => {
    if (!from || !to) return null;
    const objectDiff = diff(from.data.objects, to.data.objects);
    const propertyDiff = diff(from.data.properties, to.data.properties);
    const relationDiff = diff(from.data.relations, to.data.relations);
    const actionDiff = diff(from.data.actions, to.data.actions);
    const functionDiff = diff(from.data.functions, to.data.functions);
    const ruleDiff = diff(from.data.rules, to.data.rules);
    const count = (d: { op: DiffOp }[]) => ({
      added: d.filter((x) => x.op === "added").length,
      removed: d.filter((x) => x.op === "removed").length,
      changed: d.filter((x) => x.op === "changed").length,
      unchanged: d.filter((x) => x.op === "unchanged").length,
    });
    return {
      objectDiff, propertyDiff, relationDiff, actionDiff, functionDiff, ruleDiff,
      objectCount: count(objectDiff),
      propertyCount: count(propertyDiff),
      relationCount: count(relationDiff),
      actionCount: count(actionDiff),
      functionCount: count(functionDiff),
      ruleCount: count(ruleDiff),
    };
  }, [from, to]);

  const createSnapshot = () => {
    const label = prompt("快照名称 (e.g. v0.2.0)", `v0.${snapshots.length}.0`);
    if (!label) return;
    // 当前数据从 ontology 存储 mock
    const newSnap: Snapshot = {
      id: "snap_" + Date.now(),
      label,
      createdAt: new Date().toISOString(),
      data: {
        objects: [], properties: [], relations: [],
        actions: [], functions: [], rules: [],
      },
    };
    const next = [...snapshots, newSnap];
    setSnapshots(next);
    saveSnapshots(next);
    if (!toId) setToId(newSnap.id);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <GitCompare className="size-5 text-primary" /> 本体版本对比
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            v0.1 → v0.2 加了什么 / 删了什么 / 改了什么
          </p>
        </div>
        <Button onClick={createSnapshot}>
          <Plus className="size-3.5 mr-1" /> 新建快照
        </Button>
      </div>

      {/* 选择版本 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          {snapshots.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              暂无快照。点击「新建快照」开始, 然后切换 Ontology 页面做出修改, 再建一个快照。
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <Label className="text-xs">From (旧)</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-muted-foreground self-end pb-2">→</div>
              <div>
                <Label className="text-xs">To (新)</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground ml-auto">
                {from?.createdAt?.slice(0, 10)} → {to?.createdAt?.slice(0, 10)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <>
          {/* 概览 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">变更概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2">
                <DiffCategoryCard icon={Box} name="对象" count={summary.objectCount} />
                <DiffCategoryCard icon={Hash} name="属性" count={summary.propertyCount} />
                <DiffCategoryCard icon={GitBranch} name="关系" count={summary.relationCount} />
                <DiffCategoryCard icon={Zap} name="动作" count={summary.actionCount} />
                <DiffCategoryCard icon={Calculator} name="函数" count={summary.functionCount} />
                <DiffCategoryCard icon={Settings} name="规则" count={summary.ruleCount} />
              </div>
            </CardContent>
          </Card>

          {/* 详细 diff */}
          <Card>
            <CardContent className="pt-3">
              <Tabs defaultValue="objects">
                <TabsList>
                  <TabsTrigger value="objects">对象 ({summary.objectCount.added + summary.objectCount.removed + summary.objectCount.changed})</TabsTrigger>
                  <TabsTrigger value="properties">属性</TabsTrigger>
                  <TabsTrigger value="relations">关系</TabsTrigger>
                  <TabsTrigger value="actions">动作</TabsTrigger>
                  <TabsTrigger value="functions">函数</TabsTrigger>
                  <TabsTrigger value="rules">规则</TabsTrigger>
                </TabsList>
                <TabsContent value="objects" className="mt-3">
                  <DiffList diffs={summary.objectDiff} nameKey="name" />
                </TabsContent>
                <TabsContent value="properties" className="mt-3">
                  <DiffList diffs={summary.propertyDiff} nameKey="name" />
                </TabsContent>
                <TabsContent value="relations" className="mt-3">
                  <DiffList diffs={summary.relationDiff} nameKey="type" />
                </TabsContent>
                <TabsContent value="actions" className="mt-3">
                  <DiffList diffs={summary.actionDiff} nameKey="name" />
                </TabsContent>
                <TabsContent value="functions" className="mt-3">
                  <DiffList diffs={summary.functionDiff} nameKey="name" />
                </TabsContent>
                <TabsContent value="rules" className="mt-3">
                  <DiffList diffs={summary.ruleDiff} nameKey="name" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DiffCategoryCard({ icon: Icon, name, count }: { icon: React.ComponentType<{ className?: string }>; name: string; count: { added: number; removed: number; changed: number; unchanged: number } }) {
  return (
    <div className="border rounded p-2 text-center">
      <Icon className="size-4 mx-auto text-muted-foreground" />
      <div className="text-xs font-medium mt-1">{name}</div>
      <div className="flex justify-center gap-1 mt-1 text-[10px] font-mono">
        <span className="text-green-600">+{count.added}</span>
        <span className="text-red-600">-{count.removed}</span>
        <span className="text-yellow-600">~{count.changed}</span>
      </div>
    </div>
  );
}

function DiffList({ diffs, nameKey }: { diffs: { op: DiffOp; from?: any; to?: any }[]; nameKey: string }) {
  if (diffs.length === 0) return <div className="text-sm text-muted-foreground text-center py-4">无变更</div>;
  return (
    <div className="space-y-1">
      {diffs.map((d, i) => {
        const name = (d.to?.[nameKey] || d.from?.[nameKey] || "?") as string;
        return (
          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 border rounded text-xs ${
            d.op === "added" ? "border-green-300 bg-green-50" :
            d.op === "removed" ? "border-red-300 bg-red-50" :
            d.op === "changed" ? "border-yellow-300 bg-yellow-50" :
            ""
          }`}>
            {d.op === "added" && <Plus className="size-3 text-green-600" />}
            {d.op === "removed" && <Minus className="size-3 text-red-600" />}
            {d.op === "changed" && <Edit3 className="size-3 text-yellow-600" />}
            {d.op === "unchanged" && <div className="size-3" />}
            <span className="font-mono flex-1 truncate">{name}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">{d.op}</Badge>
            {d.op === "changed" && (
              <details className="text-[10px] text-muted-foreground">
                <summary className="cursor-pointer">查看 diff</summary>
                <div className="mt-1 font-mono text-[10px] p-1 bg-white rounded">
                  <div className="text-red-600">- {JSON.stringify(d.from)}</div>
                  <div className="text-green-600">+ {JSON.stringify(d.to)}</div>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
