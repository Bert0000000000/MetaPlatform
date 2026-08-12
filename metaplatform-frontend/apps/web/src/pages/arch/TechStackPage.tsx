import { useEffect, useRef, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Toast, Popconfirm, Space, Typography, Row, Col } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Graph } from '@antv/x6';
import { listTechnologyStacks, createTechnologyStack, updateTechnologyStack, deleteTechnologyStack } from '@/api/arch/technologyStacks';
import { listTechnologyComponents } from '@/api/arch/technologyComponents';
import type { TechnologyStack, TechnologyComponent } from '@/api/arch/types';

const STATUS_MAP: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '活跃' },
  draft: { color: 'blue', label: '草稿' },
  archived: { color: 'grey', label: '已归档' },
};

const COMPONENT_COLORS: Record<string, string> = {
  database: '#1677ff',
  framework: '#722ed1',
  middleware: '#fa8c16',
  language: '#13c2c2',
  tool: '#2f54eb',
  infrastructure: '#eb2f96',
  other: '#8c8c8c',
};

const COMPONENT_TAG_COLORS: Record<string, TagColor> = {
  database: 'blue',
  framework: 'purple',
  middleware: 'orange',
  language: 'cyan',
  tool: 'indigo',
  infrastructure: 'pink',
  other: 'grey',
};

export default function TechStackPage() {
  const [stacks, setStacks] = useState<TechnologyStack[]>([]);
  const [components, setComponents] = useState<TechnologyComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TechnologyStack | null>(null);
  const [selectedStack, setSelectedStack] = useState<TechnologyStack | null>(null);
  const [form] = Form.useForm<Partial<TechnologyStack>>();
  const graphRef = useRef<Graph | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([listTechnologyStacks(), listTechnologyComponents()]);
    const stackItems = Array.isArray(s) ? s : ((s as { items?: TechnologyStack[] }).items ?? []);
    setStacks(stackItems);
    setComponents(Array.isArray(c) ? c : ((c as { items?: TechnologyComponent[] }).items ?? []));
    if (stackItems.length > 0 && !selectedStack) setSelectedStack(stackItems[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = new Graph({
      container: containerRef.current,
      width: containerRef.current.clientWidth,
      height: 360,
      grid: true,
      panning: true,
      mousewheel: true,
    });
    graphRef.current = graph;
    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        graphRef.current.resize(containerRef.current.clientWidth, 360);
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
    if (!selectedStack) return;

    const appNode = graph.addNode({
      id: `app-${selectedStack.id}`,
      x: 40,
      y: 160,
      width: 160,
      height: 48,
      label: selectedStack.name,
      attrs: { body: { fill: '#e6f7ff', stroke: '#1677ff', rx: 6, ry: 6 }, label: { fill: '#1677ff' } },
    });

    selectedStack.components?.forEach((ref, index) => {
      const comp = components.find((c) => c.id === ref.componentId);
      const type = comp?.type ?? ref.type ?? 'other';
      const color = COMPONENT_COLORS[type] ?? '#8c8c8c';
      const compNode = graph.addNode({
        id: `comp-${ref.componentId}-${index}`,
        x: 280 + (index % 3) * 180,
        y: 60 + Math.floor(index / 3) * 100,
        width: 150,
        height: 48,
        label: comp?.name ?? ref.componentName ?? ref.componentId,
        attrs: { body: { fill: '#f6ffed', stroke: color, rx: 6, ry: 6 }, label: { fill: color } },
      });
      graph.addEdge({
        source: appNode,
        target: compNode,
        attrs: { line: { stroke: '#bfbfbf', strokeWidth: 1.5 } },
      });
    });
  }, [selectedStack, components]);

  const handleSubmit = async () => {
    const values = await form.validate();
    if (editing) {
      await updateTechnologyStack(editing.id, values);
      Toast.success('更新成功');
    } else {
      await createTechnologyStack(values);
      Toast.success('创建成功');
    }
    setModalOpen(false);
    setEditing(null);
    form.reset();
    load();
  };

  const handleEdit = (record: TechnologyStack) => {
    setEditing(record);
    form.setValues({ ...record });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTechnologyStack(id);
    Toast.success('已删除');
    if (selectedStack?.id === id) setSelectedStack(null);
    load();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '应用ID', dataIndex: 'applicationId', key: 'applicationId' },
    { title: '组件数', key: 'componentCount', render: (_: unknown, r: TechnologyStack) => r.components?.length ?? 0 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: TechnologyStack) => (
      <Space>
        <Button theme="borderless" type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
        <Button theme="borderless" type="primary" size="small" onClick={() => setSelectedStack(r)}>查看图谱</Button>
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
          <Button theme="borderless" type="danger" size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <Typography.Title heading={4}>技术栈画像</Typography.Title>
      <Card>
        <Button theme="solid" type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.reset(); setModalOpen(true); }} style={{ marginBottom: 16 }}>新增技术栈</Button>
        <Table rowKey="id" columns={columns} dataSource={stacks ?? []} loading={loading} size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title={selectedStack ? `依赖关系图：${selectedStack.name}` : '依赖关系图'}>
            <div ref={containerRef} style={{ width: '100%', height: 360 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="组件清单">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(selectedStack?.components ?? []).map((ref, idx) => {
                const comp = components.find((c) => c.id === ref.componentId);
                return (
                  <div key={`${ref.componentId}-${idx}`} style={{ padding: '6px 0' }}>
                    <Space>
                      <Tag color={comp ? COMPONENT_TAG_COLORS[comp.type] ?? 'grey' : 'grey'}>{idx + 1}</Tag>
                      <span>{comp?.name ?? ref.componentName ?? ref.componentId}</span>
                      {ref.version && <Tag>{ref.version}</Tag>}
                    </Space>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal title={editing ? '编辑技术栈' : '新增技术栈'} visible={modalOpen} onOk={handleSubmit} onCancel={() => { setModalOpen(false); setEditing(null); form.reset(); }} width={640}>
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true }]} />
          <Form.Input field="applicationId" label="应用ID" placeholder="关联应用系统ID" />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Select field="status" label="状态" initValue="active" optionList={[
            { value: 'active', label: '活跃' },
            { value: 'draft', label: '草稿' },
            { value: 'archived', label: '已归档' },
          ]} />
        </Form>
      </Modal>
    </div>
  );
}
