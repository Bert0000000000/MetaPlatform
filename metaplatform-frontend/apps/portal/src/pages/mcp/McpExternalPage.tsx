import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import {
  RefreshCw,
  Plus,
  Link,
  TrendingUp,
  Activity,
  AlertTriangle,
  Cable,
  Filter,
  Download,
  Globe,
  Shield,
  Search,
  GitMerge,
  Database,
  Zap,
  Eye,
  Pencil,
  Play,
  Ban,
  PlusCircle,
  Save,
  Check,
  Wrench,
  ScanSearch,
} from 'lucide-react';

// MOCK: 外部连接列表
interface ExtConn {
  id: string;
  name: string;
  icon: typeof Globe;
  protocol: 'MCP' | 'A2A' | 'REST';
  url: string;
  auth: string;
  authBadge: string;
  status: 'active' | 'configuring' | 'failed';
  statusBadge: string;
  statusDot: string;
  requests: string;
  successRate: string;
  rateColor: string;
}

const MOCK_CONNS: ExtConn[] = [
  { id: 'e1', name: 'OpenAI-MCP-Server', icon: Globe, protocol: 'MCP', url: 'https://api.openai.com/mcp/v1', auth: 'OAuth2', authBadge: 'v-badge-info', status: 'active', statusBadge: 'v-badge-success', statusDot: 'var(--success)', requests: '2,341', successRate: '99.8%', rateColor: 'var(--success)' },
  { id: 'e2', name: 'Anthropic-Tools', icon: Shield, protocol: 'MCP', url: 'https://anthropic.mate.local/proxy', auth: 'API Key', authBadge: 'v-badge-neutral', status: 'configuring', statusBadge: 'v-badge-warning', statusDot: 'var(--warning)', requests: '1,205', successRate: '99.5%', rateColor: 'var(--success)' },
  { id: 'e3', name: '第三方搜索服务', icon: Search, protocol: 'MCP', url: 'https://search.external.io/mcp', auth: 'OAuth2', authBadge: 'v-badge-info', status: 'failed', statusBadge: 'v-badge-error', statusDot: 'var(--destructive)', requests: '843', successRate: '87.2%', rateColor: 'var(--destructive)' },
  { id: 'e4', name: 'GitHub-Agent-Service', icon: GitMerge, protocol: 'A2A', url: 'https://agent.github.com/a2a/v1', auth: 'API Key', authBadge: 'v-badge-neutral', status: 'active', statusBadge: 'v-badge-success', statusDot: 'var(--success)', requests: '672', successRate: '100%', rateColor: 'var(--success)' },
  { id: 'e5', name: '数据治理平台', icon: Database, protocol: 'REST', url: 'https://data-gov.internal.corp/api', auth: '无', authBadge: 'v-badge-neutral', status: 'active', statusBadge: 'v-badge-success', statusDot: 'var(--success)', requests: '389', successRate: '99.9%', rateColor: 'var(--success)' },
  { id: 'e6', name: 'Dify-Agent-Cluster', icon: Zap, protocol: 'A2A', url: 'https://dify.mate.local/a2a/endpoint', auth: 'OAuth2', authBadge: 'v-badge-info', status: 'configuring', statusBadge: 'v-badge-warning', statusDot: 'var(--warning)', requests: '228', successRate: '95.6%', rateColor: 'var(--warning)' },
];

const PROTOCOL_BADGE: Record<string, string> = {
  MCP: 'v-badge-mcp',
  A2A: 'v-badge-a2a',
  REST: 'v-badge-rest',
};

const STATUS_LABEL: Record<string, string> = {
  active: '已激活',
  configuring: '配置中',
  failed: '连接失败',
};

