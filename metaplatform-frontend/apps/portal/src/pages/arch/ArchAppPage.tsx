import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Network, PanelRight, HeartPulse, ChevronRight,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const stats = [
  { label: '应用总数', value: '8', sub: 'APP 层应用' },
  { label: '微服务', value: '15', sub: 'TECH 层服务' },
  { label: 'API 端点', value: '234', sub: '已注册 REST / gRPC' },
  { label: '依赖关系', value: '47', sub: '跨模块调用链路' },
];

// MOCK
const appNodes = ['APP-DASHBOARD', 'APP-SUPERAI', 'APP-DW', 'APP-APPHUB', 'APP-ONTSTUDIO', 'APP-ARCH', 'APP-MCPHUB'];
// MOCK
const serviceNodes = ['TECH-IAM', 'TECH-ONT', 'TECH-LLMGW', 'TECH-AGENT', 'TECH-RAG', 'TECH-WFE', 'TECH-DATA'];
// MOCK
const infraNodes = ['PostgreSQL', 'Neo4j', 'Milvus', 'Redis', 'Kafka', 'Nacos'];
// MOCK
const deps = [
  { name: 'TECH-LLMGW', status: '正常', badge: 'success' },
  { name: 'TECH-RAG', status: '正常', badge: 'success' },
  { name: 'TECH-AGENT', status: '正常', badge: 'success' },
  { name: 'TECH-ONT', status: '正常', badge: 'success' },
  { name: 'TECH-MCP', status: '构建中', badge: 'warning' },
];
// MOCK
const healthRows = [
  { caller: 'APP-SUPERAI', callee: 'TECH-LLMGW', proto: 'REST', calls: '12,480', rate: '99.8%', rateColor: 'success', p99: '23ms', status: '健康', badge: 'success' },
  { caller: 'APP-SUPERAI', callee: 'TECH-RAG', proto: 'REST', calls: '8,320', rate: '99.5%', rateColor: 'success', p99: '145ms', status: '健康', badge: 'success' },
  { caller: 'APP-SUPERAI', callee: 'TECH-AGENT', proto: 'REST', calls: '3,160', rate: '97.2%', rateColor: 'warning', p99: '1.2s', status: '波动', badge: 'warning' },
  { caller: 'APP-APPHUB', callee: 'TECH-WFE', proto: 'REST', calls: '5,740', rate: '99.9%', rateColor: 'success', p99: '18ms', status: '健康', badge: 'success' },
  { caller: 'APP-APPHUB', callee: 'TECH-ONT', proto: 'REST', calls: '6,890', rate: '99.6%', rateColor: 'success', p99: '34ms', status: '健康', badge: 'success' },
  { caller: 'APP-DW', callee: 'TECH-A2A', proto: 'A2A', calls: '1,020', rate: '95.1%', rateColor: 'warning', p99: '2.8s', status: '波动', badge: 'warning' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchAppPage() {
  const location = useLocation();
  const [selectedApp, setSelectedApp] = useState('APP-SUPERAI');

  return (
    <>
      <style>{`
        :root { --info:#60a5fa; --info-subtle:#141824; }
        .aa-page-header { margin-bottom:24px; }
        .aa-page-header h1 { font-size:24px; font-weight:700; margin-bottom:6px; }
        .aa-page-header p { font-size:14px; color:var(--muted-foreground); }
        .aa-v-card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .aa-v-card-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .aa-v-mono { font-family:var(--font-mono); font-size:12px; color:var(--muted-foreground); }
        .aa-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .aa-stat-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:16px; }
        .aa-stat-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; }
        .aa-stat-value { font-size:28px; font-weight:700; }
        .aa-stat-sub { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .aa-topo-layout { display:flex; gap:16px; margin-bottom:20px; }
        .aa-topo-main { flex:1; min-width:0; }
        .aa-topo-graph { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:20px; position:relative; min-height:520px; }
        .aa-topo-layer { margin-bottom:8px; position:relative; }
        .aa-topo-layer:last-child { margin-bottom:0; }
        .aa-topo-layer-label { font-size:10px; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted-foreground); margin-bottom:8px; display:flex; align-items:center; gap:8px; }
        .aa-topo-layer-label::after { content:''; flex:1; height:1px; background:var(--border); }
        .aa-topo-nodes { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
        .aa-topo-node { padding:8px 14px; border-radius:var(--radius); border:1px solid var(--border); background:var(--card); font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; white-space:nowrap; position:relative; }
        .aa-topo-node:hover { border-color:var(--muted-foreground); background:var(--muted); }
        .aa-topo-node.selected { border-color:var(--info); box-shadow:0 0 0 1px var(--info); }
        .aa-topo-node .node-status { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:6px; vertical-align:middle; }
        .aa-topo-node .node-status.on { background:var(--success); }
        .aa-topo-node .node-status.building { background:var(--warning); }
        .aa-topo-connector { display:flex; justify-content:center; padding:4px 0; position:relative; }
        .aa-topo-connector-line { width:1px; height:24px; background:var(--border); position:relative; }
        .aa-topo-connector-line::before { content:''; position:absolute; top:0; left:50%; transform:translateX(-50%); width:calc(100% + 400px); height:1px; background:repeating-linear-gradient(90deg,transparent,transparent 4px,var(--border) 4px,var(--border) 8px); }
        .aa-topo-connector-line.color-gw { background:var(--success); }
        .aa-topo-connector-line.color-gw::before { background:repeating-linear-gradient(90deg,transparent,transparent 4px,var(--success) 4px,var(--success) 8px); opacity:.4; }
        .aa-topo-connector-line.color-svc { background:var(--info); }
        .aa-topo-connector-line.color-svc::before { background:repeating-linear-gradient(90deg,transparent,transparent 4px,var(--info) 4px,var(--info) 8px); opacity:.3; }
        .aa-topo-connector-line.color-infra { background:var(--warning); }
        .aa-topo-connector-line.color-infra::before { background:repeating-linear-gradient(90deg,transparent,transparent 4px,var(--warning) 4px,var(--warning) 8px); opacity:.3; }
        .aa-topo-node.infra { font-size:11px; color:var(--muted-foreground); padding:6px 12px; background:var(--muted); }
        .aa-topo-node.gw { border-color:var(--success); border-width:1.5px; }
        .aa-detail-panel { width:300px; flex-shrink:0; }
        .aa-detail-app-name { font-size:18px; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
        .aa-detail-app-name .status-dot { width:8px; height:8px; border-radius:50%; background:var(--success); flex-shrink:0; }
        .aa-detail-desc { font-size:13px; color:var(--muted-foreground); margin-bottom:16px; line-height:1.5; }
        .aa-detail-field { margin-bottom:14px; }
        .aa-detail-field-label { font-size:11px; color:var(--muted-foreground); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em; }
        .aa-detail-field-value { font-size:13px; color:var(--foreground); }
        .aa-detail-dep-list { list-style:none; padding:0; margin:0; }
        .aa-detail-dep-list li { padding:6px 0; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; font-size:12px; }
        .aa-detail-dep-list li:last-child { border-bottom:none; }
        .aa-detail-dep-name { font-family:var(--font-mono); color:var(--muted-foreground); }
        .aa-detail-metrics { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
        .aa-detail-metric { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center; }
        .aa-detail-metric-value { font-size:22px; font-weight:700; }
        .aa-detail-metric-label { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .aa-health-bar-track { width:80px; height:4px; background:var(--card); border-radius:2px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px; }
        .aa-health-bar-fill { height:100%; border-radius:2px; }
        .aa-v-table { width:100%; border-collapse:collapse; }
        .aa-v-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); }
        .aa-v-table td { padding:10px 14px; font-size:13px; color:var(--foreground); border-bottom:1px solid var(--border); }
        .aa-v-table tr:last-child td { border-bottom:none; }
        .aa-v-table tr:hover td { background:var(--muted); }
        .v-badge-info { background:var(--info-subtle); color:var(--info); }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="aa-page-header">
          <h1>应用架构</h1>
          <p>应用系统与模块依赖关系</p>
        </div>

        {/* Stats */}
        <div className="aa-stats-row">
          {stats.map((s) => (
            <div className="aa-stat-card" key={s.label}>
              <div className="aa-stat-label">{s.label}</div>
              <div className="aa-stat-value">{s.value}</div>
              <div className="aa-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Topology + Detail */}
        <div className="aa-topo-layout">
          <div className="aa-topo-main">
            <div className="v-card">
              <div className="aa-v-card-title"><Network />应用架构拓扑图</div>
              <div className="aa-topo-graph">
                <div className="aa-topo-layer">
                  <div className="aa-topo-layer-label">网关层</div>
                  <div className="aa-topo-nodes">
                    <div className="aa-topo-node gw"><span className="node-status on" />TECH-GW</div>
                  </div>
                </div>
                <div className="aa-topo-connector"><div className="aa-topo-connector-line color-gw" /></div>
                <div className="aa-topo-layer">
                  <div className="aa-topo-layer-label">应用层</div>
                  <div className="aa-topo-nodes">
                    {appNodes.map((app) => (
                      <div
                        key={app}
                        className={`aa-topo-node${app === selectedApp ? ' selected' : ''}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <span className="node-status on" />{app}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="aa-topo-connector"><div className="aa-topo-connector-line color-svc" /></div>
                <div className="aa-topo-layer">
                  <div className="aa-topo-layer-label">服务层</div>
                  <div className="aa-topo-nodes">
                    {serviceNodes.map((svc) => (
                      <div className="aa-topo-node" key={svc}><span className="node-status on" />{svc}</div>
                    ))}
                  </div>
                </div>
                <div className="aa-topo-connector"><div className="aa-topo-connector-line color-infra" /></div>
                <div className="aa-topo-layer">
                  <div className="aa-topo-layer-label">基础设施</div>
                  <div className="aa-topo-nodes">
                    {infraNodes.map((inf) => (
                      <div className="aa-topo-node infra" key={inf}>{inf}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div className="aa-detail-panel">
            <div className="v-card" style={{ position: 'sticky', top: 24 }}>
              <div className="aa-v-card-title"><PanelRight />应用详情</div>
              <div className="aa-detail-app-name"><span className="status-dot" />{selectedApp}</div>
              <div className="aa-detail-desc">超级 AI 控制台，集成 LLM Gateway、RAG 检索、Agent 编排、MCP 工具调用等 AI 核心能力的一站式交互界面。</div>
              <div className="aa-detail-field">
                <div className="aa-detail-field-label">技术栈</div>
                <div className="aa-detail-field-value">React 19 + Ant Design X 2.0 + FlowGram.AI</div>
              </div>
              <div className="v-divider" style={{ margin: '16px 0' }} />
              <div className="aa-detail-field-label" style={{ marginBottom: 8 }}>依赖服务 (5)</div>
              <ul className="aa-detail-dep-list">
                {deps.map((dep) => (
                  <li key={dep.name}>
                    <span className="aa-detail-dep-name">{dep.name}</span>
                    <span className={`v-badge v-badge-${dep.badge}`}>{dep.status}</span>
                  </li>
                ))}
              </ul>
              <div className="v-divider" style={{ margin: '16px 0' }} />
              <div className="aa-detail-metrics">
                <div className="aa-detail-metric">
                  <div className="aa-detail-metric-value">42</div>
                  <div className="aa-detail-metric-label">暴露 API 数</div>
                </div>
                <div className="aa-detail-metric">
                  <div className="aa-detail-metric-value">8</div>
                  <div className="aa-detail-metric-label">关联 Agent 数</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dependency health */}
        <div className="v-card">
          <div className="aa-v-card-title"><HeartPulse />依赖健康度</div>
          <table className="aa-v-table">
            <thead>
              <tr>
                <th>调用方</th><th>被调用方</th><th>协议</th><th>日调用量</th><th>成功率</th><th>P99 延迟</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{row.caller}</td>
                  <td className="aa-v-mono">{row.callee}</td>
                  <td>
                    {row.proto === 'A2A'
                      ? <span className="v-badge v-badge-info">A2A</span>
                      : <span className="v-badge v-badge-neutral">{row.proto}</span>}
                  </td>
                  <td>{row.calls}</td>
                  <td>
                    <span className="aa-health-bar-track">
                      <span className="aa-health-bar-fill" style={{ width: row.rate, background: `var(--${row.rateColor})` }} />
                    </span>{row.rate}
                  </td>
                  <td className="aa-v-mono">{row.p99}</td>
                  <td><span className={`v-badge v-badge-${row.badge}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
