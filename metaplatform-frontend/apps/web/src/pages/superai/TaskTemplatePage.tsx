import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Plus, RefreshCw } from 'lucide-react';
import { createTemplate, listTemplates } from '@/api/superai/templates';
import type { ScheduleTemplate } from '@/api/superai/schedule';
import { DataTablePro, EmptyState, FilterBar, PageHeader } from '@/components/skeleton';

interface TemplateFormValues {
  name: string;
  description?: string;
  intentPattern?: string;
}

/**
 * SuperAI · 任务模板。
 *
 * 数据面沿用 src/api/superai/templates（= schedule 的 listTemplates/createTemplate）。
 * 原页的「编辑 / 删除」按钮没有对应接口也没有 onClick（纯装饰），已删除；
 * 这里只保留真实可用的「创建模板」。
 */
export default function TaskTemplatePage() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<TemplateFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listTemplates();
      setTemplates(Array.isArray(res) ? res : []);
    } catch (e) {
      setTemplates([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        (t.description ?? '').toLowerCase().includes(kw) ||
        (t.intentPattern ?? '').toLowerCase().includes(kw),
    );
  }, [templates, keyword]);

  const handleSubmit = useCallback(async () => {
    const v = (await form.validate()) as TemplateFormValues;
    setSubmitting(true);
    try {
      await createTemplate({
        name: v.name,
        description: v.description ?? '',
        intentPattern: v.intentPattern ?? '',
        plan: {
          planId: 'plan',
          intentId: 'intent',
          steps: [],
          totalEstimatedDuration: 0,
          createdAt: new Date().toISOString(),
        },
        createdBy: 'admin',
      });
      Toast.success('已创建');
      setEditorOpen(false);
      form.reset();
      void load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const columns: ColumnProps<ScheduleTemplate>[] = useMemo(
    () => [
      {
        title: '模板',
        key: 'name',
        render: (_: unknown, t: ScheduleTemplate) => (
          <span className="mp-exec-step-head">
            <span className="mp-exec-step-title">{t.name}</span>
            <span className="mp-exec-step-body">{t.description || ''}</span>
          </span>
        ),
      },
      { title: '意图模式', dataIndex: 'intentPattern', ellipsis: true, render: (v?: string) => v || '—' },
      { title: '创建人', dataIndex: 'createdBy', width: 120, render: (v?: string) => v || '—' },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (v?: string) => (v ? new Date(v).toLocaleString() : '—'),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="任务模板"
        desc={`${templates.length} 个模板 · 用意图模式快速复用调度计划`}
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Plus size={15} strokeWidth={1.5} />}
              onClick={() => setEditorOpen(true)}
            >
              创建模板
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索名称、描述或意图模式…' }}
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="任务模板加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : loading && templates.length === 0 ? (
        <div className="mp-exec-loading">
          <Spin size="middle" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={templates.length === 0 ? 'no-content' : 'no-result'}
          title={templates.length === 0 ? '还没有模板' : '没有匹配的模板'}
          desc={templates.length === 0 ? '创建一个模板，让常用意图模式可复用。' : '调整关键词再试。'}
        />
      ) : (
        <DataTablePro<ScheduleTemplate>
          columns={columns}
          dataSource={filtered}
          rowKey="templateId"
          loading={loading}
          empty={<EmptyState illustration="no-content" title="还没有模板" />}
        />
      )}

      <Modal
        visible={editorOpen}
        title="创建任务模板"
        onCancel={() => setEditorOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form}>
          <Form.Input field="name" label="名称" rules={[{ required: true, message: '请填写名称' }]} />
          <Form.TextArea field="description" label="描述" rows={2} />
          <Form.Input field="intentPattern" label="意图模式" placeholder="示例：每周一上午汇总销售数据" />
        </Form>
      </Modal>
    </>
  );
}
