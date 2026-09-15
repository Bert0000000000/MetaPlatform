import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Popconfirm, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import {
  createInfrastructure,
  createTechStack,
  deleteInfrastructure,
  deleteTechStack,
  listInfrastructure,
  listTechStacks,
} from '@/api/arch/techArchitecture';
import type { Infrastructure, TechStack } from '@/api/arch/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';

const PAGE_SIZE = 10;

/** 后端列表接口可能返回裸数组或 {items:[...]} 信封；统一解包。 */
function asItems<T>(res: T[] | { items?: T[] } | null | undefined): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}

const STACK_STATUS: Record<string, { color: TagColor; label: string }> = {
  adopted: { color: 'green', label: '已采纳' },
  trial: { color: 'blue', label: '试用' },
  deprecated: { color: 'grey', label: '已废弃' },
};

const INFRA_STATUS: Record<string, { color: TagColor; label: string }> = {
  active: { color: 'green', label: '运行中' },
  maintenance: { color: 'orange', label: '维护中' },
  offline: { color: 'grey', label: '离线' },
};

/**
 * 技术架构 · 技术栈与基础设施台账。
 * 两条数据面（/tech-stacks、/infrastructures）各自独立列表，页头统一，编辑走右侧非模态浮层。
 */
export default function TechArchPage() {
  const [stacks, setStacks] = useState<TechStack[]>([]);
  const [infra, setInfra] = useState<Infrastructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [stackKeyword, setStackKeyword] = useState('');
  const [infraKeyword, setInfraKeyword] = useState('');
  const [stackPage, setStackPage] = useState(1);
  const [infraPage, setInfraPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [stackDraftOpen, setStackDraftOpen] = useState(false);
  const [infraDraftOpen, setInfraDraftOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stackForm] = Form.useForm<Partial<TechStack>>();
  const [infraForm] = Form.useForm<Partial<Infrastructure>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, i] = await Promise.all([listTechStacks(), listInfrastructure()]);
      setStacks(asItems<TechStack>(s));
      setInfra(asItems<Infrastructure>(i));
    } catch (e) {
      setStacks([]);
      setInfra([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setStackPage(1);
  }, [stackKeyword]);
  useEffect(() => {
    setInfraPage(1);
  }, [infraKeyword]);

  const filteredStacks = useMemo(
    () =>
      stacks.filter((s) =>
        stackKeyword
          ? `${s.name} ${s.category} ${s.version ?? ''}`.toLowerCase().includes(stackKeyword.toLowerCase())
          : true,
      ),
    [stacks, stackKeyword],
  );

  const filteredInfra = useMemo(
    () =>
      infra.filter((i) =>
        infraKeyword
          ? `${i.name} ${i.type} ${i.spec ?? ''}`.toLowerCase().includes(infraKeyword.toLowerCase())
          : true,
      ),
    [infra, infraKeyword],
  );

  const pagedStacks = useMemo(
    () => filteredStacks.slice((stackPage - 1) * pageSize, stackPage * pageSize),
    [filteredStacks, stackPage, pageSize],
  );
  const pagedInfra = useMemo(
    () => filteredInfra.slice((infraPage - 1) * pageSize, infraPage * pageSize),
    [filteredInfra, infraPage, pageSize],
  );

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setStackPage(1);
    setInfraPage(1);
  }, []);

  const openStackDraft = () => {
    stackForm.reset();
    setStackDraftOpen(true);
  };

  const submitStack = async () => {
    setSaving(true);
    try {
      const values = await stackForm.validate();
      await createTechStack(values);
      Toast.success('技术栈已创建');
      setStackDraftOpen(false);
      stackForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeStack = async (id: string) => {
    try {
      await deleteTechStack(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openInfraDraft = () => {
    infraForm.reset();
    setInfraDraftOpen(true);
  };

  const submitInfra = async () => {
    setSaving(true);
    try {
      const values = await infraForm.validate();
      await createInfrastructure(values);
      Toast.success('基础设施已创建');
      setInfraDraftOpen(false);
      infraForm.reset();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeInfra = async (id: string) => {
    try {
      await deleteInfrastructure(id);
      Toast.success('已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const stackColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category', width: 160, ellipsis: true },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (v?: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => (
        <Tag size="small" color={STACK_STATUS[s]?.color ?? 'grey'} type="light">
          {STACK_STATUS[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__stack_actions__',
      key: '__stack_actions__',
      width: 90,
      render: (_: unknown, row: TechStack) => (
        <Popconfirm
          title="确认删除该技术栈？"
          content="删除操作会写入审计日志。"
          onConfirm={() => void removeStack(row.id)}
        >
          <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const infraColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 160, ellipsis: true },
    {
      title: '规格',
      dataIndex: 'spec',
      key: 'spec',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => (
        <Tag size="small" color={INFRA_STATUS[s]?.color ?? 'grey'} type="light">
          {INFRA_STATUS[s]?.label ?? s}
        </Tag>
      ),
    },
    {
      title: '',
      dataIndex: '__infra_actions__',
      key: '__infra_actions__',
      width: 90,
      render: (_: unknown, row: Infrastructure) => (
        <Popconfirm
          title="确认删除该基础设施？"
          content="删除操作会写入审计日志。"
          onConfirm={() => void removeInfra(row.id)}
        >
          <Button theme="borderless" type="danger" size="small" icon={<Trash2 size={14} strokeWidth={1.5} />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="技术架构"
        desc={`${stacks.length} 项技术栈 · ${infra.length} 项基础设施 · 技术选型与运行底座台账`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={openStackDraft}
            >
              新增技术栈
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: stackKeyword, onChange: setStackKeyword, placeholder: '搜索技术栈名称、分类…' }}
      />

      <DataTablePro<TechStack>
        columns={stackColumns}
        dataSource={pagedStacks}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: stackPage,
          pageSize,
          total: filteredStacks.length,
          onChange: setStackPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="技术栈加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无技术栈"
              desc="登记团队采纳的框架、数据库与中间件版本。"
              actions={
                <Button theme="solid" type="primary" onClick={openStackDraft}>
                  新增技术栈
                </Button>
              }
            />
          )
        }
      />

      <Typography.Title heading={6}>基础设施</Typography.Title>

      <FilterBar search={{ value: infraKeyword, onChange: setInfraKeyword, placeholder: '搜索基础设施名称、类型…' }} />

      <DataTablePro<Infrastructure>
        columns={infraColumns}
        dataSource={pagedInfra}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: infraPage,
          pageSize,
          total: filteredInfra.length,
          onChange: setInfraPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        empty={
          error ? (
            <EmptyState illustration="failure" title="基础设施加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-content"
              title="暂无基础设施"
              desc="登记网关、消息、缓存等运行底座。"
              actions={
                <Button theme="solid" type="primary" onClick={openInfraDraft}>
                  新增基础设施
                </Button>
              }
            />
          )
        }
      />

      <SheetDetail
        title="新增技术栈"
        open={stackDraftOpen}
        onClose={() => setStackDraftOpen(false)}
        footer={
          <>
            <Button onClick={() => setStackDraftOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitStack()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={stackForm} labelPosition="left" labelWidth={72}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="Spring Boot" />
          <Form.Input field="category" label="分类" rules={[{ required: true, message: '请输入分类' }]} placeholder="后端框架" />
          <Form.Input field="version" label="版本" placeholder="3.3" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Select
            field="status"
            label="状态"
            initValue="trial"
            optionList={[
              { value: 'adopted', label: '已采纳' },
              { value: 'trial', label: '试用' },
              { value: 'deprecated', label: '已废弃' },
            ]}
          />
        </Form>
      </SheetDetail>

      <SheetDetail
        title="新增基础设施"
        open={infraDraftOpen}
        onClose={() => setInfraDraftOpen(false)}
        footer={
          <>
            <Button onClick={() => setInfraDraftOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submitInfra()}>
              保存
            </Button>
          </>
        }
      >
        <Form form={infraForm} labelPosition="left" labelWidth={72}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="Kafka" />
          <Form.Input field="type" label="类型" rules={[{ required: true, message: '请输入类型' }]} placeholder="消息队列" />
          <Form.Input field="spec" label="规格" placeholder="3 broker / 16C32G" />
          <Form.TextArea field="description" label="描述" rows={2} placeholder="选填" />
          <Form.Select
            field="status"
            label="状态"
            initValue="active"
            optionList={[
              { value: 'active', label: '运行中' },
              { value: 'maintenance', label: '维护中' },
              { value: 'offline', label: '离线' },
            ]}
          />
        </Form>
      </SheetDetail>
    </>
  );
}
