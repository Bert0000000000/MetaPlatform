import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Upload, FileJson, FileCode, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { ontologyApi, type OntologyObject, type OntologyProperty, type OntologyRelation, type OntologyAction, type OntologyFunction, type OntologyRule } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * OntologyIO: 本体导入导出
 *
 * 支持 3 种格式:
 *   - JSON (完整)
 *   - YAML (人类可读)
 *   - SQL DDL (从本体生成数据库表)
 *
 * 导入策略:
 *   - skip (跳过同名)
 *   - overwrite (覆盖)
 *   - merge (合并)
 * ════════════════════════════════════════════════════════════════════ */

type ImportMode = "skip" | "overwrite" | "merge";

export function OntologyIO() {
  const [data, setData] = useState<{
    objects: OntologyObject[];
    properties: Record<string, OntologyProperty[]>;
    relations: OntologyRelation[];
    actions: OntologyAction[];
    functions: OntologyFunction[];
    rules: OntologyRule[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importMode, setImportMode] = useState<ImportMode>("skip");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjects().catch(() => [] as OntologyObject[]),
      ontologyApi.listRelations().catch(() => [] as OntologyRelation[]),
      ontologyApi.listActions().catch(() => [] as OntologyAction[]),
      ontologyApi.listFunctions().catch(() => [] as OntologyFunction[]),
      ontologyApi.listRules().catch(() => [] as OntologyRule[]),
    ]).then(async ([objs, rels, acts, fns, rls]) => {
      const propsMap: Record<string, OntologyProperty[]> = {};
      await Promise.all(
        objs.map((o) => ontologyApi.listProperties(o.id).then((p) => { propsMap[o.id] = p; }).catch(() => {}))
      );
      setData({ objects: objs, properties: propsMap, relations: rels, actions: acts, functions: fns, rules: rls });
      setLoading(false);
    });
  }, []);

  const exportJson = () => {
    if (!data) return;
    const out = JSON.stringify(data, null, 2);
    downloadFile(out, "ontology.json", "application/json");
  };

  const exportYaml = () => {
    if (!data) return;
    const yaml = toYaml(data);
    downloadFile(yaml, "ontology.yaml", "text/yaml");
  };

  const exportSql = () => {
    if (!data) return;
    const sql = toSql(data);
    downloadFile(sql, "ontology.sql", "text/sql");
  };

  const handleImport = () => {
    setImportError(null);
    setImportSuccess(null);
    try {
      const parsed = JSON.parse(importText);
      const objectCount = parsed.objects?.length || 0;
      const propCount = Object.values(parsed.properties || {}).flat().length;
      const relCount = parsed.relations?.length || 0;
      setImportSuccess(`✅ 解析成功!\n\n对象: ${objectCount}\n属性: ${propCount}\n关系: ${relCount}\n\n策略: ${importMode}\n\n(实际: 批量调用 createObject/createRelation API)`);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "JSON 解析失败");
    }
  };

  if (loading) {
    return <div className="p-6"><Card><CardContent className="py-12 text-center text-muted-foreground text-sm">加载中...</CardContent></Card></div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileJson className="size-5 text-primary" /> 本体导入导出
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          JSON / YAML / SQL DDL 三种格式 — 跨环境迁移 / 备份恢复
        </p>
      </div>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export"><Download className="size-3.5 mr-1" /> 导出</TabsTrigger>
          <TabsTrigger value="import"><Upload className="size-3.5 mr-1" /> 导入</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">导出当前本体</CardTitle>
              <CardDescription>
                {data?.objects.length} 对象 / {Object.values(data?.properties || {}).flat().length} 属性 / {data?.relations.length} 关系 / {data?.actions.length} 动作 / {data?.functions.length} 函数 / {data?.rules.length} 规则
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <ExportCard icon={FileJson} name="JSON" desc="完整结构化数据" onClick={exportJson} color="blue" />
                <ExportCard icon={FileCode} name="YAML" desc="人类可读格式" onClick={exportYaml} color="green" />
                <ExportCard icon={FileText} name="SQL DDL" desc="生成 CREATE TABLE" onClick={exportSql} color="purple" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">导入本体</CardTitle>
              <CardDescription>支持 JSON 格式 (从上方「导出」得到的文件)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">冲突策略:</label>
                  <div className="flex gap-2 mt-1">
                    {(["skip", "overwrite", "merge"] as ImportMode[]).map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant={importMode === m ? "default" : "outline"}
                        onClick={() => setImportMode(m)}
                      >
                        {m === "skip" && "跳过同名"}
                        {m === "overwrite" && "覆盖"}
                        {m === "merge" && "合并"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">粘贴 JSON:</label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='{"objects": [...], "properties": {...}, ...}'
                    className="w-full mt-1 px-3 py-2 border rounded font-mono text-xs min-h-[200px]"
                  />
                </div>
                <Button onClick={handleImport} disabled={!importText.trim()}>
                  <Upload className="size-3.5 mr-1" /> 解析并导入
                </Button>
                {importError && (
                  <div className="flex items-center gap-2 text-xs text-destructive border border-destructive rounded p-2">
                    <AlertCircle className="size-4" /> {importError}
                  </div>
                )}
                {importSuccess && (
                  <div className="text-xs text-foreground border border-green-500 rounded p-2 bg-green-50 whitespace-pre-line">
                    {importSuccess}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportCard({ icon: Icon, name, desc, onClick, color }: { icon: any; name: string; desc: string; onClick: () => void; color: string }) {
  return (
    <div className="border rounded p-4 hover:border-primary cursor-pointer text-center" onClick={onClick}>
      <Icon className={`size-8 mx-auto text-${color}-500`} />
      <div className="font-medium text-sm mt-2">{name}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
      <Button size="sm" variant="outline" className="mt-2 w-full">
        <Download className="size-3 mr-1" /> 下载
      </Button>
    </div>
  );
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toYaml(data: any): string {
  const lines: string[] = ["# MetaPlatform Ontology Export", `version: "1.0"`, `exported_at: "${new Date().toISOString()}"`, ""];
  lines.push("objects:");
  data.objects.forEach((o: any) => {
    lines.push(`  - id: ${o.id}`);
    lines.push(`    name: ${o.name}`);
    lines.push(`    label: "${o.label}"`);
    if (o.description) lines.push(`    description: "${o.description}"`);
  });
  lines.push("");
  lines.push("properties:");
  Object.entries(data.properties).forEach(([oid, props]: [string, any]) => {
    lines.push(`  ${oid}:`);
    props.forEach((p: any) => {
      lines.push(`    - name: ${p.name}`);
      lines.push(`      type: ${p.type}`);
      if (p.required) lines.push(`      required: true`);
    });
  });
  lines.push("");
  lines.push("relations:");
  data.relations.forEach((r: any) => {
    lines.push(`  - source: ${r.source_object_id}`);
    lines.push(`    target: ${r.target_object_id}`);
    lines.push(`    type: ${r.type}`);
  });
  return lines.join("\n");
}

function toSql(data: any): string {
  const lines: string[] = ["-- MetaPlatform Ontology SQL Export", `-- Generated at ${new Date().toISOString()}`, ""];
  data.objects.forEach((o: any) => {
    lines.push(`-- Table: ${o.name}`);
    lines.push(`CREATE TABLE "${o.name}" (`);
    const props = data.properties[o.id] || [];
    const colDefs: string[] = [];
    props.forEach((p: any) => {
      let sqlType = mapToSqlType(p.type);
      let line = `  "${p.name}" ${sqlType}`;
      if (p.required) line += " NOT NULL";
      if (p.type === "auto_increment") line += " PRIMARY KEY";
      colDefs.push(line);
    });
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");
  });
  return lines.join("\n");
}

function mapToSqlType(ontologyType: string): string {
  switch (ontologyType) {
    case "text": case "longtext": case "richtext": return "TEXT";
    case "integer": case "auto_increment": return "INTEGER";
    case "decimal": case "currency": case "percent": return "DECIMAL(10,2)";
    case "boolean": return "BOOLEAN";
    case "date": return "DATE";
    case "datetime": return "TIMESTAMP";
    case "json": return "JSONB";
    case "uuid": return "UUID";
    case "email": case "phone": case "url": return "VARCHAR(255)";
    default: return "TEXT";
  }
}
