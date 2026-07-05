import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appsApi, type Application } from "@/lib/api";
import { Box, FileText, GitBranch, Users, Calendar, Dna, Loader2, AlertCircle, Upload, TrendingUp, Plus, Workflow, Eye, Zap, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function AppOverview() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowCodeDialogOpen, setLowCodeDialogOpen] = useState(false);

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
            {/* F4.4.9.2 升级到 LowCode */}
            <Button variant="outline" onClick={() => setLowCodeDialogOpen(true)}>
              <Zap className="size-4 mr-1" /> 升级到 LowCode
            </Button>
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

      {/* F4.2.5 快速入口 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/pages`)}>
          <Plus className="size-4" /> 新建页面
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/data-modeling`)}>
          <Dna className="size-4" /> 新建对象
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/workflows`)}>
          <Workflow className="size-4" /> 新建流程
        </Button>
        <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => navigate(`/apps/${appId}/publish`)}>
          <Upload className="size-4" /> 发布
        </Button>
      </div>

      {/* F4.2.4 应用活跃度 sparkline + F4.2.3 最近发布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity sparkline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4" /> 应用活跃度
            </CardTitle>
            <CardDescription>过去 7 天操作趋势</CardDescription>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 280 60" className="w-full h-16">
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={[10, 45, 50, 30, 90, 38, 130, 18, 170, 28, 210, 12, 250, 22].join(" ")}
              />
              <polyline
                fill="hsl(var(--primary) / 0.1)"
                stroke="none"
                points={[10, 45, 50, 30, 90, 38, 130, 18, 170, 28, 210, 12, 250, 22, 250, 55, 10, 55].join(" ")}
              />
              {[10, 50, 90, 130, 170, 210, 250].map((x, i) => (
                <circle key={i} cx={x} cy={[45, 30, 38, 18, 28, 12, 22][i]} r="3" fill="hsl(var(--primary))" />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
              {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent publications - F4.2.3 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4" /> 最近发布
            </CardTitle>
            <CardDescription>app_publications 最近 3 条记录</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {[
                { version: "v2.3.0", env: "生产", date: "2026-07-01", status: "success" },
                { version: "v2.2.1", env: "预发", date: "2026-06-28", status: "success" },
                { version: "v2.2.0", env: "测试", date: "2026-06-25", status: "success" },
              ].map((pub, i) => (
                <li key={i} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{pub.version}</span>
                      <span className="text-muted-foreground ml-2">{pub.env}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-green-600">{pub.status === "success" ? "成功" : "失败"}</Badge>
                    <span className="text-xs text-muted-foreground">{pub.date}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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

      {/* LowCode Upgrade Confirmation Dialog */}
      <Dialog open={lowCodeDialogOpen} onOpenChange={setLowCodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-yellow-500" /> 升级到 LowCode 模式
            </DialogTitle>
            <DialogDescription>
              升级后将解锁完整的低代码开发能力，包括自定义组件、高级数据建模、API 编排等
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">升级后将获得以下能力:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> 自定义页面组件与布局
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> 高级数据模型与关联关系
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> API 编排与自定义逻辑
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500 shrink-0" /> VibeCoding AI 代码生成
                </li>
              </ul>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              注意: 升级操作不可逆。升级后应用将切换到 LowCode 开发模式。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLowCodeDialogOpen(false)}>取消</Button>
            <Button onClick={() => setLowCodeDialogOpen(false)}>
              <Zap className="size-4 mr-1" /> 确认升级
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
