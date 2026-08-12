import { useEffect, useState } from 'react';
import { Row, Col, Card, Tree, Button, Table, Space, Modal, Form, Tag, Toast, Popconfirm } from '@douyinfe/semi-ui';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getOrgTree, listRoles, createRole, updateRole, deleteRole } from '@/api/arch/roles';
import type { OrgUnit, ArchRole, CreateRoleRequest, UpdateRoleRequest } from '@/api/arch/types';

function buildOrgTree(orgs: OrgUnit[]): TreeNodeData[] {
  const safeOrgs = Array.isArray(orgs) ? orgs : [];
  const visited = new Set<string>();
  const getId = (o: OrgUnit) => o.id || (o as unknown as Record<string, unknown>).org_id as string || '';
  const getParent = (o: OrgUnit) => o.parentId || (o as unknown as Record<string, unknown>).parent_id as string || '';
  const build = (parentId: string): TreeNodeData[] =>
    safeOrgs.filter((o) => getParent(o) === parentId && !visited.has(getId(o))).map((o) => {
      const id = getId(o);
      visited.add(id);
      return { key: id, label: `${o.name} (${o.head || ''})`, children: build(id) };
    });
  return safeOrgs.filter((o) => !getParent(o) && !visited.has(getId(o))).map((o) => {
    const id = getId(o);
    visited.add(id);
    return { key: id, label: `${o.name} (${o.head || ''})`, children: build(id) };
  });
}

const DOMAIN_OPTIONS = ['SALES', 'MARKETING', 'FINANCE', 'HR', 'OPERATIONS', 'IT', 'LEGAL', 'PRODUCT'];

export default function OrgRolePage() {
  const [orgs, setOrgs] = useState<OrgUnit[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArchRole | null>(null);
  const [form] = Form.useForm<Partial<CreateRoleRequest>>();

  const load = async () => {
    setLoading(true);
    try {
      const [orgData, roleData] = await Promise.all([
        getOrgTree().catch(() => []),
        listRoles().catch(() => ({ items: [] })),
      ]);
      const orgs = Array.isArray(orgData) ? orgData : ((orgData as Record<string, unknown>)?.tree as OrgUnit[] ?? []);
      const roles = Array.isArray(roleData) ? roleData : (roleData?.items ?? []);
      setOrgs(orgs);
      setRoles(roles);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOrgSelect = async (orgId: string) => {
    setSelectedOrg(orgId);
    const data = await listRoles({ orgUnitId: orgId });
    setRoles(data.items);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateRole(editing.id, values as UpdateRoleRequest);
      Toast.success('更新成功');
    } else {
      await createRole({ ...values, orgUnitId: selectedOrg } as CreateRoleRequest);
      Toast.success('创建成功');
    }
    setModalOpen(false); setEditing(null); form.reset();
    if (selectedOrg) {
      const data = await listRoles({ orgUnitId: selectedOrg });
      setRoles(data.items);
    } else load();
  };

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '所属组织', dataIndex: 'orgUnitName', key: 'orgUnitName' },
    { title: '业务域', dataIndex: 'domain', key: 'domain', render: (d?: string) => d ? <Tag color="cyan">{d}</Tag> : null },
    { title: '职责', dataIndex: 'responsibility', key: 'responsibility', ellipsis: true },
    { title: 'IAM角色', key: 'iam', render: (_: unknown, r: ArchRole) => r.iamRoleIds?.map((id) => <Tag key={id}>{id.slice(0, 8)}</Tag>) },
    { title: '流程数', dataIndex: 'processCount', key: 'processCount' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ArchRole) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setValues(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteRole(r.id); Toast.success('已删除'); load(); }}><Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="组织架构" bodyStyle={{ padding: 12 }}>
          <Tree treeData={buildOrgTree(orgs)} onSelect={(key) => { if (key) handleOrgSelect(key); }} defaultExpandAll />
        </Card>
      </Col>
      <Col span={16}>
        <Card title={`角色管理${selectedOrg ? ` - ${orgs.find((o) => o.id === selectedOrg)?.name}` : ''}`} bodyStyle={{ padding: 12 }} headerExtraContent={<Button theme="solid" type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新增角色</Button>}>
          <Table rowKey="id" columns={columns} dataSource={roles ?? []} loading={loading} pagination={false} size="small" scroll={{ x: 'max-content' }} />
        </Card>
      </Col>

      <Modal title={editing ? '编辑角色' : '创建角色'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="角色名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} disabled={!!editing} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.TextArea field="responsibility" label="职责" rows={2} />
          <Form.Select field="domain" label="业务域" placeholder="选择业务域" showClear optionList={DOMAIN_OPTIONS.map((d) => ({ value: d, label: d }))} />
          <Form.TagInput field="iamRoleIds" label="IAM 角色 ID" placeholder="输入 IAM 角色 ID，按回车确认" separator={','} />
        </Form>
      </Modal>
    </Row>
  );
}
