import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldCheck, ShieldAlert, AlertCircle, AlertTriangle, Info, CheckCircle2,
  Box, Hash, GitBranch,
} from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyProperty, type OntologyRelation } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * OntologyLint: 本体规范检查
 *
 * 自动跑规则, 发现 8 要素内部质量问题:
 *   - 命名: snake_case / camelCase 一致性
 *   - 必填: 关键字段缺失
 *   - 关系: 循环引用 (A→B→A)
 *   - 孤儿: 对象无任何关系 / 对象无属性
 *   - 重复: 名字相同但大小写不同
 *
 * 等级: error / warning / info
 * ════════════════════════════════════════════════════════════════════ */

type Severity = "error" | "warning" | "info";

interface LintIssue {
  id: string;
  severity: Severity;
  rule: string;
  target: string; // 哪个对象/属性
  message: string;
  fix?: string;
}

const SNAKE_RE = /^[a-z][a-z0-9_]*$/;
const CAMEL_RE = /^[a-z][a-zA-Z0-9]*$/;

function isSnakeCase(s: string) { return SNAKE_RE.test(s); }
function isCamelCase(s: string) { return CAMEL_RE.test(s); }

export function OntologyLint() {
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [propsMap, setPropsMap] = useState<Record<string, OntologyProperty[]>>({});
  const [relations, setRelations] = useState<OntologyRelation[]>([]);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjects().catch(() => [] as OntologyObject[]),
      ontologyApi.listRelations().catch(() => [] as OntologyRelation[]),
    ]).then(([objs, rels]) => {
      setObjects(objs);
      setRelations(rels);
    });
  }, []);

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

  // 跑 lint
  const issues = useMemo<LintIssue[]>(() => {
    const list: LintIssue[] = [];

    // 规则 1: 对象命名一致性 (snake_case)
    objects.forEach((o) => {
      if (!isSnakeCase(o.name)) {
        list.push({
          id: `obj-name-${o.id}`,
          severity: "warning",
          rule: "snake_case-object-name",
          target: o.name,
          message: `对象名 "${o.name}" 不符合 snake_case 规范`,
          fix: `建议改为: ${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        });
      }
    });

    // 规则 2: 重复对象名 (大小写不敏感)
    const nameMap = new Map<string, OntologyObject[]>();
    objects.forEach((o) => {
      const k = o.name.toLowerCase();
      const arr = nameMap.get(k) || [];
      arr.push(o);
      nameMap.set(k, arr);
    });
    nameMap.forEach((arr, k) => {
      if (arr.length > 1) {
        list.push({
          id: `obj-dup-${k}`,
          severity: "error",
          rule: "duplicate-object-name",
          target: arr.map((o) => o.name).join(", "),
          message: `对象名重复 (大小写不敏感): ${arr.map((o) => o.name).join(", ")}`,
          fix: "合并重复对象, 保留一个",
        });
      }
    });

    // 规则 3: 孤儿对象 (无任何关系 + 无任何属性)
    const relTouched = new Set<string>();
    relations.forEach((r) => {
      relTouched.add(r.source_object_id);
      relTouched.add(r.target_object_id);
    });
    objects.forEach((o) => {
      const props = propsMap[o.id] || [];
      if (props.length === 0 && !relTouched.has(o.id)) {
        list.push({
          id: `obj-orphan-${o.id}`,
          severity: "warning",
          rule: "orphan-object",
          target: o.name,
          message: `对象 "${o.name}" 既无字段也无关系 (孤儿对象)`,
          fix: "添加至少 1 个字段或 1 条关系",
        });
      }
    });

    // 规则 4: 关系循环
    const graph = new Map<string, Set<string>>();
    relations.forEach((r) => {
      if (!graph.has(r.source_object_id)) graph.set(r.source_object_id, new Set());
      graph.get(r.source_object_id)!.add(r.target_object_id);
    });
    const visited = new Set<string>();
    const cycles: string[][] = [];
    const dfs = (node: string, path: string[]) => {
      if (path.includes(node)) {
        const idx = path.indexOf(node);
        cycles.push([...path.slice(idx), node]);
        return;
      }
      path.push(node);
      (graph.get(node) || new Set()).forEach((n) => {
        if (!visited.has(n + path.join())) dfs(n, [...path]);
      });
    };
    graph.forEach((_, k) => dfs(k, []));
    cycles.forEach((cycle, i) => {
      const names = cycle.map((id) => objects.find((o) => o.id === id)?.name || id);
      list.push({
        id: `rel-cycle-${i}`,
        severity: "warning",
        rule: "relation-cycle",
        target: names.join(" → "),
        message: `关系循环: ${names.join(" → ")}`,
        fix: "考虑拆解或定义方向性",
      });
    });

    // 规则 5: 属性命名一致性
    objects.forEach((o) => {
      const props = propsMap[o.id] || [];
      props.forEach((p) => {
        if (!isSnakeCase(p.name)) {
          list.push({
            id: `prop-name-${p.id}`,
            severity: "warning",
            rule: "snake_case-property-name",
            target: `${o.name}.${p.name}`,
            message: `属性名 "${p.name}" 不符合 snake_case`,
            fix: `建议改为: ${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          });
        }
      });
    });

    // 规则 6: 缺主键 (id 字段)
    objects.forEach((o) => {
      const props = propsMap[o.id] || [];
      const hasId = props.some((p) => ["id", `${o.name}_id`, "uuid"].includes(p.name.toLowerCase()));
      if (!hasId && props.length > 0) {
        list.push({
          id: `obj-noid-${o.id}`,
          severity: "info",
          rule: "missing-id-field",
          target: o.name,
          message: `对象 "${o.name}" 缺少主键字段 (id / uuid / ${o.name}_id)`,
          fix: `添加 auto_increment 或 uuid 字段`,
        });
      }
    });

    // 规则 7: 缺审计字段 (created_at / updated_at)
    objects.forEach((o) => {
      const props = propsMap[o.id] || [];
      const hasCreated = props.some((p) => /created(_at)?$/.test(p.name.toLowerCase()));
      if (!hasCreated && props.length > 0) {
        list.push({
          id: `obj-noaudit-${o.id}`,
          severity: "info",
          rule: "missing-audit-field",
          target: o.name,
          message: `对象 "${o.name}" 缺审计字段 (created_at)`,
          fix: "添加 created_at / updated_at 字段",
        });
      }
    });

    return list;
  }, [objects, propsMap, relations]);

  // 统计
  const stats = useMemo(() => {
    return {
      error: issues.filter((i) => i.severity === "error").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      total: issues.length,
    };
  }, [issues]);

  const score = Math.max(0, 100 - stats.error * 10 - stats.warning * 3 - stats.info);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> 本体规范检查
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          自动检查 8 要素内部的命名一致性、关系循环、孤儿对象、缺审计字段等
        </p>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground">质量分</div>
            <div className={`text-3xl font-bold font-mono ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600"}`}>
              {score}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="size-3 text-red-500" /> 错误
            </div>
            <div className="text-2xl font-bold font-mono text-red-600">{stats.error}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="size-3 text-yellow-500" /> 警告
            </div>
            <div className="text-2xl font-bold font-mono text-yellow-600">{stats.warning}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="size-3 text-blue-500" /> 提示
            </div>
            <div className="text-2xl font-bold font-mono text-blue-600">{stats.info}</div>
          </CardContent>
        </Card>
      </div>

      {/* 详情 */}
      <Card>
        <CardContent className="pt-3">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">全部 ({issues.length})</TabsTrigger>
              <TabsTrigger value="error">错误 ({stats.error})</TabsTrigger>
              <TabsTrigger value="warning">警告 ({stats.warning})</TabsTrigger>
              <TabsTrigger value="info">提示 ({stats.info})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-3"><IssueList issues={issues} /></TabsContent>
            <TabsContent value="error" className="mt-3"><IssueList issues={issues.filter((i) => i.severity === "error")} /></TabsContent>
            <TabsContent value="warning" className="mt-3"><IssueList issues={issues.filter((i) => i.severity === "warning")} /></TabsContent>
            <TabsContent value="info" className="mt-3"><IssueList issues={issues.filter((i) => i.severity === "info")} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function IssueList({ issues }: { issues: LintIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="size-8 mx-auto text-green-500" />
        <div className="mt-2">🎉 没有发现问题</div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {issues.map((i) => (
        <div
          key={i.id}
          className={`flex items-start gap-2 px-3 py-2 border rounded text-xs ${
            i.severity === "error" ? "border-red-300 bg-red-50" :
            i.severity === "warning" ? "border-yellow-300 bg-yellow-50" :
            "border-blue-300 bg-blue-50"
          }`}
        >
          {i.severity === "error" && <AlertCircle className="size-3.5 text-red-600 shrink-0 mt-0.5" />}
          {i.severity === "warning" && <AlertTriangle className="size-3.5 text-yellow-600 shrink-0 mt-0.5" />}
          {i.severity === "info" && <Info className="size-3.5 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{i.target}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{i.rule}</Badge>
            </div>
            <div className="text-muted-foreground mt-0.5">{i.message}</div>
            {i.fix && <div className="text-primary mt-0.5">💡 {i.fix}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
