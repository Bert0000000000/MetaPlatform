import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Descriptions, Select, Tag, Toast } from '@douyinfe/semi-ui';
import { Download, RefreshCw } from 'lucide-react';
import {
  auditLogsExportUrl,
  getAuditLog,
  getAuditModules,
  listAuditLogs,
  type ListAuditLogsParams,
} from '@/api/admin';
import { apiClient } from '@/api/client';
import type { AdminAuditLog, AuditAction } from '@/types';
import { DataTablePro, EmptyState, FilterBar, PageHeader, SheetDetail } from '@/components/skeleton';
import './admin.css';

const PAGE_SIZE = 20;

/** 动作 → 语义色（覆盖 types/admin 里的 AuditAction 全集）。 */
const ACTION_COLOR: Record<AuditAction, 'green' | 'red' | 'amber' | 'blue' | 'grey'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  ENABLE: 'green',
  DISABLE: 'grey',
  RESET_PASSWORD: 'amber',
  LOGIN: 'grey',
  LOGOUT: 'grey',
  ASSIGN: 'blue',
  REVOKE: 'red',
  EXPORT: 'amber',
  CONFIG_CHANGE: 'blue',
  IMPORT: 'green',
  OTHER: 'grey',
};

/**
 * 平台管理 · 审计日志（DESIGN-SPEC §5 版式 E）。
 * 数据面沿用 src/api/admin/logs（服务端分页 + 模块/动作/时间范围筛选），
 * 行点开右侧非模态详情浮层展示完整审计载荷。
 */
