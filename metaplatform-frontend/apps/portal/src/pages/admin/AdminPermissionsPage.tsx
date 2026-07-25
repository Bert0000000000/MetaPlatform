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
  Info, Menu, KeyRound, Database, Pencil, Check, X, Plus,
  LayoutDashboard, GitBranch, Boxes, Database as DbIcon, Plug,
  BookOpen, Bot, Settings,
} from 'lucide-react';
import {
  SubTabs, FormDrawer, FormSection, Field, TextInput, TextArea, Select, type SubTabItem, Api,
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
  // 未保存修改跟踪（true = 有未保存改动）
  const [infoDirty, setInfoDirty] = useState(false);
  const [policyDirty, setPolicyDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ roleCode: '', roleName: '', roleType: 'CUSTOM' as RoleType, description: '' });

  const submitCreate = async () => {
    setCreating(true);
    try {
      const created = await Api.createRole({ roleCode: createForm.roleCode, roleName: createForm.roleName, roleType: createForm.roleType, description: createForm.description });
      setCreateOpen(false);
      setCreateForm({ roleCode: '', roleName: '', roleType: 'CUSTOM', description: '' });
      await load();
      if (created?.roleId) selectRole(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

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
    // 切换角色时：从 r.policy 加载该角色的策略，重置所有修改状态
    loadPolicyFromRole(r);
  };

  // 从 role 加载策略到本地状态
  const loadPolicyFromRole = (r: RoleResponse) => {
    setPolicyDirty(false);
    setInfoDirty(false);
    // 尝试从 policy 字段读取（如果有）或从 description 字段读取（带魔术前缀）
    let policyStr: string | undefined = r.policy;
    if (!policyStr && r.description && r.description.startsWith('__METAPLATFORM_POLICY__:')) {
      policyStr = r.description.substring('__METAPLATFORM_POLICY__:'.length);
    }
    if (policyStr && policyStr.startsWith('{') && policyStr.includes('"menuPerms"')) {
      try {
        const p = JSON.parse(policyStr);
        setMenuPerms(new Set(Array.isArray(p.menuPerms) ? p.menuPerms : []));
        setApiPerms(new Set(Array.isArray(p.apiPerms) ? p.apiPerms : []));
        setDataScope(typeof p.dataScope === 'string' ? p.dataScope : 'DEPT');
        setMasking(Array.isArray(p.masking) ? p.masking : DEFAULT_MASKING);
        return;
      } catch (e) {
        // ignore parse error
      }
    }
    setMenuPerms(new Set());
    setApiPerms(new Set());
    setDataScope('DEPT');
    setMasking(DEFAULT_MASKING);
  };

  // 获取要显示在 "描述" 字段的文本（剥掉 policy 前缀）
  const getDisplayDescription = (r: RoleResponse): string => {
    if (!r.description) return '';
    if (r.description.startsWith('__METAPLATFORM_POLICY__:')) return '';
    // 旧的/无前缀的纯 JSON 也隐藏（识别 policy JSON 格式）
    const t = r.description.trim();
    if (t.startsWith('{') && t.includes('"menuPerms"')) return '';
    return r.description;
  };

  const selected = useMemo(() => roles.find((r) => r.roleId === selectedRoleId) ?? null, [roles, selectedRoleId]);

  const toggleMenu = (id: string) => {
    setMenuPerms((s) => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
    setPolicyDirty(true);
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
    setPolicyDirty(true);
  };

  const toggleMasking = (field: string) => {
    setMasking((m) => m.map((r) => r.field === field ? { ...r, enabled: !r.enabled } : r));
    setPolicyDirty(true);
  };

  const saveInfo = async () => {
    if (!selected) return;
    try {
      await Api.updateRole(selected.roleId, {
        roleName: editingName,
        description: editingDesc,
        version: selected.version,  // 乐观锁必需
      });
      setInfoDirty(false);
      setEditingInfo(false);
      // 不调用 load() 以免跳到第一个角色，改为刷新当前角色
      const updated = await Api.getRole(selected.roleId);
      if (updated?.roleId === selected.roleId) {
        setSelectedRoleId(null);  // force re-render
        setTimeout(() => setSelectedRoleId(updated.roleId), 0);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  };

  const savePolicy = async () => {
    if (!selected) return;
    try {
      const policy = JSON.stringify({
        menuPerms: [...menuPerms],
        apiPerms: [...apiPerms],
        dataScope,
        masking,
      });
      // 存到 description 字段（policy 字段需要后端 schema 升级），用魔术前缀识别
      await Api.updateRole(selected.roleId, {
        description: '__METAPLATFORM_POLICY__:' + policy,
        version: selected.version,
      });
      setPolicyDirty(false);
      // 重新拉取当前角色以更新本地版本号，避免跳到第一个角色
      const updated = await Api.getRole(selected.roleId);
      if (updated?.roleId === selected.roleId) {
        setSelectedRoleId(null);
        setTimeout(() => setSelectedRoleId(updated.roleId), 0);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  };

  const discardChanges = () => {
    setMenuPerms(new Set());
    setApiPerms(new Set());
    setDataScope('DEPT');
    setMasking(DEFAULT_MASKING);
    setPolicyDirty(false);
  };

  // 选中角色的图标
  const SelectedIcon = selected ? (ROLE_ICON[selected.roleCode] || ROLE_ICON[selected.roleType] || Shield) : Shield;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>权限管理</h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>角色与权限策略配置</p>
          </div>
          <button className="v-btn-primary" onClick={() => setCreateOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />新建角色
          </button>
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
                          {getDisplayDescription(r) || '暂无描述'}
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
                        <button className='v-btn-primary' onClick={saveInfo} style={{ height: 30, fontSize: 12, padding: '0 10px' }}>保存</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>角色名称</span>
                      {editingInfo ? (
                        <input className="v-input" style={{ height: 32, fontSize: 13 }} value={editingName} onChange={(e) => { setEditingName(e.target.value); setInfoDirty(true); }} />
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
                        <textarea className="v-input" style={{ minHeight: 60, fontSize: 13 }} value={editingDesc} onChange={(e) => { setEditingDesc(e.target.value); setInfoDirty(true); }} placeholder={selected.description?.startsWith('__METAPLATFORM_POLICY__:') ? '(此角色的描述用于存储策略配置)' : ''} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}>{getDisplayDescription(selected) || '—'}</span>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', background: 'var(--muted)', width: '36%' }}>模块</th>
                        <th colSpan={2} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--muted)', textAlign: 'center' }}>查看 / 编辑</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--muted)', textAlign: 'center' }}>管理</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--muted)', textAlign: 'center' }}>发布</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--muted)', textAlign: 'center' }}>执行</th>
                        <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--muted)', textAlign: 'center' }}>系统设置</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MENU_TREE.map((p) => {
                        const PIcon = p.icon;
                        // Map each action to a column
                        const hasView    = p.children.some((c) => c.label === '查看');
                        const hasEdit    = p.children.some((c) => c.label === '编辑');
                        const hasManage  = p.children.some((c) => c.label === '管理');
                        const hasPublish = p.children.some((c) => c.label === '发布');
                        const hasRun     = p.children.some((c) => c.label === '执行');
                        const hasSystem  = p.children.some((c) => c.label === '系统设置');
                        const findByLabel = (l: string) => p.children.find((c) => c.label === l);
                        const viewId    = findByLabel('查看')?.id;
                        const editId    = findByLabel('编辑')?.id;
                        const manageId  = findByLabel('管理')?.id;
                        const publishId = findByLabel('发布')?.id;
                        const runId     = findByLabel('执行')?.id;
                        const systemId  = findByLabel('系统设置')?.id;
                        const Cell = ({ id }: { id: string | undefined }) => id ? (
                          <td onClick={() => toggleMenu(id)} style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', cursor: 'pointer' }}>
                            <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, border: '1.5px solid ' + (menuPerms.has(id) ? 'var(--success)' : 'var(--border)'), background: menuPerms.has(id) ? 'var(--success)' : 'transparent', position: 'relative', transition: 'all 0.15s' }}>
                              {menuPerms.has(id) && (
                                <svg viewBox="0 0 12 12" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 12, height: 12 }}>
                                  <path d="M2 6.5l2.5 2.5L10 3.5" stroke="var(--background)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          </td>
                        ) : (
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>—</td>
                        );
                        return (
                          <tr key={p.id} style={{ background: 'var(--card)' }}>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <PIcon size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                                <span style={{ fontWeight: 500 }}>{p.label}</span>
                              </div>
                            </td>
                            <Cell id={viewId} />
                            <Cell id={editId} />
                            <Cell id={manageId} />
                            <Cell id={publishId} />
                            <Cell id={runId} />
                            <Cell id={systemId} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                          onClick={() => { setDataScope(s.value); setPolicyDirty(true); }}
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

                {/* 粘性保存栏 - 固定在右侧详情面板底部 */}
                {(policyDirty || infoDirty) && (
                  <div style={{
                    position: 'sticky', bottom: 0, zIndex: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, padding: '12px 16px', marginTop: 16,
                    background: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(12px)',
                    border: '1px solid var(--warning)', borderRadius: 'var(--radius)',
                    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.3)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--warning)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', animation: 'pulse 1.5s infinite' }} />
                      <span>有 <strong style={{ color: 'var(--foreground)' }}>{(infoDirty ? 1 : 0) + (policyDirty ? 1 : 0)}</strong> 处未保存的修改</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="v-btn" onClick={discardChanges}>放弃</button>
                      <button className="v-btn-primary" onClick={infoDirty ? saveInfo : savePolicy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Check size={14} />保存配置
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, marginTop: 12 }}>
                  <button className="v-btn" onClick={discardChanges}>重置</button>
                </div>
              </div>
            ) : null}
          </div>
        )}

      {/* 新建角色 Drawer */}
      <FormDrawer
        open={createOpen}
        title="新建角色"
        onCancel={() => { setCreateOpen(false); setCreateForm({ roleCode: '', roleName: '', roleType: 'CUSTOM', description: '' }); }}
        onOk={submitCreate}
        confirmLoading={creating}
        okText="创建"
      >
        <FormSection title="基本信息">
          <Field label="角色编码" required>
            <TextInput value={createForm.roleCode} onChange={(e) => setCreateForm({ ...createForm, roleCode: e.target.value })} placeholder="如：APP_ADMIN" />
          </Field>
          <Field label="角色名称" required>
            <TextInput value={createForm.roleName} onChange={(e) => setCreateForm({ ...createForm, roleName: e.target.value })} placeholder="如：应用管理员" />
          </Field>
          <Field label="类型">
            <Select value={createForm.roleType} onChange={(e) => setCreateForm({ ...createForm, roleType: e.target.value as RoleType })}>
              <option value="CUSTOM">CUSTOM（自定义）</option>
              <option value="SYSTEM">SYSTEM（系统）</option>
              <option value="BUILTIN">BUILTIN（内置）</option>
              <option value="EXTERNAL">EXTERNAL（外部）</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>
      </div>
    </div>
  );
}
