import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const http = axios.create({ baseURL: "/api/v1" });

interface ConfigItem {
  key: string;
  value: string;
  description?: string;
  configType?: string;
  updatedBy?: string;
  updatedAt?: string;
}

const PlatformConfig: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await http.get("/configs");
      setConfigs(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const { data } = await http.get("/health");
      setHealth(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConfigs(); loadHealth(); }, [loadConfigs, loadHealth]);

  const handleSave = async (key: string) => {
    try {
      await http.put(`/configs/${encodeURIComponent(key)}`, {
        value: editValue,
        description: configs.find(c => c.key === key)?.description || "",
      });
      setEditKey(null);
      await loadConfigs();
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  const handleAdd = async () => {
    if (!newKey) return;
    try {
      await http.post("/configs", {
        key: newKey,
        value: newValue,
        description: newDesc,
      });
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
      setNewDesc("");
      await loadConfigs();
    } catch (e) {
      console.error("Failed to add config:", e);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`确定删除配置 ${key}？`)) return;
    try {
      await http.delete(`/configs/${encodeURIComponent(key)}`);
      await loadConfigs();
    } catch (e) {
      console.error("Failed to delete config:", e);
    }
  };

  const isFeatureFlag = (key: string) => key.startsWith("feature.");
  const isBooleanValue = (val: string) => val === "true" || val === "false";

  return (
    <div className="mp-platform-config">
      <div className="mp-platform-config-header">
        <div>
          <h1>平台配置中心</h1>
          <p>管理系统配置、功能开关和健康状态</p>
        </div>
        <button className="mp-btn mp-btn-primary" onClick={() => setShowAdd(true)}>
          + 新增配置
        </button>
      </div>

      {/* 健康状态 */}
      {health && (
        <div className="mp-health-grid">
          <h2>系统健康状态</h2>
          <div className="mp-health-cards">
            {Object.entries(health).filter(([k]) => k !== "status").map(([name, status]) => (
              <div key={name} className={`mp-health-card ${String(status) === "UP" || String(status) === "ok" ? "healthy" : "unhealthy"}`}>
                <div className="mp-health-name">{name}</div>
                <div className="mp-health-status">{String(status)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 配置列表 */}
      {loading ? (
        <div className="mp-loading">加载中...</div>
      ) : (
        <div className="mp-config-list">
          <h2>系统配置 ({configs.length})</h2>
          <table className="mp-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>配置键</th>
                <th style={{ width: 120 }}>类型</th>
                <th>值</th>
                <th style={{ width: 200 }}>描述</th>
                <th style={{ width: 100 }}>更新人</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(config => (
                <tr key={config.key} className={isFeatureFlag(config.key) ? "mp-config-feature" : ""}>
                  <td>
                    <code className="mp-config-key">{config.key}</code>
                    {isFeatureFlag(config.key) && <span className="mp-badge" style={{ marginLeft: 6, fontSize: 10 }}>功能开关</span>}
                  </td>
                  <td>{config.configType || "string"}</td>
                  <td>
                    {editKey === config.key ? (
                      isBooleanValue(config.value) ? (
                        <select value={editValue} onChange={e => setEditValue(e.target.value)}>
                          <option value="true">true (启用)</option>
                          <option value="false">false (禁用)</option>
                        </select>
                      ) : (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          style={{ width: "100%" }}
                        />
                      )
                    ) : (
                      <span className={`mp-config-value ${config.value === "true" ? "mp-config-true" : config.value === "false" ? "mp-config-false" : ""}`}>
                        {config.value}
                      </span>
                    )}
                  </td>
                  <td className="mp-config-desc">{config.description || "-"}</td>
                  <td>{config.updatedBy || "-"}</td>
                  <td>
                    {editKey === config.key ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="mp-btn mp-btn-sm mp-btn-primary" onClick={() => handleSave(config.key)}>保存</button>
                        <button className="mp-btn mp-btn-sm" onClick={() => setEditKey(null)}>取消</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="mp-btn mp-btn-sm" onClick={() => { setEditKey(config.key); setEditValue(config.value); }}>编辑</button>
                        <button className="mp-btn mp-btn-sm" onClick={() => handleDelete(config.key)} style={{ color: "#ef4444" }}>删除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增配置弹窗 */}
      {showAdd && (
        <div className="mp-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>新增配置</h2>
              <button className="mp-modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="mp-modal-body">
              <div className="mp-field">
                <label>配置键 *</label>
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="例如: feature.new_feature" />
              </div>
              <div className="mp-field">
                <label>值</label>
                <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="配置值" />
              </div>
              <div className="mp-field">
                <label>描述</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="配置说明" />
              </div>
            </div>
            <div className="mp-modal-footer">
              <button className="mp-btn" onClick={() => setShowAdd(false)}>取消</button>
              <button className="mp-btn mp-btn-primary" onClick={handleAdd} disabled={!newKey}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformConfig;
