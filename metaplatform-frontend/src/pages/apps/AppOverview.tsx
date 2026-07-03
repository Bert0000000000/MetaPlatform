import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appsApi, type Application } from "@/lib/api";
import { Box, FileText, GitBranch, Users, Calendar, Dna, Loader2, AlertCircle } from "lucide-react";

export default function AppOverview() {
  const { appId } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    appsApi
      .get(appId)
      .then((data) => {
        if (!cancelled) setApp(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "加载应用详情失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载应用详情...</p>
      </div>
    );
  }

  // Error state
  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-destructive">{error || "应用不存在"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={app.name}
        description={`${app.description || "暂无描述"} · v${app.version} · ${app.category}`}
        action={
          <div className="flex gap-2">
            <Badge variant={app.status === "published" ? "default" : "secondary"}>
              {app.status === "published" ? "已发布" : app.status === "active" ? "运行中" : app.status}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="对象数" value={app.objects_count ?? 0} icon={<Dna className="size-5" />} />
        <StatCard label="页面数" value={app.pages_count ?? 0} icon={<FileText className="size-5" />} />
        <StatCard label="流程数" value={app.flows_count ?? 0} icon={<GitBranch className="size-5" />} />
        <StatCard label="版本" value={app.version} icon={<Calendar className="size-5" />} />
      </div>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">最近活动</TabsTrigger>
          <TabsTrigger value="deploy">部署记录</TabsTrigger>
          <TabsTrigger value="settings">应用设置</TabsTrigger>
        </TabsList>
        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近活动</CardTitle>
              <CardDescription>过去 7 天的操作记录</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">10:42</span>
                  <span>修改了「客户对象」字段</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">09:15</span>
                  <span>部署了新版本到测试环境</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">昨天</span>
                  <span>新建了 3 个页面</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">2 天前</span>
                  <span>配置了 2 个工作流</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="deploy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">部署记录</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="size-4 text-green-500" />
                    <span>v2.3 生产环境</span>
                  </div>
                  <span className="text-muted-foreground text-xs">2026-07-01</span>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="size-4 text-green-500" />
                    <span>v2.2 生产环境</span>
                  </div>
                  <span className="text-muted-foreground text-xs">2026-06-15</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">应用设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应用 ID</span>
                  <span className="font-mono">{app.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">分类</span>
                  <span>{app.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <Badge variant={app.status === "published" ? "default" : "secondary"}>
                    {app.status}
                  </Badge>
                </div>
                {app.created_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{app.created_at}</span>
                  </div>
                )}
                {app.updated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最后更新</span>
                    <span>{app.updated_at}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
