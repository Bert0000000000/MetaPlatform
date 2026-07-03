import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Database, Server, Layers, GitBranch, FileText, Plus, Network, Cpu, Workflow, Box, ArrowRight, ArrowDown, BarChart3, Filter, Download, Link, Lightbulb, RefreshCw, User, Zap, Package, Megaphone, FlaskConical, Truck, Factory, Briefcase, Headphones, Smartphone, ClipboardList, DollarSign, Users, Handshake, X, Eye, Search, ChevronDown,
} from "lucide-react";

/* ═══════════════════════ Toast helper ═══════════════════════ */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, setToast };
}

/* ═══════════════════════ Export helper ═══════════════════════ */
function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════ Business Architecture Data ═══════════════════════ */
interface BALayer {
  level: string;
  name: string;
  desc: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

const INITIAL_BA_LAYERS: BALayer[] = [
  { level: "L1", name: "价值链", desc: "端到端价值流", count: 5, icon: Link, color: "bg-red-500" },
  { level: "L2", name: "业务能力", desc: "可独立提供价值的业务能力", count: 28, icon: Lightbulb, color: "bg-orange-500" },
  { level: "L3", name: "业务流程", desc: "端到端业务流程图", count: 64, icon: RefreshCw, color: "bg-amber-500" },
  { level: "L4", name: "业务角色", desc: "执行流程的角色", count: 18, icon: User, color: "bg-green-500" },
  { level: "L5", name: "业务事件", desc: "业务事件触发", count: 42, icon: Zap, color: "bg-blue-500" },
  { level: "L6", name: "业务对象", desc: "业务层面的核心对象", count: 56, icon: Package, color: "bg-purple-500" },
];

const VALUE_CHAIN = [
  { name: "市场获取", apps: ["CRM", "营销"], icon: Megaphone },
  { name: "产品研发", apps: ["PLM", "项目管理"], icon: FlaskConical },
  { name: "采购供应", apps: ["SRM", "WMS"], icon: Truck },
  { name: "生产制造", apps: ["MES", "ERP"], icon: Factory },
  { name: "营销销售", apps: ["CRM", "电商"], icon: Briefcase },
  { name: "客户服务", apps: ["客服", "工单"], icon: Headphones },
];

/* ═══════════════════════ Application Architecture Data ═══════════════════════ */
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

/* ═══════════════════════ Data Architecture Data ═══════════════════════ */
const DATA_DOMAINS = [
  { name: "客户域", objects: 8, apps: ["CRM", "销售看板"], icon: Handshake, color: "bg-blue-500" },
  { name: "订单域", objects: 12, apps: ["CRM", "ERP"], icon: ClipboardList, color: "bg-green-500" },
  { name: "产品域", objects: 6, apps: ["PLM", "电商"], icon: Package, color: "bg-orange-500" },
  { name: "财务域", objects: 10, apps: ["ERP", "报销"], icon: DollarSign, color: "bg-yellow-500" },
  { name: "人事域", objects: 7, apps: ["HR"], icon: Users, color: "bg-purple-500" },
  { name: "运营域", objects: 13, apps: ["BI"], icon: BarChart3, color: "bg-pink-500" },
];

/* ═══════════════════════ Tech Architecture Data ═══════════════════════ */
const TECH_STACK = [
  { layer: "前端", items: ["React 19", "Tailwind 4", "Vite 7", "shadcn/ui", "React Router 7"] },
  { layer: "后端", items: ["Java 21", "Spring Boot 3", "Spring Cloud", "Flowable 7", "GraphQL"] },
  { layer: "数据库", items: ["PostgreSQL 16", "Neo4j 5", "Milvus 2.4", "Redis 7", "ClickHouse"] },
  { layer: "消息", items: ["Apache Kafka 3.6", "RocketMQ 5"] },
  { layer: "部署", items: ["Kubernetes 1.29", "Helm", "ArgoCD", "Istio"] },
  { layer: "AI", items: ["LLM Gateway", "LangGraph", "DeepSeek", "Qwen", "BGE-M3"] },
];

const DEPLOY_TOPOLOGY = [
  { label: "集群", value: "K8s 1.29 (3 节点)" },
  { label: "负载均衡", value: "Nginx + Istio" },
  { label: "服务网格", value: "Istio 1.20" },
  { label: "CI/CD", value: "GitHub Actions + ArgoCD" },
];

const OBSERVABILITY = [
  { label: "日志", value: "ELK 8.x" },
  { label: "监控", value: "Prometheus + Grafana" },
  { label: "链路追踪", value: "Jaeger" },
  { label: "告警", value: "AlertManager" },
];

const CAPABILITY_LIST = [
  "营销管理", "销售管理", "客户服务", "采购管理", "生产管理", "仓储物流",
  "财务管理", "人力资源", "研发管理", "质量管理", "法务合规", "战略规划",
];

/* ═══════════════════════ BusinessArchitecture ═══════════════════════ */
export function BusinessArchitecture() {
  const [baLayers, setBALayers] = useState<BALayer[]>(INITIAL_BA_LAYERS);
  const [showFilter, setShowFilter] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<BALayer | null>(null);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerDesc, setNewLayerDesc] = useState("");
  const { toast, setToast } = useToast();

