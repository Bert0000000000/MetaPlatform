import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Popconfirm, Select, Tag, Timeline, Toast } from '@douyinfe/semi-ui';
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  Database,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { deleteDeliverable, listDeliverables } from '@/api/dashboard/deliverables';
import { getDeliverablesSummary, type DeliverableTimelineItem } from '@/api/dashboard/workbench';
import type { Deliverable } from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './home.css';

const PAGE_SIZE = 10;

/** 交付物类型 → 展示图标（格式化输出，仅表达载体）。 */
const ICONS: Record<string, LucideIcon> = {
  report: BarChart3,
  analysis: BrainCircuit,
  spreadsheet: FileSpreadsheet,
  dataset: Database,
  log: Activity,
  document: FileText,
};

const iconFor = (type: string | undefined): LucideIcon => (type ? (ICONS[type] ?? FileText) : FileText);

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  ready: 'green',
  generating: 'amber',
  failed: 'red',
};

const STATUS_LABEL: Record<string, string> = {
  ready: '可下载',
  generating: '生成中',
  failed: '失败',
};

function formatSize(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * 工作台 · 交付物（DESIGN-SPEC §5 版式 E：页头 + KPI bento + 筛选栏 + 表格 + 时间线）。
 *
 * 表格数据来自 src/api/dashboard/deliverables#listDeliverables —— 它带回资源 id，
 * 因此「删除」是真实可达的能力；近期动态仍取 workbench#getDeliverablesSummary。
 * KPI 由全量列表算出（一次拉齐、客户端筛选分页），避免服务端分页把统计口径截断。
 *
 * 已知后端缺口：下载不可用。POST /deliverables/{id}/download 会返回一个
 * `/deliverables/{id}/file.<fmt>` 链接，但该 GET 路由不存在（404），
 * 即后端只生成了字符串没有落地文件。这里不画点了没反应的下载按钮。
 */
export default function DeliverablesPage() {
  const [rows, setRows] = useState<Deliverable[]>([]);
  const [timeline, setTimeline] = useState<DeliverableTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<Deliverable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [listRes, summaryRes] = await Promise.allSettled([
      listDeliverables(),
      getDeliverablesSummary(),
    ]);
    if (listRes.status === 'fulfilled') {
      setRows(listRes.value.items ?? []);
    } else {
      setRows([]);
      setError(listRes.reason instanceof Error ? listRes.reason.message : String(listRes.reason));
    }
    setTimeline(summaryRes.status === 'fulfilled' ? (summaryRes.value.timeline ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  /** 类型下拉只列出当前数据里真实出现过的类型。 */
  const typeOptions = useMemo(() => {
    const seen = new Set(rows.map((d) => d.type));
    return Array.from(seen).map((t) => ({ value: t, label: t }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.source ?? '').toLowerCase().includes(q) ||
        (d.createdBy ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const totalCount = rows.length;
  const readyCount = useMemo(() => rows.filter((d) => d.status === 'ready').length, [rows]);
  const generatingCount = useMemo(() => rows.filter((d) => d.status === 'generating').length, [rows]);
  const readyRate = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  const remove = useCallback(
    async (row: Deliverable) => {
      setBusyId(row.id);
      try {
        await deleteDeliverable(row.id);
        Toast.success(`已删除「${row.title}」`);
        setDetail(null);
        await load();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const columns = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'title',
        width: 280,
        ellipsis: true,
        render: (_: unknown, row: Deliverable) => {
          const Icon = iconFor(row.type);
          return (
            <span className="mp-home-agent">
              <Icon size={15} strokeWidth={1.5} />
              <span className="mp-home-agent-main">
                <span className="mp-home-agent-name">{row.title}</span>
                <span className="mp-home-agent-type">{row.description || row.source}</span>
              </span>
            </span>
          );
        },
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 120,
        render: (v: string) => (
          <Tag size="small" type="light">
            {v}
          </Tag>
        ),
      },
      { title: '格式', dataIndex: 'format', width: 90 },
      {
        title: '大小',
        dataIndex: 'size',
        width: 110,
        render: (v: number) => <span className="mp-home-agent-type">{formatSize(v)}</span>,
      },
      {
        title: '生成方',
        dataIndex: 'createdBy',
        width: 170,
        ellipsis: true,
        render: (v: string | undefined) => {
          const GenIcon = v && v.includes('员') ? Bot : User;
          return (
            <span className="mp-home-agent">
              <GenIcon size={14} strokeWidth={1.5} />
              <span className="mp-home-agent-main">
                <span className="mp-home-agent-name">{v || '—'}</span>
              </span>
            </span>
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (v: string) => (
          <Tag size="small" type="light" color={STATUS_COLOR[v] ?? 'grey'}>
            {STATUS_LABEL[v] ?? v}
          </Tag>
        ),
      },
      { title: '生成时间', dataIndex: 'createdAt', width: 190, ellipsis: true },
      {
        title: '',
        dataIndex: '__actions__',
        width: 140,
        render: (_: unknown, row: Deliverable) => (
          <span className="mp-home-todo-actions">
            <Popconfirm
              title="确认删除该交付物？"
              content="删除后不可恢复。"
              onConfirm={() => void remove(row)}
            >
              <Button theme="borderless" type="danger" size="small">
                删除
              </Button>
            </Popconfirm>
          </span>
        ),
      },
    ],
    [busyId, remove],
  );

  return (
    <>
      <PageHeader
        title="交付物"
        desc={`${totalCount} 份材料 · 可下载 ${readyCount} 份 · 生成中 ${generatingCount} 份`}
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

      <div className="mp-home-kpis">
        <Card>
          <div className="mp-home-kpi">
            <span className="mp-home-kpi-label">累计产出</span>
            <div className="mp-home-kpi-row">
              <span className="mp-home-kpi-value">{totalCount}</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="mp-home-kpi">
            <span className="mp-home-kpi-label">可下载</span>
            <div className="mp-home-kpi-row">
              <span className="mp-home-kpi-value">{readyCount}</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="mp-home-kpi">
            <span className="mp-home-kpi-label">生成中</span>
            <div className="mp-home-kpi-row">
              <span className="mp-home-kpi-value">{generatingCount}</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="mp-home-kpi">
            <span className="mp-home-kpi-label">就绪率</span>
            <div className="mp-home-kpi-row">
              <span className="mp-home-kpi-value">{readyRate}%</span>
            </div>
          </div>
        </Card>
      </div>

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: '搜索名称、来源或生成方…' }}
        filters={
          <Select value={typeFilter} onChange={(v) => setTypeFilter(v ? String(v) : '')} placeholder="全部类型">
            <Select.Option value="">全部类型</Select.Option>
            {typeOptions.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        }
      />

      <DataTablePro<Deliverable>
        columns={columns}
        dataSource={pageRows}
        rowKey="id"
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total: filtered.length,
          onChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        onRow={(record) => ({ onDoubleClick: () => setDetail(record) })}
        empty={
          error ? (
            <EmptyState
              illustration="failure"
              title="交付物加载失败"
              desc={error}
              actions={
                <Button theme="solid" type="primary" onClick={() => void load()}>
                  重试
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的交付物"
              desc="调整搜索关键词或类型筛选。"
            />
          )
        }
      />

      <Card title="近期动态">
        {timeline.length === 0 ? (
          <EmptyState illustration="no-content" title="暂无动态" desc="交付物状态变化后会出现在这里。" />
        ) : (
          <Timeline>
            {timeline.map((t: DeliverableTimelineItem, i: number) => (
              <Timeline.Item key={`${t.time_label}-${i}`} time={t.time_label} type={i === 0 ? 'ongoing' : 'default'}>
                <span className="mp-home-feed-title">{t.title}</span>
                <div className="mp-home-feed-meta">{t.description}</div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>

      <SheetDetail
        title="交付物详情"
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={
          <>
            {detail ? (
              <Popconfirm
                title="确认删除该交付物？"
                content="删除后不可恢复。"
                onConfirm={() => void remove(detail)}
              >
                <Button type="danger" icon={<Trash2 size={15} strokeWidth={1.5} />}>
                  删除
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={() => setDetail(null)}>关闭</Button>
          </>
        }
      >
        {detail ? (
          <Descriptions
            row
            data={[
              { key: '名称', value: detail.title },
              { key: '类型', value: detail.type },
              { key: '来源', value: detail.source ?? '—' },
              { key: '说明', value: detail.description ?? '—' },
              { key: '格式', value: detail.format },
              { key: '大小', value: formatSize(detail.size) },
              { key: '生成方', value: detail.createdBy ?? '—' },
              { key: '生成时间', value: detail.createdAt },
              { key: '状态', value: STATUS_LABEL[detail.status] ?? detail.status },
              { key: '资源 ID', value: detail.id },
            ]}
          />
        ) : null}
      </SheetDetail>
    </>
  );
}
