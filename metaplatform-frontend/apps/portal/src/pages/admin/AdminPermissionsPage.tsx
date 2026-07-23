import { useState } from 'react';
import {
  Crown, Shield, UserCog, Code, BarChart3, Server, User, Eye,
  Info, Pencil, Menu, KeyRound, Database,
} from 'lucide-react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_USERS } from '@/mock'; // MOCK

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

// MOCK: 角色列表
const MOCK_ROLES = [
  { id: 'r1', name: 'Super Admin', count: 1, desc: '全部权限，系统最高管理权限', icon: Crown, iconColor: 'var(--warning)', active: false },
  { id: 'r2', name: '平台管理员', count: 3, desc: '平台级配置、用户管理与全局参数', icon: Shield, iconColor: '#60a5fa', active: false },
  { id: 'r3', name: '模块管理员', count: 12, desc: '管理指定模块的内容与配置', icon: UserCog, iconColor: '#a78bfa', active: true },
  { id: 'r4', name: '开发者', count: 28, desc: '应用开发、API 调用与调试权限', icon: Code, iconColor: 'var(--success)', active: false },
  { id: 'r5', name: '数据分析师', count: 15, desc: '数据查询、报表与 OLAP 分析', icon: BarChart3, iconColor: '#f97316', active: false },
  { id: 'r6', name: '运维人员', count: 6, desc: '基础设施监控、部署与日志查看', icon: Server, iconColor: '#06b6d4', active: false },
  { id: 'r7', name: '普通用户', count: 142, desc: '已授权模块的查看与编辑', icon: User, iconColor: 'var(--muted-foreground)', active: false },
  { id: 'r8', name: '访客', count: 37, desc: '只读查看权限', icon: Eye, iconColor: 'var(--muted-foreground)', active: false },
];

// MOCK: 菜单权限树
const MOCK_MENU_PERMS = [
  { id: 'ws', label: '工作台', icon: 'layout-dashboard', checked: true, children: [{ id: 'ws-view', label: '查看', checked: true }, { id: 'ws-manage', label: '管理', checked: true }] },
  { id: 'arch', label: '架构中心', icon: 'git-branch', checked: true, children: [{ id: 'arch-view', label: '查看', checked: true }, { id: 'arch-edit', label: '编辑', checked: true }] },
  { id: 'apps', label: '应用中心', icon: 'boxes', checked: true, children: [{ id: 'apps-view', label: '查看', checked: true }, { id: 'apps-edit', label: '编辑', checked: true }, { id: 'apps-publish', label: '发布', checked: true }] },
  { id: 'ont', label: '本体引擎', icon: 'database', checked: true, children: [{ id: 'ont-view', label: '查看', checked: true }, { id: 'ont-edit', label: '编辑', checked: true }, { id: 'ont-manage', label: '管理', checked: true }] },
  { id: 'mcp', label: 'MCP 中心', icon: 'plug', checked: true, children: [{ id: 'mcp-view', label: '查看', checked: true }, { id: 'mcp-manage', label: '管理', checked: true }] },
];

// MOCK: API 权限表
const MOCK_API_PERMS = [
  { path: '/api/v1/ont/classes', method: 'GET', methodCls: 'method-get', desc: '查询本体分类列表', authorized: true },
  { path: '/api/v1/ont/classes', method: 'POST', methodCls: 'method-post', desc: '创建本体分类', authorized: true },
  { path: '/api/v1/ont/classes/{id}', method: 'PUT', methodCls: 'method-put', desc: '更新本体分类定义', authorized: true },
  { path: '/api/v1/apps/{id}/deploy', method: 'POST', methodCls: 'method-post', desc: '部署应用至运行环境', authorized: false },
  { path: '/api/v1/iam/users', method: 'DELETE', methodCls: 'method-delete', desc: '删除用户账号', authorized: false },
];

// MOCK: 数据脱敏规则
const MOCK_MASKING = [
  { label: '手机号', preview: '138****5678', on: true },
  { label: '邮箱', preview: 'z****@example.com', on: true },
  { label: '身份证', preview: '110***********1234', on: false },
];

const MENU_ICON_MAP: Record<string, React.ReactNode> = {
  'layout-dashboard': <Info style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />,
  'git-branch': <KeyRound style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />,
  'boxes': <Database style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />,
  'database': <Database style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />,
  'plug': <KeyRound style={{ width: 15, height: 15, color: 'var(--muted-foreground)' }} />,
};

