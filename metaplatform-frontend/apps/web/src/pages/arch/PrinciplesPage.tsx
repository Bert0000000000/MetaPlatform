import { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Input, Select, Tag, Toast, Popconfirm, Tabs } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
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
} from '@/api/arch/governance';
import type { Principle, PrincipleCategory } from '@/api/arch/types';
import { SectionCard, FormModal } from '@mate/shared';

const PRIORITY_TAG: Record<string, TagColor> = { HIGH: 'red', MEDIUM: 'orange', LOW: 'blue' };
const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  ACTIVE: { color: 'green', label: '生效' },
  INACTIVE: { color: 'grey', label: '停用' },
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
      setPrinciples(Array.isArray(p) ? p : ((p as { items?: Principle[] }).items ?? []));
      setCategories(Array.isArray(c) ? c : ((c as { items?: PrincipleCategory[] }).items ?? []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmitPrinciple = async () => {
    const values = await principleForm.validate();
    const standards = typeof values.standards === 'string'
      ? (values.standards as string).split('\n').filter(Boolean)
      : values.standards || [];
    const payload = { ...values, standards };
    setPrincipleSubmitting(true);
    try {
      if (editingPrinciple) {
        await updatePrinciple(editingPrinciple.id, payload);
        Toast.success('更新成功');
      } else {
        await createPrinciple(payload);
        Toast.success('创建成功');
      }
      setPrincipleModalOpen(false);
      setEditingPrinciple(null);
      principleForm.reset();
      load();
    } finally {
      setPrincipleSubmitting(false);
    }
  };

  const handleSubmitCategory = async () => {
    const values = await categoryForm.validate();
    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        await updatePrincipleCategory(editingCategory.id, values);
        Toast.success('更新成功');
      } else {
        await createPrincipleCategory(values);
        Toast.success('创建成功');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
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
            theme="borderless"
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPrinciple(r);
              const standardsValue = Array.isArray(r.standards) ? r.standards.join('\n') : '';
              principleForm.setValues({ ...r, standards: standardsValue } as unknown as Partial<Principle>);
              setPrincipleModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={async () => { await deletePrinciple(r.id); Toast.success('已删除'); load(); }}
          >
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
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
            theme="borderless"
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingCategory(r); categoryForm.setValues(r); setCategoryModalOpen(true); }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={async () => { await deletePrincipleCategory(r.id); Toast.success('已删除'); load(); }}
          >
            <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <SectionCard title="架构原则与标准" bodyPadding={0}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 24px' }}>
        <Tabs.TabPane tab="架构原则" itemKey="principles">
          <Button
            theme="solid"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingPrinciple(null); principleForm.reset(); setPrincipleModalOpen(true); }}
            style={{ marginBottom: 16 }}
          >
            新增原则
          </Button>
          <Table
            rowKey="id"
            columns={principleColumns}
            dataSource={principles ?? []}
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
            expandedRowRender={(r?: Principle) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(r?.standards || []).map((s, idx) => (
                  <div key={idx} style={{ padding: '2px 0' }}>• {s}</div>
                ))}
              </div>
            )}
           scroll={{ x: 'max-content' }}/>
        </Tabs.TabPane>
        <Tabs.TabPane tab="原则分类" itemKey="categories">
          <Button
            theme="solid"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingCategory(null); categoryForm.reset(); setCategoryModalOpen(true); }}
            style={{ marginBottom: 16 }}
          >
            新增分类
          </Button>
          <Table
            rowKey="id"
            columns={categoryColumns}
            dataSource={categories ?? []}
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
        onCancel={() => { setPrincipleModalOpen(false); setEditingPrinciple(null); principleForm.reset(); }}
        submitting={principleSubmitting}
      >
        <Form form={principleForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.Select field="categoryId" label="分类" showClear placeholder="选择原则分类" optionList={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select field="priority" label="优先级" initValue="MEDIUM" optionList={[
            { value: 'HIGH', label: '高' },
            { value: 'MEDIUM', label: '中' },
            { value: 'LOW', label: '低' },
          ]} />
          <Form.Select field="status" label="状态" initValue="ACTIVE" optionList={[
            { value: 'ACTIVE', label: '生效' },
            { value: 'INACTIVE', label: '停用' },
          ]} />
          <Form.TextArea field="standards" label="标准（每行一条）" rows={4} placeholder="每行一条标准" />
        </Form>
      </FormModal>

      <FormModal
        open={categoryModalOpen}
        title={editingCategory ? '编辑分类' : '新增分类'}
        form={categoryForm}
        onSubmit={handleSubmitCategory}
        onCancel={() => { setCategoryModalOpen(false); setEditingCategory(null); categoryForm.reset(); }}
        submitting={categorySubmitting}
      >
        <Form form={categoryForm}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.InputNumber field="sortOrder" label="排序" initValue={0} />
        </Form>
      </FormModal>
    </SectionCard>
  );
}
