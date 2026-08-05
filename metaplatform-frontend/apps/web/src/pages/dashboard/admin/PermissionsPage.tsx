import { Fragment, useEffect, useMemo, useState } from "react";
import { Tabs } from "@/components/Tabs";
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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { CatalogEditor } from "./CatalogEditor";
import {
  assignPermissions,
  createRole,
  deleteRole,
  getPermissionMatrix,
  getRoleDetail,
  listPermissionCatalog,
  listRoles,
  updateRole,
} from "@/api/admin/permissions";
import type {
  AdminPermission,
  AdminRole,
  AdminRoleDetail,
  PermissionMatrixResponse,
} from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";
import { formatDateTime } from "@/utils/datetime";
import { useSettings } from "@/contexts/SettingsContext";

const DATA_SCOPE_LABEL: Record<string, string> = {
  ALL: "全部数据",
  DEPT: "本部门",
  DEPT_AND_SUB: "本部门及子部门",
  SELF: "仅本人",
  CUSTOM: "自定义",
};

export default function PermissionsPage() {
  const { settings } = useSettings();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [catalog, setCatalog] = useState<AdminPermission[]>([]);
  const [matrix, setMatrix] = useState<PermissionMatrixResponse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminRole | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detail, setDetail] = useState<AdminRoleDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  const loadRoles = async () => {
    setLoading(true);
    try {
      const r = await listRoles({ keyword: keyword || undefined, page, pageSize });
      setRoles(r.items ?? []);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      setCatalog(await listPermissionCatalog());
    } catch {
      /* ignore */
    }
  };

  const loadMatrix = async () => {
    try {
      setMatrix(await getPermissionMatrix());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadRoles();
    loadCatalog();
    loadMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleCreate = async () => {
    const v = await createForm.validateFields();
    try {
      await createRole(v);
      message.success("角色已创建");
      setCreateOpen(false);
      createForm.resetFields();
      loadRoles();
      loadMatrix();
    } catch {
      /* ignore */
    }
  };

  const openEdit = async (r: AdminRole) => {
    setEditTarget(r);
    try {
      const detailRes = await getRoleDetail(r.id);
      setEditTarget({ ...r, ...detailRes });
      editForm.setFieldsValue({
        name: r.name,
        description: r.description ?? "",
        dataScope: r.dataScope,
        permissionIds: detailRes.permissions.map((p) => p.id),
      });
    } catch {
      editForm.setFieldsValue({
        name: r.name,
        description: r.description ?? "",
        dataScope: r.dataScope,
      });
    }
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const v = await editForm.validateFields();
    try {
      await updateRole(editTarget.id, v);
      message.success("已更新");
      setEditOpen(false);
      loadRoles();
      loadMatrix();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (r: AdminRole) => {
    try {
      await deleteRole(r.id);
      message.success(`已删除 ${r.name}`);
      loadRoles();
      loadMatrix();
    } catch {
      /* ignore */
    }
  };

  const openDetail = async (r: AdminRole) => {
    try {
      const d = await getRoleDetail(r.id);
      setDetail(d);
      setDetailOpen(true);
    } catch {
      /* ignore */
    }
  };

  const toggleMatrixCell = async (roleId: number, permissionId: number, granted: boolean) => {
    try {
      // Collect all currently granted permissionIds for this role from the matrix
      const currentGranted: number[] = [];
      if (matrix) {
        const raw = matrix as unknown as { matrix?: Array<{ role_id: number; permission_id: number; granted: boolean }> };
        for (const cell of raw.matrix ?? []) {
          if (cell.role_id === roleId && cell.granted) {
            currentGranted.push(cell.permission_id);
          }
        }
      }
      // Toggle: if currently granted, remove; otherwise add
      const next = granted
        ? currentGranted.filter((id) => id !== permissionId)
        : [...currentGranted, permissionId];
      await assignPermissions({ type: "role", targetId: roleId, permissionIds: next });
      loadMatrix();
      loadRoles();
    } catch {
      /* ignore */
    }
  };

  const columns: ColumnsType<AdminRole> = useMemo(
    () => [
      {
        title: "编码",
        dataIndex: "code",
        render: (v: string) => (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>
        ),
      },
      {
        title: "名称",
        dataIndex: "name",
        render: (v: string, r) => (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <a onClick={() => openDetail(r)}>{v}</a>
            {r.isBuiltin ? <Tag color="purple">内置</Tag> : null}
          </span>
        ),
      },
      {
        title: "数据范围",
        dataIndex: "dataScope",
        render: (v: string) => <Tag>{DATA_SCOPE_LABEL[v] ?? v}</Tag>,
      },
      {
        title: "权限数",
        dataIndex: "permissionCount",
        render: (v: number) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: "用户数",
        dataIndex: "userCount",
        render: (v: number) => <Tag>{v}</Tag>,
      },
      {
        title: "更新时间",
        dataIndex: "updatedAt",
        render: (v: string) => (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {formatDateTime(v, settings)}
          </span>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: 220,
        render: (_v, r) => (
          <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
              查看
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
              编辑
            </Button>
            {!r.isBuiltin ? (
              <Popconfirm
                title={"确认删除 " + r.name + "？"}
                description="该角色下的用户绑定关系也会一并解除"
                onConfirm={() => handleDelete(r)}
                okType="danger"
                okText="删除"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<DeleteOutlined />} danger>
                  删除
                </Button>
              </Popconfirm>
            ) : (
              <Button type="link" size="small" disabled>
                删除
              </Button>
            )}
          </span>
        ),
      },
    ],
    [settings],
  );

  // Matrix lookup
  const matrixMap = useMemo(() => {
    const m = new Map<string, boolean>();
    const raw = matrix as unknown as { matrix?: Array<{ role_id: number; permission_id: number; granted: boolean }> };
    if (!matrix || !Array.isArray(raw.matrix)) return m;
    for (const cell of raw.matrix!) {
      m.set(cell.role_id + ":" + cell.permission_id, cell.granted);
    }
    return m;
  }, [matrix]);

  const builtinCount = (roles ?? []).filter((r) => r.isBuiltin).length;
  const customCount = roles.length - builtinCount;
  const permissionTotalCount = useMemo(
    () => (catalog.length ? catalog.length : roles.reduce((sum, r) => sum + (r.permissionCount ?? 0), 0)),
    [catalog, roles],
  );

  return (
    <Fragment key="root">
    <AdminLayout
      title="权限管理"
      extra={
        <span style={{ display: "inline-flex", gap: 8 }} key="extra-btns">
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => {
            loadRoles(); loadCatalog(); loadMatrix();
          }}>
            刷新
          </Button>
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建角色
          </Button>
        </span>
      }
    >
      <StatGrid key="stat">
        <StatCard key="t-roles" label="角色总数" value={total} />
        <StatCard key="t-perms" label="权限总数" value={permissionTotalCount} />
        <StatCard key="t-builtin" label="超级管理员" value={builtinCount} color="warning" />
        <StatCard key="t-custom" label="自定义角色" value={customCount} color="success" />
      </StatGrid>
      <Tabs
        defaultActiveKey="roles"
        items={[
          {
            key: "roles",
            label: "角色",
            children: (
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: 8 }}>
                  <Input.Search
                    placeholder="搜索角色编码 / 名称"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onSearch={() => {
                      setPage(1);
                      loadRoles();
                    }}
                    style={{ maxWidth: 280 }}
                    allowClear
                  />
                </div>
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={roles}
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
            ),
          },
          {
            key: "catalog",
            label: "权限目录",
            children: (
              <CatalogEditor
                catalog={catalog}
                roles={roles}
                onSave={async (roleId, permissionIds) => {
                  try {
                    await assignPermissions({ type: "role", targetId: roleId, permissionIds });
                    message.success("权限已保存");
                    loadRoles();
                    loadMatrix();
                  } catch {
                    /* ignore */
                  }
                }}
                onRefresh={loadCatalog}
              />
            ),
          },
          {
            key: "matrix",
            label: "权限矩阵",
            children: (
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 16,
                  overflowX: "auto",
                }}
              >
                {!matrix ? (
                  <div style={{ color: "var(--muted-foreground)" }}>加载中…</div>
                ) : (
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th
                          key="__role_col"
                          style={{
                            padding: 8,
                            border: "1px solid var(--border)",
                            position: "sticky",
                            left: 0,
                            background: "var(--card)",
                            textAlign: "left",
                          }}
                        >
                          角色 / 权限
                        </th>
                        {(matrix.permissions ?? []).map((p) => (
                          <th
                            key={p.id}
                            style={{
                              padding: 8,
                              border: "1px solid var(--border)",
                              fontSize: 11,
                              textAlign: "center",
                              minWidth: 100,
                            }}
                            title={p.name}
                          >
                            {p.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(matrix.roles ?? []).map((r) => (
                        <tr key={r.id}>
                          <td
                            key={`${r.id}-name`}
                            style={{
                              padding: 8,
                              border: "1px solid var(--border)",
                              position: "sticky",
                              left: 0,
                              background: "var(--card)",
                              fontWeight: 500,
                            }}
                          >
                            {r.name}
                            {r.isBuiltin && (
                              <Tag color="purple" style={{ marginLeft: 6 }}>
                                内置
                              </Tag>
                            )}
                          </td>
                          {(matrix.permissions ?? []).map((p) => {
                            const granted = matrixMap.get(r.id + ":" + p.id) === true;
                            return (
                              <td
                                key={p.id}
                                style={{
                                  padding: 8,
                                  border: "1px solid var(--border)",
                                  textAlign: "center",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={granted}
                                  disabled={r.isBuiltin}
                                  onChange={() => toggleMatrixCell(r.id, p.id, granted)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="新建角色"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, min: 2, max: 64 }]}>
            <Input placeholder="建议大写字母+下划线" />
          </Form.Item>
          <Form.Item name="name" label="显示名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item name="dataScope" label="数据范围" initialValue="SELF">
            <Select
              options={[
                { value: "ALL", label: DATA_SCOPE_LABEL.ALL },
                { value: "DEPT", label: DATA_SCOPE_LABEL.DEPT },
                { value: "DEPT_AND_SUB", label: DATA_SCOPE_LABEL.DEPT_AND_SUB },
                { value: "SELF", label: DATA_SCOPE_LABEL.SELF },
                { value: "CUSTOM", label: DATA_SCOPE_LABEL.CUSTOM },
              ]}
            />
          </Form.Item>
          <Form.Item name="permissionIds" label="权限">
            <Select
              mode="multiple"
              options={Array.isArray(catalog) ? catalog.map((p) => ({ value: p.id, label: p.code + " - " + p.name })) : []}
              placeholder="选择权限"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editTarget ? "编辑 " + editTarget.name : "编辑"}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="显示名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
          <Form.Item name="dataScope" label="数据范围">
            <Select
              options={[
                { value: "ALL", label: DATA_SCOPE_LABEL.ALL },
                { value: "DEPT", label: DATA_SCOPE_LABEL.DEPT },
                { value: "DEPT_AND_SUB", label: DATA_SCOPE_LABEL.DEPT_AND_SUB },
                { value: "SELF", label: DATA_SCOPE_LABEL.SELF },
                { value: "CUSTOM", label: DATA_SCOPE_LABEL.CUSTOM },
              ]}
            />
          </Form.Item>
          <Form.Item name="permissionIds" label="权限">
            <Select
              mode="multiple"
              options={Array.isArray(catalog) ? catalog.map((p) => ({ value: p.id, label: p.code + " - " + p.name })) : []}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        key="drawer-detail"
        title={detail ? "角色详情：" + detail.name : ""}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size={520}
      >
        {detail && (
          <Descriptions
            column={1}
            bordered
            size="small"
            items={[
              { key: "code", label: "编码", children: detail.code },
              { key: "name", label: "名称", children: detail.name },
              { key: "desc", label: "描述", children: detail.description || "—" },
              {
                key: "scope",
                label: "数据范围",
                children: <Tag>{DATA_SCOPE_LABEL[detail.dataScope] ?? detail.dataScope}</Tag>,
              },
              { key: "builtin", label: "内置", children: detail.isBuiltin ? "是" : "否" },
              {
                key: "perms",
                label: "权限（" + detail.permissions.length + "）",
                children: (
                  <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                    {detail.permissions.length === 0
                      ? "—"
                      : detail.permissions.map((p) => (
                          <Tag key={p.id} color="blue">
                            {p.code}
                          </Tag>
                        ))}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </AdminLayout>
    </Fragment>
  );
}
