import { useState, useEffect, useMemo } from "react";
import { ontologyApi, type OntologyAction, type OntologyFunction, type OntologyRule, type OntologyObject, type OntologyProperty, type OntologyRelation } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Box, Hash, Link2, Zap, Calculator, Shield, Settings, Server, Plus, Sparkles, Link, User, Package, Tag, Users, FileText, Receipt, Eye, Edit, Trash2, Search, ShieldCheck, GitMerge, AlertOctagon, Activity } from "lucide-react";

const element7of8 = [
  { key: "1-objects", title: "对象（Objects）", icon: Box, desc: "业务对象的定义与建模", tag: "O" },
  { key: "2-properties", title: "属性（Properties）", icon: Hash, desc: "25 字段类型", tag: "P" },
  { key: "3-links", title: "关系（Links）", icon: Link2, desc: "对象间的关系建模", tag: "L" },
  { key: "4-actions", title: "动作（Actions）", icon: Zap, desc: "CRUD 动作 + 自定义动作", tag: "A" },
  { key: "5-functions", title: "函数（Functions）", icon: Calculator, desc: "业务函数 + AI 规则函数", tag: "F" },
  { key: "6-rules", title: "流程规则（Rules）", icon: Settings, desc: "条件触发 + 服务编排", tag: "R" },
  { key: "7-security", title: "安全（Security）", icon: Shield, desc: "数据/字段/动作级权限", tag: "S" },
  { key: "8-governance", title: "治理与发布（G&R）", icon: Server, desc: "导入导出 + 多环境发布", tag: "G" },
];

const fieldTypes = [
  "短文本", "长文本", "富文本", "数值", "金额", "日期", "时间",
  "自动编号", "图片", "附件", "人员", "部门", "地址", "评分",
  "链接", "枚举", "布尔", "JSON", "数组", "关联", "引用",
  "计算", "公式", "加密", "敏感数据",
];

