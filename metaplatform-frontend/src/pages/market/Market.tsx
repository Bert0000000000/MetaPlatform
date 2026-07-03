import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockTemplates } from "@/lib/mock-data";
import { Star, Download, Boxes, Sparkles, Workflow, BookOpen, Code, Plus, Package } from "lucide-react";

const priceVariant = {
  免费: "default" as const,
  付费: "secondary" as const,
  订阅: "outline" as const,
};

export function OntologyTemplates() {
  const templates = mockTemplates.filter((t) => t.type === "本体模板" || t.type === "工作流");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="size-4" /> 本体行业模板
        </CardTitle>
        <CardDescription>按行业 / 场景划分的本体模板</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>行业</TableHead>
              <TableHead className="text-right">下载</TableHead>
              <TableHead>评分</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>作者</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                <TableCell>{t.industry}</TableCell>
                <TableCell className="text-right">{t.downloads.toLocaleString()}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Star className="size-3 fill-yellow-500 text-yellow-500" />
                    {t.rating}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={priceVariant[t.price]}>{t.price}</Badge>
                </TableCell>
                <TableCell>{t.author}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm">安装</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function MarketDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="模板总数" value={245} icon="📦" />
        <StatCard label="本月下载" value={12480} trend={18.5} icon="⬇️" />
        <StatCard label="活跃开发者" value={186} icon="👨‍💻" />
        <StatCard label="已安装应用" value={32} icon="✅" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { name: "本体模板", count: 86, icon: Boxes, color: "bg-blue-500" },
          { name: "Skill", count: 42, icon: Sparkles, color: "bg-purple-500" },
          { name: "Agent", count: 38, icon: Workflow, color: "bg-green-500" },
          { name: "工作流", count: 28, icon: Package, color: "bg-yellow-500" },
          { name: "知识包", count: 32, icon: BookOpen, color: "bg-red-500" },
          { name: "API", count: 19, icon: Code, color: "bg-indigo-500" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.name} className="cursor-pointer hover:border-primary">
              <CardContent className="p-4 text-center">
                <div className={`${c.color} text-white size-12 rounded-lg flex items-center justify-center mx-auto`}>
                  <Icon className="size-6" />
                </div>
                <div className="font-medium text-sm mt-2">{c.name}</div>
                <div className="text-2xl font-semibold mt-1">{c.count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <OntologyTemplates />
    </div>
  );
}