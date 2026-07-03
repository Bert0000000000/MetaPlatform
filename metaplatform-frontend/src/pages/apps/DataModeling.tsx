import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/stat";
import { mockOntologyObjects, type OntologyObject } from "@/lib/mock-data";
import { Plus, Search, Sparkles, Edit, Trash2, Link2 } from "lucide-react";

export default function DataModeling() {
  const [search, setSearch] = useState("");
  const filtered = mockOntologyObjects.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.label.includes(search),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="业务数据建模"
        description="基于本体引擎的对象建模（应用内的数据模型）"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Sparkles className="size-4" /> AI 智能建模
            </Button>
            <Button className="gap-2">
              <Plus className="size-4" /> 新建对象
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="搜索对象..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm">
          <Link2 className="size-4 mr-2" /> 关系图
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">本应用的对象（{filtered.length}）</CardTitle>
          <CardDescription>所有对象归属于本应用</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>图标</TableHead>
                <TableHead>对象名</TableHead>
                <TableHead>中文名</TableHead>
                <TableHead className="text-right">属性</TableHead>
                <TableHead className="text-right">动作</TableHead>
                <TableHead className="text-right">规则</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((obj) => (
                <TableRow key={obj.id}>
                  <TableCell className="text-2xl">{obj.icon}</TableCell>
                  <TableCell className="font-mono">{obj.name}</TableCell>
                  <TableCell>{obj.label}</TableCell>
                  <TableCell className="text-right">{obj.properties}</TableCell>
                  <TableCell className="text-right">{obj.actions}</TableCell>
                  <TableCell className="text-right">{obj.rules}</TableCell>
                  <TableCell>
                    <Badge variant={obj.status === "active" ? "default" : "secondary"}>
                      {obj.status === "active" ? "已激活" : obj.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8">
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}