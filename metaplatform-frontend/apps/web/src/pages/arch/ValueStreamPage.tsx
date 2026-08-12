import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Tag, Toast, Popconfirm, Steps, Typography } from '@douyinfe/semi-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listValueStreams, createValueStream, updateValueStream, deleteValueStream, listStages, createStage, updateStage, deleteStage } from '@/api/arch/valueStreams';
import { listCapabilities } from '@/api/arch/capabilities';
import { listRoles } from '@/api/arch/roles';
import type { ValueStream, ValueStreamStage, Capability, ArchRole } from '@/api/arch/types';

interface ValueStreamFormValues {
  name: string;
  code: string;
  description?: string;
  triggerEvent?: string;
  terminationEvent?: string;
  status?: 'ACTIVE' | 'DRAFT';
}

interface ValueStreamStageFormValues {
  name: string;
  description?: string;
  sortOrder?: number;
  capabilityIds?: string[];
  outputs?: string[];
  participantRoleIds?: string[];
}

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
  const [form] = Form.useForm<ValueStreamFormValues>();
  const [stageForm] = Form.useForm<ValueStreamStageFormValues>();

  const load = async () => {
    setLoading(true);
    try {
      const [res, capRes, roleRes] = await Promise.all([listValueStreams(), listCapabilities(), listRoles()]);
      setList(Array.isArray(res) ? res : ((res as { items?: ValueStream[] }).items ?? []));
      setCaps(capRes.items);
      setRoles(roleRes.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadStages = async (vs: ValueStream) => {
    const data = await listStages(vs.id);
    setStages(Array.isArray(data) ? data : ((data as { items?: ValueStreamStage[] }).items ?? []));
    setSelectedStream(vs);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateValueStream(editing.id, {
        name: values.name,
        description: values.description,
        triggerEvent: values.triggerEvent,
        terminationEvent: values.terminationEvent,
        status: values.status,
      });
      Toast.success('更新成功');
    } else {
      await createValueStream({
        name: values.name,
        code: values.code,
        description: values.description,
        triggerEvent: values.triggerEvent,
        terminationEvent: values.terminationEvent,
        status: values.status,
      });
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const handleDelete = async (vs: ValueStream) => {
    await deleteValueStream(vs.id);
    Toast.success('删除成功');
    load();
  };

  const handleStageSubmit = async () => {
    if (!selectedStream) return;
    const values = await stageForm.validate();
    if (editingStage) {
      await updateStage(selectedStream.id, editingStage.id, values);
      Toast.success('阶段更新成功');
    } else {
      await createStage(selectedStream.id, values);
      Toast.success('阶段创建成功');
    }
    setStageModalOpen(false);
    setEditingStage(null);
    stageForm.reset();
    loadStages(selectedStream);
  };

  const handleStageDelete = async (stage: ValueStreamStage) => {
    if (!selectedStream) return;
    await deleteStage(selectedStream.id, stage.id);
    Toast.success('阶段删除成功');
    loadStages(selectedStream);
  };

  const openStageModal = (stage?: ValueStreamStage) => {
    setEditingStage(stage || null);
    if (stage) {
      stageForm.setValues({
        name: stage.name,
        description: stage.description,
        sortOrder: stage.sortOrder,
        capabilityIds: stage.capabilityIds,
        outputs: stage.outputs,
        participantRoleIds: stage.participantRoleIds,
      });
    } else {
      stageForm.reset();
    }
    setStageModalOpen(true);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: ValueStream) => <Typography.Text link onClick={() => { setDetail(r); loadStages(r); }}>{v}</Typography.Text> },
    { title: '编码', dataIndex: 'code', key: 'code' },
    { title: '触发事件', dataIndex: 'triggerEvent', key: 'triggerEvent', ellipsis: true },
    { title: '终止事件', dataIndex: 'terminationEvent', key: 'terminationEvent', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s?.toLowerCase() === 'active' ? 'green' : 'grey'}>{s?.toLowerCase() === 'active' ? '生效' : '草稿'}</Tag> },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: ValueStream) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            const statusUpper = typeof r.status === 'string' ? r.status.toUpperCase() : undefined;
            form.setValues({
              name: r.name,
              code: r.code,
              description: r.description,
              triggerEvent: r.triggerEvent,
              terminationEvent: r.terminationEvent,
              status: statusUpper === 'ACTIVE' || statusUpper === 'DRAFT' ? statusUpper : undefined,
            });
            setModalOpen(true);
          }}>编辑</Button>
          <Button theme="borderless" type="primary" size="small" onClick={() => { setSelectedStream(r); loadStages(r); setStageModalOpen(true); }}>阶段</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
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
          <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => openStageModal(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleStageDelete(r)}><Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="价值流管理" headerExtraContent={<Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新建</Button>}>
        <Table rowKey="id" columns={columns} dataSource={list ?? []} loading={loading} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 'max-content' }} />
      </Card>

      {detail && (
        <Card title={`价值流详情 - ${detail.name}`} style={{ marginTop: 16 }}>
          <Steps current={stages.length - 1} type="basic">
            {stages.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
              <Steps.Step key={s.id} title={s.name} description={s.description}/>
            ))}
          </Steps>
        </Card>
      )}

      {selectedStream && (
        <Card title={`阶段管理 - ${selectedStream.name}`} style={{ marginTop: 16 }} headerExtraContent={<Button theme="solid" type="primary" size="small" icon={<PlusOutlined />} onClick={() => openStageModal()}>新增阶段</Button>}>
          <Table rowKey="id" columns={stageColumns} dataSource={stages ?? []} size="small" pagination={false} scroll={{ x: 'max-content' }} />
        </Card>
      )}

      <Modal title={editing ? '编辑价值流' : '新建价值流'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="code" label="编码" rules={[{ required: true }]} disabled={!!editing} />
          <Form.Input field="description" label="描述" />
          <Form.Input field="triggerEvent" label="触发事件" />
          <Form.Input field="terminationEvent" label="终止事件" />
          <Form.Select field="status" label="状态" initValue="DRAFT" optionList={[
            { value: 'ACTIVE', label: '生效' },
            { value: 'DRAFT', label: '草稿' },
          ]} />
        </Form>
      </Modal>

      <Modal title={editingStage ? '编辑阶段' : '新增阶段'} visible={stageModalOpen} onOk={handleStageSubmit} onCancel={() => { setStageModalOpen(false); setEditingStage(null); stageForm.reset(); }}>
        <Form form={stageForm}>
          <Form.Input field="name" label="阶段名称" rules={[{ required: true }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.InputNumber field="sortOrder" label="排序" style={{ width: '100%' }} />
          <Form.Select field="capabilityIds" label="关联能力" multiple optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))} />
          <Form.TagInput field="outputs" label="产出物" placeholder="输入产出物，按回车确认" separator={','} />
          <Form.Select field="participantRoleIds" label="参与角色" multiple optionList={roles.map((r) => ({ value: r.id, label: r.name }))} />
        </Form>
      </Modal>
    </div>
  );
}
