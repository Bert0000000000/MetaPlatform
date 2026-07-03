import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPageConfigs, deletePage, generatePage } from "../api/pageApi";
import { listObjectTypes } from "../api/ontologyApi";
import { PageConfigSummary, ObjectTypeSummary } from "../types/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<PageConfigSummary[]>([]);
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o] = await Promise.all([listPageConfigs(), listObjectTypes()]);
      setPages(p);
      setObjectTypes(o);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleGenerate = async (objectCode: string) => {
    setGenerating(true);
    try {
      await generatePage(objectCode);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成页面失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除此页面配置?")) return;
    try {
      await deletePage(id);
      setPages((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">页面配置管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理已生成的页面配置，或从 ObjectType 一键生成新页面。
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Quick-generate section */}
      {objectTypes.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-medium">快速生成页面</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objectTypes.map((ot) => (
              <Card key={ot.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{ot.displayName}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {ot.code || ot.name}
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    size="sm"
                    disabled={generating}
                    onClick={() => handleGenerate(ot.code || ot.name || "")}
                  >
                    {generating ? "生成中..." : "生成页面"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Page list */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium">
          已生成页面 ({pages.length})
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>暂无页面配置，请从上方 ObjectType 生成。</p>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>显示名称</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>页面类型</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead style={{ width: 180 }}>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.displayName || p.name}
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.pageType}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.createdAt ?? "--"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/pages/${p.id}`)}
                        >
                          预览
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(String(p.id))}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
