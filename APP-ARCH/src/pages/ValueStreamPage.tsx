import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Tag, message, Popconfirm, Steps, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listValueStreams, createValueStream, updateValueStream, deleteValueStream } from '@/api/valueStreams';
import type { ValueStream } from '@/types';

export default function ValueStreamPage() {
  const [list, setList] = useState<ValueStream[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ValueStream | null>(null);
  const [detail, setDetail] = useState<ValueStream | null>(null);
  const [form] = Form.useForm<Partial<ValueStream>>();

  const load = async () => {
    setLoading(true);
    try {
      const res = await listValueStreams();
      setList(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateValueStream(editing.id, values);
      message.success('更新成功');
    } else {
      await createValueStream(values);
      message.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const handleDelete = async (vs: ValueStream) => {
    await deleteValueStream(vs.id);
    message.success('删除成功');
    load();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: ValueStream) => <Typography.Link onClick={() => setDetail(r)}>{v}</Typography.Link> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '阶段数', key: 'stages', render: (_: unknown, r: ValueStream) => r.stages?.length || 0 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '生效' : '草稿'}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ValueStream) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="价值流管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" />
      </Card>

      {detail && (
        <Card title={`价值流详情 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Steps current={detail.stages.length - 1} items={detail.stages.sort((a, b) => a.order - b.order).map((s) => ({ title: s.name, description: s.description }))} />
        </Card>
      )}

      <Modal title={editing ? '编辑价值流' : '新建价值流'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
