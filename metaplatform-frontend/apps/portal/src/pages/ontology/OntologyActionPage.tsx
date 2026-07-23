import React, { useState } from 'react';
import { createPortal as ReactDOM_createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  TestTube, Plus, Search, Calculator, Bell, GitBranch, Plug, Webhook,
  Copy, Trash2, Save, Sparkles, Diamond, RefreshCw, ArrowDownToLine,
  ArrowUpFromLine, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Play, Download,
  X, Minimize2, Settings, Cpu, Database, ShieldCheck, Sliders, FileText,
  Code2, Clock, Hash, Activity, Boxes, Workflow, BookOpen, Layers,
  MousePointerSquareDashed, Grid3x3,
} from 'lucide-react';
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  useNodeRender,
  usePlaygroundTools,
  useService,
  usePlayground,
  WorkflowDocument,
  type WorkflowJSON,
  type WorkflowNodeRegistry,
  type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor';
import { createFreeNodePanelPlugin, WorkflowNodePanelService, type NodePanelRenderProps } from '@flowgram.ai/free-node-panel-plugin';
import { createFreeSnapPlugin } from '@flowgram.ai/free-snap-plugin';
import { createMinimapPlugin } from '@flowgram.ai/minimap-plugin';
import { createFreeHistoryPlugin, useUndoRedo } from '@flowgram.ai/free-history-plugin';
import { createFreeAutoLayoutPlugin } from '@flowgram.ai/free-auto-layout-plugin';
import { createSelectBoxPlugin } from '@flowgram.ai/select-box-plugin';
import { createShortcutsPlugin } from '@flowgram.ai/shortcuts-plugin';
import { createFreeStackPlugin } from '@flowgram.ai/free-stack-plugin';
import { createFreeHoverPlugin } from '@flowgram.ai/free-hover-plugin';
// FixedLayout（官方）
import {
  FixedLayoutEditorProvider,
  useNodeRender as useFixedNodeRender,
  useClientContext,
  usePlaygroundTools as useFixedPlaygroundTools,
} from '@flowgram.ai/fixed-layout-editor';
import { defaultFixedSemiMaterials } from '@flowgram.ai/fixed-semi-materials';
import '@flowgram.ai/free-layout-editor/index.css';
import '@flowgram.ai/fixed-layout-editor/index.css';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select, FormSection } from '@mate/shared';

const ONTOLOGY_TABS = [
  { label: '本体论管理', path: '/ontology' },
  { label: '数据中心', path: '/ontology/datacenter' },
  { label: 'Action 编排', path: '/ontology/action' },
  { label: '知识图谱', path: '/ontology/graph' },
];

// MOCK: Action 列表
const ACTIONS = [
  { id: 'act-1', name: '客户信息查询', type: '查询', icon: Search, enabled: true },
  { id: 'act-2', name: '风险评估计算', type: '计算', icon: Calculator, enabled: true },
  { id: 'act-3', name: '发送审批通知', type: '通知', icon: Bell, enabled: true },
  { id: 'act-4', name: '合同审批流程', type: '审批', icon: GitBranch, enabled: true },
  { id: 'act-5', name: 'ERP 数据同步', type: '数据同步', icon: Plug, enabled: true },
  { id: 'act-6', name: 'Webhook 外部集成', type: '集成', icon: Webhook, enabled: false },
];

// MOCK: 输入参数
const INPUT_PARAMS = [
  { name: 'recipient_id', type: 'String', required: true, desc: '接收人 ID' },
  { name: 'approval_data', type: 'Object', required: true, desc: '审批数据体' },
  { name: 'channel', type: 'Enum', required: false, desc: '通知渠道 (im/email/sms)' },
];

// MOCK: 关联本体概念
const RELATED_CONCEPTS = ['通知', '审批', '用户', '组织'];

// MOCK: 关联触发器
const RELATED_TRIGGERS = ['审批流程 - 提交节点', '审批流程 - 催办节点'];

// MOCK: 节点属性配置
const NODE_PROPS: Record<string, Record<string, unknown>> = {
  'llm-extract': { model: 'doubao-pro-32k', temperature: 0.3, maxTokens: 4096, prompt: '你是一个专业的实体抽取助手...\n1. 姓名\n2. 公司\n3. 职位', inputMap: '$input.raw_data → customer_text', outputMap: '$output.entities → $node-condition.input', id: 'node-llm-extract-01', timeout: '30,000 ms', retry: 3 },
  'input': { id: 'node-input-01', source: 'HTTP POST', format: 'application/json' },
  'condition': { id: 'node-condition-01', expression: 'missing_rate < 0.1', trueLabel: 'Yes', falseLabel: 'No' },
  'loop-complete': { id: 'node-loop-01', tool: 'mcp.data.complete', maxRetries: 3 },
  'tool-ontology': { id: 'node-tool-01', tool: 'mcp.ontology.match', threshold: 0.85 },
  'llm-relation': { id: 'node-llm-rel-01', model: 'doubao-pro-128k', temperature: 0.2, maxTokens: 8192 },
  'output': { id: 'node-output-01', target: 'neo4j://graph/mate-platform', writeMode: 'merge' },
};

// MOCK: 执行历史
const EXEC_HISTORY = [
  { trigger: 'API 调用', time: '07-23 14:32:08', input: '{user_id: 12345}', output: '{success: true}', duration: '234ms', status: 'success' },
  { trigger: 'API 调用', time: '07-23 14:30:15', input: '{user_id: 12344}', output: '{success: true}', duration: '189ms', status: 'success' },
  { trigger: '手动触发', time: '07-23 14:28:42', input: '{user_id: 12343}', output: '{error: ...}', duration: '1.2s', status: 'failed' },
  { trigger: '定时调度', time: '07-23 14:25:00', input: 'batch_id: 8921', output: '{success: true}', duration: '5.4s', status: 'success' },
];

