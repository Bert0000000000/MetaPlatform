import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  createPrinciple,
  createPrincipleCategory,
  deletePrinciple,
  deletePrincipleCategory,
  listPrincipleCategories,
  listPrinciples,
  updatePrinciple,
  updatePrincipleCategory,
} from '@/api/arch/governance';
import type { Principle, PrincipleCategory } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

const PRIORITY_TAG: Record<string, { color: TagColor; label: string }> = {
  HIGH: { color: 'red', label: '高' },
  MEDIUM: { color: 'orange', label: '中' },
  LOW: { color: 'blue', label: '低' },
};

const STATUS_TAG: Record<string, { color: TagColor; label: string }> = {
  ACTIVE: { color: 'green', label: '生效' },
  INACTIVE: { color: 'grey', label: '停用' },
};

/**
 * 治理 · 架构原则与标准（/governance/principles、/governance/principle-categories）。
 * 两段式：原则台账（含标准清单）在上，原则分类在下；新建/编辑走右侧非模态浮层。
 */
export default function PrinciplesPage() {
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [categories, setCategories] = useState<PrincipleCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [principleKeyword, setPrincipleKeyword] = useState('');
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [categoryKeyword, setCategoryKeyword] = useState('');
  const [principlePage, setPrinciplePage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPrinciplePage(1);
    setCategoryPage(1);
  }, []);

  const [principleDraftOpen, setPrincipleDraftOpen] = useState(false);
  const [editingPrinciple, setEditingPrinciple] = useState<Principle | null>(null);
  const [categoryDraftOpen, setCategoryDraftOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PrincipleCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Principle | null>(null);
  const [principleForm] = Form.useForm<Partial<Principle>>();
  const [categoryForm] = Form.useForm<Partial<PrincipleCategory>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, c] = await Promise.all([listPrinciples(), listPrincipleCategories()]);
      setPrinciples(p ?? []);
      setCategories(c ?? []);
    } catch (e) {
      setPrinciples([]);
      setCategories([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrinciplePage(1);
  }, [principleKeyword, priority]);
  useEffect(() => {
    setCategoryPage(1);
  }, [categoryKeyword]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredPrinciples = useMemo(
    () =>
      principles.filter((p) => {
        const kw = principleKeyword.toLowerCase();
        const matchKeyword = principleKeyword
          ? `${p.name} ${p.code} ${p.categoryName ?? ''}`.toLowerCase().includes(kw)
          : true;
        const matchPriority = priority ? p.priority === priority : true;
        return matchKeyword && matchPriority;
      }),
    [principles, principleKeyword, priority],
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        categoryKeyword ? `${c.name} ${c.code}`.toLowerCase().includes(categoryKeyword.toLowerCase()) : true,
      ),
    [categories, categoryKeyword],
  );

  const pagedPrinciples = useMemo(
    () => filteredPrinciples.slice((principlePage - 1) * pageSize, principlePage * pageSize),
    [filteredPrinciples, principlePage, pageSize],
  );
  const pagedCategories = useMemo(
    () => filteredCategories.slice((categoryPage - 1) * pageSize, categoryPage * pageSize),
    [filteredCategories, categoryPage, pageSize],
  );

  const openCreatePrinciple = () => {
    setEditingPrinciple(null);
    principleForm.reset();
    setPrincipleDraftOpen(true);
  };

  const openEditPrinciple = (record: Principle) => {
    setEditingPrinciple(record);
    principleForm.setValues({
      ...record,
      standards: Array.isArray(record.standards) ? record.standards.join('\n') : '',
    } as unknown as Partial<Principle>);
    setPrincipleDraftOpen(true);
  };

  const submitPrinciple = async () => {
    setSaving(true);
    try {
      const values = await principleForm.validate();
      const standards =
        typeof values.standards === 'string'
          ? (values.standards as string).split('\n').filter(Boolean)
          : values.standards || [];
      const payload = { ...values, standards };
      if (editingPrinciple) {
        await updatePrinciple(editingPrinciple.id, payload);
        Toast.success('已更新');
      } else {
        await createPrinciple(payload);
        Toast.success('已创建');
      }
      setPrincipleDraftOpen(false);
      setEditingPrinciple(null);
      principleForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removePrinciple = async (id: string) => {
    try {
      await deletePrinciple(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    categoryForm.reset();
    setCategoryDraftOpen(true);
  };

  const openEditCategory = (record: PrincipleCategory) => {
    setEditingCategory(record);
    categoryForm.setValues(record);
    setCategoryDraftOpen(true);
  };

  const submitCategory = async () => {
    setSaving(true);
    try {
      const values = await categoryForm.validate();
      if (editingCategory) {
        await updatePrincipleCategory(editingCategory.id, values);
        Toast.success('已更新');
      } else {
        await createPrincipleCategory(values);
        Toast.success('已创建');
      }
      setCategoryDraftOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await deletePrincipleCategory(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const principleColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: '编码', dataIndex: 'code', key: 'code', width: 140, ellipsis: true },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 160,
      ellipsis: true,
      render: (v: string | undefined, row: Principle) =>
        v || (row.categoryId ? categoryMap.get(row.categoryId)?.name : undefined) || '—',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p: string) => (
        <Tag color={PRIORITY_TAG[p]?.color ?? 'grey'} type="light">
          {PRIORITY_TAG[p]?.label ?? p}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={STATUS_TAG[s]?.color ?? 'grey'} type="light">
          {STATUS_TAG[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '标准数',
      dataIndex: '__standardCount__',
      key: '__standardCount__',
      width: 90,
      render: (_: unknown, row: Principle) => row.standards?.length ?? 0,
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 220,
      render: (_: unknown, row: Principle) => (
        <>
          <Button theme="borderless" type="primary" size="small" onClick={() => setDetail(row)}>
            查看
          </Button>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Pencil size={14} strokeWidth={1.5} />}
            onClick={() => openEditPrinciple(row)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该原则？"
            content="删除操作会写入审计日志。"
            onConfirm={() => void removePrinciple(row.id)}
          >
            <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  const categoryColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: '编码', dataIndex: 'code', key: 'code', width: 150, ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 90 },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '',
      dataIndex: '__actions__',
      key: '__actions__',
      width: 150,
      render: (_: unknown, row: PrincipleCategory) => (
        <>
          <Button
            theme="borderless"
            type="primary"
            size="small"
            icon={<Pencil size={14} strokeWidth={1.5} />}
            onClick={() => openEditCategory(row)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该分类？"
            content="删除操作会写入审计日志。"
            onConfirm={() => void removeCategory(row.id)}
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
        title="架构原则与标准"
        desc={`${principles.length} 条原则 · ${categories.length} 个分类 · 约束架构决策的硬性准则`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreatePrinciple}>
              新增原则
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: principleKeyword, onChange: setPrincipleKeyword, placeholder: '搜索原则名称、编码…' }}
        filters={
          <Select
            value={priority ?? ''}
            onChange={(v) => setPriority(v ? String(v) : undefined)}
            placeholder="全部优先级"
          >
            <Select.Option value="">全部优先级</Select.Option>
            {(Object.keys(PRIORITY_TAG) as string[]).map((p) => (
              <Select.Option key={p} value={p}>
                {PRIORITY_TAG[p].label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<Principle>
        columns={principleColumns}
        dataSource={pagedPrinciples}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: principlePage,
          pageSize,
          total: filteredPrinciples.length,
          onChange: setPrinciplePage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="架构原则加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无架构原则"
              desc="登记约束架构决策的原则与标准。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreatePrinciple}>
                  新增原则
                </Button>
              }
            />
          )
        }
      />

      <Typography.Title heading={6}>原则分类</Typography.Title>

      <FilterBar
        search={{ value: categoryKeyword, onChange: setCategoryKeyword, placeholder: '搜索分类名称、编码…' }}
        right={
          <Button icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreateCategory}>
            新增分类
          </Button>
        }
      />

      <DataTablePro<PrincipleCategory>
        columns={categoryColumns}
        dataSource={pagedCategories}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: categoryPage,
          pageSize,
          total: filteredCategories.length,
          onChange: setCategoryPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="原则分类加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无原则分类"
              desc="用分类对架构原则进行分组。"
              actions={
                <Button theme="solid" type="primary" onClick={openCreateCategory}>
                  新增分类
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title={detail ? `原则 · ${detail.name}` : '原则详情'}
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          <div>
            {detail.description ? <Typography.Paragraph>{detail.description}</Typography.Paragraph> : null}
            <div>
              <Typography.Text strong>标准清单</Typography.Text>
              {(detail.standards ?? []).length === 0 ? (
                <Typography.Text type="tertiary">该原则暂未登记标准。</Typography.Text>
              ) : (
                (detail.standards ?? []).map((s, idx) => (
                  <Typography.Paragraph key={`${idx}-${s.slice(0, 8)}`}>• {s}</Typography.Paragraph>
                ))
              )}
            </div>
          </div>
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={editingPrinciple ? `编辑原则 · ${editingPrinciple.name}` : '新增原则'}
        open={principleDraftOpen}
        onClose={() => {
          setPrincipleDraftOpen(false);
          setEditingPrinciple(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setPrincipleDraftOpen(false);
                setEditingPrinciple(null);
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitPrinciple()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={principleForm} labelPosition="left" labelWidth={92}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="服务自治" />
          <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="PRIN-AUTONOMY" />
          <Form.Select
            field="categoryId"
            label="分类"
            showClear
            placeholder="选择原则分类"
            optionList={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Select
            field="priority"
            label="优先级"
            initValue="MEDIUM"
            optionList={[
              { value: 'HIGH', label: '高' },
              { value: 'MEDIUM', label: '中' },
              { value: 'LOW', label: '低' },
            ]}
          />
          <Form.Select
            field="status"
            label="状态"
            initValue="ACTIVE"
            optionList={[
              { value: 'ACTIVE', label: '生效' },
              { value: 'INACTIVE', label: '停用' },
            ]}
          />
          <Form.TextArea field="standards" label="标准" rows={4} placeholder={'每行一条标准\n示例：服务必须自带健康检查端点'} />
        </Form>
      </SheetDetail>

      <SheetDetail
        title={editingCategory ? `编辑分类 · ${editingCategory.name}` : '新增分类'}
        open={categoryDraftOpen}
        onClose={() => {
          setCategoryDraftOpen(false);
          setEditingCategory(null);
        }}
        footer={
          <>
            <Button
              onClick={() => {
                setCategoryDraftOpen(false);
                setEditingCategory(null);
              }}
            >
              取消
            </Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitCategory()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={categoryForm} labelPosition="left" labelWidth={72}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="设计原则" />
          <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="DESIGN" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.InputNumber field="sortOrder" label="排序" initValue={0} />
        </Form>
      </SheetDetail>
    </>
  );
}
