import { useState } from 'react';
import {
  RefreshCw,
  Plus,
  Download,
  Unplug,
  Info,
  Plug,
  Search,
  FileSearch,
  MessageSquare,
  Database,
  ShieldCheck,
  GitPullRequest,
  Play,
  Trash2,
} from 'lucide-react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

// MOCK: Client 连接列表
interface ClientConn {
  id: string;
  server: string;
  serverDesc: string;
  endpoint: string;
  status: 'connected' | 'reconnecting' | 'disconnected';
  connectedAt: string;
  tools: number;
  resources: number;
}

const MOCK_CONNS: ClientConn[] = [
  { id: 'c1', server: 'mate-ont-server', serverDesc: '本体引擎 MCP Server', endpoint: 'nacos://mate-ont-server:8081', status: 'connected', connectedAt: '2026-07-22 09:14:32', tools: 4, resources: 7 },
  { id: 'c2', server: 'mate-rag-server', serverDesc: 'RAG 知识检索 Server', endpoint: 'nacos://mate-rag-server:8082', status: 'connected', connectedAt: '2026-07-22 09:14:33', tools: 3, resources: 2 },
  { id: 'c3', server: 'mate-llmgw-server', serverDesc: 'LLM Gateway Server', endpoint: 'nacos://mate-llmgw-server:8083', status: 'connected', connectedAt: '2026-07-22 09:14:35', tools: 2, resources: 0 },
  { id: 'c4', server: 'mate-data-server', serverDesc: '数据集成 Server', endpoint: 'nacos://mate-data-server:8084', status: 'reconnecting', connectedAt: '2026-07-22 09:14:34', tools: 2, resources: 3 },
  { id: 'c5', server: 'mate-ea-server', serverDesc: '架构资产 Server', endpoint: 'nacos://mate-ea-server:8085', status: 'connected', connectedAt: '2026-07-22 09:15:01', tools: 2, resources: 5 },
  { id: 'c6', server: 'mate-iam-server', serverDesc: '身份认证 Server', endpoint: 'nacos://mate-iam-server:8086', status: 'disconnected', connectedAt: '2026-07-22 08:47:19', tools: 1, resources: 0 },
];

const CONN_STATUS: Record<ClientConn['status'], { cls: string; label: string; dot: string }> = {
  connected: { cls: 'v-badge-success', label: '已连接', dot: 'var(--success)' },
  reconnecting: { cls: 'v-badge-warning', label: '重连中', dot: 'var(--warning)' },
  disconnected: { cls: 'v-badge-neutral', label: '已断开', dot: 'var(--muted-foreground)' },
};

