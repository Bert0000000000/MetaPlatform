import { useState } from 'react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Download,
  Upload,
  ShieldCheck,
  CheckCircle,
  Clock,
  Activity,
  Pencil,
  Copy,
  Grid3x3,
  Code,
  BarChart3,
  Bot,
  Eye,
  ClipboardCheck,
  ShieldAlert,
  UserPlus,
  ArrowUpCircle,
  Check,
  X,
} from 'lucide-react';

// MOCK: 权限策略列表
interface Policy {
  id: string;
  name: string;
  role: string;
  toolScope: string;
  perms: { label: string; cls: string }[];
  status: 'enabled' | 'pending';
  createdAt: string;
}

const MOCK_POLICIES: Policy[] = [
  { id: 'p1', name: '全局只读访问', role: '只读用户', toolScope: 'ont_query_*, rag_search, data_read', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }], status: 'enabled', createdAt: '2026-07-15' },
  { id: 'p2', name: '管理员全量工具', role: '系统管理员', toolScope: '*', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }, { label: '数据写入', cls: 'v-badge-warning' }, { label: '管理配置', cls: 'v-badge-neutral' }], status: 'enabled', createdAt: '2026-07-10' },
  { id: 'p3', name: '开发者构建工具', role: '应用开发者', toolScope: 'action_*, wfe_*, ont_design_*', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }, { label: '数据写入', cls: 'v-badge-warning' }], status: 'enabled', createdAt: '2026-07-12' },
  { id: 'p4', name: '数据分析师查询', role: '数据分析师', toolScope: 'rag_search, data_query, graph_traverse', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }], status: 'enabled', createdAt: '2026-07-14' },
  { id: 'p5', name: 'Agent 运营管理', role: 'Agent 运营', toolScope: 'agent_*, mcp_*, action_execute', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }, { label: '数据写入', cls: 'v-badge-warning' }, { label: '管理配置', cls: 'v-badge-neutral' }], status: 'enabled', createdAt: '2026-07-13' },
  { id: 'p6', name: 'SuperAI 检索工具', role: '应用开发者', toolScope: 'rag_search, llm_invoke, embed_create', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }], status: 'enabled', createdAt: '2026-07-11' },
  { id: 'p7', name: '本体引擎设计', role: '系统管理员', toolScope: 'ont_*', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }, { label: '数据写入', cls: 'v-badge-warning' }, { label: '管理配置', cls: 'v-badge-neutral' }], status: 'enabled', createdAt: '2026-07-08' },
  { id: 'p8', name: '外部 Client 受限', role: '只读用户', toolScope: 'ont_query_*, rag_search', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }], status: 'enabled', createdAt: '2026-07-16' },
  { id: 'p9', name: '高危操作黑名单', role: '只读用户', toolScope: 'data_delete*, ont_drop*, config_reset', perms: [{ label: '禁止全部', cls: 'v-badge-error' }], status: 'enabled', createdAt: '2026-07-09' },
  { id: 'p10', name: '数据写入限制', role: '数据分析师', toolScope: 'data_query, data_export', perms: [{ label: '工具调用', cls: 'v-badge-info' }, { label: '数据读取', cls: 'v-badge-success' }], status: 'pending', createdAt: '2026-07-21' },
];

// MOCK: 角色权限矩阵
const MATRIX_ROLES = [
  { name: '系统管理员', icon: ShieldCheck },
  { name: '应用开发者', icon: Code },
  { name: '数据分析师', icon: BarChart3 },
  { name: 'Agent 运营', icon: Bot },
  { name: '只读用户', icon: Eye },
];

const MATRIX_PERMS = ['工具调用', '数据读取', '数据写入', '管理配置'];

// MOCK: 矩阵数据 ✓=full ●=partial ✗=none
const MATRIX_DATA: string[][] = [
  ['✓', '✓', '✓', '✓'],
  ['✓', '✓', '✓', '✗'],
  ['✓', '✓', '●', '✗'],
  ['✓', '✓', '●', '●'],
  ['✓', '✓', '✗', '✗'],
];

const MATRIX_CELL_CLS: Record<string, string> = {
  '✓': 'var(--success)',
  '●': 'var(--warning)',
  '✗': 'var(--destructive)',
};

