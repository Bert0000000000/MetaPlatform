import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Headphones, FileCheck, BarChart3, PenTool, BookOpen, ShieldCheck,
  Code, TrendingUp, Plus, Search, Eye, Pencil, Pause, Trash2,
} from 'lucide-react';
import { SubTabs, type SubTabItem, StepDrawer, Field, TextInput, TextArea, Select, FormSection } from '@mate/shared';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
          <button className="v-btn-primary" onClick={() => setDrawerOpen(true)}><Plus style={{ width: 16, height: 16 }} />创建数字员工</button>
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
    </div>
  );
}