export default function LogsPage() {
  const [actor, setActor] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<AuditAction | undefined>(undefined);
  const [range, setRange] = useState<[Date, Date] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modules, setModules] = useState<{ value: string; count: number }[]>([]);
  const [actions, setActions] = useState<{ value: string; count: number }[]>([]);

  const [detail, setDetail] = useState<AdminAuditLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params: ListAuditLogsParams = {
      actor: actor || undefined,
      module: moduleFilter,
      action: actionFilter,
      start: range ? range[0].toISOString() : undefined,
      end: range ? range[1].toISOString() : undefined,
      page,
      pageSize,
    };
    try {
      const res = await listAuditLogs(params);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [actor, moduleFilter, actionFilter, range, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getAuditModules()
      .then((m) => {
        setModules(m.modules ?? []);
        setActions(m.actions ?? []);
      })
      .catch(() => {
        setModules([]);
        setActions([]);
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [actor, moduleFilter, actionFilter, range]);

  const openDetail = async (row: AdminAuditLog) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      // 列表行是摘要；详情重新拉全量载荷
      setDetail(await getAuditLog(row.id));
    } catch {
      // 拉详情失败时保留列表行内容，不打断阅读
    } finally {
      setDetailLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const url = auditLogsExportUrl({
        actor: actor || undefined,
        module: moduleFilter,
        action: actionFilter,
      });
      const res = await apiClient.get<Blob>(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `audit-logs-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      Toast.success('已导出审计日志');
    } catch (e) {
      Toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const columns = useMemo(
    () => [
      { title: '时间', dataIndex: 'occurredAt', width: 190, ellipsis: true },
      {
        title: '操作者',
        dataIndex: 'actorName',
        width: 170,
        ellipsis: true,
        render: (_: unknown, row: AdminAuditLog) => (
          <span className="mp-admin-cell-main">
            <span className="mp-admin-cell-title">{row.actorName ?? row.actorId}</span>
            <span className="mp-admin-cell-sub">{row.actorId}</span>
          </span>
        ),
      },
      {
        title: '模块',
        dataIndex: 'module',
        width: 140,
        ellipsis: true,
        render: (v: string) => <Tag type="light">{v}</Tag>,
      },
      {
        title: '动作',
        dataIndex: 'action',
        width: 120,
        render: (v: string) => (
          <Tag color={ACTION_COLOR[v as AuditAction] ?? 'grey'} type="light">
            {v}
          </Tag>
        ),
      },
      {
        title: '资源',
        dataIndex: 'resourceName',
        width: 220,
        ellipsis: true,
        render: (_: unknown, row: AdminAuditLog) => (
          <span className="mp-admin-muted">
            {row.resourceName ?? row.resourceId ?? row.resourceType ?? '—'}
          </span>
        ),
      },
      {
        title: '摘要',
        dataIndex: 'summary',
        ellipsis: true,
        render: (v: string | null | undefined) => <span className="mp-admin-muted">{v || '—'}</span>,
      },
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 150,
        ellipsis: true,
        render: (v: string | null | undefined) => <span className="mp-admin-mono">{v || '—'}</span>,
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="审计日志"
        desc={`${total} 条记录 · 所有写操作与登录事件都会留痕`}
        actions={
          <>
            <Button icon={<Download size={15} strokeWidth={1.5} />} onClick={() => void exportLogs()}>
              导出
            </Button>
            <Button icon={<RefreshCw size={15} strokeWidth={1.5} />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
          </>
        }
      />

      <FilterBar
        search={{ value: actor, onChange: setActor, placeholder: '搜索操作者…' }}
        filters={
          <>
            <Select
              value={moduleFilter ?? ''}
              onChange={(v) => setModuleFilter(v ? String(v) : undefined)}
              placeholder="全部模块"
            >
              <Select.Option value="">全部模块</Select.Option>
              {modules.map((m) => (
                <Select.Option key={m.value} value={m.value}>
                  {m.value}（{m.count}）
                </Select.Option>
              ))}
            </Select>
            <Select
              value={actionFilter ?? ''}
              onChange={(v) => setActionFilter(v ? (String(v) as AuditAction) : undefined)}
              placeholder="全部动作"
            >
              <Select.Option value="">全部动作</Select.Option>
              {actions.map((a) => (
                <Select.Option key={a.value} value={a.value}>
                  {a.value}（{a.count}）
                </Select.Option>
              ))}
            </Select>
            <DatePicker
              type="dateRange"
              value={range ?? undefined}
              onChange={(v) => {
                const next = Array.isArray(v) && v[0] && v[1] ? ([v[0], v[1]] as [Date, Date]) : null;
                setRange(next);
              }}
              placeholder={['开始日期', '结束日期']}
            />
          </>
        }
      />

      <DataTablePro<AdminAuditLog>
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
        onRow={(record) => ({ onClick: () => void openDetail(record) })}
        empty={
          error ? (
            <EmptyState illustration="failure" title="审计日志加载失败" desc={error} />
          ) : (
            <EmptyState
              illustration="no-result"
              title="没有匹配的审计记录"
              desc="调整操作者、模块、动作或时间范围。"
            />
          )
        }
      />

      <SheetDetail
        title="审计详情"
        open={detail !== null}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>关闭</Button>}
      >
        {detail ? (
          <div className="mp-admin-section">
            <Descriptions
              row
              data={[
                { key: '时间', value: detail.occurredAt },
                { key: '操作者', value: detail.actorName ?? detail.actorId },
                { key: '操作者 ID', value: detail.actorId },
                { key: '模块', value: detail.module },
                { key: '动作', value: detail.action },
                { key: '资源类型', value: detail.resourceType ?? '—' },
                { key: '资源', value: detail.resourceName ?? detail.resourceId ?? '—' },
                { key: 'IP', value: detail.ip ?? '—' },
                { key: '摘要', value: detail.summary ?? '—' },
              ]}
            />
            <div className="mp-admin-section">
              <span className="mp-admin-section-label">
                载荷{detailLoading ? ' · 正在拉取最新详情…' : ''}
              </span>
              <pre className="mp-admin-pre">{detail.detail ?? '（无附加载荷）'}</pre>
            </div>
            {detail.userAgent ? (
              <div className="mp-admin-section">
                <span className="mp-admin-section-label">User-Agent</span>
                <span className="mp-admin-mono">{detail.userAgent}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetDetail>
    </>
  );
}
