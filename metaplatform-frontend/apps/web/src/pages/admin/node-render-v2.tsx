/**
 * Admin/Components 36 节点注册 + 卡片渲染
 * --------------------------------------------------
 * v1.4 R1.5 Sprint 1.1 重写：每个节点类型有专属 UI 布局，不再是统一的"key/value 行列表"。
 *
 * 设计原则：
 *   1. 节点卡片不自带 background/border —— FlowGram 外壳的 `.demo-fixed-node` 已经提供卡片 chrome，
 *      内层只负责布局与配色，避免双层盒子不一致。
 *   2. 每种节点按"业务语义"设计专属 UI：
 *      - 事件类（start/end）：大圆 + 事件类型 + 发起人/终止条件
 *      - 任务类（user-task/service-task）：分配人/接口参数
 *      - 网关类（XOR/AND/OR）：分支标签 + 条件数
 *      - AI 类（llm/prompt/tool/rag/code-exec）：模型/工具/检索参数 + 预览
 *      - 业务类（form/data/notify/email/sms/webhook/manual）：表单/数据/通知配置
 *      - 数据类（db/http/mq/file/etl）：连接配置 + 数据源
 *      - 触发类（schedule/event/form/webhook）：定时/事件源
 *      - 控制类（condition/loop/parallel/merge/wait）：规则/表达式/并发度
 *
 * 36 节点 = 36 个 `NodeSpec`，每种一个 `kind: 'event'|'task'|'gateway'|'ai'|'biz'|'data'|'trigger'|'control'`
 * 路由到专属 card layout 函数。
 */
