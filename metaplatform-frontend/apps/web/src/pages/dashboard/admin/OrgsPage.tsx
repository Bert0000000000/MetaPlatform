import { useEffect, useMemo, useState, type Key as AntKey } from "react";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tree,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  createOrg,
  createPosition,
  deleteOrg,
  deletePosition,
  getOrgTree,
  listPositions,
  transferEmployee,
  updateOrg,
  updatePosition,
} from "@/api/admin/orgs";
import type {
  AdminOrg,
  AdminOrgTreeNode,
  AdminPosition,
  OrgType,
} from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";

interface OrgTreeDataNode {
  key: string;
  title: string;
  type: OrgType;
  memberCount: number;
  children?: OrgTreeDataNode[];
  raw: AdminOrgTreeNode;
}

function toTreeData(nodes: AdminOrgTreeNode[] | undefined): OrgTreeDataNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => {
    // 后端 Pydantic 默认 snake_case，回退兼容
    const raw = n as unknown as {
      member_count?: number;
      leader_name?: string | null;
      sort_order?: number;
    };
    return {
      key: String(n.id),
      title: n.name,
      type: n.type,
      memberCount: n.memberCount ?? raw.member_count ?? 0,
      children: Array.isArray(n.children) && n.children.length > 0 ? toTreeData(n.children) : undefined,
      raw: n,
    };
  });
}

