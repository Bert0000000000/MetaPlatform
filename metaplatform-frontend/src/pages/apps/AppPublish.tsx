import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Box, GitBranch, CheckCircle2, ArrowRight, Rocket, History, Package, RotateCcw, Target } from "lucide-react";

const environments = [
  { name: "开发环境", color: "bg-blue-500", status: "running", version: "v2.4.0-rc.1" },
  { name: "测试环境", color: "bg-yellow-500", status: "running", version: "v2.3.5" },
  { name: "预览环境", color: "bg-purple-500", status: "running", version: "v2.3.5" },
  { name: "生产环境", color: "bg-green-500", status: "running", version: "v2.3" },
];

const versions = [
  { version: "v2.4.0-rc.1", date: "2026-07-03", status: "开发中", author: "张伟" },
  { version: "v2.3.5", date: "2026-07-01", status: "已发布", author: "李娜" },
  { version: "v2.3.4", date: "2026-06-28", status: "已发布", author: "王强" },
  { version: "v2.3.3", date: "2026-06-15", status: "已发布", author: "刘敏" },
  { version: "v2.3.2", date: "2026-06-01", status: "已归档", author: "陈昊" },
];

export default function AppPublish() {
  const [selectedEnv, setSelectedEnv] = useState(1);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="应用发布"
        description="多环境 + 多版本 + 灰度发布"
        action={
          <Button className="gap-2">
            <Rocket className="size-4" /> 发布新版本
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="当前版本" value="v2.3" icon={<Package className="size-5" />} />
        <StatCard label="发布次数" value={28} trend={12.5} icon={<Rocket className="size-5" />} />
        <StatCard label="回滚次数" value={2} icon={<RotateCcw className="size-5" />} />
        <StatCard label="灰度比例" value="50%" icon={<Target className="size-5" />} />
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
                <button
                  onClick={() => setSelectedEnv(i)}
                  className={`flex-1 border rounded-lg p-4 text-left transition-colors ${
                    selectedEnv === i ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`size-2 rounded-full ${env.color}`} />
                    <span className="font-medium text-sm">{env.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{env.version}</div>
                  <Badge variant="outline" className="mt-2 text-xs">运行中</Badge>
                </button>
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
              {versions.map((v) => (
                <div key={v.version} className="flex items-center justify-between p-2 border rounded hover:bg-muted">
                  <div>
                    <div className="font-mono text-sm">{v.version}</div>
                    <div className="text-xs text-muted-foreground">{v.date} · {v.author}</div>
                  </div>
                  <Badge variant={v.status === "已发布" ? "default" : v.status === "开发中" ? "secondary" : "outline"}>
                    {v.status}
                  </Badge>
                </div>
              ))}
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
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-4 text-green-500 mt-0.5" />
                <div>
                  <div>发布 v2.3.5 到生产环境</div>
                  <div className="text-xs text-muted-foreground">2 天前 · 李娜</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-4 text-green-500 mt-0.5" />
                <div>
                  <div>灰度发布 v2.3.5（50%）</div>
                  <div className="text-xs text-muted-foreground">3 天前 · 王强</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Box className="size-4 text-blue-500 mt-0.5" />
                <div>
                  <div>从生产回滚到 v2.3.4</div>
                  <div className="text-xs text-muted-foreground">1 周前 · 刘敏</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}