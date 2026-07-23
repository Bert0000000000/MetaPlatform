import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  Plus,
  Bug,
  FileCheck2,
  Bot,
  Activity,
  Calculator,
  BookOpen,
  Clock,
} from 'lucide-react';
import { SubTabs, StepDrawer, FormDrawer, Field, TextInput, TextArea, Select, FormSection } from '@mate/shared';
import { MOCK_MY_AGENTS } from '@/mock'; // MOCK

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

// MOCK: agent cards data (richer than MOCK_MY_AGENTS)
const agentCards = [
  { icon: Bug, iconClass: 'custom', typeLabel: '巡检型', statusLabel: '运行中', statusClass: 'v-badge-success', dotClass: 'dot-success', name: '数据质量巡检员', desc: '自动扫描 Ontology 本体中的业务对象数据，检测空值、格式异常与一致性违规，生成数据质量评分报告并推送告警。', weekTasks: '286', successRate: '94.8%', avgTime: '2.1s', lastActive: '5 分钟前活跃', actionLabel: '暂停' },
  { icon: FileCheck2, iconClass: 'workflow', typeLabel: '审批型', statusLabel: '运行中', statusClass: 'v-badge-success', dotClass: 'dot-success', name: '合同审核员', desc: '基于 BPMN 审批流与 RAG 知识库，自动解析合同条款、校验合规风险、比对历史模板，输出审核意见与风险评分。', weekTasks: '53', successRate: '100%', avgTime: '8.4s', lastActive: '12 分钟前活跃', actionLabel: '暂停' },
  { icon: Bot, iconClass: 'runtime', typeLabel: '对话型', statusLabel: '已暂停', statusClass: 'v-badge-warning', dotClass: 'dot-warning', name: '客服小助手', desc: '对接企业知识库与产品文档，通过多轮对话解答客户咨询、查询订单状态、处理退换货请求，支持自动转人工。', weekTasks: '412', successRate: '99.1%', avgTime: '1.8s', lastActive: '2 小时前暂停', actionLabel: '启动' },
  { icon: Activity, iconClass: 'monitor', typeLabel: '监控型', statusLabel: '运行中', statusClass: 'v-badge-success', dotClass: 'dot-success', name: '供应链监控员', desc: '实时监听供应链事件流，自动识别库存预警、物流延迟与供应商异常，触发 Action 节点执行补货或通知流程。', weekTasks: '178', successRate: '97.2%', avgTime: '4.7s', lastActive: '1 分钟前活跃', actionLabel: '暂停' },
  { icon: Calculator, iconClass: 'finance', typeLabel: '分析型', statusLabel: '运行中', statusClass: 'v-badge-success', dotClass: 'dot-success', name: '财务对账员', desc: '定时拉取多源财务数据，自动执行跨系统对账、差异定位与异常标记，生成对账报告并同步至审批流。', weekTasks: '94', successRate: '95.7%', avgTime: '5.3s', lastActive: '28 分钟前活跃', actionLabel: '暂停' },
  { icon: BookOpen, iconClass: 'rag', typeLabel: '知识型', statusLabel: '运行中', statusClass: 'v-badge-success', dotClass: 'dot-success', name: '知识库管理员', desc: '自动执行文档解析、分块、向量化入库，维护 Milvus 索引质量，定期清理过期内容并触发重索引任务。', weekTasks: '224', successRate: '98.2%', avgTime: '3.9s', lastActive: '8 分钟前活跃', actionLabel: '暂停' },
];