export default function AdminPermissionsPage() {
  const location = useLocation();
  const [selectedRoleId, setSelectedRoleId] = useState('r3');
  const [menuStates, setMenuStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    MOCK_MENU_PERMS.forEach((m) => {
      states[m.id] = m.checked;
      m.children.forEach((c) => { states[c.id] = c.checked; });
    });
    return states;
  });
  const [dataScope, setDataScope] = useState('本部门');
  const [maskingStates, setMaskingStates] = useState<Record<number, boolean>>(
    Object.fromEntries(MOCK_MASKING.map((m, i) => [i, m.on]))
  );
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <style>{`
        .ap-page-header { margin-bottom: 28px; }
        .ap-page-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
        .ap-page-header p { font-size: 14px; color: var(--muted-foreground); }
        .ap-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .ap-tab-bar .v-tab { cursor: pointer; text-decoration: none; }
        .ap-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .ap-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .ap-stat-card .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
        .ap-stat-card .stat-label { font-size: 13px; color: var(--muted-foreground); }
        .ap-panel-layout { display: flex; gap: 20px; align-items: start; }
        .ap-role-panel { width: 280px; flex-shrink: 0; }
        .ap-role-panel .v-card { padding: 12px; }
        .ap-detail-panel { flex: 1; min-width: 0; }
        .ap-detail-panel .v-card { margin-bottom: 20px; }
        .ap-detail-panel .v-card:last-child { margin-bottom: 0; }
        .ap-role-list { display: flex; flex-direction: column; gap: 2px; }
        .ap-role-item { padding: 12px 14px; border-radius: var(--radius); cursor: pointer; border: 1px solid transparent; transition: background 0.15s; }
        .ap-role-item:hover { background: var(--muted); }
        .ap-role-item.active { background: var(--muted); border-color: var(--border); }
        .ap-role-item-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .ap-role-item-icon { width: 32px; height: 32px; border-radius: var(--radius); background: var(--muted); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ap-role-item-icon svg { width: 16px; height: 16px; }
        .ap-role-item-name { font-size: 13px; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-role-item-count { font-size: 11px; color: var(--muted-foreground); background: var(--muted); border: 1px solid var(--border); border-radius: 9999px; padding: 1px 7px; flex-shrink: 0; }
        .ap-role-item-desc { font-size: 12px; color: var(--muted-foreground); line-height: 1.5; padding-left: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ap-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ap-section-head h3 { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .ap-section-head h3 svg { width: 16px; height: 16px; color: 'var(--muted-foreground)'; }
        .ap-info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .ap-info-item { display: flex; flex-direction: column; gap: 4px; }
        .ap-info-label { font-size: 12px; color: var(--muted-foreground); }
        .ap-info-value { font-size: 14px; font-weight: 500; }
        .ap-tree-group { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .ap-tree-parent { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 500; background: var(--muted); }
        .ap-tree-parent:last-child { border-bottom: none; }
        .ap-tree-parent input[type="checkbox"] { appearance: none; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 4px; background: var(--card); cursor: pointer; position: relative; flex-shrink: 0; }
        .ap-tree-parent input[type="checkbox"]:checked { background: var(--primary); border-color: var(--primary); }
        .ap-tree-parent input[type="checkbox"]:checked::after { content: ''; position: absolute; left: 4.5px; top: 1.5px; width: 5px; height: 9px; border: solid var(--primary-foreground); border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .ap-tree-children { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px 16px; padding: 10px 16px 12px 42px; border-bottom: 1px solid var(--border); }
        .ap-tree-children:last-child { border-bottom: none; }
        .ap-tree-child { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: var(--muted-foreground); }
        .ap-tree-child input[type="checkbox"] { appearance: none; width: 15px; height: 15px; border: 1px solid var(--border); border-radius: 3px; background: var(--card); cursor: pointer; position: relative; flex-shrink: 0; }
        .ap-tree-child input[type="checkbox"]:checked { background: var(--primary); border-color: var(--primary); }
        .ap-tree-child input[type="checkbox"]:checked::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4.5px; height: 8.5px; border: solid var(--primary-foreground); border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .ap-tree-child label { cursor: pointer; }
        .ap-api-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ap-api-table thead th { text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 500; color: var(--muted-foreground); border-bottom: 1px solid var(--border); background: var(--muted); }
        .ap-api-table tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--muted-foreground); }
        .ap-api-table tbody tr:last-child td { border-bottom: none; }
        .ap-api-table .api-path { font-family: var(--font-mono); font-size: 12px; color: var(--foreground); }
        .ap-method-tag { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 11px; font-weight: 600; font-family: var(--font-mono); letter-spacing: 0.02em; }
        .ap-method-get { background: #14241a; color: #62d178; border: 1px solid #1e3a26; }
        .ap-method-post { background: #141e2a; color: #60a5fa; border: 1px solid #1e2e3e; }
        .ap-method-put { background: #1a1800; color: #eab308; border: 1px solid #2a2600; }
        .ap-method-delete { background: #1f1215; color: #ff6166; border: 1px solid #30191d; }
        .ap-api-auth { display: flex; align-items: center; gap: 4px; }
        .ap-api-auth-dot { width: 7px; height: 7px; border-radius: 50%; }
        .ap-data-scope { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .ap-data-scope-label { font-size: 13px; color: var(--muted-foreground); flex-shrink: 0; }
        .ap-data-scope-options { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .ap-data-scope-opt { padding: 7px 18px; font-size: 13px; cursor: pointer; border-right: 1px solid var(--border); color: var(--muted-foreground); transition: all 0.15s; }
        .ap-data-scope-opt:last-child { border-right: none; }
        .ap-data-scope-opt.active { background: var(--primary); color: var(--primary-foreground); font-weight: 500; }
        .ap-data-scope-opt:hover:not(.active) { background: var(--muted); }
        .ap-masking-list { display: flex; flex-direction: column; gap: 8px; }
        .ap-masking-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; }
        .ap-masking-item-left { display: flex; align-items: center; gap: 10px; }
        .ap-masking-item-left span { color: var(--muted-foreground); }
        .ap-masking-item-right { display: flex; align-items: center; gap: 10px; }
        .ap-masking-preview { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); background: var(--muted); padding: 3px 8px; border-radius: 3px; }
        .ap-masking-toggle { position: relative; width: 36px; height: 20px; background: var(--border); border-radius: 10px; cursor: pointer; transition: background 0.2s; }
        .ap-masking-toggle.on { background: var(--success); }
        .ap-masking-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--foreground); transition: transform 0.2s; }
        .ap-masking-toggle.on::after { transform: translateX(16px); }
        .ap-save-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
      `}</style>
      <div style={{ padding: '24px 0' }}>
        {/* Page Header */}
        <div className="ap-page-header">
          <h1>权限管理</h1>
          <p>角色与权限策略配置</p>
        </div>

        {/* Stats */}
        <div className="ap-stats-row">
          <div className="ap-stat-card">
            <span className="stat-label">角色数</span>
            <span className="stat-value">8</span>
          </div>
          <div className="ap-stat-card">
            <span className="stat-label">权限策略</span>
            <span className="stat-value">156</span>
          </div>
          <div className="ap-stat-card">
            <span className="stat-label">API 权限</span>
            <span className="stat-value">89</span>
          </div>
          <div className="ap-stat-card">
            <span className="stat-label">数据权限</span>
            <span className="stat-value">23</span>
          </div>
        </div>

        {/* Panel: role list + detail */}
        <div className="ap-panel-layout">
          {/* Left: role list */}
          <div className="ap-role-panel">
            <div className="v-card">
              <div className="ap-role-list">
                {MOCK_ROLES.map((r) => {
                  const Icon = r.icon;
                  return (
                    <div
                      key={r.id}
                      className={`ap-role-item${r.id === selectedRoleId ? ' active' : ''}`}
                      onClick={() => setSelectedRoleId(r.id)}
                    >
                      <div className="ap-role-item-top">
                        <div className="ap-role-item-icon"><Icon style={{ color: r.iconColor }} /></div>
                        <span className="ap-role-item-name">{r.name}</span>
                        <span className="ap-role-item-count">{r.count}</span>
                      </div>
                      <div className="ap-role-item-desc">{r.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: permission detail */}
          <div className="ap-detail-panel">
            {/* Basic info */}
            <div className="v-card">
              <div className="ap-section-head">
                <h3><Info style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 基本信息</h3>
                <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setEditDrawerOpen(true)}><Pencil style={{ width: 13, height: 13 }} /> 编辑</button>
              </div>
              <div className="ap-info-grid">
                <div className="ap-info-item">
                  <span className="ap-info-label">角色名称</span>
                  <span className="ap-info-value">模块管理员</span>
                </div>
                <div className="ap-info-item">
                  <span className="ap-info-label">描述</span>
                  <span className="ap-info-value" style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>管理指定模块的内容与配置，无法修改系统级参数和用户账号</span>
                </div>
                <div className="ap-info-item">
                  <span className="ap-info-label">关联用户数</span>
                  <span className="ap-info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>12 <span className="v-badge v-badge-neutral">活跃</span></span>
                </div>
              </div>
            </div>

            {/* Menu permissions */}
            <div className="v-card">
              <div className="ap-section-head">
                <h3><Menu style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 菜单权限</h3>
              </div>
              <div className="ap-tree-group">
                {MOCK_MENU_PERMS.map((m, mi) => (
                  <div key={m.id}>
                    <div className="ap-tree-parent">
                      <input
                        type="checkbox"
                        checked={menuStates[m.id]}
                        onChange={(e) => setMenuStates((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                      />
                      {MENU_ICON_MAP[m.icon]}
                      <span>{m.label}</span>
                    </div>
                    <div className="ap-tree-children">
                      {m.children.map((c) => (
                        <div key={c.id} className="ap-tree-child">
                          <input
                            type="checkbox"
                            checked={menuStates[c.id]}
                            onChange={(e) => setMenuStates((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                          />
                          <label>{c.label}</label>
                        </div>
                      ))}
                    </div>
                    {mi < MOCK_MENU_PERMS.length - 1 && null}
                  </div>
                ))}
              </div>
            </div>

            {/* API permissions */}
            <div className="v-card">
              <div className="ap-section-head">
                <h3><KeyRound style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> API 权限</h3>
                <span className="v-meta">5 条规则</span>
              </div>
              <table className="ap-api-table">
                <thead>
                  <tr>
                    <th>API 路径</th>
                    <th>方法</th>
                    <th>描述</th>
                    <th>授权</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_API_PERMS.map((api, i) => (
                    <tr key={i}>
                      <td className="ap-api-table-api-path" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>{api.path}</td>
                      <td><span className={`ap-method-tag ap-method-${api.method.toLowerCase()}`}>{api.method}</span></td>
                      <td style={{ color: 'var(--muted-foreground)' }}>{api.desc}</td>
                      <td>
                        <div className={`ap-api-auth${api.authorized ? '' : ' no'}`} style={{ color: api.authorized ? 'var(--success)' : 'var(--destructive)' }}>
                          <span className="ap-api-auth-dot" style={{ background: api.authorized ? 'var(--success)' : 'var(--destructive)' }} />
                          {api.authorized ? '已授权' : '未授权'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Data permissions */}
            <div className="v-card">
              <div className="ap-section-head">
                <h3><Database style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 数据权限</h3>
              </div>

              {/* Data scope */}
              <div className="ap-data-scope">
                <span className="ap-data-scope-label">数据范围</span>
                <div className="ap-data-scope-options">
                  {['全部', '本部门', '本人'].map((opt) => (
                    <div
                      key={opt}
                      className={`ap-data-scope-opt${dataScope === opt ? ' active' : ''}`}
                      onClick={() => setDataScope(opt)}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>

              {/* Masking rules */}
              <div className="v-eyebrow" style={{ marginBottom: 10 }}>数据脱敏规则</div>
              <div className="ap-masking-list">
                {MOCK_MASKING.map((m, i) => (
                  <div key={i} className="ap-masking-item">
                    <div className="ap-masking-item-left">
                      <span>{m.label}</span>
                    </div>
                    <div className="ap-masking-item-right">
                      <span className="ap-masking-preview">{m.preview}</span>
                      <div
                        className={`ap-masking-toggle${maskingStates[i] ? ' on' : ''}`}
                        onClick={() => setMaskingStates((prev) => ({ ...prev, [i]: !prev[i] }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save bar */}
            <div className="ap-save-bar">
              <button className="v-btn">取消</button>
              <button className="v-btn-primary">保存更改</button>
            </div>
          </div>
        </div>
      </div>

      <FormDrawer
        open={editDrawerOpen}
        title="编辑角色"
        onCancel={() => setEditDrawerOpen(false)}
        onOk={() => setEditDrawerOpen(false)}
      >
        <FormSection title="角色信息" desc="角色名称与数据范围">
          <Field label="角色名称" required>
            <TextInput defaultValue="模块管理员" />
          </Field>
          <Field label="数据范围">
            <Select defaultValue={dataScope}>
              <option value="全部">全部</option>
              <option value="本部门">本部门</option>
              <option value="本人">本人</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea
              rows={3}
              defaultValue="管理指定模块的内容与配置，无法修改系统级参数和用户账号"
            />
          </Field>
        </FormSection>
      </FormDrawer>
    </>
  );
}
