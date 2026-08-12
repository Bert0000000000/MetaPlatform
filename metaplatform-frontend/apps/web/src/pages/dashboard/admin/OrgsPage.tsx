import { useEffect, useMemo, useState } from "react";
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
  Toast,
} from "@douyinfe/semi-ui";
import type { ColumnProps } from "@douyinfe/semi-ui/lib/es/table";
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
import type { CreateOrgPayload, CreatePositionPayload, TransferPayload } from "@/api/admin/orgs";
import type {
  AdminOrg,
  AdminOrgTreeNode,
  AdminPosition,
  OrgType,
} from "@/types";
import { AdminLayout, StatCard, StatGrid } from "./__AdminLayout";

interface OrgTreeDataNode {
  key: string;
  label: string;
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
      label: n.name,
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
  const [orgForm] = Form.useForm<CreateOrgPayload>();
  const [positionForm] = Form.useForm<CreatePositionPayload>();
  const [transferForm] = Form.useForm<TransferPayload>();
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

  const onSelect = (selectedKey: string) => {
    if (!selectedKey) return;
    // find node by id
    function find(nodes: AdminOrgTreeNode[]): AdminOrg | null {
      for (const n of nodes) {
        if (String(n.id) === String(selectedKey)) {
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
    orgForm.reset();
    if (parentId !== undefined) {
      orgForm.setValue("parentId", parentId);
    }
    setOrgModal({ mode: "create", parentId });
  };

  const openEditOrg = () => {
    if (!selected) return;
    orgForm.setValues({
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
    const v = await orgForm.validate();
    if (!orgModal) return;
    try {
      if (orgModal.mode === "create") {
        await createOrg(v);
        Toast.success("组织已创建");
      } else if (selected) {
        await updateOrg(selected.id, v);
        Toast.success("已更新");
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
      Toast.success("已删除");
      setSelected(null);
      loadTree();
    } catch {
      /* ignore */
    }
  };

  const openCreatePosition = () => {
    positionForm.reset();
    if (selected) positionForm.setValue("orgId", selected.id);
    setPositionModal({ mode: "create", orgId: selected?.id });
  };

  const openEditPosition = (p: AdminPosition) => {
    positionForm.setValues({
      orgId: p.orgId,
      code: p.code,
      name: p.name,
      level: p.level ?? "",
      description: p.description ?? "",
    });
    setPositionModal({ mode: "edit", orgId: p.orgId, positionId: p.id });
  };

  const submitPosition = async () => {
    const v = await positionForm.validate();
    if (!positionModal) return;
    try {
      if (positionModal.mode === "create") {
        await createPosition(v);
        Toast.success("岗位已创建");
      } else if (positionModal.positionId) {
        await updatePosition(positionModal.positionId, v);
        Toast.success("已更新");
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
      Toast.success("已删除");
      if (selected) loadPositions(selected.id);
    } catch {
      /* ignore */
    }
  };

  const submitTransfer = async () => {
    const v = await transferForm.validate();
    try {
      await transferEmployee(v);
      Toast.success("调岗成功");
      setTransferOpen(false);
      transferForm.reset();
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

  const positionColumns: ColumnProps<AdminPosition>[] = [
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
        <Space spacing={4}>
          <Button theme="borderless" size="small" icon={<EditOutlined />} onClick={() => openEditPosition(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => removePosition(r.id)} okText="删除" okType="danger" cancelText="取消">
            <Button theme="borderless" size="small" icon={<DeleteOutlined />} type="danger">
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
              treeData={treeData}
              defaultExpandAll
              onSelect={onSelect}
              showLine
              renderLabel={(_label, treeNode) => {
                const node = treeNode as unknown as OrgTreeDataNode;
                return (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ApartmentOutlined />
                    <span>{node.label}</span>
                    <Tag style={{ marginLeft: "auto" }}>{node.memberCount} 人</Tag>
                  </span>
                );
              }}
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
                  <Popconfirm title={"确认删除 " + selected.name + "？"} content="子组织将无法保留" onConfirm={removeOrg} okType="danger" okText="删除" cancelText="取消">
                    <Button type="danger" icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                  <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreatePosition}>
                    新建岗位
                  </Button>
                </Space>
              </div>

              <Tabs
                activeKey={tab}
                onChange={(v) => setTab(v as "positions" | "members")}
              >
                <Tabs.TabPane itemKey="positions" tab="岗位">
                  <Table
                    rowKey="id"
                    size="small"
                    columns={positionColumns}
                    dataSource={positions}
                    pagination={false}
                    empty="暂无岗位"
                  />
                </Tabs.TabPane>
                <Tabs.TabPane itemKey="members" tab="成员">
                  <div style={{ color: "var(--muted-foreground)" }}>
                    成员列表（该组织下的 {selected.memberCount} 人）。调岗请使用顶部「人员调岗」按钮。
                  </div>
                </Tabs.TabPane>
              </Tabs>
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
        visible={!!orgModal}
        onCancel={() => setOrgModal(null)}
        onOk={submitOrg}
        okText="保存"
        cancelText="取消"
      >
        <Form form={orgForm}>
          <Form.Select
            field="parentId"
            label="父组织"
            showClear
            placeholder="无（顶级组织）"
            optionList={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []}
            disabled={orgModal?.mode === "edit"}
          />
          <Form.Input field="code" label="编码" rules={[{ required: true, min: 1, max: 64 }]} />
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select
            field="type"
            label="类型"
            initValue="DEPARTMENT"
            optionList={[
              { value: "COMPANY", label: "公司" },
              { value: "DEPARTMENT", label: "部门" },
              { value: "TEAM", label: "团队" },
              { value: "VIRTUAL", label: "虚拟组织" },
            ]}
          />
          <Form.InputNumber field="sortOrder" label="排序" initValue={0} style={{ width: "100%" }} />
          <Form.TextArea field="description" label="描述" autosize={{ minRows: 2 }} />
        </Form>
      </Modal>

      <Modal
        title={positionModal?.mode === "edit" ? "编辑岗位" : "新建岗位"}
        visible={!!positionModal}
        onCancel={() => setPositionModal(null)}
        onOk={submitPosition}
        okText="保存"
        cancelText="取消"
      >
        <Form form={positionForm}>
          <Form.Select
            field="orgId"
            label="所属组织"
            rules={[{ required: true }]}
            optionList={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []}
            disabled={positionModal?.mode === "edit"}
          />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="level" label="级别" placeholder="如 P6 / M2" />
          <Form.TextArea field="description" label="描述" autosize={{ minRows: 2 }} />
        </Form>
      </Modal>

      <Modal
        title="人员调岗"
        visible={transferOpen}
        onCancel={() => setTransferOpen(false)}
        onOk={submitTransfer}
        okText="调岗"
        cancelText="取消"
      >
        <Form form={transferForm}>
          <Form.InputNumber field="userId" label="用户 ID" rules={[{ required: true }]} style={{ width: "100%" }} />
          <Form.Select
            field="targetOrgId"
            label="目标组织"
            rules={[{ required: true }]}
            optionList={Array.isArray(tree) ? tree.map((n) => ({ value: n.id, label: n.name })) : []}
            filter
          />
          <Form.InputNumber field="targetPositionId" label="目标岗位（留空自动取第一岗）" style={{ width: "100%" }} />
          <Form.InputNumber field="reportsTo" label="汇报对象 user ID" style={{ width: "100%" }} />
          <Form.TextArea field="reason" label="调岗原因" autosize={{ minRows: 2 }} />
        </Form>
      </Modal>
    </AdminLayout>
  );
}