// MOCK: 审批队列
const MOCK_APPROVALS = [
  { id: 'a1', icon: ShieldAlert, iconCls: 'warning', title: '数据分析师请求 data_write 权限', desc: '申请者：张伟 | 工具范围：data_export, data_insert | 用途：Q2 报表自动导出', time: '2026-07-21 16:42' },
  { id: 'a2', icon: UserPlus, iconCls: 'info', title: '新增外部 Client 注册申请', desc: '申请者：王芳 | Client：trading-bot-v3 | 请求权限：ont_query_*, rag_search', time: '2026-07-21 14:18' },
  { id: 'a3', icon: ArrowUpCircle, iconCls: 'warning', title: 'Agent 运营请求管理配置权限', desc: '申请者：李强 | 工具范围：mcp_register, config_update | 用途：新 Agent 接入配置', time: '2026-07-20 09:55' },
];

const MCP_TABS: SubTabItem[] = [
  { label: '工具注册', path: '/mcp' },
  { label: 'Server 管理', path: '/mcp/server' },
  { label: 'Client 管理', path: '/mcp/client' },
  { label: '调试器', path: '/mcp/debugger' },
  { label: '权限管理', path: '/mcp/permissions' },
  { label: '外部对接', path: '/mcp/external' },
  { label: '审计日志', path: '/mcp/audit' },
];