import { nanoid } from 'nanoid';
import type { FlowNodeRegistry } from '@flowgram.ai/fixed-layout-editor';
import {
  PlayCircle, StopCircle, UserCheck, Settings, GitBranch, PlusSquare, CircleDot, Layers,
  Sparkles, FileText, Wrench, BookOpen, Bot, Code2,
  Search, Database, Bell, Mail, MessageSquare, Link2, UserCheck as User, Globe2, Radio, Folder, RefreshCcw,
  Clock, Zap, FileInput, Link as WebhookIcon, GitBranch as GitBranchIcon, Repeat, Combine, Hourglass,
  ArrowRight, Shield, Hash, Calendar, Code, Inbox, AlertTriangle, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// 类型系统
// ============================================================
export type AccentKey = 'bpmn' | 'ai' | 'business' | 'data' | 'trigger' | 'control';

export type NodeLayout =
  | 'event'        // 开始/结束事件：大圆 + 事件类型
  | 'task'         // 用户/服务任务：分配人/接口
  | 'gateway'      // 网关：分支标签
  | 'ai-model'     // LLM：模型选择
  | 'ai-tool'      // Tool/RAG：工具/检索
  | 'ai-prompt'    // Prompt：模板预览
  | 'biz-form'     // 表单/查询/写入：实体配置
  | 'biz-notify'   // 通知类：渠道 + 模板
  | 'biz-manual'   // 人工任务：认领
  | 'data-source'  // 数据源：连接 + 数据表
  | 'data-etl'     // ETL：转换流
  | 'trigger'      // 触发器：定时/事件源
  | 'control-rule' // 条件：规则表达式
  | 'control-loop' // 循环：迭代上限
  | 'control-flow' // 并行/合并：并发度
  | 'control-wait'; // 等待：延时

export interface NodeFieldSpec {
  k: string;
  v: React.ReactNode;
}

export interface NodeSpec {
  type: string;
  name: string;
  desc: string;
  Icon: LucideIcon;
  accent: AccentKey;
  layout: NodeLayout;
  /**
   * 节点默认 data（用于 onAdd 时构造节点）
   */
  defaultData?: Record<string, unknown>;
}

// ============================================================
// 36 节点元数据
// ============================================================
export const NODES_36: NodeSpec[] = [
  // ─────────────── BPMN (8) ───────────────
  { type: 'bpmnStart', name: '开始事件', desc: '流程入口', Icon: PlayCircle, accent: 'bpmn', layout: 'event',
    defaultData: { title: '开始事件', content: '流程入口', eventType: 'none', initiator: '全员' } },
  { type: 'bpmnEnd', name: '结束事件', desc: '流程终点', Icon: StopCircle, accent: 'bpmn', layout: 'event',
    defaultData: { title: '结束事件', content: '流程终点', eventType: 'none' } },
  { type: 'bpmnUserTask', name: '用户任务', desc: '人工审批待办', Icon: UserCheck, accent: 'bpmn', layout: 'task',
    defaultData: { title: '用户任务', assignee: '主管', form: 'leave_apply', mode: '依次' } },
  { type: 'bpmnServiceTask', name: '服务任务', desc: '系统自动执行', Icon: Settings, accent: 'bpmn', layout: 'task',
    defaultData: { title: '服务任务', method: 'POST', endpoint: '/api/v1/wfe/task' } },
  { type: 'bpmnGatewayExclusive', name: '排他网关', desc: 'XOR · 单分支路由', Icon: GitBranch, accent: 'bpmn', layout: 'gateway',
    defaultData: { title: '排他网关', branches: 2, condition: 'days ≥ 3' } },
  { type: 'bpmnGatewayParallel', name: '并行网关', desc: 'AND · 多路并发', Icon: PlusSquare, accent: 'bpmn', layout: 'gateway',
    defaultData: { title: '并行网关', branches: 3 } },
  { type: 'bpmnGatewayInclusive', name: '包容网关', desc: 'OR · 多分支汇聚', Icon: CircleDot, accent: 'bpmn', layout: 'gateway',
    defaultData: { title: '包容网关', branches: 3 } },
  { type: 'bpmnSubProcess', name: '子流程', desc: '嵌套复用流程', Icon: Layers, accent: 'bpmn', layout: 'task',
    defaultData: { title: '子流程', subId: 'sub_001' } },

  // ─────────────── AI Agent (6) ───────────────
  { type: 'agent_llm', name: 'LLM 调用', desc: '大模型推理', Icon: Sparkles, accent: 'ai', layout: 'ai-model',
    defaultData: { title: 'LLM 调用', model: 'doubao-pro-32k', temp: 0.7, tokens: 2048 } },
  { type: 'agent_prompt', name: 'Prompt 模板', desc: '变量化提示词', Icon: FileText, accent: 'ai', layout: 'ai-prompt',
    defaultData: { title: 'Prompt 模板', template: 'You are a {{role}}...' } },
  { type: 'agent_tool', name: '工具调用', desc: 'Function Calling / MCP', Icon: Wrench, accent: 'ai', layout: 'ai-tool',
    defaultData: { title: '工具调用', server: 'mcp-server-corp', tool: 'send_email' } },
  { type: 'agent_rag', name: 'RAG 检索', desc: '向量库 / 知识图谱', Icon: BookOpen, accent: 'ai', layout: 'ai-tool',
    defaultData: { title: 'RAG 检索', kb: 'kb-product-tech', topK: 5, threshold: 0.75 } },
  { type: 'agent_decision', name: 'Agent 决策', desc: '智能路由分发', Icon: Bot, accent: 'ai', layout: 'control-rule',
    defaultData: { title: 'Agent 决策', strategy: 'ReAct', routes: 3 } },
  { type: 'agent_code_exec', name: '代码执行', desc: '沙箱运行', Icon: Code2, accent: 'ai', layout: 'ai-prompt',
    defaultData: { title: '代码执行', language: 'python', code: 'result = sum(...)' } },

  // ─────────────── 业务 (8) ───────────────
  { type: 'biz_form_collect', name: '表单收集', desc: '用户填报表单', Icon: FileText, accent: 'business', layout: 'biz-form',
    defaultData: { title: '表单收集', form: 'leave_apply_v2' } },
  { type: 'biz_data_query', name: '数据查询', desc: '本体语义查询', Icon: Search, accent: 'business', layout: 'biz-form',
    defaultData: { title: '数据查询', entity: 'Employee', limit: 10 } },
  { type: 'biz_data_write', name: '数据写入', desc: '持久化业务对象', Icon: Database, accent: 'business', layout: 'biz-form',
    defaultData: { title: '数据写入', target: 'TECH-ONT' } },
  { type: 'biz_notify', name: '通知发送', desc: '站内消息推送', Icon: Bell, accent: 'business', layout: 'biz-notify',
    defaultData: { title: '通知发送', channel: 'IM', recipients: '审批人+抄送人' } },
  { type: 'biz_email', name: '邮件发送', desc: 'SMTP 邮件', Icon: Mail, accent: 'business', layout: 'biz-notify',
    defaultData: { title: '邮件发送', template: 'approval_v2', to: '$approver.email' } },
  { type: 'biz_sms', name: '短信发送', desc: '短信网关', Icon: MessageSquare, accent: 'business', layout: 'biz-notify',
    defaultData: { title: '短信发送', signature: 'Mate', template: 'sms_approve' } },
  { type: 'biz_webhook', name: 'Webhook', desc: 'HTTP 回调', Icon: Link2, accent: 'business', layout: 'data-source',
    defaultData: { title: 'Webhook', method: 'POST', url: 'https://hook.example.com/x' } },
  { type: 'biz_manual_task', name: '人工任务', desc: '线下执行', Icon: User, accent: 'business', layout: 'biz-manual',
    defaultData: { title: '人工任务', assignee: '待定', deadline: '24h' } },

  // ─────────────── 数据集成 (5) ───────────────
  { type: 'data_db_connect', name: '数据库连接', desc: 'JDBC 接入', Icon: Database, accent: 'data', layout: 'data-source',
    defaultData: { title: '数据库连接', driver: 'PostgreSQL', table: 'public.orders' } },
  { type: 'data_http', name: 'API 调用', desc: 'HTTP Request', Icon: Globe2, accent: 'data', layout: 'data-source',
    defaultData: { title: 'API 调用', method: 'GET', url: '/api/v1/users/{id}' } },
  { type: 'data_mq', name: '消息队列', desc: 'Kafka / RabbitMQ', Icon: Radio, accent: 'data', layout: 'data-source',
    defaultData: { title: '消息队列', broker: 'Kafka', topic: 'order.completed' } },
  { type: 'data_file_storage', name: '文件存储', desc: 'MinIO / 对象存储', Icon: Folder, accent: 'data', layout: 'data-source',
    defaultData: { title: '文件存储', backend: 'MinIO', bucket: 'mate-uploads' } },
  { type: 'data_etl', name: 'ETL 任务', desc: '数据抽取转换', Icon: RefreshCcw, accent: 'data', layout: 'data-etl',
    defaultData: { title: 'ETL 任务', engine: 'Spark', source: 'PG → Iceberg' } },

  // ─────────────── 触发器 (4) ───────────────
  { type: 'trg_schedule', name: '定时触发', desc: 'Cron 表达式', Icon: Clock, accent: 'trigger', layout: 'trigger',
    defaultData: { title: '定时触发', cron: '0 9 * * *', desc: '每天 9:00' } },
  { type: 'trg_event', name: '事件触发', desc: 'MQ 事件源', Icon: Zap, accent: 'trigger', layout: 'trigger',
    defaultData: { title: '事件触发', topic: 'order.completed' } },
  { type: 'trg_form_submit', name: '表单提交', desc: '用户主动提交', Icon: FileInput, accent: 'trigger', layout: 'biz-form',
    defaultData: { title: '表单提交', form: 'leave_apply' } },
  { type: 'trg_webhook', name: 'Webhook 触发', desc: '外部回调', Icon: WebhookIcon, accent: 'trigger', layout: 'trigger',
    defaultData: { title: 'Webhook 触发', secret: 'HMAC-SHA256' } },

  // ─────────────── 控制流 (5) ───────────────
  { type: 'ctrl_condition', name: '条件分支', desc: 'If/Else', Icon: GitBranchIcon, accent: 'control', layout: 'control-rule',
    defaultData: { title: '条件分支', expr: 'status === "ok"' } },
  { type: 'ctrl_loop', name: '循环', desc: '遍历迭代', Icon: Repeat, accent: 'control', layout: 'control-loop',
    defaultData: { title: '循环', max: 100, items: '$input.list' } },
  { type: 'ctrl_parallel', name: '并行', desc: '并发执行', Icon: Layers, accent: 'control', layout: 'control-flow',
    defaultData: { title: '并行', concurrency: 4 } },
  { type: 'ctrl_merge', name: '合并', desc: '汇聚结果', Icon: Combine, accent: 'control', layout: 'control-flow',
    defaultData: { title: '合并', strategy: 'all' } },
  { type: 'ctrl_wait', name: '等待', desc: '延迟/挂起', Icon: Hourglass, accent: 'control', layout: 'control-wait',
    defaultData: { title: '等待', duration: '24h' } },
];

export interface NodePaletteGroup {
  key: AccentKey;
  label: string;
  types: string[];
}

export const PALETTE_GROUPS: NodePaletteGroup[] = [
  { key: 'bpmn', label: 'BPMN 节点', types: NODES_36.filter(n => n.accent === 'bpmn').map(n => n.type) },
  { key: 'ai', label: 'AI Agent 节点', types: NODES_36.filter(n => n.accent === 'ai').map(n => n.type) },
  { key: 'business', label: '业务节点', types: NODES_36.filter(n => n.accent === 'business').map(n => n.type) },
  { key: 'data', label: '数据集成', types: NODES_36.filter(n => n.accent === 'data').map(n => n.type) },
  { key: 'trigger', label: '触发器', types: NODES_36.filter(n => n.accent === 'trigger').map(n => n.type) },
  { key: 'control', label: '控制流', types: NODES_36.filter(n => n.accent === 'control').map(n => n.type) },
];

// ============================================================
// 节点卡片样式（对齐官方 FlowGram.AI demo 风格）
// ============================================================
//
// 官方 demo 风格（@flowgram.ai/fixed-layout-editor/dist/esm/index.css）：
//   - .demo-fixed-node: 暗色半透明 bg + 白色边 + 10px 圆角 + 阴影
//   - .demo-fixed-node-title: 顶部 135° indigo→purple 渐变条（仅上圆角）
//   - .demo-fixed-node-content: 12/16 padding
//
// 本实现：让 FlowGram 外壳提供 chrome，内层 formMeta.render 只渲染：
//   - 顶部渐变条（按分类调色，与官方 indigo→purple 同款）
//   - 节点内容区（每种 layout 专属 UI）
//
export const NODE_CARD_V2_CSS = `
/* === 36 节点卡片 (v1.4 R1.5.2 - 对齐官方 demo 风格) === */

.ac-node-card-v2 {
  width: 240px;
  font-family: var(--font-sans);
  user-select: none;
  display: flex;
  flex-direction: column;
  /* 不设背景/边框 —— 完全由 FlowGram .demo-fixed-node 外壳提供 chrome */
}

/* === 顶部渐变条（仿官方 .demo-fixed-node-title 风格，按分类调色） === */
.ac-node-card-v2-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-weight: 600;
  font-size: 13px;
  color: #fff;
  letter-spacing: -0.01em;
  border-radius: 10px 10px 0 0;
}
.ac-node-card-v2-header.bpmn     { background: linear-gradient(135deg, rgba(59,130,246,0.85), rgba(99,102,241,0.75)); }
.ac-node-card-v2-header.ai       { background: linear-gradient(135deg, rgba(168,85,247,0.85), rgba(139,92,246,0.75)); }
.ac-node-card-v2-header.business { background: linear-gradient(135deg, rgba(34,197,94,0.85), rgba(22,163,74,0.75)); }
.ac-node-card-v2-header.data     { background: linear-gradient(135deg, rgba(234,179,8,0.85), rgba(202,138,4,0.75)); }
.ac-node-card-v2-header.trigger  { background: linear-gradient(135deg, rgba(232,121,249,0.85), rgba(217,70,239,0.75)); }
.ac-node-card-v2-header.control  { background: linear-gradient(135deg, rgba(113,113,122,0.85), rgba(82,82,91,0.75)); }

.ac-node-card-v2-header-icon {
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ac-node-card-v2-header-icon svg { width: 14px; height: 14px; }
.ac-node-card-v2-header-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === 内容区（仿官方 .demo-fixed-node-content 风格） === */
.ac-node-card-v2-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* === 通用组件 === */
.ac-pill {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 9999px;
  padding: 1px 7px;
  font-size: 10px;
  font-family: var(--font-sans);
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  line-height: 14px;
}
.ac-code {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
}
.ac-label {
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.02em;
}
.ac-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
}
.ac-muted {
  font-size: 11px;
  color: rgba(255,255,255,0.55);
}
.ac-strong {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.95);
  letter-spacing: -0.01em;
}

/* === Layout 1: event（开始/结束事件） === */
.ac-event-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px auto 0;
  position: relative;
}
.ac-event-circle.bpmn {
  background: rgba(59,130,246,0.18);
  color: rgb(147,197,253);
  border: 2px solid rgb(59,130,246);
}
.ac-event-circle.bpmn.end {
  background: transparent;
  border-width: 4px;
}
.ac-event-eventtype {
  text-align: center;
  margin-top: 2px;
}
.ac-event-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

/* === Layout 2: task（用户/服务任务/子流程） === */
.ac-task-assignee {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}
.ac-task-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgb(59,130,246); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
  flex-shrink: 0;
}
.ac-task-avatar.success { background: rgb(34,197,94); }
.ac-task-avatar.warning { background: rgb(234,179,8); }
.ac-task-endpoint {
  display: flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,0.3);
  border-radius: 6px;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
}
.ac-task-method {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.ac-task-method.POST   { background: rgba(34,197,94,0.2);  color: rgb(134,239,172); }
.ac-task-method.GET    { background: rgba(59,130,246,0.2); color: rgb(147,197,253); }
.ac-task-method.PUT    { background: rgba(234,179,8,0.2);  color: rgb(253,224,71); }
.ac-task-method.DELETE { background: rgba(239,68,68,0.2);  color: rgb(252,165,165); }
.ac-task-endpoint-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* === Layout 3: gateway（网关） === */
.ac-gateway-shape {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  margin: 4px auto 0;
  background: rgba(59,130,246,0.18);
  color: rgb(147,197,253);
  border: 2px solid rgb(59,130,246);
  transform: rotate(45deg);
  border-radius: 4px;
}
.ac-gateway-shape > * { transform: rotate(-45deg); }
.ac-gateway-branches {
  display: flex; align-items: center; gap: 4px;
  justify-content: center;
  margin-top: 4px;
}
.ac-gateway-branch {
  width: 18px; height: 4px; border-radius: 2px;
  background: rgb(59,130,246);
}
.ac-gateway-branch.muted { background: rgba(255,255,255,0.25); }

/* === Layout 4: ai-model === */
.ac-llm-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}
.ac-llm-model-name {
  font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.95);
  flex: 1;
}
.ac-llm-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.ac-llm-stat {
  padding: 4px 6px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
}
.ac-llm-stat-label { font-size: 9px; color: rgba(255,255,255,0.5); }
.ac-llm-stat-value { font-family: var(--font-mono); font-size: 11px; color: rgba(255,255,255,0.95); }

/* === Layout 5: ai-tool / ai-prompt === */
.ac-tool-server {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}
.ac-tool-server-name {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.95);
  flex: 1; font-family: var(--font-mono);
}
.ac-tool-row {
  display: flex; align-items: center; gap: 6px;
}
.ac-tool-kv {
  display: flex; justify-content: space-between;
  font-size: 11px; color: rgba(255,255,255,0.55);
}
.ac-tool-kv b { color: rgba(255,255,255,0.92); font-weight: 500; font-family: var(--font-mono); font-size: 11px; }

/* === Layout 6: biz-form === */
.ac-bizform-entity {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}
.ac-bizform-entity-name {
  font-family: var(--font-mono);
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.95);
  flex: 1;
}
.ac-bizform-row {
  display: flex; justify-content: space-between;
  font-size: 11px; color: rgba(255,255,255,0.55);
}
.ac-bizform-row b { color: rgba(255,255,255,0.92); font-weight: 500; }

/* === Layout 7: biz-notify / biz-manual === */
.ac-notify-channel {
  display: flex; align-items: center; gap: 8px;
}
.ac-notify-channel-icon {
  width: 32px; height: 32px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.ac-notify-channel-icon.bell { background: rgba(59,130,246,0.18); color: rgb(147,197,253); }
.ac-notify-channel-icon.mail { background: rgba(234,179,8,0.18); color: rgb(253,224,71); }
.ac-notify-channel-icon.sms { background: rgba(34,197,94,0.18); color: rgb(134,239,172); }
.ac-notify-template {
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
  background: rgba(0,0,0,0.3);
  padding: 4px 8px;
  border-radius: 4px;
}
.ac-notify-to {
  font-family: var(--font-mono);
  font-size: 10px;
  color: rgba(255,255,255,0.55);
}
.ac-manual-row {
  display: flex; align-items: center; gap: 8px;
}
.ac-manual-pending {
  font-size: 10px; padding: 2px 8px; border-radius: 9999px;
  background: rgba(234,179,8,0.2); color: rgb(253,224,71);
}

/* === Layout 8: data-source / data-etl === */
.ac-source-line {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
  background: rgba(0,0,0,0.3);
  padding: 6px 8px;
  border-radius: 6px;
}
.ac-source-icon {
  width: 22px; height: 22px;
  border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(234,179,8,0.18); color: rgb(253,224,71);
  flex-shrink: 0;
}
.ac-etl-flow {
  display: flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
}
.ac-etl-step {
  padding: 3px 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
}
.ac-etl-arrow { color: rgba(255,255,255,0.4); }

/* === Layout 9: trigger === */
.ac-trigger-row {
  display: flex; align-items: center; gap: 8px;
}
.ac-trigger-icon {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(232,121,249,0.2);
  color: rgb(232,121,249);
  flex-shrink: 0;
}
.ac-trigger-cron {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.95);
  letter-spacing: 0.02em;
  background: rgba(0,0,0,0.35);
  padding: 6px 10px;
  border-radius: 6px;
  display: inline-block;
}
.ac-trigger-topic {
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
  background: rgba(0,0,0,0.3);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

/* === Layout 10: control-rule / control-loop / control-flow / control-wait === */
.ac-rule-expr {
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,0.92);
  background: rgba(0,0,0,0.3);
  padding: 6px 8px;
  border-radius: 6px;
  border-left: 3px solid rgba(255,255,255,0.4);
}
.ac-loop-progress {
  display: flex; align-items: center; gap: 8px;
}
.ac-loop-progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.ac-loop-progress-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: rgba(255,255,255,0.5);
  border-radius: 2px;
}
.ac-flow-stat {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px;
}
.ac-flow-stat-cell {
  background: rgba(255,255,255,0.05);
  padding: 6px 4px;
  border-radius: 4px;
  text-align: center;
}
.ac-flow-stat-value {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.95);
}
.ac-flow-stat-label {
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  margin-top: 1px;
}
.ac-wait-progress {
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.ac-wait-progress-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: rgba(255,255,255,0.5);
  border-radius: 2px;
  width: 30%;
}
`;

// ============================================================
// 样式注入（幂等）
// ============================================================
let _injected = false;
export function ensureNodeCardV2Style(): void {
  if (_injected) return;
  if (typeof document === 'undefined') return;
  const id = 'ac-node-card-v2-style';
  if (document.getElementById(id)) {
    _injected = true;
    return;
  }
  const node = document.createElement('style');
  node.id = id;
  node.textContent = NODE_CARD_V2_CSS;
  document.head.appendChild(node);
  _injected = true;
}

// ============================================================
// Layout 渲染器
// ============================================================

/** 头部：官方 demo 风格的渐变标题条（135° 渐变 + Icon + 节点名） */
function NodeHeader({ spec }: { spec: NodeSpec }) {
  return (
    <div className={`ac-node-card-v2-header ${spec.accent}`}>
      <span className="ac-node-card-v2-header-icon">
        <spec.Icon size={14} />
      </span>
      <span className="ac-node-card-v2-header-title">{spec.name}</span>
    </div>
  );
}

/** L1: event —— 开始/结束事件大圆 */
function EventLayout({ spec }: { spec: NodeSpec }) {
  const isEnd = spec.type === 'bpmnEnd';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body" style={{ alignItems: 'center' }}>
        <div className={`ac-event-circle bpmn${isEnd ? ' end' : ''}`}>
          <spec.Icon size={20} />
        </div>
        <div className="ac-event-eventtype">
          <span className="ac-pill">
            {isEnd ? 'NONE 结束' : 'NONE 事件'}
          </span>
        </div>
        {!isEnd && (
          <div style={{ width: '100%' }}>
            <div className="ac-event-row" style={{ marginTop: 4 }}>
              <span className="ac-label">发起人</span>
              <span className="ac-mono">全员</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** L2: task —— 用户任务 / 服务任务 / 子流程 */
function TaskLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const avatarChar = String(d.assignee ?? 'U').slice(0, 1).toUpperCase();
  const assigneeColors = ['success', '', 'warning'] as const;
  const colorIdx = spec.type.length % assigneeColors.length;
  const avatarClass = assigneeColors[colorIdx];
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        {spec.type === 'bpmnUserTask' && (
          <>
            <div className="ac-task-assignee">
              <div className={`ac-task-avatar ${avatarClass}`}>{avatarChar}</div>
              <div style={{ flex: 1 }}>
                <div className="ac-label">处理人</div>
                <div className="ac-mono" style={{ marginTop: 1 }}>{String(d.assignee)}</div>
              </div>
              <span className="ac-pill">{String(d.mode)}</span>
            </div>
            <div className="ac-event-row">
              <span className="ac-label">表单</span>
              <span className="ac-mono">{String(d.form)}</span>
            </div>
          </>
        )}
        {spec.type === 'bpmnServiceTask' && (
          <>
            <div className="ac-task-endpoint">
              <span className={`ac-task-method ${String(d.method)}`}>{String(d.method)}</span>
              <span className="ac-task-endpoint-path">{String(d.endpoint)}</span>
            </div>
            <div className="ac-event-row">
              <span className="ac-label">超时</span>
              <span className="ac-mono">30s</span>
            </div>
            <div className="ac-event-row">
              <span className="ac-label">重试</span>
              <span className="ac-mono">3 次</span>
            </div>
          </>
        )}
        {spec.type === 'bpmnSubProcess' && (
          <>
            <div className="ac-bizform-entity">
              <Layers size={14} style={{ color: 'var(--info)' }} />
              <span className="ac-bizform-entity-name">{String(d.subId)}</span>
              <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <div className="ac-event-row">
              <span className="ac-label">入参</span>
              <span className="ac-mono">$parent.input</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** L3: gateway —— 网关 */
function GatewayLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const branches = Number(d.branches ?? 2);
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body" style={{ alignItems: 'center' }}>
        <div className="ac-gateway-shape">
          <spec.Icon size={20} />
        </div>
        <div className="ac-gateway-branches">
          {Array.from({ length: branches }).map((_, i) => (
            <div key={i} className="ac-gateway-branch" />
          ))}
          {branches < 3 && Array.from({ length: 3 - branches }).map((_, i) => (
            <div key={`muted-${i}`} className="ac-gateway-branch muted" />
          ))}
        </div>
        {spec.type === 'bpmnGatewayExclusive' && (
          <div className="ac-rule-expr" style={{ width: '100%' }}>
            {String((spec.defaultData ?? {})['condition'] ?? '')}
          </div>
        )}
        <div className="ac-event-row" style={{ width: '100%' }}>
          <span className="ac-label">策略</span>
          <span className="ac-mono">{spec.type === 'bpmnGatewayParallel' ? 'AND 并行' : spec.type === 'bpmnGatewayInclusive' ? 'OR 汇聚' : 'XOR 互斥'}</span>
        </div>
      </div>
    </div>
  );
}

/** L4: ai-model —— LLM */
function AiModelLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-llm-head">
          <Sparkles size={14} style={{ color: 'var(--purple)' }} />
          <span className="ac-llm-model-name">{String(d.model)}</span>
        </div>
        <div className="ac-llm-stats">
          <div className="ac-llm-stat">
            <div className="ac-llm-stat-label">温度</div>
            <div className="ac-llm-stat-value">{String(d.temp)}</div>
          </div>
          <div className="ac-llm-stat">
            <div className="ac-llm-stat-label">MaxTokens</div>
            <div className="ac-llm-stat-value">{String(d.tokens)}</div>
          </div>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">流式</span>
          <span className="ac-mono">true</span>
        </div>
      </div>
    </div>
  );
}

/** L5: ai-tool / RAG —— 服务选择 + 参数 */
function AiToolLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const isRag = spec.type === 'agent_rag';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-tool-server">
          {isRag ? <BookOpen size={14} style={{ color: 'var(--purple)' }} /> : <Wrench size={14} style={{ color: 'var(--purple)' }} />}
          <span className="ac-tool-server-name">
            {isRag ? String(d.kb) : `${String(d.server)} :: ${String(d.tool)}`}
          </span>
        </div>
        <div className="ac-tool-row" style={{ justifyContent: 'space-between' }}>
          <span className="ac-label">{isRag ? 'Top-K' : '超时'}</span>
          {isRag ? (
            <span className="ac-mono">{String(d.topK)}</span>
          ) : (
            <span className="ac-mono">30s</span>
          )}
        </div>
        <div className="ac-tool-row" style={{ justifyContent: 'space-between' }}>
          <span className="ac-label">{isRag ? '相似度阈值' : '参数'}</span>
          <span className="ac-mono">{isRag ? `≥ ${String(d.threshold)}` : '3 个'}</span>
        </div>
      </div>
    </div>
  );
}

