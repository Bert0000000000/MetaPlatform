import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Tag, Toast } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createReviewTemplate,
  deleteReviewTemplate,
  listReviewTemplates,
  updateReviewTemplate,
} from '@/api/arch/governance';
import type { ReviewTemplate, ReviewDimension, ReviewExpert } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

const parseLines = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
};

const buildDimensions = (text: string): ReviewDimension[] =>
  parseLines(text).map((name) => ({ name, weight: 0, maxScore: 100 }));

const buildExperts = (text: string): ReviewExpert[] =>
  parseLines(text).map((line) => {
    const parts = line.split(',').map((s) => s.trim());
    return { userId: parts[0] || line, name: parts[1] || parts[0] || line, role: parts[2] };
  });

const dimensionsToText = (dimensions: ReviewDimension[] | undefined): string =>
  (dimensions || []).map((d) => d.name).join('\n');

const expertsToText = (experts: ReviewExpert[] | undefined): string =>
  (experts || []).map((e) => `${e.userId},${e.name}${e.role ? `,${e.role}` : ''}`).join('\n');

/**
 * 治理 · 评审模板与专家组（/governance/review-templates）。
 * 模板定义评审维度与专家组，新建/编辑走右侧非模态浮层。
 */
export default function ReviewTemplatePage() {
  const [list, setList] = useState<ReviewTemplate[]>([]);
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
  const [editing, setEditing] = useState<ReviewTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<Partial<ReviewTemplate>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listReviewTemplates();
      setList(res ?? []);
    } catch (e) {
      setList([]);
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
      list.filter((t) =>
        keyword ? `${t.name} ${t.code}`.toLowerCase().includes(keyword.toLowerCase()) : true,
      ),
    [list, keyword],
  );

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setDraftOpen(true);
  };

  const openEdit = (record: ReviewTemplate) => {
    setEditing(record);
    form.setValues({
      ...record,
      dimensions: dimensionsToText(record.dimensions),
      experts: expertsToText(record.experts),
    } as unknown as Partial<ReviewTemplate>);
    setDraftOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      const payload: Partial<ReviewTemplate> = {
        ...values,
        dimensions: buildDimensions(values.dimensions as unknown as string),
        experts: buildExperts(values.experts as unknown as string),
      };
      if (editing) {
        await updateReviewTemplate(editing.id, payload);
        Toast.success('已更新');
      } else {
        await createReviewTemplate(payload);
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
      await deleteReviewTemplate(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 220,
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '评审维度',
      dataIndex: '__dimensions__',
      key: '__dimensions__',
      width: 220,
      render: (_: unknown, row: ReviewTemplate) => (
        <span>
          {(row.dimensions || []).map((d, idx) => (
            <Tag key={`${d.name}-${idx}`} type="light">
              {d.name}
              {d.weight ? ` · 权重 ${d.weight}` : ''}
            </Tag>
          ))}
          {(row.dimensions || []).length === 0 ? '—' : null}
        </span>
      ),
    },
    {
      title: '专家组',
      dataIndex: '__experts__',
      key: '__experts__',
      width: 220,
      render: (_: unknown, row: ReviewTemplate) => (
        <span>
          {(row.experts || []).map((e, idx) => (
            <Tag key={`${e.userId}-${idx}`} type="light">
              {e.name}
              {e.role ? ` · ${e.role}` : ''}
            </Tag>
          ))}
          {(row.experts || []).length === 0 ? '—' : null}
        </span>
      ),
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 150,
      render: (_: unknown, row: ReviewTemplate) => (
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
            title="确认删除该模板？"
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
        title="评审模板与专家组"
        desc={`${list.length} 个模板 · 定义评审维度与专家构成`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新增模板
            </Button>
          </>
        }
      />

      <FilterBar search={{ value: keyword, onChange: setKeyword, placeholder: '搜索模板名称、编码…' }} />

      <DataTablePro<ReviewTemplate>
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
            <EmptyState illustration="failure" title="评审模板加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无评审模板"
              desc="定义评审维度与专家组，供评审工单引用。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreate}>
                  新增模板
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={editing ? `编辑评审模板 · ${editing.name}` : '新增评审模板'}
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
        <Form form={form} labelPosition="left" labelWidth={92}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="技术方案评审" />
          <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="TECH-REVIEW" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.TextArea field="dimensions" label="评审维度" rows={4} placeholder={'每行一个维度\n可扩展性\n可维护性\n安全性'} />
          <Form.TextArea
            field="experts"
            label="专家组"
            rows={4}
            placeholder={'每行：userId,姓名,角色\narch-1,张三,架构师\nsecurity-1,李四,安全专家'}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
