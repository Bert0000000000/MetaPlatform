import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Space, Tabs, Tag, Toast, Tree } from '@douyinfe/semi-ui';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createCapability,
  deleteCapability,
  getCapabilityTree,
  listCapabilities,
  updateCapability,
} from '@/api/arch/capabilities';
import type { Capability, CapabilityCreateRequest } from '@/api/arch/types';
import { ForceGraph, type ForceGraphEdge, type ForceGraphNode } from '@/components/graph';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
  SplitPane,
} from '@/components/skeleton';

const STATUS_META: Record<Capability['status'], { label: string; color: 'green' | 'grey' | 'blue' }> = {
  active: { label: '生效', color: 'green' },
  deprecated: { label: '废弃', color: 'grey' },
  planned: { label: '规划中', color: 'blue' },
};

const GRAPH_TYPES: Record<string, { label: string; color: string }> = {
  active: { label: '生效', color: 'var(--semi-color-success)' },
  planned: { label: '规划中', color: 'var(--semi-color-primary)' },
  deprecated: { label: '废弃', color: 'var(--semi-color-text-3)' },
};

interface CapabilityDraft extends CapabilityCreateRequest {
  capabilityId?: string;
}

/** 后端字段命名可能是 camelCase / snake_case / 简写 id，统一成 Capability。 */
interface RawCapability {
  id?: string;
  capabilityId?: string;
  capability_id?: string;
  parent_id?: string;
  parentCapabilityId?: string;
  name?: string;
  code?: string;
  description?: string;
  level?: number;
  status?: string;
}

function adaptCapability(raw: RawCapability): Capability {
  return {
    capabilityId: raw.capabilityId ?? raw.capability_id ?? raw.id ?? '',
    name: raw.name ?? '',
    code: raw.code ?? '',
    description: raw.description || undefined,
    level: raw.level ?? 0,
    parentCapabilityId: raw.parentCapabilityId || raw.parent_id || undefined,
    // 后端未返回 status 时留空，由列渲染成 '—'，不臆造状态。
    status: (raw.status as Capability['status']) ?? ('' as Capability['status']),
  };
}

/** 能力列表可能返回裸数组或 PageResponse，统一成 Capability[]。 */
function capList(raw: unknown): Capability[] {
  const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] } | null)?.items ?? []);
  return items.map((i) => adaptCapability(i as RawCapability));
}

function buildTreeData(caps: Capability[]): TreeNodeData[] {
  const visited = new Set<string>();
  const build = (parentId: string): TreeNodeData[] =>
    caps
      .filter((c) => (c.parentCapabilityId ?? '') === parentId && !visited.has(c.capabilityId))
      .map((c) => {
        visited.add(c.capabilityId);
        return {
          key: c.capabilityId,
          label: `${c.name}（${c.code}）`,
          children: build(c.capabilityId),
        };
      });
  return caps
    .filter((c) => !c.parentCapabilityId && !visited.has(c.capabilityId))
    .map((c) => {
      visited.add(c.capabilityId);
      return { key: c.capabilityId, label: `${c.name}（${c.code}）`, children: build(c.capabilityId) };
    });
}

/**
 * 业务能力（DESIGN-SPEC §5 版式 B + F：左树右表 + 图谱视图）。
 * 数据面沿用 src/api/arch/capabilities：listCapabilities 列表、getCapabilityTree 树兜底。
 */
