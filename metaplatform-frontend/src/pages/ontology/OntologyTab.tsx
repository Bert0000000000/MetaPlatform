import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Box, Hash, Link2, Zap, Calculator, Shield, Settings, Server, Plus, Sparkles } from "lucide-react";

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
            { name: "Customer", label: "客户", icon: "👤", props: 18 },
            { name: "Order", label: "订单", icon: "📦", props: 24 },
            { name: "Product", label: "产品", icon: "🏷️", props: 16 },
            { name: "Employee", label: "员工", icon: "👥", props: 22 },
            { name: "Contract", label: "合同", icon: "📄", props: 30 },
            { name: "Invoice", label: "发票", icon: "🧾", props: 14 },
          ].map((o) => (
            <Card key={o.name} className="cursor-pointer hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{o.icon}</span>
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
                  <div className="text-2xl mb-2">🔗</div>
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