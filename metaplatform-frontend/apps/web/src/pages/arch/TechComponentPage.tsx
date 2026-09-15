import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  createTechnologyComponent,
  deleteTechnologyComponent,
  listTechnologyComponents,
  updateTechnologyComponent,
} from '@/api/arch/technologyComponents';
import type { TechnologyComponent } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}


const COMPONENT_TYPES: { value: TechnologyComponent['type']; label: string; color: TagColor }[] = [
  { value: 'database', label: '数据库', color: 'blue' },
  { value: 'framework', label: '框架', color: 'purple' },
  { value: 'middleware', label: '中间件', color: 'orange' },
  { value: 'language', label: '语言', color: 'cyan' },
  { value: 'tool', label: '工具', color: 'indigo' },
  { value: 'infrastructure', label: '基础设施', color: 'pink' },
  { value: 'other', label: '其他', color: 'grey' },
];

const STATUS_MAP: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '活跃' },
  deprecated: { color: 'red', label: '已废弃' },
  planned: { color: 'yellow', label: '规划中' },
};

/**
 * 技术架构 · 技术组件库（/technology-components）。
 * 按类型服务端筛选，行内编辑走右侧非模态浮层。
 */
export default function TechComponentPage() {
  const [components, setComponents] = useState<TechnologyComponent[]>([]);
  const [filteredType, setFilteredType] = useState<TechnologyComponent['type'] | undefined>(undefined);
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
  const [editing, setEditing] = useState<TechnologyComponent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<Partial<TechnologyComponent>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listTechnologyComponents(filteredType);
      setComponents(asItems<TechnologyComponent>(data));
    } catch (e) {
      setComponents([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filteredType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, filteredType]);

  const filtered = useMemo(
    () =>
      components.filter((c) =>
        keyword ? `${c.name} ${c.owner ?? ''} ${c.version ?? ''}`.toLowerCase().includes(keyword.toLowerCase()) : true,
      ),
    [components, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (record: TechnologyComponent) => {
    setEditing(record);
    form.setValues({ ...record });
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      if (editing) {
        await updateTechnologyComponent(editing.id, values);
        Toast.success('已更新');
      } else {
        await createTechnologyComponent(values);
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
      await deleteTechnologyComponent(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (t: TechnologyComponent['type']) => {
        const item = COMPONENT_TYPES.find((c) => c.value === t);
        return (
          <Tag color={item?.color ?? 'grey'} type="light">
            {item?.label ?? t}
          </Tag>
        );
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 110,
      render: (v?: string) => v || '—',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '责任人',
      dataIndex: 'owner',
      key: 'owner',
      width: 140,
      render: (v?: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => (
        <Tag color={STATUS_MAP[s]?.color ?? 'grey'} type="light">
          {STATUS_MAP[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 150,
      render: (_: unknown, row: TechnologyComponent) => (
        <>
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
            title="确认删除该组件？"
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
        title="技术组件库"
        desc={`${components.length} 个组件 · 统一登记技术组件的类型、版本与责任人`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增组件
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索组件名称、责任人…' }}
        filters={
          <Select
            value={filteredType ?? ''}
            onChange={(v) => setFilteredType(v ? (String(v) as TechnologyComponent['type']) : undefined)}
            placeholder="全部类型"
          >
            <Select.Option value="">全部类型</Select.Option>
            {COMPONENT_TYPES.map((t) => (
              <Select.Option key={t.value} value={t.value}>
                {t.label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<TechnologyComponent>
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
            <EmptyState illustration="failure" title="技术组件加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无技术组件"
              desc="登记数据库、框架、中间件等组件并指定责任人。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增组件
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={editing ? `编辑组件 · ${editing.name}` : '新增技术组件'}
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
        <Form form={form} labelPosition="left" labelWidth={72}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="PostgreSQL" />
          <Form.Select
            field="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
            optionList={COMPONENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Form.Input field="version" label="版本" placeholder="16.3" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Input field="owner" label="责任人" placeholder="平台组" />
          <Form.Select
            field="status"
            label="状态"
            initValue="active"
            optionList={[
              { value: 'active', label: '活跃' },
              { value: 'deprecated', label: '已废弃' },
              { value: 'planned', label: '规划中' },
            ]}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