/** L6: ai-prompt —— Prompt 模板 / 代码执行 */
function AiPromptLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const isCode = spec.type === 'agent_code_exec';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-event-row">
          <span className="ac-label">{isCode ? '语言' : '变量'}</span>
          <span className="ac-pill">{isCode ? String(d.language) : '{{role}}, {{context}}'}</span>
        </div>
        <div style={{
          background: 'var(--muted)',
          borderRadius: 6,
          padding: '8px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--foreground)',
          borderLeft: '3px solid var(--purple)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}>
          {isCode ? <code>{String(d.code)}</code> : String(d.template)}
        </div>
        <div className="ac-event-row">
          <span className="ac-label">字符数</span>
          <span className="ac-mono">{isCode ? '32' : '48'}</span>
        </div>
      </div>
    </div>
  );
}

/** L7: biz-form —— 表单/查询/写入 */
function BizFormLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const isQuery = spec.type === 'biz_data_query';
  const isWrite = spec.type === 'biz_data_write';
  const isTrigger = spec.type === 'trg_form_submit';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-bizform-entity">
          <Database size={14} style={{ color: 'var(--success)' }} />
          <span className="ac-bizform-entity-name">
            {isQuery ? String(d.entity) : isWrite ? String(d.target) : String(d.form)}
          </span>
          <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />
        </div>
        {isQuery && (
          <>
            <div className="ac-bizform-row">
              <span>返回条数</span>
              <b>{String(d.limit)} 条</b>
            </div>
            <div className="ac-bizform-row">
              <span>排序</span>
              <b>updated_at DESC</b>
            </div>
          </>
        )}
        {isWrite && (
          <>
            <div className="ac-bizform-row">
              <span>主键策略</span>
              <b>UUID</b>
            </div>
            <div className="ac-bizform-row">
              <span>写策略</span>
              <b>UPSERT</b>
            </div>
          </>
        )}
        {(spec.type === 'biz_form_collect' || isTrigger) && (
          <>
            <div className="ac-bizform-row">
              <span>字段数</span>
              <b>12</b>
            </div>
            <div className="ac-bizform-row">
              <span>必填</span>
              <b>5</b>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** L8: biz-notify / biz-email / biz-sms / biz-manual */
function BizNotifyLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const iconClass = spec.type === 'biz_email' ? 'mail' : spec.type === 'biz_sms' ? 'sms' : 'bell';
  const channelName = spec.type === 'biz_email' ? 'Email' : spec.type === 'biz_sms' ? 'SMS' : 'IM';
  const ChannelIcon = spec.type === 'biz_email' ? Mail : spec.type === 'biz_sms' ? MessageSquare : Bell;
  const isManual = spec.type === 'biz_manual_task';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        {isManual ? (
          <>
            <div className="ac-manual-row">
              <div className="ac-task-avatar warning">{String(d.assignee).slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="ac-label">认领人</div>
                <div className="ac-mono">{String(d.assignee)}</div>
              </div>
              <span className="ac-manual-pending">待认领</span>
            </div>
            <div className="ac-bizform-row">
              <span>截止</span>
              <b>{String(d.deadline)}</b>
            </div>
          </>
        ) : (
          <>
            <div className="ac-notify-channel">
              <div className={`ac-notify-channel-icon ${iconClass}`}>
                <ChannelIcon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="ac-label">渠道</div>
                <div className="ac-mono">{channelName}</div>
              </div>
            </div>
            <div className="ac-event-row">
              <span className="ac-label">模板</span>
              <span className="ac-notify-template">{String(d.template ?? d.signature)}</span>
            </div>
            <div className="ac-event-row">
              <span className="ac-label">接收方</span>
              <span className="ac-notify-to">{String(d.to ?? d.recipients)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** L9: data-source —— DB / HTTP / MQ / File */
function DataSourceLayout({ spec }: { spec: NodeSpec }) {
  const d = (spec.defaultData ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v));
  const method = spec.type === 'data_http' ? str(d.method) : spec.type === 'data_mq' ? str(d.broker) : spec.type === 'data_file_storage' ? str(d.backend) : str(d.driver);
  const path = spec.type === 'data_db_connect' ? str(d.table)
    : spec.type === 'data_http' ? str(d.url)
    : spec.type === 'data_mq' ? str(d.topic)
    : spec.type === 'data_file_storage' ? str(d.bucket)
    : '';
  const SourceIcon = spec.type === 'data_db_connect' ? Database : spec.type === 'data_http' ? Globe2 : spec.type === 'data_mq' ? Radio : Folder;
  const isHttp = spec.type === 'data_http';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-source-line">
          {isHttp ? (
            <span className={`ac-task-method ${method}`}>{method}</span>
          ) : (
            <div className="ac-source-icon">
              <SourceIcon size={12} />
            </div>
          )}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {path}
          </span>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">超时</span>
          <span className="ac-mono">10s</span>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">凭据</span>
          <span className="ac-mono">{isHttp ? 'Bearer ***' : '$secret'}</span>
        </div>
      </div>
    </div>
  );
}

/** L10: data-etl */
function EtlLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-etl-flow">
          <span className="ac-etl-step">{String(d.source).split(' → ')[0]}</span>
          <ArrowRight size={12} className="ac-etl-arrow" />
          <span className="ac-etl-step" style={{ background: 'var(--warning-subtle)', color: 'var(--warning)' }}>
            Transform
          </span>
          <ArrowRight size={12} className="ac-etl-arrow" />
          <span className="ac-etl-step">{String(d.source).split(' → ')[1]}</span>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">引擎</span>
          <span className="ac-mono">{String(d.engine)}</span>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">批大小</span>
          <span className="ac-mono">1000</span>
        </div>
      </div>
    </div>
  );
}

/** L11: trigger —— 定时/事件/Webhook */
function TriggerLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-trigger-row">
          <div className="ac-trigger-icon">
            <spec.Icon size={14} />
          </div>
          {spec.type === 'trg_schedule' && (
            <div style={{ flex: 1 }}>
              <div className="ac-trigger-cron">{String(d.cron)}</div>
              <div className="ac-muted" style={{ marginTop: 2 }}>{String(d.desc ?? '')}</div>
            </div>
          )}
          {spec.type === 'trg_event' && (
            <div style={{ flex: 1 }}>
              <div className="ac-label">Topic</div>
              <div className="ac-trigger-topic" style={{ marginTop: 2 }}>{String(d.topic)}</div>
            </div>
          )}
          {spec.type === 'trg_webhook' && (
            <div style={{ flex: 1 }}>
              <div className="ac-label">签名</div>
              <div className="ac-mono" style={{ marginTop: 2 }}>{String(d.secret)}</div>
            </div>
          )}
        </div>
        <div className="ac-event-row">
          <span className="ac-label">最近触发</span>
          <span className="ac-mono">2 分钟前</span>
        </div>
      </div>
    </div>
  );
}

