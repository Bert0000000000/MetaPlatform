import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Database, Server, Layers, GitBranch, FileText, Plus, Network, Cpu, Workflow, Box, ArrowRight, ArrowDown, BarChart3, Filter, Download } from "lucide-react";

// === 业务架构 ===
const BA_LAYERS = [
  { level: "L1", name: "价值链", desc: "端到端价值流", count: 5, icon: "🔗", color: "bg-red-500" },
  { level: "L2", name: "业务能力", desc: "可独立提供价值的业务能力", count: 28, icon: "💡", color: "bg-orange-500" },
  { level: "L3", name: "业务流程", desc: "端到端业务流程图", count: 64, icon: "🔄", color: "bg-amber-500" },
  { level: "L4", name: "业务角色", desc: "执行流程的角色", count: 18, icon: "👤", color: "bg-green-500" },
  { level: "L5", name: "业务事件", desc: "业务事件触发", count: 42, icon: "⚡", color: "bg-blue-500" },
  { level: "L6", name: "业务对象", desc: "业务层面的核心对象", count: 56, icon: "📦", color: "bg-purple-500" },
];

const VALUE_CHAIN = [
  { name: "市场获取", apps: ["CRM", "营销"], icon: "📣" },
  { name: "产品研发", apps: ["PLM", "项目管理"], icon: "🧪" },
  { name: "采购供应", apps: ["SRM", "WMS"], icon: "🚚" },
  { name: "生产制造", apps: ["MES", "ERP"], icon: "🏭" },
  { name: "营销销售", apps: ["CRM", "电商"], icon: "💼" },
  { name: "客户服务", apps: ["客服", "工单"], icon: "🎧" },
];

// === 应用架构 ===
const APP_DEPENDENCIES = [
  { from: "客户管理 CRM", to: "数据中台", calls: 1240, type: "数据查询" },
  { from: "报销审批", to: "财务系统", calls: 580, type: "凭证写入" },
  { from: "销售看板", to: "客户管理 CRM", calls: 920, type: "API 调用" },
  { from: "智能体助手", to: "数据中台", calls: 1850, type: "LLM 查询" },
  { from: "采购流程", to: "ERP", calls: 432, type: "数据同步" },
];

const APP_FLOW_MATRIX = [
  { app: "客户管理 CRM", flows: 5, data: 3, pages: 12 },
  { app: "报销审批", flows: 3, data: 2, pages: 8 },
  { app: "销售看板", flows: 10, data: 5, pages: 15 },
  { app: "智能体助手", flows: 8, data: 1, pages: 3 },
  { app: "数字员工小秘", flows: 6, data: 0, pages: 2 },
  { app: "VibeCoding Demo", flows: 0, data: 0, pages: 1 },
];

// === 数据架构 ===
const DATA_DOMAINS = [
  { name: "客户域", objects: 8, apps: ["CRM", "销售看板"], icon: "🤝", color: "bg-blue-500" },
  { name: "订单域", objects: 12, apps: ["CRM", "ERP"], icon: "📋", color: "bg-green-500" },
  { name: "产品域", objects: 6, apps: ["PLM", "电商"], icon: "📦", color: "bg-orange-500" },
  { name: "财务域", objects: 10, apps: ["ERP", "报销"], icon: "💰", color: "bg-yellow-500" },
  { name: "人事域", objects: 7, apps: ["HR"], icon: "👥", color: "bg-purple-500" },
  { name: "运营域", objects: 13, apps: ["BI"], icon: "📊", color: "bg-pink-500" },
];

// === 技术架构 ===
const TECH_STACK = [
  { layer: "前端", items: ["React 19", "Tailwind 4", "Vite 7", "shadcn/ui", "React Router 7"] },
  { layer: "后端", items: ["Java 21", "Spring Boot 3", "Spring Cloud", "Flowable 7", "GraphQL"] },
  { layer: "数据库", items: ["PostgreSQL 16", "Neo4j 5", "Milvus 2.4", "Redis 7", "ClickHouse"] },
  { layer: "消息", items: ["Apache Kafka 3.6", "RocketMQ 5"] },
  { layer: "部署", items: ["Kubernetes 1.29", "Helm", "ArgoCD", "Istio"] },
  { layer: "AI", items: ["LLM Gateway", "LangGraph", "DeepSeek", "Qwen", "BGE-M3"] },
];

