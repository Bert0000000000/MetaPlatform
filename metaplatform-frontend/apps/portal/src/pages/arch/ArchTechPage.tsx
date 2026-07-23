import { useLocation } from 'react-router-dom';
import {
  Layers, Server, FileText, ChevronDown, Monitor, Palette, Layout as LayoutIcon,
  Sparkles, GitBranch, Network, Zap, Shield, Lock, KeyRound, FileKey,
  Leaf, Brain, Cloud, Database, Atom, Workflow, Scale, Play,
  MessageSquare, Search, Bot, Share2, Plug, Repeat, RadioTower,
  HardDrive, BarChart3, Archive, Container, ShieldCheck, Package,
  Radio, Activity, Eye, Gauge,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const archLayers = [
  {
    label: '展示层',
    badges: [
      { icon: <Monitor />, text: 'React 19' },
      { icon: <Palette />, text: 'TypeScript 5.7' },
      { icon: <LayoutIcon />, text: 'Ant Design 6.0' },
      { icon: <Sparkles />, text: 'Ant Design X 2.0' },
      { icon: <GitBranch />, text: 'FlowGram.AI' },
      { icon: <Network />, text: 'AntV X6' },
      { icon: <Zap />, text: 'Vite 6' },
    ],
  },
  {
    label: '网关层',
    badges: [
      { icon: <Shield />, text: 'Spring Cloud Gateway' },
      { icon: <Lock />, text: 'Spring Security 6.4' },
      { icon: <KeyRound />, text: 'OAuth2 / JWT' },
      { icon: <FileKey />, text: 'TECH-IAM' },
    ],
  },
  {
    label: '应用层',
    badges: [
      { icon: <Leaf />, text: 'Spring Boot 3.5' },
      { icon: <Zap />, text: 'Spring WebFlux' },
      { icon: <Brain />, text: 'Spring AI 1.1.2' },
      { icon: <Cloud />, text: 'SAA 1.1.2.0' },
      { icon: <Database />, text: 'Spring Data JPA' },
      { icon: <Server />, text: 'Spring Cloud 2024.0' },
    ],
  },
  {
    label: '引擎层',
    badges: [
      { icon: <Atom />, text: 'TECH-ONT 本体引擎' },
      { icon: <Workflow />, text: 'TECH-WFE 工作流引擎' },
      { icon: <Scale />, text: 'TECH-RULE 规则引擎' },
      { icon: <Play />, text: 'TECH-ACTION Action 引擎' },
    ],
  },
  {
    label: 'AI 层',
    badges: [
      { icon: <MessageSquare />, text: 'TECH-LLMGW LLM Gateway' },
      { icon: <Search />, text: 'TECH-RAG RAG 引擎' },
      { icon: <Bot />, text: 'TECH-Agent Agent 框架' },
      { icon: <Share2 />, text: 'SAA Graph Core' },
    ],
  },
  {
    label: '协议层',
    badges: [
      { icon: <Plug />, text: 'TECH-MCP (Nacos MCP)' },
      { icon: <Repeat />, text: 'TECH-A2A (A2A Nacos)' },
      { icon: <RadioTower />, text: 'Nacos 3.0+ Registry' },
    ],
  },
  {
    label: '数据层',
    badges: [
      { icon: <Database />, text: 'PostgreSQL 17' },
      { icon: <GitBranch />, text: 'Neo4j 5.x' },
      { icon: <Search />, text: 'Milvus 2.5' },
      { icon: <HardDrive />, text: 'Redis 7.4' },
      { icon: <BarChart3 />, text: 'StarRocks 3.4' },
      { icon: <Archive />, text: 'Hudi 1.x' },
    ],
  },
  {
    label: '基础设施',
    badges: [
      { icon: <Container />, text: 'Kubernetes 1.32' },
      { icon: <ShieldCheck />, text: 'Istio 1.24' },
      { icon: <Package />, text: 'MinIO' },
      { icon: <Radio />, text: 'Kafka 3.9' },
      { icon: <Activity />, text: 'RabbitMQ 4.x' },
      { icon: <Eye />, text: 'OpenTelemetry 1.45' },
      { icon: <Gauge />, text: 'Prometheus 3.x' },
    ],
  },
];

// MOCK
const services = [
  { name: 'TECH-ONT', stack: 'Java 21 / Spring Boot 3.5', port: '8081', status: 'Running', badge: 'success', instances: 3, health: 98, healthColor: 'success', usage: '42% / 61%' },
  { name: 'TECH-WFE', stack: 'Java 21 / Spring WebFlux', port: '8082', status: 'Running', badge: 'success', instances: 2, health: 95, healthColor: 'success', usage: '31% / 48%' },
  { name: 'TECH-LLMGW', stack: 'Java 21 / SAA ChatModel', port: '8083', status: 'Running', badge: 'success', instances: 4, health: 92, healthColor: 'success', usage: '58% / 72%' },
  { name: 'TECH-RAG', stack: 'Java 21 / SAA VectorStore', port: '8084', status: 'Running', badge: 'success', instances: 3, health: 96, healthColor: 'success', usage: '27% / 55%' },
  { name: 'TECH-AGENT', stack: 'Java 21 / SAA Graph Core', port: '8085', status: 'Migrating', badge: 'warning', instances: 2, health: 78, healthColor: 'warning', usage: '64% / 80%' },
  { name: 'TECH-MCP', stack: 'Java 21 / SAA Nacos MCP', port: '8086', status: 'Migrating', badge: 'warning', instances: 2, health: 82, healthColor: 'warning', usage: '19% / 34%' },
  { name: 'TECH-DATA', stack: 'Java 21 / Spring Batch', port: '8087', status: 'Migrating', badge: 'warning', instances: 2, health: 74, healthColor: 'warning', usage: '45% / 63%' },
  { name: 'TECH-GW', stack: 'Java 21 / Spring Cloud GW', port: '8080', status: 'Running', badge: 'success', instances: 3, health: 99, healthColor: 'success', usage: '22% / 38%' },
];

// MOCK
const adrs = [
  { date: '2026-07-21', title: 'ADR-001 后端语言统一为 Java 21，退役 Python 后端服务', status: 'Accepted', badge: 'success' },
  { date: '2026-07-21', title: 'ADR-002 AI 编排底座选型 Spring AI Alibaba 1.1.2.0 (BOM 统一管理)', status: 'Accepted', badge: 'success' },
  { date: '2026-07-19', title: 'ADR-003 MCP / A2A 注册中心采用 Nacos 3.0+，禁止单点直连', status: 'Accepted', badge: 'success' },
  { date: '2026-07-16', title: 'ADR-004 数据访问层由 SQLAlchemy 迁移至 Spring Data JPA', status: 'In Progress', badge: 'warning' },
  { date: '2026-07-14', title: 'ADR-005 向量数据库选型 Milvus 2.5，弃用 Weaviate 方案', status: 'Accepted', badge: 'success' },
];

// MOCK
const summary = [
  { label: '服务总数', value: '8' },
  { label: '运行中', value: '5', color: 'var(--success)' },
  { label: '迁移中', value: '3', color: 'var(--warning)' },
  { label: '总实例数', value: '21' },
];

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

export default function ArchTechPage() {
  const location = useLocation();

  return (
    <>
      <style>{`
        :root { --info:#60a5fa; --info-subtle:#0f1729; }
        .at-page-header { margin-bottom:32px; }
        .at-page-header h1 { font-size:22px; font-weight:700; margin-bottom:6px; }
        .at-page-header p { font-size:14px; color:var(--muted-foreground); }
        .at-v-card-plus { margin-top:20px; }
        .at-v-card-title { font-size:14px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
        .at-v-card-title svg { width:16px; height:16px; color:var(--muted-foreground); }
        .at-arch-layer-stack { display:flex; flex-direction:column; gap:8px; }
        .at-arch-layer { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:14px 18px; display:flex; align-items:center; gap:16px; transition:border-color .15s; }
        .at-arch-layer:hover { border-color:#404040; }
        .at-arch-layer-label { min-width:72px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted-foreground); flex-shrink:0; }
        .at-arch-layer-badges { display:flex; flex-wrap:wrap; gap:6px; flex:1; }
        .at-arch-layer-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:9999px; font-size:12px; font-weight:500; border:1px solid var(--border); background:var(--card); color:var(--foreground); }
        .at-arch-layer-badge svg { width:12px; height:12px; color:var(--muted-foreground); }
        .at-arch-arrow { text-align:center; color:var(--muted-foreground); font-size:10px; line-height:1; margin:2px 0; }
        .at-arch-arrow svg { width:14px; height:14px; }
        .at-service-table { width:100%; border-collapse:collapse; font-size:13px; }
        .at-service-table thead th { text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted-foreground); padding:10px 12px; border-bottom:1px solid var(--border); white-space:nowrap; }
        .at-service-table tbody td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
        .at-service-table tbody tr:last-child td { border-bottom:none; }
        .at-service-table tbody tr:hover { background:var(--muted); }
        .at-service-name { font-weight:600; font-family:var(--font-mono); font-size:12px; color:var(--foreground); }
        .at-service-stack { font-size:12px; color:var(--muted-foreground); font-family:var(--font-mono); }
        .at-service-port { font-family:var(--font-mono); font-size:12px; color:var(--muted-foreground); }
        .at-health-bar-wrap { display:flex; align-items:center; gap:8px; }
        .at-health-bar { width:60px; height:4px; border-radius:2px; background:var(--border); overflow:hidden; flex-shrink:0; }
        .at-health-bar-fill { height:100%; border-radius:2px; }
        .at-health-val { font-size:12px; font-weight:500; font-family:var(--font-mono); min-width:32px; }
        .at-usage-text { font-size:12px; color:var(--muted-foreground); font-family:var(--font-mono); }
        .at-adr-list { display:flex; flex-direction:column; gap:8px; }
        .at-adr-item { display:flex; align-items:center; gap:16px; padding:14px 16px; background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); }
        .at-adr-item:hover { border-color:#404040; }
        .at-adr-date { font-size:12px; font-family:var(--font-mono); color:var(--muted-foreground); min-width:86px; flex-shrink:0; }
        .at-adr-title { font-size:13px; font-weight:600; flex:1; }
        .at-tech-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:16px; }
        .at-tech-summary-card { background:var(--muted); border:1px solid var(--border); border-radius:var(--radius); padding:14px; }
        .at-tech-summary-label { font-size:11px; color:var(--muted-foreground); }
        .at-tech-summary-value { font-size:18px; font-weight:600; margin-top:2px; }
        .v-badge-info { background:var(--info-subtle); color:var(--info); }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '32px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="at-page-header">
          <h1>技术架构</h1>
          <p>技术组件、分层架构与运行态服务拓扑</p>
        </div>

        {/* Layered Architecture */}
        <div className="v-card">
          <div className="at-v-card-title"><Layers />分层架构总览</div>
          <div className="at-arch-layer-stack">
            {archLayers.map((layer, idx) => (
              <div key={layer.label}>
                <div className="at-arch-layer" style={{ padding: '14px 18px' }}>
                  <div className="at-arch-layer-label">{layer.label}</div>
                  <div className="at-arch-layer-badges">
                    {layer.badges.map((badge) => (
                      <span className="at-arch-layer-badge" key={badge.text}>
                        {badge.icon}{badge.text}
                      </span>
                    ))}
                  </div>
                </div>
                {idx < archLayers.length - 1 && (
                  <div className="at-arch-arrow"><ChevronDown /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Service Table */}
        <div className="v-card at-v-card-plus">
          <div className="at-v-card-title"><Server />核心服务运行态</div>
          <table className="at-service-table">
            <thead>
              <tr>
                <th>服务</th><th>技术栈</th><th>端口</th><th>状态</th><th>实例</th><th>健康度</th><th>CPU / 内存</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.name}>
                  <td><span className="at-service-name">{svc.name}</span></td>
                  <td><span className="at-service-stack">{svc.stack}</span></td>
                  <td><span className="at-service-port">{svc.port}</span></td>
                  <td><span className={`v-badge v-badge-${svc.badge}`}>{svc.status}</span></td>
                  <td>{svc.instances}</td>
                  <td>
                    <div className="at-health-bar-wrap">
                      <div className="at-health-bar"><div className="at-health-bar-fill" style={{ width: `${svc.health}%`, background: `var(--${svc.healthColor})` }} /></div>
                      <span className="at-health-val" style={{ color: `var(--${svc.healthColor})` }}>{svc.health}%</span>
                    </div>
                  </td>
                  <td><span className="at-usage-text">{svc.usage}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="at-tech-summary">
            {summary.map((s) => (
              <div className="at-tech-summary-card" key={s.label}>
                <div className="at-tech-summary-label">{s.label}</div>
                <div className="at-tech-summary-value" style={s.color ? { color: s.color } : undefined}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ADR */}
        <div className="v-card at-v-card-plus">
          <div className="at-v-card-title"><FileText />技术决策记录 (ADR)</div>
          <div className="at-adr-list">
            {adrs.map((adr) => (
              <div className="at-adr-item" key={adr.title}>
                <div className="at-adr-date">{adr.date}</div>
                <div className="at-adr-title">{adr.title}</div>
                <div><span className={`v-badge v-badge-${adr.badge}`}>{adr.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
