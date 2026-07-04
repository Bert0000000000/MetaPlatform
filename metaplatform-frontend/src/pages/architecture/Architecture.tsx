import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Database, Server, Layers, GitBranch, FileText, Plus, Network, Cpu, Workflow, Box, ArrowRight, ArrowDown, BarChart3, Filter, Download, Link, Lightbulb, RefreshCw, User, Zap, Package, Megaphone, FlaskConical, Truck, Factory, Briefcase, Headphones, Smartphone, ClipboardList, DollarSign, Users, Handshake, X, Eye, Search, ChevronDown, Shield, Upload, Lock, Globe, ToggleLeft, ToggleRight,
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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [designMode, setDesignMode] = useState(true);
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
          {/* F3.5.4 设计态/运行态切换 */}
          <Button variant={designMode ? "default" : "outline"} size="sm" onClick={() => setDesignMode(!designMode)}>
            {designMode ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
            {designMode ? "设计态" : "运行态"}
          </Button>
          {/* F3.1.7 导入 */}
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="size-3 mr-1" />导入
          </Button>
          {/* F3.1.7 导出 */}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3 mr-1" />导出 JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3 mr-1" />导出 CSV
          </Button>
          {designMode && (
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="size-3 mr-1" />新增层级
            </Button>
          )}
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
          <TabsTrigger value="value">L1 价值链图</TabsTrigger>
          <TabsTrigger value="capability">L2 能力地图</TabsTrigger>
          <TabsTrigger value="roles">L4 业务角色</TabsTrigger>
          <TabsTrigger value="events">L5 业务事件</TabsTrigger>
          <TabsTrigger value="objects">L6 业务对象</TabsTrigger>
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
              <CardDescription>企业核心价值流转路径 - 研发 / 采购 / 生产 / 销售 / 服务</CardDescription>
            </CardHeader>
            <CardContent>
              {/* F3.1.1 SVG 价值链可视化 */}
              <div className="mb-4">
                <svg viewBox="0 0 900 160" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
                  {VALUE_CHAIN.map((v, i) => {
                    const x = 20 + i * 145;
                    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
                    return (
                      <g key={v.name}>
                        <rect x={x} y="20" width="120" height="80" rx="8" fill={colors[i]} fillOpacity="0.12" stroke={colors[i]} strokeWidth="2" />
                        <text x={x + 60} y="52" textAnchor="middle" fontSize="12" fontWeight="600" fill={colors[i]}>{v.name}</text>
                        <text x={x + 60} y="72" textAnchor="middle" fontSize="10" fill="#888">{v.apps.join(" / ")}</text>
                        {i < VALUE_CHAIN.length - 1 && (
                          <>
                            <line x1={x + 120} y1="60" x2={x + 145} y2="60" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                          </>
                        )}
                        <text x={x + 60} y="130" textAnchor="middle" fontSize="10" fill="#666">L{i + 1}</text>
                      </g>
                    );
                  })}
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                    </marker>
                  </defs>
                </svg>
              </div>
              {/* Fallback card view */}
              <div className="flex flex-wrap items-center gap-2">
                {VALUE_CHAIN.map((v, i) => (
                  <div key={v.name} className="flex items-center gap-2">
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10 cursor-pointer transition-colors">
                      <div className="text-2xl"><v.icon className="size-6" /></div>
                      <div className="font-medium text-sm mt-1">{v.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {v.apps.join(" . ")}
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
              <CardDescription>28 项业务能力，按一级分类组织。{designMode ? "设计态 - 可拖拽调整" : "运行态 - 只读查看"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CAPABILITY_LIST.map((c, i) => {
                  const subCaps = [
                    ["线索管理", "商机管理", "客户画像"],
                    ["订单管理", "报价管理", "合同管理"],
                    ["工单管理", "满意度调查", "知识库"],
                    ["供应商管理", "采购申请", "比价管理"],
                    ["生产计划", "质量检测", "库存管理"],
                    ["仓储管理", "物流配送", "库存盘点"],
                    ["应收应付", "总账管理", "预算管控"],
                    ["招聘管理", "薪酬绩效", "培训发展"],
                    ["项目管理", "需求管理", "版本发布"],
                    ["来料检验", "过程质量", "不良品处理"],
                    ["合同审查", "合规审计", "风险管理"],
                    ["战略规划", "经营分析", "KPI 管理"],
                  ][i] || ["子能力 A", "子能力 B"];
                  return (
                    <div key={c} className={`rounded border p-3 ${designMode ? "hover:border-primary cursor-pointer" : ""} transition-colors`}>
                      <div className="font-medium text-sm">{c}</div>
                      <div className="mt-2 space-y-1">
                        {subCaps.map((sub) => (
                          <div key={sub} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <div className="size-1.5 rounded-full bg-primary/40" />
                            {sub}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        {subCaps.length} 项子能力
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.4 L4 业务角色 */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L4 业务角色矩阵</CardTitle>
              <CardDescription>执行业务流程的角色定义及其能力映射</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">角色</th>
                    <th className="px-4 py-2 font-medium">所属部门</th>
                    <th className="px-4 py-2 font-medium">核心能力</th>
                    <th className="px-4 py-2 font-medium text-center">关联流程</th>
                    <th className="px-4 py-2 font-medium text-center">关联应用</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { role: "销售经理", dept: "销售部", caps: ["商机管理", "报价管理", "客户画像"], flows: 5, apps: 2 },
                    { role: "采购主管", dept: "采购部", caps: ["供应商管理", "采购申请", "比价管理"], flows: 4, apps: 2 },
                    { role: "生产主管", dept: "制造部", caps: ["生产计划", "质量检测", "库存管理"], flows: 6, apps: 2 },
                    { role: "财务主管", dept: "财务部", caps: ["应收应付", "总账管理", "预算管控"], flows: 3, apps: 2 },
                    { role: "HR 主管", dept: "人力资源", caps: ["招聘管理", "薪酬绩效", "培训发展"], flows: 4, apps: 1 },
                    { role: "客服主管", dept: "客服中心", caps: ["工单管理", "满意度调查", "知识库"], flows: 3, apps: 2 },
                    { role: "研发主管", dept: "研发中心", caps: ["项目管理", "需求管理", "版本发布"], flows: 5, apps: 1 },
                    { role: "合规专员", dept: "法务部", caps: ["合同审查", "合规审计", "风险管理"], flows: 2, apps: 1 },
                  ].map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <User className="size-4 text-primary" /> {r.role}
                      </td>
                      <td className="px-4 py-3">{r.dept}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {r.caps.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{r.flows}</td>
                      <td className="px-4 py-3 text-center">{r.apps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.5 L5 业务事件 */}
        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L5 业务事件目录</CardTitle>
              <CardDescription>业务事件定义、触发条件和处理链</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">事件名称</th>
                    <th className="px-4 py-2 font-medium">触发条件</th>
                    <th className="px-4 py-2 font-medium">事件类型</th>
                    <th className="px-4 py-2 font-medium">处理流程</th>
                    <th className="px-4 py-2 font-medium text-center">频率/天</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "客户创建", trigger: "CRM 新建客户", type: "业务事件", process: "客户审核流程", freq: 32 },
                    { name: "订单生成", trigger: "下单完成", type: "业务事件", process: "订单确认流程", freq: 128 },
                    { name: "库存预警", trigger: "库存低于阈值", type: "系统事件", process: "自动补货流程", freq: 8 },
                    { name: "审批超时", trigger: "审批节点超 48h", type: "异常事件", process: "升级通知流程", freq: 5 },
                    { name: "合同到期", trigger: "合同到期前 30 天", type: "时间事件", process: "续约提醒流程", freq: 3 },
                    { name: "支付成功", trigger: "支付回调", type: "系统事件", process: "订单状态更新", freq: 96 },
                    { name: "质量不合格", trigger: "检验不通过", type: "异常事件", process: "退货处理流程", freq: 2 },
                    { name: "员工入职", trigger: "HR 系统新增", type: "业务事件", process: "入职审批流程", freq: 4 },
                  ].map((e, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{e.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.trigger}</td>
                      <td className="px-4 py-3">
                        <Badge variant={e.type === "异常事件" ? "destructive" : e.type === "系统事件" ? "default" : "secondary"}>
                          {e.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{e.process}</td>
                      <td className="px-4 py-3 text-center">{e.freq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.1.6 L6 业务对象 */}
        <TabsContent value="objects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">L6 业务对象总览</CardTitle>
              <CardDescription>业务层面的核心对象及其所属域</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: "客户", domain: "客户域", fields: 24, relations: 8, icon: Users },
                  { name: "订单", domain: "订单域", fields: 32, relations: 12, icon: ClipboardList },
                  { name: "产品", domain: "产品域", fields: 18, relations: 6, icon: Package },
                  { name: "供应商", domain: "采购域", fields: 20, relations: 5, icon: Truck },
                  { name: "员工", domain: "人事域", fields: 28, relations: 10, icon: User },
                  { name: "合同", domain: "法务域", fields: 15, relations: 4, icon: FileText },
                  { name: "发票", domain: "财务域", fields: 12, relations: 3, icon: DollarSign },
                  { name: "工单", domain: "客服域", fields: 16, relations: 6, icon: ClipboardList },
                  { name: "项目", domain: "研发域", fields: 22, relations: 8, icon: Briefcase },
                ].map((obj, i) => (
                  <div key={i} className="rounded-lg border p-4 hover:border-primary cursor-pointer transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <obj.icon className="size-5 text-primary" />
                        <span className="font-medium">{obj.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{obj.domain}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>{obj.fields} 字段</div>
                      <div>{obj.relations} 关系</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* F3.1.7 导入 Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5" /> 导入业务架构
            </DialogTitle>
            <DialogDescription>上传 JSON 文件导入业务架构定义</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">点击或拖拽文件到此处</p>
              <p className="text-xs text-muted-foreground mt-1">支持 .json / .csv 格式</p>
              <Input type="file" accept=".json,.csv" className="mt-3 max-w-xs mx-auto" />
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">导入说明</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>JSON 格式需包含 layers 数组</li>
                <li>CSV 需包含列：层级, 名称, 描述, 数量</li>
                <li>导入将覆盖现有数据</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>取消</Button>
            <Button onClick={() => { setShowImportDialog(false); setToast("导入成功（Mock）"); }}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <TabsTrigger value="graph">依赖关系图</TabsTrigger>
          <TabsTrigger value="biz-app">业务-应用联动</TabsTrigger>
          <TabsTrigger value="app-data">应用-数据联动</TabsTrigger>
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
              <CardTitle className="text-base">应用依赖关系图</CardTitle>
              <CardDescription>应用间调用关系的力导向图可视化</CardDescription>
            </CardHeader>
            <CardContent>
              {/* F3.2.2 SVG 依赖关系图 */}
              <svg viewBox="0 0 700 400" className="w-full h-auto bg-muted/20 rounded-lg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="dep-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                  </marker>
                </defs>
                {/* Nodes - positioned in a circular layout */}
                {[
                  { name: "CRM", x: 350, y: 60, color: "#3b82f6" },
                  { name: "数据中台", x: 150, y: 200, color: "#22c55e" },
                  { name: "报销审批", x: 550, y: 200, color: "#f97316" },
                  { name: "销售看板", x: 250, y: 340, color: "#8b5cf6" },
                  { name: "智能体助手", x: 450, y: 340, color: "#ec4899" },
                  { name: "采购流程", x: 100, y: 100, color: "#eab308" },
                  { name: "ERP", x: 600, y: 100, color: "#14b8a6" },
                ].map((node) => (
                  <g key={node.name}>
                    <rect x={node.x - 50} y={node.y - 20} width="100" height="40" rx="8" fill={node.color} fillOpacity="0.15" stroke={node.color} strokeWidth="2" />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="12" fontWeight="600" fill={node.color}>{node.name}</text>
                  </g>
                ))}
                {/* Dependency arrows */}
                {APP_DEPENDENCIES.map((dep, i) => {
                  const nodeMap: Record<string, { x: number; y: number }> = {
                    "客户管理 CRM": { x: 350, y: 60 },
                    "数据中台": { x: 150, y: 200 },
                    "报销审批": { x: 550, y: 200 },
                    "销售看板": { x: 250, y: 340 },
                    "智能体助手": { x: 450, y: 340 },
                    "采购流程": { x: 100, y: 100 },
                    "ERP": { x: 600, y: 100 },
                    "财务系统": { x: 550, y: 200 },
                  };
                  const from = nodeMap[dep.from] || { x: 350, y: 200 };
                  const to = nodeMap[dep.to] || { x: 350, y: 200 };
                  return (
                    <g key={i}>
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#dep-arrow)" />
                      <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fontSize="9" fill="#666">{dep.calls}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-6 h-0.5 bg-gray-400" style={{ borderTop: "1.5px dashed #94a3b8" }} /> 调用依赖</div>
                <div>节点 = 应用系统</div>
                <div>数字 = 月调用次数</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.5.1 业务-应用联动 */}
        <TabsContent value="biz-app" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">业务-应用联动矩阵</CardTitle>
              <CardDescription>业务流程与应用系统的映射关系</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">业务流程</th>
                    <th className="px-4 py-2 font-medium text-center">CRM</th>
                    <th className="px-4 py-2 font-medium text-center">ERP</th>
                    <th className="px-4 py-2 font-medium text-center">HR</th>
                    <th className="px-4 py-2 font-medium text-center">BI</th>
                    <th className="px-4 py-2 font-medium text-center">OA</th>
                    <th className="px-4 py-2 font-medium text-center">BPM</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { process: "客户跟进", crm: true, erp: false, hr: false, bi: true, oa: false, bpm: false },
                    { process: "采购审批", crm: false, erp: true, hr: false, bi: false, oa: true, bpm: true },
                    { process: "员工入职", crm: false, erp: false, hr: true, bi: false, oa: true, bpm: true },
                    { process: "报销流程", crm: false, erp: true, hr: false, bi: false, oa: true, bpm: true },
                    { process: "销售预测", crm: true, erp: true, hr: false, bi: true, oa: false, bpm: false },
                    { process: "绩效考核", crm: false, erp: false, hr: true, bi: true, oa: true, bpm: false },
                    { process: "合同审批", crm: true, erp: true, hr: false, bi: false, oa: true, bpm: true },
                    { process: "库存盘点", crm: false, erp: true, hr: false, bi: true, oa: false, bpm: false },
                  ].map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.process}</td>
                      {([row.crm, row.erp, row.hr, row.bi, row.oa, row.bpm]).map((v, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          <div className={`size-4 rounded mx-auto ${v ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* F3.5.2 应用-数据联动 */}
        <TabsContent value="app-data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用-数据联动矩阵</CardTitle>
              <CardDescription>应用系统与数据源的映射关系</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">应用系统</th>
                    <th className="px-4 py-2 font-medium text-center">客户域</th>
                    <th className="px-4 py-2 font-medium text-center">订单域</th>
                    <th className="px-4 py-2 font-medium text-center">产品域</th>
                    <th className="px-4 py-2 font-medium text-center">财务域</th>
                    <th className="px-4 py-2 font-medium text-center">人事域</th>
                    <th className="px-4 py-2 font-medium text-center">运营域</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { app: "CRM", domains: [true, true, false, false, false, true] },
                    { app: "ERP", domains: [false, true, true, true, false, false] },
                    { app: "HR", domains: [false, false, false, false, true, false] },
                    { app: "BI", domains: [true, true, true, true, true, true] },
                    { app: "OA", domains: [false, false, false, true, true, false] },
                    { app: "BPM", domains: [false, false, false, false, false, false] },
                  ].map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.app}</td>
                      {row.domains.map((v, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          <div className={`size-4 rounded mx-auto ${v ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* F3.3.4 数据分布（湖仓） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据分布总览</CardTitle>
          <CardDescription>数据在湖仓 / 实时 / 离线三层的分布情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 数据湖 */}
            <div className="rounded-lg border-2 border-blue-200 dark:border-blue-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="size-5 text-blue-500" />
                <span className="font-medium">数据湖 (Data Lake)</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: "原始日志", size: "2.4 TB", tables: 128 },
                  { name: "埋点数据", size: "1.8 TB", tables: 64 },
                  { name: "外部数据", size: "640 GB", tables: 32 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-blue-50/50 dark:bg-blue-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} 表</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 224 张表</span>
                <span className="font-mono font-bold">4.84 TB</span>
              </div>
            </div>
            {/* 数仓 */}
            <div className="rounded-lg border-2 border-green-200 dark:border-green-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Box className="size-5 text-green-500" />
                <span className="font-medium">数仓 (Warehouse)</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: "ODS 原始层", size: "1.2 TB", tables: 38 },
                  { name: "DWD 明细层", size: "860 GB", tables: 24 },
                  { name: "DWS 汇总层", size: "320 GB", tables: 12 },
                  { name: "ADS 应用层", size: "480 GB", tables: 18 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-green-50/50 dark:bg-green-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} 表</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 92 张表</span>
                <span className="font-mono font-bold">2.86 TB</span>
              </div>
            </div>
            {/* 实时 */}
            <div className="rounded-lg border-2 border-orange-200 dark:border-orange-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="size-5 text-orange-500" />
                <span className="font-medium">实时层 (Realtime)</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Kafka Topics", size: "128 GB", tables: 16 },
                  { name: "Redis 缓存", size: "32 GB", tables: 8 },
                  { name: "ClickHouse", size: "256 GB", tables: 6 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded bg-orange-50/50 dark:bg-orange-950/20 text-sm">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.tables} Topic</span>
                      <span className="font-mono">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>合计 30 个实例</span>
                <span className="font-mono font-bold">416 GB</span>
              </div>
            </div>
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
  const [designMode, setDesignMode] = useState(true);
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
          {/* F3.5.4 设计态/运行态切换 */}
          <Button variant={designMode ? "default" : "outline"} size="sm" onClick={() => setDesignMode(!designMode)}>
            {designMode ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
            {designMode ? "设计态" : "运行态"}
          </Button>
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
          <CardDescription>6 大层级，每层关键技术选型。{designMode ? "设计态 - 可编辑" : "运行态 - 只读"}。点击层级查看详情。</CardDescription>
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
        {/* F3.4.2 部署拓扑图 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部署拓扑图</CardTitle>
            <CardDescription>服务器 / 容器 / 区域部署架构</CardDescription>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 400 300" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
              {/* Region */}
              <rect x="10" y="10" width="380" height="280" rx="8" fill="#f0f9ff" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" />
              <text x="30" y="30" fontSize="11" fontWeight="600" fill="#3b82f6">Region: China-East-2</text>
              {/* Load Balancer */}
              <rect x="130" y="45" width="140" height="35" rx="6" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="200" y="67" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e40af">Nginx + Istio</text>
              {/* K8s Cluster */}
              <rect x="30" y="100" width="340" height="170" rx="6" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1" strokeDasharray="4 2" />
              <text x="50" y="120" fontSize="10" fontWeight="600" fill="#22c55e">K8s 1.29 Cluster (3 Nodes)</text>
              {/* Pods */}
              {[
                { name: "API Gateway", x: 50, y: 135, color: "#8b5cf6" },
                { name: "App Service", x: 155, y: 135, color: "#3b82f6" },
                { name: "AI Service", x: 260, y: 135, color: "#ec4899" },
                { name: "DB Primary", x: 50, y: 200, color: "#f97316" },
                { name: "DB Replica", x: 155, y: 200, color: "#f97316" },
                { name: "Redis", x: 260, y: 200, color: "#ef4444" },
              ].map((pod) => (
                <g key={pod.name}>
                  <rect x={pod.x} y={pod.y} width="90" height="50" rx="6" fill={pod.color} fillOpacity="0.1" stroke={pod.color} strokeWidth="1.5" />
                  <text x={pod.x + 45} y={pod.y + 30} textAnchor="middle" fontSize="10" fontWeight="500" fill={pod.color}>{pod.name}</text>
                </g>
              ))}
              {/* Lines from LB to pods */}
              <line x1="170" y1="80" x2="95" y2="135" stroke="#94a3b8" strokeWidth="1" />
              <line x1="200" y1="80" x2="200" y2="135" stroke="#94a3b8" strokeWidth="1" />
              <line x1="230" y1="80" x2="305" y2="135" stroke="#94a3b8" strokeWidth="1" />
            </svg>
            <div className="text-xs text-muted-foreground mt-2">
              {designMode ? "设计态：可拖拽调整节点位置" : "运行态：实时健康状态监控"}
            </div>
          </CardContent>
        </Card>

        {/* F3.4.3 服务依赖图 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">服务依赖图</CardTitle>
            <CardDescription>微服务间通信关系</CardDescription>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 400 300" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="svc-arrow" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto">
                  <polygon points="0 0, 6 2.5, 0 5" fill="#94a3b8" />
                </marker>
              </defs>
              {/* Service nodes */}
              {[
                { name: "API Gateway", x: 200, y: 40, color: "#8b5cf6" },
                { name: "User Service", x: 80, y: 130, color: "#3b82f6" },
                { name: "Order Service", x: 200, y: 130, color: "#22c55e" },
                { name: "AI Service", x: 320, y: 130, color: "#ec4899" },
                { name: "Auth Service", x: 80, y: 230, color: "#f97316" },
                { name: "DB Service", x: 200, y: 230, color: "#eab308" },
                { name: "LLM Gateway", x: 320, y: 230, color: "#ef4444" },
              ].map((svc) => (
                <g key={svc.name}>
                  <circle cx={svc.x} cy={svc.y} r="28" fill={svc.color} fillOpacity="0.1" stroke={svc.color} strokeWidth="2" />
                  <text x={svc.x} y={svc.y + 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={svc.color}>{svc.name}</text>
                </g>
              ))}
              {/* Service connections */}
              {[
                { from: { x: 200, y: 68 }, to: { x: 80, y: 102 } },
                { from: { x: 200, y: 68 }, to: { x: 200, y: 102 } },
                { from: { x: 200, y: 68 }, to: { x: 320, y: 102 } },
                { from: { x: 80, y: 158 }, to: { x: 80, y: 202 } },
                { from: { x: 200, y: 158 }, to: { x: 200, y: 202 } },
                { from: { x: 320, y: 158 }, to: { x: 320, y: 202 } },
                { from: { x: 108, y: 130 }, to: { x: 172, y: 130 } },
                { from: { x: 228, y: 130 }, to: { x: 292, y: 130 } },
              ].map((conn, i) => (
                <line key={i} x1={conn.from.x} y1={conn.from.y} x2={conn.to.x} y2={conn.to.y} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#svc-arrow)" />
              ))}
            </svg>
            <div className="text-xs text-muted-foreground mt-2">
              圆形节点 = 微服务 | 箭头 = 调用方向 | 共 7 个核心服务
            </div>
          </CardContent>
        </Card>
      </div>

      {/* F3.4.4 技术选型矩阵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">技术选型对比矩阵</CardTitle>
          <CardDescription>各技术层候选方案对比评估</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">技术层</th>
                <th className="px-4 py-2 font-medium">候选方案 A</th>
                <th className="px-4 py-2 font-medium">候选方案 B</th>
                <th className="px-4 py-2 font-medium">选定方案</th>
                <th className="px-4 py-2 font-medium text-center">评分</th>
              </tr>
            </thead>
            <tbody>
              {[
                { layer: "前端框架", a: "React 19", b: "Vue 3.4", chosen: "React 19", score: 92 },
                { layer: "UI 组件库", a: "shadcn/ui", b: "Ant Design 5", chosen: "shadcn/ui", score: 88 },
                { layer: "后端框架", a: "Spring Boot 3", b: "NestJS 10", chosen: "Spring Boot 3", score: 90 },
                { layer: "关系数据库", a: "PostgreSQL 16", b: "MySQL 8", chosen: "PostgreSQL 16", score: 95 },
                { layer: "图数据库", a: "Neo4j 5", b: "ArangoDB", chosen: "Neo4j 5", score: 85 },
                { layer: "向量数据库", a: "Milvus 2.4", b: "Weaviate", chosen: "Milvus 2.4", score: 87 },
                { layer: "消息队列", a: "Kafka 3.6", b: "RocketMQ 5", chosen: "Kafka 3.6", score: 91 },
                { layer: "容器编排", a: "Kubernetes", b: "Docker Swarm", chosen: "Kubernetes", score: 96 },
                { layer: "AI 模型", a: "DeepSeek", b: "Qwen 2", chosen: "DeepSeek", score: 89 },
              ].map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{row.layer}</td>
                  <td className="px-4 py-3">{row.a}</td>
                  <td className="px-4 py-3">{row.b}</td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{row.chosen}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={row.score >= 90 ? "default" : row.score >= 85 ? "secondary" : "outline"}>
                      {row.score}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
