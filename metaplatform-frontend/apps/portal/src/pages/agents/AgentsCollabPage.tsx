import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, FileCheck, Scale } from 'lucide-react';
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

// MOCK: 协作会话列表
interface CollabRow {
  id: string;
  initiator: string;
  participants: string[];
  collabType: string;
  collabBadge: string;
  status: string;
  statusBadge: string;
  messages: number;
  duration: string;
}

const MOCK_SESSIONS: CollabRow[] = [
  { id: 'COL-20260721-001', initiator: '客服助手', participants: ['合同审核员', '法务顾问'], collabType: '委托', collabBadge: 'v-badge-info', status: '已完成', statusBadge: 'v-badge-success', messages: 12, duration: '3m 24s' },
  { id: 'COL-20260721-002', initiator: '客服助手', participants: ['知识库管理员'], collabType: '询问', collabBadge: 'v-badge-info', status: '已完成', statusBadge: 'v-badge-success', messages: 4, duration: '0m 48s' },
  { id: 'COL-20260721-003', initiator: '营销文案', participants: ['客服助手', '数据分析师'], collabType: '联合执行', collabBadge: 'v-badge-warning', status: '进行中', statusBadge: 'v-badge-warning', messages: 8, duration: '5m 12s' },
  { id: 'COL-20260720-007', initiator: '客服助手', participants: ['数据分析师'], collabType: '委托', collabBadge: 'v-badge-info', status: '已完成', statusBadge: 'v-badge-success', messages: 6, duration: '2m 05s' },
  { id: 'COL-20260720-004', initiator: '客服助手', participants: ['订单处理员', '库存管家', '物流协调'], collabType: '联合执行', collabBadge: 'v-badge-warning', status: '异常', statusBadge: 'v-badge-error', messages: 18, duration: '8m 37s' },
  { id: 'COL-20260719-012', initiator: '客服助手', participants: ['退款审核员'], collabType: '询问', collabBadge: 'v-badge-info', status: '已完成', statusBadge: 'v-badge-success', messages: 3, duration: '0m 31s' },
];

// MOCK: 参与的 Agent
const MOCK_PARTICIPANTS = [
  { icon: Bot, name: '客服助手', role: '发起者 / 协调方' },
  { icon: FileCheck, name: '合同审核员', role: '执行者 / 合同审查' },
  { icon: Scale, name: '法务顾问', role: '顾问 / 合规校验' },
];

// MOCK: 消息时间线
const MOCK_MESSAGES = [
  { side: 'left', sender: '客服助手', time: '10:15:32', content: '收到用户提交的供应商合同审核请求，合同编号 CT-2026-0892，涉及金额 128 万元。需要执行标准合同审查流程，请合同审核员接手。' },
  { side: 'right', sender: '合同审核员', time: '10:15:45', content: '已接收任务，开始审查合同条款。预计需要 2-3 分钟完成初步审查。' },
  { side: 'left', sender: '合同审核员', time: '10:17:08', content: '发现第 7.2 条"不可抗力"条款表述存在风险，与标准模板偏差较大。建议请法务顾问进行合规性校验。' },
  { side: 'left', sender: '法务顾问', time: '10:18:22', content: '已完成合规校验。第 7.2 条需修改为标准不可抗力表述，同时建议补充第 9.1 条争议解决条款。已生成修改建议草案。' },
  { side: 'right', sender: '客服助手', time: '10:18:56', content: '审核完成。已将审查结果和修改建议反馈给用户，会话结束。' },
];