export function BusinessArchitecture() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> 业务架构
          </h1>
          <p className="text-sm text-muted-foreground">企业业务架构 L1-L6 层模型 + 价值链</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="size-3 mr-1" />筛选</Button>
          <Button variant="outline" size="sm"><Download className="size-3 mr-1" />导出</Button>
          <Button size="sm"><Plus className="size-3 mr-1" />新增层级</Button>
        </div>
      </div>

      <Tabs defaultValue="layers">
        <TabsList>
          <TabsTrigger value="layers">L1-L6 分层</TabsTrigger>
          <TabsTrigger value="value">价值链</TabsTrigger>
          <TabsTrigger value="capability">能力地图</TabsTrigger>
        </TabsList>
        <TabsContent value="layers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">业务架构分层模型</CardTitle>
              <CardDescription>从价值链到业务对象，逐层分解</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {BA_LAYERS.map((l, i) => (
                  <div key={l.level} className="flex items-center gap-3">
                    <div className={`size-12 rounded-lg ${l.color} text-white flex items-center justify-center font-semibold shrink-0`}>
                      {l.level}
                    </div>
                    <div className="flex-1 flex items-center gap-3 p-3 border rounded hover:border-primary cursor-pointer">
                      <div className="text-2xl">{l.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.desc}</div>
                      </div>
                      <Badge variant="secondary">{l.count} 项</Badge>
                      {i < BA_LAYERS.length - 1 && <ArrowDown className="size-4 text-muted-foreground ml-2" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="value" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">端到端价值链</CardTitle>
              <CardDescription>企业核心价值流转路径</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {VALUE_CHAIN.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-2">
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 cursor-pointer">
                      <div className="text-2xl">{v.icon}</div>
                      <div className="font-medium text-sm mt-1">{v.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {v.apps.join(" · ")}
                      </div>
                    </div>
                    {i < VALUE_CHAIN.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">业务能力地图</CardTitle>
              <CardDescription>28 项业务能力，按一级分类组织</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["营销管理", "销售管理", "客户服务", "采购管理", "生产管理", "仓储物流", "财务管理", "人力资源", "研发管理", "质量管理", "法务合规", "战略规划"].map((c) => (
                  <div key={c} className="rounded border p-3 hover:border-primary cursor-pointer">
                    <div className="font-medium text-sm">{c}</div>
                    <div className="text-xs text-muted-foreground mt-1">2-4 项子能力</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ApplicationArchitecture() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Server className="size-5 text-primary" /> 应用架构
        </h1>
        <p className="text-sm text-muted-foreground">应用全景 + 依赖关系 + 跨应用映射</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { name: "应用总数", count: 6, icon: "📱", desc: "全部应用" },
          { name: "依赖关系", count: 18, icon: "🔗", desc: "调用次数 5,022/月" },
          { name: "流程映射", count: 32, icon: "🔄", desc: "应用-流程映射" },
          { name: "数据映射", count: 56, icon: "📊", desc: "应用-对象映射" },
        ].map((c) => (
          <Card key={c.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                  <div className="text-xl font-bold mt-1">{c.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
                </div>
                <div className="text-3xl">{c.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="deps">
        <TabsList>
          <TabsTrigger value="deps">应用依赖</TabsTrigger>
          <TabsTrigger value="matrix">应用矩阵</TabsTrigger>
          <TabsTrigger value="graph">全景图</TabsTrigger>
        </TabsList>
        <TabsContent value="deps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用调用依赖</CardTitle>
              <CardDescription>应用间 API/数据 调用统计</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">调用方</th>
                    <th className="px-4 py-2 font-medium">被调用方</th>
                    <th className="px-4 py-2 font-medium">调用次数</th>
                    <th className="px-4 py-2 font-medium">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {APP_DEPENDENCIES.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{d.from}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="size-3 text-muted-foreground" />
                          {d.to}
                        </div>
                      </td>
                      <td className="px-4 py-3">{d.calls.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{d.type}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用 × 流程 × 数据 矩阵</CardTitle>
              <CardDescription>每个应用的能力映射</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">应用</th>
                    <th className="px-4 py-2 font-medium text-center"><Workflow className="size-3 inline mr-1" />流程</th>
                    <th className="px-4 py-2 font-medium text-center"><Box className="size-3 inline mr-1" />对象</th>
                    <th className="px-4 py-2 font-medium text-center"><FileText className="size-3 inline mr-1" />页面</th>
                    <th className="px-4 py-2 font-medium text-right">复杂度</th>
                  </tr>
                </thead>
                <tbody>
                  {APP_FLOW_MATRIX.map((m, i) => {
                    const complexity = m.flows * 2 + m.data * 3 + m.pages;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{m.app}</td>
                        <td className="px-4 py-3 text-center">{m.flows}</td>
                        <td className="px-4 py-3 text-center">{m.data}</td>
                        <td className="px-4 py-3 text-center">{m.pages}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant={complexity > 30 ? "destructive" : complexity > 15 ? "default" : "secondary"}>
                            {complexity > 30 ? "高" : complexity > 15 ? "中" : "低"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用全景图</CardTitle>
              <CardDescription>6 个核心应用 + 数据中台 + AI 中台</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 p-6 bg-muted/30 rounded">
                {APP_FLOW_MATRIX.map((a, i) => (
                  <div key={i} className="rounded-lg border-2 border-primary/30 bg-card p-3 text-center">
                    <div className="text-xl">📱</div>
                    <div className="font-medium text-sm mt-1">{a.app}</div>
                    <div className="text-xs text-muted-foreground">{a.flows + a.data + a.pages} 项资产</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function DataArchitecture() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Database className="size-5 text-primary" /> 数据架构
        </h1>
        <p className="text-sm text-muted-foreground">数据主题域 + 数据模型 + 湖仓分布</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DATA_DOMAINS.map((d) => (
          <Card key={d.name}>
            <CardContent className="p-4 text-center">
              <div className={`size-12 rounded-full ${d.color} text-white flex items-center justify-center text-2xl mx-auto`}>
                {d.icon}
              </div>
              <div className="font-medium text-sm mt-2">{d.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{d.objects} 对象</div>
              <div className="text-xs text-primary mt-1">{d.apps.join(" · ")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">湖仓分布</CardTitle>
          <CardDescription>ODS / DWD / DWS / ADS 四层数据流转</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { layer: "ODS", name: "原始层", count: 38, color: "border-l-blue-500", desc: "原始数据同步" },
              { layer: "DWD", name: "明细层", count: 24, color: "border-l-green-500", desc: "清洗 & 去重" },
              { layer: "DWS", name: "汇总层", count: 12, color: "border-l-orange-500", desc: "主题汇总" },
              { layer: "ADS", name: "应用层", count: 18, color: "border-l-red-500", desc: "面向应用" },
            ].map((l) => (
              <div key={l.layer} className={`rounded border-l-4 ${l.color} border-y border-r p-3`}>
                <div className="text-xs text-muted-foreground">{l.layer}</div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xl font-bold mt-2">{l.count}</div>
                <div className="text-xs text-muted-foreground mt-1">{l.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TechArchitecture() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Cpu className="size-5 text-primary" /> 技术架构
        </h1>
        <p className="text-sm text-muted-foreground">技术栈 + 部署拓扑 + 服务依赖</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">技术栈总览</CardTitle>
          <CardDescription>6 大层级，每层关键技术选型</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TECH_STACK.map((s) => (
              <div key={s.layer} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{s.layer}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.items.map((t) => (
                    <code key={t} className="text-xs bg-muted px-2 py-1 rounded">{t}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部署拓扑</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 border rounded">
                <span>集群</span><span className="font-mono text-xs">K8s 1.29 (3 节点)</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>负载均衡</span><span className="font-mono text-xs">Nginx + Istio</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>服务网格</span><span className="font-mono text-xs">Istio 1.20</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>CI/CD</span><span className="font-mono text-xs">GitHub Actions + ArgoCD</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">可观测性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 border rounded">
                <span>日志</span><span className="font-mono text-xs">ELK 8.x</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>监控</span><span className="font-mono text-xs">Prometheus + Grafana</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>链路追踪</span><span className="font-mono text-xs">Jaeger</span>
              </div>
              <div className="flex justify-between p-2 border rounded">
                <span>告警</span><span className="font-mono text-xs">AlertManager</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}