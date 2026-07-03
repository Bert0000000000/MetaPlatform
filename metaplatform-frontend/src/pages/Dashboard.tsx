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
} from "lucide-react";

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
  { time: "10:42", actor: "张伟", action: "修改了", target: "客户对象 / 客户等级字段", icon: Pencil },
  { time: "09:15", actor: "李娜", action: "部署了", target: "CRM v2.3 → 测试环境", icon: Rocket },
  { time: "昨天", actor: "王强", action: "新建了", target: "3 个页面（销售看板）", icon: FileText },
  { time: "昨天", actor: "刘敏", action: "配置了", target: "采购审批工作流（5 节点）", icon: RefreshCw },
  { time: "2 天前", actor: "陈红", action: "发布了", target: "OA 系统 v1.8 生产版本", icon: CheckCircle2 },
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
                <li key={i} className="flex items-center gap-3 text-sm">
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
