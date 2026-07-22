import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, MessageSquare, FileCheck, BarChart3, FileText,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { MOCK_AGENTS } from '@/mock'; // MOCK

const AGENT_TABS: SubTabItem[] = [
  { label: '数字员工列表', path: '/agents' },
  { label: '数字员工详情', path: '/agents/detail' },
  { label: '知识提炼', path: '/agents/knowledge' },
  { label: '任务管理', path: '/agents/tasks' },
  { label: '协作中心', path: '/agents/collab' },
  { label: '效果评估', path: '/agents/evaluation' },
];

// MOCK: 任务列表
interface TaskRow {
  id: string;
  agent: string;
  agentAvatar: string;
  typeIcon: typeof MessageSquare;
  typeLabel: string;
  input: string;
  statusBadge: string;
  status: string;
  duration: string;
  token: string;
  startTime: string;
}

const MOCK_TASKS: TaskRow[] = [
  { id: 'T-20260722-0128', agent: '客服助手', agentAvatar: '客', typeIcon: MessageSquare, typeLabel: '对话', input: '用户询问批量订单退款政策及适用条件', statusBadge: 'v-badge-warning', status: '运行中', duration: '--', token: '--', startTime: '14:32:15' },
  { id: 'T-20260722-0127', agent: '合同审核员', agentAvatar: '审', typeIcon: FileCheck, typeLabel: '审核', input: '采购框架协议 SK-2026-0892 合规审查', statusBadge: 'v-badge-success', status: '成功', duration: '3.2s', token: '2,847', startTime: '14:28:03' },
  { id: 'T-20260722-0126', agent: '数据分析师', agentAvatar: '分', typeIcon: BarChart3, typeLabel: '分析', input: 'Q2 华东区销售数据趋势分析报告生成', statusBadge: 'v-badge-success', status: '成功', duration: '8.7s', token: '5,210', startTime: '14:15:41' },
  { id: 'T-20260722-0125', agent: '报告生成器', agentAvatar: '生', typeIcon: FileText, typeLabel: '生成', input: '本月供应链风险周报自动生成', statusBadge: 'v-badge-success', status: '成功', duration: '12.4s', token: '8,932', startTime: '13:50:22' },
  { id: 'T-20260722-0124', agent: '客服助手', agentAvatar: '客', typeIcon: MessageSquare, typeLabel: '对话', input: 'VIP 客户产品使用问题排查与技术支持', statusBadge: 'v-badge-success', status: '成功', duration: '1.8s', token: '1,423', startTime: '13:42:09' },
  { id: 'T-20260722-0123', agent: '合同审核员', agentAvatar: '审', typeIcon: FileCheck, typeLabel: '审核', input: '供应商 NDA 协议条款合规性校验', statusBadge: 'v-badge-error', status: '失败', duration: '5.0s', token: '3,102', startTime: '13:30:55' },
  { id: 'T-20260722-0122', agent: '数据分析师', agentAvatar: '分', typeIcon: BarChart3, typeLabel: '分析', input: '用户行为漏斗转化率异常检测', statusBadge: 'v-badge-success', status: '成功', duration: '6.1s', token: '4,567', startTime: '13:18:30' },
  { id: 'T-20260722-0121', agent: '客服助手', agentAvatar: '客', typeIcon: MessageSquare, typeLabel: '对话', input: '多语言客户咨询（日语）产品规格查询', statusBadge: 'v-badge-error', status: '失败', duration: '2.3s', token: '891', startTime: '13:05:14' },
];

