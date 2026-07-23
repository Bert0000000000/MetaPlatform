import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ShieldX,
  ShieldCheck,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trophy,
  PieChart,
  ShieldAlert,
} from 'lucide-react';

// MOCK: 审计日志列表
interface AuditLog {
  time: string;
  user: string;
  userType: 'v-badge-tool' | 'v-badge-perm' | 'v-badge-config' | 'v-badge-login' | 'v-badge-register';
  typeLabel: string;
  server: string;
  tool: string;
  params: string;
  status: number;
  statusCls: string;
  token: string;
  ip: string;
  traceId: string;
  isAnomaly?: boolean;
}

const MOCK_LOGS: AuditLog[] = [
  { time: '14:33:01', user: 'zhangsan', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-ont-server', tool: 'ont_query_concept', params: 'conceptId:"Employee",depth:2', status: 200, statusCls: 'v-badge-success', token: '486/1,203', ip: '10.0.1.42', traceId: 'a3f8c2e1-7b4d' },
  { time: '14:31:45', user: 'lisi', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-rag-server', tool: 'rag_search', params: 'query:"Q3营收分析",topK:5', status: 200, statusCls: 'v-badge-success', token: '892/3,441', ip: '10.0.1.87', traceId: 'b7d1f0a3-9c2e' },
  { time: '14:28:12', user: 'wangwu', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-action-server', tool: 'action_execute', params: 'actionId:"sync-employee",async:true', status: 202, statusCls: 'v-badge-success', token: '--', ip: '10.0.2.15', traceId: 'c4e9a7b2-1d6f' },
  { time: '14:22:08', user: 'zhangsan', userType: 'v-badge-perm', typeLabel: '权限变更', server: 'mate-ont-server', tool: 'ont:write', params: 'grant role:editor to lisi', status: 200, statusCls: 'v-badge-success', token: '--', ip: '10.0.1.42', traceId: 'd2f5b8c1-3a7e' },
  { time: '14:15:33', user: 'System', userType: 'v-badge-config', typeLabel: '配置修改', server: 'mate-rag-server', tool: 'config.update', params: 'topK:5->10, rerank:true', status: 200, statusCls: 'v-badge-success', token: '--', ip: '10.0.0.1', traceId: 'e8c3a4f6-5b1d' },
  { time: '13:58:21', user: 'lisi', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-data-server', tool: 'graph_traverse', params: 'startNode:"APP-SUPERAI",depth:3', status: 500, statusCls: 'v-badge-error', token: '--', ip: '10.0.1.87', traceId: 'f1a6d9c3-7e2b' },
  { time: '13:45:10', user: 'wangwu', userType: 'v-badge-login', typeLabel: '登录', server: 'TECH-IAM', tool: 'OAuth2 Login', params: 'method:SSO, client:web', status: 200, statusCls: 'v-badge-success', token: '--', ip: '10.0.2.15', traceId: 'a2b7e4d1-9f3c' },
  { time: '13:30:44', user: 'zhangsan', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-action-server', tool: 'action_execute', params: 'actionId:"generate-report",...', status: 403, statusCls: 'v-badge-warning', token: '--', ip: '10.0.1.42', traceId: 'b9c4f1a7-2d8e' },
  { time: '12:50:22', user: 'System', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-ont-server', tool: 'ont_reasoning_prompt', params: 'context:"data-governance"', status: 200, statusCls: 'v-badge-success', token: '1,204/2,108', ip: '10.0.0.1', traceId: 'c7d2e5a8-4f1b' },
  { time: '12:15:08', user: 'lisi', userType: 'v-badge-register', typeLabel: '注册', server: 'TECH-MCP', tool: 'server.register', params: 'server:mate-ea-server,tools:12', status: 201, statusCls: 'v-badge-success', token: '--', ip: '10.0.1.87', traceId: 'd4e8b3c6-1a5f' },
  { time: '11:42:37', user: 'wangwu', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-rag-server', tool: 'rag_search', params: 'query:"企业架构设计",rerank:true', status: 200, statusCls: 'v-badge-success', token: '1,024/4,892', ip: '10.0.2.15', traceId: 'e1f5c7a9-6b2d' },
  { time: '11:20:17', user: 'System', userType: 'v-badge-config', typeLabel: '配置修改', server: 'mate-llmgw', tool: 'route.config', params: 'model:doubao-pro, weight:0.8', status: 200, statusCls: 'v-badge-success', token: '--', ip: '10.0.0.1', traceId: 'f8a2d4c1-3e7b' },
  { time: '10:55:43', user: 'zhangsan', userType: 'v-badge-perm', typeLabel: '权限变更', server: 'mate-action-server', tool: 'act:admin', params: 'revoke role:admin from temp_user', status: 200, statusCls: 'v-badge-success', token: '--', ip: '10.0.1.42', traceId: 'a5c8e2f4-7d1b' },
  { time: '10:30:05', user: 'lisi', userType: 'v-badge-tool', typeLabel: '工具调用', server: 'mate-ont-server', tool: 'ont_validate', params: 'modelId:"Employee",schemaOnly', status: 200, statusCls: 'v-badge-success', token: '312/780', ip: '10.0.1.87', traceId: 'b3d9f1a6-2c8e' },
  { time: '09:12:28', user: 'unknown', userType: 'v-badge-login', typeLabel: '登录', server: 'TECH-IAM', tool: 'OAuth2 Login', params: 'brute:5次, token:invalid', status: 401, statusCls: 'v-badge-error', token: '--', ip: '203.0.113.42', traceId: 'c6e3a8b5-4f2d', isAnomaly: true },
];

// MOCK: 7天调用趋势
const TREND_DATA = [
  { value: '2,156', height: '58%', label: '07-16' },
  { value: '2,403', height: '65%', label: '07-17' },
  { value: '2,678', height: '72%', label: '07-18' },
  { value: '1,892', height: '51%', label: '07-19' },
  { value: '1,547', height: '42%', label: '07-20' },
  { value: '2,626', height: '71%', label: '07-21' },
  { value: '2,847', height: '77%', label: '今日', isToday: true },
];

// MOCK: Top 5 调用工具
const TOP_TOOLS = [
  { rank: 1, name: 'ont_query_concept', count: '487' },
  { rank: 2, name: 'rag_search', count: '423' },
  { rank: 3, name: 'action_execute', count: '356' },
  { rank: 4, name: 'graph_traverse', count: '298' },
  { rank: 5, name: 'ont_validate', count: '245' },
];

// MOCK: 异常类型分布
const EXCEPTIONS = [
  { name: '500 内部错误', count: '15', percent: '65%', color: 'var(--destructive)' },
  { name: '403 权限拒绝', count: '6', percent: '26%', color: 'var(--warning)' },
  { name: '408 超时', count: '3', percent: '13%', color: '#60a5fa' },
  { name: '422 参数校验失败', count: '1', percent: '4%', color: '#c084fc' },
];

// MOCK: 安全事件
const SECURITY_EVENTS = [
  { severity: 'CRITICAL', severityCls: 'severity-critical', desc: '疑似暴力破解登录', time: '2026-07-22 09:12:28', detail: 'IP 203.0.113.42 短时间内 5 次登录失败，已触发临时封禁' },
  { severity: 'HIGH', severityCls: 'severity-high', desc: '异常权限提升操作', time: '2026-07-22 13:30:44', detail: 'zhangsan 尝试调用 admin 级 action_execute，被 403 拦截' },
  { severity: 'MEDIUM', severityCls: 'severity-medium', desc: '未授权 Server 注册尝试', time: '2026-07-21 18:45:10', detail: '来源 IP 10.0.3.99 尝试注册未审批的 MCP Server，已拒绝' },
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

export default function McpAuditPage() {
  const location = useLocation();

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>审计日志</h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          MCP 调用审计追踪，记录所有 Tool 调用、权限变更、配置修改、登录与注册行为。
        </p>
      </div>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: Activity, label: '今日调用', value: '2,847', sub: <><span style={{ color: 'var(--success)' }}>+8.4%</span> 较昨日</> },
          { icon: AlertTriangle, label: '异常调用', value: '23', valueCls: 'text-warning', sub: '错误率 0.81%' },
          { icon: ShieldX, label: '安全事件', value: '2', valueCls: 'text-destructive', sub: '涉及 1 个异常 IP' },
          { icon: ShieldCheck, label: '合规率', value: '99.2%', valueCls: 'text-success', sub: <><span style={{ color: 'var(--success)' }}>+0.1%</span> 较上周</> },
        ].map((s, i) => {
          const Icon = s.icon;
          const valueColor = s.valueCls === 'text-warning' ? 'var(--warning)' : s.valueCls === 'text-destructive' ? 'var(--destructive)' : s.valueCls === 'text-success' ? 'var(--success)' : 'var(--foreground)';
          return (
            <div key={i} className="v-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon style={{ width: 16, height: 16 }} />{s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: valueColor }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>时间范围</span>
          <input type="date" className="v-input" style={{ width: 140 }} defaultValue="2026-07-21" />
          <span style={{ color: 'var(--muted-foreground)' }}>-</span>
          <input type="date" className="v-input" style={{ width: 140 }} defaultValue="2026-07-22" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>操作类型</span>
          <select className="v-input" style={{ width: 160, cursor: 'pointer' }}>
            <option value="">全部</option>
            <option>工具调用</option>
            <option>权限变更</option>
            <option>配置修改</option>
            <option>登录</option>
            <option>注册</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>MCP Server</span>
          <select className="v-input" style={{ width: 160, cursor: 'pointer' }}>
            <option value="">全部</option>
            <option>mate-ont-server</option>
            <option>mate-rag-server</option>
            <option>mate-action-server</option>
            <option>mate-data-server</option>
            <option>mate-ea-server</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>用户</span>
          <select className="v-input" style={{ width: 130, cursor: 'pointer' }}>
            <option value="">全部</option>
            <option>zhangsan</option>
            <option>lisi</option>
            <option>wangwu</option>
            <option>System</option>
          </select>
        </div>
        <input className="v-input" style={{ width: 180 }} placeholder="搜索 Tool / trace_id..." />
        <button className="v-btn-primary"><Search style={{ width: 14, height: 14 }} />查询</button>
        <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出</button>
      </div>

      {/* Content: table + analysis panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Table */}
        <div style={{ minWidth: 0 }}>
          <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['时间', '操作者', '操作类型', '目标', '请求参数摘要', '状态', 'Token', 'IP 地址', 'trace_id'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_LOGS.map((log, i) => (
                <tr key={i} style={log.isAnomaly ? { background: 'rgba(255,97,102,0.04)' } : undefined}>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{log.time}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', color: log.isAnomaly ? 'var(--destructive)' : 'var(--foreground)' }}>{log.user}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${log.userType}`}>{log.typeLabel}</span>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: log.isAnomaly ? 'var(--destructive)' : 'var(--foreground)' }}>{log.server}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-foreground)' }}>{log.tool}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: log.isAnomaly ? 'var(--destructive)' : 'var(--muted-foreground)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', display: 'block' }}>{log.params}</span>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${log.statusCls}`}>{log.status}</span>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{log.token}</span>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: log.isAnomaly ? 'var(--destructive)' : 'var(--muted-foreground)' }}>{log.ip}</span>
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--border)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{log.traceId}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <span>共 2,847 条记录，显示 1-15 条</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}><ChevronLeft style={{ width: 14, height: 14 }} /></button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>1</button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>2</button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>3</button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>...</button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>190</button>
              <button className="v-btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}><ChevronRight style={{ width: 14, height: 14 }} /></button>
            </span>
          </div>
        </div>

        {/* Analysis panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Call trend */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />调用趋势（7 天）
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 24, position: 'relative' }}>
              <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, height: 1, background: 'var(--border)' }} />
              {TREND_DATA.map((d) => (
                <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: d.isToday ? 'var(--foreground)' : 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</div>
                  <div style={{ width: '100%', maxWidth: 32, background: d.isToday ? 'var(--border)' : 'var(--muted)', borderRadius: '3px 3px 0 0', minHeight: 2, height: d.height }} />
                  <div style={{ fontSize: 10, color: d.isToday ? 'var(--foreground)' : 'var(--border)', whiteSpace: 'nowrap' }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 tools */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />Top 5 调用工具
            </div>
            {TOP_TOOLS.map((t) => (
              <div key={t.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: t.rank < 5 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', flexShrink: 0, marginRight: 8 }}>{t.rank}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--foreground)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{t.count}</span>
              </div>
            ))}
          </div>

          {/* Exception distribution */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieChart style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />异常类型分布
            </div>
            {EXCEPTIONS.map((e) => (
              <div key={e.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: EXCEPTIONS.indexOf(e) < EXCEPTIONS.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: e.color }} />
                  <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{e.name}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--muted)', flex: 1, maxWidth: 80, margin: '0 12px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: e.color, width: e.percent }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{e.count}</span>
              </div>
            ))}
          </div>

          {/* Security events */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />最近安全事件
            </div>
            {SECURITY_EVENTS.map((e, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < SECURITY_EVENTS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <span className={`severity-tag ${e.severityCls}`} style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>{e.severity}</span>
                  <span style={{ fontSize: 12, color: 'var(--foreground)', marginLeft: 6 }}>{e.desc}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{e.time}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{e.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
