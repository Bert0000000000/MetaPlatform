import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listTechnologyComponents, createTechnologyComponent, updateTechnologyComponent, deleteTechnologyComponent } from '@/api/technologyComponents';
import type { TechnologyComponent } from '@/types';

const COMPONENT_TYPES: { value: TechnologyComponent['type']; label: string; color: string }[] = [
  { value: 'database', label: '数据库', color: 'blue' },
  { value: 'framework', label: '框架', color: 'purple' },
  { value: 'middleware', label: '中间件', color: 'orange' },
  { value: 'language', label: '语言', color: 'cyan' },
  { value: 'tool', label: '工具', color: 'geekblue' },
  { value: 'infrastructure', label: '基础设施', color: 'magenta' },
  { value: 'other', label: '其他', color: 'default' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  deprecated: { color: 'red', label: '已废弃' },
  planned: { color: 'gold', label: '规划中' },
};

export default function TechComponentPage() {
  const [components, setComponents] = useState<TechnologyComponent[]>([]);
  const [filteredType, setFilteredType] = useState<TechnologyComponent['type'] | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TechnologyComponent | null>(null);
  const [form] = Form.useForm<Partial<TechnologyComponent>>();

  const load = async () => {
    setLoading(true);
    const data = await listTechnologyComponents(filteredType === 'all' ? undefined : filteredType);
    setComponents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filteredType]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateTechnologyComponent(editing.id, values);
      message.success('更新成功');
    } else {
      await createTechnologyComponent(values);
      message.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const handleEdit = (record: TechnologyComponent) => {
    setEditing(record);
    form.setFieldsValue({ ...record });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTechnologyComponent(id);
    message.success('已删除');
    load();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: TechnologyComponent['type']) => {
      const item = COMPONENT_TYPES.find((c) => c.value === t);
      return <Tag color={item?.color}>{item?.label ?? t}</Tag>;
    }},
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '责任人', dataIndex: 'owner', key: 'owner' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: TechnologyComponent) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <Typography.Title level={4}>技术组件库</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增组件</Button>
          <Select<TechnologyComponent['type'] | 'all'>
            value={filteredType}
            onChange={setFilteredType}
            style={{ width: 160 }}
            options={[{ value: 'all', label: '全部分类' }, ...COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={components} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Modal title={editing ? '编辑技术组件' : '新增技术组件'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </Form.Item>
          <Form.Item name="version" label="版本"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="owner" label="责任人"><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select options={[
              { value: 'active', label: '活跃' },
              { value: 'deprecated', label: '已废弃' },
              { value: 'planned', label: '规划中' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
