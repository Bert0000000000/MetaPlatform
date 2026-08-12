import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Space, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listTechnologyComponents, createTechnologyComponent, updateTechnologyComponent, deleteTechnologyComponent } from '@/api/arch/technologyComponents';
import type { TechnologyComponent } from '@/api/arch/types';

const COMPONENT_TYPES: { value: TechnologyComponent['type']; label: string; color: TagColor }[] = [
  { value: 'database', label: '数据库', color: 'blue' },
  { value: 'framework', label: '框架', color: 'purple' },
  { value: 'middleware', label: '中间件', color: 'orange' },
  { value: 'language', label: '语言', color: 'cyan' },
  { value: 'tool', label: '工具', color: 'indigo' },
  { value: 'infrastructure', label: '基础设施', color: 'pink' },
  { value: 'other', label: '其他', color: 'grey' },
];

const STATUS_MAP: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '活跃' },
  deprecated: { color: 'red', label: '已废弃' },
  planned: { color: 'yellow', label: '规划中' },
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
    setComponents(Array.isArray(data) ? data : ((data as { items?: TechnologyComponent[] }).items ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filteredType]);

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateTechnologyComponent(editing.id, values);
      Toast.success('更新成功');
    } else {
      await createTechnologyComponent(values);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const handleEdit = (record: TechnologyComponent) => {
    setEditing(record);
    form.setValues({ ...record });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTechnologyComponent(id);
    Toast.success('已删除');
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
        <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <Typography.Title heading={4}>技术组件库</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新增组件</Button>
          <Select<TechnologyComponent['type'] | 'all'>
            value={filteredType}
            onChange={(v) => setFilteredType(v as TechnologyComponent['type'] | 'all')}
            style={{ width: 160 }}
            optionList={[{ value: 'all', label: '全部分类' }, ...COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={components ?? []} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Modal title={editing ? '编辑技术组件' : '新增技术组件'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select field="type" label="类型" rules={[{ required: true }]} optionList={COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          <Form.Input field="version" label="版本" />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input field="owner" label="责任人" />
          <Form.Select field="status" label="状态" initValue="active" optionList={[
            { value: 'active', label: '活跃' },
            { value: 'deprecated', label: '已废弃' },
            { value: 'planned', label: '规划中' },
          ]} />
        </Form>
      </Modal>
    </div>
  );
}