export default function AgentsTasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>('T-20260722-0128');

  const selected = MOCK_TASKS.find((t) => t.id === selectedId) ?? MOCK_TASKS[0];

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .at-breadcrumb { font-size: 13px; color: var(--muted-foreground); margin-bottom: 12px; }
        .at-breadcrumb a { color: var(--muted-foreground); text-decoration: none; cursor: pointer; }
        .at-breadcrumb a:hover { color: var(--foreground); }
        .at-breadcrumb span { margin: 0 6px; }
        .at-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .at-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; display: flex; flex-direction: column; gap: 6px; }
        .at-stat-card-label { font-size: 12px; color: var(--muted-foreground); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .at-stat-card-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
        .at-stat-card-sub { font-size: 12px; color: var(--muted-foreground); }
        .at-filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .at-filter-status-tabs { display: flex; gap: 2px; background: var(--muted); border-radius: var(--radius); padding: 2px; }
        .at-filter-status-tabs .v-tab { border-radius: 2px; font-size: 12px; padding: 5px 10px; cursor: pointer; }
        .at-filter-status-tabs .v-tab.active { background: var(--foreground); color: var(--background); }
        .at-filter-select { height: 32px; padding: 0 10px; font-size: 13px; font-family: inherit; background: var(--card); color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius); outline: none; cursor: pointer; }
        .at-filter-input { height: 32px; padding: 0 10px 0 32px; font-size: 13px; font-family: inherit; background: var(--card); color: var(--foreground); border: 1px solid var(--border); border-radius: var(--radius); outline: none; width: 220px; }
        .at-filter-search-wrap { position: relative; display: flex; align-items: center; }
        .at-filter-search-wrap svg { position: absolute; left: 10px; width: 14px; height: 14px; color: var(--muted-foreground); pointer-events: none; }
        .at-content-layout { display: flex; gap: 16px; }
        .at-table-panel { flex: 1; min-width: 0; overflow: hidden; }
        .at-detail-panel { width: 320px; min-width: 320px; max-height: calc(100vh - 200px); overflow-y: auto; }
        .at-detail-section { margin-bottom: 20px; }
        .at-detail-section:last-child { margin-bottom: 0; }
        .at-detail-section-title { font-size: 11px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .at-detail-field { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
        .at-detail-field:last-child { border-bottom: none; }
        .at-detail-field-label { font-size: 12px; color: var(--muted-foreground); }
        .at-detail-field-value { font-size: 13px; font-weight: 500; }
        .at-detail-pre { background: var(--background); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); line-height: 1.6; white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto; }
        .at-token-bars { display: flex; flex-direction: column; gap: 10px; }
        .at-token-bar-item { display: flex; flex-direction: column; gap: 4px; }
        .at-token-bar-header { display: flex; justify-content: space-between; align-items: center; }
        .at-token-bar-label { font-size: 12px; color: var(--muted-foreground); }
        .at-token-bar-value { font-size: 12px; font-weight: 600; font-family: var(--font-mono); }
        .at-token-bar-track { height: 4px; background: var(--muted); border-radius: 2px; overflow: hidden; }
        .at-token-bar-fill { height: 100%; border-radius: 2px; }
        .at-timeline { display: flex; flex-direction: column; gap: 0; }
        .at-timeline-item { display: flex; gap: 12px; position: relative; padding-bottom: 16px; }
        .at-timeline-item:last-child { padding-bottom: 0; }
        .at-timeline-dot-wrap { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; width: 16px; }
        .at-timeline-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
        .at-timeline-line { width: 1px; flex: 1; background: var(--border); margin-top: 4px; }
        .at-timeline-item:last-child .at-timeline-line { display: none; }
        .at-type-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
        .at-agent-name { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; }
        .at-agent-avatar { width: 20px; height: 20px; border-radius: var(--radius); background: var(--muted); display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: var(--muted-foreground); flex-shrink: 0; }
      `}</style>

      {/* Breadcrumb + Header */}
      {/* Stats Cards */}
      <div className="at-stats-grid">
        <div className="at-stat-card">
          <span className="at-stat-card-label">总任务</span>
          <span className="at-stat-card-value">1,234</span>
          <span className="at-stat-card-sub">近 7 天</span>
        </div>
        <div className="at-stat-card">
          <span className="at-stat-card-label">运行中</span>
          <span className="at-stat-card-value" style={{ color: 'var(--warning)' }}>23</span>
          <span className="at-stat-card-sub">含 5 个排队中</span>
        </div>
        <div className="at-stat-card">
          <span className="at-stat-card-label">成功</span>
          <span className="at-stat-card-value" style={{ color: 'var(--success)' }}>1,189</span>
          <span className="at-stat-card-sub">成功率 96.3%</span>
        </div>
        <div className="at-stat-card">
          <span className="at-stat-card-label">失败</span>
          <span className="at-stat-card-value" style={{ color: 'var(--destructive)' }}>22</span>
          <span className="at-stat-card-sub">失败率 1.8%</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="at-filter-bar">
        <div className="at-filter-status-tabs">
          <span className="v-tab active">全部</span>
          <span className="v-tab">运行中</span>
          <span className="v-tab">成功</span>
          <span className="v-tab">失败</span>
          <span className="v-tab">排队</span>
        </div>
        <select className="at-filter-select">
          <option>全部数字员工</option>
          <option>客服助手</option>
          <option>合同审核员</option>
          <option>数据分析师</option>
          <option>报告生成器</option>
          <option>知识库管理员</option>
        </select>
        <select className="at-filter-select">
          <option>最近 7 天</option>
          <option>最近 24 小时</option>
          <option>最近 30 天</option>
          <option>自定义范围</option>
        </select>
        <div className="at-filter-search-wrap">
          <Search />
          <input className="at-filter-input" type="text" placeholder="搜索任务 ID、摘要..." />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>共 1,234 条</span>
      </div>

      {/* Content: Table + Detail */}
      <div className="at-content-layout">
        <div className="at-table-panel">
          <table className="v-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 80 }} />
              <col style={{ minWidth: 180 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr>
                <th>任务 ID</th>
                <th>关联数字员工</th>
                <th>任务类型</th>
                <th>输入摘要</th>
                <th>状态</th>
                <th>耗时</th>
                <th>Token 消耗</th>
                <th>开始时间</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TASKS.map((task) => {
                const TypeIcon = task.typeIcon;
                const isSelected = task.id === selectedId;
                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedId(task.id)}
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--muted)' : undefined }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.id}</td>
                    <td>
                      <span className="at-agent-name">
                        <span className="at-agent-avatar">{task.agentAvatar}</span>
                        {task.agent}
                      </span>
                    </td>
                    <td>
                      <span className="at-type-badge"><TypeIcon style={{ width: 14, height: 14 }} />{task.typeLabel}</span>
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.input}</td>
                    <td><span className={`v-badge ${task.statusBadge}`}>{task.status}</span></td>
                    <td><span className="v-meta">{task.duration}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{task.token}</td>
                    <td><span className="v-meta">{task.startTime}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div className="at-detail-panel">
          <div className="v-card">
            {/* Basic Info */}
            <div className="at-detail-section">
              <div className="at-detail-section-title">基本信息</div>
              <div className="at-detail-field">
                <span className="at-detail-field-label">任务 ID</span>
                <span className="at-detail-field-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selected.id}</span>
              </div>
              <div className="at-detail-field">
                <span className="at-detail-field-label">任务类型</span>
                <span className="at-detail-field-value">
                  <span className="at-type-badge">
                    <selected.typeIcon style={{ width: 14, height: 14 }} />
                    {selected.typeLabel}
                  </span>
                </span>
              </div>
              <div className="at-detail-field">
                <span className="at-detail-field-label">状态</span>
                <span className="at-detail-field-value"><span className={`v-badge ${selected.statusBadge}`}>{selected.status}</span></span>
              </div>
              <div className="at-detail-field">
                <span className="at-detail-field-label">创建时间</span>
                <span className="at-detail-field-value">2026-07-22 {selected.startTime}</span>
              </div>
              <div className="at-detail-field">
                <span className="at-detail-field-label">关联数字员工</span>
                <span className="at-detail-field-value">{selected.agent}</span>
              </div>
            </div>

            {/* Input */}
            <div className="at-detail-section">
              <div className="at-detail-section-title">输入内容</div>
              <pre className="at-detail-pre">用户消息：我想了解批量订单退款的适用政策，我们公司最近有一批价值约 50 万的货物需要申请退款，请问需要哪些材料？处理周期是多久？</pre>
            </div>

            {/* Output Summary */}
            <div className="at-detail-section">
              <div className="at-detail-section-title">输出摘要</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                {selected.status === '运行中'
                  ? '正在检索退款政策知识库，已匹配到 3 条相关条款，正在生成结构化回复...'
                  : selected.status === '成功'
                  ? '已根据退款政策知识库生成结构化回复，包含适用条件、所需材料清单及处理周期说明。'
                  : '任务执行失败，错误原因：RAG 检索超时，未返回结果。'}
              </div>
            </div>

            {/* Token Usage */}
            <div className="at-detail-section">
              <div className="at-detail-section-title">Token 用量明细</div>
              <div className="at-token-bars">
                <div className="at-token-bar-item">
                  <div className="at-token-bar-header">
                    <span className="at-token-bar-label">Prompt Tokens</span>
                    <span className="at-token-bar-value">1,247</span>
                  </div>
                  <div className="at-token-bar-track">
                    <div className="at-token-bar-fill" style={{ width: '62%', background: '#60a5fa' }} />
                  </div>
                </div>
                <div className="at-token-bar-item">
                  <div className="at-token-bar-header">
                    <span className="at-token-bar-label">Completion Tokens</span>
                    <span className="at-token-bar-value">389</span>
                  </div>
                  <div className="at-token-bar-track">
                    <div className="at-token-bar-fill" style={{ width: '19%', background: 'var(--success)' }} />
                  </div>
                </div>
                <div className="at-token-bar-item">
                  <div className="at-token-bar-header">
                    <span className="at-token-bar-label">Total Tokens</span>
                    <span className="at-token-bar-value">1,636</span>
                  </div>
                  <div className="at-token-bar-track">
                    <div className="at-token-bar-fill" style={{ width: '81%', background: 'var(--warning)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Timeline */}
            <div className="at-detail-section">
              <div className="at-detail-section-title">执行步骤</div>
              <div className="at-timeline">
                <div className="at-timeline-item">
                  <div className="at-timeline-dot-wrap">
                    <div className="at-timeline-dot" style={{ background: 'var(--success)' }} />
                    <div className="at-timeline-line" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>意图识别</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>14:32:15 → 14:32:16 (0.1s)</div>
                  </div>
                </div>
                <div className="at-timeline-item">
                  <div className="at-timeline-dot-wrap">
                    <div className="at-timeline-dot" style={{ background: 'var(--success)' }} />
                    <div className="at-timeline-line" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>RAG 知识检索</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>14:32:16 → 14:32:18 (2.1s) · 命中 3 条</div>
                  </div>
                </div>
                <div className="at-timeline-item">
                  <div className="at-timeline-dot-wrap">
                    <div className="at-timeline-dot" style={{ background: selected.status === '运行中' ? 'var(--warning)' : 'var(--success)' }} />
                    <div className="at-timeline-line" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>LLM 生成回复</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      {selected.status === '运行中' ? '14:32:18 → 执行中...' : '14:32:18 → 14:32:20 (2.0s)'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