/** L12: control-rule —— Agent 决策 / 条件分支 */
function ControlRuleLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const isDecision = spec.type === 'agent_decision';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        {isDecision && (
          <>
            <div className="ac-bizform-row">
              <span>策略</span>
              <b>{String(d.strategy)}</b>
            </div>
            <div className="ac-bizform-row">
              <span>分支数</span>
              <b>{String(d.routes)} 条</b>
            </div>
          </>
        )}
        {!isDecision && (
          <div className="ac-rule-expr">{String(d.expr)}</div>
        )}
        <div className="ac-event-row">
          <span className="ac-label">默认分支</span>
          <span className="ac-mono">{isDecision ? 'N/A' : 'fallback'}</span>
        </div>
      </div>
    </div>
  );
}

/** L13: control-loop */
function ControlLoopLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-event-row">
          <span className="ac-label">迭代上限</span>
          <span className="ac-mono">{String(d.max)}</span>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">遍历</span>
          <span className="ac-mono">{String(d.items)}</span>
        </div>
        <div className="ac-loop-progress">
          <div className="ac-label" style={{ minWidth: 36 }}>进度</div>
          <div className="ac-loop-progress-bar">
            <div className="ac-loop-progress-fill" style={{ width: '60%' }} />
          </div>
          <span className="ac-mono">60/100</span>
        </div>
      </div>
    </div>
  );
}

