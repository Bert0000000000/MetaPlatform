import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Space, Modal, Form, Input, Select, Toast, Popconfirm } from '@douyinfe/semi-ui';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import { listEntities, listFlows, createFlow, updateFlow, deleteFlow } from '@/api/arch/dataArchitecture';
import type { DataEntity, DataFlow } from '@/api/arch/types';

export default function DataFlowPage() {
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [flows, setFlows] = useState<DataFlow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<DataFlow | null>(null);
  const [form] = Form.useForm<Partial<DataFlow>>();

  const load = async () => {
    const [e, f] = await Promise.all([listEntities(), listFlows()]);
    setEntities(e);
    setFlows(f);
  };

  useEffect(() => { load(); }, []);

  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    const nodeWidth = 180;
    const nodeHeight = 80;
    const cols = 4;
    const nodeSpecs: GraphNodeSpec[] = entities.map((entity, index) => ({
      id: entity.id,
      x: 40 + (index % cols) * (nodeWidth + 40) + nodeWidth / 2,
      y: 40 + Math.floor(index / cols) * (nodeHeight + 60) + nodeHeight / 2,
      w: nodeWidth, h: nodeHeight,
      label: entity.name,
      sublabel: entity.code,
      color: '#1677ff',
    }));
    const edgeSpecs: GraphEdgeSpec[] = flows
      .filter((flow) => entities.find((e) => e.id === flow.sourceEntityId) && entities.find((e) => e.id === flow.targetEntityId))
      .map((flow) => ({
        id: flow.id,
        source: flow.sourceEntityId,
        target: flow.targetEntityId,
        label: flow.name,
        color: '#1677ff',
        width: 2,
      }));
    const rows = Math.max(1, Math.ceil(Math.max(entities.length, 1) / cols));
    return {
      nodes: nodeSpecs,
      edges: edgeSpecs,
      worldWidth: cols * (nodeWidth + 40) + 40,
      worldHeight: rows * (nodeHeight + 60) + 40,
    };
  }, [entities, flows]);

  const openCreate = () => {
    setEditingFlow(null);
    form.reset();
    setModalOpen(true);
  };

  const openEdit = (flow: DataFlow) => {
    setEditingFlow(flow);
    form.setValues(flow);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editingFlow) {
      await updateFlow(editingFlow.id, values);
      Toast.success('更新成功');
    } else {
      await createFlow(values);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    form.reset();
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteFlow(id);
    Toast.success('已删除');
    load();
  };

  return (
    <Card
      title="数据流可视化"
      headerExtraContent={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建数据流</Button>
        </Space>
      }
    >
      <SemiGraphCanvas
        nodes={nodes}
        edges={edges}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        height={600}
        autoFit
        showGrid
      />
      <div style={{ marginTop: 16 }}>
        {flows.map((flow) => (
          <Button key={flow.id} theme="borderless" type="primary" onClick={() => openEdit(flow)}>
            {flow.name}
          </Button>
        ))}
      </div>

      <Modal title={editingFlow ? '编辑数据流' : '新建数据流'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.reset(); }}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select field="sourceEntityId" label="源实体" rules={[{ required: true }]} optionList={entities.map((e) => ({ label: e.name, value: e.id }))} />
          <Form.Select field="targetEntityId" label="目标实体" rules={[{ required: true }]} optionList={entities.map((e) => ({ label: e.name, value: e.id }))} />
          <Form.Select field="flowType" label="流类型" showClear optionList={['REALTIME', 'BATCH', 'STREAM'].map((t) => ({ label: t, value: t }))} />
          <Form.Input field="schedule" label="调度" placeholder="如 @hourly" />
          <Form.TextArea field="description" label="描述" rows={2} />
        </Form>
        {editingFlow && (
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(editingFlow.id)}>
            <Button theme="outline" type="danger" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        )}
      </Modal>
    </Card>
  );
}
