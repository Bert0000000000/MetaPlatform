import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listObjectTypes } from "../api/ontologyApi";
import { generatePage } from "../api/pageApi";
import { ObjectTypeSummary } from "../types/schema";

/**
 * Lists all ObjectTypes from the ontology-engine.
 * Users can click to auto-generate a page config and preview it.
 */
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
    <div className="mp-object-manager">
      <div className="mp-dashboard-header">
        <h1>ObjectType 管理</h1>
        <p>查看所有业务对象类型，点击即可自动生成页面配置并预览。</p>
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}</div>}

      {loading ? (
        <p className="mp-loading">加载中...</p>
      ) : objectTypes.length === 0 ? (
        <p className="mp-empty-hint">暂无 ObjectType，请先在 ontology-engine 中创建。</p>
      ) : (
        <div className="mp-ot-grid">
          {objectTypes.map((ot) => (
            <div key={ot.id} className="mp-ot-card">
              <div className="mp-ot-card-name">{ot.displayName}</div>
              <div className="mp-ot-card-meta">{ot.name}</div>
              {ot.description && (
                <div className="mp-ot-card-desc">{ot.description}</div>
              )}
              {ot.fieldCount != null && (
                <div className="mp-ot-card-meta">字段数: {ot.fieldCount}</div>
              )}
              <button
                className="mp-btn mp-btn-primary mp-btn-sm"
                disabled={generatingId === ot.id}
                onClick={() => handleGenerateAndPreview(ot)}
              >
                {generatingId === ot.id ? "生成中..." : "生成并预览"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ObjectManager;
