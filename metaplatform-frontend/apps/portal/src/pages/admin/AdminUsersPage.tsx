/**
 * 用户管理页
 * 真实数据源：TECH-IAM  /api/v1/iam/users
 * 字段映射：UserResponse -> UI Row
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, RefreshCw, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SubTabs, FormDrawer, FormSection, Field, TextInput, TextArea, Select, PageLoading, EmptyState, Api, type SubTabItem } from '@mate/shared';
import type { UserResponse, UserStatus } from '@mate/shared/api';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

const STATUS_LABEL: Record<UserStatus, { label: string; cls: string }> = {
  ENABLED:  { label: '活跃',   cls: 'v-badge v-badge-success' },
  DISABLED: { label: '禁用',   cls: 'v-badge v-badge-warning' },
  LOCKED:   { label: '锁定',   cls: 'v-badge v-badge-error' },
  PENDING:  { label: '未激活', cls: 'v-badge v-badge-warning' },
};

function avatarOf(name?: string | null, idx = 0): { char: string; color: string } {
  const palette = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#dc2626', '#ca8a04', '#7c3aed'];
  const char = (name && name.trim().charAt(0)) || '?';
  return { char, color: palette[idx % palette.length] };
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function AdminUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ realName: '', username: '', email: '', password: '', phone: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await Api.listUsers({ page, size: pageSize, status: statusFilter === 'ALL' ? undefined : statusFilter });
      setUsers(resp.items);
      setTotal(resp.total);
      if (resp.items.length && !selectedId) setSelectedId(resp.items[0].id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 状态筛选变化时回到第一页
  useEffect(() => { setPage(1); /* eslint-disable-next-line */ }, [statusFilter]);
  // 翻页/换 pageSize 时清空选中（防止选中不存在于新页面的用户）
  useEffect(() => { setSelectedId(null); /* eslint-disable-next-line */ }, [page, pageSize]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, statusFilter]);

  const filtered = useMemo(() => {
    if (!keyword) return users;
    const k = keyword.toLowerCase();
    return users.filter((u) =>
      [u.username, u.email, u.realName].filter(Boolean).some((s) => s!.toLowerCase().includes(k))
    );
  }, [users, keyword]);

  const selected = users.find((u) => u.id === selectedId) ?? filtered[0] ?? null;

  // 当前页（用于状态细分）+ 全部用户（仅用于总数）
  const counts = useMemo(() => {
    const c = { total, enabled: 0, disabled: 0, locked: 0, pending: 0 };
    for (const u of users) c[u.status.toLowerCase() as 'enabled' | 'disabled' | 'locked' | 'pending']++;
    return c;
  }, [users, total]);

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) {
      setError('请填写用户名、邮箱和密码');
      return;
    }
    setCreating(true);
    try {
      await Api.createUser({ username: form.username, email: form.email, password: form.password, realName: form.realName, phone: form.phone });
      setCreateOpen(false);
      setForm({ realName: '', username: '', email: '', password: '', phone: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusToggle = async (u: UserResponse) => {
    const next: UserStatus = u.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      await Api.updateUserStatus(u.id, next);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '更新状态失败');
    }
  };

  const handleDelete = async (u: UserResponse) => {
    if (!window.confirm(`确定删除用户 "${u.username}" ？`)) return;
    try {
      await Api.deleteUser(u.id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="au-page-header">
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>用户管理</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>管理平台用户账号、角色与权限（数据源：TECH-IAM）</p>
        </div>

        {/* Stats */}
        <div className="au-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>总用户</div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>{counts.total}</div>
          </div>
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>活跃</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--success)' }}>{counts.enabled}</div>
          </div>
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>锁定</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--destructive)' }}>{counts.locked}</div>
          </div>
          <div className="v-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>禁用/未激活</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--warning)' }}>{counts.disabled + counts.pending}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <input
              className="v-input"
              style={{ width: '100%', paddingLeft: 36 }}
              placeholder="搜索姓名、用户名或邮箱..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          </div>
          <select
            className="v-input"
            style={{ height: 36, minWidth: 120 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | UserStatus)}
          >
            <option value="ALL">全部状态</option>
            <option value="ENABLED">活跃</option>
            <option value="DISABLED">禁用</option>
            <option value="LOCKED">锁定</option>
            <option value="PENDING">未激活</option>
          </select>
          <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} /></button>
          <div style={{ flex: 1 }} />
          <button className="v-btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus style={{ width: 16, height: 16 }} />新建用户
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error}
            <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {loading ? (
          <PageLoading />
        ) : filtered.length === 0 ? (
          <EmptyState description="调整筛选条件或点击「新建用户」开始" />
        ) : (
          <div className="v-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['用户', '邮箱', '状态', '最后登录', '创建时间', '操作'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => {
                  const st = STATUS_LABEL[u.status] ?? STATUS_LABEL.PENDING;
                  const av = avatarOf(u.realName ?? u.username, idx);
                  return (
                    <tr key={u.id} onClick={() => setSelectedId(u.id)} style={{ cursor: 'pointer', background: u.id === selectedId ? 'var(--accent)' : undefined }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: av.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>{av.char}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.realName || u.username}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><span className={st.cls}>{st.label}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{fmtTime(u.lastLoginAt)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>{fmtTime(u.createdAt)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="au-action-link" onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); setEditOpen(true); }}><Pencil style={{ width: 12, height: 12 }} />编辑</button>
                          <button className="au-action-link" onClick={(e) => { e.stopPropagation(); handleStatusToggle(u); }}>{u.status === 'ENABLED' ? '禁用' : '启用'}</button>
                          <button className="au-action-link danger" onClick={(e) => { e.stopPropagation(); handleDelete(u); }}><Trash2 style={{ width: 12, height: 12 }} />删除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* 分页 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}>
              <span>共 <strong style={{ color: 'var(--foreground)' }}>{total}</strong> 个用户</span>
              <span style={{ marginLeft: 8 }}>每页</span>
              <select
                className='v-input'
                style={{ height: 28, padding: '0 8px', fontSize: 12 }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <div style={{ flex: 1 }} />
              <button
                className='au-action-link'
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title='第一页'
                style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              ><ChevronsLeft size={14} /></button>
              <button
                className='au-action-link'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title='上一页'
                style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              ><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 12, color: 'var(--foreground)', padding: '0 8px' }}>
                <strong>{page}</strong> / {totalPages}
              </span>
              <button
                className='au-action-link'
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title='下一页'
                style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              ><ChevronRight size={14} /></button>
              <button
                className='au-action-link'
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                title='最后一页'
                style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              ><ChevronsRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* 创建用户 Drawer */}
      <FormDrawer
        open={createOpen}
        title="新建用户"
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
      >
        <FormSection title="账号信息">
          <Field label="姓名"><TextInput value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} placeholder="如：张三" /></Field>
          <Field label="用户名" required><TextInput value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="如：zhangsan" /></Field>
          <Field label="邮箱" required><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="zhangsan@metaplatform.com" /></Field>
          <Field label="密码" required><TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位，包含大写/小写/数字/特殊字符中 3 类" /></Field>
          <Field label="手机"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="可选" /></Field>
        </FormSection>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0' }}>
          提示：新建用户默认启用状态，需要登录后由用户自行修改初始密码。
        </div>
      </FormDrawer>

      {/* 编辑用户 Drawer */}
      <FormDrawer
        open={editOpen}
        title={`编辑用户：${selected?.username ?? ''}`}
        onCancel={() => setEditOpen(false)}
        onOk={async () => {
          if (!selected) return;
          try {
            await Api.updateUser(selected.id, { realName: selected.realName, email: selected.email, phone: selected.phone });
            setEditOpen(false);
            await load();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : '更新失败');
          }
        }}
        okText="保存"
      >
        {selected && (
          <FormSection title="基本信息">
            <Field label="用户 ID"><TextInput value={selected.id} disabled /></Field>
            <Field label="用户名"><TextInput value={selected.username} disabled /></Field>
            <Field label="姓名"><TextInput value={selected.realName ?? ''} onChange={(e) => {
              const updated = { ...selected, realName: e.target.value };
              setUsers((us) => us.map((u) => (u.id === selected.id ? updated : u)));
            }} /></Field>
            <Field label="邮箱"><TextInput type="email" value={selected.email} onChange={(e) => {
              const updated = { ...selected, email: e.target.value };
              setUsers((us) => us.map((u) => (u.id === selected.id ? updated : u)));
            }} /></Field>
            <Field label="手机"><TextInput value={selected.phone ?? ''} onChange={(e) => {
              const updated = { ...selected, phone: e.target.value };
              setUsers((us) => us.map((u) => (u.id === selected.id ? updated : u)));
            }} /></Field>
            <Field label="状态">
              <Select value={selected.status} onChange={(e) => {
                const updated = { ...selected, status: e.target.value as UserStatus };
                setUsers((us) => us.map((u) => (u.id === selected.id ? updated : u)));
              }}>
                <option value="ENABLED">ENABLED（活跃）</option>
                <option value="DISABLED">DISABLED（禁用）</option>
                <option value="LOCKED">LOCKED（锁定）</option>
                <option value="PENDING">PENDING（未激活）</option>
              </Select>
            </Field>
          </FormSection>
        )}
      </FormDrawer>
    </div>
  );
}