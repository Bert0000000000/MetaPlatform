import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mockArchitectureTree } from "@/lib/mock-data";
import { Building2, Database, Server, Layers, GitBranch, FileText, Plus, Network, Cpu } from "lucide-react";

export function BusinessArchitecture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="size-4" /> 业务架构（L1-L6）
        </CardTitle>
        <CardDescription>企业业务架构的 6 层模型</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { level: "L1", name: "价值链", desc: "端到端价值流", count: 5, icon: "🔗" },
            { level: "L2", name: "业务能力", desc: "可独立提供价值的业务能力", count: 28, icon: "💡" },
            { level: "L3", name: "业务流程", desc: "端到端业务流程图", count: 64, icon: "🔄" },
            { level: "L4", name: "业务角色", desc: "执行流程的角色", count: 18, icon: "👤" },
            { level: "L5", name: "业务事件", desc: "业务事件触发", count: 42, icon: "⚡" },
            { level: "L6", name: "业务对象", desc: "业务层面的核心对象", count: 56, icon: "📦" },
          ].map((l) => (
            <div key={l.level} className="flex items-center justify-between p-3 border rounded hover:border-primary">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{l.icon}</div>
                <div>
                  <div className="font-medium">{l.level} - {l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.desc}</div>
                </div>
              </div>
              <Badge variant="secondary">{l.count} 项</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplicationArchitecture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Server className="size-4" /> 应用架构
        </CardTitle>
        <CardDescription>应用全景图 + 依赖关系 + 映射</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: "应用全景", count: 6, desc: "所有应用" },
            { name: "应用依赖", count: 18, desc: "调用关系" },
            { name: "应用-流程", count: 28, desc: "映射关系" },
            { name: "应用-数据", count: 42, desc: "数据映射" },
          ].map((c) => (
            <Card key={c.name} className="cursor-pointer hover:border-primary">
              <CardContent className="p-4 text-center">
                <Network className="size-6 mx-auto text-primary" />
                <div className="font-medium text-sm mt-2">{c.name}</div>
                <div className="text-2xl font-semibold">{c.count}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DataArchitecture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="size-4" /> 数据架构
        </CardTitle>
        <CardDescription>数据主题域 + 数据模型 + 湖仓分布</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["客户域", "订单域", "产品域", "财务域", "人事域", "运营域"].map((d) => (
            <div key={d} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{d}</div>
                <div className="text-xs text-muted-foreground">主题域</div>
              </div>
              <Badge>8 个对象</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TechArchitecture() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="size-4" /> 技术架构
        </CardTitle>
        <CardDescription>技术栈 + 部署拓扑 + 服务依赖</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { name: "前端", value: "React 19 + Tailwind 4 + Vite 7" },
            { name: "后端", value: "Java 21 + Spring Boot 3 + Flowable 7" },
            { name: "数据库", value: "PostgreSQL 16 + Neo4j 5 + Milvus 2.4" },
            { name: "消息", value: "Apache Kafka 3.6" },
            { name: "部署", value: "Kubernetes 1.29 + Helm + ArgoCD" },
            { name: "AI", value: "LLM Gateway + LangGraph + DeepSeek" },
          ].map((s) => (
            <div key={s.name} className="flex justify-between text-sm p-2 border rounded">
              <span className="font-medium">{s.name}</span>
              <code className="text-xs text-muted-foreground">{s.value}</code>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}