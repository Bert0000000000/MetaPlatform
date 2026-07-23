import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Plus, Eye, CheckCheck, FileText, Check, X, Pencil,
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

// MOCK: 提炼任务列表
const MOCK_TASKS = [
  { id: 'KT-20260721-001', doc: '退款流程FAQ v3.2', typeBadge: 'v-badge-info', type: 'FAQ生成', statusBadge: 'v-badge-success', status: '已完成', items: '32', accuracy: '96.8%', time: '2026-07-21 16:30' },
  { id: 'KT-20260721-002', doc: '产品功能常见问题汇总', typeBadge: 'v-badge-purple', type: '实体抽取', statusBadge: 'v-badge-success', status: '已完成', items: '45', accuracy: '94.1%', time: '2026-07-21 14:12' },
  { id: 'KT-20260722-003', doc: '会员权益说明 2026版', typeBadge: 'v-badge-warning', type: '规则提炼', statusBadge: 'v-badge-warning', status: '进行中', items: '--', accuracy: '--', time: '2026-07-22 10:05' },
  { id: 'KT-20260722-004', doc: '物流查询与配送政策', typeBadge: 'v-badge-purple', type: '关系抽取', statusBadge: 'v-badge-neutral', status: '待审核', items: '18', accuracy: '91.7%', time: '2026-07-22 09:30' },
  { id: 'KT-20260722-005', doc: '售后维修服务条款', typeBadge: 'v-badge-info', type: 'FAQ生成', statusBadge: 'v-badge-error', status: '失败', items: '0', accuracy: '--', time: '2026-07-22 08:45' },
  { id: 'KT-20260722-006', doc: '账户安全与隐私政策', typeBadge: 'v-badge-warning', type: '规则提炼', statusBadge: 'v-badge-success', status: '已完成', items: '28', accuracy: '97.3%', time: '2026-07-21 18:20' },
];

// MOCK: 知识条目预览
const MOCK_KNOWLEDGE_CARDS = [
  { id: 'KT-001', typeBadge: 'v-badge-purple', type: '实体抽取', content: '「退款流程」属于售后业务域的核心流程实体，关联审批节点 3 个、SLA 阈值 2 个。', source: '退款流程FAQ v3.2', confidence: 96, barColor: 'var(--success)' },
  { id: 'KT-002', typeBadge: 'v-badge-purple', type: '关系抽取', content: '「会员等级」与「折扣比例」存在正比关系：等级每升 1 级，基础折扣增加 5%，最高上限 30%。', source: '会员权益说明 2026版', confidence: 92, barColor: 'var(--success)' },
  { id: 'KT-003', typeBadge: 'v-badge-warning', type: '规则提炼', content: '当订单金额大于 500 元且用户会员等级 >= LV3 时，自动触发免运费规则，无需人工审批。', source: '物流查询与配送政策', confidence: 88, barColor: 'var(--warning)' },
  { id: 'KT-004', typeBadge: 'v-badge-info', type: 'FAQ生成', content: 'Q: 如何申请退款？A: 进入订单详情页，点击「申请退款」，选择退款原因并提交，系统将在 1-3 个工作日内处理。', source: '产品功能常见问题汇总', confidence: 97, barColor: 'var(--success)' },
  { id: 'KT-005', typeBadge: 'v-badge-purple', type: '实体抽取', content: '「物流时效」包含标准配送（3-5天）、加急配送（1-2天）、同城闪送（4小时内）三种配送模式。', source: '物流查询与配送政策', confidence: 95, barColor: 'var(--success)' },
  { id: 'KT-006', typeBadge: 'v-badge-warning', type: '规则提炼', content: '账户连续 6 个月无登录记录，系统将自动降级为「休眠账户」，登录需重新验证手机号。', source: '账户安全与隐私政策', confidence: 98, barColor: 'var(--success)' },
];

// MOCK: 审核队列
const MOCK_REVIEWS = [
  { typeBadge: 'v-badge-purple', type: '实体抽取', content: '「七天无理由退货」适用于所有未拆封商品，食品类和定制类商品除外。该规则关联退款流程节点 R-03，SLA 阈值为 72 小时。', source: '售后维修服务条款', confidence: 78 },
  { typeBadge: 'v-badge-warning', type: '规则提炼', content: '用户积分余额低于 100 分时，系统在每月 1 日自动清除积分。积分可用于兑换优惠券，兑换比例 100:1（积分:元）。', source: '会员权益说明 2026版', confidence: 82 },
  { typeBadge: 'v-badge-info', type: 'FAQ生成', content: 'Q: 忘记密码怎么办？A: 点击登录页「忘记密码」，输入注册手机号，获取验证码后重置密码。若手机号已更换，请联系客服人工处理。', source: '账户安全与隐私政策', confidence: 85 },
];

