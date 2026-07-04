import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { ROLES, WORKSPACE_BY_ROLE } from "@/config/menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appsApi, messagesApi, agentsApi } from "@/lib/api";
import type { Application, Message, Agent } from "@/lib/api";
import {
  ArrowRight, Plus, MessageCircle, GitBranch, Bell, CheckCircle2, AlertCircle,
  Clock, Pencil, Rocket, FileText, RefreshCw, Box,
  ClipboardList, BarChart3, Bot, User, Sparkles, Loader2,
  Smartphone, Send, Globe, Layout, Eye, Settings, Users, Trash2,
  Star, Monitor, Workflow, Megaphone, ChevronRight, Zap, CreditCard, PieChart,
  Grid, List, Link2, Share2, Printer, Download, GripVertical, Type, Image as ImageIcon,
  Square, Table as TableIcon, Minus, Maximize, Move, X, ChevronDown, Search,
  Mic, MicOff, Paperclip, FileSpreadsheet, File as FileIcon, Camera,
  Merge, Split, Fingerprint, Target, Layers, Database, ShieldCheck, Columns,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

/* ── Icon resolver: API icon string → Lucide component ── */
const ICON_MAP: Record<string, React.ElementType> = {
  ClipboardList, FileText, BarChart3, Bot, User, Sparkles, Box,
};
function resolveIcon(iconName?: string): React.ElementType {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return Box;
}

/* ── Mock data that stays (no API for audit log on dashboard) ── */
const RECENT_ACTIVITIES = [
  { time: "10:42", actor: "张伟", action: "修改了", target: "客户对象 / 客户等级字段", icon: Pencil, link: "/ontology" },
  { time: "09:15", actor: "李娜", action: "部署了", target: "CRM v2.3 → 测试环境", icon: Rocket, link: "/apps" },
  { time: "昨天", actor: "王强", action: "新建了", target: "3 个页面（销售看板）", icon: FileText, link: "/apps" },
  { time: "昨天", actor: "刘敏", action: "配置了", target: "采购审批工作流（5 节点）", icon: RefreshCw, link: "/process" },
  { time: "2 天前", actor: "陈红", action: "发布了", target: "OA 系统 v1.8 生产版本", icon: CheckCircle2, link: "/apps" },
];

const ANNOUNCEMENTS = [
  { id: 1, title: "v1.3 新版本发布预告", time: "今早", type: "feature", link: "/admin" },
  { id: 2, title: "本周六 02:00-04:00 系统升级维护", time: "昨天", type: "warning", link: "/admin" },
  { id: 3, title: "AI 助手新增自然语言生成对象能力", time: "3 天前", type: "feature", link: "/admin" },
];

/* ── Priority icon helper for messages ── */
function PriorityIcon({ type }: { type: string }) {
  if (type === "approval" || type === "urgent") return <AlertCircle className="size-4 text-red-500 shrink-0" />;
  if (type === "task" || type === "warning") return <Clock className="size-4 text-orange-500 shrink-0" />;
  return <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />;
}

export function DashboardPage() {
  const { role } = useRole();
  const navigate = useNavigate();
  const current = ROLES.find((r) => r.id === role);
  const cards = WORKSPACE_BY_ROLE[role] ?? [];

  /* ── API state ── */
  const [apps, setApps] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* ── Fetch real data ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsData, msgsData, agentsData] = await Promise.allSettled([
        appsApi.list(),
        messagesApi.list(),
        agentsApi.list(),
      ]);
      if (appsData.status === "fulfilled") setApps(appsData.value);
      if (msgsData.status === "fulfilled") setMessages(msgsData.value);
      if (agentsData.status === "fulfilled") setAgents(agentsData.value);
      // If all failed, show error
      if (appsData.status === "rejected" && msgsData.status === "rejected" && agentsData.status === "rejected") {
        setError("无法连接后端服务，使用本地缓存数据");
      }
    } catch {
      setError("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Toast auto-clear ── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Computed values ── */
  const unreadMessages = messages.filter((m) => !m.read);
  const activeAgents = agents.filter((a) => a.status === "active" || a.status === "online");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            欢迎回来，{current?.label ?? role}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current?.description} · 工作台（角色化视图）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="size-3 mr-1" /> 重试
            </Button>
          )}
          <Badge variant="secondary">v1.2</Badge>
        </div>
      </div>

      {/* Stat cards - use real data counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => card.link && navigate(card.link)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <card.icon className="size-5" />
                {card.link && (
                  <ArrowRight className="size-4 text-muted-foreground" />
                )}
              </div>
              <CardTitle className="text-base mt-2">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            {card.link && (
              <CardContent>
                <Button variant="ghost" size="sm" className="px-0">
                  查看详情 →
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Quick stats from real API data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">应用总数</div>
            <div className="text-xl font-bold mt-1">
              {loading ? <Loader2 className="size-5 animate-spin" /> : apps.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">未读消息</div>
            <div className="text-xl font-bold mt-1 text-red-600">
              {loading ? <Loader2 className="size-5 animate-spin" /> : unreadMessages.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">数字员工</div>
            <div className="text-xl font-bold mt-1">
              {loading ? <Loader2 className="size-5 animate-spin" /> : agents.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">在线智能体</div>
            <div className="text-xl font-bold mt-1 text-green-600">
              {loading ? <Loader2 className="size-5 animate-spin" /> : activeAgents.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 我的应用 - real API data */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">最近应用</CardTitle>
            <CardDescription>
              {loading ? "加载中..." : `你最近访问的应用（${apps.length} 个）`}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/apps")}>
            <Plus className="size-3 mr-1" />
            新建应用
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> 加载中...
            </div>
          ) : apps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Box className="size-8 mb-2" />
              <p className="text-sm">暂无应用</p>
              <Button variant="link" size="sm" onClick={() => navigate("/apps/new")}>
                去创建第一个应用
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {apps.map((app) => {
                const Icon = resolveIcon(app.icon);
                return (
                  <button
                    key={app.id}
                    onClick={() => navigate(`/apps/${app.id}/overview`)}
                    className="text-left rounded-lg border p-3 hover:border-primary transition-colors"
                  >
                    <div className="mb-2"><Icon className="size-5" /></div>
                    <div className="font-medium text-sm truncate">{app.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {app.category} · v{app.version}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Box className="size-3" /> {app.objects_count}</span>
                      <span className="flex items-center gap-1"><FileText className="size-3" /> {app.pages_count}</span>
                      <span className="flex items-center gap-1"><GitBranch className="size-3" /> {app.flows_count}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>团队最近的操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {RECENT_ACTIVITIES.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm p-1.5 -mx-1.5 rounded hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => a.link && navigate(a.link)}
                >
                  <span className="size-7 rounded-full bg-muted flex items-center justify-center">
                    <a.icon className="size-4" />
                  </span>
                  <div className="flex-1">
                    <span className="text-muted-foreground">{a.actor}</span>{" "}
                    <span>{a.action}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.time}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>快速入口</CardTitle>
            <CardDescription>常用操作</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate("/apps/new")}
            >
              <Plus className="size-4 mr-2" />
              新建应用
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate("/superai")}
            >
              <MessageCircle className="size-4 mr-2" />
              AI 助手
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate("/process")}
            >
              <GitBranch className="size-4 mr-2" />
              流程中心
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 待办事项 - from real messages API */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">待办事项</CardTitle>
            <Badge variant="destructive">{loading ? "..." : unreadMessages.length}</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" /> 加载中...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CheckCircle2 className="size-6 mb-1 text-green-500" />
                <p className="text-sm">暂无待办</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {messages.slice(0, 5).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => {
                      if (m.link) {
                        navigate(m.link);
                      } else {
                        navigate("/process/approval");
                      }
                    }}
                  >
                    <PriorityIcon type={m.type} />
                    <span className={`flex-1 text-sm truncate ${!m.read ? "font-medium" : ""}`}>
                      {m.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {m.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString("zh-CN") : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 系统公告 - clickable links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统公告</CardTitle>
            <CardDescription>平台动态与维护通知</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ANNOUNCEMENTS.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => navigate(n.link)}
                >
                  <Bell className={`size-4 shrink-0 mt-0.5 ${n.type === "warning" ? "text-orange-500" : "text-primary"}`} />
                  <div className="flex-1">
                    <div className="text-sm">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.time}</div>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground mt-1 shrink-0" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────── MyApps ─────────────────── */
export function MyApps() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appsApi.list().then((data) => { setApps(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="我的应用" description="我创建和使用的应用" action={<Button className="gap-2" onClick={() => navigate("/apps/new")}><Plus className="size-4" /> 新建应用</Button>} />
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />加载中...</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Box className="size-10 mx-auto mb-3 opacity-40" /><p className="text-sm">暂无应用</p><Button variant="link" size="sm" onClick={() => navigate("/apps/new")}>去创建</Button></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {apps.map((app) => (
            <Card key={app.id} className="cursor-pointer hover:border-primary" onClick={() => navigate(`/apps/${app.id}/overview`)}>
              <CardHeader>
                <div className="flex items-start justify-between"><Smartphone className="size-8 text-primary" /><Badge variant="secondary">v{app.version}</Badge></div>
                <CardTitle className="text-base mt-2">{app.name}</CardTitle>
                <CardDescription>{app.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span><Box className="size-3 inline mr-1" />{app.objects_count} 对象</span>
                  <span><FileText className="size-3 inline mr-1" />{app.pages_count} 页面</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── MyAgents ─────────────────── */
export function MyAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentsApi.list().then((data) => { setAgents(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="我的数字员工" description="分配给我的 AI 数字员工" action={<Button className="gap-2"><Plus className="size-4" /> 创建数字员工</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="数字员工" value={agents.length} icon={Bot} />
        <StatCard label="在线" value={agents.filter((a) => a.status === "active" || a.status === "online").length} icon={CheckCircle2} />
        <StatCard label="本月任务" value={156} icon={ClipboardList} />
        <StatCard label="成功率" value="98.2%" icon={BarChart3} />
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />加载中...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <Card key={a.id} className="hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between"><Bot className="size-8 text-primary" /><div className={`size-2 rounded-full ${a.status === "active" || a.status === "online" ? "bg-green-500" : "bg-gray-400"}`} /></div>
                <CardTitle className="text-base mt-2">{a.name}</CardTitle>
                <CardDescription>{a.description || a.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2"><Button size="sm" variant="outline" className="flex-1"><MessageCircle className="size-3 mr-1" />对话</Button><Button size="sm" variant="outline" className="flex-1"><Settings className="size-3 mr-1" />配置</Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── DashboardMessages ─────────────────── */
export function DashboardMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesApi.list().then((data) => { setMessages(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const unread = messages.filter((m) => !m.read);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="消息" description="系统通知、审批提醒和团队消息" action={<Button variant="outline" className="gap-2"><CheckCircle2 className="size-4" /> 全部已读</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="未读消息" value={unread.length} icon={Bell} />
        <StatCard label="总消息" value={messages.length} icon={Send} />
        <StatCard label="今日新增" value={5} icon={Clock} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="size-4" /> 消息列表</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />加载中...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><CheckCircle2 className="size-8 mx-auto mb-2 text-green-500" /><p className="text-sm">暂无消息</p></div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 ${!m.read ? "bg-primary/5" : ""}`}>
                  <PriorityIcon type={m.type} />
                  <div className="flex-1">
                    <div className={`text-sm ${!m.read ? "font-semibold" : ""}`}>{m.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.created_at ? new Date(m.created_at).toLocaleString("zh-CN") : ""}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{m.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────── Portal (F1.5: PC + Mobile) ─────────────────── */
const PORTAL_CATEGORIES = [
  { name: "业务系统", color: "bg-blue-500", icon: Briefcase },
  { name: "数据工具", color: "bg-green-500", icon: PieChart },
  { name: "协作办公", color: "bg-purple-500", icon: Users },
  { name: "流程引擎", color: "bg-orange-500", icon: Workflow },
  { name: "AI 应用", color: "bg-pink-500", icon: Sparkles },
  { name: "开发工具", color: "bg-cyan-500", icon: Settings },
];

const PORTAL_APPS = [
  { id: "crm", name: "CRM 客户管理", category: "业务系统", icon: Users, color: "bg-blue-500/10 text-blue-600", desc: "客户关系管理", pages: 12, version: "2.3", lastUsed: "10 分钟前" },
  { id: "erp", name: "ERP 企业资源", category: "业务系统", icon: Package, color: "bg-blue-500/10 text-blue-600", desc: "企业资源规划", pages: 24, version: "1.8", lastUsed: "30 分钟前" },
  { id: "hr", name: "HR 人力资源", category: "业务系统", icon: User, color: "bg-blue-500/10 text-blue-600", desc: "人力资源管理", pages: 18, version: "3.1", lastUsed: "1 小时前" },
  { id: "bi", name: "BI 数据分析", category: "数据工具", icon: BarChart3, color: "bg-green-500/10 text-green-600", desc: "商业智能分析", pages: 8, version: "1.5", lastUsed: "2 小时前" },
  { id: "oa", name: "OA 协同办公", category: "协作办公", icon: FileText, color: "bg-purple-500/10 text-purple-600", desc: "日常办公协同", pages: 15, version: "4.0", lastUsed: "3 小时前" },
  { id: "bpm", name: "BPM 流程管理", category: "流程引擎", icon: GitBranch, color: "bg-orange-500/10 text-orange-600", desc: "业务流程管理", pages: 6, version: "2.0", lastUsed: "昨天" },
  { id: "ai-assist", name: "AI 智能助手", category: "AI 应用", icon: Bot, color: "bg-pink-500/10 text-pink-600", desc: "AI 辅助决策", pages: 4, version: "1.2", lastUsed: "昨天" },
  { id: "devops", name: "DevOps 研发", category: "开发工具", icon: Settings, color: "bg-cyan-500/10 text-cyan-600", desc: "研发运维管理", pages: 10, version: "1.0", lastUsed: "2 天前" },
  { id: "scm", name: "SCM 供应链", category: "业务系统", icon: Box, color: "bg-blue-500/10 text-blue-600", desc: "供应链管理", pages: 16, version: "1.6", lastUsed: "3 天前" },
  { id: "finance", name: "财务管理系统", category: "数据工具", icon: CreditCard, color: "bg-green-500/10 text-green-600", desc: "财务核算管理", pages: 20, version: "2.5", lastUsed: "本周" },
];

const PORTAL_ANNOUNCEMENTS = [
  { id: 1, title: "v2.0 全新改版上线通知", type: "feature", time: "今天 09:00", content: "全新门户首页改版，支持自定义布局和应用收藏" },
  { id: 2, title: "本周六凌晨系统维护公告", type: "warning", time: "昨天 14:30", content: "2026-07-05 02:00-06:00 系统升级维护" },
  { id: 3, title: "AI 助手新增多模态输入能力", type: "feature", time: "3 天前", content: "支持图片、语音、文档多模态输入" },
  { id: 4, title: "数据安全合规培训通知", type: "info", time: "1 周前", content: "请全员于 7 月 10 日前完成数据安全培训" },
];

const QUICK_ACTIONS = [
  { name: "发起审批", icon: GitBranch, color: "text-blue-600 bg-blue-50", link: "/process/approval" },
  { name: "创建任务", icon: ClipboardList, color: "text-green-600 bg-green-50", link: "/dashboard/messages" },
  { name: "新建应用", icon: Plus, color: "text-purple-600 bg-purple-50", link: "/apps/new" },
  { name: "数据查询", icon: Search, color: "text-orange-600 bg-orange-50", link: "/data/ask" },
  { name: "AI 助手", icon: Sparkles, color: "text-pink-600 bg-pink-50", link: "/superai" },
  { name: "知识库", icon: FileText, color: "text-cyan-600 bg-cyan-50", link: "/knowledge" },
];

const PORTAL_TODOS = [
  { id: 1, title: "审批：采购单 #2026-07-0231", type: "approval", urgency: "high", time: "30 分钟前", link: "/process/approval" },
  { id: 2, title: "任务：完成 Q3 销售预测报告", type: "task", urgency: "medium", time: "2 小时前", link: "/process/approval" },
  { id: 3, title: "审批：报销单 #BX-20260703", type: "approval", urgency: "low", time: "昨天", link: "/process/approval" },
  { id: 4, title: "任务：更新客户资料 #CRM-8932", type: "task", urgency: "medium", time: "昨天", link: "/process/approval" },
  { id: 5, title: "审批：合同续签 #HT-2026-Q3", type: "approval", urgency: "high", time: "2 天前", link: "/process/approval" },
];

export function Portal() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(["crm", "bi", "oa"]);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  /* Detect viewport width */
  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  /* Auto-rotate announcement */
  useEffect(() => {
    const t = setInterval(() => {
      setAnnouncementIdx((i) => (i + 1) % PORTAL_ANNOUNCEMENTS.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  function toggleFavorite(appId: string) {
    setFavorites((prev) => prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]);
  }

  const filteredApps = PORTAL_APPS.filter((a) => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (searchQuery && !a.name.includes(searchQuery) && !a.desc.includes(searchQuery)) return false;
    return true;
  });
  const recentApps = PORTAL_APPS.slice(0, 5);
  const favoriteApps = PORTAL_APPS.filter((a) => favorites.includes(a.id));
  const currentAnnouncement = PORTAL_ANNOUNCEMENTS[announcementIdx];
  const effectiveMode = isMobile ? "mobile" : viewMode;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            企业门户
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">统一工作入口，快速访问所有应用和待办</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <Button variant={effectiveMode === "desktop" ? "default" : "ghost"} size="sm" className="rounded-none gap-1" onClick={() => setViewMode("desktop")}>
              <Monitor className="size-3.5" /> PC
            </Button>
            <Button variant={effectiveMode === "mobile" ? "default" : "ghost"} size="sm" className="rounded-none gap-1" onClick={() => setViewMode("mobile")}>
              <Smartphone className="size-3.5" /> 移动端
            </Button>
          </div>
          <Badge variant="secondary">v2.0</Badge>
        </div>
      </div>

      {/* News Ticker Banner */}
      <Card className="overflow-hidden border-l-4 border-l-primary">
        <CardContent className="p-3 flex items-center gap-3">
          <Megaphone className="size-5 text-primary shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant={currentAnnouncement.type === "warning" ? "destructive" : currentAnnouncement.type === "feature" ? "default" : "secondary"} className="text-xs shrink-0">
                {currentAnnouncement.type === "warning" ? "维护" : currentAnnouncement.type === "feature" ? "新功能" : "通知"}
              </Badge>
              <span className="font-medium text-sm truncate">{currentAnnouncement.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">{currentAnnouncement.time}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{currentAnnouncement.content}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {PORTAL_ANNOUNCEMENTS.map((_, i) => (
              <button key={i} className={`size-1.5 rounded-full transition-colors ${i === announcementIdx ? "bg-primary" : "bg-muted-foreground/30"}`} onClick={() => setAnnouncementIdx(i)} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions: "应用发起" */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="size-4 text-primary" /> 应用发起
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={effectiveMode === "mobile" ? "grid grid-cols-3 gap-2" : "grid grid-cols-3 sm:grid-cols-6 gap-3"}>
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.name}
                onClick={() => navigate(a.link)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border hover:border-primary transition-colors ${effectiveMode === "mobile" ? "" : ""}`}
              >
                <div className={`size-10 rounded-full flex items-center justify-center ${a.color}`}>
                  <a.icon className="size-5" />
                </div>
                <span className="text-xs font-medium">{a.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My Todos: "我的待办" */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="size-4 text-orange-500" /> 我的待办
            <Badge variant="destructive" className="text-xs">{PORTAL_TODOS.filter((t) => t.urgency === "high").length} 紧急</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/process/approval")}>
            进入处理中心 <ChevronRight className="size-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className={effectiveMode === "mobile" ? "space-y-2" : "space-y-1"}>
            {PORTAL_TODOS.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(t.link)}
              >
                {t.urgency === "high" ? (
                  <AlertCircle className="size-4 text-red-500 shrink-0" />
                ) : t.urgency === "medium" ? (
                  <Clock className="size-4 text-orange-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{t.title}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {t.type === "approval" ? "审批" : "任务"}
                </Badge>
                <span className="text-xs text-muted-foreground shrink-0">{t.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Favorites: "我的收藏" */}
      {favoriteApps.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="size-4 text-yellow-500 fill-yellow-500" /> 我的收藏
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={effectiveMode === "mobile" ? "flex gap-3 overflow-x-auto pb-2 snap-x" : "grid grid-cols-5 gap-3"}>
              {favoriteApps.map((app) => {
                const Icon = app.icon;
                return (
                  <button
                    key={app.id}
                    onClick={() => navigate(`/apps/${app.id}/overview`)}
                    className={`rounded-lg border p-3 hover:border-primary transition-colors text-left shrink-0 ${effectiveMode === "mobile" ? "min-w-[140px] snap-start" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`size-9 rounded-lg flex items-center justify-center ${app.color}`}>
                        <Icon className="size-5" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
                        className="text-yellow-500"
                      >
                        <Star className="size-4 fill-yellow-500" />
                      </button>
                    </div>
                    <div className="font-medium text-sm mt-2 truncate">{app.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{app.desc}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Apps: "最近应用" */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> 最近应用
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/apps")}>
            全部应用 <ChevronRight className="size-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className={effectiveMode === "mobile" ? "flex gap-3 overflow-x-auto pb-2 snap-x" : "grid grid-cols-5 gap-3"}>
            {recentApps.map((app) => {
              const Icon = app.icon;
              const isFav = favorites.includes(app.id);
              return (
                <button
                  key={app.id}
                  onClick={() => navigate(`/apps/${app.id}/overview`)}
                  className={`rounded-lg border p-3 hover:border-primary transition-colors text-left shrink-0 ${effectiveMode === "mobile" ? "min-w-[140px] snap-start" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`size-9 rounded-lg flex items-center justify-center ${app.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
                      className={isFav ? "text-yellow-500" : "text-muted-foreground/40 hover:text-yellow-500"}
                    >
                      <Star className={`size-4 ${isFav ? "fill-yellow-500" : ""}`} />
                    </button>
                  </div>
                  <div className="font-medium text-sm mt-2 truncate">{app.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{app.lastUsed}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* App Grid with Category Filter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Grid className="size-4" /> 全部应用
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索应用..." className="pl-7 h-8 w-40 text-sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>
              全部
            </Button>
            {PORTAL_CATEGORIES.map((cat) => (
              <Button key={cat.name} variant={categoryFilter === cat.name ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(cat.name)}>
                <cat.icon className="size-3 mr-1" />
                {cat.name}
              </Button>
            ))}
          </div>

          {/* App grid/list based on view mode */}
          {effectiveMode === "mobile" ? (
            <div className="space-y-2">
              {filteredApps.map((app) => {
                const Icon = app.icon;
                const isFav = favorites.includes(app.id);
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary cursor-pointer transition-colors"
                    onClick={() => navigate(`/apps/${app.id}/overview`)}
                  >
                    <div className={`size-10 rounded-lg flex items-center justify-center ${app.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{app.name}</div>
                      <div className="text-xs text-muted-foreground">{app.desc} · v{app.version}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
                      className={isFav ? "text-yellow-500" : "text-muted-foreground/40"}
                    >
                      <Star className={`size-4 ${isFav ? "fill-yellow-500" : ""}`} />
                    </button>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredApps.map((app) => {
                const Icon = app.icon;
                const isFav = favorites.includes(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => navigate(`/apps/${app.id}/overview`)}
                    className="text-left rounded-lg border p-3 hover:border-primary transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`size-10 rounded-lg flex items-center justify-center ${app.color}`}>
                        <Icon className="size-5" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(app.id); }}
                        className={isFav ? "text-yellow-500" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"}
                      >
                        <Star className={`size-4 ${isFav ? "fill-yellow-500" : ""}`} />
                      </button>
                    </div>
                    <div className="font-medium text-sm mt-2 truncate">{app.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{app.desc}</div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>v{app.version}</span>
                      <span>{app.pages} 页面</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="门户应用" value={PORTAL_APPS.length} icon={Globe} />
        <StatCard label="今日访问" value="1,248" icon={Eye} />
        <StatCard label="活跃用户" value={86} icon={Users} />
        <StatCard label="待办事项" value={PORTAL_TODOS.length} icon={ClipboardList} />
      </div>
    </div>
  );
}

// Briefcase import helper - used in Portal categories
const Briefcase = Users; // fallback

/* ─────────────────── FreePage (F1.6: Page Editor) ─────────────────── */
const PALETTE_COMPONENTS = [
  { type: "text", label: "文本", icon: Type, defaultProps: { content: "双击编辑文本", fontSize: "14px", color: "#333" } },
  { type: "image", label: "图片", icon: ImageIcon, defaultProps: { src: "", alt: "图片", width: "100%", height: "200px" } },
  { type: "button", label: "按钮", icon: Square, defaultProps: { text: "点击按钮", variant: "primary", size: "md" } },
  { type: "table", label: "表格", icon: TableIcon, defaultProps: { rows: 5, cols: 4, header: true } },
  { type: "chart", label: "图表", icon: BarChart3, defaultProps: { chartType: "bar", data: "sample" } },
  { type: "divider", label: "分割线", icon: Minus, defaultProps: { style: "solid", color: "#e5e7eb" } },
  { type: "container", label: "容器", icon: Maximize, defaultProps: { direction: "column", gap: "8px", padding: "16px" } },
];

const PAGE_TEMPLATES = [
  { id: "blank", name: "空白页面", desc: "从零开始创建", icon: FileText, components: 0 },
  { id: "kanban", name: "看板", desc: "项目任务看板", icon: Columns, components: 6 },
  { id: "report", name: "报表", desc: "数据报表模板", icon: BarChart3, components: 5 },
  { id: "dashboard", name: "仪表盘", desc: "指标监控面板", icon: PieChart, components: 8 },
];

interface PageComponent {
  id: string;
  type: string;
  props: Record<string, string | number | boolean>;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FreePageItem {
  id: string;
  name: string;
  path: string;
  status: "published" | "draft";
  updated: string;
  components: PageComponent[];
}

const INITIAL_PAGES: FreePageItem[] = [
  { id: "p1", name: "团队周报", path: "/p/weekly-report", status: "published", updated: "2 天前", components: [
    { id: "c1", type: "text", props: { content: "团队周报", fontSize: "24px", color: "#111" }, x: 0, y: 0, w: 12, h: 1 },
    { id: "c2", type: "table", props: { rows: 5, cols: 4, header: true }, x: 0, y: 1, w: 8, h: 4 },
    { id: "c3", type: "chart", props: { chartType: "bar", data: "sample" }, x: 8, y: 1, w: 4, h: 4 },
    { id: "c4", type: "button", props: { text: "导出 PDF", variant: "primary", size: "md" }, x: 0, y: 5, w: 3, h: 1 },
  ]},
  { id: "p2", name: "项目看板", path: "/p/project-board", status: "published", updated: "昨天", components: [
    { id: "c1", type: "text", props: { content: "项目看板", fontSize: "24px", color: "#111" }, x: 0, y: 0, w: 12, h: 1 },
    { id: "c2", type: "container", props: { direction: "row", gap: "12px", padding: "8px" }, x: 0, y: 1, w: 12, h: 5 },
  ]},
  { id: "p3", name: "会议纪要", path: "/p/meeting-notes", status: "published", updated: "3 天前", components: [] },
  { id: "p4", name: "OKR 追踪", path: "/p/okr-tracker", status: "draft", updated: "1 周前", components: [] },
];

export function FreePage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<FreePageItem[]>(INITIAL_PAGES);
  const [activeView, setActiveView] = useState<"list" | "builder" | "templates">("list");
  const [editingPage, setEditingPage] = useState<FreePageItem | null>(null);
  const [canvasComponents, setCanvasComponents] = useState<PageComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  function openBuilder(page: FreePageItem) {
    setEditingPage(page);
    setCanvasComponents([...page.components]);
    setActiveView("builder");
    setSelectedComponent(null);
  }

  function openTemplate(templateId: string) {
    const template = PAGE_TEMPLATES.find((t) => t.id === templateId);
    const newPage: FreePageItem = {
      id: `p-${Date.now()}`,
      name: template?.name === "空白页面" ? "新建页面" : template?.name || "新建页面",
      path: `/p/new-${Date.now()}`,
      status: "draft",
      updated: "刚刚",
      components: [],
    };
    setPages((prev) => [newPage, ...prev]);
    openBuilder(newPage);
    setToast(`已从「${template?.name}」模板创建页面`);
  }

  function addComponent(type: string) {
    const palette = PALETTE_COMPONENTS.find((p) => p.type === type);
    if (!palette) return;
    const newComp: PageComponent = {
      id: `comp-${Date.now()}`,
      type,
      props: { ...palette.defaultProps },
      x: 0,
      y: canvasComponents.length,
      w: type === "divider" ? 12 : 6,
      h: type === "text" || type === "button" || type === "divider" ? 1 : 3,
    };
    setCanvasComponents((prev) => [...prev, newComp]);
    setSelectedComponent(newComp.id);
  }

  function updateComponentProp(compId: string, key: string, value: string) {
    setCanvasComponents((prev) =>
      prev.map((c) => (c.id === compId ? { ...c, props: { ...c.props, [key]: value } } : c))
    );
  }

  function removeComponent(compId: string) {
    setCanvasComponents((prev) => prev.filter((c) => c.id !== compId));
    if (selectedComponent === compId) setSelectedComponent(null);
  }

  function savePage() {
    if (!editingPage) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === editingPage.id
          ? { ...p, components: canvasComponents, updated: "刚刚", status: p.status }
          : p
      )
    );
    setToast("页面已保存");
  }

  function publishPage() {
    if (!editingPage) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === editingPage.id
          ? { ...p, components: canvasComponents, updated: "刚刚", status: "published" }
          : p
      )
    );
    setToast("页面已发布");
  }

  function deletePage(pageId: string) {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    setToast("页面已删除");
  }

  const selectedComp = canvasComponents.find((c) => c.id === selectedComponent);

  /* ── Templates view ── */
  if (activeView === "templates") {
    return (
      <div className="flex flex-col gap-4 p-4">
        {toast && <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveView("list")}>
            <ArrowRight className="size-3 rotate-180 mr-1" /> 返回
          </Button>
          <h1 className="text-xl font-semibold">页面模板</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PAGE_TEMPLATES.map((t) => (
            <Card key={t.id} className="hover:border-primary cursor-pointer transition-colors" onClick={() => openTemplate(t.id)}>
              <CardHeader>
                <t.icon className="size-8 text-primary" />
                <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">{t.components} 个预设组件</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* ── Builder view ── */
  if (activeView === "builder" && editingPage) {
    return (
      <div className="flex flex-col h-full">
        {toast && <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}
        {/* Builder toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setActiveView("list"); savePage(); }}>
              <ArrowRight className="size-3 rotate-180 mr-1" /> 返回
            </Button>
            <span className="font-medium text-sm">{editingPage.name}</span>
            <Badge variant={editingPage.status === "published" ? "default" : "secondary"}>
              {editingPage.status === "published" ? "已发布" : "草稿"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="size-3 mr-1" /> {showPreview ? "编辑" : "预览"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(`https://metaplatform.com${editingPage.path}`); setToast("链接已复制"); }}>
              <Share2 className="size-3 mr-1" /> 分享链接
            </Button>
            <Button variant="outline" size="sm" onClick={savePage}>
              <CheckCircle2 className="size-3 mr-1" /> 保存
            </Button>
            <Button size="sm" onClick={publishPage}>
              <Rocket className="size-3 mr-1" /> 发布页面
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Component Palette */}
          {!showPreview && (
            <div className="w-52 border-r bg-muted/30 overflow-y-auto shrink-0 p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">组件面板</h3>
              <div className="space-y-1">
                {PALETTE_COMPONENTS.map((comp) => (
                  <button
                    key={comp.type}
                    draggable
                    onDragStart={() => setDraggedType(comp.type)}
                    onDragEnd={() => setDraggedType(null)}
                    onClick={() => addComponent(comp.type)}
                    className="flex items-center gap-2 w-full p-2 rounded-md text-sm hover:bg-background border border-transparent hover:border-border transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="size-3 text-muted-foreground" />
                    <comp.icon className="size-4 text-primary" />
                    <span>{comp.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">快速模板</h3>
                <div className="space-y-1">
                  {PAGE_TEMPLATES.slice(1).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { if (confirm(`应用「${t.name}」模板将覆盖当前内容，是否继续？`)) openTemplate(t.id); }}
                      className="flex items-center gap-2 w-full p-2 rounded-md text-sm hover:bg-background transition-colors"
                    >
                      <t.icon className="size-4 text-muted-foreground" />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Center: Canvas */}
          <div
            className="flex-1 overflow-auto bg-gray-100 p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (draggedType) { addComponent(draggedType); setDraggedType(null); } }}
          >
            {showPreview ? (
              <div className="bg-white rounded-lg shadow-sm min-h-[600px] p-6">
                <h2 className="text-lg font-semibold mb-4">{editingPage.name} - 预览</h2>
                <div className="space-y-4">
                  {canvasComponents.map((comp) => (
                    <PreviewComponent key={comp.id} comp={comp} />
                  ))}
                  {canvasComponents.length === 0 && (
                    <div className="text-center py-20 text-muted-foreground">暂无组件，请先在编辑模式中添加</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm min-h-[600px] p-4 relative">
                <div className="text-xs text-muted-foreground mb-3 flex items-center justify-between">
                  <span>画布 · {canvasComponents.length} 个组件</span>
                  <span className="text-xs">拖拽左侧组件到此处 或 点击添加</span>
                </div>
                {canvasComponents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Layout className="size-10 mb-3 opacity-40" />
                    <p className="text-sm">拖拽组件到此处开始构建页面</p>
                    <p className="text-xs mt-1">或点击左侧面板中的组件</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {canvasComponents.map((comp) => {
                      const palette = PALETTE_COMPONENTS.find((p) => p.type === comp.type);
                      const isSelected = selectedComponent === comp.id;
                      return (
                        <div
                          key={comp.id}
                          className={`relative border rounded-lg p-3 transition-all cursor-pointer group ${
                            isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-gray-200 hover:border-gray-400"
                          }`}
                          onClick={() => setSelectedComponent(comp.id)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {palette && <palette.icon className="size-3.5 text-primary" />}
                            <span className="text-xs font-medium text-muted-foreground">{palette?.label || comp.type}</span>
                            <button
                              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <PreviewComponent comp={comp} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Property Editor */}
          {!showPreview && (
            <div className="w-64 border-l bg-muted/30 overflow-y-auto shrink-0 p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">属性编辑器</h3>
              {selectedComp ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const P = PALETTE_COMPONENTS.find((p) => p.type === selectedComp.type); return P ? <P.icon className="size-4 text-primary" /> : null; })()}
                    <span className="text-sm font-medium">{PALETTE_COMPONENTS.find((p) => p.type === selectedComp.type)?.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">ID: {selectedComp.id.slice(-4)}</Badge>
                  </div>
                  {Object.entries(selectedComp.props).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs text-muted-foreground capitalize">{key}</label>
                      {typeof val === "boolean" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) => updateComponentProp(selectedComp.id, key, String(e.target.checked))}
                          />
                          <span className="text-xs">{val ? "是" : "否"}</span>
                        </div>
                      ) : (
                        <Input
                          value={String(val)}
                          onChange={(e) => updateComponentProp(selectedComp.id, key, e.target.value)}
                          className="h-7 text-xs"
                        />
                      )}
                    </div>
                  ))}
                  <div className="pt-2 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">宽度 (列)</label>
                        <select
                          value={selectedComp.w}
                          onChange={(e) => setCanvasComponents((prev) => prev.map((c) => c.id === selectedComp.id ? { ...c, w: Number(e.target.value) } : c))}
                          className="w-full h-7 text-xs border rounded px-2"
                        >
                          {[1,2,3,4,6,8,10,12].map((n) => <option key={n} value={n}>{n}/12</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">高度 (行)</label>
                        <select
                          value={selectedComp.h}
                          onChange={(e) => setCanvasComponents((prev) => prev.map((c) => c.id === selectedComp.id ? { ...c, h: Number(e.target.value) } : c))}
                          className="w-full h-7 text-xs border rounded px-2"
                        >
                          {[1,2,3,4,5,6,8].map((n) => <option key={n} value={n}>{n} 行</option>)}
                        </select>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => removeComponent(selectedComp.id)}>
                      <Trash2 className="size-3 mr-1" /> 删除组件
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Layout className="size-8 mx-auto mb-2 opacity-40" />
                  <p>点击画布中的组件</p>
                  <p>编辑其属性</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── List view (default) ── */
  return (
    <div className="flex flex-col gap-4 p-4">
      {toast && <div className="fixed top-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Layout className="size-5 text-primary" /> 自由页面
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">灵活创建自定义页面，支持拖拽布局和组件组合</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveView("templates")}>
            <FileText className="size-3 mr-1" /> 模板库
          </Button>
          <Button size="sm" onClick={() => openTemplate("blank")}>
            <Plus className="size-3 mr-1" /> 新建页面
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="自定义页面" value={pages.length} icon={Layout} />
        <StatCard label="已发布" value={pages.filter((p) => p.status === "published").length} icon={CheckCircle2} />
        <StatCard label="草稿" value={pages.filter((p) => p.status === "draft").length} icon={FileText} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layout className="size-4" /> 页面列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>页面名</TableHead><TableHead>路径</TableHead><TableHead>组件数</TableHead><TableHead>状态</TableHead><TableHead>更新时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.path}</TableCell>
                  <TableCell>{p.components.length}</TableCell>
                  <TableCell><Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? "已发布" : "草稿"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.updated}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openBuilder(p)} title="编辑">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openBuilder(p)} title="预览">
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => deletePage(p.id)} title="删除">
                      <Trash2 className="size-4" />
                    </Button>
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

/* Canvas component preview renderer */
function PreviewComponent({ comp }: { comp: PageComponent }) {
  switch (comp.type) {
    case "text":
      return <p style={{ fontSize: String(comp.props.fontSize || "14px"), color: String(comp.props.color || "#333") }}>{String(comp.props.content || "文本")}</p>;
    case "image":
      return (
        <div className="bg-gray-100 rounded flex items-center justify-center" style={{ height: String(comp.props.height || "120px") }}>
          <ImageIcon className="size-8 text-gray-400" />
          <span className="text-xs text-gray-500 ml-2">{String(comp.props.alt || "图片占位")}</span>
        </div>
      );
    case "button":
      return <Button size="sm" variant={comp.props.variant === "secondary" ? "secondary" : "default"}>{String(comp.props.text || "按钮")}</Button>;
    case "table":
      return (
        <div className="overflow-auto border rounded text-xs">
          <table className="w-full">
            <thead className="bg-muted"><tr>{Array.from({ length: Number(comp.props.cols || 3) }).map((_, i) => <th key={i} className="px-2 py-1 text-left font-medium">列 {i + 1}</th>)}</tr></thead>
            <tbody>{Array.from({ length: Number(comp.props.rows || 3) }).map((_, r) => <tr key={r} className="border-t">{Array.from({ length: Number(comp.props.cols || 3) }).map((_, c) => <td key={c} className="px-2 py-1">数据 {r + 1}-{c + 1}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "chart":
      return (
        <div className="bg-gray-50 rounded flex items-center justify-center h-32">
          <BarChart3 className="size-8 text-gray-400" />
          <span className="text-xs text-gray-500 ml-2">{String(comp.props.chartType || "bar")} 图表</span>
        </div>
      );
    case "divider":
      return <hr className="border-gray-200 my-2" />;
    case "container":
      return (
        <div className="border border-dashed rounded p-3 min-h-[60px] flex items-center justify-center text-xs text-muted-foreground">
          容器 ({String(comp.props.direction || "column")})
        </div>
      );
    default:
      return <div className="text-xs text-muted-foreground">未知组件: {comp.type}</div>;
  }
}
