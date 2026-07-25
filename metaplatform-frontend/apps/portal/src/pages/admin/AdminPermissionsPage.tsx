/**
 * 权限管理页
 * 数据源：TECH-IAM /api/v1/iam/roles, /api/v1/iam/permissions
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, RefreshCw, Shield, Key, Users, Pencil, Trash2 } from 'lucide-react';
import {
  SubTabs, FormDrawer, FormSection, Field, TextInput, TextArea, Select,
  PageLoading, EmptyState, type SubTabItem,
  Api,
} from '@mate/shared';
import type { RoleResponse, RoleType, PermissionResponse } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

const ROLE_TYPE_LABEL: Record<RoleType, { label: string; cls: string }> = {
  SYSTEM:   { label: '系统',   cls: 'v-badge v-badge-error' },
  BUILTIN:  { label: '内置',   cls: 'v-badge v-badge-warning' },
  CUSTOM:   { label: '自定义', cls: 'v-badge v-badge-info' },
  EXTERNAL: { label: '外部',   cls: 'v-badge v-badge-neutral' },
};

const EFFECT_LABEL: Record<string, { label: string; cls: string }> = {
  ALLOW: { label: '允许', cls: 'v-badge v-badge-success' },
  DENY:  { label: '拒绝', cls: 'v-badge v-badge-error' },
};

export default function AdminPermissionsPage() {
  const location = useLocation();
  const [tab, setTab] = useState<'role' | 'permission'>('role');
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [perms, setPerms] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ roleCode: '', roleName: '', roleType: 'CUSTOM' as RoleType, description: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([
        Api.listRoles({ page: 1, size: 100 }),
        Api.listPermissions({ page: 1, size: 200 }),
      ]);
      setRoles(r.items);
      setPerms(p.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filteredRoles = useMemo(() => {
    if (!keyword) return roles;
    const k = keyword.toLowerCase();
    return roles.filter((r) => [r.roleName, r.roleCode].some((s) => s?.toLowerCase().includes(k)));
  }, [roles, keyword]);

  const permGroups = useMemo(() => {
    const m = new Map<string, PermissionResponse[]>();
    for (const p of perms) {
      const k = p.resourceType || 'OTHER';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [perms]);

  const submit = async () => {
    setSaving(true);
    try {
      if (editing) {
        await Api.updateRole(editing.roleId, { roleName: form.roleName, description: form.description });
      } else {
        await Api.createRole({ roleCode: form.roleCode, roleName: form.roleName, roleType: form.roleType, description: form.description });
      }
      setCreateOpen(false); setEditing(null);
      setForm({ roleCode: '', roleName: '', roleType: 'CUSTOM', description: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: RoleResponse) => {
    if (!window.confirm('确定删除角色「' + r.roleName + '」？')) return;
    try { await Api.deleteRole(r.roleId); await load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '删除失败'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>权限管理</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>管理角色与细粒度权限（数据源：TECH-IAM）</p>
          </div>
          {tab === 'role' && (
            <button className="v-btn-primary" onClick={() => { setEditing(null); setForm({ roleCode: '', roleName: '', roleType: 'CUSTOM', description: '' }); setCreateOpen(true); }}>
              <Plus style={{ width: 14, height: 14 }} />新建角色
            </button>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setTab('role')} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: tab === 'role' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'role' ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}><Shield style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />角色 ({roles.length})</button>
          <button onClick={() => setTab('permission')} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: tab === 'permission' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'permission' ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}><Key style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />权限 ({perms.length})</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <input className="v-input" style={{ width: '100%', paddingLeft: 32, height: 32 }} placeholder={tab === 'role' ? '搜索角色...' : '搜索权限...'} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
          </div>
          <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} /></button>
        </div>

        {loading ? <PageLoading /> : tab === 'role' ? (
          filteredRoles.length === 0 ? <EmptyState description="暂无角色" /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {filteredRoles.map((r) => {
                const t = ROLE_TYPE_LABEL[r.roleType] ?? ROLE_TYPE_LABEL.CUSTOM;
                return (
                  <div key={r.roleId} className="v-card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Shield style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{r.roleName}</span>
                          <span className={t.cls}>{t.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>@{r.roleCode}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="v-btn" onClick={() => { setEditing(r); setForm({ roleCode: r.roleCode, roleName: r.roleName, roleType: r.roleType, description: r.description ?? '' }); setCreateOpen(true); }}><Pencil style={{ width: 12, height: 12 }} /></button>
                        <button className="v-btn" onClick={() => handleDelete(r)} style={{ color: 'var(--destructive)' }}><Trash2 style={{ width: 12, height: 12 }} /></button>
                      </div>
                    </div>
                    {r.description && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12, minHeight: 32 }}>{r.description}</p>}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span><Users style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />{r.memberCount ?? 0} 成员</span>
                      <span><Key style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />{r.permissionCount ?? 0} 权限</span>
                      <span style={{ marginLeft: 'auto' }}>{r.enabled ? '已启用' : '已禁用'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          permGroups.length === 0 ? <EmptyState description="暂无权限" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {permGroups.map(([resourceType, items]) => (
                <div key={resourceType} className="v-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--muted)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key style={{ width: 14, height: 14 }} />{resourceType}
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 400 }}>({items.length})</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['权限名', '权限码', '操作', '效果', '关联角色'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => {
                        const e = EFFECT_LABEL[p.effect] ?? EFFECT_LABEL.ALLOW;
                        return (
                          <tr key={p.permissionId}>
                            <td style={{ padding: '8px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{p.permissionName}</td>
                            <td style={{ padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.permissionCode}</td>
                            <td style={{ padding: '8px 16px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                              {(p.actions ?? []).map((a: string) => <span key={a} className="v-badge v-badge-neutral" style={{ marginRight: 4 }}>{a}</span>)}
                            </td>
                            <td style={{ padding: '8px 16px', fontSize: 12, borderBottom: '1px solid var(--border)' }}><span className={e.cls}>{e.label}</span></td>
                            <td style={{ padding: '8px 16px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.roleCount ?? 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <FormDrawer
        open={createOpen}
        title={editing ? '编辑角色' : '新建角色'}
        onCancel={() => { setCreateOpen(false); setEditing(null); }}
        onOk={submit}
        confirmLoading={saving}
        okText="保存"
      >
        <FormSection title="基本信息">
          <Field label="角色编码" required={!editing}>
            <TextInput value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })} disabled={!!editing} placeholder="如：APP_ADMIN" />
          </Field>
          <Field label="角色名称" required>
            <TextInput value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} placeholder="如：应用管理员" />
          </Field>
          <Field label="类型">
            <Select value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value as RoleType })} disabled={!!editing}>
              <option value="CUSTOM">CUSTOM（自定义）</option>
              <option value="SYSTEM">SYSTEM（系统）</option>
              <option value="BUILTIN">BUILTIN（内置）</option>
              <option value="EXTERNAL">EXTERNAL（外部）</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>
    </div>
  );
}