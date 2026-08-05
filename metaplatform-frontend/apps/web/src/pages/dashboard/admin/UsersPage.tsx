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
  Descriptions,
  Upload,
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
  UserOutlined,
  MailOutlined,
} from "@ant-design/icons";
import {
  createUser,
  deleteUser,
  importUsers,
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
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
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

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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
      /* interceptor shows toast */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const handleEdit = (u: AdminUser) => {
    setEditTarget(u);
    editForm.setFieldsValue({
      realName: u.realName ?? undefined,
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      department: u.department ?? undefined,
      roleIds: u.roleIds,
      status: u.status,
    });
    setEditOpen(true);
  };

  const handleDelete = async (u: AdminUser) => {
    try {
      await deleteUser(u.id);
      message.success("用户已删除");
      if (selectedUser?.id === u.id) setSelectedUser(null);
      load();
    } catch {
      /* toast */
    }
  };

  const handleReset = async (u: AdminUser) => {
    try {
      const r = await resetUserPassword(u.id);
      setResetResult({ username: u.username, password: r.temporaryPassword });
    } catch {
      /* toast */
    }
  };

  const handleStatus = async (u: AdminUser, next: UserStatus) => {
    try {
      await setUserStatus(u.id, next);
      message.success(next === "ACTIVE" ? "用户已启用" : "用户已停用");
      load();
    } catch {
      /* toast */
    }
  };

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    try {
      await createUser(values);
      message.success("用户已创建");
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch {
      /* toast */
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const values = await editForm.validateFields();
    try {
      await updateUser(editTarget.id, values);
      message.success("用户已更新");
      setEditOpen(false);
      setEditTarget(null);
      load();
    } catch {
      /* toast */
    }
  };

  const handleExport = async () => {
    try {
      const url = usersExportUrl();
      const r = await apiClient.get<Blob>(url, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data as Blob);
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(a.href);
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

  useEffect(() => {
    listRoles().then((r) => setRoles(r.items ?? [])).catch(() => undefined);
  }, []);

  const stats = useMemo(
    () => ({
      total: total,
      active: (users ?? []).filter((u) => u.status === "ACTIVE").length,
      locked: (users ?? []).filter((u) => u.status === "LOCKED").length,
      inactive: (users ?? []).filter((u) => u.status === "INACTIVE").length,
    }),
    [users, total],
  );

  const columns: ColumnsType<AdminUser> = useMemo(
    () => [
      {
        title: "用户",
        key: "user",
        render: (_v, r) => {
          const seed = r?.realName || r?.username || "?";
          const selected = selectedUser?.id === r?.id;
          return (
            <div
              onClick={() => setSelectedUser(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 160,
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: avatarColor(seed),
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {seed.charAt(0)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: selected ? "var(--foreground)" : "var(--foreground)" }}>
                  {r.realName || r.username}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                  @{r.username}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        title: "邮箱",
        dataIndex: "email",
        render: (v?: string) => (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>
            {v ?? "—"}
          </span>
        ),
      },
      { title: "部门", dataIndex: "department", render: (v?: string) => v ?? "—", width: 100 },
      {
        title: "角色",
        dataIndex: "roleIds",
        width: 200,
        render: (roleIds?: number[], record?: AdminUser) => {
          const codeMap = new Map((roles ?? []).map((r) => [r.id, r]));
          const codes: string[] = (record?.roleCodes ?? (roleIds ?? [])
            .map((id) => codeMap.get(id)?.code)
            .filter((c): c is string => Boolean(c))) as string[];
          return (
            <Space size={4} wrap>
              {codes.length === 0 ? (
                <span style={{ color: "var(--muted-foreground)" }}>—</span>
              ) : (
                codes.map((c) => (
                  <Tag
                    key={c}
                    color={c.startsWith("PLATFORM_SUPER") ? "red" : c.includes("ADMIN") ? "blue" : "default"}
                    style={{ margin: 0 }}
                  >
                    {c}
                  </Tag>
                ))
              )}
            </Space>
          );
        },
      },
      {
        title: "状态",
        dataIndex: "status",
        width: 90,
        render: (s: UserStatus) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
      },
      {
        title: "最后登录",
        dataIndex: "lastLoginAt",
        width: 160,
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
        width: 220,
        render: (_v, r) => (
          <Space size={0} onClick={(e) => e.stopPropagation()}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
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
    [settings, selectedUser],
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
          <Upload accept=".csv" showUploadList={false} beforeUpload={handleImport}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建用户
          </Button>
        </Space>
      }
    >
      <StatGrid>
        <StatCard label="总用户" value={stats.total} />
        <StatCard label="已启用" value={stats.active} color="success" />
        <StatCard label="已锁定" value={stats.locked} color="warning" />
        <StatCard label="已停用" value={stats.inactive} color="destructive" />
      </StatGrid>

      {/* 工具栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Input
          placeholder="搜索姓名、用户名或邮箱..."
          prefix={<UserOutlined style={{ color: "var(--muted-foreground)" }} />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="全部状态"
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
        <div style={{ flex: 1 }} />
      </div>

      {/* 内容区：表格 + 详情面板 */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* 表格 */}
        <div style={{ flex: 1, minWidth: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <Table
            rowKey="id"
            dataSource={users}
            columns={columns}
            loading={loading}
            onRow={(record) => ({
              onClick: () => setSelectedUser(record),
              style: {
                cursor: "pointer",
                background: selectedUser?.id === record.id ? "var(--muted)" : undefined,
              },
            })}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            scroll={{ x: 'max-content' }}
          />
        </div>

        {/* 右侧详情面板 */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          {selectedUser ? (
            <div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: avatarColor(selectedUser.realName || selectedUser.username),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  {(selectedUser.realName || selectedUser.username).charAt(0)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedUser.realName || selectedUser.username}</div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                  @{selectedUser.username}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                    邮箱
                  </span>
                  <span style={{ fontSize: 13, color: "var(--foreground)" }}>{selectedUser.email || "—"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                    部门
                  </span>
                  <span style={{ fontSize: 13, color: "var(--foreground)" }}>{selectedUser.department || "—"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                    角色
                  </span>
                  <Space size={4} wrap style={{ marginTop: 2 }}>
                    {selectedUser.roleCodes?.length ? (
                      selectedUser.roleCodes.map((c) => (
                        <Tag key={c} color={c.startsWith("PLATFORM_SUPER") ? "red" : c.includes("ADMIN") ? "blue" : "default"} style={{ margin: 0 }}>
                          {c}
                        </Tag>
                      ))
                    ) : (
                      <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>未分配</span>
                    )}
                  </Space>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                    状态
                  </span>
                  <Tag color={STATUS_COLOR[selectedUser.status]} style={{ margin: 0, width: "fit-content" }}>
                    {STATUS_LABEL[selectedUser.status]}
                  </Tag>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                    最后登录
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {selectedUser.lastLoginAt ? formatDateTime(selectedUser.lastLoginAt, settings) : "从未登录"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                gap: 8,
                color: "var(--muted-foreground)",
                fontSize: 13,
              }}
            >
              <UserOutlined style={{ fontSize: 32, color: "var(--border)" }} />
              <span>从左侧选择用户查看详情</span>
            </div>
          )}
        </div>
      </div>

      {/* 重置密码结果弹窗 */}
      <Modal
        open={!!resetResult}
        title="密码已重置"
        onCancel={() => setResetResult(null)}
        footer={[
          <Button key="copy" onClick={() => {
            if (resetResult) {
              navigator.clipboard.writeText(resetResult.password);
              message.success("密码已复制到剪贴板");
            }
          }}>
            复制密码
          </Button>,
          <Button key="close" type="primary" onClick={() => setResetResult(null)}>
            关闭
          </Button>,
        ]}
      >
        {resetResult && (
          <div>
            <p>用户 <b>{resetResult.username}</b> 的新密码：</p>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                padding: 12,
                background: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--foreground)",
              }}
            >
              {resetResult.password}
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
              请将新密码告知用户，并建议首次登录后立即修改。
            </p>
          </div>
        )}
      </Modal>

      {/* 新建用户弹窗 */}
      <Modal
        open={createOpen}
        title="新建用户"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: "email", message: "邮箱格式不正确" }]}>
            <Input prefix={<MailOutlined />} placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              placeholder="选择角色"
              options={(roles ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户弹窗 */}
      <Modal
        open={editOpen}
        title={`编辑用户：${editTarget?.realName || editTarget?.username}`}
        onCancel={() => setEditOpen(false)}
        onOk={handleUpdate}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {editTarget && (
          <Form form={editForm} layout="vertical">
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="用户名">
                <span style={{ fontFamily: "var(--font-mono)" }}>@{editTarget.username}</span>
              </Descriptions.Item>
              <Descriptions.Item label="ID">{editTarget.id}</Descriptions.Item>
            </Descriptions>
            <Form.Item name="realName" label="姓名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{ type: "email" }]}>
              <Input prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item name="phone" label="手机号">
              <Input />
            </Form.Item>
            <Form.Item name="department" label="部门">
              <Input />
            </Form.Item>
            <Form.Item name="roleIds" label="角色">
              <Select
                mode="multiple"
                options={roles.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
              />
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
          </Form>
        )}
      </Modal>
    </AdminLayout>
  );
}