// 节点颜色（按 type 区分）
function colorOf(type: string): { border: string; bg: string; text: string; label: string } {
  switch (type) {
    case 'input': return { border: '#60a5fa', bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', label: '输入' };
    case 'output': return { border: '#60a5fa', bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', label: '输出' };
    case 'llm': return { border: '#a78bfa', bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', label: 'LLM' };
    case 'condition': return { border: '#eab308', bg: 'rgba(234,179,8,0.12)', text: '#eab308', label: '条件' };
    case 'tool': return { border: '#62d178', bg: 'rgba(98,209,120,0.12)', text: '#62d178', label: '工具' };
    case 'loop': return { border: '#fb923c', bg: 'rgba(251,146,60,0.12)', text: '#fb923c', label: '工具' };
    default: return { border: '#71717a', bg: '#1a1a1a', text: '#a1a1aa', label: '节点' };
  }
}

// 节点 ID → 静态标题/描述表（兜底用，FlowGram materials 渲染下 data 可能为空）
const NODE_DATA: Record<string, { title: string; desc: string }> = {
  'input': { title: '接收数据输入', desc: '接收原始客户数据（JSON / CSV）' },
  'llm-extract': { title: 'LLM: 实体抽取', desc: '从客户数据中抽取实体信息' },
  'condition': { title: '数据完整?', desc: '检查必填字段是否齐全' },
  'loop-complete': { title: '工具: 数据补全', desc: '调用 MCP Tool 补全缺失字段' },
  'tool-ontology': { title: '工具: 本体匹配', desc: '将抽取实体与本体概念进行语义匹配' },
  'llm-relation': { title: 'LLM: 关系推理', desc: '推理实体间关系并生成三元组' },
  'output': { title: '知识图谱更新', desc: '将推理结果写入知识图谱 Neo4j' },
};

// 节点库（拖拽源）—— 业务实例：审批流 / 业务流 / AI 协同流程
// 按 https://flowgram.ai/materials/cli.html 官方物料 + 业务自定义
const NODE_LIBRARY: { type: string; title: string; desc: string; icon: typeof ArrowDownToLine; category: string; scenario: string }[] = [
  // ============ 数据 / 业务节点 ============
  { type: 'flow-input',     title: '数据输入',     desc: '接收 HTTP / 消息 / 文件',      icon: ArrowDownToLine, category: '数据源',  scenario: '业务流' },
  { type: 'flow-tool',      title: 'MCP 工具',     desc: '调用 MCP 工具 / 外部 API',     icon: Plug,           category: '数据源',  scenario: '业务流' },
  { type: 'flow-output',    title: '数据输出',     desc: '写入数据库 / 知识图谱',        icon: ArrowUpFromLine, category: '数据目标', scenario: '业务流' },

  // ============ 逻辑控制节点 ============
  { type: 'flow-condition', title: '条件分支',     desc: '基于表达式 Yes/No 路由',       icon: Diamond,        category: '逻辑',   scenario: '审批流' },
  { type: 'flow-loop',      title: '循环节点',     desc: '迭代补全缺失数据',            icon: RefreshCw,      category: '逻辑',   scenario: '业务流' },

  // ============ AI 协同节点 ============
  { type: 'flow-llm',       title: 'LLM 调用',     desc: 'AI 模型推理（实体抽取/生成）', icon: Sparkles,       category: 'AI',     scenario: 'AI' },
  { type: 'flow-llm',       title: 'LLM: 关系推理', desc: '实体间关系推理（RDF 三元组）',  icon: Sparkles,       category: 'AI',     scenario: 'AI' },
  { type: 'flow-llm',       title: 'LLM: 摘要',     desc: '长文本摘要 / 分类',             icon: Sparkles,       category: 'AI',     scenario: 'AI' },

  // ============ 审批专用节点 ============
  { type: 'flow-condition', title: '审批节点',     desc: 'BPMN 人工审批（Flowable 集成）',icon: Diamond,        category: '审批',  scenario: '审批流' },
  { type: 'flow-tool',      title: '网关路由',     desc: '并行 / 排他 / 包容网关',       icon: Plug,           category: '审批',  scenario: '审批流' },
  { type: 'flow-tool',      title: '会签节点',     desc: '多用户并行会签',               icon: Plug,           category: '审批',  scenario: '审批流' },
  { type: 'flow-tool',      title: '或签节点',     desc: '任意一人通过即通过',           icon: Plug,           category: '审批',  scenario: '审批流' },
  { type: 'flow-tool',      title: '抄送节点',     desc: '通知抄送人（不阻塞流程）',     icon: Plug,           category: '审批',  scenario: '审批流' },
  { type: 'flow-loop',      title: '定时器',       desc: '延时 / 定时触发',              icon: RefreshCw,      category: '审批',  scenario: '审批流' },

  // ============ AI 协同高级节点 ============
  { type: 'flow-tool',      title: 'RAG 检索',     desc: '向量库检索增强生成',            icon: Plug,           category: 'AI',     scenario: 'AI' },
  { type: 'flow-tool',      title: 'Agent 调用',   desc: '调用子 Agent（多智能体协同）',  icon: Plug,           category: 'AI',     scenario: 'AI' },
  { type: 'flow-tool',      title: '函数调用',     desc: 'Function Calling / Tool Use',   icon: Plug,           category: 'AI',     scenario: 'AI' },
];

// 节点类型 → 元信息（用于全屏模式下的属性面板分组）
const NODE_TYPE_META: Record<string, { category: string; icon: typeof Cpu; sections: string[] }> = {
  'input':     { category: '数据源', icon: Database,    sections: ['基本信息', '数据契约', '执行配置', '权限审计'] },
  'llm':       { category: 'AI 模型', icon: Sparkles,    sections: ['基本信息', '模型配置', 'Prompt 编辑', '输入映射', '输出映射', '执行配置', '权限审计'] },
  'condition': { category: '逻辑控制', icon: Diamond,    sections: ['基本信息', '条件表达式', '分支映射', '执行配置', '权限审计'] },
  'tool':      { category: 'MCP 工具', icon: Plug,       sections: ['基本信息', '工具选择', '参数配置', '输出映射', '执行配置', '权限审计'] },
  'loop':      { category: '循环控制', icon: RefreshCw,  sections: ['基本信息', '循环条件', '迭代体配置', '执行配置', '权限审计'] },
  'output':    { category: '数据目标', icon: Database,   sections: ['基本信息', '数据契约', '写入策略', '执行配置', '权限审计'] },
};

// 节点 ID → 配置项 mock 数据（用于全屏属性面板展示）
const NODE_DETAIL_PROPS: Record<string, Record<string, { label: string; value: React.ReactNode; mono?: boolean; type?: 'text' | 'json' | 'list' }>> = {
  'input': {
    id: { label: '节点 ID', value: 'node-input-01', mono: true },
    source: { label: '数据源', value: 'HTTP POST /api/v1/customers/import', mono: true },
    format: { label: '数据格式', value: 'application/json', mono: true },
    schema: { label: '数据 Schema', value: '{ type: "object", properties: { id, name, company, ... } }', type: 'json' },
    sample: { label: '示例数据', value: '{ "id": 12345, "name": "张三", "company": "字节跳动", "email": "zhangsan@bytedance.com" }', type: 'json' },
    timeout: { label: '超时时间', value: '10,000 ms' },
    auth: { label: '鉴权', value: 'Bearer Token' },
  },
  'llm-extract': {
    id: { label: '节点 ID', value: 'node-llm-extract-01', mono: true },
    model: { label: '模型', value: 'doubao-pro-32k', mono: true },
    temperature: { label: 'Temperature', value: '0.3', mono: true },
    maxTokens: { label: '最大 Token', value: '4096', mono: true },
    prompt: { label: 'System Prompt', value: '你是一个专业的实体抽取助手。请从客户原始数据中抽取以下字段：\n1. 姓名 (name)\n2. 公司 (company)\n3. 职位 (title)\n4. 邮箱 (email)\n5. 手机 (phone)\n\n输出为 JSON 格式。', type: 'json' },
    inputMap: { label: '输入映射', value: '$input.raw_data → prompt.context', mono: true },
    outputMap: { label: '输出映射', value: '$output.entities → condition.input', mono: true },
    timeout: { label: '超时时间', value: '30,000 ms' },
    retry: { label: '失败重试', value: '3 次' },
  },
  'condition': {
    id: { label: '节点 ID', value: 'node-condition-01', mono: true },
    expression: { label: '条件表达式', value: 'missing_rate < 0.1', mono: true },
    trueLabel: { label: 'Yes 分支', value: '→ tool-ontology', mono: true },
    falseLabel: { label: 'No 分支', value: '→ loop-complete', mono: true },
    branches: { label: '分支', value: '是 / 否', type: 'list' },
  },
  'loop-complete': {
    id: { label: '节点 ID', value: 'node-loop-01', mono: true },
    tool: { label: '调用工具', value: 'mcp.data.complete', mono: true },
    maxRetries: { label: '最大重试', value: '3 次' },
    inputMap: { label: '输入映射', value: '$input.missing_fields → tool.fill_data', mono: true },
    outputMap: { label: '输出映射', value: '$output.filled_data → loop-back', mono: true },
  },
  'tool-ontology': {
    id: { label: '节点 ID', value: 'node-tool-01', mono: true },
    tool: { label: '调用工具', value: 'mcp.ontology.match', mono: true },
    threshold: { label: '相似度阈值', value: '0.85', mono: true },
    inputMap: { label: '输入映射', value: '$input.entities → tool.match', mono: true },
    outputMap: { label: '输出映射', value: '$output.matched_concepts → llm-relation.input', mono: true },
  },
  'llm-relation': {
    id: { label: '节点 ID', value: 'node-llm-rel-01', mono: true },
    model: { label: '模型', value: 'doubao-pro-128k', mono: true },
    temperature: { label: 'Temperature', value: '0.2', mono: true },
    maxTokens: { label: '最大 Token', value: '8192', mono: true },
    prompt: { label: 'System Prompt', value: '基于已匹配的本体概念，推断实体间关系并生成 RDF 三元组。', type: 'json' },
    outputMap: { label: '输出映射', value: '$output.triples → output.input', mono: true },
  },
  'output': {
    id: { label: '节点 ID', value: 'node-output-01', mono: true },
    target: { label: '写入目标', value: 'neo4j://graph/mate-platform', mono: true },
    writeMode: { label: '写入模式', value: 'merge (存在则更新)' },
    schema: { label: '数据 Schema', value: '{ type: "object", properties: { subject, predicate, object, confidence } }', type: 'json' },
  },
};

// 全屏编辑 Modal：流程编排编辑器
// 主题：UI 是黑色 → 图内元素（线/边框）使用**浅色**（#a1a1aa 灰 + 类型色饱和度调高）
// 浅色 UI 时 → 图内元素使用**黑色**（主题色值由 useThemeMode 决定）
function FlowFullscreenEditor({
  onClose,
  initialData,
  nodeRegistries,
  CustomBaseNode: CustomNode,
}: {
  onClose: () => void;
  initialData: WorkflowJSON;
  nodeRegistries: WorkflowNodeRegistry[];
  CustomBaseNode: React.ComponentType;
}) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null); // 默认无选中 → 隐藏属性面板
  const [activeSection, setActiveSection] = useState('基本信息');
  const [themeMode] = useState<'dark' | 'light'>('dark'); // 演示固定为深色
  const [layoutMode, setLayoutMode] = useState<'free' | 'fixed'>('fixed'); // 布局模式：默认固定布局

  // 主题取反色配置：UI 黑 → 图内元素 = 浅边框 + 黑色背景 + 浅色文字
  const palette = themeMode === 'dark'
    ? {
        // 图内元素颜色（与深色 UI 形成对比）
        canvasBg: 'transparent',
        lineDefault: '#52525b',  // 暗灰连线
        lineDrawing: '#a78bfa',
        lineHovered: '#a1a1aa',
        lineSelected: '#a78bfa',
        gridColor: '#262626',
        // 节点配色：边框浅色 + 黑色背景 + 浅色文字
        nodeBorder: '#e4e4e7',   // 浅色边框（与黑色 UI 对比）
        nodeBg: '#000000',        // **黑色背景**
        nodeText: '#fafafa',      // 浅色文字
        nodeDesc: 'rgba(250,250,250,0.7)',
        nodeShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        // 节点类型色保留（仅用于 icon/label/选中态，不充作底色）
        typeColor: (type: string) => {
          const map: Record<string, string> = {
            input: '#3b82f6', output: '#3b82f6', llm: '#8b5cf6',
            condition: '#eab308', tool: '#22c55e', loop: '#f97316',
          };
          return map[type] || '#a1a1aa';
        },
        // 节点类型 pill：浅色边框 + 黑色底 + 类型色文字
        nodeLabel: (type: string) => {
          const map: Record<string, { bg: string; text: string; label: string }> = {
            input: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: '输入' },
            output: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: '输出' },
            llm: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', label: 'LLM' },
            condition: { bg: 'rgba(234,179,8,0.15)', text: '#facc15', label: '条件' },
            tool: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', label: '工具' },
            loop: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c', label: '工具' },
          };
          return map[type] || { bg: 'rgba(161,161,170,0.15)', text: '#a1a1aa', label: '节点' };
        },
        modalBg: 'rgba(0,0,0,0.92)',          // 全屏遮罩（保留暗）
        modalPanel: '#0a0a0a',                // 全屏面板（仍然深）
        modalBorder: '#262626',
        panelHeader: '#171717',
        panelText: '#fafafa',
        panelTextMuted: '#a1a1aa',
        panelMuted: '#1a1a1a',
        panelSection: '#0a0a0a',
      }
    : {
        // 浅色 UI 时 → 图内元素反转为白底深色
        canvasBg: 'transparent',
        lineDefault: '#a1a1aa',
        lineDrawing: '#7c3aed',
        lineHovered: '#525252',
        lineSelected: '#7c3aed',
        gridColor: '#e4e4e7',
        nodeBorder: '#27272a',   // 深色边框（与浅色 UI 对比）
        nodeBg: '#ffffff',        // **白色背景**
        nodeText: '#18181b',      // 深色文字
        nodeDesc: 'rgba(24,24,27,0.6)',
        nodeShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
        typeColor: (type: string) => {
          const map: Record<string, string> = {
            input: '#3b82f6', output: '#3b82f6', llm: '#8b5cf6',
            condition: '#ca8a04', tool: '#16a34a', loop: '#ea580c',
          };
          return map[type] || '#525252';
        },
        nodeLabel: (type: string) => {
          const map: Record<string, { bg: string; text: string; label: string }> = {
            input: { bg: 'rgba(59,130,246,0.12)', text: '#1d4ed8', label: '输入' },
            output: { bg: 'rgba(59,130,246,0.12)', text: '#1d4ed8', label: '输出' },
            llm: { bg: 'rgba(139,92,246,0.12)', text: '#6d28d9', label: 'LLM' },
            condition: { bg: 'rgba(202,138,4,0.12)', text: '#a16207', label: '条件' },
            tool: { bg: 'rgba(22,163,74,0.12)', text: '#15803d', label: '工具' },
            loop: { bg: 'rgba(234,88,12,0.12)', text: '#c2410c', label: '工具' },
          };
          return map[type] || { bg: 'rgba(82,82,91,0.12)', text: '#52525b', label: '节点' };
        },
        modalBg: 'rgba(255,255,255,0.92)',
        modalPanel: '#fafafa',
        modalBorder: '#e4e4e7',
        panelHeader: '#f4f4f5',
        panelText: '#18181b',
        panelTextMuted: '#71717a',
        panelMuted: '#f4f4f5',
        panelSection: '#ffffff',
      };

  // 选中节点类型映射
  const activeType = (() => {
    if (!activeNodeId) return 'input';
    if (activeNodeId.includes('llm')) return 'llm';
    if (activeNodeId.includes('condition')) return 'condition';
    if (activeNodeId.includes('tool')) return 'tool';
    if (activeNodeId.includes('loop')) return 'loop';
    if (activeNodeId === 'output') return 'output';
    return 'input';
  })();
  const meta = NODE_TYPE_META[activeType] || NODE_TYPE_META['input'];
  const TypeIcon = meta.icon;
  const activeData = (activeNodeId ? NODE_DETAIL_PROPS[activeNodeId] : null) || {};

  // 渲染指定 section 的字段
  const renderSectionFields = (section: string) => {
    // 简单按 section 名称字段映射
    const sectionFields: Record<string, string[]> = {
      '基本信息': ['id'],
      '模型配置': ['model', 'temperature', 'maxTokens'],
      'Prompt 编辑': ['prompt'],
      '输入映射': ['inputMap'],
      '输出映射': ['outputMap'],
      '执行配置': ['timeout', 'retry'],
      '权限审计': [],
      '数据契约': ['format', 'schema', 'sample'],
      '条件表达式': ['expression', 'branches'],
      '分支映射': ['trueLabel', 'falseLabel'],
      '工具选择': ['tool'],
      '参数配置': ['maxRetries', 'threshold'],
      '循环条件': ['tool'],
      '迭代体配置': ['inputMap', 'outputMap'],
      '写入策略': ['target', 'writeMode'],
      '数据源': ['source', 'format'],
    };
    const keys = sectionFields[section] || [];
    return keys.map((k) => {
      const f = activeData[k];
      if (!f) return null;
      return (
        <div key={k} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: palette.panelTextMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {k === 'id' && <Hash style={{ width: 12, height: 12 }} />}
            {k === 'timeout' && <Clock style={{ width: 12, height: 12 }} />}
            {k === 'retry' && <RefreshCw style={{ width: 12, height: 12 }} />}
            {k === 'prompt' && <FileText style={{ width: 12, height: 12 }} />}
            {k === 'model' && <Cpu style={{ width: 12, height: 12 }} />}
            {k === 'temperature' && <Sliders style={{ width: 12, height: 12 }} />}
            {k === 'maxTokens' && <Sliders style={{ width: 12, height: 12 }} />}
            {k === 'inputMap' && <Code2 style={{ width: 12, height: 12 }} />}
            {k === 'outputMap' && <Code2 style={{ width: 12, height: 12 }} />}
            {k === 'schema' && <Code2 style={{ width: 12, height: 12 }} />}
            {k === 'sample' && <Code2 style={{ width: 12, height: 12 }} />}
            {k === 'source' && <Database style={{ width: 12, height: 12 }} />}
            {k === 'target' && <Database style={{ width: 12, height: 12 }} />}
            {k === 'tool' && <Plug style={{ width: 12, height: 12 }} />}
            {k === 'expression' && <Diamond style={{ width: 12, height: 12 }} />}
            {k === 'trueLabel' && <GitBranch style={{ width: 12, height: 12 }} />}
            {k === 'falseLabel' && <GitBranch style={{ width: 12, height: 12 }} />}
            {k === 'branches' && <GitBranch style={{ width: 12, height: 12 }} />}
            {k === 'writeMode' && <Database style={{ width: 12, height: 12 }} />}
            {k === 'format' && <FileText style={{ width: 12, height: 12 }} />}
            {k === 'threshold' && <Sliders style={{ width: 12, height: 12 }} />}
            {k === 'maxRetries' && <RefreshCw style={{ width: 12, height: 12 }} />}
            <span>{f.label}</span>
          </div>
          {f.type === 'json' ? (
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: palette.panelMuted,
              border: `1px solid ${palette.modalBorder}`,
              borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: 12, color: palette.panelText,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6,
            }}>{String(f.value)}</pre>
          ) : f.type === 'list' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {String(f.value).split(' / ').map((s) => (
                <span key={s} style={{ padding: '4px 10px', background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, borderRadius: 4, fontSize: 12, color: palette.panelText }}>{s}</span>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '8px 12px',
              background: palette.panelMuted,
              border: `1px solid ${palette.modalBorder}`,
              borderRadius: 6,
              fontSize: 13, color: palette.panelText,
              fontFamily: f.mono ? 'var(--font-mono)' : 'var(--font-sans)',
            }}>{f.value}</div>
          )}
        </div>
      );
    });
  };

  // Modal 打开时注入反色 CSS，关闭时移除（避免污染只读视图）
  React.useEffect(() => {
    const style = document.createElement('style');
    style.id = 'flowgram-fullscreen-override';
    style.textContent = `
      .gedit-grid-svg circle { stroke: ${palette.gridColor} !important; fill-opacity: 0.5 !important; }
      .gedit-playground, .gedit-flow-background-layer { background-color: ${palette.modalPanel} !important; }
      .gedit-flow-activity-node, .gedit-flow-render-node { background: transparent !important; min-width: 80px !important; min-height: 40px !important; }
      .gedit-flow-activity-node[data-node-id] { width: 220px !important; height: 88px !important; }
      .gedit-flow-activity-node[data-node-id="condition"] { width: 200px !important; }
    `;
    document.head.appendChild(style);
    return () => {
      const s = document.getElementById('flowgram-fullscreen-override');
      if (s) s.remove();
    };
  }, [palette]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: palette.modalBg, backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
        animation: 'fadeIn .2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: palette.modalPanel,
          border: `1px solid ${palette.modalBorder}`,
          margin: 16, borderRadius: 'var(--radius)', overflow: 'hidden',
        }}
      >
        {/* 顶部工具栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
          background: palette.panelHeader, borderBottom: `1px solid ${palette.modalBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.panelText, fontSize: 14, fontWeight: 600 }}>
            <Workflow style={{ width: 16, height: 16, color: palette.lineSelected }} />
            流程编排 · 全屏编辑
          </div>
          {/* 布局切换 segmented control */}
          <div style={{ display: 'flex', background: palette.panelMuted, borderRadius: 6, padding: 2, gap: 2 }}>
            <button
              onClick={() => setLayoutMode('fixed')}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 500,
                background: layoutMode === 'fixed' ? palette.lineSelected : 'transparent',
                color: layoutMode === 'fixed' ? '#ffffff' : palette.panelTextMuted,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              title="固定布局：节点位置由 BPMN 引擎自动布局（BPMN 风格，适合审批/业务流程）"
            ><Grid3x3 style={{ width: 12, height: 12 }} />固定布局</button>
            <button
              onClick={() => setLayoutMode('free')}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 500,
                background: layoutMode === 'free' ? palette.lineSelected : 'transparent',
                color: layoutMode === 'free' ? '#ffffff' : palette.panelTextMuted,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              title="自由布局：节点可任意拖动（适合 AI 协同流程）"
            ><MousePointerSquareDashed style={{ width: 12, height: 12 }} />自由布局</button>
          </div>
          <div style={{ width: 1, height: 20, background: palette.modalBorder }} />
          <select
            style={{ background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, borderRadius: 6, color: palette.panelText, fontSize: 13, padding: '6px 12px', outline: 'none', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            defaultValue="客户数据清洗 Action"
          >
            <option>客户数据清洗 Action</option>
            <option>订单风险评估 Action</option>
          </select>
          {/* 撤销/重做 官方组件 —— 必须在 Provider 内 */}
          <div ref={(el) => setFlowgramSlot('undoSlot', el)}></div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: palette.panelTextMuted }}>
            <div ref={(el) => setFlowgramSlot('counterSlot', el)}></div>
          </div>
          <div style={{ width: 1, height: 20, background: palette.modalBorder }} />
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, color: palette.panelText, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><Play style={{ width: 14, height: 14 }} />运行调试</button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, color: palette.panelText, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}><Download style={{ width: 14, height: 14 }} />导出</button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', background: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}><Save style={{ width: 14, height: 14, color: '#ffffff' }} />保存</button>
          <button
            onClick={onClose}
            title="退出全屏"
            style={{ width: 32, height: 32, border: `1px solid ${palette.modalBorder}`, background: palette.panelMuted, color: palette.panelText, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          ><Minimize2 style={{ width: 14, height: 14 }} /></button>
        </div>

        {/* 主体：左侧节点库 + 中间大画布 + 右侧节点属性面板 */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* 画布（左侧节点库作为 Provider 的 leftSlot 传入）—— 根据 layoutMode 切换 fixed / free */}
          {layoutMode === 'fixed' ? (
            <FixedLayoutEditor
              initialData={initialData}
              palette={palette}
              onSelectNode={setActiveNodeId}
              leftSlot={<FixedNodeLibrary palette={palette} />}
            />
          ) : (
            <FullscreenFlowEditor
              initialData={initialData}
              nodeRegistries={nodeRegistries}
              CustomNode={CustomNode}
              palette={palette}
              onSelectNode={setActiveNodeId}
              leftSlot={<FreeNodeLibrary palette={palette} />}
            />
          )}

          {/* 节点属性面板（右侧）—— 默认隐藏，点击节点才显示 */}
          {activeNodeId && (
          <div style={{
            width: 380, flexShrink: 0, background: palette.modalPanel,
            borderLeft: `1px solid ${palette.modalBorder}`,
            display: 'flex', flexDirection: 'column', zIndex: 30,
          }}>
            {/* 头部：节点标识 */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${palette.modalBorder}`, background: palette.panelHeader }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.panelText, fontSize: 15, fontWeight: 600 }}>
                  <Settings style={{ width: 16, height: 16, color: palette.lineSelected }} />
                  节点配置
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, background: palette.panelMuted, color: palette.panelText, fontSize: 11, fontWeight: 500 }}>
                  <TypeIcon style={{ width: 12, height: 12 }} />
                  {meta.category}
                </span>
                <button
                  onClick={() => setActiveNodeId(null)}
                  title="关闭面板"
                  style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: palette.panelTextMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = palette.panelMuted; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                ><X style={{ width: 14, height: 14 }} /></button>
              </div>
              <div style={{ fontSize: 13, color: palette.panelText, fontWeight: 500 }}>
                {NODE_DATA[activeNodeId]?.title || activeNodeId}
              </div>
              <div style={{ fontSize: 12, color: palette.panelTextMuted, marginTop: 2 }}>
                {NODE_DATA[activeNodeId]?.desc || ''}
              </div>
            </div>

            {/* 分组 Section tab */}
            <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: `1px solid ${palette.modalBorder}`, overflowX: 'auto' }}>
              {meta.sections.map((s) => {
                const active = activeSection === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSection(s)}
                    style={{
                      padding: '6px 12px', fontSize: 12,
                      color: active ? palette.panelText : palette.panelTextMuted,
                      background: active ? palette.panelMuted : 'transparent',
                      border: `1px solid ${active ? palette.modalBorder : 'transparent'}`,
                      borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                      fontWeight: active ? 600 : 500,
                    }}
                  >{s}</button>
                );
              })}
            </div>

            {/* 字段内容 */}
            <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
              {renderSectionFields(activeSection)}
            </div>

            {/* 底部操作 */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${palette.modalBorder}`, background: palette.panelHeader }}>
              <button style={{ flex: 1, height: 32, padding: '0 12px', background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, color: palette.panelText, borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Copy style={{ width: 14, height: 14 }} />复制节点</button>
              <button style={{ flex: 1, height: 32, padding: '0 12px', background: palette.panelMuted, border: `1px solid ${palette.modalBorder}`, color: palette.panelText, borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Trash2 style={{ width: 14, height: 14 }} />删除节点</button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 全屏画布包装器：传入 palette 给 CustomNode 用（通过 React Context）
type FlowPalette = {
  canvasBg: string;
  lineDefault: string; lineDrawing: string; lineHovered: string; lineSelected: string;
  gridColor: string;
  // 节点配色：浅边框 + 黑/白背景 + 对比文字
  nodeBorder: string;
  nodeBg: string;          // 纯黑 / 纯白
  nodeText: string;
  nodeDesc: string;
  nodeShadow: string;
  typeColor: (type: string) => string;  // 类型色（用于 icon/label/选中态，不充作底色）
  nodeLabel: (type: string) => { bg: string; text: string; label: string };
  modalBg: string; modalPanel: string; modalBorder: string;
  panelHeader: string; panelText: string; panelTextMuted: string; panelMuted: string; panelSection: string;
};
const FlowPaletteContext = React.createContext<FlowPalette | null>(null);

// 暴露当前 ctx.document 给父组件（用于左侧节点库触发 addNode）
const DocumentContext = React.createContext<{ addNode: (type: string, x: number, y: number) => void } | null>(null);

// 节点库分组（按业务域划分）
// 数据：input/output, 工具：tool/loop, AI：llm, 逻辑：condition
// 三类业务场景：审批流 / 业务流 / AI 协同流程

// 官方节点面板渲染器：调用 WorkflowNodePanelService.callNodePanel 后会触发 addNode
function MyNodePanelRenderer(props: NodePanelRenderProps & { palette: FlowPalette }) {
  const { onSelect, onClose, palette } = props;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        background: palette.modalPanel,
        border: `1px solid ${palette.modalBorder}`,
        borderRadius: 8,
        padding: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))',
        gap: 4,
        minWidth: 380,
        pointerEvents: 'auto',
      }}
    >
      {NODE_LIBRARY.map((n) => {
        const Icon = n.icon;
        return (
          <div
            key={n.type}
            onClick={() => onSelect({ nodeType: n.type, selectEvent: new MouseEvent('click') as unknown as React.MouseEvent })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6,
              background: palette.panelMuted,
              border: `1px solid ${palette.modalBorder}`,
              cursor: 'pointer', color: palette.panelText, fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = palette.lineSelected; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = palette.modalBorder; }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: palette.typeColor(n.type.replace('flow-', '')) + '20',
              color: palette.typeColor(n.type.replace('flow-', '')),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon style={{ width: 12, height: 12 }} />
            </div>
            <span style={{ fontWeight: 500 }}>{n.title}</span>
          </div>
        );
      })}
      <button
        onClick={onClose}
        style={{
          gridColumn: '1 / -1',
          padding: '6px',
          background: 'transparent', color: palette.panelTextMuted,
          border: 'none', cursor: 'pointer', fontSize: 11,
        }}
      >取消 (Esc)</button>
    </div>
  );
}

// 官方 Tools 组件：撤销/重做（顶部工具栏）+ 缩放/适应/自动布局（画布顶部悬浮）
// 必须放在 FreeLayoutEditorProvider 内
function makeBtn(palette: FlowPalette, title: string, icon: React.ReactNode, onClick: () => void, disabled = false) {
  return (
    <button
      key={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: palette.panelMuted,
        border: `1px solid ${palette.modalBorder}`,
        color: disabled ? palette.panelTextMuted : palette.panelText,
        borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >{icon}</button>
  );
}

// 缩放/适应/自动布局按钮（画布顶部悬浮）
function ZoomToolsInner() {
  const tools = usePlaygroundTools();
  const playground = usePlayground();
  const palette = React.useContext(FlowPaletteContext);
  const [zoomSlot, setZoomSlot] = React.useState<HTMLElement | null>(null);
  // 用 playground config 读取 zoom（响应式：每次交互后 forceUpdate）
  const [zoom, setZoom] = React.useState(1);
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const check = () => setZoomSlot(window.__flowgram_slots__?.zoomSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    const update = () => {
      const cfg = (playground as unknown as { config?: { zoom?: number } }).config;
      if (cfg && typeof cfg.zoom === 'number') setZoom(cfg.zoom);
    };
    update();
    // 轮询兜底（部分 FlowGram 版本不暴露 onZoom 事件）
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [playground]);
  // wrap zoom 操作：调用后立即 force
  const handleZoom = (fn: () => void) => () => {
    fn();
    // 立即读新值
    setTimeout(() => {
      const cfg = (playground as unknown as { config?: { zoom?: number } }).config;
      if (cfg && typeof cfg.zoom === 'number') setZoom(cfg.zoom);
      force();
    }, 50);
  };
  if (!palette || !zoomSlot) return null;
  return ReactDOM_createPortal(
    <div
      style={{
        display: 'flex', gap: 4, alignItems: 'center',
        padding: 4, background: palette.modalPanel, border: `1px solid ${palette.modalBorder}`,
        borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {makeBtn(palette, '缩小 (Cmd+-)', <ZoomOut style={{ width: 14, height: 14 }} />, handleZoom(() => tools.zoomout()))}
      <div style={{ minWidth: 36, textAlign: 'center', fontSize: 11, color: palette.panelTextMuted, fontFamily: 'var(--font-mono)' }}>
        {Math.round(zoom * 100)}%
      </div>
      {makeBtn(palette, '放大 (Cmd+=)', <ZoomIn style={{ width: 14, height: 14 }} />, handleZoom(() => tools.zoomin()))}
      <div style={{ width: 1, height: 20, background: palette.modalBorder }} />
      {makeBtn(palette, '适应画布', <Maximize2 style={{ width: 14, height: 14 }} />, handleZoom(() => tools.fitView()))}
      {makeBtn(palette, '自动布局', <Grid3x3 style={{ width: 14, height: 14 }} />, handleZoom(() => tools.autoLayout()))}
    </div>,
    zoomSlot
  );
}

// Slot 渲染器（保留为兼容层，但实际使用 FlowSlotsContext）
// 用 window 全局对象桥接 ref 跨 Provider 边界
declare global {
  interface Window {
    __flowgram_slots__?: {
      undoSlot: HTMLElement | null;
      counterSlot: HTMLElement | null;
      zoomSlot: HTMLElement | null;
    };
  }
}
if (typeof window !== 'undefined' && !window.__flowgram_slots__) {
  window.__flowgram_slots__ = { undoSlot: null, counterSlot: null, zoomSlot: null };
}
function setFlowgramSlot(key: 'undoSlot' | 'counterSlot' | 'zoomSlot', el: HTMLElement | null) {
  if (typeof window !== 'undefined' && window.__flowgram_slots__) {
    window.__flowgram_slots__[key] = el;
  }
}

// FixedLayout 节点渲染器（官方 API 风格 + 深色主题）
// 参考官方 BaseNodeStyle 风格：1px 边框 + 8px 圆角 + 浅阴影 + 选中时外发光
function FixedBaseNode() {
  const nodeRender = useFixedNodeRender();
  const n = nodeRender.node;
  const palette = React.useContext(FlowPaletteContext);
  const activeId = React.useContext(FixedActiveContext);
  const onSelect = React.useContext(SelectionContext);
  if (!palette) return null;

  const nodeData = (nodeRender.data as { title?: string; desc?: string; originalType?: string } | undefined) || {};
  const idToType: Record<string, string> = {
    input: 'input', output: 'output',
    'llm-extract': 'llm', 'llm-relation': 'llm',
    condition: 'condition', 'loop-complete': 'loop', 'tool-ontology': 'tool',
  };
  const rawType = nodeData.originalType || idToType[n.id] || n.type || 'input';
  const shortType = String(rawType).replace(/^flow-/, '').toLowerCase();
  const display = (NODE_DATA[n.id] as { title?: string; desc?: string } | undefined) || nodeData;
  const labelInfo = palette.nodeLabel(shortType);
  const tColor = palette.typeColor(shortType);
  const isSelected = activeId === n.id;
  const isActivated = nodeRender.activated;
  const nodeWidth = shortType === 'condition' ? 200 : 220;

  return (
    <div
      className="fixed-base-node"
      style={{
        width: nodeWidth, minHeight: 80,
        background: '#0a0a0a',
        border: `1px solid ${isSelected ? tColor : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grab',
        color: '#fafafa',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 5,
        fontFamily: 'var(--font-sans)',
        boxShadow: isSelected
          ? `0 0 0 2px ${tColor}50, 0 0 0 1px ${tColor}, 0 0 28px ${tColor}50, 0 6px 16px rgba(0,0,0,0.45)`
          : isActivated
          ? `0 0 0 1px ${tColor}70, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 1px 2px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
        transition: 'box-shadow .18s, border-color .18s, transform .12s',
        transform: isSelected ? 'translateY(-1px)' : 'translateY(0)',
        opacity: nodeRender.dragging ? 0.35 : 1,
      }}
      onMouseDown={(e) => {
        onSelect?.(n.id);
        nodeRender.startDrag(e);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 节点类型 pill —— 官方深色风格：半透明背景 + 类型色文字 */}
        <div style={{
          width: 26, height: 22, borderRadius: 5,
          background: labelInfo.bg,
          color: labelInfo.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          fontWeight: 700, fontSize: 11, letterSpacing: '0.02em',
        }}>{labelInfo.label}</div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#fafafa', flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{display.title || n.id}</div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.55)', lineHeight: 1.4 }}>{display.desc || ' '}</div>
    </div>
  );
}

// 固定布局编辑器（FixedLayout）
function FixedLayoutEditor({
  initialData, palette, onSelectNode, leftSlot,
}: {
  initialData: WorkflowJSON;
  palette: FlowPalette;
  onSelectNode: (id: string) => void;
  leftSlot?: React.ReactNode;
}) {
  // activeNodeId 用于让 FixedBaseNode 知道哪个被选中（高亮发光）
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // 合并 onSelectNode：点击节点时同时更新 activeId
  const handleSelect = React.useCallback((id: string) => {
    setActiveId(id);
    onSelectNode(id);
  }, [onSelectNode]);

  return (
    <FlowPaletteContext.Provider value={palette}>
      <FixedActiveContext.Provider value={activeId}>
        <SelectionContext.Provider value={handleSelect}>
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {leftSlot}
            <div style={{ flex: 1, minWidth: 0, position: 'relative', background: palette.modalPanel }}>
              {/* 注入 fixed-layout 深色主题 CSS（官方默认白底覆盖为黑底+圆点网格） */}
              <FixedLayoutDarkCSS />
              <FixedLayoutEditorProvider
                initialData={initialData}
                selectBox={{}}
                dragdrop={{}}
                history={{}}
                nodeRegistries={[
                  { type: 'input' },
                  { type: 'output' },
                  { type: 'custom' },
                ]}
                materials={{
                  renderDefaultNode: FixedBaseNode,
                  components: defaultFixedSemiMaterials,
                }}
                onAllLayersRendered={(ctx) => {
                  setTimeout(() => {
                    try {
                      const bounds = ctx.document.root.bounds;
                      if (bounds) {
                        (ctx.playground.config as { fitView?: (b: unknown) => void }).fitView?.(bounds.pad(30));
                      }
                    } catch { /* ignore */ }
                  }, 10);
                }}
              >
                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <EditorRenderer style={{ width: '100%', height: '100%' }} />
                    <div ref={(el) => setFlowgramSlot('zoomSlot', el)} style={{ position: 'absolute', top: 12, left: 0, right: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center', zIndex: 50 }}></div>
                  </div>
                </div>
                <FixedToolsWithProvider />
              </FixedLayoutEditorProvider>
            </div>
          </div>
        </SelectionContext.Provider>
      </FixedActiveContext.Provider>
    </FlowPaletteContext.Provider>
  );
}

// FixedBaseNode 用 React Context 拿到当前 activeId
const FixedActiveContext = React.createContext<string | null>(null);

// 固定布局深色主题 CSS 覆盖（用 <style> 注入 <head>，避免污染其它视图）
function FixedLayoutDarkCSS() {
  React.useEffect(() => {
    if (document.getElementById('fixed-layout-dark-css')) return;
    const style = document.createElement('style');
    style.id = 'fixed-layout-dark-css';
    style.textContent = `
      /* fixed-layout 深色主题：覆盖官方默认白底 + 网格圆点 */
      .gedit-playground {
        --g-editor-background: #0a0a0a !important;
        --g-selection-background: #a78bfa !important;
        background-color: #0a0a0a !important;
      }
      .gedit-grid-svg circle {
        fill: rgba(255,255,255,0.22) !important;
      }
      .gedit-grid-svg circle.gedit-grid-dot-mini {
        fill: rgba(167,139,250,0.15) !important;
      }
      /* 节点连线（line）暗色 —— 兼容 fixed 和 free 两套 */
      .gedit-flow-line, .gedit-flow-activity-line, .gedit-transition-line,
      .gedit-flow-line path, .gedit-flow-activity-line path {
        stroke: #6b7280 !important;
        stroke-width: 1.5px !important;
      }
      .gedit-flow-line.ge-flow-line-active, .gedit-transition-line-active, .gedit-flow-line-active,
      .gedit-flow-line:hover, .gedit-transition-line:hover, .gedit-flow-activity-line:hover {
        stroke: #a78bfa !important;
        stroke-width: 2px !important;
        filter: drop-shadow(0 0 4px rgba(167,139,250,0.4));
      }
      /* 连线端点箭头 */
      .gedit-flow-line-arrow {
        fill: #6b7280 !important;
      }
      /* 选框 */
      .gedit-selector-box {
        outline-color: rgba(167,139,250,0.6) !important;
        background-color: rgba(167,139,250,0.08) !important;
      }
      .gedit-selector-bounds-background {
        background-color: rgba(167,139,250,0.06) !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      const s = document.getElementById('fixed-layout-dark-css');
      if (s) s.remove();
    };
  }, []);
  return null;
}

function FullscreenFlowEditor({
  initialData, nodeRegistries, CustomNode, palette, onSelectNode, leftSlot,
}: {
  initialData: WorkflowJSON;
  nodeRegistries: WorkflowNodeRegistry[];
  CustomNode: React.ComponentType;
  palette: FlowPalette;
  onSelectNode: (id: string) => void;
  leftSlot?: React.ReactNode;
}) {
  // 官方插件组合（按 demo-free-layout 顺序）
  const plugins = React.useMemo(() => () => [
    createFreeNodePanelPlugin({
      renderer: (props) => <MyNodePanelRenderer {...props} palette={palette} />,
    }),
    createFreeSnapPlugin({}),
    createMinimapPlugin({}),
    createFreeHistoryPlugin({}),
    createFreeAutoLayoutPlugin({}),
    createSelectBoxPlugin({}),
    // createShortcutsPlugin({}),  // 需要 ShortcutsContribution 对象，先关闭
    createFreeStackPlugin({}),
    createFreeHoverPlugin({}),
  ], [palette]);

  return (
    <FlowPaletteContext.Provider value={palette}>
      <SelectionContext.Provider value={onSelectNode}>
        <FreeLayoutEditorProvider
          plugins={plugins}
          initialData={initialData}
          nodeRegistries={nodeRegistries}
          nodeEngine={{ enable: true }}
          background
          lineColor={{
            hidden: 'transparent',
            default: palette.lineDefault,
            drawing: palette.lineDrawing,
            hovered: palette.lineHovered,
            selected: palette.lineSelected,
            error: '#ff6166',
            flowing: palette.lineDefault,
          }}
          materials={{ components: {}, renderDefaultNode: FullscreenBaseNodeWithSelect }}
          playground={{ preventGlobalGesture: true }}
          onAllLayersRendered={(ctx) => {
            try { (ctx.playground as { zoom?: number }).zoom = 1; } catch { /* ignore */ }
            ctx.tools.fitView(false);
          }}
        >
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* leftSlot 必须在 Provider 内（依赖 useService/usePlayground） */}
            {leftSlot}
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <EditorRenderer style={{ width: '100%', height: '100%' }} />
              {/* 缩放/适应/自动布局 —— 画布顶部悬浮 */}
              <div ref={(el) => setFlowgramSlot('zoomSlot', el)} style={{ position: 'absolute', top: 12, left: 0, right: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center', zIndex: 50 }}></div>
            </div>
          </div>
          <FlowToolsWithProvider />
        </FreeLayoutEditorProvider>
      </SelectionContext.Provider>
    </FlowPaletteContext.Provider>
  );
}

// 内部组件：在 Provider 内运行 3 个 Inner（用 window.__flowgram_slots__ 桥接 ref）
function FlowToolsWithProvider() {
  return (
    <>
      <UndoRedoInner />
      <FlowCounterInner />
      <ZoomToolsInner />
    </>
  );
}

// UndoRedo 通过 window 全局 ref 渲染到工具栏 slot
function UndoRedoInner() {
  const undoRedo = useUndoRedo();
  const palette = React.useContext(FlowPaletteContext);
  const [undoSlot, setUndoSlot] = React.useState<HTMLElement | null>(null);
  // 用 MutationObserver 监听 window.__flowgram_slots__.undoSlot
  React.useEffect(() => {
    const check = () => setUndoSlot(window.__flowgram_slots__?.undoSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  if (!palette || !undoSlot) return null;
  return ReactDOM_createPortal(
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {makeBtn(palette, '撤销 (Cmd+Z)', <Undo2 style={{ width: 14, height: 14 }} />, undoRedo.undo, !undoRedo.canUndo)}
      {makeBtn(palette, '重做 (Cmd+Shift+Z)', <Redo2 style={{ width: 14, height: 14 }} />, undoRedo.redo, !undoRedo.canRedo)}
    </div>,
    undoSlot
  );
}

// 实时节点/连线计数（用 WorkflowDocument.toJSON）
function FlowCounterInner() {
  const document = useService(WorkflowDocument);
  const palette = React.useContext(FlowPaletteContext);
  const [counterSlot, setCounterSlot] = React.useState<HTMLElement | null>(null);
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const check = () => setCounterSlot(window.__flowgram_slots__?.counterSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    const d = document as unknown as { onContentChange?: (cb: () => void) => { dispose: () => void } };
    if (d.onContentChange) {
      const disp = d.onContentChange(() => force());
      return () => disp.dispose();
    }
  }, [document]);
  const data = (document as unknown as { toJSON?: () => { nodes?: unknown[]; edges?: unknown[] } }).toJSON?.() || {};
  const nodeCount = (data.nodes || []).length;
  const edgeCount = (data.edges || []).length;
  if (!palette || !counterSlot) return null;
  return ReactDOM_createPortal(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Boxes style={{ width: 12, height: 12 }} />
        <span>节点</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: palette.panelText, fontWeight: 600 }}>{nodeCount}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Activity style={{ width: 12, height: 12 }} />
        <span>连线</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: palette.panelText, fontWeight: 600 }}>{edgeCount}</span>
      </div>
    </>,
    counterSlot
  );
}

// 内部组件：注入 onSelectNode 后渲染 FullscreenBaseNode
function FullscreenBaseNodeWithSelect() {
  const onSelect = React.useContext(SelectionContext);
  return <FullscreenBaseNode onSelect={onSelect} />;
}

// 官方节点库：纯展示组件，addNode 由各 Layout 编辑器注入
function NodeLibrary({
  palette,
  addNode,
}: {
  palette: FlowPalette;
  addNode: (node: typeof NODE_LIBRARY[number]) => void;
}) {
  return (
    <div style={{
      width: 240, flexShrink: 0, background: palette.modalPanel,
      borderRight: `1px solid ${palette.modalBorder}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${palette.modalBorder}`, background: palette.panelHeader }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: palette.panelText, fontSize: 13, fontWeight: 600 }}>
          <Boxes style={{ width: 14, height: 14, color: palette.lineSelected }} />
          节点库
        </div>
        <div style={{ fontSize: 11, color: palette.panelTextMuted, marginTop: 4 }}>点击或拖拽节点到画布</div>
      </div>
      <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
        {(['业务流', '审批流', 'AI 协同'] as const).map((scenario) => {
          // 按 scenario 分组，每个 scenario 内的子分类（数据源/逻辑/AI/审批）合并展示
          const items = NODE_LIBRARY.filter((n) => n.scenario === scenario);
          if (items.length === 0) return null;
          return (
            <div key={scenario} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 4px' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: scenario === '业务流' ? '#3b82f6'
                    : scenario === '审批流' ? '#22c55e'
                    : '#a78bfa',
                }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: palette.panelText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{scenario}</div>
                <div style={{ fontSize: 10, color: palette.panelTextMuted }}>({items.length})</div>
              </div>
              {items.map((n) => {
                const Icon = n.icon;
                return (
                  <div
                    key={`${n.type}-${n.title}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/flowgram-node', n.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addNode(n)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', marginBottom: 3, marginLeft: 14,
                      background: palette.panelMuted,
                      border: `1px solid ${palette.modalBorder}`,
                      borderRadius: 6, cursor: 'grab',
                      userSelect: 'none',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = palette.lineSelected; e.currentTarget.style.background = palette.modalPanel; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = palette.modalBorder; e.currentTarget.style.background = palette.panelMuted; }}
                    title={`拖拽「${n.title}」到画布`}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 5,
                      background: palette.typeColor(n.type.replace('flow-', '')) + '20',
                      color: palette.typeColor(n.type.replace('flow-', '')),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon style={{ width: 12, height: 12 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: palette.panelText }}>{n.title}</div>
                      <div style={{ fontSize: 10, color: palette.panelTextMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '8px 16px', borderTop: `1px solid ${palette.modalBorder}`, fontSize: 10, color: palette.panelTextMuted, background: palette.panelHeader }}>
        提示：点击或拖拽节点到画布
      </div>
    </div>
  );
}

/* 旧分组代码已废弃 */

// 自由布局节点库：使用 free-layout 官方 API 添加节点
function FreeNodeLibrary({ palette }: { palette: FlowPalette }) {
  const document = useService(WorkflowDocument);
  const playground = usePlayground();
  const addNode = React.useCallback((item: typeof NODE_LIBRARY[number]) => {
    const el = (playground as unknown as { el?: HTMLElement; container?: HTMLElement }).el
      || (playground as unknown as { container?: HTMLElement }).container;
    const rect = el?.getBoundingClientRect();
    const renderLayer = el?.querySelector('.gedit-playground-layer') as HTMLElement | null;
    const transform = renderLayer?.style?.transform || '';
    const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
    const transMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    const tx = transMatch ? parseFloat(transMatch[1]) : 0;
    const ty = transMatch ? parseFloat(transMatch[2]) : 0;
    const cx = ((rect?.width || 0) / 2 - tx) / scale;
    const cy = ((rect?.height || 0) / 2 - ty) / scale;
    const id = `${item.type.replace('flow-', '')}_${Date.now().toString(36)}`;
    document.createWorkflowNodeByType(item.type, { x: cx - 110, y: cy - 40 }, { id, type: item.type, data: { originalType: item.type, title: item.title, desc: item.desc } });
  }, [document, playground]);
  return <NodeLibrary palette={palette} addNode={addNode} />;
}

// 固定布局节点库：使用 fixed-layout 官方 document.addNode 添加节点
function FixedNodeLibrary({ palette }: { palette: FlowPalette }) {
  const ctx = useClientContext();
  const addNode = React.useCallback((item: typeof NODE_LIBRARY[number]) => {
    const id = `${item.type.replace('flow-', '')}_${Date.now().toString(36)}`;
    (ctx.document as unknown as { addNode?: (n: unknown) => void }).addNode?.({
      id,
      type: 'custom',
      data: { originalType: item.type, title: item.title, desc: item.desc },
    });
  }, [ctx]);
  return <NodeLibrary palette={palette} addNode={addNode} />;
}

// 固定布局工具条（在 Provider 内运行，通过 window slot 渲染到顶部工具栏）
function FixedUndoRedoInner() {
  const tools = useFixedPlaygroundTools();
  const palette = React.useContext(FlowPaletteContext);
  const [undoSlot, setUndoSlot] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    const check = () => setUndoSlot(window.__flowgram_slots__?.undoSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  if (!palette || !undoSlot) return null;
  return ReactDOM_createPortal(
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {makeBtn(palette, '撤销 (Cmd+Z)', <Undo2 style={{ width: 14, height: 14 }} />, () => tools.undo(), !tools.canUndo)}
      {makeBtn(palette, '重做 (Cmd+Shift+Z)', <Redo2 style={{ width: 14, height: 14 }} />, () => tools.redo(), !tools.canRedo)}
    </div>,
    undoSlot
  );
}

function FixedCounterInner() {
  const ctx = useClientContext();
  const palette = React.useContext(FlowPaletteContext);
  const [counterSlot, setCounterSlot] = React.useState<HTMLElement | null>(null);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const [nodeCount, setNodeCount] = React.useState(0);
  const [edgeCount, setEdgeCount] = React.useState(0);
  React.useEffect(() => {
    const check = () => setCounterSlot(window.__flowgram_slots__?.counterSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  // 轮询 DOM 计数（fixed-layout 的 toJSON.edges 可能为空，但实际已渲染）
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      const nodes = document.querySelectorAll('.gedit-flow-activity-node');
      const lines = document.querySelectorAll('.gedit-flow-activity-line');
      // 只保留 Modal 内的节点：data-node-id 去重
      const seen = new Set<string>();
      nodes.forEach((n) => {
        const id = n.getAttribute('data-node-id');
        if (id) seen.add(id);
      });
      const uniqNodes = seen.size;
      // 7 条边应该在所有 .gedit-flow-activity-line 中；按 id 去重
      const seenL = new Set<string>();
      lines.forEach((l) => {
        const id = l.getAttribute('data-line-id') || l.id || '';
        if (id) seenL.add(id);
      });
      const uniqLines = seenL.size > 0 ? seenL.size : lines.length;
      setNodeCount((prev) => (prev !== uniqNodes ? uniqNodes : prev));
      setEdgeCount((prev) => (prev !== uniqLines ? uniqLines : prev));
      raf = window.setTimeout(tick, 250);
    };
    tick();
    return () => window.clearTimeout(raf);
  }, []);
  // 订阅 fixed-layout 的 onContentChange 触发刷新（fallback）
  React.useEffect(() => {
    const d = ctx.document as unknown as { onContentChange?: (cb: () => void) => { dispose: () => void } };
    if (d.onContentChange) {
      const disp = d.onContentChange(() => force());
      const t = setTimeout(() => force(), 200);
      return () => { disp.dispose(); clearTimeout(t); };
    }
  }, [ctx]);
  if (!palette || !counterSlot) return null;
  return ReactDOM_createPortal(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Boxes style={{ width: 12, height: 12 }} />
        <span>节点</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: palette.panelText, fontWeight: 600 }}>{nodeCount}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Activity style={{ width: 12, height: 12 }} />
        <span>连线</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: palette.panelText, fontWeight: 600 }}>{edgeCount}</span>
      </div>
    </>,
    counterSlot
  );
}

function FixedZoomToolsInner() {
  const tools = useFixedPlaygroundTools();
  const palette = React.useContext(FlowPaletteContext);
  const [zoomSlot, setZoomSlot] = React.useState<HTMLElement | null>(null);
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const check = () => setZoomSlot(window.__flowgram_slots__?.zoomSlot || null);
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, []);
  const handleAction = (fn: () => void) => () => {
    fn();
    setTimeout(() => force(), 50);
  };
  if (!palette || !zoomSlot) return null;
  return ReactDOM_createPortal(
    <div
      style={{
        display: 'flex', gap: 4, alignItems: 'center',
        padding: 4, background: palette.modalPanel, border: `1px solid ${palette.modalBorder}`,
        borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'auto',
      }}
    >
      {makeBtn(palette, '缩小 (Cmd+-)', <ZoomOut style={{ width: 14, height: 14 }} />, handleAction(() => tools.zoomout()))}
      <div style={{ minWidth: 36, textAlign: 'center', fontSize: 11, color: palette.panelTextMuted, fontFamily: 'var(--font-mono)' }}>
        {Math.round(tools.zoom * 100)}%
      </div>
      {makeBtn(palette, '放大 (Cmd+=)', <ZoomIn style={{ width: 14, height: 14 }} />, handleAction(() => tools.zoomin()))}
      <div style={{ width: 1, height: 20, background: palette.modalBorder }} />
      {makeBtn(palette, '适应画布', <Maximize2 style={{ width: 14, height: 14 }} />, handleAction(() => tools.fitView()))}
      {makeBtn(palette, '切换布局', <Grid3x3 style={{ width: 14, height: 14 }} />, handleAction(() => tools.changeLayout()))}
    </div>,
    zoomSlot
  );
}

function FixedToolsWithProvider() {
  return (
    <>
      <FixedUndoRedoInner />
      <FixedCounterInner />
      <FixedZoomToolsInner />
    </>
  );
}

const SelectionContext = React.createContext<(id: string) => void>(() => {});

// 画布 Drop Zone：React 层包装，在容器上绑 drop 事件，绕过 FlowGram 内部 child 拦截
function CanvasDropZone({
  palette, onDrop, children,
}: {
  palette: FlowPalette;
  onDrop: (type: string, x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/flowgram-node')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('application/flowgram-node')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragLeave={(e) => { /* no-op */ }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeType = e.dataTransfer.getData('application/flowgram-node');
        if (!nodeType || !ref.current) return;
        // 把 clientX/Y 转换为画布坐标
        const rect = ref.current.getBoundingClientRect();
        // 找 FlowGram 的 render-layer (它有 transform: scale + translate)
        const renderLayer = ref.current.querySelector('.gedit-playground-layer') as HTMLElement | null;
        const transform = renderLayer?.style?.transform || '';
        const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
        const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
        const transMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const tx = transMatch ? parseFloat(transMatch[1]) : 0;
        const ty = transMatch ? parseFloat(transMatch[2]) : 0;
        // 鼠标 clientX/Y 减去容器左/上 + 反算 transform
        const cx = (e.clientX - rect.left - tx) / scale;
        const cy = (e.clientY - rect.top - ty) / scale;
        // 居中（节点 ~220x80），减半宽高
        onDrop(nodeType, cx - 110, cy - 40);
      }}
      style={{ flex: 1, minWidth: 0, background: palette.modalPanel, position: 'relative', display: 'flex' }}
    >
      {children}
    </div>
  );
}

// 全屏节点渲染器：从 FlowPaletteContext 读 palette 实现反色
function FullscreenBaseNode({ onSelect }: { onSelect?: (id: string) => void } = {}) {
  const nodeRender = useNodeRender();
  const n = nodeRender.node;
  const palette = React.useContext(FlowPaletteContext);

  const idToType: Record<string, string> = {
    'input': 'input', 'output': 'output',
    'llm-extract': 'llm', 'llm-relation': 'llm',
    'condition': 'condition', 'loop-complete': 'loop', 'tool-ontology': 'tool',
  };
  const shortType = idToType[n.id] || String(n.type || '').replace(/^flow-/, '').toLowerCase();
  const data = (NODE_DATA[n.id] as { title?: string; desc?: string } | undefined) || {};
  const isSel = !!nodeRender.selected;

  // CSS 注入已由父级 FlowFullscreenEditor 完成（避免每个节点都操作 DOM）

  if (!palette) return null;

  const labelInfo = palette.nodeLabel(shortType);
  const tColor = palette.typeColor(shortType);

  return (
    <div
      ref={nodeRender.nodeRef as unknown as React.RefObject<HTMLDivElement>}
      onClick={(e) => { e.stopPropagation(); onSelect?.(n.id); nodeRender.selectNode(e); }}
      style={{
        width: '100%', height: '100%',
        background: palette.nodeBg,  // 黑色（深色 UI）/ 白色（浅色 UI）
        border: `2px solid ${isSel ? tColor : palette.nodeBorder}`, // 选中时边框 = 类型色，否则浅色
        borderRadius: 10,
        padding: 12,
        cursor: 'pointer',
        transition: 'box-shadow .15s, border-color .15s, transform .15s',
        boxShadow: isSel
          ? `0 0 0 3px ${tColor}, 0 0 0 6px ${tColor}40, 0 8px 24px ${tColor}80`
          : palette.nodeShadow,
        boxSizing: 'border-box',
        color: palette.nodeText,
        fontFamily: 'var(--font-sans)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: labelInfo.bg, color: labelInfo.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontWeight: 700, fontSize: 11,
        }}>{labelInfo.label}</div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: palette.nodeText,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{data.title || '未命名'}</div>
      </div>
      <div style={{
        fontSize: 10, color: palette.nodeDesc, lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{data.desc || ' '}</div>
    </div>
  );
}

// FlowGram 自定义默认节点渲染器：直接基于 node.type 选择 color 和 label
// 必须返回带 ref={nodeRender.nodeRef} 的容器，FlowGram 才会测量尺寸
function CustomBaseNode() {
  const nodeRender = useNodeRender();
  const n = nodeRender.node;
  // 用 n.id 映射到 shortType（最可靠，DOM 上只有 id）
  const idToType: Record<string, string> = {
    'input': 'input',
    'output': 'output',
    'llm-extract': 'llm',
    'llm-relation': 'llm',
    'condition': 'condition',
    'loop-complete': 'loop',
    'tool-ontology': 'tool',
  };
  const shortType = idToType[n.id] || String(n.type || '').replace(/^flow-/, '').toLowerCase();
  const c = colorOf(shortType);
  // 优先从 nodeRender.data 取（FlowGram 自动从 WorkflowNodeJSON.data 提取）
  // 兜底：从 NODE_DATA 静态表查（FlowGram 1.0.12 的 materials 渲染下 data 可能未注入）
  const data = (nodeRender.data as { title?: string; desc?: string } | undefined) || (NODE_DATA[n.id] as { title?: string; desc?: string }) || {};
  const isSel = !!nodeRender.selected;
  return (
    <div
      ref={nodeRender.nodeRef as unknown as React.RefObject<HTMLDivElement>}
      onClick={(e) => { e.stopPropagation(); nodeRender.selectNode(e); }}
      style={{
        width: '100%', height: '100%',
        background: '#111111',
        border: `2px solid ${c.border}`,
        borderRadius: 8,
        padding: 12,
        cursor: 'pointer',
        transition: 'box-shadow .15s, transform .15s',
        boxShadow: isSel ? `0 0 0 2px ${c.border}, 0 0 16px ${c.bg}` : `0 0 0 1px ${c.bg}`,
        boxSizing: 'border-box',
        color: '#fafafa',
        fontFamily: 'var(--font-sans)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600, fontSize: 10 }}>{c.label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.title || '未命名'}</div>
      </div>
      <div style={{ fontSize: 10, color: '#a1a1aa', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.desc || ' '}</div>
    </div>
  );
}

export default function OntologyActionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedAction, setSelectedAction] = useState(2);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFlowNode, setSelectedFlowNode] = useState('llm-extract');
  const [actionFlowSelect, setActionFlowSelect] = useState('客户数据清洗 Action');

  // 节点颜色已抽取到模块级 colorOf

  // 初始流程定义（FlowGram.AI WorkflowJSON 格式）
  const initialData: WorkflowJSON = {
    nodes: [
      { id: 'input', type: 'flow-input', meta: { position: { x: 60, y: 60 } }, data: { originalType: 'flow-input', title: '接收数据输入', desc: '接收原始客户数据（JSON / CSV）' } },
      { id: 'llm-extract', type: 'flow-llm', meta: { position: { x: 60, y: 220 } }, data: { originalType: 'flow-llm', title: 'LLM: 实体抽取', desc: '从客户数据中抽取实体信息' } },
      { id: 'condition', type: 'flow-condition', meta: { position: { x: 60, y: 380 } }, data: { originalType: 'flow-condition', title: '数据完整?', desc: '检查必填字段是否齐全' } },
      { id: 'loop-complete', type: 'flow-loop', meta: { position: { x: -200, y: 540 } }, data: { originalType: 'flow-loop', title: '工具: 数据补全', desc: '调用 MCP Tool 补全缺失字段' } },
      { id: 'tool-ontology', type: 'flow-tool', meta: { position: { x: 340, y: 540 } }, data: { originalType: 'flow-tool', title: '工具: 本体匹配', desc: '将抽取实体与本体概念进行语义匹配' } },
      { id: 'llm-relation', type: 'flow-llm', meta: { position: { x: 340, y: 700 } }, data: { originalType: 'flow-llm', title: 'LLM: 关系推理', desc: '推理实体间关系并生成三元组' } },
      { id: 'output', type: 'flow-output', meta: { position: { x: 340, y: 860 } }, data: { originalType: 'flow-output', title: '知识图谱更新', desc: '将推理结果写入知识图谱 Neo4j' } },
    ],
    edges: [
      { sourceNodeID: 'input', targetNodeID: 'llm-extract' },
      { sourceNodeID: 'llm-extract', targetNodeID: 'condition' },
      { sourceNodeID: 'condition', targetNodeID: 'tool-ontology' },
      { sourceNodeID: 'condition', targetNodeID: 'loop-complete' },
      { sourceNodeID: 'tool-ontology', targetNodeID: 'llm-relation' },
      { sourceNodeID: 'llm-relation', targetNodeID: 'output' },
      { sourceNodeID: 'loop-complete', targetNodeID: 'llm-extract' },
    ],
  };

  // 节点注册：6 个不同类型（input / llm / condition / loop / tool / output）
  // 渲染通过 FreeLayoutEditorProvider 的 materials.renderDefaultNode = CustomBaseNode
  const nodeRegistries: WorkflowNodeRegistry[] = [
    { type: 'flow-input',     meta: { size: { width: 220, height: 80 }, defaultPorts: [{ type: 'output' }] } },
    { type: 'flow-llm',       meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-condition', meta: { size: { width: 200, height: 80 } } },
    { type: 'flow-loop',      meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-tool',      meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-output',    meta: { size: { width: 220, height: 80 }, defaultPorts: [{ type: 'input' }] } },
  ];

  const codeStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)',
    background: 'var(--muted)', padding: '2px 6px', borderRadius: 3,
  };

  // 详情区子 tab（包含流程编排作为只读预览 tab）
  type DetailTab = 'basic' | 'io' | 'relations' | 'flow';
  const [detailTab, setDetailTab] = useState<DetailTab>('basic');
  // 全屏编辑模式
  const [flowFullscreen, setFlowFullscreen] = useState(false);

  return (
    <div>
      <SubTabs items={ONTOLOGY_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Action 编排</h1>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>定义和编排业务动作</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn"><TestTube style={{ width: 16, height: 16 }} />测试运行</button>
          <button className="v-btn-primary" onClick={() => setDrawerOpen(true)}><Plus style={{ width: 16, height: 16 }} />新建 Action</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>45</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Action 总数</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>38</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>已启用</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>84.4%</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>1,284</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>本月执行次数</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>99.2%</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>成功率</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>+0.3%</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* Left: Action List */}
        <div style={{ width: 240, flexShrink: 0 }}>
          <div className="v-card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Actions</h3>
            {ACTIONS.map((a, i) => (
              <div
                key={a.id}
                onClick={() => setSelectedAction(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  color: i === selectedAction ? 'var(--foreground)' : 'var(--muted-foreground)',
                  background: i === selectedAction ? 'var(--muted)' : 'transparent',
                  marginBottom: 2, transition: 'background .15s',
                }}
              >
                <a.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--background)', color: 'var(--muted-foreground)' }}>{a.type}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: a.enabled ? 'var(--success)' : 'var(--muted-foreground)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="v-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            {/* Header: title + actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{ACTIONS[selectedAction].name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Copy style={{ width: 14, height: 14 }} />复制</button>
                <button className="v-btn" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Trash2 style={{ width: 14, height: 14 }} />删除</button>
                <button className="v-btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 12 }}><Save style={{ width: 14, height: 14 }} />保存</button>
              </div>
            </div>

            {/* 子 Tab */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
              {([
                { key: 'basic', label: '基本信息' },
                { key: 'io', label: '输入输出' },
                { key: 'relations', label: '关联配置' },
                { key: 'flow', label: '流程编排', icon: GitBranch },
              ] as const).map((t) => {
                const active = detailTab === t.key;
                const Icon = 'icon' in t ? t.icon : null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setDetailTab(t.key as DetailTab)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '12px 14px',
                      fontSize: 13,
                      color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
                      marginBottom: -1,
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 500,
                      transition: 'color .15s, border-color .15s',
                    }}
                  >
                    {Icon ? <Icon style={{ width: 14, height: 14 }} /> : null}
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 子 Tab 内容 */}
            <div style={{ padding: 20 }}>
              {detailTab === 'basic' && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>基本信息</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>名称</div>
                    <div style={{ fontSize: 13, color: 'var(--foreground)' }}>发送审批通知</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>标识符</div>
                    <div style={{ fontSize: 13, color: 'var(--foreground)' }}><code style={codeStyle}>action.approval.notify</code></div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>类型</div>
                    <div style={{ fontSize: 13 }}><span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>通知</span></div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', paddingTop: 3 }}>描述</div>
                    <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6 }}>通过 IM / Email / SMS 渠道向指定接收人发送审批通知</div>
                  </div>
                </div>
              )}

              {detailTab === 'io' && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>输入参数</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>参数名</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>类型</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>必填</th>
                        <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INPUT_PARAMS.map((p) => (
                        <tr key={p.name}>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.type}</td>
                          <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>{p.required ? '是' : '否'}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>输出定义</div>
                  <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.8 }}>
                    {'{'}<br />
                    &nbsp;&nbsp;"success": "boolean",<br />
                    &nbsp;&nbsp;"message_id": "string",<br />
                    &nbsp;&nbsp;"sent_at": "datetime",<br />
                    &nbsp;&nbsp;"channel": "string"<br />
                    {'}'}
                  </div>
                </div>
              )}

              {detailTab === 'relations' && (
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>关联本体概念</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {RELATED_CONCEPTS.map((c) => (
                        <span key={c} style={{ padding: '4px 10px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--foreground)', cursor: 'pointer' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>关联触发器</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {RELATED_TRIGGERS.map((t) => (
                        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--foreground)' }}>
                          <GitBranch style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'flow' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>流程编排</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>当前 Action 包含 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}>7</span> 个节点 / <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}>7</span> 条连线</div>
                    </div>
                    <button
                      className="v-btn-primary"
                      onClick={() => setFlowFullscreen(true)}
                      style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                    >
                      <Maximize2 style={{ width: 14, height: 14 }} />进入全屏编辑
                    </button>
                  </div>
                  <div style={{ height: 360, background: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
                    <FreeLayoutEditorProvider
                      initialData={initialData}
                      nodeRegistries={nodeRegistries}
                      nodeEngine={{ enable: true }}
                      readonly
                      background
                      lineColor={{
                        hidden: 'transparent',
                        default: '#52525b',
                        drawing: '#a78bfa',
                        hovered: '#a1a1aa',
                        selected: '#a78bfa',
                        error: '#ff6166',
                        flowing: '#52525b',
                      }}
                      materials={{ components: {}, renderDefaultNode: CustomBaseNode }}
                      playground={{ preventGlobalGesture: true }}
                      onAllLayersRendered={(ctx) => {
                        try { (ctx.playground as { zoom?: number }).zoom = 1; } catch { /* ignore */ }
                        ctx.tools.fitView(false);
                      }}
                    >
                      <EditorRenderer style={{ width: '100%', height: '100%' }} />
                    </FreeLayoutEditorProvider>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Execution history */}
          <div className="v-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>执行历史</h3>
              <button className="v-btn" style={{ height: 28, padding: '0 10px', fontSize: 11 }}>查看全部</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['触发者', '时间', '输入摘要', '输出摘要', '耗时', '状态'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXEC_HISTORY.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--foreground)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{r.trigger}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{r.time}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--background)', padding: '1px 6px', borderRadius: 3 }}>{r.input}</code></td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--background)', padding: '1px 6px', borderRadius: 3 }}>{r.output}</code></td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}>{r.duration}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: r.status === 'success' ? 'rgba(98,209,120,0.12)' : 'rgba(255,97,102,0.15)', color: r.status === 'success' ? 'var(--success)' : 'var(--destructive)' }}>
                        {r.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title="新建 Action"
        onCancel={() => setDrawerOpen(false)}
        onOk={() => setDrawerOpen(false)}
      >
        <FormSection title="基本信息" desc="Action 的基础属性">
          <Field label="Action 名称" required>
            <TextInput placeholder="请输入 Action 名称" />
          </Field>
          <Field label="Action 编码">
            <TextInput placeholder="请输入 Action 编码，如 action.approval.notify" />
          </Field>
          <Field label="Action 类型">
            <Select defaultValue="查询">
              <option value="查询">查询</option>
              <option value="变更">变更</option>
              <option value="审批">审批</option>
              <option value="通知">通知</option>
              <option value="集成">集成</option>
            </Select>
          </Field>
          <Field label="描述">
            <TextArea placeholder="请输入 Action 描述" rows={3} />
          </Field>
        </FormSection>

        <FormSection title="输入输出" desc="定义 Action 的输入参数与输出契约">
          <Field label="输入参数 Schema">
            <TextArea placeholder='{"type":"object","properties":{...}}' rows={4} />
          </Field>
          <Field label="输出参数 Schema">
            <TextArea placeholder='{"type":"object","properties":{...}}' rows={4} />
          </Field>
          <Field label="返回类型">
            <Select defaultValue="JSON">
              <option>JSON</option>
              <option>文本</option>
              <option>文件</option>
              <option>void</option>
            </Select>
          </Field>
        </FormSection>

        <FormSection title="实现配置" desc="Action 的执行实现方式">
          <Field label="实现方式">
            <Select defaultValue="Groovy 脚本">
              <option>Groovy 脚本</option>
              <option>HTTP 调用</option>
              <option>Java 类</option>
              <option>MCP 工具</option>
            </Select>
          </Field>
          <Field label="实现代码 / URL">
            <TextArea placeholder="// Groovy 脚本 或 HTTP URL" rows={6} />
          </Field>
          <Field label="超时时间 (ms)">
            <TextInput type="number" defaultValue="3000" />
          </Field>
        </FormSection>

        <FormSection title="权限审计" desc="Action 的权限与审计配置">
          <Field label="需要审批">
            <input type="checkbox" defaultChecked />
          </Field>
          <Field label="审批人">
            <TextInput placeholder="请输入审批人" />
          </Field>
          <Field label="记录审计日志">
            <input type="checkbox" defaultChecked />
          </Field>
          <Field label="超时时间 (分钟)">
            <TextInput type="number" defaultValue="30" />
          </Field>
        </FormSection>
      </FormDrawer>

      {/* 流程编排全屏编辑 Modal */}
      {flowFullscreen && (
        <FlowFullscreenEditor
          onClose={() => setFlowFullscreen(false)}
          initialData={initialData}
          nodeRegistries={nodeRegistries}
          CustomBaseNode={CustomBaseNode}
        />
      )}
    </div>
  );
}