export default function AgentsCollabPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string>('COL-20260721-001');

  const selected = MOCK_SESSIONS.find((s) => s.id === selectedId) ?? MOCK_SESSIONS[0];

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .ac-breadcrumb { font-size: 13px; color: var(--muted-foreground); margin-bottom: 12px; }
        .ac-breadcrumb a { color: var(--muted-foreground); text-decoration: none; cursor: pointer; }
        .ac-breadcrumb a:hover { color: var(--foreground); }
        .ac-breadcrumb span { margin: 0 6px; }
        .ac-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .ac-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; }
        .ac-stat-label { font-size: 12px; color: var(--muted-foreground); margin-bottom: 6px; }
        .ac-stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
        .ac-stat-value .unit { font-size: 14px; font-weight: 500; color: var(--muted-foreground); margin-left: 2px; }
        .ac-content-layout { display: flex; gap: 16px; min-height: 0; }
        .ac-content-left { flex: 1; min-width: 0; }
        .ac-content-right { width: 340px; flex-shrink: 0; }
        .ac-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .ac-section-title { font-size: 14px; font-weight: 600; }
        .ac-mono { font-family: var(--font-mono); font-size: 12px; color: 'var(--muted-foreground)'; }
        .ac-agent-badges { display: flex; gap: 4px; flex-wrap: wrap; }
        .ac-agent-badges .v-badge { font-size: 11px; padding: 1px 7px; }
        .ac-detail-panel { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; height: fit-content; max-height: calc(100vh - 200px); position: sticky; top: 32px; }
        .ac-detail-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .ac-detail-header h3 { font-size: 14px; font-weight: 600; }
        .ac-detail-body { padding: 16px 20px; flex: 1; overflow-y: auto; }
        .ac-detail-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .ac-detail-info-item .info-label { font-size: 11px; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
        .ac-detail-info-item .info-value { font-size: 13px; color: var(--foreground); }
        .ac-detail-section-label { font-size: 11px; font-weight: 500; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; margin-top: 16px; }
        .ac-detail-section-label:first-of-type { margin-top: 0; }
        .ac-agent-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .ac-agent-item + .ac-agent-item { border-top: 1px solid var(--border); }
        .ac-agent-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ac-agent-name { font-size: 13px; font-weight: 500; }
        .ac-agent-role { font-size: 11px; color: var(--muted-foreground); }
        .ac-timeline { display: flex; flex-direction: column; gap: 12px; }
        .ac-msg-row { display: flex; }
        .ac-msg-row.msg-left { justify-content: flex-start; }
        .ac-msg-row.msg-right { justify-content: flex-end; }
        .ac-msg-bubble { max-width: 80%; }
        .ac-msg-bubble-left .msg-content { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius) var(--radius) var(--radius) 2px; padding: 10px 12px; font-size: 13px; line-height: 1.5; }
        .ac-msg-bubble-right .msg-content { background: #1e293b; border: 1px solid #334155; border-radius: var(--radius) var(--radius) 2px var(--radius); padding: 10px 12px; font-size: 13px; line-height: 1.5; }
        .ac-msg-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .ac-msg-row.msg-left .msg-meta { justify-content: flex-start; }
        .ac-msg-row.msg-right .msg-meta { justify-content: flex-end; }
        .ac-msg-sender { font-size: 11px; font-weight: 600; color: var(--foreground); }
        .ac-msg-time { font-size: 11px; color: var(--muted-foreground); }
      `}</style>

      {/* Breadcrumb + Header */}
      {/* Stats */}
      <div className="ac-stats-grid">
        <div className="ac-stat-card">
          <div className="ac-stat-label">活跃协作</div>
          <div className="ac-stat-value">8</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">协作任务</div>
          <div className="ac-stat-value">156</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">跨 Agent 调用</div>
          <div className="ac-stat-value">1,234</div>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-label">平均响应</div>
          <div className="ac-stat-value">2.3<span className="unit">s</span></div>
        </div>
      </div>

      {/* Content: table + detail */}
      <div className="ac-content-layout">
        <div className="ac-content-left">
          <div className="ac-section-header">
            <div className="ac-section-title">协作会话列表</div>
            <span className="v-meta">共 6 条记录</span>
          </div>
          <table className="v-table">
            <thead>
              <tr>
                <th>会话 ID</th>
                <th>发起 Agent</th>
                <th>参与 Agents</th>
                <th>协作类型</th>
                <th>状态</th>
                <th>消息数</th>
                <th>持续时间</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SESSIONS.map((session) => {
                const isSelected = session.id === selectedId;
                return (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedId(session.id)}
                    style={{ cursor: 'pointer', background: isSelected ? 'var(--muted)' : undefined }}
                  >
                    <td className="ac-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)' }}>{session.id}</td>
                    <td>{session.initiator}</td>
                    <td>
                      <div className="ac-agent-badges">
                        {session.participants.map((p) => (
                          <span key={p} className="v-badge v-badge-neutral">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td><span className={`v-badge ${session.collabBadge}`}>{session.collabType}</span></td>
                    <td><span className={`v-badge ${session.statusBadge}`}>{session.status}</span></td>
                    <td>{session.messages}</td>
                    <td>{session.duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div className="ac-content-right">
          <div className="ac-detail-panel">
            <div className="ac-detail-header">
              <h3>会话详情</h3>
              <span className="v-meta" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{selected.id}</span>
            </div>
            <div className="ac-detail-body">
              {/* Session info */}
              <div className="ac-detail-info-grid">
                <div className="ac-detail-info-item">
                  <div className="info-label">发起者</div>
                  <div className="info-value">{selected.initiator}</div>
                </div>
                <div className="ac-detail-info-item">
                  <div className="info-label">协作类型</div>
                  <div className="info-value"><span className={`v-badge ${selected.collabBadge}`}>{selected.collabType}</span></div>
                </div>
                <div className="ac-detail-info-item">
                  <div className="info-label">状态</div>
                  <div className="info-value"><span className={`v-badge ${selected.statusBadge}`}>{selected.status}</span></div>
                </div>
                <div className="ac-detail-info-item">
                  <div className="info-label">创建时间</div>
                  <div className="info-value">2026-07-21 10:15:32</div>
                </div>
              </div>

              {/* Participating agents */}
              <div className="ac-detail-section-label">参与 Agent</div>
              <div>
                {MOCK_PARTICIPANTS.map((agent) => {
                  const Icon = agent.icon;
                  return (
                    <div key={agent.name} className="ac-agent-item">
                      <div className="ac-agent-avatar"><Icon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} /></div>
                      <div>
                        <div className="ac-agent-name">{agent.name}</div>
                        <div className="ac-agent-role">{agent.role}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Message timeline */}
              <div className="ac-detail-section-label">消息时间线</div>
              <div className="ac-timeline">
                {MOCK_MESSAGES.map((msg, i) => (
                  <div key={i} className={`ac-msg-row msg-${msg.side}`}>
                    <div className={`ac-msg-bubble ac-msg-bubble-${msg.side}`}>
                      <div className="ac-msg-meta">
                        {msg.side === 'left' && <span className="ac-msg-sender">{msg.sender}</span>}
                        <span className="ac-msg-time">{msg.time}</span>
                        {msg.side === 'right' && <span className="ac-msg-sender">{msg.sender}</span>}
                      </div>
                      <div className="msg-content">{msg.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
