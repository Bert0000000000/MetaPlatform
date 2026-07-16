import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listObjectTypes } from "../api/ontologyApi";
import { generatePage } from "../api/pageApi";
import { ObjectTypeSummary } from "../types/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ObjectManager: React.FC = () => {
  const navigate = useNavigate();
  const [objectTypes, setObjectTypes] = useState<ObjectTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listObjectTypes();
      setObjectTypes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载 ObjectType 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerateAndPreview = async (ot: ObjectTypeSummary) => {
    setGeneratingId(ot.id);
    try {
      const objectCode = ot.code || ot.name || "";
      const page = await generatePage(objectCode, { displayName: ot.displayName });
      navigate(`/pages/${page.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成页面失败");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ObjectType 管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看所有业务对象类型，点击即可自动生成页面配置并预览。
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          加载中...
        </div>
      ) : objectTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>暂无 ObjectType，请先在 ontology-engine 中创建。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {objectTypes.map((ot) => (
            <Card key={ot.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{ot.displayName}</CardTitle>
                <p className="text-xs text-muted-foreground">{ot.name}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {ot.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ot.description}
                  </p>
                )}
                {ot.fieldCount != null && (
                  <p className="text-xs text-muted-foreground">
                    字段数: {ot.fieldCount}
                  </p>
                )}
                <Button
                  size="sm"
                  disabled={generatingId === ot.id}
                  onClick={() => handleGenerateAndPreview(ot)}
                >
                  {generatingId === ot.id ? "生成中..." : "生成并预览"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ObjectManager;
