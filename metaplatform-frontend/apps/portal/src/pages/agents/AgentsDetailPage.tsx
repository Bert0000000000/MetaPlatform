import { useNavigate, useLocation } from 'react-router-dom';
import {
  ScanSearch, CircleDot, Pencil, Play, History, Power,
  TrendingUp, TrendingDown, Minus, Settings2, Workflow,
  Wrench, Code2, Copy, Download, ChevronRight, Search,
  FileSearch, Database, BarChart3, Send, ScrollText,
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

// MOCK: KPI 卡片数据
const MOCK_KPIS = [
  { eyebrow: '本月执行', value: '342', unit: '次', trend: 'up', trendIcon: TrendingUp, trendText: '+12%', trendLabel: '较上月' },
  { eyebrow: '成功率', value: '97.1', unit: '%', trend: 'up', trendIcon: TrendingUp, trendText: '+0.3%', trendLabel: '较上月' },
  { eyebrow: '平均耗时', value: '2.8', unit: 's', trend: 'down', trendIcon: TrendingDown, trendText: '-0.4s', trendLabel: '较上月' },
  { eyebrow: 'Token 消耗', value: '128.5', unit: 'K', trend: 'flat', trendIcon: Minus, trendText: '持平', trendLabel: '较上月' },
];

// MOCK: 配置信息
const MOCK_CONFIG = [
  { label: 'Agent ID', value: 'agent-dq-inspector-01', mono: true },
  { label: '模型', value: 'doubao-pro-32k' },
  { label: 'Temperature', value: '0.3' },
  { label: 'Max Tokens', value: '4,096' },
  { label: '创建者', value: '张三' },
  { label: '创建时间', value: '2026-05-10 14:30:00' },
  { label: '编排模式', value: 'badge-info', badgeText: 'Graph Core' },
  { label: '调度方式', value: 'badge-neutral', badgeText: 'Cron', extra: '0 8 * * *' },
];

// MOCK: 编排流程节点
const MOCK_FLOW_NODES = [
  { type: 'input', typeLabel: 'Input', name: '输入解析' },
  { type: 'tool', typeLabel: 'Tool', name: 'RAG 检索' },
  { type: 'action', typeLabel: 'Action', name: '数据校验' },
  { type: 'tool', typeLabel: 'Tool', name: '质量评分' },
  { type: 'action', typeLabel: 'Action', name: '报告生成' },
  { type: 'output', typeLabel: 'Output', name: '通知推送' },
];

// MOCK: 工具列表
const MOCK_TOOLS = [
  { icon: Search, name: 'ontology_query', desc: '查询本体引擎中的实体定义与关系，获取数据质量规则配置', source: 'MCP Server: mate-ont-server' },
  { icon: FileSearch, name: 'rag_retrieve', desc: '从 RAG 知识库中检索历史质量报告、异常模式与修复方案', source: 'MCP Server: mate-rag-server' },
  { icon: Database, name: 'data_profile_query', desc: '执行数据源 Profile 查询，获取字段统计、空值率、分布特征', source: 'MCP Server: mate-data-server' },
  { icon: BarChart3, name: 'quality_score_eval', desc: '调用规则引擎执行数据质量评分，输出完整性、一致性、准确性维度得分', source: 'MCP Server: mate-rule-server' },
  { icon: Send, name: 'notify_push', desc: '通过飞书 Webhook 或 A2A 协议推送质量报告与告警通知', source: 'MCP Server: mate-a2a-server' },
];

// MOCK: 运行日志
const MOCK_LOGS = [
  { time: '07-22 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 86 表）', output: '发现 3 个异常，质量评分 92.4', duration: '3.1s', token: '412', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-21 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 86 表）', output: '发现 1 个异常，质量评分 94.1', duration: '2.7s', token: '386', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-20 14:32', trigger: '手动', triggerBadge: 'v-badge-info', input: '定向巡检：订单库 customers 表', output: '空值率 12%，一致性评分 88.2', duration: '2.1s', token: '298', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-20 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 86 表）', output: '无异常，质量评分 95.7', duration: '2.9s', token: '401', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-19 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 86 表）', output: '发现 2 个异常，质量评分 91.0', duration: '3.4s', token: '445', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-18 16:10', trigger: 'A2A', triggerBadge: 'v-badge-info', input: '数据集成后自动巡检：product_dw', output: '字段映射校验通过，质量评分 96.3', duration: '1.8s', token: '234', status: '完成', statusBadge: 'v-badge-success' },
  { time: '07-18 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 85 表）', output: '发现 5 个异常，质量评分 87.6', duration: '4.2s', token: '518', status: '告警', statusBadge: 'v-badge-warning' },
  { time: '07-17 08:00', trigger: 'Cron', triggerBadge: 'v-badge-neutral', input: '全量数据源日检（12 库 / 85 表）', output: 'RAG 检索超时，部分表跳过', duration: '8.1s', token: '672', status: '失败', statusBadge: 'v-badge-error' },
];

const flowNodeTypeClass: Record<string, string> = {
  input: 'ad-flow-node-type-input',
  tool: 'ad-flow-node-type-tool',
  action: 'ad-flow-node-type-action',
  output: 'ad-flow-node-type-output',
};

export default function AgentsDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <SubTabs items={AGENT_TABS} activePath={location.pathname} />

      <style>{`
        .ad-breadcrumb { font-size: 13px; color: var(--muted-foreground); margin-bottom: 16px; }
        .ad-breadcrumb a { color: var(--muted-foreground); text-decoration: none; cursor: pointer; }
        .ad-breadcrumb a:hover { color: var(--foreground); }
        .ad-breadcrumb span { margin: 0 6px; }
        .ad-agent-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .ad-agent-header-left { display: flex; align-items: flex-start; gap: 16px; }
        .ad-agent-icon { width: 48px; height: 48px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ad-agent-name { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
        .ad-agent-desc { font-size: 13px; color: var(--muted-foreground); margin-top: 4px; max-width: 520px; line-height: 1.5; }
        .ad-agent-meta-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
        .ad-agent-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .ad-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .ad-kpi-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
        .ad-kpi-eyebrow { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); margin-bottom: 8px; }
        .ad-kpi-value { font-size: 28px; font-weight: 600; color: var(--foreground); line-height: 1; margin-bottom: 6px; }
        .ad-kpi-unit { font-size: 14px; font-weight: 400; color: var(--muted-foreground); margin-left: 2px; }
        .ad-kpi-meta { font-size: 12px; color: var(--muted-foreground); display: flex; align-items: center; gap: 4px; }
        .ad-section-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .ad-v-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ad-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .ad-info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
        .ad-info-row:last-child { border-bottom: none; }
        .ad-info-label { font-size: 13px; color: var(--muted-foreground); }
        .ad-info-value { font-size: 13px; color: var(--foreground); font-weight: 500; }
        .ad-info-value-mono { font-size: 13px; color: #60a5fa; font-weight: 500; font-family: var(--font-mono); }
        .ad-flow-container { display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 8px 0; }
        .ad-flow-node { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 100px; padding: 14px 16px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); text-align: center; }
        .ad-flow-node-name { font-size: 13px; font-weight: 500; color: var(--foreground); }
        .ad-flow-node-type { font-size: 11px; padding: 1px 6px; border-radius: 9999px; font-weight: 500; }
        .ad-flow-node-type-input { background: rgba(96,165,250,0.12); color: #60a5fa; }
        .ad-flow-node-type-tool { background: var(--warning-subtle); color: var(--warning); }
        .ad-flow-node-type-action { background: var(--success-subtle); color: var(--success); }
        .ad-flow-node-type-output { background: rgba(250,250,250,0.08); color: var(--foreground); }
        .ad-flow-arrow { display: flex; align-items: center; padding: 0 6px; color: var(--muted-foreground); flex-shrink: 0; }
        .ad-tool-list { display: flex; flex-direction: column; }
        .ad-tool-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .ad-tool-item:last-child { border-bottom: none; }
        .ad-tool-icon { width: 32px; height: 32px; border-radius: var(--radius); background: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ad-tool-name { font-size: 13px; font-weight: 500; color: var(--foreground); margin-bottom: 2px; }
        .ad-tool-desc { font-size: 12px; color: var(--muted-foreground); line-height: 1.4; }
        .ad-tool-source { font-size: 11px; color: #60a5fa; font-family: var(--font-mono); margin-top: 4px; }
        .ad-prompt-block { background: #0d0d0d; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; font-family: var(--font-mono); font-size: 12px; line-height: 1.7; color: var(--muted-foreground); overflow-x: auto; white-space: pre-wrap; }
        .ad-prompt-keyword { color: #60a5fa; }
        .ad-prompt-variable { color: var(--warning); }
        .ad-prompt-comment { color: #525252; }
        .ad-prompt-text { color: #c8c8c8; }
        .ad-mono { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); }
        .ad-cell-nowrap { white-space: nowrap; }
      `}</style>

      {/* Breadcrumb */}
      <div className="ad-breadcrumb">
        <a onClick={() => navigate('/agents')}>数字员工</a>
        <span>/</span>
        <span>数据质量巡检员</span>
      </div>

      {/* Agent Header */}
      <div className="ad-agent-header">
        <div className="ad-agent-header-left">
          <div className="ad-agent-icon"><ScanSearch style={{ width: 24, height: 24, color: '#60a5fa' }} /></div>
          <div>
            <div className="ad-agent-name">数据质量巡检员</div>
            <div className="ad-agent-desc">基于本体引擎的数据质量自动化巡检 Agent，负责定期扫描数据源、检测异常模式、生成质量报告并推送告警通知。</div>
            <div className="ad-agent-meta-row">
              <span className="v-badge v-badge-success"><CircleDot style={{ width: 12, height: 12 }} /> 运行中</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>最近执行：2026-07-22 08:00:12</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Cron: 0 8 * * *</span>
            </div>
          </div>
        </div>
        <div className="ad-agent-header-actions">
          <button className="v-btn"><Pencil style={{ width: 14, height: 14 }} /> 编辑</button>
          <button className="v-btn"><Play style={{ width: 14, height: 14 }} /> 手动触发</button>
          <button className="v-btn"><History style={{ width: 14, height: 14 }} /> 执行历史</button>
          <button className="v-btn" style={{ color: 'var(--destructive)', borderColor: 'rgba(255,97,102,0.3)' }}><Power style={{ width: 14, height: 14 }} /> 停止</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ad-kpi-grid">
        {MOCK_KPIS.map((kpi) => {
          const TrendIcon = kpi.trendIcon;
          const trendColor = kpi.trend === 'up' ? 'var(--success)' : kpi.trend === 'down' ? 'var(--destructive)' : 'var(--muted-foreground)';
          return (
            <div key={kpi.eyebrow} className="ad-kpi-card">
              <div className="ad-kpi-eyebrow">{kpi.eyebrow}</div>
              <div className="ad-kpi-value">{kpi.value}<span className="ad-kpi-unit">{kpi.unit}</span></div>
              <div className="ad-kpi-meta"><span style={{ color: trendColor, display: 'flex', alignItems: 'center', gap: 4 }}><TrendIcon style={{ width: 12, height: 12 }} /> {kpi.trendText}</span> {kpi.trendLabel}</div>
            </div>
          );
        })}
      </div>

      {/* 1. Config Info */}
      <div className="v-card" style={{ marginBottom: 24 }}>
        <div className="ad-v-card-header">
          <div className="ad-section-title"><Settings2 style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 配置信息</div>
        </div>
        <div className="ad-info-grid">
          {MOCK_CONFIG.map((row) => (
            <div key={row.label} className="ad-info-row">
              <span className="ad-info-label">{row.label}</span>
              {row.mono ? (
                <span className="ad-info-value-mono">{row.value}</span>
              ) : row.badgeText ? (
                <span className="ad-info-value">
                  <span className={`v-badge ${row.value}`}>{row.badgeText}</span>
                  {row.extra && <span style={{ marginLeft: 8 }}>{row.extra}</span>}
                </span>
              ) : (
                <span className="ad-info-value">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Orchestration Flow */}
      <div className="v-card" style={{ marginBottom: 24 }}>
        <div className="ad-v-card-header">
          <div className="ad-section-title"><Workflow style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 编排流程摘要</div>
          <span className="v-meta" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Graph Core DAG · 6 节点</span>
        </div>
        <div className="ad-flow-container">
          {MOCK_FLOW_NODES.map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div className="ad-flow-node">
                <span className={`ad-flow-node-type ${flowNodeTypeClass[node.type]}`}>{node.typeLabel}</span>
                <span className="ad-flow-node-name">{node.name}</span>
              </div>
              {i < MOCK_FLOW_NODES.length - 1 && (
                <div className="ad-flow-arrow"><ChevronRight style={{ width: 18, height: 18 }} /></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tool Config */}
      <div className="v-card" style={{ marginBottom: 24 }}>
        <div className="ad-v-card-header">
          <div className="ad-section-title"><Wrench style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 工具配置</div>
          <span className="v-meta" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>5 个工具已挂载</span>
        </div>
        <div className="ad-tool-list">
          {MOCK_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.name} className="ad-tool-item">
                <div className="ad-tool-icon"><Icon style={{ width: 16, height: 16, color: '#60a5fa' }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ad-tool-name">{tool.name}</div>
                  <div className="ad-tool-desc">{tool.desc}</div>
                  <div className="ad-tool-source">{tool.source}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Prompt Template */}
      <div className="v-card" style={{ marginBottom: 24 }}>
        <div className="ad-v-card-header">
          <div className="ad-section-title"><Code2 style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> Prompt 模板预览</div>
          <button className="v-btn" style={{ fontSize: 12 }}><Copy style={{ width: 14, height: 14 }} /> 复制</button>
        </div>
        <div className="ad-prompt-block">
          <span className="ad-prompt-comment">// System Prompt - 数据质量巡检员</span>{'\n'}
          <span className="ad-prompt-keyword">你是 Mate Platform 的数据质量巡检员</span>，负责对企业数据资产进行自动化质量检测与分析。{'\n\n'}
          <span className="ad-prompt-keyword">## 职责范围</span>{'\n'}
          <span className="ad-prompt-text">- 对接本体引擎，获取当前巡检任务的数据源定义与质量规则{'\n'}
          - 调用 RAG 检索历史质量报告，识别重复出现的异常模式{'\n'}
          - 执行数据 Profile 查询，收集字段级别的统计指标{'\n'}
          - 基于规则引擎计算质量评分（完整性 / 一致性 / 准确性 / 时效性）{'\n'}
          - 生成结构化质量报告，并通过通知渠道推送给相关责任人{'\n\n'}
          </span>
          <span className="ad-prompt-keyword">## 输出规范</span>{'\n'}
          <span className="ad-prompt-text">- 报告格式遵循 </span><span className="ad-prompt-variable">{'{{ report_schema }}'}</span><span className="ad-prompt-text"> 定义{'\n'}
          - 评分维度：</span><span className="ad-prompt-variable">{'{{ score_dimensions }}'}</span>{'\n'}
          <span className="ad-prompt-text">- 异常阈值：</span><span className="ad-prompt-variable">{'{{ alert_threshold }}'}</span><span className="ad-prompt-text">（低于此值触发告警）{'\n'}
          - 报告语言：</span><span className="ad-prompt-variable">{'{{ language }}'}</span><span className="ad-prompt-text">（默认中文）{'\n\n'}
          </span>
          <span className="ad-prompt-keyword">## 约束</span>{'\n'}
          <span className="ad-prompt-text">- 严格基于数据事实评分，不进行主观推断{'\n'}
          - 发现异常时提供具体字段、示例值和修复建议{'\n'}
          - 每次巡检结果需与上次结果对比，标注趋势变化</span>
        </div>
      </div>

      {/* 5. Runtime Log */}
      <div className="v-card" style={{ marginBottom: 0 }}>
        <div className="ad-v-card-header">
          <div className="ad-section-title"><ScrollText style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} /> 运行日志</div>
          <button className="v-btn" style={{ fontSize: 12 }}><Download style={{ width: 14, height: 14 }} /> 导出</button>
        </div>
        <table className="v-table">
          <thead>
            <tr>
              <th className="ad-cell-nowrap">时间</th>
              <th className="ad-cell-nowrap">触发方式</th>
              <th>输入摘要</th>
              <th>输出摘要</th>
              <th className="ad-cell-nowrap">耗时</th>
              <th className="ad-cell-nowrap">Token</th>
              <th className="ad-cell-nowrap">状态</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LOGS.map((log, i) => (
              <tr key={i}>
                <td className="ad-mono ad-cell-nowrap">{log.time}</td>
                <td><span className={`v-badge ${log.triggerBadge}`}>{log.trigger}</span></td>
                <td>{log.input}</td>
                <td>{log.output}</td>
                <td className="ad-mono ad-cell-nowrap">{log.duration}</td>
                <td className="ad-mono ad-cell-nowrap">{log.token}</td>
                <td><span className={`v-badge ${log.statusBadge}`}>{log.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
