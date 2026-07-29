/**
 * 日志管理页
 * 数据源：TECH-IAM /api/v1/iam/audit-logs
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, FileText, Activity, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import {
  SubTabs, PageLoading, EmptyState, type SubTabItem,
  Api,
} from '@mate/shared';
import type { AuditLogResponse, AuditLogStatistics, AuditStatus } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  SUCCESS: { label: '成功', cls: 'v-badge v-badge-success' },
  FAILURE: { label: '失败', cls: 'v-badge v-badge-error' },
  FAILED:  { label: '失败', cls: 'v-badge v-badge-error' },
  PARTIAL: { label: '部分', cls: 'v-badge v-badge-warning' },
};

const COMMON_ACTIONS = ['', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE', 'PASSWORD_CHANGE', 'USER_CREATE', 'USER_UPDATE', 'USER_ENABLE', 'USER_DISABLE', 'ROLE_ASSIGN', 'PERMISSION_GRANT'];

export default function AdminLogsPage() {
  const location = useLocation();
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [stats, setStats] = useState<AuditLogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{ action: string; status: string; keyword: string }>({ action: '', status: '', keyword: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        Api.listAuditLogs({
          page, size: pageSize,
          action: filters.action || undefined,
          status: (filters.status as AuditStatus) || undefined,
        }),
        Api.getAuditLogStatistics().catch(() => null),
      ]);
      setLogs(r.items);
      setTotal(r.total);
      setStats(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { setPage(1); /* eslint-disable-next-line */ }, [filters.action, filters.status]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.action, filters.status, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filtered = useMemo(() => {
    if (!filters.keyword) return logs;
    const k = filters.keyword.toLowerCase();
    return logs.filter((l) => [l.action, l.description, l.userId, l.resourceType, l.ipAddress].filter(Boolean).some((s) => s!.toLowerCase().includes(k)));
  }, [logs, filters.keyword]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>日志管理</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>查看系统审计日志（数据源：TECH-IAM /audit-logs）</p>
          </div>
          <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出</button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <div className="v-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12, marginBottom: 6 }}><FileText size={14} />总日志数</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.totalCount}</div>
            </div>
            <div className="v-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 12, marginBottom: 6 }}><CheckCircle2 size={14} />成功</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--success)' }}>{stats.successCount}</div>
            </div>
            <div className="v-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--destructive)', fontSize: 12, marginBottom: 6 }}><AlertTriangle size={14} />失败</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--destructive)' }}>{stats.failureCount}</div>
            </div>
            <div className="v-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12, marginBottom: 6 }}><Activity size={14} />成功率</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.totalCount > 0 ? ((stats.successCount / stats.totalCount) * 100).toFixed(1) : 0}%</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <input className="v-input" style={{ width: '100%', paddingLeft: 32, height: 32 }} placeholder="搜索动作/描述/用户ID..." value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </div>
          <select className="v-input" style={{ height: 32, minWidth: 140 }} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
            <option value="">全部动作</option>
            {COMMON_ACTIONS.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="v-input" style={{ height: 32, minWidth: 120 }} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">全部状态</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILURE">失败</option>
            <option value="PARTIAL">部分</option>
          </select>
          <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} /></button>
        </div>

        {loading ? <PageLoading /> : filtered.length === 0 ? <EmptyState description="暂无日志" /> : (
          <div className="v-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['时间', '动作', '用户ID', '资源', '描述', 'IP', '状态', 'Trace'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const s = STATUS_LABEL[l.status] ?? STATUS_LABEL.SUCCESS;
                  return (
                    <tr key={l.id}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{(l.createdAt ?? '').slice(0, 19).replace('T', ' ')}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{l.action}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{l.userId ?? '-'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{l.resourceType ? (l.resourceId ? l.resourceType + ': ' + l.resourceId.slice(0, 8) : l.resourceType) : '-'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description ?? '-'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{l.ipAddress ?? '-'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span className={s.cls}>{s.label}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{(l.traceId ?? '').slice(0, 8)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}>
                <span>共 <strong style={{ color: 'var(--foreground)' }}>{total}</strong> 条记录</span>
                <span style={{ marginLeft: 8 }}>每页</span>
                <select className="v-input" style={{ height: 28, padding: '0 8px', fontSize: 12 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
                <div style={{ flex: 1 }} />
                <button className="v-btn" disabled={page <= 1} onClick={() => setPage(1)} title="第一页" style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer', height: 28, padding: '0 10px', fontSize: 12 }}>{'«'}</button>
                <button className="v-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} title="上一页" style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer', height: 28, padding: '0 10px', fontSize: 12 }}>{'‹'}</button>
                <span style={{ fontSize: 12, color: 'var(--foreground)', padding: '0 8px' }}><strong>{page}</strong> / {totalPages}</span>
                <button className="v-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} title="下一页" style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer', height: 28, padding: '0 10px', fontSize: 12 }}>{'›'}</button>
                <button className="v-btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="最后一页" style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer', height: 28, padding: '0 10px', fontSize: 12 }}>{'»'}</button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}