import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { ROLES, WORKSPACE_BY_ROLE } from "@/config/menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function DashboardPage() {
  const { role } = useRole();
  const navigate = useNavigate();
  const current = ROLES.find((r) => r.id === role);
  const cards = WORKSPACE_BY_ROLE[role] ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            欢迎回来，{current?.label ?? role}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>您最近的操作记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground py-8 text-center">
              暂无最近活动
            </div>
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
              onClick={() => navigate("/apps")}
            >
              📱 新建应用
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate("/superai")}
            >
              🤖 AI 助手
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate("/process")}
            >
              🔄 流程中心
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}