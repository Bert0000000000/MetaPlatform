import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Database, Wand2, ArrowRight, CheckCircle2, FileCode, Table2, Hash, Type, Calendar, ToggleLeft, ListChecks } from "lucide-react";
import { ontologyApi } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════════
 * ReverseEngineer: 数据库反向工程
 *
 * 输入: SQL DDL (CREATE TABLE) 或 JSON 表结构
 * 输出: 推断出的 Object + Property (8 要素的对象 + 属性)
 *
 * 类型映射:
 *   varchar/text  → text
 *   int/integer   → integer
 *   bigint/serial → auto_increment
 *   decimal/numeric → decimal
 *   boolean/tinyint → boolean
 *   date/datetime/timestamp → datetime
 *   json/jsonb    → json
 *   uuid          → uuid
 *   FK (REFERENCES other_table) → relation
 * ════════════════════════════════════════════════════════════════════ */

interface InferredField {
  column: string;
  type: string;
  ontologyType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  refTable?: string;
  nullable: boolean;
  defaultValue?: string;
}

interface InferredTable {
  tableName: string;
  objectLabel: string;
  fields: InferredField[];
  foreignKeys: { column: string; refTable: string }[];
}

const SQL_SAMPLE = `CREATE TABLE customer (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  level VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "order" (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customer(id),
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20),
  created_at TIMESTAMP
);

CREATE TABLE product (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2),
  stock INTEGER DEFAULT 0
);`;

function mapType(sqlType: string): string {
  const t = sqlType.toLowerCase();
  if (/^(varchar|char|text|character|citext)/.test(t)) return "text";
  if (/^(int|integer|smallint|tinyint|mediumint|bigint|serial|bigserial)/.test(t)) {
    if (/serial|bigint/.test(t)) return "auto_increment";
    return "integer";
  }
  if (/^(decimal|numeric|real|double|float|money)/.test(t)) return "decimal";
  if (/^(bool|boolean)/.test(t)) return "boolean";
  if (/^(date)/.test(t) && !/timestamp/.test(t)) return "date";
  if (/^(datetime|timestamp|time)/.test(t)) return "datetime";
  if (/^(json|jsonb)/.test(t)) return "json";
  if (/^(uuid|uniqueidentifier)/.test(t)) return "uuid";
  if (/^(enum)/.test(t)) return "select";
  return "text";
}

