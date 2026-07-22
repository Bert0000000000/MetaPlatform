import { useState } from 'react';
import {
  Zap,
  Timer,
  AlertTriangle,
  Wifi,
  Wrench,
  Search,
  FileSearch,
  Play,
  Database,
  GitFork,
  Globe,
  FileText,
  Network,
  Share2,
  Workflow,
  Eye,
  MousePointerClick,
  SlidersHorizontal,
  Terminal,
  History,
  Copy,
  Download,
  RotateCcw,
  Code,
  Sparkles,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';

// MOCK: 工具面板分组
const TOOL_GROUPS = [
  {
    label: 'Mate-Internal', online: true,
    tools: [
      { name: 'ont_query_concept', icon: Search, active: true },
      { name: 'rag_search', icon: FileSearch, active: false },
      { name: 'action_execute', icon: Play, active: false },
      { name: 'data_query', icon: Database, active: false },
      { name: 'graph_traverse', icon: GitFork, active: false },
    ],
  },
  {
    label: 'Search-Server', online: true,
    tools: [
      { name: 'web_search', icon: Globe, active: false },
      { name: 'doc_generate', icon: FileText, active: false },
    ],
  },
  {
    label: 'KG-Server', online: true,
    tools: [
      { name: 'kg_query', icon: Network, active: false },
      { name: 'kg_link', icon: Share2, active: false },
    ],
  },
  {
    label: 'Workflow-Srv', online: false,
    tools: [
      { name: 'wfe_start', icon: Workflow, active: false },
      { name: 'wfe_status', icon: Eye, active: false },
    ],
  },
];

// MOCK: 调用历史
const MOCK_HISTORY = [
  { time: '14:33:01', tool: 'ont_query_concept', params: '{"conceptId":"com.mate.ont.Employee","depth":2}', status: 200, latency: '127ms', fillCls: 'fast', fillWidth: '16%' },
  { time: '14:31:45', tool: 'rag_search', params: '{"query":"2026 Q2 revenue","topK":5}', status: 200, latency: '342ms', fillCls: 'medium', fillWidth: '43%' },
  { time: '14:28:12', tool: 'action_execute', params: '{"actionId":"act-send-email","payload":{...}}', status: 200, latency: '856ms', fillCls: 'slow', fillWidth: '100%' },
  { time: '14:25:03', tool: 'data_query', params: '{"sql":"SELECT * FROM orders WHERE ...","limit":50}', status: 403, latency: '23ms', fillCls: 'fast', fillWidth: '3%' },
  { time: '14:22:18', tool: 'ont_query_concept', params: '{"conceptId":"com.mate.ont.Department","depth":1}', status: 200, latency: '89ms', fillCls: 'fast', fillWidth: '11%' },
  { time: '14:18:06', tool: 'graph_traverse', params: '{"startNode":"EMP-0042","direction":"out","maxDepth":3}', status: 200, latency: '445ms', fillCls: 'medium', fillWidth: '56%' },
  { time: '14:15:32', tool: 'rag_search', params: '{"query":"Spring AI Alibaba version","topK":3}', status: 200, latency: '298ms', fillCls: 'medium', fillWidth: '38%' },
  { time: '14:10:47', tool: 'action_execute', params: '{"actionId":"act-sync-data","payload":{"src":"pg"}}', status: 500, latency: '1.2s', fillCls: 'slow', fillWidth: '100%' },
];

const LATENCY_FILL: Record<string, string> = {
  fast: 'var(--success)',
  medium: 'var(--warning)',
  slow: 'var(--destructive)',
};

const MCP_TABS: SubTabItem[] = [
  { label: '工具注册', path: '/mcp' },
  { label: 'Server 管理', path: '/mcp/server' },
  { label: 'Client 管理', path: '/mcp/client' },
  { label: '调试器', path: '/mcp/debugger' },
  { label: '权限管理', path: '/mcp/permissions' },
  { label: '外部对接', path: '/mcp/external' },
  { label: '审计日志', path: '/mcp/audit' },
];

export default function McpDebuggerPage() {
  const location = useLocation();
  const [activeTool, setActiveTool] = useState('ont_query_concept');

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>调试器</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          测试和调试 MCP 工具调用，验证请求参数与返回结果。
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: Zap, cls: 'info', value: '45', label: '今日调用' },
          { icon: Timer, cls: 'success', value: '230ms', label: '平均响应' },
          { icon: AlertTriangle, cls: 'warning', value: '2.1%', label: '错误率' },
          { icon: Wifi, cls: '', value: '12', label: '活跃连接' },
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

      {/* Debug layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: Tool panel */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="v-card" style={{ padding: 12, position: 'sticky', top: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wrench style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />工具选择
            </div>
            {TOOL_GROUPS.map((g) => (
              <div key={g.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.online ? 'var(--success)' : 'var(--muted-foreground)' }} />
                  {g.label}
                </div>
                {g.tools.map((t) => {
                  const Icon = t.icon;
                  const isActive = t.name === activeTool;
                  return (
                    <div
                      key={t.name}
                      onClick={() => setActiveTool(t.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius)',
                        cursor: 'pointer', fontSize: 13, marginBottom: 1, background: isActive ? 'var(--muted)' : undefined,
                      }}
                    >
                      <Icon style={{ width: 14, height: 14, color: isActive ? '#60a5fa' : 'var(--muted-foreground)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? '#60a5fa' : 'var(--foreground)' }}>
                        {t.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Target selector */}
          <div className="v-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MousePointerClick style={{ width: 14, height: 14 }} /> 选择目标
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {[
                { label: 'Server', options: ['Mate-Internal-Server', 'External-Search-Server', 'DBA-Assistant-Server', 'Knowledge-Graph-Server', 'Workflow-Engine-Server'] },
                { label: 'Tool', options: ['ont_query_concept', 'rag_search', 'action_execute', 'data_query', 'graph_traverse', 'doc_generate'] },
                { label: '认证身份', options: ['Admin (全权限)', 'Developer (模块权限)', 'Viewer (只读权限)', 'External (受限权限)'] },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{f.label}</label>
                  <select className="v-input" style={{ minWidth: 200, height: 32, cursor: 'pointer' }}>
                    {f.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Params input */}
          <div className="v-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal style={{ width: 14, height: 14 }} /> 参数输入 <span style={{ fontSize: 11, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)' }}>{activeTool}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles style={{ width: 12, height: 12 }} />参数模板:</span>
              {['Employee 深度 2', 'Department 浅查', '全部关系', '含废弃节点'].map((t) => (
                <button key={t} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--foreground)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>{t}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              {[
                { label: 'conceptId', required: true, type: 'string', value: 'com.mate.ont.Employee', desc: '本体概念的唯一标识符', inputType: 'text' },
                { label: 'depth', required: true, type: 'integer', value: '2', desc: '查询深度，0 表示仅当前节点', inputType: 'number' },
                { label: 'relations', required: false, type: 'string[]', value: 'belongs_to, reports_to', desc: '需要遍历的关系类型，逗号分隔', inputType: 'text' },
                { label: 'includeDeprecated', required: false, type: 'boolean', value: 'false', desc: '是否包含已废弃的概念', inputType: 'select', options: ['false', 'true'] },
              ].map((p) => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.label}
                    {p.required && <span style={{ color: 'var(--destructive)', fontSize: 14 }}>*</span>}
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', background: 'var(--muted)', padding: '0 4px', borderRadius: 2 }}>{p.type}</span>
                  </label>
                  {p.inputType === 'select' ? (
                    <select className="v-input" style={{ width: '100%', height: 32, cursor: 'pointer' }}>
                      {p.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="v-input" type={p.inputType} defaultValue={p.value} style={{ height: 32 }} />
                  )}
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{p.desc}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
              <button className="v-btn-primary"><Play style={{ width: 14, height: 14 }} />执行调用</button>
              <button className="v-btn"><RotateCcw style={{ width: 14, height: 14 }} />重置参数</button>
              <button className="v-btn"><Code style={{ width: 14, height: 14 }} />查看 JSON</button>
            </div>
          </div>

          {/* Response */}
          <div className="v-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal style={{ width: 14, height: 14 }} /> 调用结果
            </div>
            <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--foreground)', minHeight: 180, maxHeight: 300, overflowY: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              <span style={{ color: '#7dd3fc' }}>"status"</span>: <span style={{ color: '#fbbf24' }}>200</span>,
              <br />
              <span style={{ color: '#7dd3fc' }}>"result"</span>: {'{'}
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"concept"</span>: <span style={{ color: '#a3e635' }}>"com.mate.ont.Employee"</span>,
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"label"</span>: <span style={{ color: '#a3e635' }}>"员工"</span>,
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"properties"</span>: [
              <br />
              {'    {'} <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"employeeId"</span>, <span style={{ color: '#7dd3fc' }}>"type"</span>: <span style={{ color: '#a3e635' }}>"string"</span> {'}'},
              <br />
              {'    {'} <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"name"</span>, <span style={{ color: '#7dd3fc' }}>"type"</span>: <span style={{ color: '#a3e635' }}>"string"</span> {'}'},
              <br />
              {'    {'} <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"department"</span>, <span style={{ color: '#7dd3fc' }}>"type"</span>: <span style={{ color: '#a3e635' }}>"reference"</span> {'}'}
              <br />
              {'  ]'},
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"relations"</span>: {'{'}
              <br />
              {'    '}<span style={{ color: '#7dd3fc' }}>"belongs_to"</span>: [<span style={{ color: '#a3e635' }}>"com.mate.ont.Department"</span>],
              <br />
              {'    '}<span style={{ color: '#7dd3fc' }}>"reports_to"</span>: [<span style={{ color: '#a3e635' }}>"com.mate.ont.Employee"</span>]
              <br />
              {'  }'},
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"depthReached"</span>: <span style={{ color: '#fbbf24' }}>2</span>,
              <br />
              {'  '}<span style={{ color: '#7dd3fc' }}>"totalNodes"</span>: <span style={{ color: '#fbbf24' }}>14</span>
              <br />
              {'}'}
            </div>
            {/* Response time bar */}
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>响应时间</span>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'var(--success)', width: '25%' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: 'var(--success)' }}>127ms</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                <span>状态 <span style={{ fontWeight: 500, color: 'var(--success)' }}>200 OK</span></span>
                <span>Token 用量 <span style={{ fontWeight: 500 }}>输入 42 / 输出 186</span></span>
                <span>响应大小 <span style={{ fontWeight: 500 }}>1.2 KB</span></span>
                <span>时间 <span style={{ fontWeight: 500 }}>2026-07-21 14:33:01</span></span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="v-btn" style={{ height: 26, fontSize: 12 }}><Copy style={{ width: 12, height: 12 }} />复制</button>
                <button className="v-btn" style={{ height: 26, fontSize: 12 }}><Download style={{ width: 12, height: 12 }} />导出</button>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="v-card">
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History style={{ width: 14, height: 14 }} /> 调用历史 <span style={{ fontSize: 11, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 'var(--radius)' }}>最近 8 条</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['时间', '工具', '参数摘要', '状态', '耗时'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_HISTORY.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{h.time}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{h.tool}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.params}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className={`v-badge ${h.status === 200 ? 'v-badge-success' : h.status === 403 ? 'v-badge-warning' : 'v-badge-error'}`}>{h.status}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: LATENCY_FILL[h.fillCls], width: h.fillWidth }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h.latency}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