// MOCK: 工具列表
const MOCK_TOOL_LIST = [
  { id: 'tl1', name: 'query_ontology', desc: '查询本体图谱中的实体与关系', icon: Search, active: true },
  { id: 'tl2', name: 'rag_search', desc: 'RAG 知识库语义检索', icon: FileSearch, active: false },
  { id: 'tl3', name: 'llm_complete', desc: '调用 LLM 进行文本补全', icon: MessageSquare, active: false },
  { id: 'tl4', name: 'list_resources', desc: '列出 Server 暴露的资源', icon: Database, active: false },
  { id: 'tl5', name: 'check_permission', desc: '校验调用方权限与审计', icon: ShieldCheck, active: false },
  { id: 'tl6', name: 'sync_arch_asset', desc: '同步架构中心资产数据', icon: GitPullRequest, active: false },
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

export default function McpClientPage() {
  const location = useLocation();
  const [activeTool, setActiveTool] = useState('tl1');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [authType, setAuthType] = useState<'none' | 'apikey' | 'oauth2' | 'bearer'>('none');
  const [testResult, setTestResult] = useState<'idle' | 'success'>('idle');

  const handleTestConnection = () => {
    setTestResult('success');
  };

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Client 管理</h1>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          管理 MCP Client 连接，查看 Server 连接状态、工具调用与资源访问情况。
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="v-btn"><RefreshCw style={{ width: 14, height: 14 }} />刷新状态</button>
          <button className="v-btn-primary" onClick={() => setCreateDrawerOpen(true)}><Plus style={{ width: 14, height: 14 }} />新建连接</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: '已连接 Server', value: '8', sub: '较昨日 +1' },
          { label: '活跃会话', value: '23', sub: '峰值 31 / 今日调用 1,247 次' },
          { label: '缓存命中', value: '89.2%', sub: '总请求 12,480 / 命中 11,131' },
          { label: '本地工具', value: '15', sub: '已注册 15 / 就绪 15' },
        ].map((s) => (
          <div key={s.label} className="v-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Connection table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Client 连接管理</h2>
        <button className="v-btn" style={{ height: 28, fontSize: 12 }}><Download style={{ width: 13, height: 13 }} />导出</button>
      </div>
      <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Server 名称', '端点', '状态', '连接时间', '工具数', '资源数', '操作'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOCK_CONNS.map((c) => {
            const sb = CONN_STATUS[c.status];
            return (
              <tr key={c.id}>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 6px', borderRadius: 4 }}>{c.server}</span>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.serverDesc}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 6px', borderRadius: 4 }}>{c.endpoint}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span className={`v-badge ${sb.cls}`}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sb.dot }} />{sb.label}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.connectedAt}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{c.tools}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{c.resources}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.status === 'disconnected' ? (
                      <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Plug style={{ width: 13, height: 13 }} />连接</button>
                    ) : (
                      <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Unplug style={{ width: 13, height: 13 }} />断开</button>
                    )}
                    <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><RefreshCw style={{ width: 13, height: 13 }} />刷新</button>
                    <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Info style={{ width: 13, height: 13 }} />详情</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Tool Invoke Panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>工具调用面板</h2>
      </div>
      <div className="v-card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--card)' }}>
          {/* Left: Tool list */}
          <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>工具列表</div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {MOCK_TOOL_LIST.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === activeTool;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)', background: isActive ? 'var(--muted)' : undefined,
                      borderLeft: isActive ? '2px solid var(--foreground)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: isActive ? 'var(--border)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14 }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Params + Response */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Server select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <label style={{ fontSize: 13, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>目标 Server</label>
              <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 220, cursor: 'pointer' }}>
                <option>mate-ont-server - 本体引擎 MCP Server</option>
                <option>mate-rag-server - RAG 知识检索 Server</option>
                <option>mate-llmgw-server - LLM Gateway Server</option>
                <option>mate-data-server - 数据集成 Server</option>
                <option>mate-ea-server - 架构资产 Server</option>
                <option>mate-iam-server - 身份认证 Server</option>
              </select>
            </div>

            {/* Param form */}
            <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
              <h4 style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>参数输入</h4>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>查询语句<span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 6 }}>string</span></label>
                <input className="v-input" style={{ width: '100%', height: 36 }} defaultValue="MATCH (n:BusinessObject) RETURN n LIMIT 20" />
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Cypher 查询语句或自然语言描述</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>本体域<span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 6 }}>string</span></label>
                <select className="v-input" style={{ width: '100%', height: 36, cursor: 'pointer' }}>
                  <option>com.metaplatform.core</option>
                  <option>com.metaplatform.agent</option>
                  <option>com.metaplatform.data</option>
                  <option>com.metaplatform.arch</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>指定本体命名空间</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>返回格式<span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 6 }}>string</span></label>
                <select className="v-input" style={{ width: '100%', height: 36, cursor: 'pointer' }}>
                  <option>json</option>
                  <option>table</option>
                  <option>graph</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>分页参数<span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 6 }}>object</span></label>
                <textarea className="v-input" style={{ width: '100%', height: 80, padding: '10px 12px', resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }} defaultValue={'{"offset": 0, "limit": 20, "order_by": "created_at", "order": "desc"}'} />
              </div>
            </div>

            {/* Response */}
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>调用结果</h4>
                <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />200 OK
                </span>
              </div>
              <div style={{ background: '#0d0d0d', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, maxHeight: 240, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {'{'}
                <br />
                {'  '}<span style={{ color: '#7dd3fc' }}>"status"</span>: <span style={{ color: '#a3e635' }}>"success"</span>,
                <br />
                {'  '}<span style={{ color: '#7dd3fc' }}>"data"</span>: {'{'}
                <br />
                {'    '}<span style={{ color: '#7dd3fc' }}>"total"</span>: <span style={{ color: '#fbbf24' }}>8</span>,
                <br />
                {'    '}<span style={{ color: '#7dd3fc' }}>"results"</span>: [
                <br />
                {'      {'} <span style={{ color: '#7dd3fc' }}>"id"</span>: <span style={{ color: '#a3e635' }}>"bo-001"</span>, <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"客户"</span>, <span style={{ color: '#7dd3fc' }}>"attributes"</span>: <span style={{ color: '#fbbf24' }}>12</span> {'}'},
                <br />
                {'      {'} <span style={{ color: '#7dd3fc' }}>"id"</span>: <span style={{ color: '#a3e635' }}>"bo-002"</span>, <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"订单"</span>, <span style={{ color: '#7dd3fc' }}>"attributes"</span>: <span style={{ color: '#fbbf24' }}>18</span> {'}'},
                <br />
                {'      {'} <span style={{ color: '#7dd3fc' }}>"id"</span>: <span style={{ color: '#a3e635' }}>"bo-003"</span>, <span style={{ color: '#7dd3fc' }}>"name"</span>: <span style={{ color: '#a3e635' }}>"产品"</span>, <span style={{ color: '#7dd3fc' }}>"attributes"</span>: <span style={{ color: '#fbbf24' }}>9</span> {'}'}
                <br />
                {'    ]'}
                <br />
                {'  }'},
                <br />
                {'  '}<span style={{ color: '#7dd3fc' }}>"meta"</span>: {'{'} <span style={{ color: '#7dd3fc' }}>"server"</span>: <span style={{ color: '#a3e635' }}>"mate-ont-server"</span>, <span style={{ color: '#7dd3fc' }}>"latency_ms"</span>: <span style={{ color: '#fbbf24' }}>142</span>, <span style={{ color: '#7dd3fc' }}>"cache_hit"</span>: <span style={{ color: '#c084fc' }}>false</span> {'}'}
                <br />
                {'}'}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v-btn-primary"><Play style={{ width: 14, height: 14 }} />调用</button>
                <button className="v-btn"><Trash2 style={{ width: 14, height: 14 }} />清空</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
                <span>响应时间: <span style={{ color: 'var(--success)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>142ms</span></span>
                <span>Tokens: <span style={{ color: 'var(--foreground)' }}>387</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormDrawer
        open={createDrawerOpen}
        title="新建 MCP Client 连接"
        onCancel={() => { setCreateDrawerOpen(false); setTestResult('idle'); }}
        onOk={() => { setCreateDrawerOpen(false); setTestResult('idle'); }}
      >
        <FormSection title="基本信息" desc="配置连接名称与目标 Server URL">
          <Field label="连接名称" required>
            <TextInput placeholder="例：本体引擎连接" />
          </Field>
          <Field label="URL" required>
            <TextInput placeholder="nacos://mate-ont-server:8081" />
          </Field>
          <Field label="协议版本">
            <Select defaultValue="2.0">
              <option value="1.0">1.0</option>
              <option value="2.0">2.0</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea placeholder="连接用途说明..." rows={3} />
          </Field>
        </FormSection>

        <FormSection title="鉴权配置" desc="选择连接 Server 的鉴权方式">
          <Field label="鉴权方式">
            <Select value={authType} onChange={(e) => { setAuthType(e.target.value as typeof authType); setTestResult('idle'); }}>
              <option value="none">无</option>
              <option value="apikey">APIKey</option>
              <option value="oauth2">OAuth2</option>
              <option value="bearer">Bearer Token</option>
            </Select>
          </Field>
          {authType === 'apikey' && (
            <Field label="APIKey">
              <TextInput type="password" placeholder="输入 API Key" />
            </Field>
          )}
          {authType === 'bearer' && (
            <Field label="Bearer Token">
              <TextInput type="password" placeholder="输入 Bearer Token" />
            </Field>
          )}
          {authType === 'oauth2' && (
            <Field label="OAuth2 配置">
              <TextInput placeholder="client_id:client_secret" />
            </Field>
          )}
        </FormSection>

        <FormSection title="运行参数" desc="连接同步与超时控制">
          <Field label="同步间隔（秒）">
            <TextInput type="number" defaultValue={30} min={1} />
          </Field>
          <Field label="超时（秒）">
            <TextInput type="number" defaultValue={15} min={1} />
          </Field>
        </FormSection>

        <FormSection title="连接测试" desc="提交前验证连接是否可用">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="v-btn-primary" onClick={handleTestConnection} style={{ height: 32, fontSize: 13 }}>
              <Plug style={{ width: 14, height: 14 }} />测试连接
            </button>
            {testResult === 'success' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
                <CheckCircle style={{ width: 14, height: 14 }} />连接成功
              </span>
            )}
          </div>
        </FormSection>
      </FormDrawer>
    </div>
  );
}