export default function AgentsKnowledgePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({
    sourceType: '文档',
    sourceUri: '',
    description: '',
    agent: '知识库管理员',
    extractDepth: '详细',
    outputFormat: 'JSON',
    targetConcept: '业务对象-订单',
    autoMap: true,
    customMapRules: '',
    reviewer: '',
    autoPublish: false,
    notifyOnPublish: true,
  });
  const update = (key: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .ak-breadcrumb { font-size: 13px; color: var(--muted-foreground); margin-bottom: 12px; }
        .ak-breadcrumb a { color: var(--muted-foreground); text-decoration: none; cursor: pointer; }
        .ak-breadcrumb a:hover { color: var(--foreground); }
        .ak-breadcrumb span { margin: 0 6px; }
        .ak-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .ak-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .ak-stat-label { font-size: 12px; color: var(--muted-foreground); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
        .ak-stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
        .ak-stat-value-sm { font-size: 13px; color: var(--muted-foreground); margin-top: 2px; }
        .ak-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ak-section-title { font-size: 16px; font-weight: 600; }
        .ak-action-btn { padding: 6px 12px; border-radius: var(--radius); border: 1px solid var(--border); background: transparent; color: var(--foreground); font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s; }
        .ak-action-btn:hover { background: var(--muted); }
        .ak-knowledge-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px; }
        .ak-knowledge-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .ak-knowledge-card-header { display: flex; align-items: center; justify-content: space-between; }
        .ak-knowledge-card-content { font-size: 13px; color: var(--foreground); line-height: 1.6; }
        .ak-knowledge-card-meta { display: flex; align-items: center; justify-content: space-between; }
        .ak-confidence-bar-wrap { display: flex; align-items: center; gap: 8px; flex: 1; max-width: 140px; }
        .ak-confidence-bar { flex: 1; height: 4px; background: var(--muted); border-radius: 2px; overflow: hidden; }
        .ak-confidence-bar-fill { height: 100%; border-radius: 2px; }
        .ak-confidence-label { font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
        .ak-review-item { display: flex; align-items: flex-start; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border); }
        .ak-review-item:last-child { border-bottom: none; padding-bottom: 0; }
        .ak-review-item:first-child { padding-top: 0; }
        .ak-review-item-type { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .ak-review-item-content { font-size: 13px; color: var(--foreground); line-height: 1.6; margin-bottom: 8px; }
        .ak-review-item-source { font-size: 12px; color: var(--muted-foreground); display: flex; align-items: center; gap: 6px; }
        .ak-review-item-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .ak-review-btn { padding: 6px 12px; border-radius: var(--radius); border: 1px solid var(--border); background: transparent; color: var(--foreground); font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s, border-color 0.15s; }
        .ak-review-btn:hover { background: var(--muted); }
        .ak-review-btn-approve { border-color: rgba(98,209,120,0.3); color: var(--success); }
        .ak-review-btn-approve:hover { background: var(--success-subtle); }
        .ak-review-btn-reject { border-color: rgba(255,97,102,0.3); color: var(--destructive); }
        .ak-review-btn-reject:hover { background: rgba(255,97,102,0.1); }
        .ak-review-btn-edit { border-color: rgba(96,165,250,0.3); color: #60a5fa; }
        .ak-review-btn-edit:hover { background: rgba(96,165,250,0.1); }
        .ak-font-mono { font-family: var(--font-mono); }
      `}</style>

      {/* Breadcrumb + Header */}
      {/* 1. Stats Cards */}
      <div className="ak-stats-grid">
        <div className="ak-stat-card">
          <span className="ak-stat-label">知识条目</span>
          <span className="ak-stat-value">456</span>
          <span className="ak-stat-value-sm">总量累计</span>
        </div>
        <div className="ak-stat-card">
          <span className="ak-stat-label">已提炼</span>
          <span className="ak-stat-value">389</span>
          <span className="ak-stat-value-sm">完成率 85.3%</span>
        </div>
        <div className="ak-stat-card">
          <span className="ak-stat-label">待审核</span>
          <span className="ak-stat-value">34</span>
          <span className="ak-stat-value-sm">需人工确认</span>
        </div>
        <div className="ak-stat-card">
          <span className="ak-stat-label">质量评分</span>
          <span className="ak-stat-value">94.2</span>
          <span className="ak-stat-value-sm">平均准确率</span>
        </div>
      </div>

      {/* 2. Extraction Task List */}
      <div className="ak-section-header">
        <div>
          <div className="ak-section-title">提炼任务列表</div>
          <span className="v-meta">共 6 个任务</span>
        </div>
        <button className="ak-action-btn" onClick={() => setDrawerOpen(true)}><Plus style={{ width: 14, height: 14 }} />新建提炼任务</button>
      </div>
      <div className="v-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        <table className="v-table" style={{ border: 'none' }}>
          <thead>
            <tr>
              <th style={{ width: 130 }}>任务ID</th>
              <th>来源文档</th>
              <th style={{ width: 110 }}>提炼类型</th>
              <th style={{ width: 90 }}>状态</th>
              <th style={{ width: 100, textAlign: 'right' }}>提取条目数</th>
              <th style={{ width: 80, textAlign: 'right' }}>准确率</th>
              <th style={{ width: 140, textAlign: 'right' }}>时间</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TASKS.map((task) => (
              <tr key={task.id}>
                <td><span className="ak-font-mono" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{task.id}</span></td>
                <td>{task.doc}</td>
                <td><span className={`v-badge ${task.typeBadge}`}>{task.type}</span></td>
                <td><span className={`v-badge ${task.statusBadge}`}>{task.status}</span></td>
                <td style={{ textAlign: 'right' }}>{task.items}</td>
                <td style={{ textAlign: 'right' }}>{task.accuracy}</td>
                <td style={{ textAlign: 'right' }}><span className="v-meta">{task.time}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Knowledge Item Preview */}
      <div className="ak-section-header">
        <div>
          <div className="ak-section-title">知识条目预览</div>
          <span className="v-meta">最近提炼的条目</span>
        </div>
        <button className="ak-action-btn"><Eye style={{ width: 14, height: 14 }} />查看全部</button>
      </div>
      <div className="ak-knowledge-grid">
        {MOCK_KNOWLEDGE_CARDS.map((card) => (
          <div key={card.id} className="ak-knowledge-card">
            <div className="ak-knowledge-card-header">
              <span className={`v-badge ${card.typeBadge}`}>{card.type}</span>
              <span className="v-meta" style={{ fontSize: 11 }}>{card.id}</span>
            </div>
            <div className="ak-knowledge-card-content">{card.content}</div>
            <div className="ak-knowledge-card-meta">
              <span className="v-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText style={{ width: 12, height: 12 }} />{card.source}
              </span>
              <div className="ak-confidence-bar-wrap">
                <div className="ak-confidence-bar">
                  <div className="ak-confidence-bar-fill" style={{ width: `${card.confidence}%`, background: card.barColor }} />
                </div>
                <span className="ak-confidence-label">{card.confidence}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Review Queue */}
      <div className="ak-section-header">
        <div>
          <div className="ak-section-title">审核队列</div>
          <span className="v-meta">3 条待审核</span>
        </div>
        <button className="ak-action-btn"><CheckCheck style={{ width: 14, height: 14 }} />批量批准</button>
      </div>
      <div className="v-card" style={{ marginBottom: 28 }}>
        {MOCK_REVIEWS.map((review, i) => (
          <div key={i} className="ak-review-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ak-review-item-type"><span className={`v-badge ${review.typeBadge}`}>{review.type}</span></div>
              <div className="ak-review-item-content">{review.content}</div>
              <div className="ak-review-item-source">
                <FileText style={{ width: 12, height: 12 }} />{review.source} · 置信度 {review.confidence}%
              </div>
            </div>
            <div className="ak-review-item-actions">
              <button className="ak-review-btn ak-review-btn-approve"><Check style={{ width: 14, height: 14 }} />批准</button>
              <button className="ak-review-btn ak-review-btn-reject"><X style={{ width: 14, height: 14 }} />拒绝</button>
              <button className="ak-review-btn ak-review-btn-edit"><Pencil style={{ width: 14, height: 14 }} />修改</button>
            </div>
          </div>
        ))}
      </div>

      <StepDrawer
        open={drawerOpen}
        title="新建提炼任务"
        steps={[
          {
            title: '选择源',
            description: '指定知识提炼的来源',
            content: (
              <>
                <Field label="来源类型">
                  <Select value={form.sourceType} onChange={(e) => update('sourceType', e.target.value)}>
                    <option value="文档">文档</option>
                    <option value="网页">网页</option>
                    <option value="数据库">数据库</option>
                    <option value="Ontology">Ontology</option>
                  </Select>
                </Field>
                <Field label="源文件 / URL">
                  <TextArea
                    placeholder={form.sourceType === '网页' ? '请粘贴 URL，多个用换行分隔' : '请输入源文件路径或标识，多个用换行分隔'}
                    rows={4}
                    value={form.sourceUri}
                    onChange={(e) => update('sourceUri', e.target.value)}
                  />
                </Field>
                <Field label="描述">
                  <TextArea placeholder="请输入任务描述" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
                </Field>
              </>
            ),
          },
          {
            title: '选择数字员工',
            description: '指定执行提炼任务的员工与输出',
            content: (
              <>
                <Field label="选择员工">
                  <Select value={form.agent} onChange={(e) => update('agent', e.target.value)}>
                    <option value="知识库管理员">知识库管理员</option>
                    <option value="合同审核员">合同审核员</option>
                    <option value="客服助手">客服助手</option>
                    <option value="数据分析师">数据分析师</option>
                    <option value="代码审查员">代码审查员</option>
                  </Select>
                </Field>
                <Field label="提炼深度">
                  <Select value={form.extractDepth} onChange={(e) => update('extractDepth', e.target.value)}>
                    <option value="摘要">摘要</option>
                    <option value="详细">详细</option>
                    <option value="深度">深度</option>
                  </Select>
                </Field>
                <Field label="输出格式">
                  <Select value={form.outputFormat} onChange={(e) => update('outputFormat', e.target.value)}>
                    <option value="JSON">JSON</option>
                    <option value="Markdown">Markdown</option>
                    <option value="表格">表格</option>
                  </Select>
                </Field>
              </>
            ),
          },
          {
            title: 'Ontology 映射',
            description: '配置提炼结果到本体的映射',
            content: (
              <>
                <Field label="目标概念">
                  <Select value={form.targetConcept} onChange={(e) => update('targetConcept', e.target.value)}>
                    <option value="业务对象-订单">业务对象-订单</option>
                    <option value="业务对象-客户">业务对象-客户</option>
                    <option value="业务对象-产品">业务对象-产品</option>
                    <option value="业务对象-合同">业务对象-合同</option>
                    <option value="业务对象-员工">业务对象-员工</option>
                  </Select>
                </Field>
                <Field label="自动映射">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.autoMap}
                      onChange={(e) => update('autoMap', e.target.checked)}
                      style={{ accentColor: '#60a5fa' }}
                    />
                    启用自动映射（基于本体引擎推荐）
                  </label>
                </Field>
                <Field label="自定义映射规则">
                  <TextArea
                    placeholder="如 source_field -> target_field 的 YAML / JSON 规则"
                    rows={5}
                    value={form.customMapRules}
                    onChange={(e) => update('customMapRules', e.target.value)}
                  />
                </Field>
              </>
            ),
          },
          {
            title: '审核与发布',
            description: '配置审核与发布策略',
            content: (
              <FormSection title="审核与发布确认" desc="请确认审核人与发布策略，点击「完成」按钮提交任务。">
                <Field label="审核人">
                  <TextInput placeholder="请输入审核人姓名" value={form.reviewer} onChange={(e) => update('reviewer', e.target.value)} />
                </Field>
                <Field label="自动发布">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.autoPublish}
                      onChange={(e) => update('autoPublish', e.target.checked)}
                      style={{ accentColor: '#60a5fa' }}
                    />
                    审核通过后自动发布至知识库
                  </label>
                </Field>
                <Field label="发布后通知">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.notifyOnPublish}
                      onChange={(e) => update('notifyOnPublish', e.target.checked)}
                      style={{ accentColor: '#60a5fa' }}
                    />
                    发布后通过飞书通知相关成员
                  </label>
                </Field>
                <div style={{ marginTop: 16, padding: 12, background: 'var(--muted)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                  <div>来源类型：{form.sourceType}</div>
                  <div>执行员工：{form.agent}</div>
                  <div>提炼深度：{form.extractDepth} · 输出格式：{form.outputFormat}</div>
                  <div>目标概念：{form.targetConcept}</div>
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
