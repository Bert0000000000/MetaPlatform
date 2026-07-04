import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
  if (!element) return null;
  const Icon = element.icon;

  return (
    <div className="flex flex-col gap-6">
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
          {[
            { name: "Customer", label: "客户", icon: User, props: 18 },
            { name: "Order", label: "订单", icon: Package, props: 24 },
            { name: "Product", label: "产品", icon: Tag, props: 16 },
            { name: "Employee", label: "员工", icon: Users, props: 22 },
            { name: "Contract", label: "合同", icon: FileText, props: 30 },
            { name: "Invoice", label: "发票", icon: Receipt, props: 14 },
          ].map((o) => (
            <Card key={o.name} className="cursor-pointer hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="text-3xl"><o.icon className="size-8" /></span>
                  <Badge variant="secondary">{o.props} 属性</Badge>
                </div>
                <CardTitle className="text-base mt-2">{o.label}</CardTitle>
                <CardDescription className="font-mono">{o.name}</CardDescription>
              </CardHeader>
            </Card>
          ))}
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
            <CardTitle className="text-base">关系类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { type: "1:1 一对一", desc: "用户-档案" },
                { type: "1:N 一对多", desc: "客户-订单" },
                { type: "N:N 多对多", desc: "学生-课程" },
              ].map((r) => (
                <div key={r.type} className="border rounded p-4 text-center">
                  <div className="text-2xl mb-2"><Link className="size-6 mx-auto" /></div>
                  <div className="font-medium">{r.type}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
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

const MOCK_PROPERTIES = [
  { id: 1, name: "客户编号", type: "短文本", object: "Customer", required: true, unique: true, desc: "客户唯一标识" },
  { id: 2, name: "客户名称", type: "短文本", object: "Customer", required: true, unique: false, desc: "客户全称" },
  { id: 3, name: "订单金额", type: "金额", object: "Order", required: true, unique: false, desc: "订单总金额" },
  { id: 4, name: "订单日期", type: "日期", object: "Order", required: true, unique: false, desc: "下单日期" },
  { id: 5, name: "产品SKU", type: "短文本", object: "Product", required: true, unique: true, desc: "产品唯一编码" },
  { id: 6, name: "员工邮箱", type: "链接", object: "Employee", required: true, unique: true, desc: "企业邮箱" },
  { id: 7, name: "合同金额", type: "金额", object: "Contract", required: true, unique: false, desc: "合同总金额" },
  { id: 8, name: "发票号", type: "短文本", object: "Invoice", required: true, unique: true, desc: "发票唯一编号" },
];

export function OntologyProperties() {
  const [properties] = useState(MOCK_PROPERTIES);
  const [search, setSearch] = useState("");
  const filtered = properties.filter((p) => p.name.includes(search) || p.object.includes(search));

  return (
    <div className="flex flex-col gap-4">
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
        </CardContent>
      </Card>
    </div>
  );
}

const MOCK_LINKS = [
  { id: 1, name: "客户-订单", from: "Customer", to: "Order", type: "1:N", desc: "一个客户有多个订单" },
  { id: 2, name: "订单-产品", from: "Order", to: "Product", type: "N:N", desc: "订单包含多个产品" },
  { id: 3, name: "客户-合同", from: "Customer", to: "Contract", type: "1:N", desc: "一个客户签多份合同" },
  { id: 4, name: "员工-部门", from: "Employee", to: "Department", type: "N:1", desc: "多员工属同一部门" },
  { id: 5, name: "发票-订单", from: "Invoice", to: "Order", type: "1:1", desc: "发票对应订单" },
];

export function OntologyLinks() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="关系管理"
        description="定义对象间的关系（1:1 / 1:N / N:N）"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建关系</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="size-4" /> 关系列表</CardTitle>
          <CardDescription>{MOCK_LINKS.length} 条关系定义</CardDescription>
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
              {MOCK_LINKS.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell><Badge variant="secondary">{l.from}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{l.to}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.desc}</TableCell>
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

const MOCK_ACTIONS = [
  { id: 1, name: "创建订单", type: "新增", object: "Order", endpoint: "POST /api/orders", status: "active" },
  { id: 2, name: "查询客户列表", type: "查询", object: "Customer", endpoint: "GET /api/customers", status: "active" },
  { id: 3, name: "更新合同状态", type: "更新", object: "Contract", endpoint: "PATCH /api/contracts/:id", status: "active" },
  { id: 4, name: "删除草稿发票", type: "删除", object: "Invoice", endpoint: "DELETE /api/invoices/:id", status: "active" },
  { id: 5, name: "批量导入客户", type: "导入", object: "Customer", endpoint: "POST /api/customers/import", status: "active" },
  { id: 6, name: "导出订单报表", type: "导出", object: "Order", endpoint: "GET /api/orders/export", status: "active" },
  { id: 7, name: "自定义-发送通知", type: "自定义", object: "-", endpoint: "POST /api/actions/notify", status: "draft" },
];

export function OntologyActions() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="动作管理"
        description="CRUD 动作 + 自定义动作配置"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建动作</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="size-4" /> 动作列表</CardTitle>
          <CardDescription>{MOCK_ACTIONS.length} 个动作</CardDescription>
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
              {MOCK_ACTIONS.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                  <TableCell>{a.object !== "-" ? <Badge variant="secondary">{a.object}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                  <TableCell className="font-mono text-xs">{a.endpoint}</TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status === "active" ? "已启用" : "草稿"}</Badge></TableCell>
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

const MOCK_FUNCTIONS = [
  { id: 1, name: "计算订单总额", type: "业务函数", lang: "JS", object: "Order", calls: 12480 },
  { id: 2, name: "库存扣减", type: "业务函数", lang: "JS", object: "Product", calls: 8640 },
  { id: 3, name: "审批规则-金额阈值", type: "业务规则函数", lang: "DRL", object: "-", calls: 3200 },
  { id: 4, name: "自动生成编号", type: "业务函数", lang: "JS", object: "-", calls: 6400 },
  { id: 5, name: "AI 风险评估", type: "AI 规则函数", lang: "Python", object: "Contract", calls: 480 },
  { id: 6, name: "服务编排-下单流程", type: "服务编排", lang: "YAML", object: "-", calls: 2400 },
];

export function OntologyFunctions() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="函数管理"
        description="业务函数 + AI 规则函数 + 服务编排"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建函数</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="size-4" /> 函数列表</CardTitle>
          <CardDescription>{MOCK_FUNCTIONS.length} 个函数</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>函数名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>语言</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead className="text-right">调用次数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_FUNCTIONS.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="font-mono text-xs">{f.lang}</Badge></TableCell>
                  <TableCell>{f.object !== "-" ? <Badge variant="secondary">{f.object}</Badge> : <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                  <TableCell className="text-right">{f.calls.toLocaleString()}</TableCell>
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

const MOCK_RULES = [
  { id: 1, name: "订单金额校验", type: "业务规则", trigger: "Order.before_save", condition: "amount > 0", status: "active" },
  { id: 2, name: "审批自动通过", type: "业务规则", trigger: "Approval.on_create", condition: "amount < 1000", status: "active" },
  { id: 3, name: "库存补货触发", type: "业务规则", trigger: "Product.after_update", condition: "stock < safety_stock", status: "active" },
  { id: 4, name: "合同到期通知", type: "服务编排", trigger: "Schedule.daily", condition: "expires_in_30d", status: "paused" },
  { id: 5, name: "DMN-客户分级", type: "决策表", trigger: "Customer.after_save", condition: "DMN 表", status: "active" },
];

export function OntologyRules() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="流程规则"
        description="条件触发 + 服务编排 + DMN 决策表"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建规则</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Settings className="size-4" /> 规则列表</CardTitle>
          <CardDescription>{MOCK_RULES.length} 条规则</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>触发点</TableHead>
                <TableHead>条件</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_RULES.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.trigger}</TableCell>
                  <TableCell className="font-mono text-xs">{r.condition}</TableCell>
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

const MOCK_SECURITY_RULES = [
  { id: 1, name: "客户数据-行级权限", level: "数据级", object: "Customer", rule: "仅查看本部门客户", roles: "业务人员" },
  { id: 2, name: "订单金额-字段脱敏", level: "字段级", object: "Order", rule: "金额字段脱敏显示", roles: "非财务" },
  { id: 3, name: "合同删除-动作控制", level: "动作级", object: "Contract", rule: "禁止删除已审批合同", roles: "所有角色" },
  { id: 4, name: "ABAC-跨部门限制", level: "ABAC", object: "-", rule: "部门!=财务 AND 金额>10万 → 禁止", roles: "全部" },
];

export function OntologySecurity() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="安全配置"
        description="数据/字段/动作级权限 + ABAC 策略"
        action={<Button className="gap-2"><Plus className="size-4" /> 新建策略</Button>}
      />
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
              {MOCK_SECURITY_RULES.map((r) => (
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

export function OntologyGovernance() {
  return (
    <div className="flex flex-col gap-4">
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