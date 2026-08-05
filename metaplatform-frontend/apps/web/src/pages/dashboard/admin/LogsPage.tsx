import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, DownloadOutlined, EyeOutlined, SearchOutlined } from "@ant-design/icons";
import {
  auditLogsExportUrl,
  getAuditLog,
  getAuditModules,
  listAuditLogs,
} from "@/api/admin/logs";
import type { AdminAuditLog, AuditAction } from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";
import { apiClient } from "@/api/client";



const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  ENABLE: "green",
  DISABLE: "default",
  RESET_PASSWORD: "purple",
  LOGIN: "cyan",
  LOGOUT: "default",
  ASSIGN: "blue",
  REVOKE: "volcano",
  EXPORT: "geekblue",
  CONFIG_CHANGE: "gold",
  IMPORT: "gold",
  OTHER: "default",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "创建",
  UPDATE: "更新",
  DELETE: "删除",
  ENABLE: "启用",
  DISABLE: "停用",
  RESET_PASSWORD: "重置密码",
  LOGIN: "登录",
  LOGOUT: "登出",
  ASSIGN: "分配",
  REVOKE: "撤销",
  EXPORT: "导出",
  CONFIG_CHANGE: "配置变更",
  IMPORT: "导入",
  OTHER: "其他",
};

export default function LogsPage() {
  const { settings } = useSettings();
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actor, setActor] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<AuditAction | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [modules, setModules] = useState<{ value: string; count: number }[]>([]);
  const [actions, setActions] = useState<{ value: string; count: number }[]>([]);
  const [detail, setDetail] = useState<AdminAuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listAuditLogs({
        actor: actor || undefined,
        module: moduleFilter,
        action: actionFilter,
        start: dateRange?.[0] ?? undefined,
        end: dateRange?.[1] ?? undefined,
        page,
        pageSize,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  const loadFacets = async () => {
    try {
      const m = await getAuditModules();
      setModules(m.modules ?? []);
      setActions(m.actions ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadFacets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const openDetail = async (row: AdminAuditLog) => {
    setDetail(row);
    setDetailOpen(true);
    try {
      const fresh = await getAuditLog(row.id);
      setDetail(fresh);
    } catch {
      /* ignore */
    }
  };

  const handleExport = async () => {
    try {
      const url = auditLogsExportUrl({
        actor: actor || undefined,
        module: moduleFilter,
        action: actionFilter,
        start: dateRange?.[0] ?? undefined,
        end: dateRange?.[1] ?? undefined,
      });
      const res = await apiClient.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "audit-logs.csv";
      link.click();
      URL.revokeObjectURL(link.href);
      message.success("已导出");
    } catch {
      message.error("导出失败");
    }
  };

  const columns: ColumnsType<AdminAuditLog> = useMemo(
    () => [
      {
        title: "时间",
        dataIndex: "occurredAt",
        render: (v: string) => (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {formatDateTime(v, settings)}
          </span>
        ),
      },
      {
        title: "操作者",
        key: "actor",
        render: (_v, r) => (
          <Space size={4}>
            <span>{r.actorName || r.actorId}</span>
            {r.ip && <Tag style={{ fontFamily: "var(--font-mono)" }}>{r.ip}</Tag>}
          </Space>
        ),
      },
      { title: "模块", dataIndex: "module", render: (v: string) => <Tag>{v}</Tag> },
      {
        title: "动作",
        dataIndex: "action",
        render: (v: AuditAction) => (
          <Tag color={ACTION_COLORS[v] ?? "default"}>{ACTION_LABEL[v] ?? v}</Tag>
        ),
      },
      {
        title: "资源",
        key: "resource",
        render: (_v, r) => (
          <span style={{ fontSize: 12 }}>
            {r.resourceType && <Tag>{r.resourceType}</Tag>}
            {r.resourceName || r.resourceId || "-"}
          </span>
        ),
      },
      { title: "摘要", dataIndex: "summary", ellipsis: true },
      {
        title: "操作",
        key: "actions",
        width: 100,
        render: (_v, r) => (
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
            详情
          </Button>
        ),
      },
    ],
    [settings],
  );

  const { todayCount, successCount, failureCount } = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    let today = 0;
    let success = 0;
    let failure = 0;
    for (const it of items) {
      const day = (it.occurredAt ?? "").slice(0, 10);
      if (day === todayPrefix) today += 1;
      if (it.action === "CREATE" || it.action === "UPDATE" || it.action === "ENABLE" || it.action === "ASSIGN" || it.action === "LOGIN" || it.action === "EXPORT" || it.action === "IMPORT") {
        success += 1;
      }
      if (it.action === "DELETE" || it.action === "REVOKE" || it.action === "DISABLE") {
        failure += 1;
      }
    }
    return { todayCount: today, successCount: success, failureCount: failure };
  }, [items]);

  return (
    <AdminLayout
      title="日志管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出 CSV
        </Button>
      </Space>
    }
  >
      <StatGrid>
        <StatCard label="总日志" value={total} />
        <StatCard label="今日日志" value={todayCount} color="warning" />
        <StatCard label="成功操作" value={successCount} color="success" />
        <StatCard
          label="失败操作"
          value={failureCount}
          color={failureCount > 0 ? "destructive" : "default"}
        />
      </StatGrid>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Input.Search
          placeholder="按操作者搜索"
          allowClear
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          onSearch={() => { setPage(1); load(); }}
          style={{ maxWidth: 240 }}
        />
        <Select
          placeholder="模块"
          value={moduleFilter}
          onChange={(v) => { setModuleFilter(v); setPage(1); }}
          allowClear
          style={{ width: 140 }}
          options={Array.isArray(modules) ? modules.map((m) => ({ value: m.value, label: m.value + " (" + m.count + ")" })) : []}
        />
        <Select
          placeholder="动作"
          value={actionFilter}
          onChange={(v) => { setActionFilter(v as AuditAction); setPage(1); }}
          allowClear
          style={{ width: 140 }}
          options={Array.isArray(actions) ? actions.map((a) => ({ value: a.value, label: a.value + " (" + a.count + ")" })) : []}
        />
        <input
          type="datetime-local"
          value={dateRange?.[0] ? dateRange[0].slice(0, 16) : ""}
          onChange={(e) => setDateRange([e.target.value ? new Date(e.target.value).toISOString() : "", dateRange?.[1] ?? ""])}
          style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", color: "var(--foreground)" }}
        />
        <span style={{ color: "var(--muted-foreground)" }}>~</span>
        <input
          type="datetime-local"
          value={dateRange?.[1] ? dateRange[1].slice(0, 16) : ""}
          onChange={(e) => setDateRange([dateRange?.[0] ?? "", e.target.value ? new Date(e.target.value).toISOString() : ""])}
          style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 8px", color: "var(--foreground)" }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); load(); }}>
          查询
        </Button>
        <Button
          onClick={() => {
            setActor(""); setModuleFilter(undefined); setActionFilter(undefined); setDateRange(null); setPage(1);
          }}
        >
          重置
        </Button>
      </div>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 8,
        }}
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items ?? []}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
        />
      </div>
      <Drawer
        title={detail ? "日志详情 #" + detail.id : ""}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size={620}
      >
        {detail && (
          <Form layout="vertical" size="small">
            <Form.Item label="时间">{formatDateTime(detail.occurredAt, settings)}</Form.Item>
            <Form.Item label="操作者">{detail.actorName} ({detail.actorId})</Form.Item>
            <Form.Item label="模块"><Tag>{detail.module}</Tag></Form.Item>
            <Form.Item label="动作">
              <Tag color={ACTION_COLORS[detail.action] ?? "default"}>{ACTION_LABEL[detail.action] ?? detail.action}</Tag>
            </Form.Item>
            <Form.Item label="资源">
              {detail.resourceType && <Tag>{detail.resourceType}</Tag>}
              {detail.resourceName} <span style={{ color: "var(--muted-foreground)" }}>#{detail.resourceId}</span>
            </Form.Item>
            <Form.Item label="摘要">{detail.summary || "-"}</Form.Item>
            <Form.Item label="IP / UA">
              <Typography.Text code>{detail.ip ?? "-"}</Typography.Text>
              <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 4 }}>
                {detail.userAgent || "-"}
              </div>
            </Form.Item>
            <Form.Item label="详情 (JSON)">
              <pre
                style={{
                  background: "var(--muted)",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 12,
                  overflow: "auto",
                  maxHeight: 300,
                }}
              >
                {detail.detail ? JSON.stringify(JSON.parse(detail.detail), null, 2) : "-"}
              </pre>
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </AdminLayout>
  );
}