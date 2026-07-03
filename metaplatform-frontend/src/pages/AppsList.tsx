import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Bot, Zap, Folder, ClipboardList, FileEdit, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AppItem {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  category: "传统应用" | "AI 原生" | "数字员工" | "VibeCoding";
  objects?: number;
  pages?: number;
  flows?: number;
}

const mockApps: AppItem[] = [
  {
    id: "1",
    name: "客户管理",
    icon: ClipboardList,
    description: "客户档案、商机、跟进记录",
    category: "传统应用",
    objects: 3,
    pages: 12,
    flows: 5,
  },
  {
    id: "2",
    name: "报销审批",
    icon: FileEdit,
    description: "差旅报销、审批流",
    category: "传统应用",
    objects: 2,
    pages: 8,
    flows: 3,
  },
  {
    id: "3",
    name: "销售看板",
    icon: BarChart3,
    description: "销售指标、可视化",
    category: "传统应用",
    objects: 5,
    pages: 15,
    flows: 10,
  },
];

export function AppsListPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">应用中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            构建应用 · NoCode + LowCode + ProCode + VibeCoding
          </p>
        </div>
        <Button onClick={() => navigate("/apps/new")} className="gap-2">
          <Plus className="size-4" /> 新建应用
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => navigate("/apps/new?type=agent")}
        >
          <CardHeader>
            <Bot className="size-6 text-primary mb-2" />
            <CardTitle className="text-base">智能体场景应用</CardTitle>
            <CardDescription>基于多智能体协作的应用</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => navigate("/apps/new?type=workforce")}
        >
          <CardHeader>
            <Sparkles className="size-6 text-primary mb-2" />
            <CardTitle className="text-base">数字员工应用</CardTitle>
            <CardDescription>每个数字员工是一个应用</CardDescription>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary"
          onClick={() => navigate("/apps/new?type=vibe")}
        >
          <CardHeader>
            <Zap className="size-6 text-primary mb-2" />
            <CardTitle className="text-base">VibeCoding 应用</CardTitle>
            <CardDescription>AI 对话生成代码应用</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Folder className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">我的应用</h2>
          <Badge variant="secondary">{mockApps.length}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockApps.map((app) => (
            <Card
              key={app.id}
              className="cursor-pointer hover:border-primary"
              onClick={() => navigate(`/apps/${app.id}/overview`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <app.icon className="size-5" />
                  <Badge variant="outline">{app.category}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{app.name}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {app.objects !== undefined && (
                    <span>{app.objects} 对象</span>
                  )}
                  {app.pages !== undefined && <span>{app.pages} 页面</span>}
                  {app.flows !== undefined && <span>{app.flows} 流程</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}