  /* Filter */
  const filteredLayers = filterLevel
    ? baLayers.filter((l) => l.level === filterLevel)
    : baLayers;

  /* Export */
  function handleExport() {
    const data = baLayers.map((l) => ({ level: l.level, name: l.name, desc: l.desc, count: l.count }));
    downloadJSON(data, "business-architecture-layers.json");
    setToast("导出成功：business-architecture-layers.json");
  }

  function handleExportCSV() {
    const headers = ["层级", "名称", "描述", "数量"];
    const rows = baLayers.map((l) => [l.level, l.name, l.desc, l.count]);
    downloadCSV(headers, rows, "business-architecture-layers.csv");
    setToast("导出成功：business-architecture-layers.csv");
  }

  /* Add layer */
  function handleAddLayer() {
    if (!newLayerName.trim()) return;
    const nextLevel = `L${baLayers.length + 1}`;
    const newLayer: BALayer = {
      level: nextLevel,
      name: newLayerName.trim(),
      desc: newLayerDesc.trim() || "自定义层级",
      count: 0,
      icon: Layers,
      color: "bg-gray-500",
    };
    setBALayers((prev) => [...prev, newLayer]);
    setNewLayerName("");
    setNewLayerDesc("");
    setShowAddDialog(false);
    setToast(`已新增层级：${newLayer.level} ${newLayer.name}`);
  }

