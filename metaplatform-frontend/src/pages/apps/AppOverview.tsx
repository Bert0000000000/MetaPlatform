import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mockApplications } from "@/lib/mock-data";
import { Box, FileText, GitBranch, Users, Calendar, Dna } from "lucide-react";

export default function AppOverview() {
  const { appId } = useParams();
  const app = mockApplications.find((a) => a.id === appId) ?? mockApplications[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<><app.icon className="size-5 inline mr-2" />{app.name}</>}
        description={`${app.description} · v${app.version} · ${app.category}`}
        action={
          <div className="flex gap-2">
            <Badge variant="secondary">已发布</Badge>
            <Badge variant="outline">{app.owner}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="对象数" value={app.objects} icon={<Dna className="size-5" />} />
        <StatCard label="页面数" value={app.pages} icon={<FileText className="size-5" />} />
        <StatCard label="流程数" value={app.flows} icon={<GitBranch className="size-5" />} />
        <StatCard label="活跃用户" value={128} trend={12.5} icon={<Users className="size-5" />} />
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
                  <span>张伟 修改了「客户对象」字段</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">09:15</span>
                  <span>李娜 部署了新版本到测试环境</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">昨天</span>
                  <span>王强 新建了 3 个页面</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-muted-foreground">2 天前</span>
                  <span>刘敏 配置了 2 个工作流</span>
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
                  <span className="text-muted-foreground">所有者</span>
                  <span>{app.owner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">分类</span>
                  <span>{app.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最后更新</span>
                  <span>{app.updatedAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}