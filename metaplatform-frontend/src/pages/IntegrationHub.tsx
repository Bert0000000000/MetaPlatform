import React, { useState, useEffect, useCallback } from "react";
import {
  listConnectors,
  createConnector,
  deleteConnector,
  testConnection,
  syncConnector,
} from "../api/integrationApi";

/* ---- Types ---- */
interface Connector {
  id: string;
  name: string;
  type: string;
  status?: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

type ConnectorType = "rest" | "database" | "csv";

interface ConnectorFormData {
  name: string;
  type: ConnectorType;
  config: Record<string, string>;
}

/* ---- Constants ---- */
const TYPE_LABELS: Record<string, string> = {
  rest: "REST",
  database: "Database",
  csv: "CSV",
};

const TYPE_ICONS: Record<string, string> = {
  rest: "🌐",
  database: "🗄️",
  csv: "📄",
};

const DEFAULT_CONFIGS: Record<ConnectorType, Record<string, string>> = {
  rest: { baseUrl: "", authType: "none", authToken: "" },
  database: { jdbcUrl: "", username: "", password: "" },
  csv: { filePath: "", delimiter: ",", hasHeader: "true" },
};

const CONFIG_LABELS: Record<string, string> = {
  baseUrl: "基础 URL",
  authType: "认证类型",
  authToken: "认证令牌",
  jdbcUrl: "JDBC URL",
  username: "用户名",
  password: "密码",
  filePath: "文件路径",
  delimiter: "分隔符",
  hasHeader: "含表头",
};

/* ---- Component ---- */
const IntegrationHub: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<ConnectorFormData>({
    name: "",
    type: "rest",
    config: { ...DEFAULT_CONFIGS.rest },
  });
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});

  /* Load connectors */
  const loadConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConnectors();
      setConnectors(Array.isArray(data) ? data : []);
    } catch {
      setError("加载连接器列表失败");
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectors();
  }, [loadConnectors]);

  /* Change connector type in form */
  function handleTypeChange(newType: ConnectorType) {
    setFormData({
      ...formData,
      type: newType,
      config: { ...DEFAULT_CONFIGS[newType] },
    });
  }

  /* Change config field */
  function handleConfigChange(field: string, value: string) {
    setFormData({
      ...formData,
      config: { ...formData.config, [field]: value },
    });
  }

  /* Create connector */
  async function handleCreate() {
    if (!formData.name.trim()) return;
    setCreating(true);
    try {
      await createConnector({
        name: formData.name,
        type: formData.type,
        config: formData.config,
        tenantId: "00000000-0000-0000-0000-000000000001",
      });
      setShowCreate(false);
      setFormData({ name: "", type: "rest", config: { ...DEFAULT_CONFIGS.rest } });
      loadConnectors();
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        __create: { type: "error", text: "创建连接器失败" },
      }));
    } finally {
      setCreating(false);
    }
  }

  /* Delete connector */
  async function handleDelete(id: string) {
    try {
      await deleteConnector(id);
      setConnectors((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* silent */
    }
  }

  /* Test connection */
  async function handleTest(id: string) {
    setTestingId(id);
    setStatusMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await testConnection(id);
      const ok = result?.success ?? result?.status === "ok" ?? true;
      setStatusMessages((prev) => ({
        ...prev,
        [id]: {
          type: ok ? "success" : "error",
          text: ok ? "连接测试成功" : "连接测试失败",
        },
      }));
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        [id]: { type: "error", text: "连接测试失败" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  /* Sync connector */
  async function handleSync(id: string) {
    setSyncingId(id);
    setStatusMessages((prev) => {
      const next = { ...prev };
      delete next[`sync-${id}`];
      return next;
    });
    try {
      await syncConnector(id);
      setStatusMessages((prev) => ({
        ...prev,
        [`sync-${id}`]: { type: "success", text: "同步完成" },
      }));
    } catch {
      setStatusMessages((prev) => ({
        ...prev,
        [`sync-${id}`]: { type: "error", text: "同步失败" },
      }));
    } finally {
      setSyncingId(null);
    }
  }

  function getStatusClass(connector: Connector): string {
    const s = (connector.status || "").toLowerCase();
    if (s === "active" || s === "connected") return "status-active";
    if (s === "error" || s === "failed") return "status-error";
    return "status-unknown";
  }

  function getStatusLabel(connector: Connector): string {
    const s = (connector.status || "").toLowerCase();
    if (s === "active" || s === "connected") return "已连接";
    if (s === "error" || s === "failed") return "异常";
    if (s === "inactive" || s === "disconnected") return "未连接";
    return connector.status || "未知";
  }

  return (
    <div className="mp-integration">
      {/* Header */}
      <div className="mp-integration-header">
        <div>
          <h1>集成中心</h1>
          <p>管理连接器和数据同步</p>
        </div>
        <button
          className="mp-btn mp-btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          + 新建连接器
        </button>
      </div>

      {/* Status messages */}
      {Object.entries(statusMessages).map(([key, msg]) => (
        <div
          key={key}
          className={`mp-alert mp-alert-${msg.type === "success" ? "success" : "error"}`}
        >
          {msg.text}
        </div>
      ))}

      {/* Create connector form */}
      {showCreate && (
        <div className="mp-integration-create">
          <h3>新建连接器</h3>
          <div className="mp-integration-create-form">
            <div className="mp-field">
              <label className="mp-field-label">
                名称<span className="mp-field-required">*</span>
              </label>
              <input
                type="text"
                className="mp-widget-input"
                placeholder="输入连接器名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="mp-field">
              <label className="mp-field-label">类型</label>
              <div className="mp-integration-type-selector">
                {(["rest", "database", "csv"] as ConnectorType[]).map((t) => (
                  <button
                    key={t}
                    className={`mp-integration-type-btn${formData.type === t ? " active" : ""}`}
                    onClick={() => handleTypeChange(t)}
                  >
                    <span>{TYPE_ICONS[t]}</span>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Config fields by type */}
            <div className="mp-integration-config-fields">
              {Object.entries(formData.config).map(([field, value]) => (
                <div key={field} className="mp-field">
                  <label className="mp-field-label">
                    {CONFIG_LABELS[field] || field}
                  </label>
                  {field === "password" ? (
                    <input
                      type="password"
                      className="mp-widget-input"
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    />
                  ) : field === "hasHeader" ? (
                    <select
                      className="mp-widget-select"
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="mp-widget-input"
                      value={value}
                      onChange={(e) =>
                        handleConfigChange(field, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mp-integration-create-actions">
              <button
                className="mp-btn mp-btn-primary"
                onClick={handleCreate}
                disabled={!formData.name.trim() || creating}
              >
                {creating ? "创建中..." : "创建"}
              </button>
              <button
                className="mp-btn"
                onClick={() => setShowCreate(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mp-alert mp-alert-error">{error}</div>}

      {/* Connector list */}
      {loading ? (
        <div className="mp-loading">加载中...</div>
      ) : connectors.length === 0 ? (
        <div className="mp-empty-hint">暂无连接器，请创建新连接器</div>
      ) : (
        <div className="mp-integration-list">
          {connectors.map((c) => (
            <div key={c.id} className={`mp-integration-card ${c.type}`}>
              <div className="mp-integration-card-header">
                <div className="mp-integration-card-icon">
                  {TYPE_ICONS[c.type] || "🔗"}
                </div>
                <div className="mp-integration-card-info">
                  <div className="mp-integration-card-name">{c.name}</div>
                  <div className="mp-integration-card-id">{c.id}</div>
                </div>
                <span className={`mp-integration-type-badge ${c.type}`}>
                  {TYPE_LABELS[c.type] || c.type}
                </span>
              </div>

              <div className="mp-integration-card-status">
                <span className={`mp-integration-status ${getStatusClass(c)}`}>
                  <span className="mp-integration-status-dot" />
                  {getStatusLabel(c)}
                </span>
              </div>

              {/* Status message for this connector */}
              {statusMessages[c.id] && (
                <div
                  className={`mp-alert mp-alert-${statusMessages[c.id].type === "success" ? "success" : "error"}`}
                  style={{ marginBottom: 8 }}
                >
                  {statusMessages[c.id].text}
                </div>
              )}
              {statusMessages[`sync-${c.id}`] && (
                <div
                  className={`mp-alert mp-alert-${statusMessages[`sync-${c.id}`].type === "success" ? "success" : "error"}`}
                  style={{ marginBottom: 8 }}
                >
                  {statusMessages[`sync-${c.id}`].text}
                </div>
              )}

              <div className="mp-integration-card-actions">
                <button
                  className="mp-btn mp-btn-sm"
                  onClick={() => handleTest(c.id)}
                  disabled={testingId === c.id}
                >
                  {testingId === c.id ? "测试中..." : "测试连接"}
                </button>
                <button
                  className="mp-btn mp-btn-sm"
                  onClick={() => handleSync(c.id)}
                  disabled={syncingId === c.id}
                >
                  {syncingId === c.id ? "同步中..." : "同步"}
                </button>
                <button
                  className="mp-btn mp-btn-sm mp-btn-danger"
                  onClick={() => handleDelete(c.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IntegrationHub;