export function OntologyElement({ elementKey }: { elementKey: string }) {
  const element = element7of8.find((e) => e.key === elementKey);
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [properties, setProperties] = useState<Record<string, OntologyProperty[]>>({});
  const [relations, setRelations] = useState<OntologyRelation[]>([]);

  useEffect(() => {
    if (elementKey === "1-objects") {
      ontologyApi.listObjects().then(setObjects).catch(() => {});
    } else if (elementKey === "2-properties") {
      ontologyApi.listObjects().then((objs) => {
        Promise.all(objs.map((o) => ontologyApi.listProperties(o.id).then((props) => ({ objectId: o.id, props }))))
          .then((results) => {
            const map: Record<string, OntologyProperty[]> = {};
            results.forEach((r) => { map[r.objectId] = r.props; });
            setProperties(map);
          }).catch(() => {});
      }).catch(() => {});
    } else if (elementKey === "3-links") {
      ontologyApi.listRelations().then(setRelations).catch(() => {});
    }
  }, [elementKey]);

  if (!element) return null;
  const Icon = element.icon;

  const iconMap: Record<string, React.ElementType> = {
    Customer: User, Order: Package, Product: Tag, Employee: Users,
    Contract: FileText, Invoice: Receipt,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={element.title}
        description={element.desc}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Sparkles className="size-4" /> AI 辅助
            </Button>
            <Button className="gap-2">
              <Plus className="size-4" /> 新建
            </Button>
          </div>
        }
      />

      {elementKey === "1-objects" && (
        <ObjectsView
          objects={objects}
          onRescan={() => ontologyApi.listObjects().then(setObjects).catch(() => {})}
        />
      )}

      {elementKey === "2-properties" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">25 字段类型</CardTitle>
            <CardDescription>所有对象共用的字段类型</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {fieldTypes.map((f) => (
                <div key={f} className="border rounded p-2 text-center text-sm">
                  {f}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "3-links" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">关系列表</CardTitle>
            <CardDescription>{relations.length} 条关系定义</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relations.length === 0 && (
                <div className="col-span-full text-center py-4 text-muted-foreground">暂无关系数据</div>
              )}
              {relations.map((r) => (
                <div key={r.id} className="border rounded p-4 text-center">
                  <div className="text-2xl mb-2"><Link className="size-6 mx-auto" /></div>
                  <div className="font-medium">{r.label || r.type}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.description || `${r.source_object_id} -> ${r.target_object_id}`}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "4-actions" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">动作类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {["新增", "查询", "更新", "删除", "导入", "导出", "批量", "自定义"].map((a) => (
                <div key={a} className="border rounded p-3 text-center">
                  <div className="font-medium text-sm">{a}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "5-functions" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">函数类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded p-4">
                <div className="font-medium">业务函数</div>
                <p className="text-xs text-muted-foreground mt-1">预置业务逻辑（订单金额计算、库存扣减）</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">业务规则函数</div>
                <p className="text-xs text-muted-foreground mt-1">Drools 规则引擎 + DMN 决策表</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">服务编排</div>
                <p className="text-xs text-muted-foreground mt-1">组合多个服务形成复合操作</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">AI 规则函数</div>
                <p className="text-xs text-muted-foreground mt-1">LLM 驱动的智能决策函数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "6-rules" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">规则类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {["业务规则", "服务编排", "决策表"].map((r) => (
                <div key={r} className="border rounded p-4 text-center">
                  <div className="font-medium">{r}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "7-security" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">安全配置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded p-4">
                <div className="font-medium">数据权限（行级）</div>
                <p className="text-xs text-muted-foreground mt-1">按用户/部门/角色控制数据可见性</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">字段级权限</div>
                <p className="text-xs text-muted-foreground mt-1">敏感字段脱敏 + 可见性控制</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">动作权限</div>
                <p className="text-xs text-muted-foreground mt-1">控制用户可执行的动作</p>
              </div>
              <div className="border rounded p-4">
                <div className="font-medium">ABAC 策略</div>
                <p className="text-xs text-muted-foreground mt-1">基于属性的访问控制</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {elementKey === "8-governance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">治理与发布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["本体地图", "导入导出", "多环境发布", "运行日志", "版本管理"].map((g) => (
                <div key={g} className="border rounded p-3">
                  <div className="font-medium text-sm">{g}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Standalone ontology element pages for route-level usage ── */

// Properties loaded from ontologyApi.listProperties() per object
interface PropertyRow {
  id: string;
  name: string;
  type: string;
  object: string;
  required: boolean;
  unique: boolean;
  desc: string;
}

export function OntologyProperties() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
    const filtered = properties.filter((p) => p.name.includes(search) || p.object.includes(search));

    useEffect(() => {
      ontologyApi.listObjects().then((objs) => {
        Promise.all(objs.map((o) =>
          ontologyApi.listProperties(o.id).then((props) =>
            props.map((p) => ({
              id: p.id,
              name: p.name || p.label,
              type: p.type,
              object: o.name,
              required: !!p.required,
              unique: !!p.unique_field,
              desc: p.description || "",
            }))
          )
        )).then((allProps) => {
          setProperties(allProps.flat());
          setLoading(false);
        }).catch(() => setLoading(false));
      }).catch(() => setLoading(false));
    }, []);

    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="属性管理"
          description="管理所有对象的属性定义（25 种字段类型）"
          action={<Button className="gap-2"><Plus className="size-4" /> 新建属性</Button>}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Hash className="size-4" /> 属性列表</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索属性..." className="border rounded pl-7 pr-2 py-1 text-sm w-40" />
              </div>
              <Button variant="outline" size="sm"><Sparkles className="size-3 mr-1" />AI 推荐</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <div className="text-center py-8 text-muted-foreground">加载中...</div>}
            {!loading && (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>属性名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>所属对象</TableHead>
                <TableHead>必填</TableHead>
                <TableHead>唯一</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{p.object}</Badge></TableCell>
                  <TableCell>{p.required ? <Badge>必填</Badge> : <Badge variant="outline">可选</Badge>}</TableCell>
                  <TableCell>{p.unique ? <Badge variant="default">唯一</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive"><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

// Relations loaded from ontologyApi.listRelations()
export function OntologyLinks() {
  const [links, setLinks] = useState<OntologyRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);

  useEffect(() => {
    ontologyApi.listRelations().then((data) => {
      setLinks(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const suggestedRels = [
    { from: "Customer", to: "Invoice", type: "1:N", confidence: 94, reason: "客户-发票 一对多关系，基于历史数据推断" },
    { from: "Product", to: "Contract", type: "N:N", confidence: 87, reason: "产品-合同 多对多关系，基于业务模式推断" },
    { from: "Employee", to: "Contract", type: "1:N", confidence: 91, reason: "员工-合同 一对多关系，基于审批记录推断" },
  ];
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="关系管理"
        description="定义对象间的关系（1:1 / 1:N / N:N）"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setAiSuggestOpen(true)}>
              <Sparkles className="size-4" /> AI 推断关系
            </Button>
            <Button className="gap-2"><Plus className="size-4" /> 新建关系</Button>
          </div>
        }
      />
      {/* AI Suggest Dialog */}
      {aiSuggestOpen && (
        <Card className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> AI 推断的关系
              </CardTitle>
              <CardDescription>基于数据模式和业务规则推断的潜在关系</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAiSuggestOpen(false)}>关闭</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestedRels.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Sparkles className="size-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{r.from}</Badge>
                      <span className="text-muted-foreground">--{'>'}</span>
                      <Badge variant="secondary">{r.to}</Badge>
                      <Badge variant="outline">{r.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">置信度 {r.confidence}%</Badge>
                  <Button size="sm">采纳</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="size-4" /> 关系列表</CardTitle>
          <CardDescription>{links.length} 条关系定义</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>关系名</TableHead>
                <TableHead>源对象</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>目标对象</TableHead>
                <TableHead>说明</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              )}
              {!loading && links.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无关系数据</TableCell></TableRow>
              )}
              {!loading && links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.label || l.type}</TableCell>
                  <TableCell><Badge variant="secondary">{l.source_object_id}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{l.target_object_id}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.description || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const FALLBACK_ACTIONS: OntologyAction[] = [
  { id: "1", name: "创建订单", type: "create", trigger_type: "manual", object_id: "obj-order", config: '{"endpoint": "POST /api/orders"}', status: "active" },
  { id: "2", name: "查询客户列表", type: "query", trigger_type: "manual", object_id: "obj-customer", config: '{"endpoint": "GET /api/customers"}', status: "active" },
  { id: "3", name: "更新合同状态", type: "update", trigger_type: "manual", object_id: "obj-contract", config: '{"endpoint": "PATCH /api/contracts/:id"}', status: "active" },
  { id: "4", name: "删除草稿发票", type: "delete", trigger_type: "manual", object_id: "obj-invoice", config: '{"endpoint": "DELETE /api/invoices/:id"}', status: "active" },
  { id: "5", name: "批量导入客户", type: "import", trigger_type: "manual", object_id: "obj-customer", config: '{"endpoint": "POST /api/customers/import"}', status: "active" },
  { id: "6", name: "导出订单报表", type: "export", trigger_type: "manual", object_id: "obj-order", config: '{"endpoint": "GET /api/orders/export"}', status: "active" },
  { id: "7", name: "自定义-发送通知", type: "custom", trigger_type: "event", config: '{"endpoint": "POST /api/actions/notify"}', status: "draft" },
];

export function OntologyActions() {
  const [actions, setActions] = useState<OntologyAction[]>(FALLBACK_ACTIONS);

  useEffect(() => {
    ontologyApi.listActions().then(setActions).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="动作管理"
        description="CRUD 动作 + 自定义动作配置"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建动作</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="size-4" /> 动作列表</CardTitle>
          <CardDescription>{actions.length} 个动作</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>动作名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead>API 端点</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => {
                let endpoint = "-";
                try { endpoint = a.config ? JSON.parse(a.config).endpoint || "-" : "-"; } catch {}
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                    <TableCell>{a.object_id ? <Badge variant="secondary">{a.object_id}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{endpoint}</TableCell>
                    <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status === "active" ? "已启用" : "草稿"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const FALLBACK_FUNCTIONS: OntologyFunction[] = [
  { id: "1", name: "计算订单总额", type: "business", object_id: "obj-order", expression: "sum(items[].price * items[].qty)", description: "计算订单总额", status: "active" },
  { id: "2", name: "库存扣减", type: "business", object_id: "obj-product", expression: "product.stock -= order.quantity", description: "下单后扣减库存", status: "active" },
  { id: "3", name: "审批规则-金额阈值", type: "rule", expression: "IF amount > 10000 THEN require_manager_approval", description: "金额超过1万需主管审批", status: "active" },
  { id: "4", name: "自动生成编号", type: "business", expression: "PREFIX + SEQ(6)", description: "自动生成带前缀的序列号", status: "active" },
  { id: "5", name: "AI 风险评估", type: "ai", object_id: "obj-contract", expression: "llm.risk_score(contract_text)", description: "使用 LLM 评估合同风险", status: "active" },
  { id: "6", name: "服务编排-下单流程", type: "orchestration", expression: "validate -> check_stock -> create_order -> notify", description: "组合多个服务形成下单流程", status: "active" },
];

export function OntologyFunctions() {
  const [functions, setFunctions] = useState<OntologyFunction[]>(FALLBACK_FUNCTIONS);

  useEffect(() => {
    ontologyApi.listFunctions().then(setFunctions).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="函数管理"
        description="业务函数 + AI 规则函数 + 服务编排"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建函数</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="size-4" /> 函数列表</CardTitle>
          <CardDescription>{functions.length} 个函数</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>函数名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>表达式</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {functions.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">{f.expression || "-"}</TableCell>
                  <TableCell>{f.object_id ? <Badge variant="secondary">{f.object_id}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                  <TableCell><Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status === "active" ? "已启用" : "草稿"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const FALLBACK_RULES: OntologyRule[] = [
  { id: "1", name: "订单金额校验", type: "validation", object_id: "obj-order", condition_expr: "amount > 0", action: "reject", status: "active" },
  { id: "2", name: "审批自动通过", type: "automation", condition_expr: "amount < 1000", action: "auto_approve", status: "active" },
  { id: "3", name: "库存补货触发", type: "automation", object_id: "obj-product", condition_expr: "stock < safety_stock", action: "trigger_restock", status: "active" },
  { id: "4", name: "合同到期通知", type: "orchestration", condition_expr: "expires_in_30d", action: "send_notification", status: "paused" },
  { id: "5", name: "DMN-客户分级", type: "decision", object_id: "obj-customer", condition_expr: "DMN_TABLE(customer_score)", action: "set_level", status: "active" },
];

export function OntologyRules() {
  const [rules, setRules] = useState<OntologyRule[]>(FALLBACK_RULES);

  useEffect(() => {
    ontologyApi.listRules().then(setRules).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="流程规则"
        description="条件触发 + 服务编排 + DMN 决策表"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建规则</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Settings className="size-4" /> 规则列表</CardTitle>
          <CardDescription>{rules.length} 条规则</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>条件</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.condition_expr || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.action || "-"}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status === "active" ? "已启用" : "已暂停"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// TODO: needs backend API - security rules listing endpoint does not exist yet
const MOCK_SECURITY_RULES = [
  { id: 1, name: "客户数据-行级权限", level: "数据级", object: "Customer", rule: "仅查看本部门客户", roles: "业务人员" },
  { id: 2, name: "订单金额-字段脱敏", level: "字段级", object: "Order", rule: "金额字段脱敏显示", roles: "非财务" },
  { id: 3, name: "合同删除-动作控制", level: "动作级", object: "Contract", rule: "禁止删除已审批合同", roles: "所有角色" },
  { id: 4, name: "ABAC-跨部门限制", level: "ABAC", object: "-", rule: "部门!=财务 AND 金额>10万 → 禁止", roles: "全部" },
];

/* ── Sensitive Data Detection (F7.7.4) ── */
const SENSITIVE_PATTERNS = [
  { id: 1, name: "身份证号", pattern: "^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])\\d{3}[\\dXx]$", type: "PII", action: "脱敏", fields: 3 },
  { id: 2, name: "手机号", pattern: "^1[3-9]\\d{9}$", type: "PII", action: "脱敏", fields: 5 },
  { id: 3, name: "银行卡号", pattern: "^\\d{16,19}$", type: "PCI", action: "加密", fields: 2 },
  { id: 4, name: "病历号", pattern: "^MR\\d{8}$", type: "PHI", action: "脱敏", fields: 1 },
  { id: 5, name: "邮箱地址", pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$", type: "PII", action: "脱敏", fields: 4 },
];

export function OntologySecurity() {
  const [sensitiveDialogOpen, setSensitiveDialogOpen] = useState(false);
  const [patterns, setPatterns] = useState(SENSITIVE_PATTERNS);
  const [securityRules, setSecurityRules] = useState(MOCK_SECURITY_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ontologyApi.listSecurityRules()
      .then((data) => { if (data && data.length > 0) setSecurityRules(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="安全配置"
        description="数据/字段/动作级权限 + ABAC 策略"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSensitiveDialogOpen(true)}>
              <Shield className="size-4" /> 敏感数据识别
            </Button>
            <Button className="gap-2"><Plus className="size-4" /> 新建策略</Button>
          </div>
        }
      />
      {/* Sensitive Data Panel */}
      {sensitiveDialogOpen && (
        <Card className="border-orange-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="size-4 text-orange-500" /> 敏感数据识别规则
              </CardTitle>
              <CardDescription>PII / PHI / PCI 模式自动检测与脱敏</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSensitiveDialogOpen(false)}>关闭</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>正则模式</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>关联字段</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{p.pattern}</TableCell>
                    <TableCell><Badge variant={p.type === "PCI" ? "destructive" : p.type === "PHI" ? "outline" : "secondary"}>{p.type}</Badge></TableCell>
                    <TableCell>{p.action}</TableCell>
                    <TableCell>{p.fields}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "数据权限", count: 12, icon: Shield },
          { label: "字段权限", count: 8, icon: Hash },
          { label: "动作权限", count: 24, icon: Zap },
          { label: "ABAC 策略", count: 6, icon: Settings },
        ].map((s) => (
          <Card key={s.label} className="cursor-pointer hover:border-primary">
            <CardContent className="p-4 text-center">
              <s.icon className="size-8 mx-auto text-primary mb-2" />
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xl font-semibold mt-1">{s.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="size-4" /> 安全策略列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>策略名</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>对象</TableHead>
                <TableHead>规则</TableHead>
                <TableHead>适用角色</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">加载中...</TableCell></TableRow>
              )}
              {securityRules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.level}</Badge></TableCell>
                  <TableCell>{r.object !== "-" ? <Badge variant="secondary">{r.object}</Badge> : <span className="text-muted-foreground text-xs">全局</span>}</TableCell>
                  <TableCell className="text-xs">{r.rule}</TableCell>
                  <TableCell className="text-xs">{r.roles}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Auto Number Rules (F7.6.4) ── */
// TODO: needs backend API - auto number rules listing endpoint does not exist yet
const AUTO_NUMBER_RULES = [
  { id: 1, object: "Order", prefix: "ORD-", suffix: "", seqLength: 6, reset: "每年", next: "ORD-000042" },
  { id: 2, object: "Invoice", prefix: "INV-", suffix: "", seqLength: 8, reset: "每月", next: "INV-00001234" },
  { id: 3, object: "Contract", prefix: "CT-", suffix: "-SH", seqLength: 5, reset: "不重置", next: "CT-00186-SH" },
];

export function AutoNumberRules() {
  const [rules, setRules] = useState(AUTO_NUMBER_RULES);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ object: "", prefix: "", suffix: "", seqLength: "6", reset: "每年" });

  useEffect(() => {
    ontologyApi.listAutoNumbers()
      .then((data) => { if (data && data.length > 0) setRules(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="size-4" /> 自动编号规则
          </CardTitle>
          <CardDescription>配置对象的自动编号前缀、后缀和序列规则</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-3 mr-1" /> 新建规则</Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading && <div className="text-center py-4 text-muted-foreground">加载中...</div>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>对象</TableHead>
              <TableHead>前缀</TableHead>
              <TableHead>后缀</TableHead>
              <TableHead>序列长度</TableHead>
              <TableHead>重置策略</TableHead>
              <TableHead>下一个编号</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.object}</TableCell>
                <TableCell className="font-mono text-xs">{r.prefix || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{r.suffix || "-"}</TableCell>
                <TableCell>{r.seqLength}</TableCell>
                <TableCell><Badge variant="outline">{r.reset}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.next}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建自动编号规则</DialogTitle>
            <DialogDescription>配置对象自动编号的前缀、后缀和序列</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>对象</Label><Input value={form.object} onChange={(e) => setForm((f) => ({ ...f, object: e.target.value }))} placeholder="e.g. Order" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>前缀</Label><Input value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} placeholder="e.g. ORD-" /></div>
              <div className="space-y-2"><Label>后缀</Label><Input value={form.suffix} onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))} placeholder="可选" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>序列长度</Label><Input type="number" value={form.seqLength} onChange={(e) => setForm((f) => ({ ...f, seqLength: e.target.value }))} /></div>
              <div className="space-y-2"><Label>重置策略</Label>
                <Select value={form.reset} onValueChange={(v) => setForm((f) => ({ ...f, reset: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="不重置">不重置</SelectItem>
                    <SelectItem value="每年">每年</SelectItem>
                    <SelectItem value="每月">每月</SelectItem>
                    <SelectItem value="每天">每天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={() => { setDialogOpen(false); }}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// TODO: needs backend API - governance data does not have a dedicated endpoint yet
export function OntologyGovernance() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="治理与发布"
        description="本体地图、导入导出、多环境发布与版本管理"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><FileText className="size-4" /> 导出</Button>
            <Button className="gap-2"><Plus className="size-4" /> 发布版本</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "对象总数", value: 6, icon: Box },
          { label: "属性总数", value: 124, icon: Hash },
          { label: "关系总数", value: 18, icon: Link2 },
          { label: "当前版本", value: "v3.2", icon: Server },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold mt-1 flex items-center gap-2"><s.icon className="size-4" /> {s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">发布历史</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { ver: "v3.2", env: "生产", time: "2 天前", author: "张伟", status: "active" },
                { ver: "v3.1", env: "生产", time: "1 周前", author: "李娜", status: "archived" },
                { ver: "v3.0", env: "测试", time: "2 周前", author: "王强", status: "archived" },
              ].map((v) => (
                <div key={v.ver} className="flex items-center gap-3 p-2 border rounded">
                  <Badge variant={v.status === "active" ? "default" : "outline"} className="font-mono">{v.ver}</Badge>
                  <Badge variant="secondary">{v.env}</Badge>
                  <span className="flex-1 text-xs text-muted-foreground">{v.author} / {v.time}</span>
                  <Button variant="ghost" size="sm">查看</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">环境管理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { env: "开发环境", version: "v3.3-dev", status: "active", sync: "实时" },
                { env: "测试环境", version: "v3.2", status: "active", sync: "每天" },
                { env: "生产环境", version: "v3.2", status: "active", sync: "手动" },
              ].map((e) => (
                <div key={e.env} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium text-sm">{e.env}</div>
                    <div className="text-xs text-muted-foreground">当前版本: {e.version} / 同步: {e.sync}</div>
                  </div>
                  <Badge variant="default">运行中</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═════════════ Objects 去重视图 (ObjectType) ═════════════
 *
 * 后端 /api/ontology/objects 经常返回 100+ 个 ObjectType, 里面
 * 客户/销售机会等业务对象因多次建模/NL 建模产生大量重复。
 *
 * 业务策略:
 *   1. 实时扫描, 自动给重复 ObjectType 加红框 + "重复" 徽章
 *   2. 顶部工具栏: 总数 / 重复数 / 去重按钮
 *   3. 点「去重校验」打开 Dialog: 列出全部重复组, 用户选 target
 *   4. 合并时调后端 deleteObjectType 删从记录, 调 listObjects 重新拉
 *
 * 去重算法 (3 个信号, 任一命中即归并):
 *   1. name 归一化精确相同 (强, code-like 标识符)
 *   2. label 归一化后双向包含 (中, 中文 UI 标签)
 *   3. name 一个是另一个前缀 (弱, e.g. Customer ⊂ CustomerVip)
 */
function normalizeNameDedup(s: string): string {
  return s
    .replace(/[_-]/g, "")                // 下划线/连字符
    .replace(/\s+/g, "")                  // 空格
    .replace(/[()（）【】\[\]·,，.。]/g, "")  // 标点
    .toLowerCase();
}

function findObjectDuplicates(objects: OntologyObject[]): { key: string; reason: string; members: OntologyObject[] }[] {
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

      // 信号 1: name 精确相同
      if (na && nb && na === nb) {
        group.push(b);
        reasons.add(`name 相同: "${a.name}" = "${b.name}"`);
        return;
      }
      // 信号 2: label 双向包含
      if (la && lb && (la.includes(lb) || lb.includes(la))) {
        group.push(b);
        reasons.add(`label 相似: "${a.label}" ≈ "${b.label}"`);
        return;
      }
      // 信号 3: name 前缀包含 (排除完全相同)
      if (na && nb && na !== nb && (na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 4) {
        group.push(b);
        reasons.add(`name 包含: "${a.name}" ⊃ "${b.name}"`);
      }
    });

    if (group.length > 1) {
      group.forEach((g) => used.add(g.id));
      groups.push({
        key: `obj-grp-${a.id}`,
        reason: [...reasons].join(" / "),
        members: group,
      });
    }
  });

  return groups;
}

function ObjectsView({
  objects,
  onRescan,
}: {
  objects: OntologyObject[];
  onRescan: () => void;
}) {
  const [dedupOpen, setDedupOpen] = useState(false);
  const [targetPicks, setTargetPicks] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  // 本地 icon map (与 OntologyElement 内一致)
  const iconMap: Record<string, React.ElementType> = {
    Customer: User, Order: Package, Product: Tag, Employee: Users,
    Contract: FileText, Invoice: Receipt,
  };

  const groups = useMemo(() => findObjectDuplicates(objects), [objects]);
  const dupMemberIds = useMemo(() => {
    const s = new Set<string>();
    groups.forEach((g) => g.members.forEach((m) => s.add(m.id)));
    return s;
  }, [groups]);

  // 找重复组里"看起来最权威"的当默认 target:
  //   - properties_count 最多的 (有更多字段, 是后续用的那个)
  //   - 多个并列: 取 status 为 active 的
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
    onRescan();
    if (allFailed.length > 0) {
      alert(`合并完成: 成功 ${totalMerged} 条, 失败 ${allFailed.length} 条\n\n${allFailed.join("\n")}`);
    } else {
      alert(`✓ 合并完成: ${totalMerged} 条重复已删除`);
    }
  }

  return (
    <div className="space-y-3">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">对象总数</span>
          <span className="font-mono font-semibold text-lg tabular-nums">{objects.length}</span>
          {groups.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-600 dark:text-amber-400">重复组</span>
              <span className="font-mono font-semibold text-lg tabular-nums text-amber-600 dark:text-amber-400">{groups.length}</span>
              <span className="text-amber-600 dark:text-amber-400 text-xs">({dupMemberIds.size} 条记录)</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRescan}>
            <Search className="size-3.5 mr-1" /> 重新拉取
          </Button>
          <Button
            size="sm"
            variant={groups.length > 0 ? "default" : "outline"}
            onClick={() => setDedupOpen(true)}
            disabled={groups.length === 0}
          >
            <ShieldCheck className="size-3.5 mr-1" />
            去重校验 {groups.length > 0 && `(${groups.length})`}
          </Button>
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

      {/* 对象网格 (重复的加红框) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {objects.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">加载中...</div>
        )}
        {objects.map((o) => {
          const ObjIcon = iconMap[o.name] || Box;
          const isDup = dupMemberIds.has(o.id);
          return (
            <Card
              key={o.id}
              className={`cursor-pointer hover:border-primary ${
                isDup ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10" : ""
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="text-3xl"><ObjIcon className="size-8" /></span>
                  <div className="flex items-center gap-1">
                    {isDup && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 text-[10px]">
                        重复
                      </Badge>
                    )}
                    <Badge variant="secondary">{o.properties_count} 属性</Badge>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{o.label}</CardTitle>
                <CardDescription className="font-mono">{o.name}</CardDescription>
                {isDup && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] mt-1 self-start"
                    onClick={() => setDedupOpen(true)}
                  >
                    查看重复 →
                  </Button>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

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
              选 target (主记录) 后, 其他会被后端删除 (后端: <code className="text-[10px] bg-muted px-1 rounded">DELETE /api/object-types/:id</code>)。
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
                              <span>·</span>
                              <span>{m.properties_count} 属性</span>
                              <span>·</span>
                              <span>{m.actions_count} 动作</span>
                              <span>·</span>
                              <span>{m.rules_count} 规则</span>
                              <Badge
                                variant={m.status === "active" ? "default" : "outline"}
                                className="text-[9px] h-3.5 px-1"
                              >
                                {m.status}
                              </Badge>
                            </div>
                          </div>
                          {isTarget && (
                            <Badge variant="default" className="text-[9px] h-4 px-1 shrink-0">主记录</Badge>
                          )}
                          {!isTarget && (
                            <Trash2 className="size-3.5 text-red-500 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground px-1">
                    将删除: <span className="font-mono text-red-600 dark:text-red-400">{toDelete.length} 条</span>
                    {toDelete.length > 0 && (
                      <> ({toDelete.map((d) => d.label).join(" / ")})</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDedupOpen(false)} disabled={merging}>
              取消
            </Button>
            <Button onClick={doMergeAll} disabled={merging || groups.length === 0}>
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