// MOCK: execution log data
const execLogs = [
  { id: 'l01', agent: '数据质量巡检员', agentId: '数据质量巡检员', time: '07-22 14:32:08', duration: '1.8s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '2,340' },
  { id: 'l02', agent: '供应链监控员', agentId: '供应链监控员', time: '07-22 14:28:45', duration: '4.2s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '5,120' },
  { id: 'l03', agent: '合同审核员', agentId: '合同审核员', time: '07-22 14:15:22', duration: '12.6s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '18,740' },
  { id: 'l04', agent: '知识库管理员', agentId: '知识库管理员', time: '07-22 14:02:11', duration: '6.3s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '8,960' },
  { id: 'l05', agent: '财务对账员', agentId: '财务对账员', time: '07-22 13:48:37', duration: '7.1s', status: '失败', statusClass: 'v-badge-destructive', dotClass: 'dot-destructive', trigger: '定时触发', tokens: '10,280' },
  { id: 'l06', agent: '数据质量巡检员', agentId: '数据质量巡检员', time: '07-22 13:30:00', duration: '2.4s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '3,100' },
  { id: 'l07', agent: '供应链监控员', agentId: '供应链监控员', time: '07-22 12:55:19', duration: '3.8s', status: '超时', statusClass: 'v-badge-warning', dotClass: 'dot-warning', trigger: '事件触发', tokens: '4,620' },
  { id: 'l08', agent: '知识库管理员', agentId: '知识库管理员', time: '07-22 12:30:05', duration: '4.5s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '7,340' },
  { id: 'l09', agent: '合同审核员', agentId: '合同审核员', time: '07-22 11:42:50', duration: '9.7s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '15,200' },
  { id: 'l10', agent: '财务对账员', agentId: '财务对账员', time: '07-22 11:15:33', duration: '5.9s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '9,180' },
  { id: 'l11', agent: '客服小助手', agentId: '客服小助手', time: '07-22 10:55:12', duration: '1.6s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '1,820' },
  { id: 'l12', agent: '数据质量巡检员', agentId: '数据质量巡检员', time: '07-22 10:30:00', duration: '2.0s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '2,560' },
  { id: 'l13', agent: '合同审核员', agentId: '合同审核员', time: '07-22 10:08:27', duration: '11.2s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '17,030' },
  { id: 'l14', agent: '供应链监控员', agentId: '供应链监控员', time: '07-22 09:48:55', duration: '5.1s', status: '失败', statusClass: 'v-badge-destructive', dotClass: 'dot-destructive', trigger: '事件触发', tokens: '6,210' },
  { id: 'l15', agent: '知识库管理员', agentId: '知识库管理员', time: '07-22 09:30:11', duration: '4.8s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '7,840' },
  { id: 'l16', agent: '财务对账员', agentId: '财务对账员', time: '07-22 09:15:00', duration: '6.5s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '9,720' },
  { id: 'l17', agent: '客服小助手', agentId: '客服小助手', time: '07-22 08:55:32', duration: '1.4s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '1,540' },
  { id: 'l18', agent: '数据质量巡检员', agentId: '数据质量巡检员', time: '07-22 08:30:08', duration: '2.2s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '2,840' },
  { id: 'l19', agent: '合同审核员', agentId: '合同审核员', time: '07-22 08:12:19', duration: '10.5s', status: '超时', statusClass: 'v-badge-warning', dotClass: 'dot-warning', trigger: '手动触发', tokens: '16,240' },
  { id: 'l20', agent: '供应链监控员', agentId: '供应链监控员', time: '07-21 22:30:00', duration: '4.0s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '4,930' },
  { id: 'l21', agent: '知识库管理员', agentId: '知识库管理员', time: '07-21 20:18:42', duration: '5.3s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '8,120' },
  { id: 'l22', agent: '客服小助手', agentId: '客服小助手', time: '07-21 18:46:11', duration: '1.9s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '2,010' },
  { id: 'l23', agent: '财务对账员', agentId: '财务对账员', time: '07-21 17:32:50', duration: '7.8s', status: '失败', statusClass: 'v-badge-destructive', dotClass: 'dot-destructive', trigger: '定时触发', tokens: '10,940' },
  { id: 'l24', agent: '数据质量巡检员', agentId: '数据质量巡检员', time: '07-21 16:25:03', duration: '1.7s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '2,140' },
  { id: 'l25', agent: '合同审核员', agentId: '合同审核员', time: '07-21 15:10:38', duration: '13.4s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '手动触发', tokens: '19,860' },
  { id: 'l26', agent: '供应链监控员', agentId: '供应链监控员', time: '07-21 14:48:21', duration: '4.5s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '5,460' },
  { id: 'l27', agent: '知识库管理员', agentId: '知识库管理员', time: '07-21 13:30:00', duration: '5.0s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '定时触发', tokens: '7,980' },
  { id: 'l28', agent: '客服小助手', agentId: '客服小助手', time: '07-21 12:05:17', duration: '1.5s', status: '成功', statusClass: 'v-badge-success', dotClass: 'dot-success', trigger: '事件触发', tokens: '1,620' },
];

// MOCK: trend chart data
const trendData = [
  { label: '周一', height: '57%', active: false },
  { label: '周二', height: '74%', active: false },
  { label: '周三', height: '100%', active: true },
  { label: '周四', height: '82%', active: false },
  { label: '周五', height: '69%', active: false },
  { label: '周六', height: '33%', active: false },
  { label: '周日', height: '20%', active: false },
];

const iconBgMap: Record<string, string> = {
  runtime: 'var(--success-subtle)',
  workflow: 'rgba(96,165,250,0.12)',
  data: 'var(--warning-subtle)',
  rag: '#1a1424',
  custom: 'var(--muted)',
  monitor: '#1a1820',
  finance: '#141a1a',
};
const iconColorMap: Record<string, string> = {
  runtime: 'var(--success)',
  workflow: '#60a5fa',
  data: 'var(--warning)',
  rag: '#a78bfa',
  custom: 'var(--muted-foreground)',
  monitor: '#f472b6',
  finance: '#2dd4bf',
};

const dotColorMap: Record<string, string> = {
  'dot-success': 'var(--success)',
  'dot-warning': 'var(--warning)',
  'dot-destructive': 'var(--destructive)',
};

const badgeBgMap: Record<string, string> = {
  'v-badge-success': 'var(--success-subtle)',
  'v-badge-warning': 'var(--warning-subtle)',
  'v-badge-destructive': 'rgba(255,97,102,0.15)',
  'v-badge-neutral': 'var(--muted)',
  'v-badge-info': 'rgba(96,165,250,0.12)',
};
const badgeColorMap: Record<string, string> = {
  'v-badge-success': 'var(--success)',
  'v-badge-warning': 'var(--warning)',
  'v-badge-destructive': 'var(--destructive)',
  'v-badge-neutral': 'var(--muted-foreground)',
  'v-badge-info': '#60a5fa',
};

export default function MyAgentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [execDrawerOpen, setExecDrawerOpen] = useState(false);
  const [execPage, setExecPage] = useState(1);
  const execPageSize = 10;
  const execPageTotal = Math.ceil(execLogs.length / execPageSize);
  const pagedExecLogs = useMemo(
    () => execLogs.slice((execPage - 1) * execPageSize, execPage * execPageSize),
    [execPage]
  );
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: '流程型',
    description: '',
    llmModel: 'doubao-pro-32k',
    temperature: 0.3,
    systemPrompt: '',
    maxTokens: 4096,
    knowledgeBases: ['通用知识库'],
    topK: 5,
    enableRag: true,
  });
  const update = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>我的数字员工</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>你创建和管理的数字员工</p>
        </div>
        <button className="v-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDrawerOpen(true)}>
          <Plus style={{ width: 14, height: 14 }} />创建数字员工
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>运行中</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--success)' }}>8</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>已暂停</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--warning)' }}>2</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>本月执行</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#60a5fa' }}>
            1,247<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 2 }}>次</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>成功率</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--success)' }}>
            96.8<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 2 }}>%</span>
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>平均耗时</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
            3.2<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: 2 }}>s</span>
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {agentCards.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 16, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: iconBgMap[a.iconClass], color: iconColorMap[a.iconClass] }}>
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{a.typeLabel}</span>
                  <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: badgeBgMap[a.statusClass], color: badgeColorMap[a.statusClass] }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: dotColorMap[a.dotClass] }} />
                    {a.statusLabel}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.desc}</div>
              <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>本周执行</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.weekTasks}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', position: 'relative', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>成功率</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--success)' }}>{a.successRate}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', position: 'relative', borderLeft: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>平均耗时</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.avgTime}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                <span className="v-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 12, height: 12 }} />{a.lastActive}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="v-btn" onClick={() => navigate(`/agents/detail?name=${encodeURIComponent(a.name)}`)} style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>查看详情</button>
                  <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{a.actionLabel}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Left: execution log table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <div className="v-card" style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>最近执行记录</div>
              <button className="v-btn" onClick={() => { setExecPage(1); setExecDrawerOpen(true); }} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>查看全部</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Agent 名称', '执行时间', '耗时', '状态', '触发方式', 'Token 消耗'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {execLogs.slice(0, 10).map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.agent}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.time}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.duration}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: badgeBgMap[log.statusClass], color: badgeColorMap[log.statusClass] }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: dotColorMap[log.dotClass] }} />
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{log.trigger}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: performance trend panel */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex' }}>
          <div className="v-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>性能趋势</div>
              <span className="v-meta">近 7 天</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: 220, padding: '0 4px' }}>
              {trendData.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
                  <div style={{ width: '100%', borderRadius: '3px 3px 0 0', minHeight: 4, height: d.height, background: d.active ? '#60a5fa' : 'var(--muted)' }} />
                  <span style={{ fontSize: 11, color: d.active ? '#60a5fa' : 'var(--muted-foreground)' }}>{d.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--muted)', borderRadius: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>日均执行</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#60a5fa' }}>178 次</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--muted)', borderRadius: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>峰值（周三）</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#60a5fa' }}>245 次</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--muted)', borderRadius: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>错误率</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--warning)' }}>3.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <StepDrawer
        open={drawerOpen}
        title="创建数字员工"
        steps={[
          {
            title: '基本信息',
            description: '设置数字员工的基础属性',
            content: (
              <>
                <Field label="名称" required>
                  <TextInput placeholder="请输入数字员工名称" value={form.name} onChange={(e) => update('name', e.target.value)} />
                </Field>
                <Field label="编码">
                  <TextInput placeholder="请输入编码（如 agent-cs-001）" value={form.code} onChange={(e) => update('code', e.target.value)} />
                </Field>
                <Field label="类型">
                  <Select value={form.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="流程型">流程型</option>
                    <option value="知识型">知识型</option>
                    <option value="协作型">协作型</option>
                    <option value="通用型">通用型</option>
                  </Select>
                </Field>
                <Field label="描述">
                  <TextArea placeholder="请输入描述" rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} />
                </Field>
              </>
            ),
          },
          {
            title: '能力配置',
            description: '配置 LLM 模型与推理参数',
            content: (
              <>
                <Field label="关联 LLM 模型">
                  <Select value={form.llmModel} onChange={(e) => update('llmModel', e.target.value)}>
                    <option value="doubao-pro-32k">doubao-pro-32k</option>
                    <option value="doubao-pro-128k">doubao-pro-128k</option>
                    <option value="GPT-4o">GPT-4o</option>
                    <option value="Claude-3.5-Sonnet">Claude-3.5-Sonnet</option>
                    <option value="DeepSeek-V3">DeepSeek-V3</option>
                  </Select>
                </Field>
                <Field label={`Temperature（当前 ${form.temperature}）`}>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={(e) => update('temperature', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#60a5fa' }}
                  />
                </Field>
                <Field label="System Prompt">
                  <TextArea placeholder="请输入系统提示词" rows={5} value={form.systemPrompt} onChange={(e) => update('systemPrompt', e.target.value)} />
                </Field>
                <Field label="Max Tokens">
                  <TextInput
                    type="number"
                    placeholder="请输入最大 Token 数"
                    value={form.maxTokens}
                    onChange={(e) => update('maxTokens', parseInt(e.target.value || '0', 10))}
                  />
                </Field>
              </>
            ),
          },
          {
            title: '知识范围',
            description: '配置 RAG 知识库检索范围',
            content: (
              <>
                <Field label="关联知识库（可多选）">
                  <Select
                    multiple
                    value={form.knowledgeBases}
                    onChange={(e) => update('knowledgeBases', Array.from(e.target.selectedOptions).map((o) => o.value))}
                    style={{ height: 'auto', minHeight: 96 }}
                  >
                    <option value="通用知识库">通用知识库</option>
                    <option value="产品手册库">产品手册库</option>
                    <option value="合同模板库">合同模板库</option>
                    <option value="客服FAQ库">客服FAQ库</option>
                    <option value="政策制度库">政策制度库</option>
                  </Select>
                </Field>
                <Field label="知识检索 TopK">
                  <TextInput
                    type="number"
                    placeholder="如 5"
                    value={form.topK}
                    onChange={(e) => update('topK', parseInt(e.target.value || '0', 10))}
                  />
                </Field>
                <Field label="是否启用 RAG">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.enableRag}
                      onChange={(e) => update('enableRag', e.target.checked)}
                      style={{ accentColor: '#60a5fa' }}
                    />
                    启用 RAG 检索增强
                  </label>
                </Field>
              </>
            ),
          },
          {
            title: '确认创建',
            description: '请确认信息无误后完成创建',
            content: (
              <FormSection title="创建信息确认" desc="以下是前 3 步填写的内容，请核对后点击「完成」按钮提交。">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>名称：</span>{form.name || '—'}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>编码：</span>{form.code || '—'}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>类型：</span>{form.type}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>关联 LLM 模型：</span>{form.llmModel}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>Temperature：</span>{form.temperature}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>Max Tokens：</span>{form.maxTokens}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>知识检索 TopK：</span>{form.topK}</div>
                  <div><span style={{ color: 'var(--muted-foreground)' }}>启用 RAG：</span>{form.enableRag ? '是' : '否'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--muted-foreground)' }}>描述：</span>{form.description || '—'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--muted-foreground)' }}>System Prompt：</span>{form.systemPrompt || '—'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--muted-foreground)' }}>关联知识库：</span>{form.knowledgeBases.join('、') || '—'}</div>
                </div>
              </FormSection>
            ),
          },
        ]}
        onCancel={() => setDrawerOpen(false)}
        onFinish={() => setDrawerOpen(false)}
      />

      <FormDrawer
        open={execDrawerOpen}
        title={`最近执行记录（共 ${execLogs.length} 条）`}
        onCancel={() => setExecDrawerOpen(false)}
        onOk={() => setExecDrawerOpen(false)}
        defaultSize="full"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                {['#', 'Agent 名称', '执行时间', '耗时', '状态', '触发方式', 'Token 消耗'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedExecLogs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(execPage - 1) * execPageSize + i + 1}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.agent}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.time}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.duration}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: badgeBgMap[log.statusClass], color: badgeColorMap[log.statusClass] }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: dotColorMap[log.dotClass] }} />
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{log.trigger}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              第 {(execPage - 1) * execPageSize + 1} - {Math.min(execPage * execPageSize, execLogs.length)} 条，共 {execLogs.length} 条
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="v-btn"
                disabled={execPage === 1}
                onClick={() => setExecPage((p) => Math.max(1, p - 1))}
                style={{ height: 28, padding: '0 10px', fontSize: 12, opacity: execPage === 1 ? 0.5 : 1 }}
              >
                上一页
              </button>
              {Array.from({ length: execPageTotal }).map((_, i) => (
                <button
                  key={i}
                  className={execPage === i + 1 ? 'v-btn-primary' : 'v-btn'}
                  onClick={() => setExecPage(i + 1)}
                  style={{ height: 28, minWidth: 28, padding: '0 8px', fontSize: 12 }}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="v-btn"
                disabled={execPage === execPageTotal}
                onClick={() => setExecPage((p) => Math.min(execPageTotal, p + 1))}
                style={{ height: 28, padding: '0 10px', fontSize: 12, opacity: execPage === execPageTotal ? 0.5 : 1 }}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}
