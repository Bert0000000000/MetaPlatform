import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Space, Typography, Row, Col } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import { listDeploymentTopologies, createDeploymentTopology, updateDeploymentTopology, deleteDeploymentTopology } from '@/api/arch/deployments';
import type { DeploymentTopology, DeploymentNode, DeploymentEdge } from '@/api/arch/types';

interface DeploymentTopologyFormValues {
  name: string;
  environment: 'dev' | 'test' | 'staging' | 'prod';
  healthStatus: 'healthy' | 'warning' | 'critical';
  nodes: string;
  edges: string;
}

const ENV_OPTIONS = [
  { value: 'dev', label: '开发环境' },
  { value: 'test', label: '测试环境' },
  { value: 'staging', label: '预发环境' },
  { value: 'prod', label: '生产环境' },
];

const HEALTH_MAP: Record<string, { color: TagColor; label: string }> = {
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
  const [form] = Form.useForm<DeploymentTopologyFormValues>();

  const load = async () => {
    setLoading(true);
    const data = await listDeploymentTopologies(filteredEnv === 'all' ? undefined : filteredEnv);
    const items = Array.isArray(data) ? data : ((data as { items?: DeploymentTopology[] }).items ?? []);
    setTopologies(items);
    if (items.length > 0 && !selectedTopology) setSelectedTopology(items[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filteredEnv]);

  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    if (!selectedTopology?.nodes) return { nodes: [] as GraphNodeSpec[], edges: [] as GraphEdgeSpec[], worldWidth: 800, worldHeight: 480 };
    const nodeSpecs: GraphNodeSpec[] = selectedTopology.nodes.map((node) => {
      const color = NODE_COLORS[node.type ?? 'default'] ?? NODE_COLORS.default;
      return {
        id: node.id,
        x: node.x ?? 100 + ((node.id.charCodeAt(0) * 37) % 400),
        y: node.y ?? 100 + ((node.id.charCodeAt(1) * 53) % 200),
        w: 140, h: 48,
        label: node.name,
        color,
      };
    });
    const edgeSpecs: GraphEdgeSpec[] = (selectedTopology.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      color: edge.status === 'critical' ? '#ff4d4f' : undefined,
      width: 1.5,
    }));
    const maxX = Math.max(240, ...nodeSpecs.map((n) => n.x + 100));
    const maxY = Math.max(200, ...nodeSpecs.map((n) => n.y + 80));
    return { nodes: nodeSpecs, edges: edgeSpecs, worldWidth: maxX + 40, worldHeight: maxY + 40 };
  }, [selectedTopology]);

  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text || '[]');
    } catch {
      return [];
    }
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    const payload = {
      name: values.name,
      environment: values.environment,
      healthStatus: values.healthStatus,
      nodes: parseJson(values.nodes) as DeploymentNode[],
      edges: parseJson(values.edges) as DeploymentEdge[],
    };
    if (editing) {
      await updateDeploymentTopology(editing.id, payload);
      Toast.success('更新成功');
    } else {
      await createDeploymentTopology(payload);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const handleEdit = (record: DeploymentTopology) => {
    setEditing(record);
    form.setValues({
      name: record.name,
      environment: record.environment,
      healthStatus: record.healthStatus,
      nodes: JSON.stringify(record.nodes ?? [], null, 2),
      edges: JSON.stringify(record.edges ?? [], null, 2),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteDeploymentTopology(id);
    Toast.success('已删除');
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
        <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Button theme="borderless" type="primary" size="small" onClick={() => setSelectedTopology(r)}>查看拓扑</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <Typography.Title heading={4}>部署拓扑可视化</Typography.Title>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }}>新增拓扑</Button>
          <Select value={filteredEnv} onChange={(v) => setFilteredEnv(v as string)} style={{ width: 160 }} optionList={[{ value: 'all', label: '全部环境' }, ...ENV_OPTIONS]} />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={topologies ?? []} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title={selectedTopology ? `部署拓扑：${selectedTopology.name}（${ENV_OPTIONS.find((o) => o.value === selectedTopology.environment)?.label ?? selectedTopology.environment}）` : '部署拓扑'}>
            {selectedTopology && (selectedTopology.nodes?.length ?? 0) > 0 ? (
              <SemiGraphCanvas
                nodes={nodes}
                edges={edges}
                worldWidth={worldWidth}
                worldHeight={worldHeight}
                height={480}
                autoFit
                showGrid
              />
            ) : (
              <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)', fontSize: 13, border: '1px dashed var(--semi-color-border)', borderRadius: 8 }}>
                {selectedTopology ? '该拓扑未定义节点（编辑拓扑并填入节点 JSON 后即可可视化）' : '选择一条拓扑记录查看可视化'}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal title={editing ? '编辑部署拓扑' : '新增部署拓扑'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }} width={720}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Select field="environment" label="环境" rules={[{ required: true }]} initValue="dev" optionList={ENV_OPTIONS} />
          <Form.Select field="healthStatus" label="健康状态" initValue="healthy" optionList={[
            { value: 'healthy', label: '健康' },
            { value: 'warning', label: '告警' },
            { value: 'critical', label: '严重' },
          ]} />
          <Form.TextArea field="nodes" label="节点（JSON）" rules={[{ required: true }]} initValue="[]" rows={6} placeholder='[{&quot;id&quot;:&quot;n1&quot;,&quot;name&quot;:&quot;Gateway&quot;,&quot;type&quot;:&quot;gateway&quot;,&quot;x&quot;:100,&quot;y&quot;:100}]' />
          <Form.TextArea field="edges" label="连接（JSON）" rules={[{ required: true }]} initValue="[]" rows={4} placeholder='[{&quot;id&quot;:&quot;e1&quot;,&quot;source&quot;:&quot;n1&quot;,&quot;target&quot;:&quot;n2&quot;,&quot;label&quot;:&quot;HTTP&quot;}]' />
        </Form>
      </Modal>
    </div>
  );
}
