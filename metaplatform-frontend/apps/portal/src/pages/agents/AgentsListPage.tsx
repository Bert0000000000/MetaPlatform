import { useNavigate, useLocation } from 'react-router-dom';
import {
  Headphones, FileCheck, BarChart3, PenTool, BookOpen, ShieldCheck,
  Code, TrendingUp, Plus, Search, Eye, Pencil, Pause, Trash2,
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

// MOCK: 列表展示数据（基于 MOCK_AGENTS 扩展设计稿字段）
interface AgentRow {
  id: string;
  name: string;
  icon: typeof Headphones;
  type: string;
  typeBadge: string;
  status: string;
  statusBadge: string;
  tasks: number;
  successRate: string;
  lastActive: string;
}

const MOCK_AGENT_ROWS: AgentRow[] = [
  { id: 'a1', name: '客服助手', icon: Headphones, type: '对话型', typeBadge: 'v-badge v-badge-info', status: '在线', statusBadge: 'v-badge v-badge-success', tasks: 234, successRate: '98.7%', lastActive: '2 分钟前' },
  { id: 'a2', name: '合同审核员', icon: FileCheck, type: '审核型', typeBadge: 'v-badge v-badge-purple', status: '在线', statusBadge: 'v-badge v-badge-success', tasks: 89, successRate: '95.5%', lastActive: '15 分钟前' },
  { id: 'a3', name: '数据分析师', icon: BarChart3, type: '分析型', typeBadge: 'v-badge v-badge-cyan', status: '暂停', statusBadge: 'v-badge v-badge-warning', tasks: 156, successRate: '92.3%', lastActive: '2 小时前' },
  { id: 'a4', name: '营销文案', icon: PenTool, type: '生成型', typeBadge: 'v-badge v-badge-orange', status: '在线', statusBadge: 'v-badge v-badge-success', tasks: 312, successRate: '99.1%', lastActive: '刚刚' },
  { id: 'a5', name: '知识库管理员', icon: BookOpen, type: '管理型', typeBadge: 'v-badge v-badge-neutral', status: '在线', statusBadge: 'v-badge v-badge-success', tasks: 78, successRate: '100%', lastActive: '30 分钟前' },
  { id: 'a6', name: '安全巡检员', icon: ShieldCheck, type: '审核型', typeBadge: 'v-badge v-badge-purple', status: '错误', statusBadge: 'v-badge v-badge-error', tasks: 45, successRate: '88.9%', lastActive: '1 小时前' },
  { id: 'a7', name: '代码审查员', icon: Code, type: '审核型', typeBadge: 'v-badge v-badge-purple', status: '在线', statusBadge: 'v-badge v-badge-success', tasks: 198, successRate: '96.4%', lastActive: '5 分钟前' },
  { id: 'a8', name: '市场趋势分析师', icon: TrendingUp, type: '分析型', typeBadge: 'v-badge v-badge-cyan', status: '暂停', statusBadge: 'v-badge v-badge-warning', tasks: 67, successRate: '94.1%', lastActive: '昨天' },
];

// MOCK: 快速创建模板
const MOCK_TEMPLATES = [
  { icon: Plus, title: '空白模板', desc: '从零开始自定义' },
  { icon: Headphones, title: '客服助手', desc: '智能客服对话' },
  { icon: FileCheck, title: '审核助手', desc: '文档合同审核' },
  { icon: BarChart3, title: '分析助手', desc: '数据报告分析' },
];

export default function AgentsListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .al-stats-row { display: flex; gap: 16px; margin-bottom: 24px; }
        .al-stat-card { flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; }
        .al-stat-value { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
        .al-stat-label { font-size: 12px; color: var(--muted-foreground); margin-top: 4px; }
        .al-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .al-search-box { display: flex; align-items: center; gap: 8px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); padding: 0 12px; }
        .al-search-box input { background: transparent; border: none; color: var(--foreground); font-size: 13px; padding: 8px 0; outline: none; font-family: inherit; width: 200px; }
        .al-search-box input::placeholder { color: var(--muted-foreground); }
        .al-type-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 12px; outline: none; font-family: inherit; appearance: none; cursor: pointer; }
        .al-worker-name { display: flex; align-items: center; gap: 10px; }
        .al-agent-link { color: var(--foreground); text-decoration: none; cursor: pointer; }
        .al-agent-link:hover { text-decoration: underline; }
        .al-actions-cell { display: flex; gap: 4px; }
        .al-v-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: var(--radius); background: transparent; color: var(--foreground); border: 1px solid var(--border); cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 4px; transition: background .15s; }
        .al-v-btn-sm:hover { background: var(--muted); }
        .al-quick-create-section { margin-top: 24px; }
        .al-quick-create-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
        .al-quick-create-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .al-template-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; cursor: pointer; transition: background .15s; text-align: center; }
        .al-template-card:hover { background: var(--muted); }
        .al-template-icon { width: 40px; height: 40px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: var(--muted-foreground); }
        .al-template-title { font-size: 13px; font-weight: 500; color: var(--foreground); margin-bottom: 2px; }
        .al-template-desc { font-size: 11px; color: var(--muted-foreground); }
      `}</style>

      {/* Page Header */}
      {/* Stats */}
      <div className="al-stats-row">
        <div className="al-stat-card">
          <div className="al-stat-value">{MOCK_AGENTS.length + 6}</div>
          <div className="al-stat-label">总数</div>
        </div>
        <div className="al-stat-card">
          <div className="al-stat-value" style={{ color: 'var(--success)' }}>8</div>
          <div className="al-stat-label">在线</div>
        </div>
        <div className="al-stat-card">
          <div className="al-stat-value" style={{ color: 'var(--warning)' }}>3</div>
          <div className="al-stat-label">暂停</div>
        </div>
        <div className="al-stat-card">
          <div className="al-stat-value" style={{ color: 'var(--destructive)' }}>1</div>
          <div className="al-stat-label">错误</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="al-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <span className="v-tab active" style={{ cursor: 'pointer' }}>全部</span>
            <span className="v-tab" style={{ cursor: 'pointer' }}>在线</span>
            <span className="v-tab" style={{ cursor: 'pointer' }}>暂停</span>
            <span className="v-tab" style={{ cursor: 'pointer' }}>错误</span>
          </div>
          <select className="al-type-select">
            <option value="">全部类型</option>
            <option>对话型</option>
            <option>审核型</option>
            <option>分析型</option>
            <option>生成型</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="al-search-box">
            <Search style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
            <input type="text" placeholder="搜索数字员工..." />
          </div>
          <button className="v-btn-primary"><Plus style={{ width: 16, height: 16 }} />创建数字员工</button>
        </div>
      </div>

      {/* Table */}
      <table className="v-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>状态</th>
            <th>已完成任务</th>
            <th>成功率</th>
            <th>最近活跃</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_AGENT_ROWS.map((agent) => {
            const Icon = agent.icon;
            return (
              <tr key={agent.id}>
                <td>
                  <div className="al-worker-name">
                    <Icon style={{ width: 18, height: 18, color: 'var(--muted-foreground)' }} />
                    <a className="al-agent-link" onClick={() => navigate('/agents/detail')}>{agent.name}</a>
                  </div>
                </td>
                <td><span className={agent.typeBadge}>{agent.type}</span></td>
                <td><span className={agent.statusBadge}>{agent.status}</span></td>
                <td>{agent.tasks}</td>
                <td>{agent.successRate}</td>
                <td><span className="v-meta">{agent.lastActive}</span></td>
                <td>
                  <div className="al-actions-cell">
                    <button className="al-v-btn-sm" title="查看" onClick={() => navigate('/agents/detail')}><Eye style={{ width: 13, height: 13 }} /></button>
                    <button className="al-v-btn-sm" title="编辑"><Pencil style={{ width: 13, height: 13 }} /></button>
                    <button className="al-v-btn-sm" title="暂停"><Pause style={{ width: 13, height: 13 }} /></button>
                    <button className="al-v-btn-sm" title="删除"><Trash2 style={{ width: 13, height: 13 }} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Quick create section */}
      <div className="al-quick-create-section">
        <h3>快速创建</h3>
        <div className="al-quick-create-grid">
          {MOCK_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div key={tpl.title} className="al-template-card">
                <div className="al-template-icon"><Icon style={{ width: 20, height: 20 }} /></div>
                <div className="al-template-title">{tpl.title}</div>
                <div className="al-template-desc">{tpl.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
