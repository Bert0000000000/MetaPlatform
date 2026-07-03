import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/stat";
import { Plus, Search, Layout, Code2, FileText, BarChart3 } from "lucide-react";

interface Page {
  id: string;
  name: string;
  type: "表单" | "列表" | "仪表盘" | "自定义" | "VibeCoding";
  icon: string;
  status: "published" | "draft" | "archived";
  updatedAt: string;
}

const mockPages: Page[] = [
  { id: "p-1", name: "客户档案", type: "表单", icon: "📝", status: "published", updatedAt: "2026-07-01" },
  { id: "p-2", name: "客户列表", type: "列表", icon: "📋", status: "published", updatedAt: "2026-07-02" },
  { id: "p-3", name: "销售仪表盘", type: "仪表盘", icon: "📊", status: "published", updatedAt: "2026-07-01" },
  { id: "p-4", name: "客户画像自定义页", type: "自定义", icon: "🎨", status: "draft", updatedAt: "2026-07-03" },
  { id: "p-5", name: "VibeCoding Demo", type: "VibeCoding", icon: "✨", status: "draft", updatedAt: "2026-07-03" },
  { id: "p-6", name: "订单管理", type: "列表", icon: "📦", status: "published", updatedAt: "2026-06-28" },
];

const typeIcons: Record<Page["type"], React.ReactNode> = {
  表单: <FileText className="size-4" />,
  列表: <Layout className="size-4" />,
  仪表盘: <BarChart3 className="size-4" />,
  自定义: <Code2 className="size-4" />,
  VibeCoding: <Code2 className="size-4" />,
};

export default function Pages() {
  const [search, setSearch] = useState("");
  const filtered = mockPages.filter((p) => p.name.includes(search));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="页面"
        description="LowCode + VUE + VibeCoding 三轨"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Code2 className="size-4" /> VibeCoding
            </Button>
            <Button className="gap-2">
              <Plus className="size-4" /> 新建页面
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">表单</div>
            <div className="text-xl font-semibold mt-1">
              {mockPages.filter((p) => p.type === "表单").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">列表</div>
            <div className="text-xl font-semibold mt-1">
              {mockPages.filter((p) => p.type === "列表").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">仪表盘</div>
            <div className="text-xl font-semibold mt-1">
              {mockPages.filter((p) => p.type === "仪表盘").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">自定义/VibeCoding</div>
            <div className="text-xl font-semibold mt-1">
              {mockPages.filter((p) => p.type === "自定义" || p.type === "VibeCoding").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索页面..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((page) => (
          <Card key={page.id} className="cursor-pointer hover:border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <span className="text-3xl">{page.icon}</span>
                <Badge variant="outline" className="gap-1">
                  {typeIcons[page.type]} {page.type}
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">{page.name}</CardTitle>
              <CardDescription>最后更新: {page.updatedAt}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={page.status === "published" ? "default" : "secondary"}>
                {page.status === "published" ? "已发布" : page.status === "draft" ? "草稿" : "已归档"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}