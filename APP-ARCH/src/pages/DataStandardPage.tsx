import { useEffect, useState } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Drawer } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { listStandards, createStandard, updateStandard, deleteStandard } from '@/api/dataArchitecture';
import type { DataStandard } from '@/types';

const STANDARD_TYPES = ['format', 'enum', 'rule', 'range', 'regex'];

export default function DataStandardPage() {
  const [standards, setStandards] = useState<DataStandard[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DataStandard | null>(null);
  const [preview, setPreview] = useState<DataStandard | null>(null);
  const [form] = Form.useForm<Partial<DataStandard>>();

  const load = async () => {
    const data = await listStandards();
    setStandards(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: DataStandard) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateStandard(editing.id, values);
      message.success('更新成功');
    } else {
      await createStandard(values);
      message.success('创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteStandard(id);
    message.success('已删除');
    load();
  };

  const typeColor: Record<string, string> = { format: 'blue', enum: 'green', rule: 'orange', range: 'purple', regex: 'cyan' };

  const columns = [
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'standardType', key: 'standardType', render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag> },
    { title: '规则', dataIndex: 'rule', key: 'rule', ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: DataStandard) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreview(r)}>预览</Button>
          <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="数据标准管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建标准</Button>}
    >
      <Table rowKey="id" columns={columns} dataSource={standards} size="small" scroll={{ x: 'max-content' }} />

      <Modal title={editing ? '编辑数据标准' : '新建数据标准'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="standardType" label="类型" rules={[{ required: true }]}>
            <Select options={STANDARD_TYPES.map((t) => ({ label: t, value: t }))} />
          </Form.Item>
          <Form.Item name="rule" label="规则"><Input.TextArea rows={3} placeholder="如正则表达式、枚举值、阈值范围等" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title="规则预览" open={!!preview} onClose={() => setPreview(null)} width={480}>
        {preview && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div><strong>编码：</strong>{preview.code}</div>
            <div><strong>名称：</strong>{preview.name}</div>
            <div><strong>类型：</strong><Tag color={typeColor[preview.standardType] || 'default'}>{preview.standardType}</Tag></div>
            <div><strong>规则：</strong></div>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>{preview.rule || '无'}</pre>
            <div><strong>描述：</strong>{preview.description || '无'}</div>
          </Space>
        )}
      </Drawer>
    </Card>
  );
}
