import { useEffect, useState } from 'react';
import { Row, Col, Card, Tree, Button, Table, Space, Modal, Form, Input, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { getOrgTree, listRoles, createRole, updateRole, deleteRole } from '@/api/roles';
import type { OrgUnit, ArchRole } from '@/types';

function buildOrgTree(orgs: OrgUnit[]): DataNode[] {
  const build = (parentId?: string): DataNode[] =>
    orgs.filter((o) => o.parentId === parentId).map((o) => ({ key: o.id, title: `${o.name} (${o.head || ''})`, children: build(o.id) }));
  return build();
}

export default function OrgRolePage() {
  const [orgs, setOrgs] = useState<OrgUnit[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArchRole | null>(null);
  const [form] = Form.useForm<Partial<ArchRole>>();

  const load = async () => {
    setLoading(true);
    try {
      const [orgData, roleData] = await Promise.all([getOrgTree(), listRoles()]);
      setOrgs(orgData);
      setRoles(roleData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOrgSelect = async (orgId: string) => {
    setSelectedOrg(orgId);
    const data = await listRoles(orgId);
    setRoles(data);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) { await updateRole(editing.id, values); message.success('更新成功'); }
    else { await createRole({ ...values, orgUnitId: selectedOrg }); message.success('创建成功'); }
    setModalOpen(false); setEditing(null); form.resetFields();
    if (selectedOrg) setRoles(await listRoles(selectedOrg));
    else load();
  };

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '所属组织', dataIndex: 'orgUnitName', key: 'orgUnitName' },
    { title: '权限', key: 'perms', render: (_: unknown, r: ArchRole) => r.permissions?.map((p) => <Tag key={p} color="purple">{p}</Tag>) },
    { title: '用户数', dataIndex: 'userCount', key: 'userCount' },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ArchRole) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteRole(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="组织架构" size="small">
          <Tree treeData={buildOrgTree(orgs)} selectedKeys={selectedOrg ? [selectedOrg] : []} onSelect={(keys) => keys[0] && handleOrgSelect(keys[0] as string)} defaultExpandAll />
        </Card>
      </Col>
      <Col span={16}>
        <Card title={`角色管理${selectedOrg ? ` - ${orgs.find((o) => o.id === selectedOrg)?.name}` : ''}`} size="small" extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增角色</Button>}>
          <Table rowKey="id" columns={columns} dataSource={roles} loading={loading} pagination={false} size="small" />
        </Card>
      </Col>

      <Modal title={editing ? '编辑角色' : '创建角色'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="permissions" label="权限（逗号分隔）"><Input placeholder="approve,view,edit" /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