function parseSql(sql: string): InferredTable[] {
  const tables: InferredTable[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)["`\]]?\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(sql)) !== null) {
    const tableName = m[1];
    const body = m[2];
    const fields: InferredField[] = [];
    const foreignKeys: { column: string; refTable: string }[] = [];
    // 行解析
    const lines = body.split(/,\s*(?![^()]*\))/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^(PRIMARY|UNIQUE|FOREIGN|KEY|INDEX|CONSTRAINT|CHECK)/i.test(line)) {
        // FOREIGN KEY constraint
        const fk = /FOREIGN\s+KEY\s*\(["`[]?(\w+)["`\]]?\)\s*REFERENCES\s+["`[]?(\w+)["`\]]?/i.exec(line);
        if (fk) foreignKeys.push({ column: fk[1], refTable: fk[2] });
        continue;
      }
      // 列定义: name TYPE [NOT NULL] [DEFAULT x] [PRIMARY KEY] [REFERENCES table(col)]
      const colMatch = /^(["`[]?(\w+)["`\]]?)\s+(\w+(?:\s*\([^)]*\))?)\s*(.*)$/i.exec(line);
      if (!colMatch) continue;
      const colName = colMatch[2];
      const sqlType = colMatch[3];
      const rest = colMatch[4] || "";
      const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest);
      const nullable = !/NOT\s+NULL/i.test(rest);
      const defMatch = /DEFAULT\s+([^,]*)/i.exec(rest);
      const refMatch = /REFERENCES\s+["`[]?(\w+)["`\]]?/i.exec(rest);
      if (refMatch && !fk_in_list(foreignKeys, colName)) {
        foreignKeys.push({ column: colName, refTable: refMatch[1] });
      }
      fields.push({
        column: colName,
        type: sqlType,
        ontologyType: mapType(sqlType),
        isPrimaryKey,
        isForeignKey: !!refMatch,
        refTable: refMatch?.[1],
        nullable,
        defaultValue: defMatch?.[1]?.trim().replace(/^['"]|['"]$/g, ""),
      });
    }
    tables.push({
      tableName,
      objectLabel: tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_/g, " "),
      fields,
      foreignKeys,
    });
  }
  return tables;
}

function fk_in_list(arr: { column: string }[], col: string) {
  return arr.some((f) => f.column === col);
}

export function ReverseEngineer() {
  const [input, setInput] = useState(SQL_SAMPLE);
  const [tables, setTables] = useState<InferredTable[]>([]);
  const [inferred, setInferred] = useState(false);

  const handleAnalyze = () => {
    const result = parseSql(input);
    setTables(result);
    setInferred(true);
  };

  // 真 API: 创建 N 对象 + M 关系
  const [importing, setImporting] = useState(false);
  const handleImport = async () => {
    const totalRel = tables.reduce((s, t) => s + t.foreignKeys.length, 0);
    if (!confirm(`将创建 ${tables.length} 个对象和 ${totalRel} 条关系到本体引擎, 确认?`)) return;
    setImporting(true);
    let okObj = 0, okRel = 0, fail = 0;
    try {
      const nameToId: Record<string, string> = {};
      for (const t of tables) {
        try {
          const obj = await ontologyApi.createObject({
            name: t.tableName,
            label: t.objectLabel,
            description: `从 SQL DDL 导入 (${t.fields.length} 字段)`,
            status: "active",
          });
          nameToId[t.tableName] = (obj as any).id;
          for (const f of t.fields) {
            await ontologyApi.createProperty((obj as any).id, {
              name: f.column,
              label: f.column,
              type: f.ontologyType,
              required: f.isPrimaryKey || !f.nullable ? 1 : 0,
            }).catch(() => { fail++; });
          }
          okObj++;
        } catch { fail++; }
      }
      for (const t of tables) {
        for (const fk of t.foreignKeys) {
          const srcId = nameToId[t.tableName];
          const tgtId = nameToId[fk.refTable];
          if (!srcId || !tgtId) continue;
          try {
            await ontologyApi.createRelation({
              source_object_id: srcId,
              target_object_id: tgtId,
              type: "reference",
              label: `${fk.column} → ${fk.refTable}`,
            });
            okRel++;
          } catch { fail++; }
        }
      }
      alert(`✅ 导入完成!\n\n对象: ${okObj} 成功\n关系: ${okRel} 成功\n失败: ${fail}`);
    } catch (e: unknown) {
      alert("导入失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Database className="size-5 text-primary" /> 数据库反向工程
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          从已有 SQL DDL 推断 8 要素的对象 + 属性 + 关系
        </p>
      </div>

      {/* 输入 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. 粘贴 SQL DDL</CardTitle>
          <CardDescription>支持 PostgreSQL / MySQL / 通用 ANSI SQL</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-xs min-h-[200px]"
            placeholder="CREATE TABLE customer ( ... )"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleAnalyze}>
              <Wand2 className="size-3.5 mr-1" /> 推断
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInput("")}>清空</Button>
            <Button size="sm" variant="outline" onClick={() => setInput(SQL_SAMPLE)}>恢复示例</Button>
          </div>
        </CardContent>
      </Card>

      {/* 推断结果 */}
      {inferred && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">2. 推断结果</CardTitle>
                <CardDescription>
                  推断出 {tables.length} 个表 / {tables.reduce((s, t) => s + t.fields.length, 0)} 个字段 /{" "}
                  {tables.reduce((s, t) => s + t.foreignKeys.length, 0)} 个外键
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleImport} disabled={tables.length === 0 || importing}>
                <ArrowRight className="size-3.5 mr-1" /> {importing ? "导入中..." : "导入到本体引擎"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tables.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">未识别到表</div>
            ) : (
              <div className="space-y-3">
                {tables.map((t) => (
                  <div key={t.tableName} className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Table2 className="size-4 text-primary" />
                      <span className="font-medium text-sm">{t.objectLabel}</span>
                      <span className="text-xs text-muted-foreground font-mono">({t.tableName})</span>
                      <Badge variant="secondary" className="text-[10px]">{t.fields.length} 字段</Badge>
                      {t.foreignKeys.length > 0 && <Badge variant="default" className="text-[10px]">{t.foreignKeys.length} 关系</Badge>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {t.fields.map((f) => {
                        const ICON_MAP: Record<string, any> = {
                          text: Type, integer: Hash, decimal: Hash, currency: Hash, percent: Hash,
                          boolean: ToggleLeft, date: Calendar, datetime: Calendar, select: ListChecks,
                          json: FileCode, auto_increment: Hash, uuid: Hash,
                        };
                        const Icon = ICON_MAP[f.ontologyType] || Type;
                        return (
                          <div key={f.column} className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs">
                            <Icon className="size-3 text-muted-foreground" />
                            <span className="font-mono font-medium">{f.column}</span>
                            {f.isPrimaryKey && <Badge variant="default" className="text-[9px] h-3 px-1">PK</Badge>}
                            {f.isForeignKey && <Badge variant="secondary" className="text-[9px] h-3 px-1">FK → {f.refTable}</Badge>}
                            <span className="text-muted-foreground text-[10px] ml-auto">
                              {f.ontologyType}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
