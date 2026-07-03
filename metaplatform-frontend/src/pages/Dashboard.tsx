import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { ROLES, WORKSPACE_BY_ROLE } from "@/config/menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockApplications } from "@/lib/mock-data";
import { ArrowRight, Plus, MessageCircle, GitBranch, Bell, CheckCircle2, AlertCircle, Clock } from "lucide-react";

const RECENT_ACTIVITIES = [
  { time: "10:42", actor: "张伟", action: "修改了", target: "客户对象 / 客户等级字段", icon: "✏️" },
  { time: "09:15", actor: "李娜", action: "部署了", target: "CRM v2.3 → 测试环境", icon: "🚀" },
  { time: "昨天", actor: "王强", action: "新建了", target: "3 个页面（销售看板）", icon: "📄" },
  { time: "昨天", actor: "刘敏", action: "配置了", target: "采购审批工作流（5 节点）", icon: "🔄" },
  { time: "2 天前", actor: "陈红", action: "发布了", target: "OA 系统 v1.8 生产版本", icon: "✅" },
];

const MY_TODOS = [
  { id: 1, title: "审批：采购申请 #2024-1234", type: "审批", priority: "high", dueIn: "今日" },
  { id: 2, title: "完成客户主数据迁移", type: "任务", priority: "medium", dueIn: "2 天后" },
  { id: 3, title: "回复工单：销售看板报表异常", type: "工单", priority: "low", dueIn: "本周" },
];

const ANNOUNCEMENTS = [
  { id: 1, title: "v1.3 新版本发布预告", time: "今早", type: "feature" },
  { id: 2, title: "本周六 02:00-04:00 系统升级维护", time: "昨天", type: "warning" },
  { id: 3, title: "AI 助手新增自然语言生成对象能力", time: "3 天前", type: "feature" },
];

export function DashboardPage() {
  const { role } = useRole();
  const navigate = useNavigate();
  const current = ROLES.find((r) => r.id === role);
  const cards = WORKSPACE_BY_ROLE[role] ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            欢迎回来，{current?.label ?? role}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current?.description} · 工作台（角色化视图）
          </p>
        </div>
        <Badge variant="secondary">v1.2</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() => card.link && navigate(card.link)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden>
                  {card.icon}
                </span>
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

      {/* 我的应用 - 横向卡片 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">我的应用</CardTitle>
            <CardDescription>你最近访问的应用（{mockApplications.length} 个）</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/apps")}>
            <Plus className="size-3 mr-1" />
            新建应用
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {mockApplications.map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(`/apps/${app.id}/overview`)}
                className="text-left rounded-lg border p-3 hover:border-primary transition-colors"
              >
                <div className="text-2xl mb-2">{app.icon}</div>
                <div className="font-medium text-sm truncate">{app.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {app.category} · v{app.version}
                </div>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                  <span>📦 {app.objects}</span>
                  <span>📄 {app.pages}</span>
                  <span>🔄 {app.flows}</span>
                </div>
              </button>
            ))}
          </div>
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
                  <span className="size-7 rounded-full bg-muted flex items-center justify-center text-base">
                    {a.icon}
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">我的待办</CardTitle>
            <Badge variant="destructive">{MY_TODOS.length}</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {MY_TODOS.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => navigate("/process/approval")}
                >
                  {t.priority === "high" ? (
                    <AlertCircle className="size-4 text-red-500 shrink-0" />
                  ) : t.priority === "medium" ? (
                    <Clock className="size-4 text-orange-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 text-sm truncate">{t.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {t.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{t.dueIn}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统公告</CardTitle>
            <CardDescription>平台动态与维护通知</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ANNOUNCEMENTS.map((n) => (
                <li key={n.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                  <Bell className={`size-4 shrink-0 mt-0.5 ${n.type === "warning" ? "text-orange-500" : "text-primary"}`} />
                  <div className="flex-1">
                    <div className="text-sm">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}