import { useState } from 'react';
import {
  Plus,
  RefreshCw,
  Download,
  Server as ServerIcon,
  Activity,
  AlertTriangle,
  Wrench,
  Zap,
  Columns3,
  Settings as SettingsIcon,
  Square,
  RotateCcw,
  FileText,
  Search,
  GitBranch,
  PlusCircle,
  Pencil,
  FileSearch,
  ShieldCheck,
  Maximize2,
  Globe,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_MCP_SERVERS } from '@/mock'; // MOCK

// MOCK: Server 列表（基于 MOCK_MCP_SERVERS 扩展的展示数据，补充注册方式/调用/心跳等设计稿字段）
interface McpServerRow {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  registry: 'Nacos' | 'Manual' | 'API';
  tools: number;
  calls: number;
  latency: string;
  latencyClass: 'good' | 'warn' | 'bad';
  lastHeartbeat: string;
}

const MOCK_SERVERS: McpServerRow[] = [
  { id: 's1', name: 'mate-ont-server', status: 'online', registry: 'Nacos', tools: 12, calls: 1840, latency: '23ms', latencyClass: 'good', lastHeartbeat: '10s 前' },
  { id: 's2', name: 'mate-rag-server', status: 'online', registry: 'Nacos', tools: 8, calls: 2310, latency: '45ms', latencyClass: 'good', lastHeartbeat: '5s 前' },
  { id: 's3', name: 'mate-llmgw-server', status: 'online', registry: 'Nacos', tools: 6, calls: 1520, latency: '128ms', latencyClass: 'warn', lastHeartbeat: '3s 前' },
  { id: 's4', name: 'mate-agent-server', status: 'online', registry: 'Nacos', tools: 10, calls: 980, latency: '67ms', latencyClass: 'good', lastHeartbeat: '8s 前' },
  { id: 's5', name: 'mate-data-server', status: 'online', registry: 'Manual', tools: 9, calls: 640, latency: '34ms', latencyClass: 'good', lastHeartbeat: '12s 前' },
  { id: 's6', name: 'mate-wfe-server', status: 'online', registry: 'Nacos', tools: 7, calls: 520, latency: '18ms', latencyClass: 'good', lastHeartbeat: '6s 前' },
  { id: 's7', name: 'mate-ea-server', status: 'degraded', registry: 'Nacos', tools: 5, calls: 0, latency: '--', latencyClass: 'bad', lastHeartbeat: '3min 前' },
  { id: 's8', name: 'external-erp-connector', status: 'online', registry: 'API', tools: 10, calls: 610, latency: '210ms', latencyClass: 'warn', lastHeartbeat: '15s 前' },
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

const STATUS_BADGE: Record<McpServerRow['status'], { cls: string; label: string; dot: string }> = {
  online: { cls: 'v-badge-success', label: '运行中', dot: 'var(--success)' },
  degraded: { cls: 'v-badge-error', label: '异常', dot: 'var(--destructive)' },
  offline: { cls: 'v-badge-neutral', label: '已停止', dot: 'var(--muted-foreground)' },
};

const LATENCY_COLOR: Record<string, string> = {
  good: 'var(--success)',
  warn: 'var(--warning)',
  bad: 'var(--destructive)',
};

const REGISTRY_BADGE: Record<string, string> = {
  Nacos: 'v-badge-info',
  Manual: 'v-badge-neutral',
  API: 'v-badge-neutral',
};

// MOCK: 工具列表（详情面板）
const DETAIL_TOOLS = [
  { icon: Search, name: 'ont_query_concept', desc: '根据概念名称查询本体定义与属性' },
  { icon: GitBranch, name: 'ont_traverse_graph', desc: '遍历本体概念间的父子/关联关系' },
  { icon: PlusCircle, name: 'ont_create_instance', desc: '创建本体业务对象实例（G2）' },
  { icon: Pencil, name: 'ont_update_property', desc: '更新实例指定属性的值' },
  { icon: FileSearch, name: 'ont_schema_export', desc: '导出本体 Schema 为 OWL/JSON-LD 格式' },
  { icon: ShieldCheck, name: 'ont_validate_constraint', desc: '校验实例数据是否满足本体约束规则' },
];

// MOCK: 健康检查记录
const HEALTH_RECORDS = [
  { time: '07-22 14:59:38', status: '健康', statusColor: 'var(--success)', dot: 'ok', latency: '21ms' },
  { time: '07-22 14:49:37', status: '健康', statusColor: 'var(--success)', dot: 'ok', latency: '19ms' },
  { time: '07-22 14:39:36', status: '健康', statusColor: 'var(--success)', dot: 'ok', latency: '24ms' },
  { time: '07-22 14:29:35', status: '延迟偏高', statusColor: 'var(--warning)', dot: 'warn', latency: '156ms' },
  { time: '07-22 14:19:34', status: '健康', statusColor: 'var(--success)', dot: 'ok', latency: '22ms' },
];

export default function McpServerPage() {
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>('s1');

  const selected = MOCK_SERVERS.find((s) => s.id === selectedId) ?? MOCK_SERVERS[0];

  const healthDotColor: Record<string, string> = {
    ok: 'var(--success)',
    warn: 'var(--warning)',
    fail: 'var(--destructive)',
  };

  return (
    <div>
      <SubTabs items={MCP_TABS} activePath={location.pathname} />

      {/* Page header */}
      <div style={{ marginTop: 24, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Server 管理</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          管理 MCP Server 实例，监控连接状态、工具注册与 Nacos 心跳。
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="v-btn-primary"><Plus style={{ width: 14, height: 14 }} />添加 Server</button>
          <button className="v-btn"><RefreshCw style={{ width: 14, height: 14 }} />刷新状态</button>
          <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: ServerIcon, iconCls: '', value: '12', label: '注册总数' },
          { icon: Activity, iconCls: 'info', value: '9', label: '运行中', valueColor: 'var(--success)' },
          { icon: AlertTriangle, iconCls: 'danger', value: '1', label: '异常', valueColor: 'var(--destructive)' },
          { icon: Wrench, iconCls: '', value: '67', label: '总工具数' },
          { icon: Zap, iconCls: 'info', value: '8,420', label: '日均调用', sub: '+12.3% vs 昨日', subColor: 'var(--success)' },
        ].map((s, i) => {
          const Icon = s.icon;
          const iconBg = s.iconCls === 'danger' ? 'rgba(255,97,102,0.1)' : s.iconCls === 'warn' ? 'var(--warning-subtle)' : s.iconCls === 'info' ? 'rgba(59,130,246,0.1)' : 'var(--muted)';
          const iconColor = s.iconCls === 'danger' ? 'var(--destructive)' : s.iconCls === 'warn' ? 'var(--warning)' : s.iconCls === 'info' ? '#3b82f6' : 'var(--muted-foreground)';
          return (
            <div key={i} className="v-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 18, height: 18, color: iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, color: s.valueColor }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: 11, marginTop: 4, color: s.subColor }}>{s.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="v-input" style={{ height: 32, fontSize: 13, width: 220 }} placeholder="搜索 Server 名称..." />
        <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 130, cursor: 'pointer' }}>
          <option>全部状态</option>
          <option>运行中</option>
          <option>已停止</option>
          <option>异常</option>
        </select>
        <select className="v-input" style={{ height: 32, fontSize: 13, minWidth: 130, cursor: 'pointer' }}>
          <option>全部注册方式</option>
          <option>Nacos</option>
          <option>手动</option>
          <option>API</option>
        </select>
        <button className="v-btn" style={{ marginLeft: 'auto' }}><Columns3 style={{ width: 14, height: 14 }} />列设置</button>
      </div>

      {/* Table + Detail */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Server 名称', '状态', '注册方式', '工具数', '今日调用', '平均延迟', '最后心跳', '操作'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_SERVERS.map((srv) => {
                const sb = STATUS_BADGE[srv.status];
                const isSelected = srv.id === selectedId;
                return (
                  <tr key={srv.id} onClick={() => setSelectedId(srv.id)} style={{ cursor: 'pointer', background: isSelected ? 'var(--accent)' : undefined }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', fontWeight: 500, whiteSpace: 'nowrap' }}>{srv.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${sb.cls}`}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sb.dot }} />{sb.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${REGISTRY_BADGE[srv.registry]}`}>{srv.registry}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{srv.tools}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{srv.calls.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: LATENCY_COLOR[srv.latencyClass] }}>{srv.latency}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }} className="v-meta">{srv.lastHeartbeat}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} title="配置"><SettingsIcon style={{ width: 12, height: 12 }} /></button>
                        {srv.status === 'degraded' ? (
                          <>
                            <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} title="重启"><RotateCcw style={{ width: 12, height: 12 }} /></button>
                            <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} title="日志"><FileText style={{ width: 12, height: 12 }} /></button>
                          </>
                        ) : (
                          <>
                            <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} title="监控"><Activity style={{ width: 12, height: 12 }} /></button>
                            <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} title="停止"><Square style={{ width: 12, height: 12 }} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '10px 14px', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', background: 'var(--card)', textAlign: 'right' }}>
            共 12 条记录，当前显示 1-8 &nbsp;|&nbsp; <span style={{ cursor: 'pointer', color: 'var(--foreground)' }}>下一页</span>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ width: 360, flexShrink: 0, position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <div className="v-card">
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{selected.name}</span>
                <span className="v-badge v-badge-success"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />运行中</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="v-badge v-badge-info">Nacos</span>
                <span className="v-badge v-badge-neutral">SAA MCP</span>
              </div>
            </div>

            {/* Basic info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>基本信息</div>
              {[
                { label: 'Server ID', value: 'srv-ont-a1b2c3d4' },
                { label: '版本', value: 'v1.2.0-saa' },
                { label: '注册时间', value: '2026-06-15 10:23:00' },
                { label: 'Nacos NS', value: 'mate-mcp-prod' },
                { label: '连接客户端', value: '7' },
                { label: '可用性 (30d)', value: '99.97%', color: 'var(--success)' },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Tool list */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                工具列表 <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400, textTransform: 'none' }}>12 个</span>
              </div>
              {DETAIL_TOOLS.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 8, borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', border: '1px solid transparent' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 'var(--radius)', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon style={{ width: 13, height: 13 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Health timeline */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                健康检查记录 <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400, textTransform: 'none' }}>最近 5 次</span>
              </div>
              <div style={{ position: 'relative', paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: 3, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
                {HEALTH_RECORDS.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, position: 'relative' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, position: 'absolute', left: -16, border: '2px solid var(--card)', background: healthDotColor[h.dot] }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', minWidth: 110 }}>{h.time}</span>
                    <span style={{ flex: 1, color: h.statusColor }}>{h.status}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)' }}>{h.latency}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Config JSON */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>配置参数</div>
              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, color: 'var(--muted-foreground)' }}>
                {'{'}
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"nacosNamespace"</span>: <span style={{ color: '#a5d6a7' }}>"mate-mcp-prod"</span>,
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"heartbeatInterval"</span>: <span style={{ color: '#fbbf24' }}>10000</span>,
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"maxConcurrentCalls"</span>: <span style={{ color: '#fbbf24' }}>50</span>,
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"toolTimeout"</span>: <span style={{ color: '#fbbf24' }}>30000</span>,
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"enableAuth"</span>: <span style={{ color: '#c084fc' }}>true</span>,
                <br />
                &nbsp;&nbsp;<span style={{ color: '#7dd3fc' }}>"logLevel"</span>: <span style={{ color: '#a5d6a7' }}>"INFO"</span>
                <br />
                {'}'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service topology */}
      <div style={{ marginTop: 20 }}>
        <div className="v-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>服务拓扑图</h3>
            <button className="v-btn" style={{ height: 28, fontSize: 12 }}><Maximize2 style={{ width: 12, height: 12 }} />展开</button>
          </div>
          <div style={{ position: 'relative', padding: '20px 0', overflowX: 'auto' }}>
            {/* Layer 1 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>AI 中间层</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {['mate-llmgw-server', 'mate-rag-server', 'mate-agent-server'].map((n) => (
                  <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid #404040', borderRadius: 'var(--radius)', background: 'var(--muted)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                    {n}
                  </span>
                )).flatMap((el, i, arr) => i < arr.length - 1 ? [el, <span key={`a${i}`} style={{ color: 'var(--border)', fontSize: 14, padding: '0 2px' }}>↔</span>] : [el])}
              </div>
            </div>
            {/* Connector */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                <line x1="8" y1="0" x2="8" y2="18" />
                <polyline points="3,14 8,22 13,14" />
              </svg>
            </div>
            {/* Layer 2 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>核心引擎层</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { name: 'mate-ont-server', dot: 'var(--success)' },
                  { name: 'mate-wfe-server', dot: 'var(--success)' },
                  { name: 'mate-data-server', dot: 'var(--success)' },
                  { name: 'mate-ea-server', dot: 'var(--destructive)' },
                ].map((n, i, arr) => (
                  <span key={n.name} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.dot }} />
                      {n.name}
                    </span>
                    {i < arr.length - 1 && <span style={{ color: 'var(--border)', fontSize: 14, padding: '0 2px' }}>↔</span>}
                  </span>
                ))}
              </div>
            </div>
            {/* Connector */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                <line x1="8" y1="0" x2="8" y2="18" />
                <polyline points="3,14 8,22 13,14" />
              </svg>
            </div>
            {/* Layer 3 */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>外部对接层</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                  external-erp-connector
                </span>
                <span style={{ color: 'var(--muted-foreground)', fontSize: 11, margin: '0 12px' }}>via Nacos Registry</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)', fontSize: 12 }}>
                  <Globe style={{ width: 14, height: 14 }} />
                  第三方 MCP Server
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
