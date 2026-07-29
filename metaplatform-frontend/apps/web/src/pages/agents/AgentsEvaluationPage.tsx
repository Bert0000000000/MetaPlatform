import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar, Play, Filter, Download, Share2,
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

// MOCK: 概览统计
const MOCK_STATS = [
  { eyebrow: '总评估次数', value: '156', meta: '累计评估记录', accent: false, warning: false },
  { eyebrow: '平均得分', value: '87.3', meta: '百分制', accent: true, warning: false },
  { eyebrow: '通过率', value: '92.3%', meta: '>= 80 分通过', accent: true, warning: false },
  { eyebrow: '待改进', value: '12', meta: '评分 < 70', accent: false, warning: true },
  { eyebrow: '优秀率', value: '45.2%', meta: '>= 95 分', accent: true, warning: false },
];

// MOCK: 核心指标
const MOCK_METRICS = [
  { name: '准确性', barClass: 'bar-high', barWidth: '92%', scoreClass: 'score-high', score: '92' },
  { name: '响应速度', barClass: 'bar-mid', barWidth: '85%', scoreClass: 'score-mid', score: '85' },
  { name: '任务完成率', barClass: 'bar-high', barWidth: '96%', scoreClass: 'score-high', score: '96' },
  { name: '上下文理解', barClass: 'bar-mid', barWidth: '88%', scoreClass: 'score-mid', score: '88' },
  { name: '异常处理', barClass: 'bar-low', barWidth: '78%', scoreClass: 'score-low', score: '78' },
  { name: '成本效率', barClass: 'bar-low', barWidth: '82%', scoreClass: 'score-low', score: '82' },
];

// MOCK: 评估历史
const MOCK_EVAL_HISTORY = [
  { time: '2026-07-21 14:30', typeBadge: 'badge-success', type: '自动', score: '87.0', accuracy: '92%', response: '1.2s', evaluator: '系统', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-20 10:15', typeBadge: 'badge-mixed', type: '混合', score: '91.5', accuracy: '95%', response: '1.0s', evaluator: '张工', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-19 16:42', typeBadge: 'badge-success', type: '自动', score: '89.2', accuracy: '93%', response: '1.1s', evaluator: '系统', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-18 09:00', typeBadge: 'badge-info', type: '人工', score: '85.8', accuracy: '90%', response: '1.3s', evaluator: '李主管', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-17 11:20', typeBadge: 'badge-success', type: '自动', score: '93.1', accuracy: '96%', response: '0.9s', evaluator: '系统', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-16 15:55', typeBadge: 'badge-warning', type: '人工', score: '67.4', accuracy: '72%', response: '2.1s', evaluator: '王工', statusBadge: 'badge-destructive', status: '未通过' },
  { time: '2026-07-15 08:30', typeBadge: 'badge-success', type: '自动', score: '88.6', accuracy: '91%', response: '1.2s', evaluator: '系统', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-14 13:10', typeBadge: 'badge-mixed', type: '混合', score: '90.3', accuracy: '94%', response: '1.1s', evaluator: '张工', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-13 17:45', typeBadge: 'badge-success', type: '自动', score: '82.0', accuracy: '86%', response: '1.5s', evaluator: '系统', statusBadge: 'badge-success', status: '通过' },
  { time: '2026-07-12 10:00', typeBadge: 'badge-info', type: '人工', score: '78.5', accuracy: '83%', response: '1.8s', evaluator: '李主管', statusBadge: 'badge-warning', status: '待改进' },
];

// MOCK: 发现问题
const MOCK_ISSUES = [
  { severity: 'critical', label: '严重', text: '高频场景下偶现回复内容与用户意图不匹配，误判率约 3.2%' },
  { severity: 'warning', label: '警告', text: '多轮对话超过 8 轮后，上下文遗忘导致重复提问' },
  { severity: 'warning', label: '警告', text: '异常输入（乱码/SQL注入尝试）未触发安全拦截兜底' },
  { severity: 'info', label: '提示', text: '凌晨低峰期响应延迟波动较大（P99 > 2s）' },
];

// MOCK: 改进建议
const MOCK_SUGGESTIONS = [
  { priority: 'high', tag: 'P0', text: '接入 Ontology 意图图谱增强多轮对话的语义连续性，降低误判' },
  { priority: 'medium', tag: 'P1', text: '增加输入安全过滤层，对异常字符与注入模式做前置校验' },
  { priority: 'low', tag: 'P2', text: '优化低峰期资源调度策略，启用按需缩容减少资源竞争' },
];

// MOCK: 趋势柱状图数据
const MOCK_TREND_BARS = [
  { value: '78.5', height: '47%', opacity: 0.7, label: '7/12', isFail: false },
  { value: '82.0', height: '55%', opacity: 0.75, label: '7/13', isFail: false },
  { value: '90.3', height: '76%', opacity: 0.85, label: '7/14', isFail: false },
  { value: '88.6', height: '72%', opacity: 0.85, label: '7/15', isFail: false },
  { value: '67.4', height: '18%', opacity: 0.8, label: '7/16', isFail: true },
  { value: '93.1', height: '83%', opacity: 0.9, label: '7/17', isFail: false },
  { value: '85.8', height: '65%', opacity: 0.85, label: '7/18', isFail: false },
  { value: '89.2', height: '73%', opacity: 0.85, label: '7/19', isFail: false },
  { value: '91.5', height: '79%', opacity: 0.9, label: '7/20', isFail: false },
  { value: '87.0', height: '68%', opacity: 0.85, label: '7/21', isFail: false },
];

const severityDotClass: Record<string, string> = {
  critical: 'ae-severity-critical',
  warning: 'ae-severity-warning',
  info: 'ae-severity-info',
  low: 'ae-severity-low',
};

const issueLabelClass: Record<string, string> = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
  low: 'low',
};

