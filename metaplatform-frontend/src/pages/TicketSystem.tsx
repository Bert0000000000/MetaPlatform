import React, { useEffect, useState, useCallback } from "react";
import { listObjectTypes, createObjectInstance, listObjectInstances } from "../api/ontologyApi";

interface Ticket {
  id: string;
  fieldValues: Record<string, { value: unknown }>;
  state: string;
  createdAt: string;
}

const TicketSystem: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [objectTypeId, setObjectTypeId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const types = await listObjectTypes();
      const ticketType = types.find((t: { code: string }) =>
        t.code === "ticket" || t.code === "工单" || t.displayName?.includes("工单")
      );
      if (ticketType) {
        setObjectTypeId(ticketType.id);
        const instances = await listObjectInstances(ticketType.id);
        setTickets(instances);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreate = async () => {
    if (!objectTypeId || !newTitle) return;
    try {
      await createObjectInstance(objectTypeId, {
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        status: "open",
      });
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      await loadTickets();
    } catch (e) {
      console.error("Failed to create ticket:", e);
    }
  };

  const getFieldValue = (ticket: Ticket, field: string): string => {
    const fv = ticket.fieldValues?.[field];
    return fv ? String(fv.value ?? "") : "";
  };

  const filtered = filterStatus === "all"
    ? tickets
    : tickets.filter(t => t.state === filterStatus || getFieldValue(t, "status") === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "#3b82f6";
      case "in_progress": return "#f59e0b";
      case "resolved": return "#22c55e";
      case "closed": return "#6b7280";
      default: return "#94a3b8";
    }
  };

  const getPriorityIcon = (p: string) => {
    switch (p) {
      case "high": return "🔴";
      case "medium": return "🟡";
      case "low": return "🟢";
      default: return "⚪";
    }
  };

  return (
    <div className="mp-ticket">
      <div className="mp-ticket-header">
        <div>
          <h1>工单系统</h1>
          <p>创建、跟踪和管理工单</p>
        </div>
        <button className="mp-btn mp-btn-primary" onClick={() => setShowCreate(true)}>
          + 新建工单
        </button>
      </div>

      {/* 状态过滤 */}
      <div className="mp-ticket-filters">
        {["all", "open", "in_progress", "resolved", "closed"].map(s => (
          <button
            key={s}
            className={`mp-ticket-filter ${filterStatus === s ? "active" : ""}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "全部" : s === "open" ? "待处理" : s === "in_progress" ? "处理中" : s === "resolved" ? "已解决" : "已关闭"}
            <span className="mp-ticket-filter-count">
              {s === "all" ? tickets.length : tickets.filter(t => t.state === s || getFieldValue(t, "status") === s).length}
            </span>
          </button>
        ))}
      </div>

      {/* 工单列表 */}
      {loading ? (
        <div className="mp-loading">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="mp-empty-hint">
          {objectTypeId ? "暂无工单，点击右上角创建" : "未找到工单类型的 ObjectType，请先在建模特工场创建"}
        </div>
      ) : (
        <div className="mp-ticket-list">
          {filtered.map(ticket => {
            const status = getFieldValue(ticket, "status") || ticket.state || "open";
            const priority = getFieldValue(ticket, "priority") || "medium";
            return (
              <div key={ticket.id} className="mp-ticket-card">
                <div className="mp-ticket-card-header">
                  <span className="mp-ticket-id">#{ticket.id.slice(0, 8)}</span>
                  <span
                    className="mp-ticket-status"
                    style={{ background: getStatusColor(status) + "20", color: getStatusColor(status) }}
                  >
                    {status === "open" ? "待处理" : status === "in_progress" ? "处理中" : status === "resolved" ? "已解决" : "已关闭"}
                  </span>
                  <span className="mp-ticket-priority">{getPriorityIcon(priority)}</span>
                </div>
                <div className="mp-ticket-card-title">
                  {getFieldValue(ticket, "title") || getFieldValue(ticket, "name") || "无标题"}
                </div>
                <div className="mp-ticket-card-desc">
                  {getFieldValue(ticket, "description") || getFieldValue(ticket, "content") || "无描述"}
                </div>
                <div className="mp-ticket-card-meta">
                  <span>创建时间: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "-"}</span>
                  {getFieldValue(ticket, "assignee") && <span>负责人: {getFieldValue(ticket, "assignee")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 创建工单弹窗 */}
      {showCreate && (
        <div className="mp-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h2>新建工单</h2>
              <button className="mp-modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="mp-modal-body">
              <div className="mp-field">
                <label>标题 *</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="工单标题" />
              </div>
              <div className="mp-field">
                <label>描述</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="详细描述..." rows={4} />
              </div>
              <div className="mp-field">
                <label>优先级</label>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                  <option value="high">🔴 高</option>
                  <option value="medium">🟡 中</option>
                  <option value="low">🟢 低</option>
                </select>
              </div>
            </div>
            <div className="mp-modal-footer">
              <button className="mp-btn" onClick={() => setShowCreate(false)}>取消</button>
              <button className="mp-btn mp-btn-primary" onClick={handleCreate} disabled={!newTitle}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketSystem;