  /* Row click */
  function handleRowClick(layer: BALayer) {
    setSelectedLayer(layer);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> 业务架构
          </h1>
          <p className="text-sm text-muted-foreground">企业业务架构 L1-L6 层模型 + 价值链</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="size-3 mr-1" />筛选
            {filterLevel && <Badge variant="secondary" className="ml-1 text-xs">{filterLevel}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-3 mr-1" />新增层级
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilter && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">按层级筛选：</span>
              <Button
                variant={filterLevel === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterLevel("")}
              >
                全部
              </Button>
              {baLayers.map((l) => (
                <Button
                  key={l.level}
                  variant={filterLevel === l.level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterLevel(l.level)}
                >
                  {l.level}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setFilterLevel(""); setShowFilter(false); }}>
                <X className="size-3 mr-1" /> 关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              <CardDescription>从价值链到业务对象，逐层分解。点击行查看详情。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredLayers.map((l, i) => (
                  <div key={l.level} className="flex items-center gap-3">
                    <div className={`size-12 rounded-lg ${l.color} text-white flex items-center justify-center font-semibold shrink-0`}>
                      {l.level}
                    </div>
                    <div
                      className="flex-1 flex items-center gap-3 p-3 border rounded hover:border-primary cursor-pointer transition-colors"
                      onClick={() => handleRowClick(l)}
                    >
                      <div className="text-2xl"><l.icon className="size-6" /></div>
                      <div className="flex-1">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.desc}</div>
                      </div>
                      <Badge variant="secondary">{l.count} 项</Badge>
                      <Eye className="size-4 text-muted-foreground" />
                      {i < filteredLayers.length - 1 && <ArrowDown className="size-4 text-muted-foreground ml-2" />}
                    </div>
                  </div>
                ))}
              </div>
              {filteredLayers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="size-8 mb-2" />
                  <p className="text-sm">没有匹配的层级</p>
                  <Button variant="link" size="sm" onClick={() => setFilterLevel("")}>清除筛选</Button>
                </div>
              )}
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
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 cursor-pointer transition-colors">
                      <div className="text-2xl"><v.icon className="size-6" /></div>
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
                {CAPABILITY_LIST.map((c) => (
                  <div key={c} className="rounded border p-3 hover:border-primary cursor-pointer transition-colors">
                    <div className="font-medium text-sm">{c}</div>
                    <div className="text-xs text-muted-foreground mt-1">2-4 项子能力</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Layer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增层级</DialogTitle>
            <DialogDescription>在业务架构分层模型中新增一个层级</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="layer-name">层级名称 *</Label>
              <Input
                id="layer-name"
                placeholder="例如：业务规则"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="layer-desc">描述</Label>
              <Input
                id="layer-desc"
                placeholder="例如：业务规则与约束"
                value={newLayerDesc}
                onChange={(e) => setNewLayerDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleAddLayer} disabled={!newLayerName.trim()}>确认新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLayer && <selectedLayer.icon className="size-5" />}
              {selectedLayer?.level} - {selectedLayer?.name}
            </DialogTitle>
            <DialogDescription>{selectedLayer?.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">包含项目数</div>
                  <div className="text-xl font-bold mt-1">{selectedLayer?.count}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">层级编号</div>
                  <div className="text-xl font-bold mt-1">{selectedLayer?.level}</div>
                </CardContent>
              </Card>
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">说明</p>
              <p className="text-muted-foreground">{selectedLayer?.desc}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ ApplicationArchitecture ═══════════════════════ */
export function ApplicationArchitecture() {
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<(typeof APP_FLOW_MATRIX)[number] | null>(null);
  const { toast, setToast } = useToast();

  const filteredDeps = filterType
    ? APP_DEPENDENCIES.filter((d) => d.type === filterType)
    : APP_DEPENDENCIES;

  const depTypes = [...new Set(APP_DEPENDENCIES.map((d) => d.type))];

  function handleExport() {
    const data = { dependencies: APP_DEPENDENCIES, matrix: APP_FLOW_MATRIX };
    downloadJSON(data, "application-architecture.json");
    setToast("导出成功：application-architecture.json");
  }

  function handleExportCSV() {
    const headers = ["调用方", "被调用方", "调用次数", "类型"];
    const rows = APP_DEPENDENCIES.map((d) => [d.from, d.to, d.calls, d.type]);
    downloadCSV(headers, rows, "application-dependencies.csv");
    setToast("导出成功：application-dependencies.csv");
  }

  function handleAppClick(app: (typeof APP_FLOW_MATRIX)[number]) {
    setSelectedApp(app);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Server className="size-5 text-primary" /> 应用架构
          </h1>
          <p className="text-sm text-muted-foreground">应用全景 + 依赖关系 + 跨应用映射</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilter(!showFilter)}>
            <Filter className="size-3 mr-1" />筛选
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      {showFilter && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">按调用类型筛选：</span>
              <Button variant={filterType === "" ? "default" : "outline"} size="sm" onClick={() => setFilterType("")}>全部</Button>
              {depTypes.map((t) => (
                <Button key={t} variant={filterType === t ? "default" : "outline"} size="sm" onClick={() => setFilterType(t)}>{t}</Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setShowFilter(false); }}>
                <X className="size-3 mr-1" /> 关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { name: "应用总数", count: 6, icon: Smartphone, desc: "全部应用" },
          { name: "依赖关系", count: 18, icon: Link, desc: "调用次数 5,022/月" },
          { name: "流程映射", count: 32, icon: RefreshCw, desc: "应用-流程映射" },
          { name: "数据映射", count: 56, icon: BarChart3, desc: "应用-对象映射" },
        ].map((c) => (
          <Card key={c.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                  <div className="text-xl font-bold mt-1">{c.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
                </div>
                <c.icon className="size-8 text-muted-foreground" />
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
                  {filteredDeps.map((d, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
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
              {filteredDeps.length === 0 && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">无匹配的依赖关系</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用 x 流程 x 数据 矩阵</CardTitle>
              <CardDescription>每个应用的能力映射，点击行查看详情</CardDescription>
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
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleAppClick(m)}
                      >
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
              <CardDescription>6 个核心应用 + 数据中台 + AI 中台，点击查看详情</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 p-6 bg-muted/30 rounded">
                {APP_FLOW_MATRIX.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-lg border-2 border-primary/30 bg-card p-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                    onClick={() => handleAppClick(a)}
                  >
                    <div className="text-xl"><Smartphone className="size-5 mx-auto" /></div>
                    <div className="font-medium text-sm mt-1">{a.app}</div>
                    <div className="text-xs text-muted-foreground">{a.flows + a.data + a.pages} 项资产</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* App Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5" />
              {selectedApp?.app}
            </DialogTitle>
            <DialogDescription>应用资产详情</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Workflow className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.flows}</div>
                <div className="text-xs text-muted-foreground">流程</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Box className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.data}</div>
                <div className="text-xs text-muted-foreground">对象</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <FileText className="size-5 mx-auto text-muted-foreground" />
                <div className="text-xl font-bold mt-1">{selectedApp?.pages}</div>
                <div className="text-xs text-muted-foreground">页面</div>
              </CardContent>
            </Card>
          </div>
          {selectedApp && (
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium">复杂度评估</p>
              <p className="text-muted-foreground mt-1">
                综合得分: {(selectedApp.flows * 2 + selectedApp.data * 3 + selectedApp.pages)} 分
                (流程 x2 + 对象 x3 + 页面 x1)
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ DataArchitecture ═══════════════════════ */
export function DataArchitecture() {
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<(typeof DATA_DOMAINS)[number] | null>(null);
  const { toast, setToast } = useToast();

  function handleExport() {
    downloadJSON(DATA_DOMAINS, "data-architecture-domains.json");
    setToast("导出成功：data-architecture-domains.json");
  }

  function handleExportCSV() {
    const headers = ["域", "对象数", "关联应用"];
    const rows = DATA_DOMAINS.map((d) => [d.name, d.objects, d.apps.join("/")]);
    downloadCSV(headers, rows, "data-architecture-domains.csv");
    setToast("导出成功：data-architecture-domains.csv");
  }

  function handleDomainClick(domain: (typeof DATA_DOMAINS)[number]) {
    setSelectedDomain(domain);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Database className="size-5 text-primary" /> 数据架构
          </h1>
          <p className="text-sm text-muted-foreground">数据主题域 + 数据模型 + 湖仓分布</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DATA_DOMAINS.map((d) => (
          <Card key={d.name} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleDomainClick(d)}>
            <CardContent className="p-4 text-center">
              <div className={`size-12 rounded-full ${d.color} text-white flex items-center justify-center mx-auto`}>
                <d.icon className="size-6" />
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
              <div key={l.layer} className={`rounded border-l-4 ${l.color} border-y border-r p-3 cursor-pointer hover:border-primary transition-colors`}>
                <div className="text-xs text-muted-foreground">{l.layer}</div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xl font-bold mt-2">{l.count}</div>
                <div className="text-xs text-muted-foreground mt-1">{l.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Domain Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedDomain && <selectedDomain.icon className="size-5" />}
              {selectedDomain?.name}
            </DialogTitle>
            <DialogDescription>数据域详情</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">数据对象数</div>
                  <div className="text-xl font-bold mt-1">{selectedDomain?.objects}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">关联应用数</div>
                  <div className="text-xl font-bold mt-1">{selectedDomain?.apps.length}</div>
                </CardContent>
              </Card>
            </div>
            <div className="p-3 bg-muted rounded text-sm">
              <p className="font-medium mb-1">关联应用</p>
              <div className="flex gap-2 flex-wrap">
                {selectedDomain?.apps.map((app) => (
                  <Badge key={app} variant="secondary">{app}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════ TechArchitecture ═══════════════════════ */
export function TechArchitecture() {
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedStack, setSelectedStack] = useState<(typeof TECH_STACK)[number] | null>(null);
  const { toast, setToast } = useToast();

  function handleExport() {
    const data = { techStack: TECH_STACK, deploy: DEPLOY_TOPOLOGY, observability: OBSERVABILITY };
    downloadJSON(data, "tech-architecture.json");
    setToast("导出成功：tech-architecture.json");
  }

  function handleExportCSV() {
    const headers = ["层级", "技术"];
    const rows: (string | number)[][] = [];
    TECH_STACK.forEach((s) => s.items.forEach((t) => rows.push([s.layer, t])));
    downloadCSV(headers, rows, "tech-architecture.csv");
    setToast("导出成功：tech-architecture.csv");
  }

  function handleStackClick(stack: (typeof TECH_STACK)[number]) {
    setSelectedStack(stack);
    setShowDetailDialog(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Cpu className="size-5 text-primary" /> 技术架构
          </h1>
          <p className="text-sm text-muted-foreground">技术栈 + 部署拓扑 + 服务依赖</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">技术栈总览</CardTitle>
          <CardDescription>6 大层级，每层关键技术选型。点击层级查看详情。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TECH_STACK.map((s) => (
              <div
                key={s.layer}
                className="rounded-lg border p-3 cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleStackClick(s)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{s.layer}</Badge>
                  <span className="text-xs text-muted-foreground">{s.items.length} 项技术</span>
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
              {DEPLOY_TOPOLOGY.map((item) => (
                <div key={item.label} className="flex justify-between p-2 border rounded">
                  <span>{item.label}</span><span className="font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">可观测性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {OBSERVABILITY.map((item) => (
                <div key={item.label} className="flex justify-between p-2 border rounded">
                  <span>{item.label}</span><span className="font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tech Stack Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="size-5" />
              {selectedStack?.layer} 层技术栈
            </DialogTitle>
            <DialogDescription>包含 {selectedStack?.items.length} 项技术选型</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedStack?.items.map((item) => (
              <div key={item} className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium text-sm">{item}</span>
                <Badge variant="outline">{selectedStack.layer}</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
