/**
 * 权限管理页
 * 数据源：TECH-IAM /api/v1/iam/roles, /api/v1/iam/permissions
 * 设计稿：metaplatform-design-draft/pages/admin-permissions.html
 *
 * 布局：
 *   - 顶部 Stats：角色数 / 权限策略 / API 权限 / 数据权限
 *   - 左 280px：角色列表（带图标 + 描述 + 成员数）
 *   - 右：选中角色的详情
 *     - 基本信息（名称/描述/关联用户数 + 编辑）
 *     - 菜单权限（树形复选框：工作台/架构/应用/本体/MCP/知识库/数字员工/后台）
 *     - API 权限（表格：路径/方法/描述/授权）
 *     - 数据权限（数据范围：全部/本部门/本人 + 脱敏规则：手机/邮箱/身份证）
 *   - 底部：保存更改 / 取消
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Crown, Shield, UserCog, Code, BarChart3, Server, User, Eye,
  Info, Menu, KeyRound, Database, Pencil, Check, X,
  LayoutDashboard, GitBranch, Boxes, Database as DbIcon, Plug,
  BookOpen, Bot, Settings,
} from 'lucide-react';
import {
  SubTabs, type SubTabItem,
  Api,
} from '@mate/shared';
import type { RoleResponse, RoleType } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

const ROLE_TYPE_BADGE: Record<RoleType, { label: string; cls: string }> = {
  SYSTEM:   { label: '系统',   cls: 'v-badge v-badge-error' },
  BUILTIN:  { label: '内置',   cls: 'v-badge v-badge-warning' },
  CUSTOM:   { label: '自定义', cls: 'v-badge v-badge-info' },
  EXTERNAL: { label: '外部',   cls: 'v-badge v-badge-neutral' },
};

const ROLE_ICON: Record<string, typeof Crown> = {
  SUPER_ADMIN: Crown,
  ADMIN: Shield,
  SYSTEM: Shield,
  BUILTIN: UserCog,
  MODULE_ADMIN: UserCog,
  DEVELOPER: Code,
  ANALYST: BarChart3,
  OPERATOR: Server,
  VIEWER: Eye,
  USER: User,
};

// 菜单权限树（设计稿）
const MENU_TREE = [
  { id: 'ws',     label: '工作台',     icon: LayoutDashboard, children: [{ id: 'ws-view', label: '查看' }, { id: 'ws-manage', label: '管理' }] },
  { id: 'arch',   label: '架构中心',   icon: GitBranch,       children: [{ id: 'arch-view', label: '查看' }, { id: 'arch-edit', label: '编辑' }] },
  { id: 'apps',   label: '应用中心',   icon: Boxes,           children: [{ id: 'apps-view', label: '查看' }, { id: 'apps-edit', label: '编辑' }, { id: 'apps-publish', label: '发布' }] },
  { id: 'ont',    label: '本体引擎',   icon: DbIcon,          children: [{ id: 'ont-view', label: '查看' }, { id: 'ont-edit', label: '编辑' }, { id: 'ont-manage', label: '管理' }] },
  { id: 'mcp',    label: 'MCP 中心',   icon: Plug,            children: [{ id: 'mcp-view', label: '查看' }, { id: 'mcp-manage', label: '管理' }] },
  { id: 'kb',     label: '知识库',     icon: BookOpen,        children: [{ id: 'kb-view', label: '查看' }, { id: 'kb-write', label: '编辑' }] },
  { id: 'agent',  label: '数字员工',   icon: Bot,             children: [{ id: 'agent-view', label: '查看' }, { id: 'agent-write', label: '编辑' }, { id: 'agent-run', label: '执行' }] },
  { id: 'admin',  label: '后台管理',   icon: Settings,        children: [{ id: 'admin-view', label: '查看' }, { id: 'admin-write', label: '编辑' }, { id: 'admin-system', label: '系统设置' }] },
];

// 模拟 API 权限表（后续可对接 ABAC Policy）
const API_PERMS = [
  { path: '/api/v1/ont/classes',    method: 'GET',    desc: '查询本体分类列表',   authorized: true },
  { path: '/api/v1/ont/classes',    method: 'POST',   desc: '创建本体分类',       authorized: true },
  { path: '/api/v1/ont/classes/{id}', method: 'PUT',    desc: '更新本体分类定义',   authorized: true },
  { path: '/api/v1/apps/{id}/deploy', method: 'POST',  desc: '部署应用至运行环境', authorized: false },
  { path: '/api/v1/iam/users',       method: 'DELETE', desc: '删除用户账号',       authorized: false },
];

// 数据范围
const DATA_SCOPES = [
  { value: 'ALL', label: '全部' },
  { value: 'DEPT', label: '本部门' },
  { value: 'SELF', label: '本人' },
];

// 脱敏规则
interface MaskingRule { field: string; preview: string; enabled: boolean }
const DEFAULT_MASKING: MaskingRule[] = [
  { field: '手机号', preview: '138****5678',     enabled: true  },
  { field: '邮箱',   preview: 'z****@example.com', enabled: true  },
  { field: '身份证', preview: '110***********1234', enabled: false },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    '#62d178',
  POST:   '#60a5fa',
  PUT:    '#eab308',
  DELETE: '#ff6166',
  PATCH:  '#a78bfa',
};

export default function AdminPermissionsPage() {
  const location = useLocation();
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [menuPerms, setMenuPerms] = useState<Set<string>>(new Set());
  const [apiPerms, setApiPerms] = useState<Set<string>>(new Set());
  const [dataScope, setDataScope] = useState('DEPT');
  const [masking, setMasking] = useState<MaskingRule[]>(DEFAULT_MASKING);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, p] = await Promise.all([
        Api.listRoles({ page: 1, size: 100 }).catch(() => ({ items: [], total: 0 })),
        Api.listPermissions({ page: 1, size: 200 }).catch(() => ({ items: [], total: 0 })),
      ]);
      setRoles(r.items);
      setPerms(p.items);
      if (r.items.length > 0) {
        selectRole(r.items[0]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const selectRole = (r: RoleResponse) => {
    setSelectedRoleId(r.roleId);
    setEditingInfo(false);
    setEditingName(r.roleName);
    setEditingDesc(r.description ?? '');
  };

  const selected = useMemo(() => roles.find((r) => r.roleId === selectedRoleId) ?? null, [roles, selectedRoleId]);

  const toggleMenu = (id: string) => {
    setMenuPerms((s) => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  };

  const toggleAllInParent = (parentId: string, children: { id: string }[]) => {
    setMenuPerms((s) => {
      const ns = new Set(s);
      const allOn = children.every((c) => s.has(c.id));
      children.forEach((c) => allOn ? ns.delete(c.id) : ns.add(c.id));
      if (allOn) ns.delete(parentId); else ns.add(parentId);
      return ns;
    });
  };

  const toggleApi = (key: string) => {
    setApiPerms((s) => { const ns = new Set(s); ns.has(key) ? ns.delete(key) : ns.add(key); return ns; });
  };

  const toggleMasking = (field: string) => {
    setMasking((m) => m.map((r) => r.field === field ? { ...r, enabled: !r.enabled } : r));
  };

  const save = () => {
    // 实际项目中这里应调 Api.assignRolePermissions 等
    setEditingInfo(false);
  };

  // 选中角色的图标
  const SelectedIcon = selected ? (ROLE_ICON[selected.roleCode] || ROLE_ICON[selected.roleType] || Shield) : Shield;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* 标题 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>权限管理</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>角色与权限策略配置</p>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>角色数</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{roles.length}</span>
          </div>
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>权限策略</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{perms.length}</span>
          </div>
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>API 权限</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{API_PERMS.length}</span>
          </div>
          <div className="v-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>数据权限</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{masking.length}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted-foreground)' }}>加载中...</div>
        ) : roles.length === 0 ? (
          <div className="v-card" style={{ padding: 60, textAlign: 'center', color: 'var(--muted-foreground)' }}>
            暂无角色。可通过 TECH-IAM 后端 API 创建角色后此处会显示。
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* 左：角色列表 */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div className="v-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {roles.map((r) => {
                    const Icon = ROLE_ICON[r.roleCode] || ROLE_ICON[r.roleType] || Shield;
                    const isActive = r.roleId === selectedRoleId;
                    return (
                      <div
                        key={r.roleId}
                        onClick={() => selectRole(r)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          border: '1px solid ' + (isActive ? 'var(--border)' : 'transparent'),
                          background: isActive ? 'var(--muted)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={16} style={{ color: r.roleType === 'SYSTEM' ? 'var(--warning)' : r.roleType === 'BUILTIN' ? '#60a5fa' : 'var(--foreground)' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.roleName}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 9999, padding: '1px 7px', flexShrink: 0 }}>{r.memberCount ?? 0}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, paddingLeft: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.description || '暂无描述'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 右：详情 */}
            {selected ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 基本信息 */}
                <div className="v-card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <Info size={16} style={{ color: 'var(--muted-foreground)' }} />基本信息
                    </h3>
                    {!editingInfo ? (
                      <button className="v-btn" onClick={() => setEditingInfo(true)} style={{ height: 30, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Pencil size={13} />编辑
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="v-btn" onClick={() => { setEditingInfo(false); setEditingName(selected.roleName); setEditingDesc(selected.description ?? ''); }} style={{ height: 30, fontSize: 12, padding: '0 10px' }}>取消</button>
                        <button className="v-btn-primary" onClick={save} style={{ height: 30, fontSize: 12, padding: '0 10px' }}>保存</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>角色名称</span>
                      {editingInfo ? (
                        <input className="v-input" style={{ height: 32, fontSize: 13 }} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <SelectedIcon size={16} style={{ color: 'var(--muted-foreground)' }} />
                          {selected.roleName}
                          <span className={ROLE_TYPE_BADGE[selected.roleType]?.cls || 'v-badge v-badge-neutral'}>{ROLE_TYPE_BADGE[selected.roleType]?.label || selected.roleType}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>关联用户数</span>
                      <span style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {selected.memberCount ?? 0}
                        <span className="v-badge v-badge-success">活跃</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>角色编码</span>
                      <span style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>@{selected.roleCode}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>描述</span>
                      {editingInfo ? (
                        <textarea className="v-input" style={{ minHeight: 60, fontSize: 13 }} value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}>{selected.description || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 菜单权限 */}
                <div className="v-card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <Menu size={16} style={{ color: 'var(--muted-foreground)' }} />菜单权限
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>已选 {menuPerms.size} 项</span>
                  </div>
                  <div>
                    {MENU_TREE.map((p) => {
                      const PIcon = p.icon;
                      const allOn = p.children.every((c) => menuPerms.has(c.id));
                      const someOn = p.children.some((c) => menuPerms.has(c.id));
                      return (
                        <div key={p.id} style={{ marginBottom: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={allOn}
                              ref={(el) => { if (el) el.indeterminate = !allOn && someOn; }}
                              onChange={() => toggleAllInParent(p.id, p.children)}
                              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                            />
                            <PIcon size={15} style={{ color: 'var(--muted-foreground)' }} />
                            <span>{p.label}</span>
                          </label>
                          <div style={{ paddingLeft: 28, display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
                            {p.children.map((c) => (
                              <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={menuPerms.has(c.id)}
                                  onChange={() => toggleMenu(c.id)}
                                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }}
                                />
                                {c.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* API 权限 */}
                <div className="v-card" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <KeyRound size={16} style={{ color: 'var(--muted-foreground)' }} />API 权限
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{API_PERMS.length} 条规则 · 已授权 {apiPerms.size}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['API 路径', '方法', '描述', '授权'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {API_PERMS.map((api, i) => {
                        const key = api.path + ':' + api.method;
                        const on = apiPerms.has(key);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>{api.path}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: METHOD_COLOR[api.method] || 'var(--muted-foreground)', background: 'var(--muted)' }}>{api.method}</span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--muted-foreground)' }}>{api.desc}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div
                                onClick={() => toggleApi(key)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: on ? 'rgba(98,209,120,0.12)' : 'rgba(255,97,102,0.10)', color: on ? 'var(--success)' : 'var(--destructive)' }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--success)' : 'var(--destructive)' }} />
                                {on ? '已授权' : '未授权'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 数据权限 */}
                <div className="v-card" style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
                    <Database size={16} style={{ color: 'var(--muted-foreground)' }} />数据权限
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted-foreground)', flexShrink: 0 }}>数据范围</span>
                    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      {DATA_SCOPES.map((s, i) => (
                        <div
                          key={s.value}
                          onClick={() => setDataScope(s.value)}
                          style={{
                            padding: '7px 18px',
                            fontSize: 13,
                            cursor: 'pointer',
                            borderRight: i < DATA_SCOPES.length - 1 ? '1px solid var(--border)' : 'none',
                            color: dataScope === s.value ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                            background: dataScope === s.value ? 'var(--primary)' : 'transparent',
                            fontWeight: dataScope === s.value ? 500 : 400,
                            transition: 'all 0.15s',
                          }}
                        >
                          {s.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', marginBottom: 10 }}>数据脱敏规则</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {masking.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)' }}>{m.field}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '3px 8px', borderRadius: 3 }}>{m.preview}</span>
                          <div
                            onClick={() => toggleMasking(m.field)}
                            style={{
                              position: 'relative', width: 36, height: 20, background: m.enabled ? 'var(--success)' : 'var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
                            }}
                          >
                            <div style={{
                              position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--foreground)', transition: 'transform 0.2s', transform: m.enabled ? 'translateX(16px)' : 'translateX(0)',
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 保存栏 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                  <button className="v-btn" onClick={() => { setMenuPerms(new Set()); setApiPerms(new Set()); setDataScope('DEPT'); setMasking(DEFAULT_MASKING); }}>取消</button>
                  <button className="v-btn-primary" onClick={save}><Check size={14} style={{ display: 'inline', marginRight: 4 }} />保存更改</button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
