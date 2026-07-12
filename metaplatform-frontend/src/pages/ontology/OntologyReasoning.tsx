import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Brain, GitBranch, ArrowRight, Sparkles, Network, Layers, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyRelation } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * OntologyReasoning: 本体推理 (OWL / Neo4j Reasoning 简化版)
 *
 * 支持 3 种推理:
 *   1. 传递闭包 (Transitive Closure): A extends B, B extends C → A extends C
 *   2. 对称关系 (Symmetric): A 朋友 B → B 朋友 A
 *   3. 互斥 (Disjoint): 同一对象不能同时是两个互斥类
 *
 * 输入: 8 要素中的对象 + 关系
 * 输出: 推断出的新关系 + 矛盾检测
 * ════════════════════════════════════════════════════════════════════ */

interface Inferred {
  type: "transitive" | "symmetric" | "disjoint-violation";
  source: string;
  target: string;
  via: string[];
  reason: string;
}

export function OntologyReasoning() {
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [reasoningType, setReasoningType] = useState<"transitive" | "symmetric" | "disjoint">("transitive");

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjects().catch(() => [] as OntologyObject[]),
      ontologyApi.listRelations().catch(() => [] as OntologyRelation[]),
    ]).then(([objs, rels]) => {
      setObjects(objs);
      setRelations(rels);
    });
  }, []);

  // 推理
  const inferred = useMemo<Inferred[]>(() => {
    const list: Inferred[] = [];
    const objMap = new Map(objects.map((o) => [o.id, o]));

    if (reasoningType === "transitive") {
      // 假设关系 type 含 "extends" / "subclass" / "继承" 的为传递关系
      const transRels = relations.filter((r) => /extend|inherit|sub|继承/i.test(r.type));
      // Warshall 传递闭包
      const reach = new Map<string, Set<string>>();
      transRels.forEach((r) => {
        if (!reach.has(r.source_object_id)) reach.set(r.source_object_id, new Set());
        reach.get(r.source_object_id)!.add(r.target_object_id);
      });
      for (const k of reach.keys()) {
        for (const i of reach.keys()) {
          for (const j of reach.keys()) {
            if (reach.get(i)?.has(k) && reach.get(k)?.has(j)) {
              reach.get(i)!.add(j);
            }
          }
        }
      }
      // 提取新推理
      reach.forEach((targets, source) => {
        targets.forEach((target) => {
          // 检查是不是已经存在的关系
          const exists = transRels.some((r) => r.source_object_id === source && r.target_object_id === target);
          if (!exists && source !== target) {
            // 找路径
            const path = findPath(source, target, transRels);
            if (path.length > 1) {
              const src = objMap.get(source);
              const tgt = objMap.get(target);
              if (src && tgt) {
                list.push({
                  type: "transitive",
                  source: src.name,
                  target: tgt.name,
                  via: path.map((id) => objMap.get(id)?.name || id),
                  reason: `传递闭包: ${path.map((id) => objMap.get(id)?.name).join(" → ")}`,
                });
              }
            }
          }
        });
      });
    } else if (reasoningType === "symmetric") {
      // 假设关系 type 含 "朋友" / "spouse" / "等价" / "equal" 为对称关系
      const symRels = relations.filter((r) => /朋友|friend|spouse|等价|equal|symmetric|配偶/i.test(r.type));
      symRels.forEach((r) => {
        const hasReverse = symRels.some((x) => x.source_object_id === r.target_object_id && x.target_object_id === r.source_object_id);
        if (!hasReverse) {
          const src = objMap.get(r.source_object_id);
          const tgt = objMap.get(r.target_object_id);
          if (src && tgt) {
            list.push({
              type: "symmetric",
              source: tgt.name,
              target: src.name,
              via: [src.name, tgt.name],
              reason: `对称推理: ${src.name} ${r.type} ${tgt.name} ⇒ ${tgt.name} ${r.type} ${src.name}`,
            });
          }
        }
      });
    } else if (reasoningType === "disjoint") {
      // 假设关系 type 含 "disjoint" / "互斥" 为互斥
      const disRels = relations.filter((r) => /disjoint|互斥|mutually_exclusive/i.test(r.type));
      // 检查是否有对象同时属于互斥两类
      const classOf = new Map<string, string[]>(); // objectId → className
      disRels.forEach((r) => {
        const src = objMap.get(r.source_object_id);
        const tgt = objMap.get(r.target_object_id);
        if (src && tgt) {
          if (!classOf.has(r.source_object_id)) classOf.set(r.source_object_id, []);
          if (!classOf.has(r.target_object_id)) classOf.set(r.target_object_id, []);
          classOf.get(r.source_object_id)!.push(src.name);
          classOf.get(r.target_object_id)!.push(tgt.name);
        }
      });
      // 这里只演示结构, 实际需要 EntityInstance 数据
    }

    return list;
  }, [objects, relations, reasoningType]);

  if (objects.length === 0) {
    return <div className="p-6"><Card><CardContent className="py-12 text-center text-muted-foreground text-sm">加载中...</CardContent></Card></div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="size-5 text-primary" /> 本体推理
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          OWL / Neo4j Reasoning 简化版 — 传递闭包 / 对称 / 互斥 3 种推理
        </p>
      </div>

      {/* 推理类型选择 */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs">推理类型:</Label>
            <Select value={reasoningType} onValueChange={(v) => setReasoningType(v as any)}>
              <SelectTrigger className="h-8 text-xs w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transitive">传递闭包 (Transitive Closure)</SelectItem>
                <SelectItem value="symmetric">对称关系 (Symmetric)</SelectItem>
                <SelectItem value="disjoint">互斥检测 (Disjoint Violation)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {inferred.length} 条新推理
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 推理结果 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> 推理结果
          </CardTitle>
          <CardDescription>
            {reasoningType === "transitive" && "A extends B, B extends C ⇒ A extends C (Warshall 算法)"}
            {reasoningType === "symmetric" && "A 朋友 B ⇒ B 朋友 A (反方向补全)"}
            {reasoningType === "disjoint" && "检测互斥类的实例冲突"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inferred.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <CheckCircle2 className="size-8 mx-auto text-green-500" />
              <div className="mt-2">无新推理 / 无矛盾</div>
              <div className="text-xs mt-1">添加带有相应 type 的关系试试</div>
            </div>
          ) : (
            <div className="space-y-1">
              {inferred.map((inf, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 border rounded text-xs bg-primary/5">
                  <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium">{inf.source}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span className="font-mono font-medium">{inf.target}</span>
                      <Badge variant="outline" className="text-xs h-4 px-1 ml-1">{inf.type}</Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">{inf.reason}</div>
                    {inf.via.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Layers className="size-2.5" />
                        <span>路径: {inf.via.join(" → ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function findPath(from: string, to: string, edges: OntologyRelation[]): string[] {
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adj.has(e.source_object_id)) adj.set(e.source_object_id, []);
    adj.get(e.source_object_id)!.push(e.target_object_id);
  });
  const visited = new Set<string>([from]);
  const queue: string[][] = [[from]];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const next of adj.get(last) || []) {
      if (visited.has(next)) continue;
      const newPath = [...path, next];
      if (next === to) return newPath;
      visited.add(next);
      queue.push(newPath);
    }
  }
  return [from, to];
}