const priorityTagClass: Record<string, string> = {
  high: 'ae-priority-high',
  medium: 'ae-priority-medium',
  low: 'ae-priority-low',
};

export default function AgentsEvaluationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .ae-breadcrumb { font-size: 13px; color: var(--muted-foreground); margin-bottom: 12px; }
        .ae-breadcrumb a { color: var(--muted-foreground); text-decoration: none; cursor: pointer; }
        .ae-breadcrumb a:hover { color: var(--foreground); }
        .ae-breadcrumb span { margin: 0 6px; }
        .ae-stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
        .ae-stat-card { padding: 16px 20px; }
        .ae-stat-card .v-eyebrow { margin-bottom: 6px; }
        .ae-stat-card .v-value { margin-bottom: 2px; }
        .ae-stat-value-accent { color: var(--success); }
        .ae-stat-value-warning { color: var(--warning); }
        .ae-selector-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .ae-selector-actions { margin-left: auto; display: flex; gap: 8px; }
        .ae-v-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 32px 8px 12px; outline: none; font-family: inherit; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; min-width: 180px; }
        .ae-content-layout { display: flex; gap: 16px; margin-bottom: 24px; }
        .ae-content-left { flex: 1; min-width: 0; }
        .ae-content-right { width: 320px; flex-shrink: 0; }
        .ae-metrics-panel { margin-bottom: 24px; }
        .ae-metrics-panel .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ae-metrics-panel .panel-title { font-size: 15px; font-weight: 600; }
        .ae-metrics-panel .panel-subtitle { font-size: 12px; color: var(--muted-foreground); margin-top: 2px; }
        .ae-metrics-total { font-size: 13px; color: var(--muted-foreground); }
        .ae-metrics-total strong { color: var(--foreground); font-weight: 600; }
        .ae-metric-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .ae-metric-row:last-child { border-bottom: none; }
        .ae-metric-name { width: 100px; font-size: 13px; font-weight: 500; flex-shrink: 0; }
        .ae-metric-bar-wrap { flex: 1; height: 8px; background: var(--muted); border-radius: 4px; overflow: hidden; position: relative; }
        .ae-metric-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .ae-metric-bar.bar-high { background: var(--success); }
        .ae-metric-bar.bar-mid { background: #60a5fa; }
        .ae-metric-bar.bar-low { background: var(--warning); }
        .ae-metric-score { width: 48px; text-align: right; font-size: 14px; font-weight: 600; font-family: var(--font-mono); }
        .ae-metric-score.score-high { color: var(--success); }
        .ae-metric-score.score-mid { color: #60a5fa; }
        .ae-metric-score.score-low { color: var(--warning); }
        .ae-eval-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ae-eval-table thead th { text-align: left; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ae-eval-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ae-eval-table tbody tr:hover { background: var(--muted); }
        .ae-eval-table .score-cell { font-weight: 600; font-family: var(--font-mono); }
        .ae-eval-table .rate-cell { font-family: var(--font-mono); }
        .ae-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; }
        .ae-badge-success { background: var(--success-subtle); color: var(--success); }
        .ae-badge-warning { background: var(--warning-subtle); color: var(--warning); }
        .ae-badge-destructive { background: rgba(255,97,102,0.15); color: var(--destructive); }
        .ae-badge-info { background: rgba(96,165,250,0.12); color: #60a5fa; }
        .ae-badge-mixed { background: rgba(96,165,250,0.12); color: #60a5fa; }
        .ae-report-panel { position: sticky; top: 32px; }
        .ae-report-panel .panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .ae-report-panel .panel-title { font-size: 14px; font-weight: 600; }
        .ae-report-panel .panel-date { font-size: 11px; color: var(--muted-foreground); }
        .ae-report-section { margin-bottom: 16px; }
        .ae-report-section-title { font-size: 12px; font-weight: 600; color: var(--muted-foreground); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
        .ae-report-summary { font-size: 13px; line-height: 1.6; color: var(--foreground); }
        .ae-issue-item { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
        .ae-issue-item:last-child { border-bottom: none; }
        .ae-severity-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-top: 6px; flex-shrink: 0; }
        .ae-severity-critical { background: var(--destructive); }
        .ae-severity-warning { background: var(--warning); }
        .ae-severity-info { background: #60a5fa; }
        .ae-severity-low { background: var(--muted-foreground); }
        .ae-issue-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .ae-issue-label.critical { color: var(--destructive); }
        .ae-issue-label.warning { color: var(--warning); }
        .ae-issue-label.info { color: #60a5fa; }
        .ae-issue-label.low { color: var(--muted-foreground); }
        .ae-issue-text { flex: 1; line-height: 1.5; color: var(--foreground); }
        .ae-suggestion-item { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
        .ae-suggestion-item:last-child { border-bottom: none; }
        .ae-priority-tag { display: inline-flex; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .ae-priority-high { background: rgba(255,97,102,0.15); color: var(--destructive); }
        .ae-priority-medium { background: var(--warning-subtle); color: var(--warning); }
        .ae-priority-low { background: var(--muted); color: var(--muted-foreground); }
        .ae-suggestion-text { flex: 1; line-height: 1.5; color: var(--foreground); }
        .ae-report-actions { margin-top: 16px; display: flex; gap: 8px; }
        .ae-report-actions .v-btn-primary,
        .ae-report-actions .v-btn { flex: 1; justify-content: center; font-size: 12px; height: 32px; }
        .ae-trend-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ae-trend-title { font-size: 15px; font-weight: 600; }
        .ae-trend-legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted-foreground); }
        .ae-trend-legend-item { display: flex; align-items: center; gap: 4px; }
        .ae-trend-legend-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
        .ae-bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 180px; padding-top: 20px; position: relative; }
        .ae-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
        .ae-bar-fill { width: 100%; max-width: 40px; border-radius: 3px 3px 0 0; transition: height 0.5s ease; }
        .ae-bar-fill.bar-score { background: var(--primary); }
        .ae-bar-label { font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); }
        .ae-bar-value { font-size: 11px; font-weight: 600; color: var(--foreground); font-family: var(--font-mono); margin-bottom: 2px; }
        .ae-chart-container { position: relative; height: 220px; padding-left: 32px; }
      `}</style>

      {/* Breadcrumb + Header */}
      {/* 1. Overview Stats Cards */}
      <div className="ae-stats-grid">
        {MOCK_STATS.map((stat) => (
          <div key={stat.eyebrow} className="v-card ae-stat-card">
            <div className="v-eyebrow">{stat.eyebrow}</div>
            <div className={`v-value ${stat.accent ? 'ae-stat-value-accent' : ''} ${stat.warning ? 'ae-stat-value-warning' : ''}`}>{stat.value}</div>
            <div className="v-meta">{stat.meta}</div>
          </div>
        ))}
      </div>

      {/* 2. Agent Selector Bar */}
      <div className="ae-selector-bar">
        <span className="v-eyebrow">选择 Agent</span>
        <select className="ae-v-select">
          <option>客服小助手</option>
          <option>数据质量巡检员</option>
          <option>合同审核员</option>
          <option>财务报表分析师</option>
          <option>运维告警处理员</option>
          <option>代码审查助手</option>
        </select>
        <div className="ae-selector-actions">
          <button className="v-btn"><Calendar style={{ width: 14, height: 14 }} /> 2026-07-15 至 2026-07-21</button>
          <button className="v-btn-primary"><Play style={{ width: 14, height: 14 }} /> 发起评估</button>
        </div>
      </div>

      {/* Content Layout: Left + Right */}
      <div className="ae-content-layout">
        {/* Left Column */}
        <div className="ae-content-left">
          {/* 3. Core Metrics Panel */}
          <div className="v-card ae-metrics-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">核心指标评分</div>
                <div className="panel-subtitle">最近一次综合评估 · 客服小助手</div>
              </div>
              <div className="ae-metrics-total">综合总分 <strong>87.0</strong> / 100</div>
            </div>
            {MOCK_METRICS.map((metric) => (
              <div key={metric.name} className="ae-metric-row">
                <div className="ae-metric-name">{metric.name}</div>
                <div className="ae-metric-bar-wrap">
                  <div className={`ae-metric-bar ${metric.barClass}`} style={{ width: metric.barWidth }} />
                </div>
                <div className={`ae-metric-score ${metric.scoreClass}`}>{metric.score}</div>
              </div>
            ))}
          </div>

          {/* 4. Evaluation History Table */}
          <div className="v-card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>评估历史</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Filter style={{ width: 12, height: 12 }} /> 筛选</button>
                <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Download style={{ width: 12, height: 12 }} /> 导出</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ae-eval-table">
                <thead>
                  <tr>
                    <th>评估时间</th>
                    <th>评估类型</th>
                    <th>总分</th>
                    <th>准确率</th>
                    <th>响应速度</th>
                    <th>评估人</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_EVAL_HISTORY.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{row.time}</td>
                      <td><span className={`ae-badge ${row.typeBadge}`}>{row.type}</span></td>
                      <td className="score-cell">{row.score}</td>
                      <td className="rate-cell">{row.accuracy}</td>
                      <td className="rate-cell">{row.response}</td>
                      <td>{row.evaluator}</td>
                      <td><span className={`ae-badge ${row.statusBadge}`}>{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Evaluation Report Panel */}
        <div className="ae-content-right">
          <div className="v-card ae-report-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">评估报告摘要</div>
                <div className="panel-date">2026-07-21 14:30 · 第 156 次</div>
              </div>
            </div>

            {/* Summary */}
            <div className="ae-report-section">
              <div className="ae-report-section-title">总评</div>
              <div className="ae-report-summary">
                客服小助手在本周期内综合表现良好，任务完成率与准确性保持较高水平。异常处理维度得分偏低，主要因对多轮复杂对话中的意图切换识别不够稳健，建议优化上下文记忆策略。
              </div>
            </div>

            {/* Issues Found */}
            <div className="ae-report-section">
              <div className="ae-report-section-title">发现问题 (4)</div>
              {MOCK_ISSUES.map((issue, i) => (
                <div key={i} className="ae-issue-item">
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <span className={`ae-severity-dot ${severityDotClass[issue.severity]}`} />
                  </div>
                  <div>
                    <div className={`ae-issue-label ${issueLabelClass[issue.severity]}`}>{issue.label}</div>
                    <div className="ae-issue-text">{issue.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Improvement Suggestions */}
            <div className="ae-report-section">
              <div className="ae-report-section-title">改进建议 (3)</div>
              {MOCK_SUGGESTIONS.map((sug, i) => (
                <div key={i} className="ae-suggestion-item">
                  <div style={{ flexShrink: 0, marginTop: 1 }}>
                    <span className={`ae-priority-tag ${priorityTagClass[sug.priority]}`}>{sug.tag}</span>
                  </div>
                  <div className="ae-suggestion-text">{sug.text}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="ae-report-actions">
              <button className="v-btn-primary"><Download style={{ width: 12, height: 12 }} /> 下载报告</button>
              <button className="v-btn"><Share2 style={{ width: 12, height: 12 }} /> 分享</button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Trend Bar Chart */}
      <div className="v-card">
        <div className="ae-trend-header">
          <div className="ae-trend-title">评估得分趋势</div>
          <div className="ae-trend-legend">
            <span className="ae-trend-legend-item"><span className="ae-trend-legend-dot" style={{ background: 'var(--primary)' }} /> 综合得分</span>
            <span className="ae-trend-legend-item"><span className="ae-trend-legend-dot" style={{ background: 'var(--destructive)', opacity: 0.6 }} /> 通过线 (80)</span>
          </div>
        </div>
        <div className="ae-chart-container">
          {/* Grid lines */}
          <div style={{ position: 'absolute', top: 20, left: 32, right: 0, height: 180 }}>
            <div style={{ position: 'absolute', top: '2%', left: 0, right: 0, borderTop: '1px dashed rgba(255,97,102,0.3)' }} />
            <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.3 }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.3 }} />
            <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.3 }} />
          </div>
          {/* Y-axis labels */}
          <div style={{ position: 'absolute', top: 18, left: 0, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>100</div>
          <div style={{ position: 'absolute', top: '23%', left: 0, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>90</div>
          <div style={{ position: 'absolute', top: '48%', left: 0, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>80</div>
          <div style={{ position: 'absolute', top: '73%', left: 0, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>70</div>
          <div style={{ position: 'absolute', bottom: 18, left: 0, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>60</div>

          <div className="ae-bar-chart" style={{ position: 'relative' }}>
            {MOCK_TREND_BARS.map((bar, i) => (
              <div key={i} className="ae-bar-col">
                <div className="ae-bar-value" style={bar.isFail ? { color: 'var(--destructive)' } : undefined}>{bar.value}</div>
                <div
                  className="ae-bar-fill bar-score"
                  style={{
                    height: bar.height,
                    opacity: bar.opacity,
                    background: bar.isFail ? 'var(--destructive)' : undefined,
                  }}
                />
                <div className="ae-bar-label">{bar.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
