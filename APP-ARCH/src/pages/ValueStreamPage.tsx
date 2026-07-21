import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Tag, message, Popconfirm, Steps, Typography, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listValueStreams, createValueStream, updateValueStream, deleteValueStream, listStages, createStage, updateStage, deleteStage } from '@/api/valueStreams';
import { listCapabilities } from '@/api/capabilities';
import { listRoles } from '@/api/roles';
import type { ValueStream, ValueStreamStage, Capability, ArchRole } from '@/types';

export default function ValueStreamPage() {
  const [list, setList] = useState<ValueStream[]>([]);
  const [stages, setStages] = useState<ValueStreamStage[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [roles, setRoles] = useState<ArchRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [editing, setEditing] = useState<ValueStream | null>(null);
  const [editingStage, setEditingStage] = useState<ValueStreamStage | null>(null);
  const [selectedStream, setSelectedStream] = useState<ValueStream | null>(null);
  const [detail, setDetail] = useState<ValueStream | null>(null);
  const [form] = Form.useForm<Partial<ValueStream>>();
  const [stageForm] = Form.useForm<Partial<ValueStreamStage>>();

  const load = async () => {
    setLoading(true);
    try {
      const [res, capRes, roleRes] = await Promise.all([listValueStreams(), listCapabilities(), listRoles()]);
      setList(res);
      setCaps(capRes.items);
      setRoles(roleRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadStages = async (vs: ValueStream) => {
    const data = await listStages(vs.id);
    setStages(data);
    setSelectedStream(vs);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateValueStream(editing.id, values);
      message.success('更新成功');
    } else {
      await createValueStream(values as { name: string; code: string });
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

  const handleStageSubmit = async () => {
    if (!selectedStream) return;
    const values = await stageForm.validateFields();
    if (editingStage) {
      await updateStage(selectedStream.id, editingStage.id, values);
      message.success('阶段更新成功');
    } else {
      await createStage(selectedStream.id, values);
      message.success('阶段创建成功');
    }
    setStageModalOpen(false);
    setEditingStage(null);
    stageForm.resetFields();
    loadStages(selectedStream);
  };

  const handleStageDelete = async (stage: ValueStreamStage) => {
    if (!selectedStream) return;
    await deleteStage(selectedStream.id, stage.id);
    message.success('阶段删除成功');
    loadStages(selectedStream);
  };

  const openStageModal = (stage?: ValueStreamStage) => {
    setEditingStage(stage || null);
    stageForm.setFieldsValue(stage || {});
    setStageModalOpen(true);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: ValueStream) => <Typography.Link onClick={() => { setDetail(r); loadStages(r); }}>{v}</Typography.Link> },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '触发事件', dataIndex: 'triggerEvent', key: 'triggerEvent', ellipsis: true },
    { title: '终止事件', dataIndex: 'terminationEvent', key: 'terminationEvent', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s?.toLowerCase() === 'active' ? 'green' : 'default'}>{s?.toLowerCase() === 'active' ? '生效' : '草稿'}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ValueStream) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Button type="link" size="small" onClick={() => { setSelectedStream(r); loadStages(r); setStageModalOpen(true); }}>阶段</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  const stageColumns = [
    { title: '阶段', dataIndex: 'name', key: 'name' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    { title: '产出物', key: 'outputs', render: (_: unknown, r: ValueStreamStage) => r.outputs?.map((o) => <Tag key={o}>{o}</Tag>) },
    { title: '参与角色', key: 'roles', render: (_: unknown, r: ValueStreamStage) => r.participantRoleIds?.map((id) => <Tag key={id}>{roles.find((role) => role.id === id)?.name || id}</Tag>) },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ValueStreamStage) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openStageModal(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleStageDelete(r)}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="价值流管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </Card>

      {detail && (
        <Card title={`价值流详情 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Steps current={stages.length - 1} items={stages.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({ title: s.name, description: s.description }))} />
        </Card>
      )}

      {selectedStream && (
        <Card title={`阶段管理 - ${selectedStream.name}`} style={{ marginTop: 16 }} extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openStageModal()}>新增阶段</Button>}>
          <Table rowKey="id" columns={stageColumns} dataSource={stages} size="small" pagination={false} scroll={{ x: 'max-content' }} />
        </Card>
      )}

      <Modal title={editing ? '编辑价值流' : '新建价值流'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="triggerEvent" label="触发事件"><Input /></Form.Item>
          <Form.Item name="terminationEvent" label="终止事件"><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="DRAFT">
            <Select><Select.Option value="ACTIVE">生效</Select.Option><Select.Option value="DRAFT">草稿</Select.Option></Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingStage ? '编辑阶段' : '新增阶段'} open={stageModalOpen} onOk={handleStageSubmit} onCancel={() => { setStageModalOpen(false); setEditingStage(null); stageForm.resetFields(); }}>
        <Form form={stageForm} layout="vertical">
          <Form.Item name="name" label="阶段名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="capabilityIds" label="关联能力">
            <Select mode="multiple">{caps.map((c) => <Select.Option key={c.capabilityId} value={c.capabilityId}>{c.name}</Select.Option>)}</Select>
          </Form.Item>
          <Form.Item name="outputs" label="产出物">
            <Select mode="tags" tokenSeparators={[',']} placeholder="输入产出物，按回车确认" />
          </Form.Item>
          <Form.Item name="participantRoleIds" label="参与角色">
            <Select mode="multiple">{roles.map((r) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}</Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
