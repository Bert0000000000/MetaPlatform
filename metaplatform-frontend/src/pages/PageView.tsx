import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { renderPage } from "../api/pageApi";
import { listObjectInstances } from "../api/ontologyApi";
import { PageRender } from "../types/schema";
import SchemaRenderer from "../renderer/SchemaRenderer";

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
    return <div className="mp-loading">正在渲染页面...</div>;
  }

  if (error) {
    return (
      <div className="mp-page-error">
        <h2>加载失败</h2>
        <p>{error}</p>
        <button className="mp-btn" onClick={() => navigate("/")}>
          返回首页
        </button>
      </div>
    );
  }

  if (!schema) {
    return <div className="mp-empty-hint">未找到页面渲染数据。</div>;
  }

  return (
    <div className="mp-page-view">
      <div className="mp-page-view-toolbar">
        <button className="mp-btn mp-btn-sm" onClick={() => navigate("/")}>
          &larr; 返回
        </button>
        <span className="mp-page-view-id">ID: {id}</span>
      </div>
      <SchemaRenderer schema={schema} tableData={tableData} />
    </div>
  );
};

export default PageView;
