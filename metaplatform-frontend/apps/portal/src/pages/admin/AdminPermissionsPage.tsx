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
import type { RoleResponse, RoleType, PermissionResponse, PermissionEffect } from '@mate/shared/api';

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

const ACTION_OPTIONS = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'ADMIN'];
const RESOURCE_TYPES = ['APP', 'AGENT', 'KB', 'MCP', 'IAM', 'ONT', 'EA', 'OBS', 'RAG', 'DASHBOARD', 'WORKFLOW'];

interface RoleForm { roleCode: string; roleName: string; roleType: RoleType; description: string; }
interface PermForm {
  permissionCode: string;
  permissionName: string;
  resourceType: string;
  actions: string[];
  effect: PermissionEffect;
  description: string;
}

const EMPTY_ROLE_FORM: RoleForm = { roleCode: '', roleName: '', roleType: 'CUSTOM', description: '' };
const EMPTY_PERM_FORM: PermForm = { permissionCode: '', permissionName: '', resourceType: 'APP', actions: ['READ'], effect: 'ALLOW', description: '' };

export default function AdminPermissionsPage() {
  const location = useLocation();
  const [tab, setTab] = useState<'role' | 'permission'>('role');
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [perms, setPerms] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
  const [permFormOpen, setPermFormOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<PermissionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE_FORM);
  const [permForm, setPermForm] = useState<PermForm>(EMPTY_PERM_FORM);

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

  const filteredPerms = useMemo(() => {
    if (!keyword) return perms;
    const k = keyword.toLowerCase();
    return perms.filter((p) => [p.permissionName, p.permissionCode, p.resourceType].some((s) => s?.toLowerCase().includes(k)));
  }, [perms, keyword]);

  const permGroups = useMemo(() => {
    const m = new Map<string, PermissionResponse[]>();
    for (const p of filteredPerms) {
      const k = p.resourceType || 'OTHER';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPerms]);

  // === Role CRUD ===
  const submitRole = async () => {
    setSaving(true);
    try {
      if (editingRole) {
        await Api.updateRole(editingRole.roleId, { roleName: roleForm.roleName, description: roleForm.description });
      } else {
        await Api.createRole({ roleCode: roleForm.roleCode, roleName: roleForm.roleName, roleType: roleForm.roleType, description: roleForm.description });
      }
      setRoleFormOpen(false); setEditingRole(null); setRoleForm(EMPTY_ROLE_FORM);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (r: RoleResponse) => {
    if (!window.confirm('确定删除角色「' + r.roleName + '」？')) return;
    try { await Api.deleteRole(r.roleId); await load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '删除失败'); }
  };

  // === Permission CRUD ===
  const submitPerm = async () => {
    setSaving(true);
    try {
      if (editingPerm) {
        await Api.updatePermission(editingPerm.permissionId, { permissionName: permForm.permissionName, actions: permForm.actions, effect: permForm.effect, description: permForm.description });
      } else {
        await Api.createPermission({ permissionCode: permForm.permissionCode, permissionName: permForm.permissionName, resourceType: permForm.resourceType, actions: permForm.actions, effect: permForm.effect, description: permForm.description });
      }
      setPermFormOpen(false); setEditingPerm(null); setPermForm(EMPTY_PERM_FORM);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePerm = async (p: PermissionResponse) => {
    if (!window.confirm('确定删除权限「' + p.permissionName + '」？')) return;
    try { await Api.deletePermission(p.permissionId); await load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '删除失败'); }
  };

  const toggleAction = (a: string) => {
    setPermForm((f) => ({
      ...f,
      actions: f.actions.includes(a) ? f.actions.filter((x) => x !== a) : [...f.actions, a],
    }));
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
          <button
            className="v-btn-primary"
            onClick={() => {
              if (tab === 'role') {
                setEditingRole(null); setRoleForm(EMPTY_ROLE_FORM); setRoleFormOpen(true);
              } else {
                setEditingPerm(null); setPermForm(EMPTY_PERM_FORM); setPermFormOpen(true);
              }
            }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            {tab === 'role' ? '新建角色' : '新建权限'}
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setTab('role')} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: tab === 'role' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'role' ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            <Shield style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />角色 ({roles.length})
          </button>
          <button onClick={() => setTab('permission')} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: tab === 'permission' ? '2px solid var(--primary)' : '2px solid transparent', color: tab === 'permission' ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            <Key style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />权限 ({perms.length})
          </button>
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
                        <button className="au-action-link" onClick={() => { setEditingRole(r); setRoleForm({ roleCode: r.roleCode, roleName: r.roleName, roleType: r.roleType, description: r.description ?? '' }); setRoleFormOpen(true); }}><Pencil style={{ width: 12, height: 12 }} /></button>
                        <button className="au-action-link danger" onClick={() => handleDeleteRole(r)}><Trash2 style={{ width: 12, height: 12 }} /></button>
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
                        {['权限名', '权限码', '操作', '效果', '关联角色', ''].map((h) => (
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
                            <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="au-action-link" onClick={() => { setEditingPerm(p); setPermForm({ permissionCode: p.permissionCode, permissionName: p.permissionName, resourceType: p.resourceType, actions: p.actions ?? [], effect: p.effect, description: p.description ?? '' }); setPermFormOpen(true); }}><Pencil style={{ width: 12, height: 12 }} /></button>
                                <button className="au-action-link danger" onClick={() => handleDeletePerm(p)}><Trash2 style={{ width: 12, height: 12 }} /></button>
                              </div>
                            </td>
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

      {/* Role Drawer */}
      <FormDrawer
        open={roleFormOpen}
        title={editingRole ? '编辑角色' : '新建角色'}
        onCancel={() => { setRoleFormOpen(false); setEditingRole(null); }}
        onOk={submitRole}
        confirmLoading={saving}
        okText="保存"
      >
        <FormSection title="基本信息">
          <Field label="角色编码" required={!editingRole}>
            <TextInput value={roleForm.roleCode} onChange={(e) => setRoleForm({ ...roleForm, roleCode: e.target.value })} disabled={!!editingRole} placeholder="如：APP_ADMIN" />
          </Field>
          <Field label="角色名称" required>
            <TextInput value={roleForm.roleName} onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })} placeholder="如：应用管理员" />
          </Field>
          <Field label="类型">
            <Select value={roleForm.roleType} onChange={(e) => setRoleForm({ ...roleForm, roleType: e.target.value as RoleType })} disabled={!!editingRole}>
              <option value="CUSTOM">CUSTOM（自定义）</option>
              <option value="SYSTEM">SYSTEM（系统）</option>
              <option value="BUILTIN">BUILTIN（内置）</option>
              <option value="EXTERNAL">EXTERNAL（外部）</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>

      {/* Permission Drawer */}
      <FormDrawer
        open={permFormOpen}
        title={editingPerm ? '编辑权限' : '新建权限'}
        onCancel={() => { setPermFormOpen(false); setEditingPerm(null); }}
        onOk={submitPerm}
        confirmLoading={saving}
        okText="保存"
      >
        <FormSection title="基本信息">
          <Field label="权限编码" required={!editingPerm}>
            <TextInput value={permForm.permissionCode} onChange={(e) => setPermForm({ ...permForm, permissionCode: e.target.value })} disabled={!!editingPerm} placeholder="如：app:read" style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
          <Field label="权限名称" required>
            <TextInput value={permForm.permissionName} onChange={(e) => setPermForm({ ...permForm, permissionName: e.target.value })} placeholder="如：查看应用" />
          </Field>
          <Field label="资源类型" required>
            <select
              className="v-input"
              style={{ height: 32, width: '100%' }}
              value={permForm.resourceType}
              onChange={(e) => setPermForm({ ...permForm, resourceType: e.target.value })}
              disabled={!!editingPerm}
            >
              {RESOURCE_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              <option value="OTHER">OTHER（其它）</option>
            </select>
          </Field>
        </FormSection>
        <FormSection title="操作（可多选）">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACTION_OPTIONS.map((a) => {
              const on = permForm.actions.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => !editingPerm && toggleAction(a)}
                  disabled={!!editingPerm}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    cursor: editingPerm ? 'not-allowed' : 'pointer',
                    border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                    background: on ? 'var(--primary)' : 'transparent',
                    color: on ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </FormSection>
        <FormSection title="效果">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['ALLOW', 'DENY'] as PermissionEffect[]).map((eff) => {
              const on = permForm.effect === eff;
              return (
                <button
                  key={eff}
                  type="button"
                  onClick={() => setPermForm({ ...permForm, effect: eff })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 4,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                    background: on ? 'var(--primary)' : 'transparent',
                    color: on ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {eff === 'ALLOW' ? '允许' : '拒绝'}
                </button>
              );
            })}
          </div>
        </FormSection>
        <FormSection title="描述">
          <TextArea value={permForm.description} onChange={(e) => setPermForm({ ...permForm, description: e.target.value })} rows={3} />
        </FormSection>
      </FormDrawer>
    </div>
  );
}
