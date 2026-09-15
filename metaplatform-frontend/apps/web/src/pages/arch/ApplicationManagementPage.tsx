import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Space, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from '@/api/arch/applications';
import { listCapabilities } from '@/api/arch/capabilities';
import type { ArchApplication, ArchAppCreateRequest, Capability } from '@/api/arch/types';
import { ForceGraph, type ForceGraphEdge, type ForceGraphNode } from '@/components/graph';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

const STATUS_META: Record<ArchApplication['status'], { label: string; color: 'green' | 'grey' | 'blue' }> = {
  active: { label: '运行中', color: 'green' },
  deprecated: { label: '已废弃', color: 'grey' },
  planned: { label: '规划中', color: 'blue' },
};

const GRAPH_TYPES: Record<string, { label: string; color: string }> = {
  active: { label: '运行中', color: 'var(--semi-color-success)' },
  planned: { label: '规划中', color: 'var(--semi-color-primary)' },
  deprecated: { label: '已废弃', color: 'var(--semi-color-text-3)' },
};

interface AppDraft extends ArchAppCreateRequest {
  appId?: string;
}

/** 后端字段命名可能是 camelCase / snake_case / 简写 id，统一成前端类型。 */
interface RawNamed {
  id?: string;
  appId?: string;
  capabilityId?: string;
  name?: string;
  code?: string;
  description?: string;
  category?: string;
  owner?: string;
  status?: string;
  capabilityIds?: string[];
  dependencyAppIds?: string[];
}

function adaptApp(raw: RawNamed): ArchApplication {
  return {
    appId: raw.appId ?? raw.id ?? '',
    name: raw.name ?? '',
    code: raw.code ?? '',
    description: raw.description || undefined,
    status: (raw.status as ArchApplication['status']) ?? ('active' as ArchApplication['status']),
    technologyStack: undefined,
    owner: raw.owner,
    capabilityIds: raw.capabilityIds ?? [],
    dependencyAppIds: raw.dependencyAppIds ?? [],
  };
}

function adaptCapabilityRef(raw: RawNamed): Capability {
  return {
    capabilityId: raw.capabilityId ?? raw.id ?? '',
    name: raw.name ?? '',
    code: raw.code ?? '',
    level: 0,
    status: (raw.status as Capability['status']) ?? ('' as Capability['status']),
  };
}

function unwrap<T>(raw: unknown, adapt: (r: RawNamed) => T): T[] {
  const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] } | null)?.items ?? []);
  return items.map((i) => adapt(i as RawNamed));
}

/**
 * 应用系统（DESIGN-SPEC §5 版式 E + F：表格页 + 依赖拓扑）。
 * 数据面沿用 src/api/arch/applications，依赖关系取自 dependencyAppIds。
 */
