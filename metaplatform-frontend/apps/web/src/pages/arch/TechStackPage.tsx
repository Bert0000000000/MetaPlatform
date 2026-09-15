import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import SemiGraphCanvas, { type GraphNodeSpec, type GraphEdgeSpec } from '@/components/SemiGraphCanvas';
import {
  createTechnologyStack,
  deleteTechnologyStack,
  listTechnologyStacks,
  updateTechnologyStack,
} from '@/api/arch/technologyStacks';
import { listTechnologyComponents } from '@/api/arch/technologyComponents';
import type { TechnologyStack, TechnologyComponent } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}


const STATUS_MAP: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '活跃' },
  draft: { color: 'blue', label: '草稿' },
  archived: { color: 'grey', label: '已归档' },
};

const COMPONENT_COLORS: Record<string, string> = {
  database: 'var(--semi-color-primary)',
  framework: 'var(--semi-color-tertiary)',
  middleware: 'var(--semi-color-warning)',
  language: 'var(--semi-color-success)',
  tool: 'var(--semi-color-primary)',
  infrastructure: 'var(--semi-color-danger)',
  other: 'var(--semi-color-text-2)',
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

/** 运行时兼容：旧字段 components（ref 列表）/ 后端实际返回 component_ids（id 数组）。 */
type StackLike = TechnologyStack & { component_ids?: string[] };

function stackRefs(stack: TechnologyStack): Array<{ componentId: string; componentName?: string; version?: string; type?: string }> {
  if (stack.components?.length) return stack.components;
  return ((stack as StackLike).component_ids ?? []).map((cid) => ({ componentId: cid }));
}

/**
 * 技术架构 · 技术栈画像（/technology-stacks）。
 * 列表承载技术栈台账；「查看图谱」在右侧浮层内用 SemiGraphCanvas 渲染栈—组件依赖关系。
 */
export default function TechStackPage() {
  const [stacks, setStacks] = useState<TechnologyStack[]>([]);
  const [components, setComponents] = useState<TechnologyComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<TechnologyStack | null>(null);
  const [saving, setSaving] = useState(false);
  const [graphStack, setGraphStack] = useState<TechnologyStack | null>(null);
  const [form] = Form.useForm<Partial<TechnologyStack>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c] = await Promise.all([listTechnologyStacks(), listTechnologyComponents()]);
      setStacks(asItems<TechnologyStack>(s));
      setComponents(asItems<TechnologyComponent>(c));
    } catch (e) {
      setStacks([]);
      setComponents([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const filtered = useMemo(
    () =>
      stacks.filter((s) =>
        keyword ? `${s.name} ${s.applicationName ?? ''}`.toLowerCase().includes(keyword.toLowerCase()) : true,
      ),
    [stacks, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const { nodes, edges, worldWidth, worldHeight } = useMemo(() => {
    if (!graphStack) {
      return { nodes: [] as GraphNodeSpec[], edges: [] as GraphEdgeSpec[], worldWidth: 800, worldHeight: 360 };
    }
    const nodeSpecs: GraphNodeSpec[] = [
      { id: `app-${graphStack.id}`, x: 120, y: 184, w: 160, h: 48, label: graphStack.name, color: 'var(--semi-color-primary)' },
    ];
    const edgeSpecs: GraphEdgeSpec[] = [];
    const refs = stackRefs(graphStack);
    refs.forEach((ref, index) => {
      const comp = components.find((c) => c.id === ref.componentId);
      const type = comp?.type ?? ref.type ?? 'other';
      const color = COMPONENT_COLORS[type] ?? COMPONENT_COLORS.other;
      const id = `comp-${ref.componentId}-${index}`;
      nodeSpecs.push({
        id,
        x: 280 + (index % 3) * 180 + 75,
        y: 60 + Math.floor(index / 3) * 100 + 24,
        w: 150,
        h: 48,
        label: comp?.name ?? ref.componentName ?? ref.componentId,
        color,
      });
      edgeSpecs.push({ source: `app-${graphStack.id}`, target: id });
    });
    const rows = Math.max(1, Math.ceil(refs.length / 3));
    return {
      nodes: nodeSpecs,
      edges: edgeSpecs,
      worldWidth: 280 + 3 * 180 + 40,
      worldHeight: 60 + rows * 100 + 60,
    };
  }, [graphStack, components]);

  const graphRefs = useMemo(() => (graphStack ? stackRefs(graphStack) : []), [graphStack]);

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (record: TechnologyStack) => {
    setEditing(record);
    form.setValues({ ...record });
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      if (editing) {
        await updateTechnologyStack(editing.id, values);
        Toast.success('已更新');
      } else {
        await createTechnologyStack(values);
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
      await deleteTechnologyStack(id);
      Toast.success('已删除');
      if (graphStack?.id === id) setGraphStack(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    {
      title: '应用',
      dataIndex: 'applicationName',
      key: 'applicationName',
      width: 160,
      ellipsis: true,
      render: (v: string | undefined, row: TechnologyStack) => v || row.applicationId || '—',
    },
    {
      title: '组件数',
      dataIndex: '__componentCount__',
      key: '__componentCount__',
      width: 110,
      render: (_: unknown, row: TechnologyStack) => stackRefs(row).length,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag size="small" color={STATUS_MAP[s]?.color ?? 'grey'} type="light">
          {STATUS_MAP[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 220,
      render: (_: unknown, row: TechnologyStack) => (
        <>
          <Button theme="borderless" type="primary" size="small" onClick={() => setGraphStack(row)}>
            查看图谱
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
            title="确认删除该技术栈？"
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
        title="技术栈画像"
        desc={`${stacks.length} 个技术栈 · 关联 ${components.length} 个技术组件`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增技术栈
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索技术栈名称、应用…' }} />

      <DataTablePro<TechnologyStack>
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
            <EmptyState illustration="failure" title="技术栈加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无技术栈"
              desc="登记应用所使用的技术栈及其组件构成。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增技术栈
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={graphStack ? `依赖关系图 · ${graphStack.name}` : '依赖关系图'}
        open={graphStack !== null}
        onClose={() => setGraphStack(null)}
        footer={<Button onClick={() => setGraphStack(null)}>关闭</Button>}
      >
        {graphStack ? (
          <>
            <SemiGraphCanvas
              nodes={nodes}
              edges={edges}
              worldWidth={worldWidth}
              worldHeight={worldHeight}
              height={360}
              autoFit
              showGrid
            />
            <div>
              <Typography.Text strong>组件清单</Typography.Text>
              {graphRefs.length === 0 ? (
                <EmptyState illustration="no-content" title="该技术栈未关联组件" desc="编辑技术栈并补充组件引用。" />
              ) : (
                graphRefs.map((ref, idx) => {
                  const comp = components.find((c) => c.id === ref.componentId);
                  const type = comp?.type ?? ref.type ?? 'other';
                  return (
                    <div key={`${ref.componentId}-${idx}`}>
                      <Tag color={COMPONENT_TAG_COLORS[type] ?? 'grey'} type="light">
                        {idx + 1}
                      </Tag>{' '}
                      {comp?.name ?? ref.componentName ?? ref.componentId}
                      {ref.version ? <Tag type="light">{ref.version}</Tag> : null}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editing ? `编辑技术栈 · ${editing.name}` : '新增技术栈'}
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
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="Web 应用技术栈" />
          <Form.Input field="applicationId" label="应用 ID" placeholder="关联应用系统 ID" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Select
            field="status"
            label="状态"
            initValue="active"
            optionList={[
              { value: 'active', label: '活跃' },
              { value: 'draft', label: '草稿' },
              { value: 'archived', label: '已归档' },
            ]}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