export default function CapabilityManagementPage() {
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [draft, setDraft] = useState<CapabilityDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CapabilityCreateRequest>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [listRes, treeRes] = await Promise.allSettled([
      listCapabilities(keyword ? { keyword } : undefined),
      getCapabilityTree(),
    ]);
    const listItems = listRes.status === 'fulfilled' ? capList(listRes.value) : [];
    const treeItems =
      treeRes.status === 'fulfilled' ? capList(treeRes.value) : [];
    setCaps(listItems.length > 0 ? listItems : treeItems);
    if (listRes.status === 'rejected' && treeRes.status === 'rejected') {
      setError(
        listRes.reason instanceof Error ? listRes.reason.message : String(listRes.reason),
      );
    }
    setLoading(false);
  }, [keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setDraft({ name: '', code: '', status: 'active' });
    form.reset();
  };

  const openEdit = (cap: Capability) => {
    setDraft({
      capabilityId: cap.capabilityId,
      name: cap.name,
      code: cap.code,
      description: cap.description,
      parentCapabilityId: cap.parentCapabilityId,
      status: cap.status,
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: CapabilityCreateRequest;
    try {
      values = (await form.validate()) as CapabilityCreateRequest;
    } catch {
      return; // 校验失败由表单内联提示
    }
    setSaving(true);
    try {
      if (draft.capabilityId) {
        await updateCapability(draft.capabilityId, values);
        Toast.success('能力已更新');
      } else {
        await createCapability(values);
        Toast.success('能力已创建');
      }
      setDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cap: Capability) => {
    try {
      await deleteCapability(cap.capabilityId);
      Toast.success('能力已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const filtered = useMemo(
    () =>
      selectedId
        ? caps.filter((c) => c.capabilityId === selectedId || c.parentCapabilityId === selectedId)
        : caps,
    [caps, selectedId],
  );

  const treeData = useMemo(() => buildTreeData(caps), [caps]);

  const graphData = useMemo(() => {
    const nodes: ForceGraphNode[] = caps.map((c) => ({
      id: c.capabilityId,
      label: c.name,
      type: c.status,
    }));
    const known = new Set(nodes.map((n) => n.id));
    const edges: ForceGraphEdge[] = caps
      .filter((c) => c.parentCapabilityId && known.has(c.parentCapabilityId))
      .map((c) => ({ source: c.parentCapabilityId as string, target: c.capabilityId, label: '包含' }));
    return { nodes, edges };
  }, [caps]);

  const columns = useMemo(
    () => [
      { title: '能力名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      { title: '层级', dataIndex: 'level', key: 'level', width: 90 },
      {
        title: '父能力',
        dataIndex: 'parentName',
        key: 'parentName',
        width: 180,
        ellipsis: true,
        render: (v: string | undefined) => v || '—',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: Capability['status']) =>
          v ? (
            <Tag color={STATUS_META[v]?.color ?? 'grey'} type="light">
              {STATUS_META[v]?.label ?? v}
            </Tag>
          ) : (
            '—'
          ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: Capability) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该能力？" content="删除后其子能力将失去父级。" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <PageHeader
        title="业务能力"
        desc={`${caps.length} 个能力 · 左树定位，右侧维护层级与状态`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增能力
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索能力名称、编码…' }}
        filters={
          <Select
            value={selectedId ?? ''}
            onChange={(v) => setSelectedId(v ? String(v) : undefined)}
            placeholder="全部层级范围"
          >
            <Select.Option value="">全部能力</Select.Option>
            {caps
              .filter((c) => !c.parentCapabilityId)
              .map((c) => (
                <Select.Option key={c.capabilityId} value={c.capabilityId}>
                  {c.name} 及其子级
                </Select.Option>
              ))}
          </Select>
        }
      />

      <Tabs type="button" activeKey={view} onChange={(k) => setView(k as 'list' | 'graph')}>
        <Tabs.TabPane itemKey="list" tab="能力列表">
          <SplitPane
            ariaLabel="能力树"
            pane={
              <>
                <div className="mp-pane-title">能力树</div>
                <div className="mp-pane-scroll">
                  {treeData.length > 0 ? (
                    <Tree
                      treeData={treeData}
                      defaultExpandAll
                      onSelect={(key) => setSelectedId(key ? String(key) : undefined)}
                    />
                  ) : (
                    <EmptyState illustration="no-content" title="暂无能力层级" desc="新增第一个能力后这里会生成层级树。" />
                  )}
                </div>
              </>
            }
          >
            <DataTablePro<Capability>
              columns={columns}
              dataSource={filtered}
              rowKey="capabilityId"
              loading={loading}
              empty={
                error ? (
                  <EmptyState illustration="failure" title="能力列表加载失败" desc={error} />
                ) : (
                  <EmptyState
                    illustration="no-result"
                    title="没有匹配的能力"
                    desc="调整关键词或层级筛选，或新增一个能力。"
                  />
                )
              }
            />
          </SplitPane>
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="graph" tab="能力图谱">
          {graphData.nodes.length > 0 ? (
            <ForceGraph nodes={graphData.nodes} edges={graphData.edges} types={GRAPH_TYPES} height={560} />
          ) : (
            <EmptyState
              illustration={error ? 'failure' : 'no-content'}
              title={error ? '能力图谱加载失败' : '暂无可视化能力'}
              desc={error || '新增能力并设置父能力后，这里会生成层级关系图。'}
            />
          )}
        </Tabs.TabPane>
      </Tabs>

      <SheetDetail
        title={draft?.capabilityId ? '编辑能力' : '新增能力'}
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
          <Form
            form={form}
            key={draft.capabilityId ?? 'new'}
            initValues={draft}
            labelPosition="top"
          >
            <Form.Input field="name" label="能力名称" rules={[{ required: true, message: '请输入能力名称' }]} />
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.TextArea field="description" label="描述" rows={2} />
            <Form.Select
              field="parentCapabilityId"
              label="父能力"
              showClear
              placeholder="无（顶级能力）"
              optionList={caps
                .filter((c) => c.capabilityId !== draft.capabilityId)
                .map((c) => ({ value: c.capabilityId, label: c.name }))}
            />
            <Form.Select
              field="status"
              label="状态"
              optionList={[
                { value: 'active', label: '生效' },
                { value: 'planned', label: '规划中' },
                { value: 'deprecated', label: '废弃' },
              ]}
            />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
