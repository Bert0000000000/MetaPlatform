import { useState, useEffect } from "react";
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
import { Box, Hash, Link2, Zap, Calculator, Shield, Settings, Server, Plus, Sparkles, Link, User, Package, Tag, Users, FileText, Receipt, Eye, Edit, Trash2, Search } from "lucide-react";

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">加载中...</div>
          )}
          {objects.map((o) => {
            const ObjIcon = iconMap[o.name] || Box;
            return (
              <Card key={o.id} className="cursor-pointer hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <span className="text-3xl"><ObjIcon className="size-8" /></span>
                    <Badge variant="secondary">{o.properties_count} 属性</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{o.label}</CardTitle>
                  <CardDescription className="font-mono">{o.name}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
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