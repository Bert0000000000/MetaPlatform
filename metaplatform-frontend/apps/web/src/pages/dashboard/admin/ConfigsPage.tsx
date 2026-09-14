import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Form, Select, Tag, Toast } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { Pencil, RefreshCw } from 'lucide-react';
import { listConfigCategories, listConfigs, updateConfig } from '@/api/admin';
import type { AdminSystemConfig, ConfigCategory } from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import { formatDateTime } from '@/utils/datetime';
import { useSettings } from '@/contexts/SettingsContext';
import './admin.css';

const PAGE_SIZE = 20;

/** 只用到 validate：用最小结构类型承接 Semi 的 formApi，避免深路径 import 与泛型噪声。 */
interface FormApiLike {
  validate: () => Promise<Record<string, unknown>>;
}

const CATEGORY_LABEL: Record<ConfigCategory, string> = {
  SSO: 'SSO 单点登录',
  LICENSE: 'License',
  MESSAGE: '消息渠道',
  RATE_LIMIT: '限流',
  SECURITY: '安全',
  BRANDING: '品牌',
  AI_PROVIDER: 'AI 提供方',
  OTHER: '其他',
};

const CATEGORY_COLOR: Record<ConfigCategory, TagColor> = {
  SSO: 'indigo',
  LICENSE: 'yellow',
  MESSAGE: 'purple',
  RATE_LIMIT: 'orange',
  SECURITY: 'red',
  BRANDING: 'cyan',
  AI_PROVIDER: 'pink',
  OTHER: 'grey',
};

/** 按类型把配置值渲染成表格单元格（敏感值只显示掩码）。 */
function renderValue(cfg: AdminSystemConfig) {
  if (cfg.isSensitive) return <span className="mp-admin-mono">****</span>;
  switch (cfg.valueType) {
    case 'bool':
      return (
        <Tag color={cfg.value ? 'green' : 'grey'} type="light">
          {cfg.value ? 'true' : 'false'}
        </Tag>
      );
    case 'int':
      return <span className="mp-admin-mono">{String(cfg.value ?? '')}</span>;
    case 'enum':
      return (
        <Tag color="blue" type="light">
          {String(cfg.value ?? '')}
        </Tag>
      );
    case 'json':
      return (
        <span className="mp-admin-mono">
          {typeof cfg.value === 'object' ? '{...}' : String(cfg.value ?? '')}
        </span>
      );
    default:
      return <span className="mp-admin-muted">{String(cfg.value ?? '')}</span>;
  }
}

