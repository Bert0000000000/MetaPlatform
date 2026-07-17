import { useEffect, useState } from 'react';
import { Row, Col, Card, Tree, Button, Table, Space, Input, Modal, Form, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { listCapabilities, getCapabilityTree, createCapability, updateCapability, deleteCapability } from '@/api/capabilities';
import CapabilityGraph from '@/components/CapabilityGraph';
import type { Capability, CapabilityCreateRequest } from '@/types';

function buildTreeData(caps: Capability[]): DataNode[] {
  const build = (parentId?: string): DataNode[] =>
    caps
      .filter((c) => c.parentCapabilityId === parentId)
      .map((c) => ({
        key: c.capabilityId,
        title: `${c.name} (${c.code})`,
        children: build(c.capabilityId),
      }));
  const roots = caps.filter((c) => !c.parentCapabilityId);
  return roots.map((r) => ({ key: r.capabilityId, title: `${r.name} (${r.code})`, children: build(r.capabilityId) }));
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '生效' },
  deprecated: { color: 'default', label: '废弃' },
  planned: { color: 'blue', label: '规划中' },
};

export default function CapabilityManagementPage() {
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Capability | null>(null);
  const [form] = Form.useForm<CapabilityCreateRequest>();

  const load = async () => {
    setLoading(true);
    try {
      const [list, tree] = await Promise.all([listCapabilities(), getCapabilityTree()]);
      setCaps(list.items.length > 0 ? list.items : tree);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    form.validateFields().then(async (values) => {
      if (editing) {
        await updateCapability(editing.capabilityId, values);
        message.success('更新成功');
      } else {
        await createCapability(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    });
  };

  const handleDelete = async (cap: Capability) => {
    await deleteCapability(cap.capabilityId);
    message.success('删除成功');
    load();
  };

  const columns = [
    { title: '能力名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '层级', dataIndex: 'level', key: 'level' },
    { title: '父能力', dataIndex: 'parentName', key: 'parentName', render: (v?: string) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, record: Capability) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filtered = selectedId ? caps.filter((c) => c.capabilityId === selectedId || c.parentCapabilityId === selectedId) : caps;

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="能力树" size="small" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增</Button>}>
            <Tree treeData={buildTreeData(caps)} selectedKeys={selectedId ? [selectedId] : []} onSelect={(keys) => setSelectedId(keys[0] as string | undefined)} defaultExpandAll />
          </Card>
        </Col>
        <Col span={18}>
          <Card title="能力列表" size="small" extra={<Input.Search placeholder="搜索" allowClear onSearch={() => load()} style={{ width: 200 }} />}>
            <Table rowKey="capabilityId" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 10 }} size="small" />
          </Card>
        </Col>
      </Row>
      <Card title="能力可视化" style={{ marginTop: 16 }}>
        <CapabilityGraph data={caps} />
      </Card>

      <Modal title={editing ? '编辑能力' : '创建能力'} open={modalOpen} onOk={handleCreate} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="能力名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="parentCapabilityId" label="父能力">
            <select style={{ width: '100%', height: 32, padding: '4px 11px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <option value="">无（顶级能力）</option>
              {caps.map((c) => <option key={c.capabilityId} value={c.capabilityId}>{c.name}</option>)}
            </select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <select style={{ width: '100%', height: 32, padding: '4px 11px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
              <option value="active">生效</option>
              <option value="planned">规划中</option>
              <option value="deprecated">废弃</option>
            </select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
