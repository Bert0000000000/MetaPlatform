import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPageConfigs, deletePage, generatePage } from "../api/pageApi";
import { listObjectTypes } from "../api/ontologyApi";
import { PageConfigSummary, ObjectTypeSummary } from "../types/schema";

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
    <div className="mp-dashboard">
      <div className="mp-dashboard-header">
        <h1>页面配置管理</h1>
        <p>管理已生成的页面配置，或从 ObjectType 一键生成新页面。</p>
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}</div>}

      {/* Quick-generate section */}
      {objectTypes.length > 0 && (
        <section className="mp-dashboard-section">
          <h3>快速生成页面</h3>
          <div className="mp-ot-grid">
            {objectTypes.map((ot) => (
              <div key={ot.id} className="mp-ot-card">
                <div className="mp-ot-card-name">{ot.displayName}</div>
                <div className="mp-ot-card-meta">{ot.code || ot.name}</div>
                <button
                  className="mp-btn mp-btn-primary mp-btn-sm"
                  disabled={generating}
                  onClick={() => handleGenerate(ot.code || ot.name || "")}
                >
                  {generating ? "生成中..." : "生成页面"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Page list */}
      <section className="mp-dashboard-section">
        <h3>已生成页面 ({pages.length})</h3>
        {loading ? (
          <p className="mp-loading">加载中...</p>
        ) : pages.length === 0 ? (
          <p className="mp-empty-hint">暂无页面配置，请从上方 ObjectType 生成。</p>
        ) : (
          <table className="mp-table">
            <thead>
              <tr>
                <th>显示名称</th>
                <th>名称</th>
                <th>页面类型</th>
                <th>创建时间</th>
                <th style={{ width: 180 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id}>
                  <td>{p.displayName || p.name}</td>
                  <td>{p.name}</td>
                  <td>
                    <span className="mp-page-type-badge">{p.pageType}</span>
                  </td>
                  <td>{p.createdAt ?? "--"}</td>
                  <td>
                    <button
                      className="mp-btn mp-btn-sm"
                      onClick={() => navigate(`/pages/${p.id}`)}
                    >
                      预览
                    </button>
                    <button
                      className="mp-btn mp-btn-sm mp-btn-danger"
                      onClick={() => handleDelete(p.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