/** 编辑抽屉的初始值：bool / int 交给对应控件，json 反序列化成可编辑文本。 */
function initialValue(cfg: AdminSystemConfig): unknown {
  if (cfg.valueType === 'bool') return cfg.value === true || cfg.value === 'true';
  if (cfg.valueType === 'int') {
    const n = Number(cfg.value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (cfg.value === null || cfg.value === undefined) return '';
  if (typeof cfg.value === 'object') return JSON.stringify(cfg.value, null, 2);
  return String(cfg.value);
}

/**
 * 平台管理 · 系统配置（DESIGN-SPEC §5 版式 E：页头 + 筛选栏 + 表格 + 编辑抽屉）。
 * 数据面沿用 src/api/admin/configs.ts；变更原因写入审计日志。
 */
export default function ConfigsPage() {
  const { settings } = useSettings();
  const [items, setItems] = useState<AdminSystemConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);
  const [category, setCategory] = useState<ConfigCategory | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [categories, setCategories] = useState<{ value: string; count: number }[]>([]);

  const [editTarget, setEditTarget] = useState<AdminSystemConfig | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const formApi = useRef<FormApiLike | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listConfigs({
        category,
        keyword: keyword || undefined,
        page,
        pageSize,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [category, keyword, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listConfigCategories()
      .then((r) => setCategories(Array.isArray(r) ? r : []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [keyword, category]);

  const openEdit = (cfg: AdminSystemConfig) => {
    setEditTarget(cfg);
    setEditOpen(true);
  };

  const closeDrawer = () => setEditOpen(false);

  const submit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const values = await formApi.current?.validate();
      if (!values) return;
      let payload: unknown = values.value;
      if (editTarget.valueType === 'json' && typeof values.value === 'string') {
        try {
          payload = JSON.parse(values.value);
        } catch {
          Toast.error('JSON 格式不合法');
          return;
        }
      }
      await updateConfig(editTarget.key, payload, (values.note as string) || undefined);
      Toast.success('已更新');
      closeDrawer();
      await load();
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : '请检查表单填写');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: 'Key',
        dataIndex: 'key',
        width: 240,
        render: (v: string) => <span className="mp-admin-mono">{v}</span>,
      },
      {
        title: '名称',
        dataIndex: 'label',
        width: 180,
        ellipsis: true,
        render: (v: string | null | undefined) => <span className="mp-admin-muted">{v || '—'}</span>,
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 140,
        render: (v: ConfigCategory) => (
          <Tag color={CATEGORY_COLOR[v] ?? 'grey'} type="light">
            {CATEGORY_LABEL[v] ?? v}
          </Tag>
        ),
      },
      {
        title: '当前值',
        dataIndex: 'value',
        render: (_: unknown, row: AdminSystemConfig) => renderValue(row),
      },
      {
        title: '类型',
        dataIndex: 'valueType',
        width: 90,
        render: (v: string) => (
          <Tag type="light">{v}</Tag>
        ),
      },
      {
        title: '敏感',
        dataIndex: 'isSensitive',
        width: 80,
        render: (v: boolean) => (
          <Tag color={v ? 'red' : 'grey'} type="light">
            {v ? '是' : '否'}
          </Tag>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        width: 190,
        render: (v: string) => <span className="mp-admin-faint">{formatDateTime(v, settings)}</span>,
      },
      {
        title: '更新人',
        dataIndex: 'updatedBy',
        width: 120,
        render: (v?: string | null) => <span className="mp-admin-muted">{v ?? '—'}</span>,
      },
      {
        title: '',
        dataIndex: '__actions__',
        width: 100,
        render: (_: unknown, row: AdminSystemConfig) => (
          <span className="mp-admin-row-actions">
            <Button
              theme="borderless"
              type="primary"
              size="small"
              icon={<Pencil size={15} strokeWidth={1.5} />}
              onClick={() => openEdit(row)}
            >
              编辑
            </Button>
          </span>
        ),
      },
    ],
    [settings],
  );

  const stats = useMemo(() => {
    const enabled = items.filter((c) => c.value === true || c.value === 'true').length;
    const systemConfig = items.filter(
      (c) => c.category === 'SSO' || c.category === 'SECURITY' || c.category === 'LICENSE',
    ).length;
    return { enabled, disabled: items.length - enabled, systemConfig };
  }, [items]);

  const renderValueInput = () => {
    if (!editTarget) return null;
    const t = editTarget.valueType;
    if (t === 'bool') {
      return <Form.Switch field="value" label="值" />;
    }
    if (t === 'int') {
      return <Form.InputNumber field="value" label="值" rules={[{ required: true }]} />;
    }
    if (t === 'enum') {
      return (
        <Form.Select
          field="value"
          label="值"
          rules={[{ required: true }]}
          optionList={editTarget.enumOptions.map((o) => ({ value: o, label: o }))}
        />
      );
    }
    if (t === 'json') {
      return (
        <Form.TextArea
          field="value"
          label="值 (JSON)"
          rules={[{ required: true }]}
          autosize={{ minRows: 4 }}
          placeholder='{"key": "value"}'
        />
      );
    }
    return (
      <Form.Input
        field="value"
        label="值"
        rules={[{ required: true }]}
        mode="password"
        placeholder={editTarget.isSensitive ? '敏感字段，输入新值' : ''}
      />
    );
  };

  return (
    <>
      <PageHeader
        title="系统配置"
        desc={`共 ${total} 项配置 · 分类 ${categories.length} 个 · 每次变更写入审计日志`}
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        }
      />

      <div className="mp-admin-kpis">
        <Card>
          <div className="mp-admin-kpi-label">配置项总数</div>
          <div className="mp-admin-kpi-value">{total}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">已启用</div>
          <div className="mp-admin-kpi-value">{stats.enabled}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">已禁用</div>
          <div className="mp-admin-kpi-value">{stats.disabled}</div>
        </Card>
        <Card>
          <div className="mp-admin-kpi-label">系统配置</div>
          <div className="mp-admin-kpi-value">{stats.systemConfig}</div>
        </Card>
      </div>

      <FilterBar
        search={{ value: keyword, onChange: setKeyword, placeholder: '搜索配置 Key…' }}
        filters={
          <Select
            value={category ?? ''}
            onChange={(v) => setCategory(v ? (v as ConfigCategory) : undefined)}
            placeholder="全部分类"
          >
            <Select.Option value="">全部分类</Select.Option>
            {categories.map((c) => (
              <Select.Option key={c.value} value={c.value}>
                {`${CATEGORY_LABEL[c.value as ConfigCategory] ?? c.value} (${c.count})`}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<AdminSystemConfig>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        onRow={(record) => ({ onDoubleClick: () => openEdit(record) })}
        empty={
          error ? (
            <EmptyState illustration="failure" title="配置列表加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的配置项"
              desc="调整关键词或分类筛选后再试。"
            />
          )
        }
      />

      <SheetDetail
        title={editTarget ? `编辑配置 · ${editTarget.key}` : '编辑配置'}
        open={editOpen}
        onClose={closeDrawer}
        footer={
          <>
            <Button onClick={closeDrawer}>取消</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
              保存
            </Button>
          </>
        }
      >
        {editTarget ? (
          <div className="mp-admin-form">
            <div className="mp-admin-section">
              <span className="mp-admin-section-label">KEY</span>
              <span className="mp-admin-mono">{editTarget.key}</span>
              <span className="mp-admin-section-label">名称</span>
              <span className="mp-admin-muted">{editTarget.label ?? '—'}</span>
              <span className="mp-admin-section-label">分类</span>
              <span className="mp-admin-chips">
                <Tag color={CATEGORY_COLOR[editTarget.category] ?? 'grey'} type="light">
                  {CATEGORY_LABEL[editTarget.category] ?? editTarget.category}
                </Tag>
              </span>
            </div>
            <Form
              key={editTarget.id}
              getFormApi={(api) => {
                formApi.current = api as unknown as FormApiLike;
              }}
              initValues={{ value: initialValue(editTarget), note: '' }}
              labelPosition="left"
              labelWidth={92}
            >
              {renderValueInput()}
              <Form.TextArea
                field="note"
                label="变更原因"
                autosize={{ minRows: 2 }}
                placeholder="说明本次变更的背景，写入审计日志"
              />
            </Form>
          </div>
        ) : null}
      </SheetDetail>
    </>
  );
}
