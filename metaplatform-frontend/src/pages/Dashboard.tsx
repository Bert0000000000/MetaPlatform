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
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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

/* ─────────────────── Portal ─────────────────── */
export function Portal() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="门户" description="企业门户页面配置与管理" action={<Button className="gap-2"><Plus className="size-4" /> 新建门户</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="门户页面" value={3} icon={Globe} />
        <StatCard label="今日访问" value="1,248" icon={Eye} />
        <StatCard label="活跃用户" value={86} icon={Users} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: "领导驾驶舱", desc: "高管指标看板", pages: 5, status: "published", visits: 420 },
          { name: "业务工作台", desc: "业务人员日常操作", pages: 8, status: "published", visits: 680 },
          { name: "开发者中心", desc: "开发工具与文档", pages: 12, status: "draft", visits: 148 },
        ].map((p) => (
          <Card key={p.name} className="hover:border-primary cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between"><Globe className="size-8 text-primary" /><Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? "已发布" : "草稿"}</Badge></div>
              <CardTitle className="text-base mt-2">{p.name}</CardTitle>
              <CardDescription>{p.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.pages} 个页面</span>
                <span>{p.visits} 次访问/天</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────── FreePage ─────────────────── */
export function FreePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="自由页面" description="灵活创建自定义页面，支持拖拽布局和组件组合" action={<Button className="gap-2"><Plus className="size-4" /> 新建页面</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="自定义页面" value={6} icon={Layout} />
        <StatCard label="已发布" value={4} icon={CheckCircle2} />
        <StatCard label="草稿" value={2} icon={FileText} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layout className="size-4" /> 页面列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>页面名</TableHead><TableHead>路径</TableHead><TableHead>组件数</TableHead><TableHead>状态</TableHead><TableHead>更新时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { name: "团队周报", path: "/p/weekly-report", components: 4, status: "published", updated: "2 天前" },
                { name: "项目看板", path: "/p/project-board", components: 6, status: "published", updated: "昨天" },
                { name: "会议纪要", path: "/p/meeting-notes", components: 3, status: "published", updated: "3 天前" },
                { name: "OKR 追踪", path: "/p/okr-tracker", components: 5, status: "draft", updated: "1 周前" },
              ].map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.path}</TableCell>
                  <TableCell>{p.components}</TableCell>
                  <TableCell><Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status === "published" ? "已发布" : "草稿"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.updated}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" className="size-8"><Eye className="size-4" /></Button><Button variant="ghost" size="icon" className="size-8"><Settings className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
