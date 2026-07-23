import { useState } from 'react';
import { Plus, Search, UserX } from 'lucide-react';
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

// MOCK: 用户列表（基于设计稿，扩展头像色/状态/角色等展示字段）
interface AdminUserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  department: string;
  role: string;
  roleBadge: string;
  status: string;
  statusBadge: string;
  lastLogin: string;
  avatar: string;
  avatarColor: string;
  locked: boolean;
}

const MOCK_USER_ROWS: AdminUserRow[] = [
  { id: '1', name: '张三', handle: 'zhangsan', email: 'zhangsan@meta.com', department: '技术部', role: '管理员', roleBadge: 'v-badge-success', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-22 09:32', avatar: '张', avatarColor: '#2563eb', locked: false },
  { id: '2', name: '李四', handle: 'lisi', email: 'lisi@meta.com', department: '产品部', role: '普通用户', roleBadge: 'v-badge-neutral', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-22 10:15', avatar: '李', avatarColor: '#16a34a', locked: false },
  { id: '3', name: '王五', handle: 'wangwu', email: 'wangwu@meta.com', department: '架构组', role: '管理员', roleBadge: 'v-badge-success', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-22 08:42', avatar: '王', avatarColor: '#9333ea', locked: false },
  { id: '4', name: '赵六', handle: 'zhaoliu', email: 'zhaoliu@meta.com', department: '运营部', role: '开发者', roleBadge: 'v-badge-warning', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-22 08:50', avatar: '赵', avatarColor: '#ea580c', locked: false },
  { id: '5', name: '钱七', handle: 'qianqi', email: 'qianqi@meta.com', department: '数据组', role: '普通用户', roleBadge: 'v-badge-neutral', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-21 14:20', avatar: '钱', avatarColor: '#0891b2', locked: false },
  { id: '6', name: '孙八', handle: 'sunba', email: 'sunba@meta.com', department: '客服组', role: '普通用户', roleBadge: 'v-badge-neutral', status: '锁定', statusBadge: 'v-badge-error', lastLogin: '2026-07-10 11:05', avatar: '孙', avatarColor: '#dc2626', locked: true },
  { id: '7', name: '周九', handle: 'zhoujiu', email: 'zhoujiu@meta.com', department: '技术部', role: '开发者', roleBadge: 'v-badge-warning', status: '活跃', statusBadge: 'v-badge-success', lastLogin: '2026-07-22 07:18', avatar: '周', avatarColor: '#ca8a04', locked: false },
  { id: '8', name: '吴十', handle: 'wushi', email: 'wushi@meta.com', department: '产品部', role: '普通用户', roleBadge: 'v-badge-neutral', status: '未激活', statusBadge: 'v-badge-warning', lastLogin: '--', avatar: '吴', avatarColor: '#7c3aed', locked: false },
];

// MOCK: 角色分配
const MOCK_ROLES = [
  { id: 'admin', label: '管理员', desc: '系统管理、用户管理、全局配置', checked: true },
  { id: 'dev', label: '开发者', desc: '应用构建、本体编辑、Agent 编排', checked: true },
  { id: 'auditor', label: '审计员', desc: '日志查看、操作审计、安全报告', checked: false },
];

// MOCK: 最近登录
const MOCK_RECENT_LOGINS = [
  { action: 'Chrome / Windows', time: '07-22 09:32' },
  { action: 'Chrome / macOS', time: '07-21 18:05' },
  { action: 'Safari / iOS', time: '07-21 09:12' },
  { action: 'Chrome / Windows', time: '07-20 08:45' },
  { action: 'Firefox / Linux', time: '07-19 14:30' },
];

// MOCK: 操作日志
const MOCK_ACTION_LOGS = [
  { action: '登录系统', ip: '192.168.1.100', time: '09:32' },
  { action: '修改用户 李四 角色', ip: '192.168.1.100', time: '09:15' },
  { action: '重置密码 孙八', ip: '192.168.1.100', time: '08:50' },
];

export default function AdminUsersPage() {
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>('1');
  const [roleStates, setRoleStates] = useState<Record<string, boolean>>(
    Object.fromEntries(MOCK_ROLES.map((r) => [r.id, r.checked]))
  );
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editEnabled, setEditEnabled] = useState(true);

  const selected = MOCK_USER_ROWS.find((u) => u.id === selectedId) ?? MOCK_USER_ROWS[0];

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <style>{`
        .au-page-header { margin-bottom: 24px; }
        .au-page-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
        .au-page-header p { font-size: 14px; color: var(--muted-foreground); }
        .au-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .au-tab-bar .v-tab { cursor: pointer; text-decoration: none; }
        .au-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .au-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
        .au-stat-card .stat-label { font-size: 12px; color: var(--muted-foreground); font-weight: 500; }
        .au-stat-card .stat-value { font-size: 28px; font-weight: 600; color: var(--foreground); letter-spacing: -0.02em; }
        .au-stat-card .stat-value.text-success { color: var(--success); }
        .au-stat-card .stat-value.text-warning { color: var(--warning); }
        .au-stat-card .stat-value.text-destructive { color: var(--destructive); }
        .au-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .au-search-box { position: relative; flex: 0 0 240px; }
        .au-search-box input { width: 100%; padding-left: 36px; }
        .au-search-box svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--muted-foreground); }
        .au-toolbar-spacer { flex: 1; }
        .au-content-area { display: flex; gap: 16px; align-items: flex-start; }
        .au-table-area { flex: 1; min-width: 0; }
        .au-detail-panel { width: 300px; flex-shrink: 0; position: sticky; top: 24px; }
        .au-detail-header { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
        .au-detail-avatar { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 600; color: #fff; }
        .au-detail-name { font-size: 16px; font-weight: 600; }
        .au-detail-username { font-size: 13px; color: var(--muted-foreground); font-family: var(--font-mono); }
        .au-detail-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .au-detail-field { display: flex; flex-direction: column; gap: 2px; }
        .au-detail-field .field-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); }
        .au-detail-field .field-value { font-size: 13px; color: var(--foreground); }
        .au-detail-section { margin-bottom: 16px; }
        .au-detail-section-title { font-size: 12px; font-weight: 600; color: var(--foreground); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .au-role-list { display: flex; flex-direction: column; gap: 8px; }
        .au-role-item { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
        .au-role-item input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; background: var(--muted); cursor: pointer; position: relative; flex-shrink: 0; margin-top: 2px; }
        .au-role-item input[type="checkbox"]:checked { background: var(--primary); border-color: var(--primary); }
        .au-role-item input[type="checkbox"]:checked::after { content: ''; position: absolute; left: 4px; top: 1px; width: 5px; height: 9px; border: solid var(--primary-foreground); border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .au-role-item label { cursor: pointer; color: var(--foreground); }
        .au-role-item .role-desc { font-size: 11px; color: var(--muted-foreground); }
        .au-log-list { display: flex; flex-direction: column; gap: 0; }
        .au-log-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; border-bottom: 1px solid var(--border); }
        .au-log-row:last-child { border-bottom: none; }
        .au-log-row .log-time { color: var(--muted-foreground); font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
        .au-log-row .log-action { color: var(--foreground); flex: 1; margin: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-log-row .log-ip { color: var(--muted-foreground); font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
        .au-actions-cell { display: flex; gap: 4px; }
        .au-action-link { font-size: 13px; color: var(--muted-foreground); cursor: pointer; border: none; background: none; padding: 4px 8px; border-radius: 4px; font-family: var(--font-sans); white-space: nowrap; }
        .au-action-link:hover { color: var(--foreground); background: var(--muted); }
        .au-action-link.danger:hover { color: var(--destructive); }
        .au-user-cell { display: flex; align-items: center; gap: 10px; min-width: 140px; }
        .au-user-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; color: #fff; flex-shrink: 0; }
        .au-user-info { display: flex; flex-direction: column; gap: 1px; }
        .au-user-info .user-name { font-size: 13px; font-weight: 500; color: var(--foreground); }
        .au-user-info .user-handle { font-size: 12px; color: var(--muted-foreground); font-family: var(--font-mono); }
        .au-mono { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); }
        .au-v-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 30px 8px 12px; outline: none; font-family: var(--font-sans); appearance: none; cursor: pointer; min-width: 120px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
        .au-v-select:focus { border-color: var(--foreground); }
      `}</style>
      <div style={{ padding: '24px 0' }}>
        {/* Page Header */}
        <div className="au-page-header">
          <h1>用户管理</h1>
          <p>管理平台用户账号、角色与权限</p>
        </div>

        {/* Stats */}
        <div className="au-stats-grid">
          <div className="au-stat-card">
            <span className="stat-label">总用户</span>
            <span className="stat-value">1,234</span>
          </div>
          <div className="au-stat-card">
            <span className="stat-label">活跃用户</span>
            <span className="stat-value text-success">856</span>
          </div>
          <div className="au-stat-card">
            <span className="stat-label">今日新增</span>
            <span className="stat-value text-warning">12</span>
          </div>
          <div className="au-stat-card">
            <span className="stat-label">锁定用户</span>
            <span className="stat-value text-destructive">3</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="au-toolbar">
          <div className="au-search-box">
            <input className="v-input" type="text" placeholder="搜索姓名、用户名或邮箱..." />
            <Search />
          </div>
          <select className="au-v-select">
            <option>全部状态</option>
            <option>活跃</option>
            <option>锁定</option>
            <option>未激活</option>
          </select>
          <select className="au-v-select">
            <option>全部角色</option>
            <option>管理员</option>
            <option>开发者</option>
            <option>普通用户</option>
          </select>
          <select className="au-v-select">
            <option>全部部门</option>
            <option>技术部</option>
            <option>产品部</option>
            <option>运营部</option>
            <option>数据组</option>
            <option>客服组</option>
            <option>架构组</option>
          </select>
          <div className="au-toolbar-spacer" />
          <button className="v-btn-primary" onClick={() => setCreateDrawerOpen(true)}><Plus style={{ width: 16, height: 16 }} />新建用户</button>
        </div>

        {/* Content area: table + detail panel */}
        <div className="au-content-area">
          <div className="au-table-area">
            <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['用户', '邮箱', '部门', '角色', '状态', '最后登录', '操作'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_USER_ROWS.map((u) => {
                  const isSelected = u.id === selectedId;
                  return (
                    <tr key={u.id} onClick={() => setSelectedId(u.id)} style={{ cursor: 'pointer', background: isSelected ? 'var(--accent)' : undefined }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <div className="au-user-cell">
                          <div className="au-user-avatar" style={{ background: u.avatarColor }}>{u.avatar}</div>
                          <div className="au-user-info">
                            <span className="user-name">{u.name}</span>
                            <span className="user-handle">{u.handle}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }} className="au-mono">{u.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{u.department}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><span className={`v-badge ${u.roleBadge}`}>{u.role}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><span className={`v-badge ${u.statusBadge}`}>{u.status}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}><span className="v-meta">{u.lastLogin}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <div className="au-actions-cell">
                          <button className="au-action-link" onClick={() => setEditDrawerOpen(true)}>编辑</button>
                          <button className="au-action-link">重置密码</button>
                          <button className="au-action-link danger">{u.locked ? '解锁' : '锁定'}</button>
                          <button className="au-action-link danger">删除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right detail panel */}
          <div className="au-detail-panel">
            <div className="v-card">
              <div className="au-detail-header">
                <div className="au-detail-avatar" style={{ background: selected.avatarColor }}>{selected.avatar}</div>
                <div className="au-detail-name">{selected.name}</div>
                <div className="au-detail-username">{selected.handle}</div>
              </div>

              <div className="au-detail-fields">
                <div className="au-detail-field">
                  <span className="field-label">邮箱</span>
                  <span className="field-value">{selected.email}</span>
                </div>
                <div className="au-detail-field">
                  <span className="field-label">手机</span>
                  <span className="field-value">138-0001-0001</span>
                </div>
                <div className="au-detail-field">
                  <span className="field-label">部门</span>
                  <span className="field-value">{selected.department}</span>
                </div>
                <div className="au-detail-field">
                  <span className="field-label">职位</span>
                  <span className="field-value">高级工程师</span>
                </div>
              </div>

              {/* Role assignment */}
              <div className="au-detail-section">
                <div className="au-detail-section-title">角色分配</div>
                <div className="au-role-list">
                  {MOCK_ROLES.map((r) => (
                    <div key={r.id} className="au-role-item">
                      <input
                        type="checkbox"
                        id={`role-${r.id}`}
                        checked={roleStates[r.id]}
                        onChange={(e) => setRoleStates((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                      />
                      <div>
                        <label htmlFor={`role-${r.id}`}>{r.label}</label>
                        <div className="role-desc">{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent logins */}
              <div className="au-detail-section">
                <div className="au-detail-section-title">最近登录</div>
                <div className="au-log-list">
                  {MOCK_RECENT_LOGINS.map((log, i) => (
                    <div key={i} className="au-log-row">
                      <span className="log-action">{log.action}</span>
                      <span className="log-time">{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action log */}
              <div className="au-detail-section">
                <div className="au-detail-section-title">操作日志</div>
                <div className="au-log-list">
                  {MOCK_ACTION_LOGS.map((log, i) => (
                    <div key={i} className="au-log-row">
                      <span className="log-action">{log.action}</span>
                      <span className="log-ip">{log.ip}</span>
                      <span className="log-time">{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormDrawer
        open={createDrawerOpen}
        title="新建用户"
        onCancel={() => setCreateDrawerOpen(false)}
        onOk={() => setCreateDrawerOpen(false)}
      >
        <FormSection title="账号信息" desc="用户名与密码">
          <Field label="姓名" required>
            <TextInput placeholder="例：张三" />
          </Field>
          <Field label="用户名" required>
            <TextInput placeholder="例：zhangsan" style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
          <Field label="邮箱" required>
            <TextInput type="email" placeholder="zhangsan@meta.com" />
          </Field>
          <Field label="密码" required>
            <TextInput type="password" placeholder="至少 8 位" />
          </Field>
          <Field label="确认密码" required>
            <TextInput type="password" placeholder="再次输入密码" />
          </Field>
        </FormSection>

        <FormSection title="组织与角色" desc="部门归属与角色分配">
          <Field label="部门">
            <Select defaultValue="技术部">
              <option>技术部</option>
              <option>产品部</option>
              <option>运营部</option>
              <option>数据组</option>
              <option>客服组</option>
              <option>架构组</option>
            </Select>
          </Field>
          <Field label="角色">
            <Select defaultValue="viewer">
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </Select>
          </Field>
        </FormSection>

        <FormSection title="备注" desc="可选">
          <Field label="备注">
            <TextArea placeholder="用户备注信息..." rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>

      <FormDrawer
        open={editDrawerOpen}
        title="编辑用户"
        onCancel={() => setEditDrawerOpen(false)}
        onOk={() => setEditDrawerOpen(false)}
      >
        <FormSection title="基本信息" desc="用户资料">
          <Field label="姓名">
            <TextInput defaultValue={selected.name} />
          </Field>
          <Field label="邮箱">
            <TextInput type="email" defaultValue={selected.email} />
          </Field>
          <Field label="部门">
            <Select defaultValue={selected.department}>
              <option>技术部</option>
              <option>产品部</option>
              <option>运营部</option>
              <option>数据组</option>
              <option>客服组</option>
              <option>架构组</option>
            </Select>
          </Field>
          <Field label="角色">
            <Select defaultValue={selected.role === '管理员' ? 'admin' : selected.role === '开发者' ? 'editor' : 'viewer'}>
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </Select>
          </Field>
        </FormSection>

        <FormSection title="状态与备注" desc="启用状态与备注信息">
          <Field label="启用状态">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEditEnabled((v) => !v)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: editEnabled ? 'var(--success)' : 'var(--border)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'transform 0.2s',
                  transform: editEnabled ? 'translateX(16px)' : 'translateX(0)',
                }} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                {editEnabled ? '已启用' : '已禁用'}
              </span>
            </div>
          </Field>
          <Field label="备注">
            <TextArea placeholder="用户备注信息..." rows={3} />
          </Field>
        </FormSection>
      </FormDrawer>
    </>
  );
}
