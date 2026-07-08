import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle, GitBranch, Zap, Calculator, Settings, Server, Box, Hash, Link2,
  Network, ArrowRight, FileWarning, CheckCircle2,
} from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyProperty, type OntologyRelation, type OntologyAction, type OntologyFunction, type OntologyRule } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * ImpactAnalysis: 本体影响分析
 *
 * 选一个对象 → 静态分析依赖网络
 *   - 直接影响: 该对象的属性/动作/规则/函数
 *   - 关系影响: 与此对象有关的所有关系 (源/目标)
 *   - 级联影响: 关系另一端的对象 → 它们的属性/动作/规则
 *   - 风险评分: 综合
 *
 * 修改前必看, 避免改了炸一片
 * ════════════════════════════════════════════════════════════════════ */

interface ImpactItem {
  kind: "object" | "property" | "action" | "function" | "rule" | "relation";
  id: string;
  name: string;
  via?: string; // 关系路径 A→B→C
  severity: "low" | "medium" | "high";
}

export function ImpactAnalysis() {
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [propsMap, setPropsMap] = useState<Record<string, OntologyProperty[]>>({});
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [actions, setActions] = useState<OntologyAction[]>([]);
  const [functions, setFunctions] = useState<OntologyFunction[]>([]);
  const [rules, setRules] = useState<OntologyRule[]>([]);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjects().catch(() => [] as OntologyObject[]),
      ontologyApi.listRelations().catch(() => [] as OntologyRelation[]),
      ontologyApi.listActions().catch(() => [] as OntologyAction[]),
      ontologyApi.listFunctions().catch(() => [] as OntologyFunction[]),
      ontologyApi.listRules().catch(() => [] as OntologyRule[]),
    ]).then(([objs, rels, acts, fns, rls]) => {
      setObjects(objs);
      setRelations(rels);
      setActions(acts);
      setFunctions(fns);
      setRules(rls);
      if (objs.length > 0) setSelectedId(objs[0].id);
    });
  }, []);

  // 加载所有对象的属性
  useEffect(() => {
    if (objects.length === 0) return;
    Promise.all(
      objects.map((o) => ontologyApi.listProperties(o.id).then((p) => ({ id: o.id, p })).catch(() => ({ id: o.id, p: [] as OntologyProperty[] })))
    ).then((results) => {
      const m: Record<string, OntologyProperty[]> = {};
      results.forEach((r) => { m[r.id] = r.p; });
      setPropsMap(m);
    });
  }, [objects]);

  // 影响分析
  const impact = useMemo(() => {
    if (!selectedId) return null;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj) return null;

    const direct: ImpactItem[] = [];
    const viaObjects = new Map<string, string>(); // objectId → 关系路径

    // 直接: 属性
    (propsMap[selectedId] || []).forEach((p) => {
      direct.push({ kind: "property", id: p.id, name: `${obj.name}.${p.name}`, severity: "low" });
    });
    // 直接: 动作
    actions.filter((a) => a.object_id === selectedId).forEach((a) => {
      direct.push({ kind: "action", id: a.id, name: a.name, severity: "medium" });
    });
    // 直接: 函数
    functions.filter((f) => f.object_id === selectedId).forEach((f) => {
      direct.push({ kind: "function", id: f.id, name: f.name, severity: "low" });
    });
    // 直接: 规则
    rules.filter((r) => r.object_id === selectedId).forEach((r) => {
      direct.push({ kind: "rule", id: r.id, name: r.name, severity: "high" });
    });

    // 关系: 源或目标
    const myRels = relations.filter((r) => r.source_object_id === selectedId || r.target_object_id === selectedId);
    myRels.forEach((r) => {
      const otherId = r.source_object_id === selectedId ? r.target_object_id : r.source_object_id;
      const other = objects.find((o) => o.id === otherId);
      if (!other) return;
      const dir = r.source_object_id === selectedId ? "→" : "←";
      direct.push({
        kind: "relation",
        id: r.id,
        name: `${obj.name} ${dir} ${other.name} (${r.type})`,
        severity: "medium",
      });
      viaObjects.set(otherId, `${obj.name} ${dir} ${other.name}`);
    });

    // 级联: 通过关系影响其他对象
    const cascade: ImpactItem[] = [];
    viaObjects.forEach((path, otherId) => {
      const other = objects.find((o) => o.id === otherId);
      if (!other) return;
      (propsMap[otherId] || []).forEach((p) => {
        cascade.push({
          kind: "property",
          id: p.id,
          name: `${other.name}.${p.name}`,
          via: path,
          severity: "low",
        });
      });
      actions.filter((a) => a.object_id === otherId).forEach((a) => {
        cascade.push({ kind: "action", id: a.id, name: a.name, via: path, severity: "medium" });
      });
      rules.filter((r) => r.object_id === otherId).forEach((r) => {
        cascade.push({ kind: "rule", id: r.id, name: r.name, via: path, severity: "high" });
      });
    });

    // 风险评分: 0-100
    const directCount = direct.length;
    const cascadeCount = cascade.length;
    const highCount = direct.filter((d) => d.severity === "high").length +
                      cascade.filter((c) => c.severity === "high").length;
    const score = Math.min(100, directCount * 3 + cascadeCount * 2 + highCount * 10);
    const level = score >= 70 ? "high" : score >= 30 ? "medium" : "low";

    return { obj, direct, cascade, score, level, relationCount: myRels.length };
  }, [selectedId, objects, propsMap, relations, actions, functions, rules]);

  if (objects.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            加载中... (无对象)
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">影响分析</h1>
        <p className="text-xs text-muted-foreground mt-1">
          修改前必看 — 分析一个对象的依赖网络, 避免改完炸一片
        </p>
      </div>

      {/* 选择对象 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs">选择对象:</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-xs w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {objects.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label || o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {impact && (
        <>
          {/* 风险评分 */}
          <Card className={impact.level === "high" ? "border-destructive" : impact.level === "medium" ? "border-warning" : "border-success"}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">修改风险评分</div>
                  <div className="text-3xl font-bold font-mono mt-1">{impact.score}</div>
                  <div className="text-xs mt-1">
                    风险等级:
                    {impact.level === "high" ? (
                      <Badge variant="destructive" className="ml-1">🔴 高风险</Badge>
                    ) : impact.level === "medium" ? (
                      <Badge className="ml-1 bg-yellow-500">🟡 中风险</Badge>
                    ) : (
                      <Badge className="ml-1 bg-green-500">🟢 低风险</Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <Stat label="直接依赖" value={impact.direct.length} />
                  <Stat label="级联影响" value={impact.cascade.length} />
                  <Stat label="关系数" value={impact.relationCount} />
                  <Stat label="高危项" value={impact.direct.filter((d) => d.severity === "high").length} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 直接影响 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="size-4 text-primary" /> 直接影响 (修改此对象会直接波及)
              </CardTitle>
              <CardDescription>属性 / 动作 / 函数 / 规则 / 关系</CardDescription>
            </CardHeader>
            <CardContent>
              {impact.direct.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">无直接影响</div>
              ) : (
                <div className="space-y-1">
                  {impact.direct.map((d) => (
                    <ImpactRow key={`${d.kind}-${d.id}`} item={d} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 级联影响 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="size-4 text-primary" /> 级联影响 (通过关系间接到其他对象)
              </CardTitle>
              <CardDescription>修改此对象 → 通过关系 → 另一端对象的属性/动作/规则</CardDescription>
            </CardHeader>
            <CardContent>
              {impact.cascade.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">无级联影响</div>
              ) : (
                <div className="space-y-1">
                  {impact.cascade.map((c) => (
                    <ImpactRow key={`c-${c.kind}-${c.id}`} item={c} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ImpactRow({ item }: { item: ImpactItem }) {
  const iconMap = {
    object: Box, property: Hash, action: Zap, function: Calculator, rule: Settings, relation: GitBranch,
  };
  const Icon = iconMap[item.kind];
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border rounded text-xs">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="font-mono flex-1 truncate">{item.name}</span>
      {item.via && (
        <span className="text-muted-foreground text-[10px] flex items-center gap-0.5 shrink-0">
          via <ArrowRight className="size-2.5" /> {item.via}
        </span>
      )}
      <Badge
        variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}
        className="text-[10px] h-4 px-1"
      >
        {item.severity}
      </Badge>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
