import React, { useEffect, useState, useCallback } from "react";
import {
  getAuditLogs,
  getLineageRecords,
  listProcessInstances,
  listProcessDefinitions,
  getProcessHistory,
  listAgentExecutions,
  listAgents,
  getDataSyncStats,
  getSchemaGraph,
} from "../api/adminApi";

type Tab = "audit" | "lineage" | "process" | "agent" | "sync" | "ontology";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "audit", label: "审计日志", icon: "📋" },
  { key: "lineage", label: "数据血缘", icon: "🔗" },
  { key: "process", label: "流程监控", icon: "⚙️" },
  { key: "agent", label: "Agent 监控", icon: "🤖" },
  { key: "sync", label: "数据同步", icon: "🔄" },
  { key: "ontology", label: "本体管理", icon: "🧠" },
];

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("audit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  // Lineage
  const [lineageRecords, setLineageRecords] = useState<Record<string, unknown>[]>([]);
  // Process
  const [processInstances, setProcessInstances] = useState<Record<string, unknown>[]>([]);
  const [processDefs, setProcessDefs] = useState<Record<string, unknown>[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<Record<string, unknown>[] | null>(null);
  // Agent
  const [agentExecutions, setAgentExecutions] = useState<Record<string, unknown>[]>([]);
  const [agents, setAgents] = useState<Record<string, unknown>[]>([]);
  // Sync
  const [syncStats, setSyncStats] = useState<Record<string, unknown> | null>(null);
  // Ontology
  const [schemaGraph, setSchemaGraph] = useState<Record<string, unknown> | null>(null);

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case "audit":
          setAuditLogs(await getAuditLogs());
          break;
        case "lineage":
          setLineageRecords(await getLineageRecords());
          break;
        case "process":
          setProcessInstances(await listProcessInstances());
          setProcessDefs(await listProcessDefinitions());
          break;
        case "agent":
          setAgentExecutions(await listAgentExecutions());
          setAgents(await listAgents());
          break;
        case "sync":
          setSyncStats(await getDataSyncStats());
          break;
        case "ontology":
          setSchemaGraph(await getSchemaGraph());
          break;
      }
    } catch (e: unknown) {
      // 静默处理，展示空状态
      console.warn(`Failed to load ${tab}:`, e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  const handleShowHistory = async (instanceId: string) => {
    try {
      setSelectedHistory(await getProcessHistory(instanceId));
    } catch {
      setSelectedHistory([]);
    }
  };

  return (
    <div className="mp-admin">
      <div className="mp-admin-header">
        <h1>平台管理</h1>
        <p>审计、血缘、流程、Agent、数据同步、本体管理</p>
      </div>

      {/* Tab bar */}
      <div className="mp-admin-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`mp-admin-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => { setActiveTab(t.key); setSelectedHistory(null); }}
          >
            <span className="mp-admin-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="mp-alert mp-alert-error">{error}</div>}
      {loading && <div className="mp-loading">加载中...</div>}

      <div className="mp-admin-content">
        {/* 审计日志 */}
        {activeTab === "audit" && !loading && (
          <div className="mp-admin-section">
            <h2>审计日志 ({auditLogs.length})</h2>
            {auditLogs.length === 0 ? (
              <div className="mp-empty-hint">暂无审计记录</div>
            ) : (
              <table className="mp-table mp-table-compact">
                <thead>
                  <tr><th>时间</th><th>操作</th><th>资源类型</th><th>资源ID</th><th>用户</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={i}>
                      <td className="mp-mono">{String(log.createdAt || "").slice(0, 19)}</td>
                      <td><span className="mp-badge">{String(log.action)}</span></td>
                      <td>{String(log.resourceType)}</td>
                      <td className="mp-mono">{String(log.resourceId || "").slice(0, 8)}...</td>
                      <td>{String(log.userId || "-")}</td>
                      <td className="mp-mono">{String(log.ipAddress || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 数据血缘 */}
        {activeTab === "lineage" && !loading && (
          <div className="mp-admin-section">
            <h2>数据血缘记录 ({lineageRecords.length})</h2>
            {lineageRecords.length === 0 ? (
              <div className="mp-empty-hint">暂无血缘记录</div>
            ) : (
              <table className="mp-table mp-table-compact">
                <thead>
                  <tr><th>时间</th><th>操作</th><th>源</th><th>→</th><th>目标</th><th>用户</th></tr>
                </thead>
                <tbody>
                  {lineageRecords.map((r, i) => (
                    <tr key={i}>
                      <td className="mp-mono">{String(r.createdAt || "").slice(0, 19)}</td>
                      <td><span className="mp-badge">{String(r.operation)}</span></td>
                      <td><code>{String(r.sourceType)}</code>:{String(r.sourceId || "").slice(0, 8)}</td>
                      <td>→</td>
                      <td><code>{String(r.targetType)}</code>:{String(r.targetId || "").slice(0, 8)}</td>
                      <td>{String(r.userId || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 流程监控 */}
        {activeTab === "process" && !loading && (
          <div className="mp-admin-section">
            <h2>流程定义 ({processDefs.length})</h2>
            {processDefs.length > 0 && (
              <div className="mp-admin-card-grid">
                {processDefs.map((d, i) => (
                  <div key={i} className="mp-admin-card">
                    <div className="mp-admin-card-title">{String(d.name)}</div>
                    <div className="mp-admin-card-meta">版本 {String(d.version)} | {String(d.status)}</div>
                    <div className="mp-admin-card-desc">{String(d.description || "无描述")}</div>
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ marginTop: 24 }}>流程实例 ({processInstances.length})</h2>
            {processInstances.length === 0 ? (
              <div className="mp-empty-hint">暂无流程实例</div>
            ) : (
              <table className="mp-table mp-table-compact">
                <thead>
                  <tr><th>ID</th><th>标题</th><th>发起人</th><th>当前节点</th><th>状态</th><th>开始时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {processInstances.map((inst, i) => (
                    <tr key={i}>
                      <td className="mp-mono">{String(inst.id || "").slice(0, 8)}...</td>
                      <td>{String(inst.title || "-")}</td>
                      <td>{String(inst.initiatorId || "-")}</td>
                      <td className="mp-mono">{String(inst.currentNodeId || "-")}</td>
                      <td><span className={`mp-badge ${inst.status === "running" ? "mp-badge-active" : ""}`}>{String(inst.status)}</span></td>
                      <td className="mp-mono">{String(inst.startedAt || "").slice(0, 19)}</td>
                      <td><button className="mp-btn mp-btn-sm" onClick={() => handleShowHistory(String(inst.id))}>历史</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 流程事件历史 */}
            {selectedHistory && (
              <div style={{ marginTop: 16 }}>
                <h3>流程事件历史 ({selectedHistory.length})</h3>
                <button className="mp-btn mp-btn-sm" onClick={() => setSelectedHistory(null)} style={{ marginBottom: 8 }}>关闭</button>
                <table className="mp-table mp-table-compact">
                  <thead>
                    <tr><th>时间</th><th>事件类型</th><th>节点</th><th>数据</th></tr>
                  </thead>
                  <tbody>
                    {selectedHistory.map((evt, i) => (
                      <tr key={i}>
                        <td className="mp-mono">{String(evt.createdAt || "").slice(0, 19)}</td>
                        <td><span className="mp-badge">{String(evt.eventType)}</span></td>
                        <td className="mp-mono">{String(evt.nodeId || "-")}</td>
                        <td className="mp-mono mp-truncate">{JSON.stringify(evt.data || {}).slice(0, 60)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Agent 监控 */}
        {activeTab === "agent" && !loading && (
          <div className="mp-admin-section">
            <h2>Agent 定义 ({agents.length})</h2>
            {agents.length > 0 && (
              <div className="mp-admin-card-grid">
                {agents.map((a, i) => (
                  <div key={i} className="mp-admin-card">
                    <div className="mp-admin-card-title">{String(a.name)}</div>
                    <div className="mp-admin-card-meta">模型: {String(a.model || "default")} | 最大步数: {String(a.maxSteps || 10)}</div>
                    <div className="mp-admin-card-desc">{String(a.description || "无描述")}</div>
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ marginTop: 24 }}>执行记录 ({agentExecutions.length})</h2>
            {agentExecutions.length === 0 ? (
              <div className="mp-empty-hint">暂无 Agent 执行记录</div>
            ) : (
              <table className="mp-table mp-table-compact">
                <thead>
                  <tr><th>ID</th><th>任务</th><th>状态</th><th>步数</th><th>Token</th><th>耗时</th><th>开始时间</th></tr>
                </thead>
                <tbody>
                  {agentExecutions.map((ex, i) => {
                    const steps = ex.steps as unknown[] | undefined;
                    return (
                      <tr key={i}>
                        <td className="mp-mono">{String(ex.id || "").slice(0, 8)}...</td>
                        <td className="mp-truncate" style={{ maxWidth: 200 }}>{String(ex.taskDescription || "").slice(0, 40)}</td>
                        <td><span className={`mp-badge ${ex.status === "completed" ? "mp-badge-success" : ex.status === "running" ? "mp-badge-active" : ""}`}>{String(ex.status)}</span></td>
                        <td>{steps?.length || 0}</td>
                        <td>{String(ex.totalTokens || 0)}</td>
                        <td>{ex.totalDurationMs ? `${(Number(ex.totalDurationMs) / 1000).toFixed(1)}s` : "-"}</td>
                        <td className="mp-mono">{String(ex.startedAt || "").slice(0, 19)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 数据同步 */}
        {activeTab === "sync" && !loading && (
          <div className="mp-admin-section">
            <h2>数据同步统计</h2>
            {syncStats ? (
              <div className="mp-admin-stats">
                <div className="mp-admin-stat">
                  <div className="mp-admin-stat-value">{String(syncStats.totalRecords || 0)}</div>
                  <div className="mp-admin-stat-label">总记录数</div>
                </div>
                <div className="mp-admin-stat">
                  <div className="mp-admin-stat-value">{String(syncStats.lastSyncTime || "-")}</div>
                  <div className="mp-admin-stat-label">最近同步</div>
                </div>
              </div>
            ) : (
              <div className="mp-empty-hint">暂无同步数据</div>
            )}
          </div>
        )}

        {/* 本体管理 */}
        {activeTab === "ontology" && !loading && (
          <div className="mp-admin-section">
            <h2>Schema 图谱</h2>
            {schemaGraph ? (
              <div>
                <div className="mp-admin-stats">
                  <div className="mp-admin-stat">
                    <div className="mp-admin-stat-value">{(schemaGraph.nodes as unknown[] || []).length}</div>
                    <div className="mp-admin-stat-label">节点 (ObjectType)</div>
                  </div>
                  <div className="mp-admin-stat">
                    <div className="mp-admin-stat-value">{(schemaGraph.edges as unknown[] || []).length}</div>
                    <div className="mp-admin-stat-label">边 (关系)</div>
                  </div>
                </div>

                <h3 style={{ marginTop: 16 }}>节点列表</h3>
                <table className="mp-table mp-table-compact">
                  <thead>
                    <tr><th>类型</th><th>编码</th><th>显示名</th></tr>
                  </thead>
                  <tbody>
                    {(schemaGraph.nodes as Record<string, unknown>[] || []).map((n, i) => (
                      <tr key={i}>
                        <td><code>{String(n.type || "")}</code></td>
                        <td>{String(n.code || n.id || "")}</td>
                        <td>{String(n.displayName || n.name || "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mp-empty-hint">暂无 Schema 数据</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