export default function OrgsPage() {
  const [tree, setTree] = useState<AdminOrgTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminOrg | null>(null);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [orgModal, setOrgModal] = useState<{ mode: "create" | "edit"; parentId?: number | null } | null>(null);
  const [positionModal, setPositionModal] = useState<{ mode: "create" | "edit"; orgId?: number; positionId?: number } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [orgForm] = Form.useForm();
  const [positionForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [tab, setTab] = useState<"positions" | "members">("positions");

  const loadTree = async () => {
    setLoading(true);
    try {
      const t = await getOrgTree();
      setTree(t ?? []);
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async (orgId: number) => {
    try {
      const r = await listPositions({ orgId, pageSize: 100 });
      setPositions(r.items ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  useEffect(() => {
    if (selected) {
      loadPositions(selected.id);
    } else {
      setPositions([]);
    }
  }, [selected]);

  const onSelect = (keys: AntKey | AntKey[]) => {
    if (!keys || (Array.isArray(keys) ? !keys.length : false)) return;
    const k = Array.isArray(keys) ? keys[0] : keys;
    // find node by id
    function find(nodes: AdminOrgTreeNode[]): AdminOrg | null {
      for (const n of nodes) {
        if (String(n.id) === String(k)) {
          const raw = n as unknown as {
            parent_id?: number | null;
            leader_id?: number | null;
            leader_name?: string | null;
            sort_order?: number;
            member_count?: number;
            position_count?: number;
            created_at?: string;
            updated_at?: string;
          };
          return {
            id: n.id,
            parentId: n.parentId ?? raw.parent_id ?? null,
            code: n.code,
            name: n.name,
            type: n.type,
            leaderId: n.leaderId ?? raw.leader_id ?? null,
            leaderName: n.leaderName ?? raw.leader_name ?? null,
            sortOrder: n.sortOrder ?? raw.sort_order ?? 0,
            description: n.description,
            memberCount: n.memberCount ?? raw.member_count ?? 0,
            positionCount: n.positionCount ?? raw.position_count ?? 0,
            createdAt: n.createdAt ?? raw.created_at ?? "",
            updatedAt: n.updatedAt ?? raw.updated_at ?? "",
          };
        }
        if (n.children?.length) {
          const c = find(n.children);
          if (c) return c;
        }
      }
      return null;
    }
    setSelected(find(tree));
    setTab("positions");
  };

  const openCreateOrg = (parentId?: number | null) => {
    orgForm.resetFields();
    if (parentId !== undefined) {
      orgForm.setFieldValue("parentId", parentId);
    }
    setOrgModal({ mode: "create", parentId });
  };

  const openEditOrg = () => {
    if (!selected) return;
    orgForm.setFieldsValue({
      parentId: selected.parentId ?? undefined,
      code: selected.code,
      name: selected.name,
      type: selected.type,
      sortOrder: selected.sortOrder,
      description: selected.description ?? "",
    });
    setOrgModal({ mode: "edit" });
  };

  const submitOrg = async () => {
    const v = await orgForm.validateFields();
    if (!orgModal) return;
    try {
      if (orgModal.mode === "create") {
        await createOrg(v);
        message.success("组织已创建");
      } else if (selected) {
        await updateOrg(selected.id, v);
        message.success("已更新");
      }
      setOrgModal(null);
      loadTree();
    } catch {
      /* ignore */
    }
  };

  const removeOrg = async () => {
    if (!selected) return;
    try {
      await deleteOrg(selected.id);
      message.success("已删除");
      setSelected(null);
      loadTree();
    } catch {
      /* ignore */
    }
  };

  const openCreatePosition = () => {
    positionForm.resetFields();
    if (selected) positionForm.setFieldValue("orgId", selected.id);
    setPositionModal({ mode: "create", orgId: selected?.id });
  };

  const openEditPosition = (p: AdminPosition) => {
    positionForm.setFieldsValue({
      orgId: p.orgId,
      code: p.code,
      name: p.name,
      level: p.level ?? "",
      description: p.description ?? "",
    });
    setPositionModal({ mode: "edit", orgId: p.orgId, positionId: p.id });
  };

  const submitPosition = async () => {
    const v = await positionForm.validateFields();
    if (!positionModal) return;
    try {
      if (positionModal.mode === "create") {
        await createPosition(v);
        message.success("岗位已创建");
      } else if (positionModal.positionId) {
        await updatePosition(positionModal.positionId, v);
        message.success("已更新");
      }
      setPositionModal(null);
      if (selected) loadPositions(selected.id);
    } catch {
      /* ignore */
    }
  };

  const removePosition = async (id: number) => {
    try {
      await deletePosition(id);
      message.success("已删除");
      if (selected) loadPositions(selected.id);
    } catch {
      /* ignore */
    }
  };

  const submitTransfer = async () => {
    const v = await transferForm.validateFields();
    try {
      await transferEmployee(v);
      message.success("调岗成功");
      setTransferOpen(false);
      transferForm.resetFields();
      loadTree();
    } catch {
      /* ignore */
    }
  };

  const treeData = useMemo(() => toTreeData(tree), [tree]);

  const orgStats = useMemo(() => {
    function walk(nodes: AdminOrgTreeNode[], acc: { total: number; deptCount: number; rootCount: number; memberTotal: number }) {
      for (const n of nodes) {
        const raw = n as unknown as { member_count?: number; parent_id?: number | null };
        const memberCount = n.memberCount ?? raw.member_count ?? 0;
        const parentId = n.parentId ?? raw.parent_id ?? null;
        acc.total += 1;
        acc.memberTotal += memberCount;
        if (n.type === "DEPARTMENT") acc.deptCount += 1;
        if (parentId == null) acc.rootCount += 1;
        if (n.children?.length) walk(n.children, acc);
      }
    }
    const acc = { total: 0, deptCount: 0, rootCount: 0, memberTotal: 0 };
    walk(tree, acc);
    return acc;
  }, [tree]);

  const positionColumns: ColumnsType<AdminPosition> = [
    { title: "编码", dataIndex: "code" },
    { title: "名称", dataIndex: "name" },
    {
      title: "级别",
      dataIndex: "level",
      render: (v?: string) => (v ? <Tag>{v}</Tag> : "—"),
    },
    { title: "描述", dataIndex: "description", render: (v?: string) => v ?? "—" },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_v, r) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditPosition(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => removePosition(r.id)} okText="删除" okType="danger" cancelText="取消">
            <Button type="link" size="small" icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout
      title="组织管理"
      extra={
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => openCreateOrg(undefined)}>
            新建组织
          </Button>
          <Button icon={<SwapOutlined />} onClick={() => setTransferOpen(true)}>
            人员调岗
          </Button>
        </Space>
      }
    >
      <StatGrid>
        <StatCard label="组织总数" value={orgStats.total} />
        <StatCard label="部门数" value={orgStats.deptCount} />
        <StatCard label="在职人数" value={orgStats.memberTotal} color="success" />
        <StatCard label="根组织数" value={orgStats.rootCount} color="warning" />
      </StatGrid>
      <div style={{ display: "flex", gap: 16, height: "100%" }}>
        <div
          style={{
            width: 320,
            flexShrink: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            overflow: "auto",
          }}
        >
          {treeData.length === 0 ? (
            <div style={{ color: "var(--muted-foreground)" }}>
              {loading ? "加载中…" : "暂无组织"}
            </div>
          ) : (
            <Tree
              treeData={Array.isArray(treeData) ? treeData : []}
              fieldNames={{ title: "title", key: "key", children: "children" }}
              defaultExpandAll
              onSelect={onSelect}
              showLine
              titleRender={(n) => (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ApartmentOutlined />
                  <span>{n.title}</span>
                  <Tag style={{ marginLeft: "auto" }}>{n.memberCount} 人</Tag>
                </span>
              )}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            minWidth: 0,
            overflow: "auto",
          }}
        >
          {selected ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {selected.name} <Tag>{selected.type}</Tag>
                  </h3>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 4 }}>
                    编码 {selected.code} · {selected.memberCount} 名成员 · {selected.positionCount} 个岗位
                  </div>
                </div>
                <Space>
                  <Button onClick={openEditOrg} icon={<EditOutlined />}>
                    编辑
                  </Button>
                  <Popconfirm title={"确认删除 " + selected.name + "？"} description="子组织将无法保留" onConfirm={removeOrg} okType="danger" okText="删除" cancelText="取消">
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePosition}>
                    新建岗位
                  </Button>
                </Space>
              </div>

              <Tabs
                activeKey={tab}
                onChange={(v) => setTab(v as "positions" | "members")}
                items={[
                  {
                    key: "positions",
                    label: "岗位",
                    children: (
                      <Table
                        rowKey="id"
                        size="small"
                        columns={positionColumns}
                        dataSource={positions}
                        pagination={false}
                        locale={{ emptyText: "暂无岗位" }}
                      />
                    ),
                  },
                  {
                    key: "members",
                    label: "成员",
                    children: (
                      <div style={{ color: "var(--muted-foreground)" }}>
                        成员列表（该组织下的 {selected.memberCount} 人）。调岗请使用顶部「人员调岗」按钮。
                      </div>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <div style={{ color: "var(--muted-foreground)", textAlign: "center", paddingTop: 60 }}>
              请在左侧选择组织，或点击「新建组织」创建。
            </div>
          )}
        </div>
      </div>

      <Modal
        title={orgModal?.mode === "edit" ? "编辑组织" : "新建组织"}
        open={!!orgModal}
        onCancel={() => setOrgModal(null)}
        onOk={submitOrg}
        okText="保存"
        cancelText="取消"
      >
        <Form form={orgForm} layout="vertical" preserve={false}>
          <Form.Item name="parentId" label="父组织">
            <Select
              allowClear
              placeholder="无（顶级组织）"
              options={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []}
              disabled={orgModal?.mode === "edit"}
            />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true, min: 1, max: 64 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="DEPARTMENT">
            <Select
              options={[
                { value: "COMPANY", label: "公司" },
                { value: "DEPARTMENT", label: "部门" },
                { value: "TEAM", label: "团队" },
                { value: "VIRTUAL", label: "虚拟组织" },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={positionModal?.mode === "edit" ? "编辑岗位" : "新建岗位"}
        open={!!positionModal}
        onCancel={() => setPositionModal(null)}
        onOk={submitPosition}
        okText="保存"
        cancelText="取消"
      >
        <Form form={positionForm} layout="vertical" preserve={false}>
          <Form.Item name="orgId" label="所属组织" rules={[{ required: true }]}>
            <Select
              options={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []}
              disabled={positionModal?.mode === "edit"}
            />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Input placeholder="如 P6 / M2" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="人员调岗"
        open={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={submitTransfer}
        okText="调岗"
        cancelText="取消"
      >
        <Form form={transferForm} layout="vertical" preserve={false}>
          <Form.Item name="userId" label="用户 ID" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="targetOrgId" label="目标组织" rules={[{ required: true }]}>
            <Select options={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="targetPositionId" label="目标岗位（留空自动取第一岗）">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reportsTo" label="汇报对象 user ID">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reason" label="调岗原因">
            <Input.TextArea autoSize={{ minRows: 2 }} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