// MOCK: 已发现工具
const MOCK_DISCOVERED = [
  { name: 'search_knowledge', source: 'New-External-Service', params: 3, status: 'synced', syncTime: '2026-07-22 14:32:02' },
  { name: 'analyze_data', source: 'New-External-Service', params: 5, status: 'synced', syncTime: '2026-07-22 14:32:02' },
  { name: 'generate_summary', source: 'New-External-Service', params: 2, status: 'synced', syncTime: '2026-07-22 14:32:02' },
  { name: 'list_repositories', source: 'GitHub-Agent-Service', params: 4, status: 'pending', syncTime: '2026-07-22 09:15:33' },
  { name: 'query_lineage', source: '数据治理平台', params: 6, status: 'synced', syncTime: '2026-07-22 13:48:11' },
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

export default function McpExternalPage() {
  const location = useLocation();

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>外部对接</h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          管理外部 MCP / A2A / REST 连接，接入第三方工具与服务能力。
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="v-btn"><RefreshCw style={{ width: 14, height: 14 }} />刷新发现</button>
          <button className="v-btn-primary"><Plus style={{ width: 14, height: 14 }} />添加连接</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: '外部连接', value: '12', sub: '已注册外部服务总数', subIcon: Link, subCls: '' },
          { label: '已激活', value: '9', sub: '较上周 +2', subIcon: TrendingUp, subCls: 'positive' },
          { label: '今日请求', value: '5,678', sub: '日均 4,320', subIcon: Activity, subCls: '' },
          { label: '错误率', value: '0.3%', sub: '目标 < 1%', subIcon: AlertTriangle, subCls: 'negative' },
        ].map((s, i) => {
          const SubIcon = s.subIcon;
          const subColor = s.subCls === 'positive' ? 'var(--success)' : s.subCls === 'negative' ? 'var(--destructive)' : 'var(--muted-foreground)';
          return (
            <div key={i} className="v-card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: subColor, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <SubIcon style={{ width: 12, height: 12 }} />{s.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection table */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cable style={{ width: 16, height: 16 }} />连接列表
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="v-btn" style={{ height: 28, fontSize: 12 }}><Filter style={{ width: 13, height: 13 }} />筛选</button>
            <button className="v-btn" style={{ height: 28, fontSize: 12 }}><Download style={{ width: 13, height: 13 }} />导出</button>
          </div>
        </div>
        <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['服务名称', '协议', '端点 URL', '认证方式', '状态', '请求 / 成功率', '操作'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_CONNS.map((c) => {
              const Icon = c.icon;
              return (
                <tr key={c.id}>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{c.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${PROTOCOL_BADGE[c.protocol]}`}>{c.protocol}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{c.url}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${c.authBadge}`}>{c.auth}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span className={`v-badge ${c.statusBadge}`}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c.statusDot }} />{STATUS_LABEL[c.status]}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{c.requests}</span>{' '}
                    <span style={{ color: c.rateColor, fontSize: 12 }}>{c.successRate}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: '0 6px', height: 28, fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius)' }} title="查看"><Eye style={{ width: 14, height: 14 }} /></button>
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: '0 6px', height: 28, fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius)' }} title="编辑"><Pencil style={{ width: 14, height: 14 }} /></button>
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', padding: '0 6px', height: 28, fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius)' }} title="测试"><Play style={{ width: 14, height: 14 }} /></button>
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--destructive)', padding: '0 6px', height: 28, fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius)' }} title="禁用"><Ban style={{ width: 14, height: 14 }} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

      {/* Add connection wizard */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusCircle style={{ width: 16, height: 16 }} />添加连接向导
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: Form */}
          <div className="v-card">
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>连接配置</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>服务名称</label>
              <input className="v-input" style={{ width: '100%', height: 34 }} defaultValue="New-External-Service" placeholder="例：OpenAI-MCP-Server" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>协议</label>
              <select className="v-input" style={{ width: '100%', height: 34, cursor: 'pointer' }}>
                <option>MCP (Streamable HTTP)</option>
                <option>MCP (SSE)</option>
                <option>A2A</option>
                <option>REST</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>端点 URL</label>
              <input className="v-input" style={{ width: '100%', height: 34 }} defaultValue="https://new-service.external.io/mcp" placeholder="https://example.com/mcp/v1" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>认证方式</label>
              <select className="v-input" style={{ width: '100%', height: 34, cursor: 'pointer' }}>
                <option>OAuth 2.0</option>
                <option>API Key</option>
                <option>Bearer Token</option>
                <option>无认证</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: 6 }}>凭证配置</label>
              <textarea className="v-input" style={{ width: '100%', minHeight: 60, padding: '8px 10px', fontFamily: 'var(--font-mono)', resize: 'vertical' }} defaultValue={'{"client_id": "mate_ext_01","client_secret": "********","scopes": ["tools:read","tools:invoke"]}'} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="v-btn-primary"><Play style={{ width: 14, height: 14 }} />测试连接</button>
              <button className="v-btn"><Save style={{ width: 14, height: 14 }} />保存配置</button>
            </div>
          </div>

          {/* Right: Test result */}
          <div className="v-card">
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>连接测试结果</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--success-subtle)', color: 'var(--success)' }}>
                <Check style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--success)' }}>连接成功</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>服务器已响应，协议握手完成</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: '响应延迟', value: '128ms' },
                { label: '可用工具数', value: '3' },
                { label: '协议版本', value: 'MCP 2024-11-05' },
                { label: '服务端', value: 'mcp-server/1.4' },
              ].map((d) => (
                <div key={d.label} style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{d.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>可用工具列表</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { name: 'search_knowledge', desc: '检索外部知识库，返回相关文档片段', params: '3 参数' },
                { name: 'analyze_data', desc: '对结构化数据执行统计分析并生成报告', params: '5 参数' },
                { name: 'generate_summary', desc: '对输入文本生成摘要与关键洞察', params: '2 参数' },
              ].map((t) => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Wrench style={{ width: 13, height: 13, color: 'var(--muted-foreground)' }} />{t.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.desc}</div>
                  </div>
                  <span className="v-badge v-badge-neutral">{t.params}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 16, marginBottom: 8 }}>连接日志</div>
            <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, color: 'var(--muted-foreground)', maxHeight: 100, overflowY: 'auto' }}>
              <span>14:32:01</span> <span style={{ color: '#60a5fa' }}>[INFO]</span> Initiating MCP handshake to https://new-service.external.io/mcp<br />
              <span>14:32:01</span> <span style={{ color: '#60a5fa' }}>[INFO]</span> Sending initialize request (protocol: 2024-11-05)<br />
              <span>14:32:01</span> <span style={{ color: 'var(--success)' }}>[OK]</span> Server responded: mcp-server/1.4, capabilities: tools<br />
              <span>14:32:02</span> <span style={{ color: '#60a5fa' }}>[INFO]</span> Sending initialized notification<br />
              <span>14:32:02</span> <span style={{ color: 'var(--success)' }}>[OK]</span> tools/list returned 3 tools<br />
              <span>14:32:02</span> <span style={{ color: 'var(--warning)' }}>[WARN]</span> Server rate limit: 100 req/min (shared pool)<br />
              <span>14:32:02</span> <span style={{ color: 'var(--success)' }}>[OK]</span> Connection test completed in 128ms
            </div>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

      {/* Discovered tools */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ScanSearch style={{ width: 16, height: 16 }} />已发现工具
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            从外部连接自动发现的工具共 <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>23</span> 个
          </div>
        </div>
        <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['工具名称', '来源服务', '参数数', '状态', '同步时间'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_DISCOVERED.map((t) => (
              <tr key={t.name}>
                <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Wrench style={{ width: 13, height: 13, color: 'var(--muted-foreground)' }} />{t.name}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.source}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.params}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span className={`v-badge ${t.status === 'synced' ? 'v-badge-success' : 'v-badge-warning'}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.status === 'synced' ? 'var(--success)' : 'var(--warning)' }} />
                    {t.status === 'synced' ? '已同步' : '待更新'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.syncTime}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
