/**
 * KnowledgeBasePage —— 知识库列表（DESIGN-SPEC §5 版式 E：表格页 + 抽屉表单）。
 *
 * 数据面沿用 src/api/kb 的 listKb / createKb（本批不动）。
 * 表格只渲染后端 collections 接口真实给出的字段：编码 / 名称 / 类型 / 文档数 /
 * 状态 / 描述。切片数、向量模型、检索 P95、重建进度后端未暴露，故不建列（不编造）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Descriptions, Form, Select, SideSheet, Tag, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Database, Plus, RefreshCw } from 'lucide-react';
import { useAsync, useLoadingState, useApiErrorBoundary } from '@mate/shared';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { listKb, createKb, type KbEntity } from '@/api/kb';
import './kb.css';

const KB_KIND_OPTIONS = [
  { value: 'GENERAL', label: '通用' },
  { value: 'DOMAIN', label: '领域' },
  { value: 'FAQ', label: '问答' },
  { value: 'POLICY', label: '制度' },
];

const KIND_COLOR: Record<string, TagColor> = {
  GENERAL: 'blue',
  DOMAIN: 'green',
  FAQ: 'orange',
  POLICY: 'purple',
};

const FORM_DRAWER_W = 420;
const PAGE_SIZE = 20;

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { report } = useApiErrorBoundary();
  const [form] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [preview, setPreview] = useState<KbEntity | null>(null);
  const [keyword, setKeyword] = useState('');
  const [kindFilter, setKindFilter] = useState<string | undefined>();
  const [reloadTick, setReloadTick] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const submit = useLoadingState();

  const {
    data: kbs,
    loading,
    error,
    reload,
  } = useAsync<KbEntity[]>(
    () =>
      listKb().catch((e: Error) => {
        report(e);
        return [];
      }),
    [reloadTick],
    { initialData: [] },
  );

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (kbs ?? []).filter((kb) => {
      const hit = !kw || kb.displayName.toLowerCase().includes(kw) || kb.kbCode.toLowerCase().includes(kw);
      return hit && (!kindFilter || kb.kbKind === kindFilter);
    });
  }, [kbs, keyword, kindFilter]);

  // 筛选条件一变就回到第 1 页，否则用户会停在一个已被筛空的页码上。
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, kindFilter]);

  // 真·客户端分页：切片喂给表格，分页控件不再是空操作。
  // safePage 兜住「当前页因数据变少而越界」的情况（如删除后页码超界）。
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const paged = useMemo(
    () => visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visible, safePage],
  );

  const onCreate = async () => {
    const values = await form.validate();
    await submit.wrap(createKb(values));
    setCreateOpen(false);
    form.reset();
    Toast.success('已创建知识库');
    setReloadTick((t) => t + 1);
  };

  return (
    <>
      <PageHeader
        title="知识库"
        desc={`${kbs?.length ?? 0} 个知识库 · 向量检索 + RAG`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void reload()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={() => setCreateOpen(true)}>
              新建知识库
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称或编码…' }}
        filters={
          <Select value={kindFilter} onChange={(v) => setKindFilter(v as string | undefined)} placeholder="全部类型" showClear>
            {KB_KIND_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="知识库加载失败"
          desc={error.message}
          actions={
            <Button theme="solid" type="primary" onClick={() => void reload()}>
              重试
            </Button>
          }
        />
      ) : !loading && visible.length === 0 ? (
        <EmptyState
          illustration={(kbs?.length ?? 0) === 0 ? 'no-content' : 'no-result'}
          title={(kbs?.length ?? 0) === 0 ? '还没有知识库' : '没有匹配的知识库'}
          desc={(kbs?.length ?? 0) === 0 ? '新建一个知识库，然后上传文档建立索引。' : '调整关键词或类型。'}
          actions={
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={() => setCreateOpen(true)}>
              新建知识库
            </Button>
          }
        />
      ) : (
        <DataTablePro<KbEntity>
          rowKey="id"
          loading={loading}
          dataSource={paged}
          onRow={(record) => ({ onClick: () => setPreview(record as KbEntity) })}
          pagination={{
            currentPage: safePage,
            pageSize: PAGE_SIZE,
            total: visible.length,
            onChange: setCurrentPage,
          }}
          columns={[
            {
              title: '名称',
              dataIndex: 'displayName',
              render: (v: string, record: KbEntity) => (
                <span className="mp-kb-name">
                  <Database size={14} strokeWidth={1.5} />
                  {v}
                  <span className="mp-kb-code">{record.kbCode}</span>
                </span>
              ),
            },
            {
              title: '类型',
              dataIndex: 'kbKind',
              width: 110,
              render: (v: string) => <Tag size="small" color={KIND_COLOR[v] ?? 'grey'}>{v}</Tag>,
            },
            { title: '文档数', dataIndex: 'chunkCount', width: 100 },
            {
              title: '状态',
              dataIndex: 'enabled',
              width: 100,
              render: (v: boolean) => <Tag size="small" color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
            },
            { title: '描述', dataIndex: 'description', ellipsis: true, render: (v?: string) => v || '—' },
          ]}
        />
      )}

      <SideSheet
        title="新建知识库"
        visible={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={FORM_DRAWER_W}
        getPopupContainer={() => document.getElementById('app') ?? document.body}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={submit.loading} onClick={() => void onCreate()}>
              创建
            </Button>
          </>
        }
      >
        <Form form={form}>
          <Form.Input field="kbCode" label="编码" rules={[{ required: true, message: '请输入编码' }]} placeholder="如：customer-policy-v1" />
          <Form.Input field="displayName" label="名称" rules={[{ required: true, message: '请输入名称' }]} placeholder="如：客户政策知识库" />
          <Form.Select field="kbKind" label="类型" initValue="GENERAL" optionList={KB_KIND_OPTIONS} />
          <Form.TextArea field="description" label="描述" rows={3} />
        </Form>
      </SideSheet>

      <SheetDetail
        title={preview ? `知识库 · ${preview.displayName}` : '知识库详情'}
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={
          <>
            <Button onClick={() => setPreview(null)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => preview && navigate(`/ki/kb/${encodeURIComponent(preview.id)}`)}
            >
              进入知识库
            </Button>
          </>
        }
      >
        {preview ? (
          <Descriptions
            row
            size="small"
            data={[
              { key: '编码', value: preview.kbCode },
              { key: '类型', value: <Tag color={KIND_COLOR[preview.kbKind] ?? 'grey'}>{preview.kbKind}</Tag> },
              { key: '文档数', value: String(preview.chunkCount) },
              { key: '状态', value: <Tag color={preview.enabled ? 'green' : 'red'}>{preview.enabled ? '启用' : '禁用'}</Tag> },
              { key: '描述', value: preview.description || '—' },
            ]}
          />
        ) : null}
      </SheetDetail>
    </>
  );
}
