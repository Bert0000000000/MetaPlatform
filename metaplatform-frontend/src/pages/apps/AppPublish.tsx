import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { appsApi, type Application } from "@/lib/api";
import {
  Box, GitBranch, CheckCircle2, ArrowRight, Rocket, History,
  Package, RotateCcw, Target, Loader2, AlertCircle, Copy, ExternalLink,
} from "lucide-react";

const environments = [
  { name: "开发环境", color: "bg-blue-500", status: "running" },
  { name: "测试环境", color: "bg-yellow-500", status: "running" },
  { name: "预览环境", color: "bg-purple-500", status: "running" },
  { name: "生产环境", color: "bg-green-500", status: "running" },
];

export default function AppPublish() {
  const { appId } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPublished = app?.status === "published";

  // Fetch app data
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
        if (!cancelled) setError(err.message || "加载应用信息失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  // Publish handler
  const handlePublish = async () => {
    if (!appId) return;
    setPublishing(true);
    try {
      const result = await appsApi.publish(appId);
      // Refresh app data after publishing
      const refreshed = await appsApi.get(appId);
      setApp(refreshed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "发布失败";
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  // Unpublish handler
  const handleUnpublish = async () => {
    if (!appId) return;
    setUnpublishing(true);
    try {
      await appsApi.unpublish(appId);
      const refreshed = await appsApi.get(appId);
      setApp(refreshed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "取消发布失败";
      setError(message);
    } finally {
      setUnpublishing(false);
    }
  };

  // Copy published URL
  const handleCopyLink = () => {
    if (!app?.app_slug) return;
    const url = `${window.location.origin}/app/${app.app_slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const publishedUrl = app?.app_slug
    ? `${window.location.origin}/app/${app.app_slug}`
    : null;

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在加载应用信息...</p>
      </div>
    );
  }

  // Error state (initial load)
  if (!app) {
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
        title="应用发布"
        description={isPublished ? `已发布 · slug: ${app.app_slug ?? "N/A"}` : "未发布"}
        action={
          <div className="flex gap-2">
            {isPublished ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleUnpublish}
                disabled={unpublishing}
              >
                {unpublishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                {unpublishing ? "取消发布中..." : "取消发布"}
              </Button>
            ) : (
              <Button
                className="gap-2"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Rocket className="size-4" />
                )}
                {publishing ? "发布中..." : "发布新版本"}
              </Button>
            )}
          </div>
        }
      />

      {/* Error message for actions */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            关闭
          </Button>
        </div>
      )}

      {/* Published URL card */}
      {isPublished && publishedUrl && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ExternalLink className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">已发布访问地址</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {publishedUrl}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="size-4 mr-1" />
                  {copied ? "已复制" : "复制链接"}
                </Button>
                <Button variant="default" size="sm" asChild>
                  <a href={`/app/${app.app_slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-1" />
                    访问
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="当前版本"
          value={app.version}
          icon={<Package className="size-5" />}
        />
        <StatCard
          label="发布状态"
          value={isPublished ? "已发布" : "未发布"}
          icon={<Rocket className="size-5" />}
        />
        <StatCard
          label="对象数"
          value={app.objects_count ?? 0}
          icon={<GitBranch className="size-5" />}
        />
        <StatCard
          label="页面数"
          value={app.pages_count ?? 0}
          icon={<Box className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">多环境管理</CardTitle>
          <CardDescription>开发 → 测试 → 预览 → 生产</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {environments.map((env, i) => (
              <div key={env.name} className="flex items-center flex-1">
                <div className="flex-1 border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className={`size-2 rounded-full ${env.color}`} />
                    <span className="font-medium text-sm">{env.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {isPublished ? app.version : "未部署"}
                  </div>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {isPublished ? "运行中" : "空闲"}
                  </Badge>
                </div>
                {i < environments.length - 1 && (
                  <ArrowRight className="size-4 text-muted-foreground mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="size-4" /> 版本管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border rounded bg-muted/50">
                <div>
                  <div className="font-mono text-sm">{app.version}</div>
                  <div className="text-xs text-muted-foreground">当前版本</div>
                </div>
                <Badge>{isPublished ? "已发布" : "开发中"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4" /> 发布历史
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {isPublished ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-4 text-green-500 mt-0.5" />
                  <div>
                    <div>发布 {app.version}</div>
                    <div className="text-xs text-muted-foreground">
                      slug: {app.app_slug ?? "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">暂无发布记录</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
