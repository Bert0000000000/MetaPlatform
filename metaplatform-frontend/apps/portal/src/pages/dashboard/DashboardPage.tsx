import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  FileBarChart,
  Bot,
  Sparkles,
  Boxes,
  Database,
  Plug,
  GitBranch,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';
import { MOCK_MY_AGENTS } from '@/mock'; // MOCK

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

// MOCK: recent tasks inline data
const recentTasks = [
  { name: '财务报销审核', typeLabel: '审批', typeClass: 'v-badge-purple', agent: '合同审核员', status: '完成', statusClass: 'v-badge-success', time: '10 分钟前' },
  { name: '客户数据周报生成', typeLabel: '分析', typeClass: 'v-badge-cyan', agent: '数据分析师', status: '进行中', statusClass: 'v-badge-warning', time: '25 分钟前' },
  { name: '安全漏洞扫描', typeLabel: '巡检', typeClass: 'v-badge-blue', agent: '安全巡检员', status: '失败', statusClass: 'v-badge-error', time: '42 分钟前' },
  { name: '营销邮件撰写', typeLabel: '生成', typeClass: 'v-badge-neutral', agent: '营销文案', status: '完成', statusClass: 'v-badge-success', time: '1 小时前' },
  { name: '知识库索引重建', typeLabel: '维护', typeClass: 'v-badge-neutral', agent: '知识库管理员', status: '完成', statusClass: 'v-badge-success', time: '2 小时前' },
  { name: 'PR 代码审查', typeLabel: '审核', typeClass: 'v-badge-purple', agent: '代码审查员', status: '等待中', statusClass: 'v-badge-warning', time: '3 小时前' },
];

// MOCK: system health inline data
const systemHealth = [
  { dotClass: 'health-dot-ok', name: 'LLM Gateway', detail: '响应正常，P99 120ms', status: '正常' },
  { dotClass: 'health-dot-ok', name: 'MCP Registry', detail: '已注册 23 个服务', status: '正常' },
  { dotClass: 'health-dot-warn', name: 'Kafka 消息队列', detail: 'Lag 偏高 (1,204)', status: '告警' },
];

// MOCK: active agents inline data
const activeAgents = [
  { dotClass: 'agent-mini-dot-online', name: '客服助手', type: '对话型', tasks: 23, statusBg: 'var(--success-subtle)', statusColor: 'var(--success)', statusLabel: '在线' },
  { dotClass: 'agent-mini-dot-busy', name: '合同审核员', type: '审核型', tasks: 8, statusBg: 'var(--warning-subtle)', statusColor: 'var(--warning)', statusLabel: '处理中' },
  { dotClass: 'agent-mini-dot-online', name: '营销文案', type: '生成型', tasks: 15, statusBg: 'var(--success-subtle)', statusColor: 'var(--success)', statusLabel: '在线' },
  { dotClass: 'agent-mini-dot-online', name: '代码审查员', type: '审核型', tasks: 6, statusBg: 'var(--success-subtle)', statusColor: 'var(--success)', statusLabel: '在线' },
];

const quickLinks = [
  { icon: Sparkles, label: 'SuperAI' },
  { icon: Boxes, label: '应用中心' },
  { icon: Database, label: '本体引擎' },
  { icon: Plug, label: 'MCP 中心' },
  { icon: Bot, label: '数字员工' },
  { icon: GitBranch, label: '架构中心' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div className="v-page-header">
        <h1 className="v-page-title">工作台</h1>
      </div>

      {/* Welcome card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 24,
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Welcome back, Admin</div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>2026 年 7 月 22 日，星期三</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus style={{ width: 16, height: 16 }} />创建应用
          </button>
          <button className="v-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileBarChart style={{ width: 16, height: 16 }} />查看报告
          </button>
          <button className="v-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => navigate('/dashboard/my-agents')}>
            <Bot style={{ width: 16, height: 16 }} />管理数字员工
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="v-stats-row" style={{ marginBottom: 24 }}>
        <div className="v-stat-card" style={{ cursor: 'pointer' }}>
          <span className="v-stat-label">活跃应用</span>
          <span className="v-stat-value">18</span>
          <span className="v-stat-change">本周 <span className="up">+3</span></span>
        </div>
        <div className="v-stat-card" style={{ cursor: 'pointer' }}>
          <span className="v-stat-label">数字员工在线</span>
          <span className="v-stat-value">
            8<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-foreground)' }}>/12</span>
          </span>
          <span className="v-stat-change">运行中</span>
        </div>
        <div className="v-stat-card" style={{ cursor: 'pointer' }}>
          <span className="v-stat-label">今日任务</span>
          <span className="v-stat-value">234</span>
          <span className="v-stat-change">较昨日 <span className="up">+18%</span></span>
        </div>
        <div className="v-stat-card" style={{ cursor: 'pointer' }}>
          <span className="v-stat-label">待处理审批</span>
          <span className="v-stat-value" style={{ color: 'var(--warning)' }}>5</span>
          <span className="v-stat-change">需要关注</span>
        </div>
      </div>

      {/* Two column grid */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Left: Recent tasks table */}
        <div style={{ flex: 3 }}>
          <div className="v-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>最近任务</div>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer' }}>查看全部</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>任务名</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>类型</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>数字员工</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>状态</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${t.typeClass}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.typeLabel}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{t.agent}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${t.statusClass}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.status}</span>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="v-meta">{t.time}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: System status + Quick links */}
        <div style={{ flex: 2 }}>
          <div className="v-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>系统状态</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
              {systemHealth.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 4 }}>
                  <div className={h.dotClass} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: h.dotClass === 'health-dot-ok' ? 'var(--success)' : 'var(--warning)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{h.detail}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{h.status}</div>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>快捷入口</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {quickLinks.map((q, i) => {
                const Icon = q.icon;
                return (
                  <a key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 8px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', textDecoration: 'none', color: 'var(--foreground)' }}>
                    <Icon style={{ width: 20, height: 20, color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>{q.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Active agents */}
      <div className="v-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>活跃数字员工</div>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer' }}>管理</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {activeAgents.map((a, i) => (
            <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: a.dotClass === 'agent-mini-dot-online' ? 'var(--success)' : 'var(--warning)' }} />
                <div style={{ fontSize: 13, fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{a.type}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{a.tasks} 任务</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: a.statusBg, color: a.statusColor }}>{a.statusLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
