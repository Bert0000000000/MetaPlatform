import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import {
  createDeploymentTopology,
  deleteDeploymentTopology,
  listDeploymentTopologies,
  updateDeploymentTopology,
} from '@/api/arch/deployments';
import type { DeploymentTopology, DeploymentNode, DeploymentEdge } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}


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
  gateway: 'var(--semi-color-primary)',
  service: 'var(--semi-color-success)',
  database: 'var(--semi-color-tertiary)',
  cache: 'var(--semi-color-warning)',
  message: 'var(--semi-color-primary)',
  default: 'var(--semi-color-text-2)',
};

const envLabel = (value: string) => ENV_OPTIONS.find((o) => o.value === value)?.label ?? value;

/**
 * 技术架构 · 部署拓扑（/deployments）。
 * 列表承载环境拓扑；「查看拓扑」在右侧浮层内渲染 SemiGraphCanvas 拓扑图。
 */
export default function DeploymentTopologyPage() {
  const [topologies, setTopologies] = useState<DeploymentTopology[]>([]);
  const [filteredEnv, setFilteredEnv] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<DeploymentTopology | null>(null);
  const [saving, setSaving] = useState(false);
  const [graphTopology, setGraphTopology] = useState<DeploymentTopology | null>(null);
  const [form] = Form.useForm<DeploymentTopologyFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listDeploymentTopologies(filteredEnv);
      setTopologies(asItems<DeploymentTopology>(data));
    } catch (e) {
      setTopologies([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filteredEnv]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, filteredEnv]);

  const filtered = useMemo(
    () => topologies.filter((t) => (keyword ? t.name.toLowerCase().includes(keyword.toLowerCase()) : true)),
    [topologies, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    if (!graphTopology?.nodes?.length) {
      return { nodes: [] as GraphNodeSpec[], edges: [] as GraphEdgeSpec[], worldWidth: 800, worldHeight: 480 };
    }
    const nodeSpecs: GraphNodeSpec[] = graphTopology.nodes.map((node) => ({
      id: node.id,
      x: node.x ?? 100 + ((node.id.charCodeAt(0) * 37) % 400),
      y: node.y ?? 100 + ((node.id.charCodeAt(1) * 53) % 200),
      w: 140,
      h: 48,
      label: node.name,
      color: NODE_COLORS[node.type ?? 'default'] ?? NODE_COLORS.default,
    }));
    const edgeSpecs: GraphEdgeSpec[] = (graphTopology.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      color: edge.status === 'critical' ? 'var(--semi-color-danger)' : undefined,
      width: 1.5,
    }));
    const maxX = Math.max(240, ...nodeSpecs.map((n) => n.x + 100));
    const maxY = Math.max(200, ...nodeSpecs.map((n) => n.y + 80));
    return { nodes: nodeSpecs, edges: edgeSpecs, worldWidth: maxX + 40, worldHeight: maxY + 40 };
  }, [graphTopology]);

  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text || '[]');
    } catch {
      return [];
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (record: DeploymentTopology) => {
    setEditing(record);
    form.setValues({
      name: record.name,
      environment: record.environment,
      healthStatus: record.healthStatus,
      nodes: JSON.stringify(record.nodes ?? [], null, 2),
      edges: JSON.stringify(record.edges ?? [], null, 2),
    });
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
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
        Toast.success('已更新');
      } else {
        await createDeploymentTopology(payload);
        Toast.success('已创建');
      }
      setDraftOpen(false);
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDeploymentTopology(id);
      Toast.success('已删除');
      if (graphTopology?.id === id) setGraphTopology(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 240, ellipsis: true },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 130,
      render: (e: string) => envLabel(e),
    },
    {
      title: '节点数',
      dataIndex: '__nodeCount__',
      key: '__nodeCount__',
      width: 110,
      render: (_: unknown, row: DeploymentTopology) => row.nodes?.length ?? 0,
    },
    {
      title: '健康状态',
      dataIndex: 'healthStatus',
      key: 'healthStatus',
      width: 120,
      render: (s: string) => (
        <Tag color={HEALTH_MAP[s]?.color ?? 'grey'} type="light">
          {HEALTH_MAP[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 220,
      render: (_: unknown, row: DeploymentTopology) => (
        <>
          <Button theme="borderless" type="primary" size="small" onClick={() => setGraphTopology(row)}>
            查看拓扑
          </Button>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Pencil size={14} strokeWidth={1.5} />}
            onClick={() => openEdit(row)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该拓扑？"
            content="删除操作会写入审计日志。"
            onConfirm={() => void remove(row.id)}
          >
            <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="部署拓扑"
        desc={`${topologies.length} 份拓扑 · 按环境记录节点与连接关系`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增拓扑
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索拓扑名称…' }}
        filters={
          <Select
            value={filteredEnv ?? ''}
            onChange={(v) => setFilteredEnv(v ? String(v) : undefined)}
            placeholder="全部环境"
          >
            <Select.Option value="">全部环境</Select.Option>
            {ENV_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<DeploymentTopology>
        columns={columns}
        dataSource={paged}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="部署拓扑加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无部署拓扑"
              desc="按环境登记服务节点与调用关系。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增拓扑
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={graphTopology ? `部署拓扑 · ${graphTopology.name}（${envLabel(graphTopology.environment)}）` : '部署拓扑'}
        open={graphTopology !== null}
        onClose={() => setGraphTopology(null)}
        width="var(--mp-sheet-w)"
        footer={<Button onClick={() => setGraphTopology(null)}>关闭</Button>}
      >
        {graphTopology ? (
          graphTopology.nodes?.length ? (
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
            <EmptyState
              illustration="no-content"
              title="该拓扑未定义节点"
              desc="编辑拓扑并填入节点 JSON 后即可可视化。"
            />
          )
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editing ? `编辑部署拓扑 · ${editing.name}` : '新增部署拓扑'}
        open={draftOpen}
        onClose={() => {
          setDraftOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setDraftOpen(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={form} labelPosition="left" labelWidth={88}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="生产环境拓扑" />
          <Form.Select field="environment" label="环境" rules={[{ required: true, message: '请选择环境' }]} initValue="dev" optionList={ENV_OPTIONS} />
          <Form.Select
            field="healthStatus"
            label="健康状态"
            initValue="healthy"
            optionList={[
              { value: 'healthy', label: '健康' },
              { value: 'warning', label: '告警' },
              { value: 'critical', label: '严重' },
            ]}
          />
          <Form.TextArea
            field="nodes"
            label="节点（JSON）"
            rules={[{ required: true, message: '请输入节点 JSON' }]}
            initValue="[]"
            rows={6}
            placeholder='[{"id":"n1","name":"Gateway","type":"gateway","x":100,"y":100}]'
          />
          <Form.TextArea
            field="edges"
            label="连接（JSON）"
            rules={[{ required: true, message: '请输入连接 JSON' }]}
            initValue="[]"
            rows={4}
            placeholder='[{"id":"e1","source":"n1","target":"n2","label":"HTTP"}]'
          />
        </Form>
      </SheetDetail>
    </>
  );
}
