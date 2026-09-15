import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Space, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createFlow,
  deleteFlow,
  listEntities,
  listFlows,
  updateFlow,
} from '@/api/arch/dataArchitecture';
import type { DataEntity, DataFlow } from '@/api/arch/types';
import { ForceGraph, type ForceGraphEdge, type ForceGraphNode } from '@/components/graph';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

const GRAPH_TYPES: Record<string, { label: string; color: string }> = {
  entity: { label: '数据实体', color: 'var(--semi-color-primary)' },
};

interface FlowDraft {
  id?: string;
  name: string;
  sourceEntityId: string;
  targetEntityId: string;
  flowType?: string;
  schedule?: string;
  description?: string;
}

interface RawFlow {
  id?: string;
  name?: string;
  code?: string;
  sourceEntityId?: string;
  source_entity_id?: string;
  targetEntityId?: string;
  target_entity_id?: string;
  flowType?: string;
  schedule?: string;
  description?: string;
}

/** 后端流字段为 snake_case（source_entity_id / target_entity_id），统一成前端类型。 */
function adaptFlow(raw: RawFlow): DataFlow {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    sourceEntityId: raw.sourceEntityId ?? raw.source_entity_id ?? '',
    targetEntityId: raw.targetEntityId ?? raw.target_entity_id ?? '',
    flowType: raw.flowType,
    schedule: raw.schedule,
    description: raw.description,
  };
}

/**
 * 数据流（DESIGN-SPEC §5 版式 F：图谱 + 列表）。
 * 数据面沿用 src/api/arch/dataArchitecture；实体关系图复用 @/components/graph 的 ForceGraph。
 */
export default function DataFlowPage() {
  const [entities, setEntities] = useState<DataEntity[]>([]);
  const [flows, setFlows] = useState<DataFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FlowDraft>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [entityRes, flowRes] = await Promise.allSettled([listEntities(), listFlows()]);
    setEntities(entityRes.status === 'fulfilled' ? (entityRes.value ?? []) : []);
    setFlows(flowRes.status === 'fulfilled' ? flowRes.value.map(adaptFlow) : []);
    if (flowRes.status === 'rejected') {
      setError(flowRes.reason instanceof Error ? flowRes.reason.message : String(flowRes.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const entityName = useCallback(
    (id: string) => entities.find((e) => e.id === id)?.name ?? id,
    [entities],
  );

  const openCreate = () => {
    setDraft({ name: '', sourceEntityId: '', targetEntityId: '' });
    form.reset();
  };

  const openEdit = (flow: DataFlow) => {
    setDraft({
      id: flow.id,
      name: flow.name,
      sourceEntityId: flow.sourceEntityId,
      targetEntityId: flow.targetEntityId,
      flowType: flow.flowType,
      schedule: flow.schedule,
      description: flow.description,
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: FlowDraft;
    try {
      values = (await form.validate()) as FlowDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await updateFlow(draft.id, values);
        Toast.success('数据流已更新');
      } else {
        await createFlow(values);
        Toast.success('数据流已创建');
      }
      setDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (flow: DataFlow) => {
    try {
      await deleteFlow(flow.id);
      Toast.success('数据流已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleFlows = useMemo(
    () =>
      keyword
        ? flows.filter(
            (f) =>
              f.name.toLowerCase().includes(keyword.toLowerCase()) ||
              entityName(f.sourceEntityId).toLowerCase().includes(keyword.toLowerCase()) ||
              entityName(f.targetEntityId).toLowerCase().includes(keyword.toLowerCase()),
          )
        : flows,
    [flows, keyword, entityName],
  );

  const graphData = useMemo(() => {
    const nodes: ForceGraphNode[] = entities.map((e) => ({ id: e.id, label: e.name, type: 'entity' }));
    const known = new Set(nodes.map((n) => n.id));
    const edges: ForceGraphEdge[] = flows
      .filter((f) => known.has(f.sourceEntityId) && known.has(f.targetEntityId))
      .map((f) => ({ source: f.sourceEntityId, target: f.targetEntityId, label: f.name }));
    return { nodes, edges };
  }, [entities, flows]);

  const columns = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        ellipsis: true,
        render: (v: string, row: DataFlow) => (
          <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
            {v}
          </Button>
        ),
      },
      {
        title: '源实体',
        dataIndex: '__source__',
        key: 'source',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: DataFlow) => entityName(row.sourceEntityId),
      },
      {
        title: '目标实体',
        dataIndex: '__target__',
        key: 'target',
        width: 180,
        ellipsis: true,
        render: (_: unknown, row: DataFlow) => entityName(row.targetEntityId),
      },
      {
        title: '流类型',
        dataIndex: 'flowType',
        key: 'flowType',
        width: 120,
        render: (v: string | undefined) => (v ? <Tag type="light">{v}</Tag> : '—'),
      },
      { title: '调度', dataIndex: 'schedule', key: 'schedule', width: 140, ellipsis: true },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: DataFlow) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该数据流？" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityName],
  );

  return (
    <>
      <PageHeader
        title="数据流"
        desc={`${flows.length} 条数据流 · ${entities.length} 个实体 · 维护实体间的数据流向`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新建数据流
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索数据流、实体…' }} />

      <Tabs type="button" activeKey={view} onChange={(k) => setView(k as 'list' | 'graph')}>
        <Tabs.TabPane itemKey="list" tab="数据流列表">
          <DataTablePro<DataFlow>
            columns={columns}
            dataSource={visibleFlows}
            rowKey="id"
            loading={loading}
            onRow={(record) => ({ onDoubleClick: () => openEdit(record as DataFlow) })}
            empty={
              error ? (
                <EmptyState illustration="failure" title="数据流加载失败" desc={error} />
              ) : (
                <EmptyState
                  illustration="no-content"
                  title="还没有数据流"
                  desc="新建第一条数据流后，这里会显示实体间的流向。"
                />
              )
            }
          />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="graph" tab="数据流图谱">
          {graphData.nodes.length > 0 ? (
            <ForceGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              types={GRAPH_TYPES}
              showEdgeLabels
              height={560}
            />
          ) : (
            <EmptyState
              illustration={error ? 'failure' : 'no-content'}
              title={error ? '数据流图谱加载失败' : '暂无可视化数据'}
              desc={error || '先登记数据实体，再新建数据流。'}
            />
          )}
        </Tabs.TabPane>
      </Tabs>

      <SheetDetail
        title={draft?.id ? '编辑数据流' : '新建数据流'}
        open={draft !== null}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {draft ? (
          <Form form={form} key={draft.id ?? 'new'} initValues={draft} labelPosition="top">
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Select
              field="sourceEntityId"
              label="源实体"
              optionList={entities.map((e) => ({ label: e.name, value: e.id }))}
              rules={[{ required: true, message: '请选择源实体' }]}
            />
            <Form.Select
              field="targetEntityId"
              label="目标实体"
              optionList={entities.map((e) => ({ label: e.name, value: e.id }))}
              rules={[{ required: true, message: '请选择目标实体' }]}
            />
            <Form.Select
              field="flowType"
              label="流类型"
              showClear
              optionList={['REALTIME', 'BATCH', 'STREAM'].map((t) => ({ label: t, value: t }))}
            />
            <Form.Input field="schedule" label="调度" placeholder="如 @hourly" />
            <Form.TextArea field="description" label="描述" rows={2} />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
