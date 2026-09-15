import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Form, Popconfirm, Select, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { Eye, Plus, RefreshCw } from 'lucide-react';
import {
  createStandard,
  deleteStandard,
  listStandards,
  updateStandard,
} from '@/api/arch/dataArchitecture';
import type { DataStandard } from '@/api/arch/types';
import {
  DataTablePro,
  EmptyState,
  FilterBar,
  PageHeader,
  SheetDetail,
} from '@/components/skeleton';

const STANDARD_TYPES = ['format', 'enum', 'rule', 'range', 'regex'];

const TYPE_COLOR: Record<string, 'blue' | 'green' | 'orange' | 'purple' | 'cyan'> = {
  format: 'blue',
  enum: 'green',
  rule: 'orange',
  range: 'purple',
  regex: 'cyan',
};

interface StandardDraft {
  id?: string;
  code: string;
  name: string;
  standardType: string;
  rule?: string;
  description?: string;
}

/**
 * 数据标准（DESIGN-SPEC §5 版式 E：表格页 + 抽屉表单/预览）。
 * 数据面沿用 src/api/arch/dataArchitecture 的标准 CRUD。
 */
export default function DataStandardPage() {
  const [standards, setStandards] = useState<DataStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [draft, setDraft] = useState<StandardDraft | null>(null);
  const [preview, setPreview] = useState<DataStandard | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<StandardDraft>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listStandards();
      setStandards(Array.isArray(data) ? data : ((data as { items?: DataStandard[] }).items ?? []));
    } catch (e) {
      setStandards([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setDraft({ code: '', name: '', standardType: 'format' });
    form.reset();
  };

  const openEdit = (row: DataStandard) => {
    setDraft({
      id: row.id,
      code: row.code,
      name: row.name,
      standardType: row.standardType,
      rule: row.rule,
      description: row.description,
    });
  };

  const submit = async () => {
    if (!draft) return;
    let values: StandardDraft;
    try {
      values = (await form.validate()) as StandardDraft;
    } catch {
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await updateStandard(draft.id, values);
        Toast.success('数据标准已更新');
      } else {
        await createStandard(values);
        Toast.success('数据标准已创建');
      }
      setDraft(null);
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: DataStandard) => {
    try {
      await deleteStandard(row.id);
      Toast.success('数据标准已删除');
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const visible = useMemo(() => {
    let rows = standards;
    if (typeFilter) rows = rows.filter((s) => s.standardType === typeFilter);
    if (keyword) {
      const q = keyword.toLowerCase();
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [standards, typeFilter, keyword]);

  const columns = useMemo(
    () => [
      { title: '编码', dataIndex: 'code', key: 'code', width: 170, ellipsis: true },
      { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
      {
        title: '类型',
        dataIndex: 'standardType',
        key: 'standardType',
        width: 110,
        render: (v: string | undefined) =>
          v ? (
            <Tag color={TYPE_COLOR[v] ?? 'grey'} type="light">
              {v}
            </Tag>
          ) : (
            '—'
          ),
      },
      { title: '规则', dataIndex: 'rule', key: 'rule', ellipsis: true },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      {
        title: '',
        dataIndex: '__actions__',
        key: 'actions',
        width: 190,
        render: (_: unknown, row: DataStandard) => (
          <Space>
            <Button theme="borderless" type="tertiary" size="small" onClick={() => setPreview(row)}>
              预览
            </Button>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(row)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该标准？" onConfirm={() => void remove(row)}>
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
        title="数据标准"
        desc={`${standards.length} 条标准 · 定义字段的格式、枚举、规则与阈值`}
        actions={
          <>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
            <Button theme="solid" type="primary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={openCreate}>
              新建标准
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索标准名称、编码…' }}
        filters={
          <Select
            value={typeFilter ?? ''}
            onChange={(v) => setTypeFilter(v ? String(v) : undefined)}
            placeholder="全部类型"
          >
            <Select.Option value="">全部类型</Select.Option>
            {STANDARD_TYPES.map((t) => (
              <Select.Option key={t} value={t}>
                {t}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<DataStandard>
        columns={columns}
        dataSource={visible}
        rowKey="id"
        loading={loading}
        onRow={(record) => ({ onDoubleClick: () => openEdit(record as DataStandard) })}
        empty={
          error ? (
            <EmptyState illustration="failure" title="数据标准加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的数据标准"
              desc="调整类型或关键词，或新建一条标准。"
            />
          )
        }
      />

      <SheetDetail
        title="数据标准预览"
        open={preview !== null}
        onClose={() => setPreview(null)}
        footer={
          <>
            {preview ? (
              <Button icon={<Eye size={15} strokeWidth={1.5} />} onClick={() => openEdit(preview)}>
                编辑
              </Button>
            ) : null}
            <Button onClick={() => setPreview(null)}>关闭</Button>
          </>
        }
      >
        {preview ? (
          <Descriptions
            row
            data={[
              { key: '编码', value: preview.code },
              { key: '名称', value: preview.name },
              { key: '类型', value: preview.standardType ?? '—' },
              { key: '规则', value: preview.rule || '无' },
              { key: '描述', value: preview.description || '无' },
            ]}
          />
        ) : null}
      </SheetDetail>

      <SheetDetail
        title={draft?.id ? `编辑数据标准 · ${draft.name}` : '新建数据标准'}
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
            <Form.Input field="code" label="编码" rules={[{ required: true, message: '请输入编码' }]} />
            <Form.Input field="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <Form.Select
              field="standardType"
              label="类型"
              rules={[{ required: true, message: '请选择类型' }]}
              optionList={STANDARD_TYPES.map((t) => ({ label: t, value: t }))}
            />
            <Form.TextArea field="rule" label="规则" rows={3} placeholder="如正则表达式、枚举值、阈值范围等" />
            <Form.TextArea field="description" label="描述" rows={2} />
          </Form>
        ) : null}
      </SheetDetail>
    </>
  );
}