export default function McpPermissionsPage() {
  const location = useLocation();
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>权限管理</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          配置工具访问权限策略，控制不同模块、角色和客户端的工具调用范围。
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="v-btn-primary" onClick={() => setCreateDrawerOpen(true)}><Plus style={{ width: 14, height: 14 }} />新建策略</button>
          <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出</button>
          <button className="v-btn"><Upload style={{ width: 14, height: 14 }} />导入</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: ShieldCheck, cls: 'success', value: '15', label: '权限策略' },
          { icon: CheckCircle, cls: 'info', value: '89', label: '已授权工具' },
          { icon: Clock, cls: 'warning', value: '3', label: '待审批' },
          { icon: Activity, cls: '', value: '12,450', label: '本月调用' },
        ].map((s, i) => {
          const Icon = s.icon;
          const iconBg = s.cls === 'success' ? 'var(--success-subtle)' : s.cls === 'warning' ? 'var(--warning-subtle)' : s.cls === 'info' ? 'rgba(96,165,250,0.12)' : 'var(--muted)';
          const iconColor = s.cls === 'success' ? 'var(--success)' : s.cls === 'warning' ? 'var(--warning)' : s.cls === 'info' ? '#60a5fa' : 'var(--muted-foreground)';
          return (
            <div key={i} className="v-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 18, height: 18, color: iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content + Side panel */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="v-input" style={{ height: 32, fontSize: 13, width: 220 }} placeholder="搜索策略名称..." />
            <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 140, cursor: 'pointer' }}>
              <option>全部角色</option>
              <option>系统管理员</option>
              <option>应用开发者</option>
              <option>数据分析师</option>
              <option>Agent 运营</option>
              <option>只读用户</option>
            </select>
            <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 140, cursor: 'pointer' }}>
              <option>全部状态</option>
              <option>已启用</option>
              <option>已禁用</option>
            </select>
            <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 140, cursor: 'pointer' }}>
              <option>操作权限</option>
              <option>工具调用</option>
              <option>数据读取</option>
              <option>数据写入</option>
              <option>管理配置</option>
            </select>
          </div>

          {/* Table */}
          <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['策略名称', '适用角色', '工具范围', '操作权限', '状态', '创建时间', '操作'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_POLICIES.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 8px', borderRadius: 'var(--radius)' }}>{p.role}</span>
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.toolScope}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.perms.map((perm) => (
                        <span key={perm.label} className={`v-badge ${perm.cls}`}>{perm.label}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${p.status === 'enabled' ? 'v-badge-success' : 'v-badge-warning'}`}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'enabled' ? 'var(--success)' : 'var(--warning)' }} />
                      {p.status === 'enabled' ? '已启用' : '待审批'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }} className="v-meta">{p.createdAt}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }}><Pencil style={{ width: 12, height: 12 }} /></button>
                      <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }}><Copy style={{ width: 12, height: 12 }} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '10px 14px', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', background: 'var(--card)', textAlign: 'right' }}>
            共 15 条记录，当前显示 1-10
          </div>
        </div>

        {/* Side panel: Matrix */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div className="v-card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Grid3x3 style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />角色权限矩阵
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(4, 1fr)', gap: 0, fontSize: 12 }}>
              <div style={{ color: 'var(--muted-foreground)', fontWeight: 500, padding: '8px 6px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>角色</div>
              {MATRIX_PERMS.map((p) => (
                <div key={p} style={{ color: 'var(--muted-foreground)', fontWeight: 500, padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p}</div>
              ))}
              {MATRIX_ROLES.map((role, i) => {
                const RoleIcon = role.icon;
                return (
                  <div key={role.name} style={{ display: 'contents' }}>
                    <div style={{ padding: '8px 6px', fontWeight: 500, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RoleIcon style={{ width: 13, height: 13, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      {role.name}
                    </div>
                    {MATRIX_DATA[i].map((cell, j) => (
                      <div key={j} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: MATRIX_CELL_CLS[cell], fontWeight: 600, fontSize: 13 }}>{cell}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--success)', fontSize: 11 }}>✓</span> 完全授权
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--warning)', fontSize: 11 }}>●</span> 部分授权
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--destructive)', fontSize: 11 }}>✗</span> 无权限
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approval queue */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardCheck style={{ width: 16, height: 16, color: 'var(--warning)' }} />权限审批队列
          <span style={{ background: 'var(--warning-subtle)', color: 'var(--warning)', fontSize: 11, padding: '2px 6px', borderRadius: 'var(--radius)', fontWeight: 500 }}>3 待处理</span>
        </div>
        {MOCK_APPROVALS.map((a) => {
          const Icon = a.icon;
          const iconBg = a.iconCls === 'warning' ? 'var(--warning-subtle)' : 'rgba(96,165,250,0.12)';
          const iconColor = a.iconCls === 'warning' ? 'var(--warning)' : '#60a5fa';
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 8, background: 'var(--card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: iconBg, color: iconColor }}>
                <Icon style={{ width: 18, height: 18 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{a.desc}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>{a.time}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="v-btn" style={{ color: 'var(--success)', borderColor: 'rgba(98,209,120,0.3)', height: 26, fontSize: 12, padding: '0 10px' }}><Check style={{ width: 12, height: 12 }} />通过</button>
                <button className="v-btn" style={{ color: 'var(--destructive)', borderColor: 'rgba(255,97,102,0.3)', height: 26, fontSize: 12, padding: '0 10px' }}><X style={{ width: 12, height: 12 }} />拒绝</button>
              </div>
            </div>
          );
        })}
      </div>

      <FormDrawer
        open={createDrawerOpen}
        title="新建权限策略"
        onCancel={() => setCreateDrawerOpen(false)}
        onOk={() => setCreateDrawerOpen(false)}
      >
        <FormSection title="基本信息" desc="策略名称与优先级">
          <Field label="策略名称" required>
            <TextInput placeholder="例：数据分析师查询" />
          </Field>
          <Field label="优先级">
            <TextInput type="number" min={1} max={100} defaultValue={50} />
          </Field>
          <Field label="描述">
            <TextArea placeholder="策略用途说明..." rows={3} />
          </Field>
        </FormSection>

        <FormSection title="主体与范围" desc="配置策略适用主体与工具范围">
          <Field label="主体类型">
            <Select defaultValue="user">
              <option value="user">用户</option>
              <option value="role">角色</option>
              <option value="org">组织</option>
            </Select>
          </Field>
          <Field label="主体ID/名称">
            <TextInput placeholder="例：zhangsan 或 role:dev" />
          </Field>
          <Field label="工具范围">
            <TextArea placeholder={'ont_query_*\nrag_search\ndata_read'} rows={5} style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
        </FormSection>

        <FormSection title="约束条件" desc="可选：生效时间窗口与 IP 白名单">
          <Field label="时间窗口">
            <TextInput placeholder="09:00-18:00" />
          </Field>
          <Field label="IP 白名单">
            <TextArea placeholder={'10.0.0.0/8\n192.168.1.100'} rows={4} style={{ fontFamily: 'var(--font-mono)' }} />
          </Field>
        </FormSection>
      </FormDrawer>
    </div>
  );
}
