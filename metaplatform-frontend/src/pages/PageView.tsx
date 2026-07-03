import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { renderPage } from "../api/pageApi";
import { listObjectInstances } from "../api/ontologyApi";
import { PageRender } from "../types/schema";
import SchemaRenderer from "../renderer/SchemaRenderer";
import { Button } from "@/components/ui/button";

/**
 * Loads a page config by ID, fetches its render JSON from the
 * page-generator backend, and passes it to SchemaRenderer.
 */
const PageView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<PageRender | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    // Load page render schema
    renderPage(id)
      .then(async (pageSchema) => {
        setSchema(pageSchema);
        
        // If there's a TABLE section, load instance data
        const tableSection = pageSchema.sections?.find(s => s.type === "TABLE");
        if (tableSection && pageSchema.objectCode) {
          try {
            // Find ObjectType ID by code
            const response = await fetch(`/api/v1/object-types/code/${pageSchema.objectCode}`);
            if (response.ok) {
              const objectType = await response.json();
              const instances = await listObjectInstances(objectType.id);
              // Transform nested fieldValues to flat structure for TableRenderer
              const flatData = instances.map((inst: Record<string, unknown>) => ({
                id: inst.id,
                lifecycleState: inst.lifecycleState,
                ...(inst.fieldValues as Record<string, unknown>),
              }));
              setTableData(flatData);
            }
          } catch (e) {
            console.warn("Failed to load instance data:", e);
          }
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载页面渲染数据失败");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        正在渲染页面...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <h2 className="text-lg font-semibold mb-2">加载失败</h2>
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/")}>
          返回首页
        </Button>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        未找到页面渲染数据。
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          &larr; 返回
        </Button>
        <span className="font-mono text-xs text-muted-foreground">ID: {id}</span>
      </div>
      <SchemaRenderer schema={schema} tableData={tableData} />
    </div>
  );
};

export default PageView;
