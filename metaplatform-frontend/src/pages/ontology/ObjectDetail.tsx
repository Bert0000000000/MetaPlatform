import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockOntologyObjects } from "@/lib/mock-data";
import { ChevronLeft, Edit, Plus, Hash, Type, Calendar, Star, ToggleLeft, Settings, Sparkles, Save, Trash2, Shield, Box, Zap, Calculator, CheckCircle2 } from "lucide-react";

const MOCK_PROPERTIES = [
  { id: 1, name: "customer_code", label: "客户编号", type: "自动编号", required: true, indexed: true, system: true },
  { id: 2, name: "name", label: "客户名称", type: "短文本", required: true, indexed: true, system: false },
  { id: 3, name: "industry", label: "行业", type: "枚举", required: false, indexed: true, system: false },
  { id: 4, name: "level", label: "客户等级", type: "枚举", required: false, indexed: false, system: false },
  { id: 5, name: "phone", label: "联系电话", type: "手机号", required: false, indexed: false, system: false },
  { id: 6, name: "email", label: "邮箱", type: "邮箱", required: false, indexed: false, system: false },
  { id: 7, name: "address", label: "地址", type: "地址", required: false, indexed: false, system: false },
  { id: 8, name: "rating", label: "重要程度", type: "评分", required: false, indexed: false, system: false },
  { id: 9, name: "owner", label: "负责人", type: "人员", required: false, indexed: true, system: false },
  { id: 10, name: "created_at", label: "创建时间", type: "日期时间", required: false, indexed: true, system: true },
];

const MOCK_ACTIONS = [
  { id: 1, name: "create", label: "新增客户", type: "系统动作", trigger: "用户手动" },
  { id: 2, name: "update", label: "更新客户", type: "系统动作", trigger: "用户手动" },
  { id: 3, name: "delete", label: "删除客户", type: "系统动作", trigger: "用户手动" },
  { id: 4, name: "import", label: "批量导入", type: "系统动作", trigger: "用户手动" },
  { id: 5, name: "export", label: "导出 Excel", type: "系统动作", trigger: "用户手动" },
  { id: 6, name: "send_welcome", label: "发送欢迎邮件", type: "自定义动作", trigger: "新增客户后" },
  { id: 7, name: "assign_owner", label: "自动分配负责人", type: "业务规则动作", trigger: "新增时按行业分配" },
];

const MOCK_RULES = [
  { id: 1, name: "客户等级自动调整", trigger: "客户成交额 > 100万", action: "升级为战略客户", enabled: true },
  { id: 2, name: "30 天未联系提醒", trigger: "最后联系时间 > 30 天", action: "通知负责人跟进", enabled: true },
  { id: 3, name: "黑名单校验", trigger: "新增/更新客户", action: "校验是否为黑名单企业", enabled: true },
  { id: 4, name: "重复客户合并", trigger: "客户名称相似度 > 0.9", action: "提示合并", enabled: false },
];

const MOCK_LINKS = [
  { from: "客户", to: "订单", type: "1:N", label: "客户拥有的订单" },
  { from: "客户", to: "联系人", type: "1:N", label: "客户联系人" },
  { from: "客户", to: "合同", type: "1:N", label: "客户合同" },
  { from: "客户", to: "客户", type: "N:N", label: "关联客户" },
  { from: "客户", to: "员工", type: "N:1", label: "归属销售" },
];

