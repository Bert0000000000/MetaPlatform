import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Drawer } from 'antd';
import {
  ChevronDown, UnfoldVertical, BarChart3, Zap, Sparkles, Check, Minus, Circle,
  ArrowRight, Users, Receipt, Link2, Landmark, UserCheck, BookOpen,
  FilePlus, ShieldCheck, Truck, TrendingUp, ChevronRight, FileText, User,
  Package, CheckSquare, Banknote, Maximize2, Minimize2,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';

// MOCK
const capabilities = [
  { name: '客户管理', icon: 'users', desc: '客户全生命周期管理，包括客户画像、商机转化、服务工单与满意度跟踪', stats: { processes: 5, agents: 2, sources: 4 } },
  { name: '订单管理', icon: 'receipt', desc: '订单从创建、审批到履约的全流程管理，支持退换货与订单分析', stats: { processes: 4, agents: 3, sources: 6 } },
  { name: '供应链', icon: 'link', desc: '采购管理、库存管理、物流跟踪与供应商协同', stats: { processes: 6, agents: 1, sources: 8 } },
  { name: '财务管理', icon: 'landmark', desc: '预算编制、费用报销、财务核算与资金管理', stats: { processes: 4, agents: 1, sources: 5 } },
  { name: '人力资源', icon: 'user-check', desc: '招聘管理、绩效考核、培训发展与组织架构管理', stats: { processes: 3, agents: 1, sources: 3 } },
  { name: '知识管理', icon: 'book-open', desc: '企业知识库构建、文档管理、RAG 检索增强与知识图谱', stats: { processes: 2, agents: 4, sources: 7 } },
];

// MOCK
const capabilityProcesses = [
  { name: '订单创建', code: 'PROC-ORD-01', desc: '用户任务 + 服务任务', icon: 'file-plus' },
  { name: '订单审批', code: 'PROC-ORD-02', desc: '含条件网关分支', icon: 'shield-check' },
  { name: '订单履约', code: 'PROC-ORD-03', desc: '多系统协同', icon: 'truck' },
  { name: '订单分析', code: 'PROC-ORD-04', desc: 'AI 驱动分析', icon: 'trending-up' },
];

// MOCK
const processFlows = [
  {
    name: '订单创建', code: 'PROC-ORD-01', icon: 'file-plus',
    nodes: ['填写订单', '校验库存', '计算价格', '提交'],
    version: 'v1.5', creator: '李静雯',
    detailNodes: [
      { num: '1', name: '填写订单', type: 'user-task', typeLabel: '用户任务', assignee: '订单申请人', sla: '--' },
      { num: '2', name: '校验库存', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-DATA', sla: '1h' },
      { num: '3', name: '计算价格', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-RULE', sla: '30m' },
      { num: '✓', name: '提交完成', type: 'end-event', typeLabel: '结束事件', assignee: '--', sla: '--', isEnd: true },
    ],
  },
  {
    name: '订单审批', code: 'PROC-ORD-02', icon: 'shield-check',
    nodes: ['提交申请', '主管审批', '条件判断', '完成'],
    version: 'v2.3', creator: '张明远',
    detailNodes: [
      { num: '1', name: '提交申请', type: 'user-task', typeLabel: '用户任务', assignee: '订单申请人', sla: '--' },
      { num: '2', name: '主管审批', type: 'user-task', typeLabel: '用户任务', assignee: '部门主管', sla: '4h' },
      { num: '♦', name: '金额 > 10万?', type: 'gateway', typeLabel: '排他网关', assignee: '条件判断', sla: '--', isGateway: true },
      { num: '3', name: '总监审批', type: 'user-task', typeLabel: '用户任务', assignee: '部门总监', sla: '8h' },
      { num: '4', name: '财务确认', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-WFE', sla: '2h' },
      { num: '✓', name: '完成', type: 'end-event', typeLabel: '结束事件', assignee: '--', sla: '--', isEnd: true },
    ],
  },
  {
    name: '订单履约', code: 'PROC-ORD-03', icon: 'truck',
    nodes: ['分配库存', '生成发货单', '物流配送', '签收确认'],
    version: 'v1.8', creator: '王浩然',
    detailNodes: [
      { num: '1', name: '分配库存', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-DATA', sla: '1h' },
      { num: '2', name: '生成发货单', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-WFE', sla: '30m' },
      { num: '3', name: '物流配送', type: 'user-task', typeLabel: '用户任务', assignee: '物流专员', sla: '48h' },
      { num: '✓', name: '签收确认', type: 'end-event', typeLabel: '结束事件', assignee: '--', sla: '--', isEnd: true },
    ],
  },
  {
    name: '订单分析', code: 'PROC-ORD-04', icon: 'trending-up',
    nodes: ['数据采集', 'AI 分析', '生成报告', '推送通知'],
    version: 'v1.2', creator: '陈思远',
    detailNodes: [
      { num: '1', name: '数据采集', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-DATA', sla: '2h' },
      { num: '2', name: 'AI 分析', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-AGENT', sla: '1h' },
      { num: '3', name: '生成报告', type: 'service-task', typeLabel: '服务任务', assignee: 'TECH-LLMGW', sla: '30m' },
      { num: '✓', name: '推送通知', type: 'end-event', typeLabel: '结束事件', assignee: '--', sla: '--', isEnd: true },
    ],
  },
];

// MOCK
const businessObjects = [
  { name: 'Order', type: 'G2 · 订单主对象', icon: 'file-text' },
  { name: 'Customer', type: 'G2 · 客户对象', icon: 'user' },
  { name: 'Product', type: 'G2 · 产品对象', icon: 'package' },
  { name: 'ApprovalRecord', type: 'G2 · 审批记录', icon: 'check-square' },
  { name: 'Payment', type: 'G2 · 支付对象', icon: 'banknote' },
  { name: 'Shipment', type: 'G2 · 发货对象', icon: 'truck' },
];

const capIconMap: Record<string, React.ReactNode> = {
  users: <Users style={{ width: 16, height: 16 }} />,
  receipt: <Receipt style={{ width: 16, height: 16 }} />,
  link: <Link2 style={{ width: 16, height: 16 }} />,
  landmark: <Landmark style={{ width: 16, height: 16 }} />,
  'user-check': <UserCheck style={{ width: 16, height: 16 }} />,
  'book-open': <BookOpen style={{ width: 16, height: 16 }} />,
};

const procIconMap: Record<string, React.ReactNode> = {
  'file-plus': <FilePlus style={{ width: 16, height: 16 }} />,
  'shield-check': <ShieldCheck style={{ width: 16, height: 16 }} />,
  truck: <Truck style={{ width: 16, height: 16 }} />,
  'trending-up': <TrendingUp style={{ width: 16, height: 16 }} />,
};

const objIconMap: Record<string, React.ReactNode> = {
  'file-text': <FileText style={{ width: 18, height: 18 }} />,
  user: <User style={{ width: 18, height: 18 }} />,
  package: <Package style={{ width: 18, height: 18 }} />,
  'check-square': <CheckSquare style={{ width: 18, height: 18 }} />,
  banknote: <Banknote style={{ width: 18, height: 18 }} />,
  truck: <Truck style={{ width: 18, height: 18 }} />,
};

const archTabs = [
  { label: '业务架构', path: '/arch' },
  { label: '应用架构', path: '/arch/app' },
  { label: '数据架构', path: '/arch/data' },
  { label: '技术架构', path: '/arch/tech' },
  { label: '架构治理', path: '/arch/governance' },
];

const layerTabs = [
  { id: 'l1', color: '#a78bfa', label: 'L1 企业战略层', sub: 'Strategic' },
  { id: 'l2', color: '#60a5fa', label: 'L2 业务能力层', sub: 'Capability' },
  { id: 'l3', color: '#62d178', label: 'L3 业务流程层', sub: 'Process' },
  { id: 'l4', color: '#eab308', label: 'L4 业务对象层', sub: 'Object' },
];

export default function ArchBusinessPage() {
  const location = useLocation();
  const [activeLayer, setActiveLayer] = useState('l1');
  const [selectedCap, setSelectedCap] = useState(1);
  const [selectedProc, setSelectedProc] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  return (
    <>
      <style>{`
        :root { --l1-color:#a78bfa; --l1-bg:rgba(167,139,250,0.08); --l1-border:rgba(167,139,250,0.25); --l2-color:#60a5fa; --l2-bg:rgba(96,165,250,0.08); --l2-border:rgba(96,165,250,0.25); --l3-color:#62d178; --l3-bg:rgba(98,209,120,0.08); --l3-border:rgba(98,209,120,0.25); --l4-color:#eab308; --l4-bg:rgba(234,179,8,0.08); --l4-border:rgba(234,179,8,0.25); }
        .ab-page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .ab-page-header h1 { font-size:22px; font-weight:600; letter-spacing:-0.02em; }
        .ab-page-header .desc { font-size:13px; color:var(--muted-foreground); margin-top:4px; }
        .ab-page-header .actions { display:flex; gap:8px; }
        .ab-layer-nav { display:flex; gap:0; margin-bottom:24px; border-bottom:2px solid var(--border); position:relative; }
        .ab-layer-tab { padding:10px 20px; font-size:13px; font-weight:500; cursor:pointer; color:var(--muted-foreground); border:none; background:transparent; font-family:var(--font-sans); position:relative; display:flex; align-items:center; gap:8px; transition:color .15s; }
        .ab-layer-tab::after { content:''; position:absolute; bottom:-2px; left:0; right:0; height:2px; background:transparent; transition:background .15s; }
        .ab-layer-tab:hover { color:var(--foreground); }
        .ab-layer-tab.active { color:var(--foreground); }
        .ab-layer-tab.active::after { background:var(--layer-color, var(--foreground)); }
        .ab-layer-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .ab-layer-label { font-size:11px; color:var(--muted-foreground); font-weight:400; }
        .ab-layer-tab.active .ab-layer-label { color:var(--layer-color, var(--foreground)); }
        .ab-breadcrumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted-foreground); margin-bottom:16px; flex-wrap:wrap; }
        .ab-breadcrumb a { color:var(--muted-foreground); text-decoration:none; cursor:pointer; }
        .ab-breadcrumb a:hover { color:var(--foreground); }
        .ab-breadcrumb .sep { color:var(--border); }
        .ab-breadcrumb .current { color:var(--foreground); font-weight:500; }
        .ab-strategic-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .ab-strategic-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; transition:border-color .15s; cursor:default; position:relative; overflow:hidden; }
        .ab-strategic-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
        .ab-strategic-card:hover { border-color:var(--l1-border); }
        .ab-strategic-card::before { background:var(--l1-color); }
        .ab-strategic-card.wide { grid-column:1/-1; }
        .ab-strat-title { font-size:16px; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:10px; }
        .ab-strat-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ab-strat-icon svg { width:18px; height:18px; }
        .ab-strat-desc { font-size:13px; color:var(--muted-foreground); line-height:1.6; margin-bottom:16px; }
        .ab-strat-outcomes { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
        .ab-strat-outcome { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--foreground); }
        .ab-strat-outcome .check { width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ab-strat-outcome .check svg { width:12px; height:12px; }
        .ab-strat-outcome.outcome-done .check { background:var(--success-subtle); color:var(--success); }
        .ab-strat-outcome.outcome-partial .check { background:var(--warning-subtle); color:var(--warning); }
        .ab-strat-outcome.outcome-pending .check { background:var(--muted); color:var(--muted-foreground); }
        .ab-strat-progress { margin-bottom:16px; }
        .ab-strat-progress-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
        .ab-strat-progress-label { font-size:12px; color:var(--muted-foreground); }
        .ab-strat-progress-value { font-size:12px; font-weight:600; font-family:var(--font-mono); }
        .ab-strat-progress-bar { height:4px; background:var(--muted); border-radius:2px; overflow:hidden; }
        .ab-strat-progress-fill { height:100%; border-radius:2px; transition:width .3s; }
        .ab-strat-drill { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--muted-foreground); cursor:pointer; padding:6px 0; border:none; background:transparent; font-family:var(--font-sans); transition:color .15s; }
        .ab-strat-drill:hover { color:var(--foreground); }
        .ab-strat-drill svg { width:14px; height:14px; }
        .ab-capability-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
        .ab-capability-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px; cursor:pointer; transition:border-color .15s,background .15s; }
        .ab-capability-card:hover { border-color:var(--l2-border); background:var(--l2-bg); }
        .ab-capability-card.active { border-color:var(--l2-color); background:var(--l2-bg); }
        .ab-cap-name { font-size:14px; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:8px; }
        .ab-cap-name svg { width:16px; height:16px; color:var(--l2-color); }
        .ab-cap-desc { font-size:12px; color:var(--muted-foreground); line-height:1.6; margin-bottom:14px; }
        .ab-cap-stats { display:flex; gap:16px; }
        .ab-cap-stat { font-size:11px; color:var(--muted-foreground); }
        .ab-cap-stat strong { color:var(--foreground); font-weight:600; font-family:var(--font-mono); }
        .ab-cap-detail { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; }
        .ab-cap-detail-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border); }
        .ab-cap-detail-title { font-size:16px; font-weight:600; }
        .ab-cap-detail-badge { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ab-process-list { display:flex; flex-direction:column; gap:8px; }
        .ab-process-item { display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:var(--radius); border:1px solid var(--border); cursor:pointer; transition:border-color .15s,background .15s; }
        .ab-process-item:hover { border-color:var(--l3-border); background:var(--l3-bg); }
        .ab-process-item.active { border-color:var(--l3-color); background:var(--l3-bg); }
        .ab-process-item svg { width:16px; height:16px; color:var(--l3-color); flex-shrink:0; }
        .ab-process-item .proc-info { flex:1; min-width:0; }
        .ab-process-item .proc-name { font-size:13px; font-weight:500; }
        .ab-process-item .proc-meta { font-size:11px; color:var(--muted-foreground); margin-top:2px; }
        .ab-process-flow-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
        .ab-pf-card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px; cursor:pointer; transition:border-color .15s; }
        .ab-pf-card:hover { border-color:var(--l3-border); }
        .ab-pf-card.active { border-color:var(--l3-color); background:var(--l3-bg); }
        .ab-pf-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .ab-pf-name { font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; }
        .ab-pf-name svg { width:16px; height:16px; color:var(--l3-color); }
        .ab-pf-badge { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--l3-bg); color:var(--l3-color); border:1px solid var(--l3-border); }
        .ab-pf-mini-flow { display:flex; align-items:center; gap:0; padding:12px 0; overflow-x:auto; }
        .ab-pf-node { padding:4px 10px; border:1px solid var(--border); border-radius:3px; font-size:11px; color:var(--muted-foreground); white-space:nowrap; background:var(--muted); }
        .ab-pf-connector { width:24px; height:1px; background:var(--border); flex-shrink:0; position:relative; }
        .ab-pf-connector::after { content:''; position:absolute; right:0; top:-3px; border:3px solid transparent; border-left:4px solid var(--border); }
        .ab-proc-detail { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:24px; }
        .ab-proc-detail-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border); }
        .ab-proc-detail-title { font-size:16px; font-weight:600; }
        .ab-proc-info-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
        .ab-proc-info-item { padding:12px 16px; background:var(--muted); border-radius:var(--radius); }
        .ab-proc-info-label { font-size:11px; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px; }
        .ab-proc-info-value { font-size:13px; font-weight:500; }
        .ab-proc-info-value.mono { font-family:var(--font-mono); }
        .ab-node-list { display:flex; flex-direction:column; gap:0; }
        .ab-node-item { display:grid; grid-template-columns:32px 1.2fr 120px 140px 100px; align-items:center; padding:14px 16px; border-bottom:1px solid var(--border); gap:12px; }
        .ab-node-item:last-child { border-bottom:none; }
        .ab-node-item:hover { background:var(--muted); }
        .ab-node-number { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; font-family:var(--font-mono); border:1px solid var(--border); color:var(--muted-foreground); }
        .ab-node-name { font-size:13px; font-weight:500; }
        .ab-node-type { font-size:11px; padding:2px 8px; border-radius:4px; display:inline-block; text-align:center; }
        .ab-node-type.user-task { background:rgba(96,165,250,0.12); color:#60a5fa; }
        .ab-node-type.service-task { background:rgba(98,209,120,0.12); color:#62d178; }
        .ab-node-type.gateway { background:rgba(234,179,8,0.12); color:#eab308; }
        .ab-node-type.end-event { background:var(--muted); color:var(--muted-foreground); }
        .ab-node-assignee { font-size:12px; color:var(--muted-foreground); }
        .ab-node-sla { font-size:12px; color:var(--muted-foreground); font-family:var(--font-mono); }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SubTabs items={archTabs} activePath={location.pathname} />
        <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* Page Header */}
        <div className="ab-page-header">
          <div>
            <h1>业务架构</h1>
            <div className="desc">L1-L4 分层架构视图</div>
          </div>
          <div className="actions">
            <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>AI</div>
              <span style={{ fontSize: 13 }}>AI 助手</span>
              <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
            </button>
            <button className="v-btn"><UnfoldVertical style={{ width: 16, height: 16 }} />展开全部</button>
          </div>
        </div>

        {/* Layer Navigation */}
        <div className="ab-layer-nav">
          {layerTabs.map((tab) => (
            <button
              key={tab.id}
              className={`ab-layer-tab${activeLayer === tab.id ? ' active' : ''}`}
              style={{ ['--layer-color' as string]: tab.color }}
              onClick={() => setActiveLayer(tab.id)}
            >
              <span className="ab-layer-dot" style={{ background: tab.color }} />
              {tab.label}
              <span className="ab-layer-label">{tab.sub}</span>
            </button>
          ))}
        </div>

        {/* L1: Enterprise Strategic Layer */}
        {activeLayer === 'l1' && (
          <div className="ab-strategic-grid">
            <div className="ab-strategic-card">
              <div className="ab-strat-title">
                <div className="ab-strat-icon" style={{ background: 'var(--l1-bg)', color: 'var(--l1-color)' }}><BarChart3 /></div>
                数据驱动决策
              </div>
              <div className="ab-strat-desc">构建全域数据中台，打通数据孤岛，实现从数据采集、治理到分析决策的端到端链路，支撑管理层基于实时洞察进行精准决策。</div>
              <div className="ab-strat-outcomes">
                <div className="ab-strat-outcome outcome-done"><span className="check"><Check /></span>统一数据湖 + StarRocks OLAP 引擎上线</div>
                <div className="ab-strat-outcome outcome-done"><span className="check"><Check /></span>核心业务指标看板覆盖率达 90%</div>
                <div className="ab-strat-outcome outcome-partial"><span className="check"><Minus /></span>AI 预测性分析模型集成（进行中）</div>
              </div>
              <div className="ab-strat-progress">
                <div className="ab-strat-progress-header">
                  <span className="ab-strat-progress-label">总体进度</span>
                  <span className="ab-strat-progress-value" style={{ color: 'var(--l1-color)' }}>75%</span>
                </div>
                <div className="ab-strat-progress-bar">
                  <div className="ab-strat-progress-fill" style={{ width: '75%', background: 'var(--l1-color)' }} />
                </div>
              </div>
              <button className="ab-strat-drill" onClick={() => setActiveLayer('l2')}>下钻到 L2 业务能力 <ArrowRight /></button>
            </div>

            <div className="ab-strategic-card">
              <div className="ab-strat-title">
                <div className="ab-strat-icon" style={{ background: 'var(--l1-bg)', color: 'var(--l1-color)' }}><Zap /></div>
                运营效率提升
              </div>
              <div className="ab-strat-desc">通过流程自动化、低代码应用平台和数字员工，将重复性业务流程自动化率提升至 80%，大幅降低人工操作成本。</div>
              <div className="ab-strat-outcomes">
                <div className="ab-strat-outcome outcome-done"><span className="check"><Check /></span>BPMN 审批流引擎 + 低代码表单上线</div>
                <div className="ab-strat-outcome outcome-partial"><span className="check"><Minus /></span>数字员工覆盖 6 大业务域（进行中）</div>
                <div className="ab-strat-outcome outcome-pending"><span className="check"><Circle /></span>跨域流程自动化编排（待启动）</div>
              </div>
              <div className="ab-strat-progress">
                <div className="ab-strat-progress-header">
                  <span className="ab-strat-progress-label">总体进度</span>
                  <span className="ab-strat-progress-value" style={{ color: 'var(--l1-color)' }}>60%</span>
                </div>
                <div className="ab-strat-progress-bar">
                  <div className="ab-strat-progress-fill" style={{ width: '60%', background: 'var(--l1-color)' }} />
                </div>
              </div>
              <button className="ab-strat-drill" onClick={() => setActiveLayer('l2')}>下钻到 L2 业务能力 <ArrowRight /></button>
            </div>

            <div className="ab-strategic-card wide">
              <div className="ab-strat-title">
                <div className="ab-strat-icon" style={{ background: 'var(--l1-bg)', color: 'var(--l1-color)' }}><Sparkles /></div>
                AI 能力全域覆盖
              </div>
              <div className="ab-strat-desc">以 LLM Gateway 为统一底座，将大模型能力嵌入全部业务流程，实现智能客服、智能审批、知识问答、风险预警等 AI 场景全域覆盖。</div>
              <div className="ab-strat-outcomes" style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                <div className="ab-strat-outcome outcome-done"><span className="check"><Check /></span>LLM Gateway + 多模型路由上线</div>
                <div className="ab-strat-outcome outcome-partial"><span className="check"><Minus /></span>RAG 知识库与本体引擎集成（进行中）</div>
                <div className="ab-strat-outcome outcome-pending"><span className="check"><Circle /></span>MCP/A2A 协议生态对接（待启动）</div>
              </div>
              <div className="ab-strat-progress" style={{ maxWidth: 400 }}>
                <div className="ab-strat-progress-header">
                  <span className="ab-strat-progress-label">总体进度</span>
                  <span className="ab-strat-progress-value" style={{ color: 'var(--l1-color)' }}>45%</span>
                </div>
                <div className="ab-strat-progress-bar">
                  <div className="ab-strat-progress-fill" style={{ width: '45%', background: 'var(--l1-color)' }} />
                </div>
              </div>
              <button className="ab-strat-drill" onClick={() => setActiveLayer('l2')}>下钻到 L2 业务能力 <ArrowRight /></button>
            </div>
          </div>
        )}

        {/* L2: Business Capability Layer */}
        {activeLayer === 'l2' && (
          <>
            <div className="ab-breadcrumb">
              <a onClick={() => setActiveLayer('l1')}>L1 企业战略</a>
              <span className="sep">/</span>
              <span className="current">L2 业务能力</span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ab-capability-grid">
                  {capabilities.map((cap, idx) => (
                    <div
                      key={cap.name}
                      className={`ab-capability-card${idx === selectedCap ? ' active' : ''}`}
                      onClick={() => setSelectedCap(idx)}
                    >
                      <div className="ab-cap-name">{capIconMap[cap.icon]}{cap.name}</div>
                      <div className="ab-cap-desc">{cap.desc}</div>
                      <div className="ab-cap-stats">
                        <span className="ab-cap-stat">流程 <strong>{cap.stats.processes}</strong></span>
                        <span className="ab-cap-stat">Agent <strong>{cap.stats.agents}</strong></span>
                        <span className="ab-cap-stat">数据源 <strong>{cap.stats.sources}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ width: 360, flexShrink: 0, position: 'sticky', top: 32, alignSelf: 'flex-start' }}>
                <div className="ab-cap-detail">
                  <div className="ab-cap-detail-header">
                    <div>
                      <div className="ab-cap-detail-title">{capabilities[selectedCap].name}</div>
                      <div className="ab-cap-detail-badge">Order Management</div>
                    </div>
                    <span className="v-badge" style={{ background: 'var(--l2-bg)', color: 'var(--l2-color)', border: '1px solid var(--l2-border)' }}>L2</span>
                  </div>
                  <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                    订单管理能力域覆盖订单全生命周期，从客户下单到最终交付结算。与供应链、财务、客户管理域深度关联。
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>核心流程</div>
                  <div className="ab-process-list">
                    {capabilityProcesses.map((proc, idx) => (
                      <div
                        key={proc.code}
                        className={`ab-process-item${idx === 1 ? ' active' : ''}`}
                        onClick={() => setActiveLayer('l3')}
                      >
                        {procIconMap[proc.icon]}
                        <div className="proc-info">
                          <div className="proc-name">{proc.name}</div>
                          <div className="proc-meta">{proc.code} · {proc.desc}</div>
                        </div>
                        <ChevronRight style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* L3: Business Process Layer */}
        {activeLayer === 'l3' && (
          <>
            <div className="ab-breadcrumb">
              <a onClick={() => setActiveLayer('l1')}>L1 企业战略</a>
              <span className="sep">/</span>
              <a onClick={() => setActiveLayer('l2')}>L2 业务能力 &gt; 订单管理</a>
              <span className="sep">/</span>
              <span className="current">L3 订单审批流程</span>
            </div>
            <div className="ab-process-flow-grid">
              {processFlows.map((pf, idx) => (
                <div
                  key={pf.code}
                  className={`ab-pf-card${idx === selectedProc ? ' active' : ''}`}
                  onClick={() => { setSelectedProc(idx); setDrawerOpen(true); }}
                >
                  <div className="ab-pf-header">
                    <div className="ab-pf-name">{procIconMap[pf.icon]}{pf.name}</div>
                    <span className="ab-pf-badge">{pf.code}</span>
                  </div>
                  <div className="ab-pf-mini-flow">
                    {pf.nodes.map((node, ni) => (
                      <span key={ni}>
                        <div className="ab-pf-node" style={ni === 2 && idx === 1 ? { borderColor: 'var(--warning)', color: 'var(--warning)' } : undefined}>{node}</div>
                        {ni < pf.nodes.length - 1 && <div className="ab-pf-connector" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* L4: Business Object Layer */}
        {activeLayer === 'l4' && (
          <>
            <div className="ab-breadcrumb">
              <a onClick={() => setActiveLayer('l1')}>L1 企业战略</a>
              <span className="sep">/</span>
              <a onClick={() => setActiveLayer('l2')}>L2 业务能力 &gt; 订单管理</a>
              <span className="sep">/</span>
              <a onClick={() => setActiveLayer('l3')}>L3 订单审批流程</a>
              <span className="sep">/</span>
              <span className="current">L4 业务对象</span>
            </div>
            <div className="v-card">
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>业务对象层</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>订单审批流程涉及的 L4 业务对象（G2 业务对象为主）</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {businessObjects.map((obj) => (
                  <div key={obj.name} style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--l4-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--l4-color)' }}>
                      {objIconMap[obj.icon]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{obj.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{obj.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      {/* Process Detail Drawer */}
      <Drawer
        title={null}
        placement="right"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerExpanded(false); }}
        width={drawerExpanded ? '66.67%' : 560}
        styles={{ body: { padding: 0, overflow: 'visible' } }}
        extra={
          <button
            onClick={() => setDrawerExpanded((v) => !v)}
            title={drawerExpanded ? '缩小' : '放大'}
            style={{
              width: 32, height: 32, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {drawerExpanded ? <Minimize2 style={{ width: 16, height: 16 }} /> : <Maximize2 style={{ width: 16, height: 16 }} />}
          </button>
        }
      >
        <div className="ab-proc-detail" style={{ border: 'none', borderRadius: 0, padding: 24 }}>
          <div className="ab-proc-detail-header">
            <div>
              <div className="ab-proc-detail-title">{processFlows[selectedProc].name}流程</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{processFlows[selectedProc].code}</div>
            </div>
            <span className="v-badge" style={{ background: 'var(--l3-bg)', color: 'var(--l3-color)', border: '1px solid var(--l3-border)' }}>L3</span>
          </div>
          <div className="ab-proc-info-grid">
            <div className="ab-proc-info-item">
              <div className="ab-proc-info-label">流程 ID</div>
              <div className="ab-proc-info-value mono">{processFlows[selectedProc].code}</div>
            </div>
            <div className="ab-proc-info-item">
              <div className="ab-proc-info-label">版本</div>
              <div className="ab-proc-info-value mono">{processFlows[selectedProc].version}</div>
            </div>
            <div className="ab-proc-info-item">
              <div className="ab-proc-info-label">状态</div>
              <div className="ab-proc-info-value"><span className="v-badge v-badge-success">已上线</span></div>
            </div>
            <div className="ab-proc-info-item">
              <div className="ab-proc-info-label">创建者</div>
              <div className="ab-proc-info-value">{processFlows[selectedProc].creator}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>流程节点</div>
          <div className="ab-node-list" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1.2fr 120px 140px 100px', alignItems: 'center', padding: '10px 16px', gap: 12, background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>节点名称</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>类型</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>处理人/服务</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SLA</span>
            </div>
            {processFlows[selectedProc].detailNodes.map((node, idx) => (
              <div className="ab-node-item" key={idx}>
                <div className="ab-node-number" style={node.isGateway ? { transform: 'rotate(45deg)', fontSize: 10 } : node.isEnd ? { background: 'var(--success-subtle)', borderColor: 'var(--success)', color: 'var(--success)' } : undefined}>{node.num}</div>
                <div className="ab-node-name">{node.name}</div>
                <div><span className={`ab-node-type ${node.type}`}>{node.typeLabel}</span></div>
                <div className="ab-node-assignee" style={node.isGateway ? { color: 'var(--warning)' } : undefined}>{node.assignee}</div>
                <div className="ab-node-sla">{node.sla}</div>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </>
  );
}
