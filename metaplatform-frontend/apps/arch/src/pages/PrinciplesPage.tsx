import { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Input, Select, Tag, message, Popconfirm, List, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listPrinciples,
  createPrinciple,
  updatePrinciple,
  deletePrinciple,
  listPrincipleCategories,
  createPrincipleCategory,
  updatePrincipleCategory,
  deletePrincipleCategory,
} from '@/api/governance';
import type { Principle, PrincipleCategory } from '@/types';
import { SectionCard, FormModal } from '@mate/shared';

const PRIORITY_TAG: Record<string, string> = { HIGH: 'red', MEDIUM: 'orange', LOW: 'blue' };
const STATUS_TAG: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: '生效' },
  INACTIVE: { color: 'default', label: '停用' },
};

export default function PrinciplesPage() {
  const [activeTab, setActiveTab] = useState('principles');

  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [categories, setCategories] = useState<PrincipleCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const [principleModalOpen, setPrincipleModalOpen] = useState(false);
  const [editingPrinciple, setEditingPrinciple] = useState<Principle | null>(null);
  const [principleSubmitting, setPrincipleSubmitting] = useState(false);
  const [principleForm] = Form.useForm<Partial<Principle>>();

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PrincipleCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryForm] = Form.useForm<Partial<PrincipleCategory>>();

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listPrinciples(), listPrincipleCategories()]);
      setPrinciples(p);
      setCategories(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmitPrinciple = async () => {
    const values = await principleForm.validateFields();
    const standards = typeof values.standards === 'string'
      ? (values.standards as string).split('\n').filter(Boolean)
      : values.standards || [];
    const payload = { ...values, standards };
    setPrincipleSubmitting(true);
    try {
      if (editingPrinciple) {
        await updatePrinciple(editingPrinciple.id, payload);
        message.success('更新成功');
      } else {
        await createPrinciple(payload);
        message.success('创建成功');
      }
      setPrincipleModalOpen(false);
      setEditingPrinciple(null);
      principleForm.resetFields();
      load();
    } finally {
      setPrincipleSubmitting(false);
    }
  };

  const handleSubmitCategory = async () => {
    const values = await categoryForm.validateFields();
    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        await updatePrincipleCategory(editingCategory.id, values);
        message.success('更新成功');
      } else {
        await createPrincipleCategory(values);
        message.success('创建成功');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      categoryForm.resetFields();
      load();
    } finally {
      setCategorySubmitting(false);
    }
  };

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const principleColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    {
      title: '分类',
      key: 'category',
      render: (_: unknown, r: Principle) => r.categoryName || categoryMap.get(r.categoryId || '')?.name || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: string) => <Tag color={PRIORITY_TAG[p]}>{p}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag>,
    },
    { title: '标准数', key: 'standards', render: (_: unknown, r: Principle) => r.standards?.length || 0 },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: Principle) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPrinciple(r);
              const standardsValue = Array.isArray(r.standards) ? r.standards.join('\n') : '';
              principleForm.setFieldsValue({ ...r, standards: standardsValue } as unknown as Partial<Principle>);
              setPrincipleModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={async () => { await deletePrinciple(r.id); message.success('已删除'); load(); }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const categoryColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: PrincipleCategory) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingCategory(r); categoryForm.setFieldsValue(r); setCategoryModalOpen(true); }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={async () => { await deletePrincipleCategory(r.id); message.success('已删除'); load(); }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <SectionCard title="架构原则与标准" bodyPadding={0}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 24px' }}>
        <Tabs.TabPane tab="架构原则" key="principles">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingPrinciple(null); principleForm.resetFields(); setPrincipleModalOpen(true); }}
            style={{ marginBottom: 16 }}
          >
            新增原则
          </Button>
          <Table
            rowKey="id"
            columns={principleColumns}
            dataSource={principles}
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
            expandable={{
              expandedRowRender: (r: Principle) => (
                <List size="small" dataSource={r.standards || []} renderItem={(s) => <List.Item>• {s}</List.Item>} />
              ),
            }}
           scroll={{ x: 'max-content' }}/>
        </Tabs.TabPane>
        <Tabs.TabPane tab="原则分类" key="categories">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingCategory(null); categoryForm.resetFields(); setCategoryModalOpen(true); }}
            style={{ marginBottom: 16 }}
          >
            新增分类
          </Button>
          <Table
            rowKey="id"
            columns={categoryColumns}
            dataSource={categories}
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small" scroll={{ x: 'max-content' }} />
        </Tabs.TabPane>
      </Tabs>

      <FormModal
        open={principleModalOpen}
        title={editingPrinciple ? '编辑原则' : '新增原则'}
        form={principleForm}
        onSubmit={handleSubmitPrinciple}
        onCancel={() => { setPrincipleModalOpen(false); setEditingPrinciple(null); principleForm.resetFields(); }}
        submitting={principleSubmitting}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="categoryId" label="分类">
          <Select allowClear placeholder="选择原则分类">
            {categories.map((c) => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="priority" label="优先级" initialValue="MEDIUM">
          <Select>
            <Select.Option value="HIGH">高</Select.Option>
            <Select.Option value="MEDIUM">中</Select.Option>
            <Select.Option value="LOW">低</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态" initialValue="ACTIVE">
          <Select>
            <Select.Option value="ACTIVE">生效</Select.Option>
            <Select.Option value="INACTIVE">停用</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="standards" label="标准（每行一条）"><Input.TextArea rows={4} placeholder="每行一条标准" /></Form.Item>
      </FormModal>

      <FormModal
        open={categoryModalOpen}
        title={editingCategory ? '编辑分类' : '新增分类'}
        form={categoryForm}
        onSubmit={handleSubmitCategory}
        onCancel={() => { setCategoryModalOpen(false); setEditingCategory(null); categoryForm.resetFields(); }}
        submitting={categorySubmitting}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="sortOrder" label="排序" initialValue={0}><Input type="number" /></Form.Item>
      </FormModal>
    </SectionCard>
  );
}
