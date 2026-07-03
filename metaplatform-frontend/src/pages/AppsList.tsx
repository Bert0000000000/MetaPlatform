import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Sparkles, Bot, Zap, Folder,
  ClipboardList, FileEdit, BarChart3,
  Loader2, AlertCircle, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appsApi, type Application } from "@/lib/api";

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  "传统应用": ClipboardList,
  "AI 原生": Bot,
  "数字员工": Sparkles,
  "VibeCoding": Zap,
};

export function AppsListPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    appsApi
      .list()
      .then((data) => {
        if (!cancelled) setApps(data ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "加载应用列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

      {/* Quick entry cards */}
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

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在加载应用列表...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            重试
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && apps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Inbox className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无应用</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/apps/new")}
          >
            <Plus className="size-4 mr-1" /> 创建第一个应用
          </Button>
        </div>
      )}

      {/* App list */}
      {!loading && !error && apps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Folder className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">我的应用</h2>
            <Badge variant="secondary">{apps.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => {
              const IconComponent = CATEGORY_ICONS[app.category] ?? ClipboardList;
              return (
                <Card
                  key={app.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => navigate(`/apps/${app.id}/overview`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <IconComponent className="size-5" />
                      <Badge variant="outline">{app.category}</Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{app.name}</CardTitle>
                    <CardDescription>
                      {app.description || "暂无描述"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{app.objects_count ?? 0} 对象</span>
                      <span>{app.pages_count ?? 0} 页面</span>
                      <span>{app.flows_count ?? 0} 流程</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
