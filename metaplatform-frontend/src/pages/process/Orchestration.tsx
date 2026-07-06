import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Database, Globe, Code2, FileCode, Workflow, Webhook, Clock, Plus } from "lucide-react";

const adapters = [
  { name: "SQL 适配器", icon: Database, desc: "编写 SQL 语句操作数据", color: "bg-blue-500" },
  { name: "HTTP 适配器", icon: Globe, desc: "将外部 HTTP 接口包装为服务", color: "bg-green-500" },
  { name: "Groovy 适配器", icon: Code2, desc: "Groovy 脚本编写业务逻辑", color: "bg-purple-500" },
  { name: "JS 表达式适配器", icon: FileCode, desc: "前后端通用 JS 脚本", color: "bg-yellow-500" },
  { name: "Java 适配器", icon: Code2, desc: "Java 代码实现业务逻辑", color: "bg-red-500" },
  { name: "连接器服务", icon: Workflow, desc: "企微/邮箱/钉钉/飞书连接器", color: "bg-indigo-500" },
];

const triggers = [
  { name: "webhook 触发", icon: Webhook, desc: "指定 URL 被动接收数据时触发" },
  { name: "定时触发", icon: Clock, desc: "Cron 循环周期触发" },
  { name: "模型数据触发", icon: Database, desc: "数据 CRUD 时触发" },
];

const nodes = [
  { name: "调用服务", icon: Workflow, desc: "调用 4 类服务" },
  { name: "SQL 节点", icon: Database, desc: "执行 SQL 脚本" },
  { name: "Groovy 节点", icon: Code2, desc: "执行 Groovy 脚本" },
  { name: "高级 http 节点", icon: Globe, desc: "调用 HTTP 服务" },
  { name: "排他网关", icon: "✕", desc: "XOR 路由" },
  { name: "包容网关", icon: "○", desc: "OR 路由" },
];

export default function Orchestration() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="服务编排"
        description="6 大适配器 + 3 触发方式 + 节点类型"
        action={
          <Button className="gap-2" onClick={() => navigate("/process/designer")}>
            <Plus className="size-4" /> 新建编排
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">6 大适配器</CardTitle>
          <CardDescription>SQL / HTTP / Groovy / JS / Java / 连接器</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adapters.map((a) => {
              const Icon = a.icon;
              return (
                <Card key={a.name} className="cursor-pointer hover:border-primary">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`${a.color} text-white size-10 rounded-lg flex items-center justify-center`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{a.name}</CardTitle>
                        <CardDescription>{a.desc}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">触发方式</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {triggers.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.name} className="flex items-center gap-3 p-3 border rounded">
                    <Icon className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">节点类型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nodes.map((n) => {
                const Icon = typeof n.icon === "string" ? null : n.icon;
                return (
                  <div key={n.name} className="flex items-center gap-3 p-3 border rounded">
                    {Icon ? (
                      <Icon className="size-5 text-primary" />
                    ) : (
                      <span className="size-5 flex items-center justify-center text-primary font-bold">
                        {n.icon as string}
                      </span>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{n.name}</div>
                      <div className="text-xs text-muted-foreground">{n.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}