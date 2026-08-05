/**
 * 权限目录编辑器
 * - 表格形式按资源类型分组展示
 * - 顶部全选 / 全不选 / 反选 / 搜索
 * - 顶部"应用到角色"下拉 + 保存按钮
 * - 行内编辑 / 删除 / 新建
 * - 选中角色时预填其现有权限
 * - 内置角色 isBuiltin，禁止勾选
 */
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckSquareOutlined,
  CloseSquareOutlined,
  SwapOutlined,
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { AdminPermission, AdminRole } from "@/types";
import {
  getRoleDetail,
  createPermission,
  updatePermission,
  deletePermission,
} from "@/api/admin/permissions";

interface Props {
  catalog: AdminPermission[];
  roles: AdminRole[];
  onSave: (roleId: number, permissionIds: number[]) => Promise<void>;
  onRefresh: () => void;
}

function getResourceType(p: AdminPermission): string {
  return (
    (p as unknown as { resource_type?: string }).resource_type ?? p.resourceType ?? "其他"
  );
}

interface PermissionForm {
  id?: number;
  code: string;
  name: string;
  resource_type: string;
  actions: string[]; // 改为 array 形式，保存时再 join
  description?: string;
}

export function CatalogEditor({ catalog, roles, onSave, onRefresh }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initial, setInitial] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string | undefined>(undefined);
  const [loadingRole, setLoadingRole] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionForm | null>(null);
  const [form] = Form.useForm<PermissionForm>();

  const [deleting, setDeleting] = useState<AdminPermission | null>(null);

  // 资源类型列表
  const resourceTypes = useMemo(() => {
    const s = new Set<string>();
    for (const p of catalog) s.add(getResourceType(p));
    return Array.from(s).sort();
  }, [catalog]);

  // 过滤后的权限
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return catalog.filter((p) => {
      if (resourceTypeFilter && getResourceType(p) !== resourceTypeFilter) return false;
      if (!kw) return true;
      return (
        p.code.toLowerCase().includes(kw) ||
        p.name.toLowerCase().includes(kw) ||
        getResourceType(p).toLowerCase().includes(kw)
      );
    });
  }, [catalog, keyword, resourceTypeFilter]);

  // 当前选中角色
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  // 选中角色时，加载其权限并预填
  useEffect(() => {
    if (selectedRoleId == null) {
      setSelected(new Set());
      setInitial(new Set());
      return;
    }
    let cancelled = false;
    setLoadingRole(true);
    getRoleDetail(selectedRoleId)
      .then((detail) => {
        if (cancelled) return;
        const ids = new Set(detail.permissions.map((p) => p.id));
        setSelected(ids);
        setInitial(ids);
      })
      .catch(() => {
        if (!cancelled) message.error("加载角色权限失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingRole(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearAll = () => setSelected(new Set());
  const invert = () => {
    setSelected((prev) => {
      const next = new Set<number>();
      for (const p of filtered) {
        if (!prev.has(p.id)) next.add(p.id);
      }
      return next;
    });
  };

  const reset = () => setSelected(new Set(initial));

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const id of selected) {
      if (!initial.has(id)) return true;
    }
    return false;
  }, [selected, initial]);

  const builtin = selectedRole?.isBuiltin ?? false;

  const handleSave = async () => {
    if (selectedRoleId == null) {
      message.warning("请先选择目标角色");
      return;
    }
    if (builtin) {
      message.warning("内置角色不可修改权限");
      return;
    }
    setSaving(true);
    try {
      await onSave(selectedRoleId, Array.from(selected));
      setInitial(new Set(selected));
    } finally {
      setSaving(false);
    }
  };

  // --- CRUD: 新建 ---
  const openCreate = () => {
    setEditing({ code: "", name: "", resource_type: resourceTypeFilter ?? "", actions: [] });
    form.resetFields();
    form.setFieldsValue({ code: "", name: "", resource_type: resourceTypeFilter ?? "", actions: [] });
    setFormOpen(true);
  };

  // --- CRUD: 编辑 ---
  const openEdit = (p: AdminPermission) => {
    const actionsStr = (p.actions ?? []).join(",");
    const arr = actionsStr
      ? actionsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const formData: PermissionForm = {
      id: p.id,
      code: p.code,
      name: p.name,
      resource_type: getResourceType(p),
      actions: arr,
      description: (p.description ?? "") as string,
    };
    setEditing(formData);
    form.setFieldsValue(formData);
    setFormOpen(true);
  };

  // --- CRUD: 保存 ---
  const handleFormOk = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        resource_type: values.resource_type.trim(),
        actions: (values.actions ?? []).join(","),
        description: values.description ?? "",
      };
      if (editing?.id) {
        await updatePermission(editing.id, payload);
        message.success("权限已更新");
      } else {
        await createPermission(payload);
        message.success("权限已创建");
      }
      setFormOpen(false);
      setEditing(null);
      onRefresh();
    } catch (err) {
      // 校验失败 / 接口错误已由各自拦截器处理
      void err;
    }
  };

  // --- CRUD: 删除 ---
  const handleDelete = async (p: AdminPermission) => {
    try {
      await deletePermission(p.id);
      message.success("权限已删除");
      onRefresh();
    } catch {
      /* ignore */
    }
  };

  const columns: ColumnsType<AdminPermission> = [
    {
      title: "",
      key: "select",
      width: 48,
      fixed: "left",
      render: (_v, p) => (
        <Checkbox
          checked={selected.has(p.id)}
          onChange={() => toggle(p.id)}
          disabled={builtin}
          aria-label={`选择 ${p.code}`}
        />
      ),
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      width: 220,
      render: (v: string) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>
      ),
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 180,
    },
    {
      title: "资源类型",
      key: "resource_type",
      width: 140,
      render: (_v, p) => <Tag color="blue">{getResourceType(p)}</Tag>,
      filters: resourceTypes.map((rt) => ({ text: rt, value: rt })),
      onFilter: (value, record) => getResourceType(record) === value,
    },
    {
      title: "动作",
      dataIndex: "actions",
      key: "actions",
      width: 280,
      render: (actions: string[]) => (
        <Space size={2} wrap>
          {(actions ?? []).map((a) => (
            <Tag key={a} style={{ fontSize: 10, margin: 0 }}>
              {a}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (v) => (v ? v : <span style={{ color: "var(--muted-foreground)" }}>—</span>),
    },
    {
      title: "操作",
      key: "actions-op",
      width: 140,
      fixed: "right",
      render: (_v, p) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(p)}
          >
            编辑
          </Button>
          <Popconfirm
            title={"删除权限 " + p.code + "？"}
            description="此操作不可撤销"
            okType="danger"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(p)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = builtin
    ? undefined
    : {
        selectedRowKeys: Array.from(selected),
        onChange: (keys: React.Key[]) => {
          setSelected(new Set(keys.map((k) => Number(k))));
        },
      };

  const totalCount = catalog.length;
  const selectedCount = selected.size;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Select
          placeholder="选择目标角色"
          value={selectedRoleId ?? undefined}
          onChange={(v) => setSelectedRoleId(v ?? null)}
          style={{ minWidth: 240 }}
          allowClear
          options={roles.map((r) => ({
            value: r.id,
            label: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {r.name}
                {r.isBuiltin && (
                  <Tag color="purple" style={{ marginLeft: 0, marginRight: 0, fontSize: 10 }}>
                    内置
                  </Tag>
                )}
              </span>
            ),
          }))}
        />
        <Select
          placeholder="资源类型"
          allowClear
          value={resourceTypeFilter}
          onChange={(v) => setResourceTypeFilter(v)}
          style={{ minWidth: 160 }}
          options={resourceTypes.map((rt) => ({ value: rt, label: rt }))}
        />
        <Input.Search
          placeholder="搜索 code / 名称 / 资源类型"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
          已选 {selectedCount} / {totalCount}
        </span>
        <div style={{ flex: 1 }} />
        <Tooltip title="全选（当前筛选范围）">
          <Button icon={<CheckSquareOutlined />} onClick={selectAll} size="small">
            全选
          </Button>
        </Tooltip>
        <Tooltip title="全不选">
          <Button icon={<CloseSquareOutlined />} onClick={clearAll} size="small">
            全不选
          </Button>
        </Tooltip>
        <Tooltip title="反选">
          <Button icon={<SwapOutlined />} onClick={invert} size="small">
            反选
          </Button>
        </Tooltip>
        <Tooltip title="还原初始状态">
          <Button icon={<ReloadOutlined />} onClick={reset} size="small" disabled={!dirty}>
            还原
          </Button>
        </Tooltip>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          disabled={selectedRoleId == null || builtin || !dirty}
          title={
            builtin
              ? "内置角色不可修改"
              : selectedRoleId == null
              ? "请先选择角色"
              : !dirty
              ? "无修改"
              : ""
          }
        >
          保存到当前角色
        </Button>
        <Button icon={<PlusOutlined />} type="dashed" onClick={openCreate}>
          新建权限
        </Button>
      </div>

      {/* 表格区 */}
      {loadingRole ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <Spin />
        </div>
      ) : filtered.length === 0 ? (
        <Empty description={keyword || resourceTypeFilter ? "无匹配权限" : "暂无权限数据"} />
      ) : (
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          rowSelection={rowSelection}
          scroll={{ x: 1100 }}
          bordered
        />
      )}

      {/* 新建 / 编辑 Modal */}
      <Modal
        title={editing?.id ? "编辑权限" : "新建权限"}
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onOk={handleFormOk}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="code"
            label="权限编码"
            rules={[
              { required: true, message: "请输入权限编码" },
              { pattern: /^[a-z_]+:[a-z_]+$/, message: "格式错误，应为 resource:action，如 user:create" },
            ]}
          >
            <Input placeholder="例如 user:create" disabled={!!editing?.id} />
          </Form.Item>
          <Form.Item
            name="name"
            label="显示名"
            rules={[{ required: true, message: "请输入显示名" }]}
          >
            <Input placeholder="例如 创建用户" />
          </Form.Item>
          <Form.Item
            name="resource_type"
            label="资源类型"
            rules={[{ required: true, message: "请输入资源类型" }]}
          >
            <Input placeholder="例如 user / role / org" />
          </Form.Item>
          <Form.Item name="actions" label="动作列表">
            <Select mode="tags" placeholder="如 create, read, update, delete" tokenSeparators={[","]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