/** L14: control-flow —— 并行/合并 */
function ControlFlowLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  const isParallel = spec.type === 'ctrl_parallel';
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-flow-stat">
          <div className="ac-flow-stat-cell">
            <div className="ac-flow-stat-value">{isParallel ? String(d.concurrency) : 'N/A'}</div>
            <div className="ac-flow-stat-label">并发度</div>
          </div>
          <div className="ac-flow-stat-cell">
            <div className="ac-flow-stat-value">{isParallel ? '4' : '3'}</div>
            <div className="ac-flow-stat-label">入口</div>
          </div>
          <div className="ac-flow-stat-cell">
            <div className="ac-flow-stat-value">{isParallel ? '1' : '1'}</div>
            <div className="ac-flow-stat-label">出口</div>
          </div>
        </div>
        <div className="ac-event-row">
          <span className="ac-label">策略</span>
          <span className="ac-mono">
            {isParallel ? '并发执行' : (spec.type === 'ctrl_merge' ? `等待${String(d.strategy)}` : 'N/A')}
          </span>
        </div>
      </div>
    </div>
  );
}

/** L15: control-wait */
function ControlWaitLayout({ spec }: { spec: NodeSpec }) {
  const d = spec.defaultData ?? {};
  return (
    <div className="ac-node-card-v2">
      <NodeHeader spec={spec} />
      <div className="ac-node-card-v2-body">
        <div className="ac-event-row">
          <span className="ac-label">延时</span>
          <span className="ac-mono" style={{ fontSize: 14, fontWeight: 600 }}>{String(d.duration)}</span>
        </div>
        <div className="ac-wait-progress">
          <div className="ac-wait-progress-fill" />
        </div>
        <div className="ac-event-row">
          <span className="ac-label">续期</span>
          <span className="ac-mono">挂起 / 唤醒</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 节点卡片调度（按 layout 路由）
// ============================================================
function NodeCardBody({ spec }: { spec: NodeSpec }) {
  switch (spec.layout) {
    case 'event':        return <EventLayout spec={spec} />;
    case 'task':         return <TaskLayout spec={spec} />;
    case 'gateway':      return <GatewayLayout spec={spec} />;
    case 'ai-model':     return <AiModelLayout spec={spec} />;
    case 'ai-tool':      return <AiToolLayout spec={spec} />;
    case 'ai-prompt':    return <AiPromptLayout spec={spec} />;
    case 'biz-form':     return <BizFormLayout spec={spec} />;
    case 'biz-notify':   return <BizNotifyLayout spec={spec} />;
    case 'biz-manual':   return <BizNotifyLayout spec={spec} />;
    case 'data-source':  return <DataSourceLayout spec={spec} />;
    case 'data-etl':     return <EtlLayout spec={spec} />;
    case 'trigger':      return <TriggerLayout spec={spec} />;
    case 'control-rule': return <ControlRuleLayout spec={spec} />;
    case 'control-loop': return <ControlLoopLayout spec={spec} />;
    case 'control-flow': return <ControlFlowLayout spec={spec} />;
    case 'control-wait': return <ControlWaitLayout spec={spec} />;
    default:             return null;
  }
}

/** 兼容未自定义 type */
function NodeCardByType({ type }: { type: string }) {
  const spec = NODES_36.find((n) => n.type === type);
  if (!spec) {
    return (
      <div className="ac-node-card-v2">
        <div className="ac-node-card-v2-bar control" />
        <div className="ac-node-card-v2-body">
          <div className="ac-muted">{type}（未定制）</div>
        </div>
      </div>
    );
  }
  return <NodeCardBody spec={spec} />;
}

// ============================================================
// 36 FlowNodeRegistry（带 formMeta.render）
// ============================================================
function buildRegistry(spec: NodeSpec): FlowNodeRegistry {
  return {
    type: spec.type,
    meta: { defaultExpanded: true },
    onAdd: () => ({
      id: `${spec.type}_${nanoid(5)}`,
      type: spec.type,
      data: spec.defaultData ?? {
        title: spec.name,
        content: spec.desc,
      },
    }),
    formMeta: {
      render: () => <NodeCardByType type={spec.type} />,
    },
  };
}

export const NODE_REGISTRIES_36: FlowNodeRegistry[] = NODES_36.map(buildRegistry);

export function groupsByCategory(): Array<{
  key: AccentKey;
  label: string;
  registries: FlowNodeRegistry[];
}> {
  return PALETTE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    registries: g.types
      .map((t) => NODE_REGISTRIES_36.find((r) => r.type === t))
      .filter((r): r is FlowNodeRegistry => Boolean(r)),
  }));
}