export default function ObjectDetail() {
  const { objectId = "customer" } = useParams();
  const obj = mockOntologyObjects.find((o) => o.name === objectId) ?? mockOntologyObjects[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/ontology">
          <Button variant="ghost" size="icon"><ChevronLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {(() => { const Icon = obj.icon; return <Icon className="size-5" />; })()}
            {obj.label} ({obj.name})
            <Badge variant="default">已激活</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">本体对象详情 · 25 字段类型 · 多级权限</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Sparkles className="size-3 mr-1" />AI 优化</Button>
          <Button variant="outline" size="sm"><Settings className="size-3 mr-1" />配置</Button>
          <Button size="sm"><Save className="size-3 mr-1" />保存</Button>
        </div>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties"><Hash className="size-3 mr-1" />属性 ({MOCK_PROPERTIES.length})</TabsTrigger>
          <TabsTrigger value="actions"><Zap className="size-3 mr-1" />动作 ({MOCK_ACTIONS.length})</TabsTrigger>
          <TabsTrigger value="rules"><Calculator className="size-3 mr-1" />规则 ({MOCK_RULES.length})</TabsTrigger>
          <TabsTrigger value="links"><Box className="size-3 mr-1" />关系 ({MOCK_LINKS.length})</TabsTrigger>
          <TabsTrigger value="security"><Shield className="size-3 mr-1" />安全</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">属性定义</CardTitle>
                <CardDescription>10 个属性（4 个系统属性 + 6 个业务属性）</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="size-3 mr-1" />
                新增属性
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>属性名</TableHead>
                    <TableHead>中文标签</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>必填</TableHead>
                    <TableHead>索引</TableHead>
                    <TableHead>系统</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_PROPERTIES.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.name}</TableCell>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.type}</Badge>
                      </TableCell>
                      <TableCell>{p.required ? <CheckCircle2 className="size-4 text-green-500" /> : "—"}</TableCell>
                      <TableCell>{p.indexed ? <CheckCircle2 className="size-4 text-green-500" /> : "—"}</TableCell>
                      <TableCell>{p.system ? <Badge variant="secondary">系统</Badge> : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">动作</CardTitle>
                <CardDescription>CRUD 动作 + 自定义动作</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="size-3 mr-1" />
                新增动作
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>动作名</TableHead>
                    <TableHead>中文标签</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>触发方式</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_ACTIONS.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.name}</TableCell>
                      <TableCell className="font-medium">{a.label}</TableCell>
                      <TableCell>
                        <Badge variant={a.type === "系统动作" ? "secondary" : "outline"}>{a.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{a.trigger}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">业务规则</CardTitle>
                <CardDescription>Drools + DMN + 服务编排</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="size-3 mr-1" />
                新增规则
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_RULES.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 border rounded">
                  <ToggleLeft className={`size-4 ${r.enabled ? "text-green-500" : "text-gray-400"}`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{r.trigger}</span> → <span className="font-mono">{r.action}</span>
                    </div>
                  </div>
                  <Badge variant={r.enabled ? "secondary" : "outline"} className={r.enabled ? "text-green-600" : ""}>
                    {r.enabled ? "启用" : "禁用"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">关系</CardTitle>
              <CardDescription>对象间的关系建模（Neo4j 存储）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_LINKS.map((l, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded">
                  <div className="font-medium text-sm">{l.from}</div>
                  <div className="flex-1 flex items-center gap-2">
                    <Badge variant="outline">{l.type}</Badge>
                    <span className="text-xs text-muted-foreground">{l.label}</span>
                  </div>
                  <div className="font-medium text-sm">{l.to}</div>
                  <Button variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">数据权限（行级）</CardTitle>
                <CardDescription>控制用户能看哪些数据</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="p-2 border rounded text-sm">
                    <div className="font-medium">销售只看自己的客户</div>
                    <code className="text-xs text-muted-foreground">owner = currentUser</code>
                  </div>
                  <div className="p-2 border rounded text-sm">
                    <div className="font-medium">销售主管看全部门</div>
                    <code className="text-xs text-muted-foreground">department IN currentUser.dept</code>
                  </div>
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="size-3 mr-1" />
                    添加规则
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">字段级权限</CardTitle>
                <CardDescription>敏感字段脱敏</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { field: "客户编号", rule: "全部可见" },
                    { field: "联系电话", rule: "业务可见，运维脱敏" },
                    { field: "邮箱", rule: "全部可见" },
                    { field: "身份证", rule: "高管可见，其他人脱敏" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded text-sm">
                      <span className="font-medium">{s.field}</span>
                      <span className="text-xs text-muted-foreground">{s.rule}</span>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="size-3 mr-1" />
                    添加规则
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}