export default function ApplicationManagementPage() {
  const [apps, setApps] = useState<ArchApplication[]>([]);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [draft, setDraft] = useState<AppDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ArchAppCreateRequest>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [appRes, capRes] = await Promise.allSettled([listApplications(), listCapabilities()]);
    setApps(appRes.status === 'fulfilled' ? unwrap(appRes.value, adaptApp) : []);
    setCaps(capRes.status === 'fulfilled' ? unwrap(capRes.value, adaptCapabilityRef) : []);
    if (appRes.status === 'rejected') {
      setError(appRes.reason instanceof Error ? appRes.reason.message : String(appRes.reason));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const capName = useCallback(
    (id: string) => caps.find((c) => c.capabilityId === id)?.name ?? id,
    [caps],
  );

  const openCreate = () => {
    setDraft({ name: '', code: '', status: 'active' });
    form.reset();
  };

  const openEdit = (app: ArchApplication) => {
    setDraft({
      appId: app.appId,
      name: app.name,
      code: app.code,
      description: app.description,
      status: app.status,
      technologyStack: app.technologyStack,
      owner: app.owner,
      capabilityIds: app.capabilityIds ?? [],
      dependencyAppIds: app.dependencyAppIds ?? [],
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: ArchAppCreateRequest;
    try {
      values = (await form.validate()) as ArchAppCreateRequest;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (draft.appId) {
        await updateApplication(draft.appId, values);
        Toast.success('应用已更新');
      } else {
        await createApplication(values);
        Toast.success('应用已注册');
      }
      setDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (app: ArchApplication) => {
    try {
      await deleteApplication(app.appId);
      Toast.success('应用已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const visibleApps = useMemo(
    () =>
      keyword
        ? apps.filter(
            (a) =>
              a.name.toLowerCase().includes(keyword.toLowerCase()) ||
              a.code.toLowerCase().includes(keyword.toLowerCase()),
          )
        : apps,
    [apps, keyword],
  );

  const graphData = useMemo(() => {
    const nodes: ForceGraphNode[] = apps.map((a) => ({ id: a.appId, label: a.name, type: a.status }));
    const known = new Set(nodes.map((n) => n.id));
    const edges: ForceGraphEdge[] = [];
    for (const a of apps) {
      for (const dep of a.dependencyAppIds ?? []) {
        if (known.has(dep)) edges.push({ source: a.appId, target: dep, label: '依赖' });
      }
    }
    return { nodes, edges };
  }, [apps]);

  const columns = useMemo(
    () => [
      { title: '应用名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
      { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
      { title: '技术栈', dataIndex: 'technologyStack', key: 'technologyStack', width: 180, ellipsis: true },
      { title: '负责人', dataIndex: 'owner', key: 'owner', width: 140, ellipsis: true },
      {
        title: '关联能力',
        dataIndex: '__capabilities__',
        key: 'capabilities',
        width: 260,
        render: (_: unknown, row: ArchApplication) => (
          <Space>
            {(row.capabilityIds ?? []).slice(0, 3).map((id) => (
              <Tag size="small" key={id} type="light">
                {capName(id)}
              </Tag>
            ))}
            {(row.capabilityIds ?? []).length > 3 ? (
              <Tag size="small" type="light">+{row.capabilityIds.length - 3}</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (v: ArchApplication['status']) => (
          <Tag size="small" color={STATUS_META[v]?.color ?? 'grey'} type="light">
            {STATUS_META[v]?.label ?? v}
          </Tag>
        ),
      },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 140,
        render: (_: unknown, row: ArchApplication) => (
          <Space>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该应用？" content="删除后依赖它的应用将失去依赖项。" onConfirm={() => void remove(row)}>
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capName],
  );

  return (
    <>
      <PageHeader
        title="应用系统"
        desc={`${apps.length} 个应用 · 注册应用并维护能力关联与依赖拓扑`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              注册应用
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索应用名称、编码…' }} />

      <Tabs type="button" activeKey={view} onChange={(k) => setView(k as 'list' | 'graph')}>
        <Tabs.TabPane itemKey="list" tab="应用列表">
          <DataTablePro<ArchApplication>
            columns={columns}
            dataSource={visibleApps}
            rowKey="appId"
            loading={loading}
            onRow={(record) => ({ onDoubleClick: () => openEdit(record as ArchApplication) })}
            empty={
              error ? (
                <EmptyState illustration="failure" title="应用列表加载失败" desc={error} />
              ) : (
                <EmptyState
                  illustration="no-result"
                  title="没有匹配的应用"
                  desc="调整关键词，或注册第一个应用系统。"
                />
              )
            }
          />
        </Tabs.TabPane>

        <Tabs.TabPane itemKey="graph" tab="依赖拓扑">
          {graphData.edges.length > 0 ? (
            <ForceGraph nodes={graphData.nodes} edges={graphData.edges} types={GRAPH_TYPES} height={560} />
          ) : (
            <EmptyState
              illustration={error ? 'failure' : 'no-content'}
              title={error ? '依赖拓扑加载失败' : '暂无依赖关系'}
              desc={error || '在应用编辑里选择「依赖应用」后，这里会生成拓扑图。'}
            />
          )}
        </Tabs.TabPane>
      </Tabs>

      <SheetDetail
        title={draft?.appId ? `编辑应用 · ${draft.name}` : '注册应用'}
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
          <Form form={form} key={draft.appId ?? 'new'} initValues={draft} labelPosition="top">
            <Form.Input field="name" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]} />
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.TextArea field="description" label="描述" rows={2} />
            <Form.Input field="technologyStack" label="技术栈" />
            <Form.Input field="owner" label="负责人" />
            <Form.Select
              field="capabilityIds"
              label="关联能力"
              multiple
              placeholder="选择关联的业务能力"
              optionList={caps.map((c) => ({ value: c.capabilityId, label: c.name }))}
            />
            <Form.Select
              field="dependencyAppIds"
              label="依赖应用"
              multiple
              placeholder="选择依赖的应用"
              optionList={apps
                .filter((a) => a.appId !== draft.appId)
                .map((a) => ({ value: a.appId, label: a.name }))}
            />
            <Form.Select
              field="status"
              label="状态"
              optionList={[
                { value: 'active', label: '运行中' },
                { value: 'planned', label: '规划中' },
                { value: 'deprecated', label: '已废弃' },
              ]}
            />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
