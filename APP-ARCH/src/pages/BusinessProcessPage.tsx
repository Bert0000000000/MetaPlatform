import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Typography, List } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listProcesses, createProcess, updateProcess, deleteProcess } from '@/api/businessProcesses';
import { listCapabilities } from '@/api/capabilities';
import type { BusinessProcess, Capability } from '@/types';

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '生效' },
  draft: { color: 'default', label: '草稿' },
  deprecated: { color: 'red', label: '废弃' },
};

export default function BusinessProcessPage() {
  const [list, setList] = useState<BusinessProcess[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessProcess | null>(null);
  const [detail, setDetail] = useState<BusinessProcess | null>(null);
  const [form] = Form.useForm<Partial<BusinessProcess>>();

  const load = async () => {
    setLoading(true);
    try {
      const [res, capRes] = await Promise.all([listProcesses(), listCapabilities()]);
      setList(res.items);
      setCaps(capRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) { await updateProcess(editing.id, values); message.success('更新成功'); }
    else { await createProcess(values); message.success('创建成功'); }
    setModalOpen(false); setEditing(null); form.resetFields(); load();
  };

  const columns = [
    { title: '流程名称', dataIndex: 'name', key: 'name', render: (v: string, r: BusinessProcess) => <Typography.Link onClick={() => setDetail(r)}>{v}</Typography.Link> },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '关联能力', key: 'caps', render: (_: unknown, r: BusinessProcess) => r.capabilityIds?.map((id) => <Tag key={id} color="blue">{caps.find((c) => c.capabilityId === id)?.name || id}</Tag>) },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.label}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: BusinessProcess) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteProcess(r.id); message.success('已删除'); load(); }}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="业务流程管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" />
      </Card>

      {detail && (
        <Card title={`流程图 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Typography.Title level={5}>流程步骤</Typography.Title>
          {detail.steps && detail.steps.length > 0 ? (
            <List dataSource={detail.steps} renderItem={(step, idx) => <List.Item><Tag>{idx + 1}</Tag> {step}</List.Item>} />
          ) : <Typography.Text type="secondary">暂无步骤</Typography.Text>}
        </Card>
      )}

      <Modal title={editing ? '编辑流程' : '新建流程'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="capabilityIds" label="关联能力">
            <Select mode="multiple">{caps.map((c) => <Select.Option key={c.capabilityId} value={c.capabilityId}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft">
            <Select><Select.Option value="active">生效</Select.Option><Select.Option value="draft">草稿</Select.Option><Select.Option value="deprecated">废弃</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
