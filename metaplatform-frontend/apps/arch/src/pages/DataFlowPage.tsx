import { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { Graph } from '@antv/x6';
import { listEntities, listFlows, createFlow, updateFlow, deleteFlow } from '@/api/dataArchitecture';
import type { DataEntity, DataFlow } from '@/types';

export default function DataFlowPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
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

  useEffect(() => {
    if (!containerRef.current || entities.length === 0) return;
    if (graphRef.current) {
      graphRef.current.dispose();
    }

    const graph = new Graph({
      container: containerRef.current,
      width: containerRef.current.clientWidth,
      height: 600,
      grid: true,
      panning: true,
      mousewheel: true,
    });
    graphRef.current = graph;

    const nodeWidth = 180;
    const nodeHeight = 80;
    const cols = Math.max(1, Math.floor((containerRef.current.clientWidth - 40) / (nodeWidth + 40)));

    entities.forEach((entity, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      graph.addNode({
        id: entity.id,
        x: 40 + col * (nodeWidth + 40),
        y: 40 + row * (nodeHeight + 60),
        width: nodeWidth,
        height: nodeHeight,
        shape: 'rect',
        label: `${entity.name}\n${entity.code}`,
        attrs: {
          body: { fill: '#e6f4ff', stroke: '#1677ff', rx: 8, ry: 8 },
          label: { fill: '#1f1f1f', fontSize: 12, whiteSpace: 'pre-wrap' },
        },
      });
    });

    flows.forEach((flow) => {
      if (entities.find((e) => e.id === flow.sourceEntityId) && entities.find((e) => e.id === flow.targetEntityId)) {
        graph.addEdge({
          id: flow.id,
          source: flow.sourceEntityId,
          target: flow.targetEntityId,
          label: flow.name,
          attrs: {
            line: { stroke: '#1677ff', strokeWidth: 2, targetMarker: { name: 'classic', size: 8 } },
            label: { fill: '#1677ff', fontSize: 11 },
          },
        });
      }
    });

    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        graphRef.current.resize(containerRef.current.clientWidth, 600);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      graph.dispose();
    };
  }, [entities, flows]);

  const openCreate = () => {
    setEditingFlow(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (flow: DataFlow) => {
    setEditingFlow(flow);
    form.setFieldsValue(flow);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editingFlow) {
      await updateFlow(editingFlow.id, values);
      message.success('更新成功');
    } else {
      await createFlow(values);
      message.success('创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteFlow(id);
    message.success('已删除');
    load();
  };

  return (
    <Card
      title="数据流可视化"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建数据流</Button>
        </Space>
      }
    >
      <div ref={containerRef} style={{ width: '100%', height: 600, border: '1px solid #f0f0f0' }} />
      <div style={{ marginTop: 16 }}>
        {flows.map((flow) => (
          <Button key={flow.id} type="link" onClick={() => openEdit(flow)}>
            {flow.name}
          </Button>
        ))}
      </div>

      <Modal title={editingFlow ? '编辑数据流' : '新建数据流'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); form.resetFields(); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sourceEntityId" label="源实体" rules={[{ required: true }]}>
            <Select options={entities.map((e) => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="targetEntityId" label="目标实体" rules={[{ required: true }]}>
            <Select options={entities.map((e) => ({ label: e.name, value: e.id }))} />
          </Form.Item>
          <Form.Item name="flowType" label="流类型">
            <Select options={['REALTIME', 'BATCH', 'STREAM'].map((t) => ({ label: t, value: t }))} allowClear />
          </Form.Item>
          <Form.Item name="schedule" label="调度"><Input placeholder="如 @hourly" /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
        {editingFlow && (
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(editingFlow.id)}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        )}
      </Modal>
    </Card>
  );
}
