import { useEffect, useRef, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Space, Typography, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Graph } from '@antv/x6';
import { listDeploymentTopologies, createDeploymentTopology, updateDeploymentTopology, deleteDeploymentTopology } from '@/api/deployments';
import type { DeploymentTopology, DeploymentNode, DeploymentEdge } from '@/types';

const ENV_OPTIONS = [
  { value: 'dev', label: '开发环境' },
  { value: 'test', label: '测试环境' },
  { value: 'staging', label: '预发环境' },
  { value: 'prod', label: '生产环境' },
];

const HEALTH_MAP: Record<string, { color: string; label: string }> = {
  healthy: { color: 'green', label: '健康' },
  warning: { color: 'orange', label: '告警' },
  critical: { color: 'red', label: '严重' },
};

const NODE_COLORS: Record<string, string> = {
  gateway: '#1677ff',
  service: '#52c41a',
  database: '#722ed1',
  cache: '#fa8c16',
  message: '#13c2c2',
  default: '#8c8c8c',
};

export default function DeploymentTopologyPage() {
  const [topologies, setTopologies] = useState<DeploymentTopology[]>([]);
  const [filteredEnv, setFilteredEnv] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeploymentTopology | null>(null);
  const [selectedTopology, setSelectedTopology] = useState<DeploymentTopology | null>(null);
  const [form] = Form.useForm<Partial<DeploymentTopology>>();
  const graphRef = useRef<Graph | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listDeploymentTopologies(filteredEnv === 'all' ? undefined : filteredEnv);
    setTopologies(data);
    if (data.length > 0 && !selectedTopology) setSelectedTopology(data[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filteredEnv]);

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = new Graph({
      container: containerRef.current,
      width: containerRef.current.clientWidth,
      height: 480,
      grid: true,
      panning: true,
      mousewheel: true,
    });
    graphRef.current = graph;
    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        graphRef.current.resize(containerRef.current.clientWidth, 480);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      graph.dispose();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.clearCells();
    if (!selectedTopology) return;

    const nodeMap = new Map<string, ReturnType<typeof graph.addNode>>();
    selectedTopology.nodes?.forEach((node) => {
      const color = NODE_COLORS[node.type ?? 'default'] ?? NODE_COLORS.default;
      const added = graph.addNode({
        id: node.id,
        x: node.x ?? 100 + Math.random() * 400,
        y: node.y ?? 100 + Math.random() * 200,
        width: 140,
        height: 48,
        label: node.name,
        attrs: { body: { fill: '#f0f5ff', stroke: color, rx: 6, ry: 6 }, label: { fill: color } },
      });
      nodeMap.set(node.id, added);
    });

    selectedTopology.edges?.forEach((edge) => {
      graph.addEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        attrs: { line: { stroke: edge.status === 'critical' ? '#ff4d4f' : '#bfbfbf', strokeWidth: 1.5 } },
      });
    });
  }, [selectedTopology]);

  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text || '[]');
    } catch {
      return [];
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      nodes: parseJson(values.nodes as unknown as string) as DeploymentNode[],
      edges: parseJson(values.edges as unknown as string) as DeploymentEdge[],
    };
    if (editing) {
      await updateDeploymentTopology(editing.id, payload);
      message.success('更新成功');
    } else {
      await createDeploymentTopology(payload);
      message.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    load();
  };

  const handleEdit = (record: DeploymentTopology) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      nodes: JSON.stringify(record.nodes ?? [], null, 2),
      edges: JSON.stringify(record.edges ?? [], null, 2),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteDeploymentTopology(id);
    message.success('已删除');
    if (selectedTopology?.id === id) setSelectedTopology(null);
    load();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '环境', dataIndex: 'environment', key: 'environment', render: (e: string) => ENV_OPTIONS.find((o) => o.value === e)?.label ?? e },
    { title: '节点数', key: 'nodeCount', render: (_: unknown, r: DeploymentTopology) => r.nodes?.length ?? 0 },
    { title: '健康状态', dataIndex: 'healthStatus', key: 'healthStatus', render: (s: string) => <Tag color={HEALTH_MAP[s]?.color}>{HEALTH_MAP[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: DeploymentTopology) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Button type="link" size="small" onClick={() => setSelectedTopology(r)}>查看拓扑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <Typography.Title level={4}>部署拓扑可视化</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新增拓扑</Button>
          <Select value={filteredEnv} onChange={setFilteredEnv} style={{ width: 160 }} options={[{ value: 'all', label: '全部环境' }, ...ENV_OPTIONS]} />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={topologies} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title={selectedTopology ? `部署拓扑：${selectedTopology.name}（${ENV_OPTIONS.find((o) => o.value === selectedTopology.environment)?.label ?? selectedTopology.environment}）` : '部署拓扑'}>
            <div ref={containerRef} style={{ width: '100%', height: 480 }} />
          </Card>
        </Col>
      </Row>

      <Modal title={editing ? '编辑部署拓扑' : '新增部署拓扑'} open={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="environment" label="环境" rules={[{ required: true }]} initialValue="dev">
            <Select options={ENV_OPTIONS} />
          </Form.Item>
          <Form.Item name="healthStatus" label="健康状态" initialValue="healthy">
            <Select options={[
              { value: 'healthy', label: '健康' },
              { value: 'warning', label: '告警' },
              { value: 'critical', label: '严重' },
            ]} />
          </Form.Item>
          <Form.Item name="nodes" label="节点（JSON）" rules={[{ required: true }]} initialValue="[]">
            <Input.TextArea rows={6} placeholder='[{&quot;id&quot;:&quot;n1&quot;,&quot;name&quot;:&quot;Gateway&quot;,&quot;type&quot;:&quot;gateway&quot;,&quot;x&quot;:100,&quot;y&quot;:100}]' />
          </Form.Item>
          <Form.Item name="edges" label="连接（JSON）" rules={[{ required: true }]} initialValue="[]">
            <Input.TextArea rows={4} placeholder='[{&quot;id&quot;:&quot;e1&quot;,&quot;source&quot;:&quot;n1&quot;,&quot;target&quot;:&quot;n2&quot;,&quot;label&quot;:&quot;HTTP&quot;}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
