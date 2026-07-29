import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Modal,
  Popconfirm,
  message,
  Drawer,
  Descriptions,
  Upload,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  ReloadOutlined,
  KeyOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  StopOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import {
  createUser,
  deleteUser,
  getUser,
  importUsers,
  listUserLoginLogs,
  listUsers,
  resetUserPassword,
  setUserStatus,
  updateUser,
  usersExportUrl,
} from "@/api/admin";
import type { CreateUserPayload, UpdateUserPayload } from "@/api/admin";
import type { AdminRole, AdminUser, UserStatus } from "@/types";
import { listRoles } from "@/api/admin/permissions";
import { apiClient } from "@/api/client";
import { AdminLayout } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "已启用",
  INACTIVE: "已停用",
  LOCKED: "已锁定",
};

const STATUS_COLOR: Record<UserStatus, string> = {
  ACTIVE: "success",
  INACTIVE: "default",
  LOCKED: "warning",
};

export default function UsersPage() {
  const { settings } = useSettings();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loginLogs, setLoginLogs] = useState<Array<{ id: number; occurredAt: string; result: string; ip?: string | null }>>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [createForm] = Form.useForm<CreateUserPayload>();
  const [editForm] = Form.useForm<UpdateUserPayload>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listUsers({
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        page,
        pageSize,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      /* axios interceptor shows toast */
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const r = await listRoles({ pageSize: 100 });
      setRoles(r.items);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter]);

  const openDetail = async (u: AdminUser) => {
    setSelectedUser(u);
    setDetailOpen(true);
    try {
      const fresh = await getUser(u.id);
      setSelectedUser(fresh);
      const logs = await listUserLoginLogs(u.id, 1, 20);
      setLoginLogs(logs.items);
    } catch {
      /* ignore */
    }
  };

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    try {
      const r = await createUser(values);
      message.success(`已创建用户 ${r.username}`);
      if (r.initialPassword) {
        Modal.info({
          title: "初始密码",
          content: (
            <div>
              <p>请保存以下初始密码并告知用户：</p>
              <Input.TextArea readOnly value={r.initialPassword} autoSize={{ minRows: 2 }} />
            </div>
          ),
          okText: "已保存",
        });
      }
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch {
      /* ignore */
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditTarget(u);
    editForm.setFieldsValue({
      realName: u.realName ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      department: u.department ?? "",
      position: u.position ?? "",
      status: u.status,
      roleIds: u.roleIds,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const values = await editForm.validateFields();
    try {
      await updateUser(editTarget.id, values);
      message.success("已更新");
      setEditOpen(false);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleStatus = async (u: AdminUser, next: UserStatus) => {
    try {
      await setUserStatus(u.id, next);
      message.success(`已更新 ${u.username} 的状态`);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (u: AdminUser) => {
    try {
      await deleteUser(u.id);
      message.success(`已删除 ${u.username}`);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleReset = async (u: AdminUser) => {
    try {
      const r = await resetUserPassword(u.id);
      setResetResult({ username: r.username, password: r.temporaryPassword });
    } catch {
      /* ignore */
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.get(usersExportUrl(), { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(url);
      message.success("已导出");
    } catch {
      message.error("导出失败");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const r = await importUsers(file);
      message.success(`导入完成：成功 ${r.created}，跳过 ${r.skipped}`);
      load();
    } catch {
      /* ignore */
    }
    return false;
  };

  const columns: ColumnsType<AdminUser> = useMemo(
    () => [
      {
        title: "用户",
        key: "user",
        render: (_v, r) => (
          <a onClick={() => openDetail(r)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {(r.realName || r.username).charAt(0)}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 500 }}>{r.realName || r.username}</span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>@{r.username}</span>
            </div>
          </a>
        ),
      },
      {
        title: "邮箱",
        dataIndex: "email",
        render: (v?: string) => (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v ?? "—"}</span>
        ),
      },
      { title: "部门", dataIndex: "department", render: (v?: string) => v ?? "—" },
      {
        title: "角色",
        dataIndex: "roleCodes",
        render: (codes: string[]) => (
          <Space size={4} wrap>
            {codes.length === 0 ? (
              <span style={{ color: "var(--muted-foreground)" }}>—</span>
            ) : (
              codes.map((c) => (
                <Tag key={c} color={c.startsWith("PLATFORM_SUPER") ? "red" : c.includes("ADMIN") ? "blue" : "default"}>
                  {c}
                </Tag>
              ))
            )}
          </Space>
        ),
      },
      {
        title: "状态",
        dataIndex: "status",
        render: (s: UserStatus) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
      },
      {
        title: "最近登录",
        dataIndex: "lastLoginAt",
        render: (v?: string) =>
          v ? (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {formatDateTime(v, settings)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        title: "操作",
        key: "actions",
        width: 280,
        render: (_v, r) => (
          <Space size={4} wrap>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
              编辑
            </Button>
            <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => handleReset(r)}>
              重置密码
            </Button>
            {r.status === "ACTIVE" ? (
              <Popconfirm
                title="停用该用户？"
                onConfirm={() => handleStatus(r, "INACTIVE")}
                okText="停用"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<StopOutlined />} danger>
                  停用
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatus(r, "ACTIVE")}
              >
                启用
              </Button>
            )}
            <Popconfirm
              title={`确认删除用户 ${r.username}？`}
              description="此操作不可恢复"
              onConfirm={() => handleDelete(r)}
              okText="删除"
              okType="danger"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<DeleteOutlined />} danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [settings],
  );

  return (
    <AdminLayout
      title="用户管理"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Upload accept=".csv" showUploadList={false} beforeUpload={(f) => handleImport(f)}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建用户
          </Button>
        </Space>
      }
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <Input.Search
          placeholder="搜索用户名 / 姓名 / 邮箱"
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ maxWidth: 320 }}
        />
        <Select
          placeholder="状态"
          value={statusFilter || undefined}
          onChange={(v) => {
            setStatusFilter((v || "") as UserStatus | "");
            setPage(1);
          }}
          allowClear
          style={{ width: 140 }}
          options={[
            { value: "ACTIVE", label: "已启用" },
            { value: "INACTIVE", label: "已停用" },
            { value: "LOCKED", label: "已锁定" },
          ]}
        />
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
          dataSource={users}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          size="middle"
        />
      </div>

      <Drawer
        title={selectedUser ? `${selectedUser.realName || selectedUser.username} 的详情` : ""}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={520}
      >
        {selectedUser && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="用户名">{selectedUser.username}</Descriptions.Item>
              <Descriptions.Item label="姓名">{selectedUser.realName || "—"}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{selectedUser.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="手机">{selectedUser.phone || "—"}</Descriptions.Item>
              <Descriptions.Item label="部门">{selectedUser.department || "—"}</Descriptions.Item>
              <Descriptions.Item label="职位">{selectedUser.position || "—"}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[selectedUser.status]}>{STATUS_LABEL[selectedUser.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                <Space size={4} wrap>
                  {selectedUser.roleCodes.length === 0
                    ? "—"
                    : selectedUser.roleCodes.map((c) => <Tag key={c}>{c}</Tag>)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="最后登录">
                {selectedUser.lastLoginAt
                  ? `${formatDateTime(selectedUser.lastLoginAt, settings)} (${selectedUser.lastLoginIp ?? "?"})`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(selectedUser.createdAt, settings)}
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: 16 }}>
              <HistoryOutlined /> 最近登录日志
            </h4>
            {loginLogs.length === 0 ? (
              <Typography.Text type="secondary">暂无登录日志</Typography.Text>
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={loginLogs}
                columns={[
                  { title: "时间", dataIndex: "occurredAt", render: (v: string) => formatDateTime(v, settings) },
                  {
                    title: "结果",
                    dataIndex: "result",
                    render: (v: string) => <Tag color={v === "SUCCESS" ? "success" : "error"}>{v}</Tag>,
                  },
                  { title: "IP", dataIndex: "ip", render: (v?: string) => v ?? "—" },
                ]}
              />
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2, max: 64 }]}>
            <Input placeholder="登录名" />
          </Form.Item>
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码（留空自动生成）">
            <Input.Password />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select
              options={[
                { value: "ACTIVE", label: "已启用" },
                { value: "INACTIVE", label: "已停用" },
                { value: "LOCKED", label: "已锁定" },
              ]}
            />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              options={roles.map((r) => ({ value: r.id, label: r.name + " (" + r.code + ")" }))}
              placeholder="选择角色"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editTarget ? "编辑 " + editTarget.username : "编辑"}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="realName" label="姓名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: "ACTIVE", label: "已启用" },
                { value: "INACTIVE", label: "已停用" },
                { value: "LOCKED", label: "已锁定" },
              ]}
            />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              options={roles.map((r) => ({ value: r.id, label: r.name + " (" + r.code + ")" }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="密码已重置"
        open={!!resetResult}
        onCancel={() => setResetResult(null)}
        onOk={() => setResetResult(null)}
        okText="已复制"
      >
        {resetResult && (
          <div>
            <p>
              用户 <b>{resetResult.username}</b> 的临时密码：
            </p>
            <Input.TextArea
              readOnly
              autoSize={{ minRows: 2 }}
              value={resetResult.password}
              onClick={(e) => {
                (e.target as HTMLTextAreaElement).select();
                navigator.clipboard.writeText(resetResult.password).then(() => message.success("已复制"));
              }}
            />
            <p style={{ marginTop: 8, color: "var(--muted-foreground)", fontSize: 12 }}>
              请将临时密码告知用户，登录后建议立即修改。
            </p>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

