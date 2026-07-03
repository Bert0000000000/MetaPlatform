import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { mockDocuments } from "@/lib/mock-data";
import { FileText, Upload, Search, Eye, FolderTree, Sparkles } from "lucide-react";

export function DocumentList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="size-4" /> 文档列表
        </CardTitle>
        <CardDescription>所有文档（含 RAG + GraphRAG）</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>大小</TableHead>
              <TableHead className="text-right">浏览</TableHead>
              <TableHead>更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDocuments.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{d.category}</Badge>
                </TableCell>
                <TableCell>{d.author}</TableCell>
                <TableCell>{d.size}</TableCell>
                <TableCell className="text-right">{d.views.toLocaleString()}</TableCell>
                <TableCell>{d.updatedAt}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="size-8">
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function KnowledgeDashboard() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="文档总数" value={1284} icon="📄" />
        <StatCard label="已分块" value={48620} icon="🧩" />
        <StatCard label="向量化" value={48620} icon="🔢" />
        <StatCard label="知识图谱节点" value={8934} icon="🕸️" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="size-4" /> RAG 检索
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">2,841</div>
            <p className="text-xs text-muted-foreground mt-1">本周检索次数</p>
            <p className="text-xs text-muted-foreground">平均响应 156ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="size-4" /> GraphRAG
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">186</div>
            <p className="text-xs text-muted-foreground mt-1">本周图谱检索</p>
            <p className="text-xs text-muted-foreground">平均响应 89ms</p>
          </CardContent>
        </Card>
      </div>
      <DocumentList />
    </div>
  );
}