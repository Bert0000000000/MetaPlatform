/**
 * 运营数据页
 * 聚合展示 TECH-IAM 的关键指标（用户、角色、权限、登录活跃度等）
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Shield, Key, Activity, TrendingUp, RefreshCw, Clock, LogIn } from 'lucide-react';
import {
  SubTabs, PageLoading, type SubTabItem,
  Api,
} from '@mate/shared';
import type { UserResponse, RoleResponse, PermissionResponse, AuditLogStatistics } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

interface Metric { label: string; value: number | string; sub?: string; icon: ReactNode; tone?: 'default' | 'success' | 'warning' | 'destructive' }

export default function AdminOperationsPage() {
  const location = useLocation();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [perms, setPerms] = useState<PermissionResponse[]>([]);
  const [stats, setStats] = useState<AuditLogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r, p, s] = await Promise.all([
        Api.listUsers({ page: 1, size: 1000 }).catch(() => ({ items: [], total: 0 })),
        Api.listRoles({ page: 1, size: 100 }).catch(() => ({ items: [], total: 0 })),
        Api.listPermissions({ page: 1, size: 500 }).catch(() => ({ items: [], total: 0 })),
        Api.getAuditLogStatistics().catch(() => null),
      ]);
      setUsers(u.items);
      setRoles(r.items);
      setPerms(p.items);
      setStats(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const userEnabled = users.filter((u) => u.status === 'ENABLED').length;
  const userLocked = users.filter((u) => u.status === 'LOCKED').length;
  const userRecent = users.filter((u) => u.lastLoginAt && Date.now() - new Date(u.lastLoginAt).getTime() < 7 * 86400 * 1000).length;
  const roleEnabled = roles.filter((r) => r.enabled).length;
  const systemRoles = roles.filter((r) => r.roleType === 'SYSTEM' || r.roleType === 'BUILTIN').length;
  const customRoles = roles.filter((r) => r.roleType === 'CUSTOM').length;
  const allowPerms = perms.filter((p) => p.effect === 'ALLOW').length;
  const denyPerms = perms.filter((p) => p.effect === 'DENY').length;
  const resourceTypes = new Set(perms.map((p) => p.resourceType)).size;
  const totalLogins = stats?.byAction?.LOGIN ?? 0;
  const totalLoginsFailed = stats?.byAction?.LOGIN_FAILED ?? 0;

  const metrics: Metric[] = [
    { label: '总用户数', value: users.length, sub: '本租户', icon: <Users size={16} />, tone: 'default' },
    { label: '活跃用户', value: userEnabled, sub: '锁定 ' + userLocked + ' / 禁用 ' + (users.length - userEnabled - userLocked), icon: <TrendingUp size={16} />, tone: 'success' },
    { label: '7 日登录', value: userRecent, sub: '曾登录用户', icon: <Clock size={16} />, tone: 'default' },
    { label: '总角色数', value: roles.length, sub: '系统 ' + systemRoles + ' / 自定义 ' + customRoles, icon: <Shield size={16} />, tone: 'default' },
    { label: '启用角色', value: roleEnabled, sub: '共 ' + roles.length + ' 个', icon: <Shield size={16} />, tone: 'success' },
    { label: '权限数', value: perms.length, sub: '覆盖 ' + resourceTypes + ' 类资源 / 允许 ' + allowPerms + ' / 拒绝 ' + denyPerms, icon: <Key size={16} />, tone: 'default' },
    { label: '登录尝试', value: totalLogins, sub: '失败 ' + totalLoginsFailed, icon: <LogIn size={16} />, tone: 'default' },
    { label: '审计日志', value: stats?.totalCount ?? '-', sub: '成功 ' + (stats?.successCount ?? 0) + ' / 失败 ' + (stats?.failureCount ?? 0), icon: <Activity size={16} />, tone: 'default' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>运营数据</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>IAM 模块关键指标聚合（数据源：TECH-IAM）</p>
          </div>
          <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} />刷新</button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error}
          </div>
        )}

        {loading ? <PageLoading /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              {metrics.map((m, i) => {
                const color = m.tone === 'success' ? 'var(--success)' : m.tone === 'warning' ? 'var(--warning)' : m.tone === 'destructive' ? 'var(--destructive)' : 'var(--foreground)';
                return (
                  <div key={i} className="v-card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{m.label}</div>
                      <div style={{ color }}>{m.icon}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 600, color, letterSpacing: '-0.02em', marginBottom: 4 }}>{m.value}</div>
                    {m.sub && <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{m.sub}</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>角色类型分布</h3>
                {[
                  { label: '系统', value: roles.filter((r) => r.roleType === 'SYSTEM').length, color: 'var(--destructive)' },
                  { label: '内置', value: roles.filter((r) => r.roleType === 'BUILTIN').length, color: 'var(--warning)' },
                  { label: '自定义', value: roles.filter((r) => r.roleType === 'CUSTOM').length, color: 'var(--info)' },
                  { label: '外部', value: roles.filter((r) => r.roleType === 'EXTERNAL').length, color: 'var(--muted-foreground)' },
                ].map((r) => {
                  const total = Math.max(1, roles.length);
                  const pct = (r.value / total) * 100;
                  return (
                    <div key={r.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>{r.label}</span>
                        <span style={{ color: 'var(--muted-foreground)' }}>{r.value} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: r.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="v-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>权限资源分布 Top 8</h3>
                {Object.entries(
                  perms.reduce<Record<string, number>>((acc, p) => { acc[p.resourceType] = (acc[p.resourceType] ?? 0) + 1; return acc; }, {})
                ).sort(([, a], [, b]) => b - a).slice(0, 8).map(([k, v]) => {
                  const total = Math.max(1, perms.length);
                  const pct = (v / total) * 100;
                  return (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{k}</span>
                        <span style={{ color: 'var(--muted-foreground)' }}>{v} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: 'var(--primary)', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
                {perms.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>暂无权限数据</p>}
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 24, padding: '8px 12px', background: 'var(--muted)', borderRadius: 4 }}>
              提示：跨模块运营数据（应用、Agent、知识库等）将在后续模块联调时接入。当前为 IAM 模块单源视图。
            </p>
          </>
        )}
      </div>
    </div>
  );
}