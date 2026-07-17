import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, List, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listPrinciples, createPrinciple, updatePrinciple, deletePrinciple } from '@/api/governance';
import type { Principle } from '@/types';

const PRIORITY_TAG: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' };

export default function PrinciplesPage() {
  const [list, setList] = useState<Principle[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Principle | null>(null);
  const [form] = Form.useForm<Partial<Principle>>();

  const load = async () => {
    setLoading(true);
    try { setList(await listPrinciples()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const standards = typeof values.standards === 'string' ? (values.standards as string).split('\n').filter(Boolean) : values.standards || [];
    const payload = { ...values, standards };
    if (editing) { await updatePrinciple(editing.id, payload); message.success('更新成功'); }
    else { await createPrinciple(payload); message.success('创建成功'); }
    setModalOpen(false); setEditing(null); form.resetFields(); load();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '优先级', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={PRIORITY_TAG[p]}>{p}</Tag> },
    { title: '标准数', key: 'standards', render: (_: unknown, r: Principle) => r.standards?.length || 0 },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: Principle) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, standards: r.standards?.join('\n') }); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deletePrinciple(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="架构原则与标准" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增原则</Button>}>
      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" expandable={{ expandedRowRender: (r: Principle) => <List size="small" dataSource={r.standards || []} renderItem={(s) => <List.Item>• {s}</List.Item>} /> }} />

      <Modal title={editing ? '编辑原则' : '新增原则'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}><Input placeholder="架构 / 数据 / 安全" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium"><Select><Select.Option value="high">高</Select.Option><Select.Option value="medium">中</Select.Option><Select.Option value="low">低</Select.Option></Select></Form.Item>
          <Form.Item name="standards" label="标准（每行一条）"><Input.TextArea rows={4} placeholder={'每行一条标准'} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
