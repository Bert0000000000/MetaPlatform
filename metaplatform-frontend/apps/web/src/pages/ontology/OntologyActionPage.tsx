import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@douyinfe/semi-ui';
import { createPortal as ReactDOM_createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  TestTube, Plus, GitBranch, Plug, Zap,
  Copy, Trash2, Save, Sparkles, Diamond, RefreshCw, ArrowDownToLine,
  ArrowUpFromLine, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Play, Download,
  X, Minimize2, Settings, Cpu, Database, ShieldCheck, Sliders, FileText,
  Code2, Clock, Hash, Activity, Boxes, Workflow, BookOpen, Layers,
  MousePointerSquareDashed, Grid3x3,
  PlayCircle, Square,
} from 'lucide-react';
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  useNodeRender,
  usePlaygroundTools,
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
import './ontology-action.css';
// 后续使用：<Field label="..."> —— 用 @mate/shared 的 FormFields.Field
import { FormDrawer, Field, TextInput, TextArea, Select, FormSection } from '@mate/shared';
import {
  listActionTypes, listObjectTypes, slugAndVersionOfObjectType,
  getActionFlow, putActionFlow,
  type KernelActionType, type KernelObjectType,
} from '@/api/ont/kernel';
import { actionDisplayName } from './actions/ActionTypeListPage';

// 节点属性配置
const NODE_PROPS: Record<string, Record<string, unknown>> = {
  'llm-extract': { model: 'doubao-pro-32k', temperature: 0.3, maxTokens: 4096, prompt: '你是一个专业的实体抽取助手...\n1. 姓名\n2. 公司\n3. 职位', inputMap: '$input.raw_data → customer_text', outputMap: '$output.entities → $node-condition.input', id: 'node-llm-extract-01', timeout: '30,000 ms', retry: 3 },
  'input': { id: 'node-input-01', source: 'HTTP POST', format: 'application/json' },
  'condition': { id: 'node-condition-01', expression: 'missing_rate < 0.1', trueLabel: 'Yes', falseLabel: 'No' },
  'loop-complete': { id: 'node-loop-01', tool: 'mcp.data.complete', maxRetries: 3 },
  'tool-ontology': { id: 'node-tool-01', tool: 'mcp.ontology.match', threshold: 0.85 },
  'llm-relation': { id: 'node-llm-rel-01', model: 'doubao-pro-128k', temperature: 0.2, maxTokens: 8192 },
  'output': { id: 'node-output-01', target: 'neo4j://graph/mate-platform', writeMode: 'merge' },
};

// 节点颜色（按 type 区分）
function colorOf(type: string): { border: string; bg: string; text: string; label: string } {
  switch (type) {
    case 'start': return { border: '#22c55e', bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: '开始' };
    case 'end':   return { border: '#94a3b8', bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', label: '结束' };
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
  // ============ BPMN 起止节点（每个流程必须存在：start 只有 output 端口，end 只有 input 端口） ============
  { type: 'flow-start',     title: '开始',         desc: '流程起点（每个流程 1 个）',       icon: PlayCircle,     category: 'BPMN',  scenario: '业务流' },
  { type: 'flow-end',       title: '结束',         desc: '流程终点（可多个：多分支汇聚）', icon: Square,         category: 'BPMN',  scenario: '业务流' },

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

// v1.7：节点库条目 → 动态字段 schema（按 NODE_LIBRARY.type 注册，属性面板按此加载）
// 结构：flow-input → 数据源 schema；flow-llm → AI 模型 schema；等等
type FieldSchema = { label: string; value: string; mono?: boolean; type?: 'text' | 'json' | 'list'; required?: boolean };
type NodeSchema = { category: string; icon: typeof Cpu; sections: { name: string; fields: FieldSchema[] }[] };
const NODE_SCHEMAS: Record<string, NodeSchema> = {
  'flow-start':     { category: 'BPMN',       icon: PlayCircle,    sections: [{ name: '基本信息', fields: [{ label: '节点 ID', value: 'flow-start', mono: true }, { label: '类型', value: 'BPMN 开始节点' }] }] },
  'flow-end':       { category: 'BPMN',       icon: Square,        sections: [{ name: '基本信息', fields: [{ label: '节点 ID', value: 'flow-end', mono: true }, { label: '类型', value: 'BPMN 结束节点' }] }] },
  'flow-input':     NODE_TYPE_META.input && { category: '数据源', icon: Database,   sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-input', mono: true, required: true },
      { label: '类型', value: 'HTTP POST' },
      { label: '数据格式', value: 'application/json' },
    ] },
    { name: '数据契约', fields: [
      { label: 'Schema', value: '{ "type": "object", "properties": { "id": "string", "name": "string" } }', type: 'json' },
      { label: '示例数据', value: '{ "id": 12345, "name": "示例" }', type: 'json' },
    ] },
    { name: '执行配置', fields: [
      { label: '超时时间 (ms)', value: '10000' },
      { label: '重试次数', value: '3' },
      { label: '鉴权', value: 'Bearer Token' },
    ] },
  ] },
  'flow-output':    NODE_TYPE_META.output && { category: '数据目标', icon: Database,  sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-output', mono: true, required: true },
      { label: '类型', value: 'Neo4j / PostgreSQL' },
    ] },
    { name: '数据契约', fields: [
      { label: 'Schema', value: '{ "type": "object", "properties": { "subject": "string", "predicate": "string", "object": "string" } }', type: 'json' },
    ] },
    { name: '写入策略', fields: [
      { label: '写入目标', value: 'neo4j://graph/mate-platform', mono: true },
      { label: '写入模式', value: 'merge' },
    ] },
  ] },
  'flow-condition': NODE_TYPE_META.condition && { category: '逻辑控制', icon: Diamond,  sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-condition', mono: true, required: true },
    ] },
    { name: '条件表达式', fields: [
      { label: '表达式', value: 'input.score > 0.8', mono: true, required: true },
      { label: 'Yes 分支', value: '→ tool-ontology', mono: true },
      { label: 'No 分支',  value: '→ loop-complete', mono: true },
    ] },
  ] },
  'flow-loop':      NODE_TYPE_META.loop && { category: '循环控制', icon: RefreshCw,  sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-loop', mono: true, required: true },
    ] },
    { name: '循环条件', fields: [
      { label: '最大迭代次数', value: '10' },
      { label: '循环条件', value: 'missing_fields.length > 0', mono: true },
    ] },
    { name: '迭代体配置', fields: [
      { label: '迭代输入', value: 'input.missing_fields', mono: true },
      { label: '迭代输出', value: 'output.filled_data', mono: true },
    ] },
  ] },
  'flow-tool':      NODE_TYPE_META.tool && { category: 'MCP 工具', icon: Plug,  sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-tool', mono: true, required: true },
    ] },
    { name: '工具选择', fields: [
      { label: '工具 ID', value: 'mcp.ontology.match', mono: true, required: true },
      { label: '相似度阈值', value: '0.85' },
    ] },
    { name: '参数配置', fields: [
      { label: '输入映射', value: 'input.entities → tool.match', mono: true },
      { label: '输出映射', value: 'output.matched → next.input', mono: true },
    ] },
  ] },
  'flow-llm':       NODE_TYPE_META.llm && { category: 'AI 模型', icon: Sparkles,  sections: [
    { name: '基本信息', fields: [
      { label: '节点 ID', value: 'flow-llm', mono: true, required: true },
    ] },
    { name: '模型配置', fields: [
      { label: '模型', value: 'doubao-pro-32k', mono: true, required: true },
      { label: 'Temperature', value: '0.3' },
      { label: '最大 Token', value: '4096' },
    ] },
    { name: 'Prompt 编辑', fields: [
      { label: 'System Prompt', value: '你是一个专业的实体抽取助手...', type: 'json' },
    ] },
    { name: '输入映射', fields: [
      { label: '输入', value: 'input.raw_data → prompt.context', mono: true },
    ] },
    { name: '输出映射', fields: [
      { label: '输出', value: 'output.entities → next.input', mono: true },
    ] },
  ] },
};

// 节点配置字段（可编辑）
type NodeField = { label: string; value: string; mono?: boolean; type?: 'text' | 'json' | 'list' };
type NodeConfig = Record<string, Record<string, NodeField>>;

// 节点 ID → 配置项默认数据（全屏属性面板的初始值；编辑后写入组件 state）
const NODE_DETAIL_PROPS: NodeConfig = {
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

// 内置 demo 流程定义（未持久化时兜底展示）
const DEFAULT_FLOW: WorkflowJSON = {
  nodes: [
    { id: 'start',   type: 'flow-start',     meta: { position: { x: 60,  y: 60  } }, data: { originalType: 'flow-start',   title: '开始',     desc: '流程起点' } },
    { id: 'input',   type: 'flow-input',     meta: { position: { x: 60,  y: 220 } }, data: { originalType: 'flow-input',   title: '接收数据输入', desc: '接收原始客户数据（JSON / CSV）' } },
    { id: 'llm-extract', type: 'flow-llm',   meta: { position: { x: 60,  y: 380 } }, data: { originalType: 'flow-llm',     title: 'LLM: 实体抽取', desc: '从客户数据中抽取实体信息' } },
    { id: 'condition', type: 'flow-condition',meta: { position: { x: 60,  y: 540 } }, data: { originalType: 'flow-condition',title: '数据完整?', desc: '检查必填字段是否齐全' } },
    { id: 'loop-complete', type: 'flow-loop', meta: { position: { x: -200, y: 700 } }, data: { originalType: 'flow-loop',    title: '工具: 数据补全', desc: '调用 MCP Tool 补全缺失字段' } },
    { id: 'tool-ontology', type: 'flow-tool', meta: { position: { x: 340, y: 700 } }, data: { originalType: 'flow-tool',    title: '工具: 本体匹配', desc: '将抽取实体与本体概念进行语义匹配' } },
    { id: 'llm-relation', type: 'flow-llm',   meta: { position: { x: 340, y: 860 } }, data: { originalType: 'flow-llm',     title: 'LLM: 关系推理', desc: '推理实体间关系并生成三元组' } },
    { id: 'output', type: 'flow-output', meta: { position: { x: 340, y: 1020 } }, data: { originalType: 'flow-output', title: '知识图谱更新', desc: '将推理结果写入知识图谱 Neo4j' } },
    { id: 'end',     type: 'flow-end',       meta: { position: { x: 340, y: 1180 } }, data: { originalType: 'flow-end',     title: '结束',     desc: '流程终点' } },
  ],
  edges: [
    { sourceNodeID: 'start',   targetNodeID: 'input' },
    { sourceNodeID: 'input',   targetNodeID: 'llm-extract' },
    { sourceNodeID: 'llm-extract', targetNodeID: 'condition' },
    { sourceNodeID: 'condition', targetNodeID: 'tool-ontology' },
    { sourceNodeID: 'condition', targetNodeID: 'loop-complete' },
    { sourceNodeID: 'tool-ontology', targetNodeID: 'llm-relation' },
    { sourceNodeID: 'llm-relation', targetNodeID: 'output' },
    { sourceNodeID: 'output',         targetNodeID: 'end' },
    { sourceNodeID: 'loop-complete', targetNodeID: 'llm-extract' },
  ],
};

// 全屏编辑 Modal：流程编排编辑器
// 主题：UI 是黑色 → 图内元素（线/边框）使用**浅色**（#a1a1aa 灰 + 类型色饱和度调高）
// 浅色 UI 时 → 图内元素使用**黑色**（主题色值由 useThemeMode 决定）
function FlowFullscreenEditor({
  onClose,
  initialData,
  nodeRegistries,
  CustomBaseNode: CustomNode,
  initialConfig,
  onSave,
  saving,
}: {
  onClose: () => void;
  initialData: WorkflowJSON;
  nodeRegistries: WorkflowNodeRegistry[];
  CustomBaseNode: React.ComponentType;
  initialConfig: NodeConfig;
  onSave: (flow: WorkflowJSON, config: NodeConfig) => Promise<void>;
  saving?: boolean;
}) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null); // 默认无选中 → 隐藏属性面板
  // 暴露 setActiveNodeId 到 window 供 e2e test 用
  // （绕过 React 19 root delegation onClick 不 commit 坑）
  // 注意：只挂一次（deps []），避免 useEffect 死循环；opRef 在 onAllLayersRendered 同步
  React.useEffect(() => {
    (window as unknown as { __flowgram_select_node__?: (id: string | null) => void }).__flowgram_select_node__ = setActiveNodeId;
  }, []);
  const [activeSection, setActiveSection] = useState('基本信息');
  const [themeMode] = useState<'dark' | 'light'>('dark'); // 演示固定为深色
  const [layoutMode, setLayoutMode] = useState<'free' | 'fixed'>('free'); // 自由布局（默认）：dropzone 默认挂载，节点库拖拽即落
  // 可编辑节点配置（初始值为 initialConfig 深拷贝；属性面板读写此 state）
  const [nodeConfig, setNodeConfig] = useState<NodeConfig>(() =>
    JSON.parse(JSON.stringify(initialConfig)),
  );
  // 画布 document 引用（由 EditorRenderer 的 onAllLayersRendered 回填；用于增删节点）
  // 用 React state 触发 WorkflowDocumentContext 重渲（ref 不会自动 re-render）
  const [doc, setDoc] = useState<any>(null);
  const docRef = React.useRef<any>(null);
  const opRef = React.useRef<{ deleteNode?: (id: string) => void } | null>(null);

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

  // 选中节点类型映射（v1.7：优先按 activeNodeId 完整前缀匹配 flow-xxx，找不到再退化 includes）
  const activeType = (() => {
    if (!activeNodeId) return 'input';
    if (activeNodeId === 'start' || activeNodeId === 'end') return 'input'; // demo 旧节点（没 flow- 前缀）按 input
    const flowType = activeNodeId.startsWith('flow-') ? activeNodeId : `flow-${activeNodeId}`;
    // NODE_SCHEMAS 优先（v1.7），其次 NODE_TYPE_META 类型映射
    if (NODE_SCHEMAS[flowType]) {
      // flow-llm → 'llm'，flow-tool → 'tool'，flow-condition → 'condition' ...
      const short = flowType.replace('flow-', '');
      return short;
    }
    // 退化
    if (activeNodeId.includes('llm')) return 'llm';
    if (activeNodeId.includes('condition')) return 'condition';
    if (activeNodeId.includes('tool')) return 'tool';
    if (activeNodeId.includes('loop')) return 'loop';
    if (activeNodeId.includes('output')) return 'output';
    return 'input';
  })();
  // 节点类型 meta（图标 + 分组）：用 NODE_SCHEMAS 优先，fallback NODE_TYPE_META
  const activeFlowType = activeNodeId?.startsWith('flow-') ? activeNodeId : `flow-${activeType}`;
  const activeSchema = NODE_SCHEMAS[activeFlowType];
  const meta = activeSchema
    ? { category: activeSchema.category, icon: activeSchema.icon, sections: activeSchema.sections.map(s => s.name) }
    : NODE_TYPE_META[activeType] || NODE_TYPE_META['input'];
  const TypeIcon = meta.icon;
  // v1.5 R1.6：走 FlowGram document 读节点 data，解决之前 nodeConfig[activeNodeId] 对新拖入节点空白的问题
  const [, setDocRefresh] = React.useState(0);
  React.useEffect(() => {
    if (!doc?.onNodeUpdate) return;
    const disp = doc.onNodeUpdate(() => setDocRefresh((x) => x + 1));
    return () => disp?.dispose?.();
  }, [doc]);
  const activeNodeJson = (() => {
    if (!activeNodeId || !doc) return null;
    return doc.getNode(activeNodeId)?.toJSON?.() || null;
  })();
  const fallback = (NODE_DETAIL_PROPS as Record<string, Record<string, { value: string; label: string }>>)[activeType]
    || (activeNodeId ? (NODE_DETAIL_PROPS as Record<string, Record<string, { value: string; label: string }>>)[activeNodeId] : undefined) || {};
  const liveData = (activeNodeJson?.data as Record<string, unknown> | undefined) || {};
  const activeData = {
    ...Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, v.value])),
    ...liveData,
  };
  const updateField = (key: string, value: string) => {
    if (!activeNodeId || !doc) return;
    const json = doc.toJSON();
    const curData = (doc.getNode(activeNodeId)?.toJSON()?.data || {}) as Record<string, unknown>;
    const nextData = { ...curData, [key]: value };
    const updated = {
      ...json,
      nodes: json.nodes.map((n: { id: string; data?: Record<string, unknown> }) =>
        n.id === activeNodeId ? { ...n, data: nextData } : n
      ),
    };
    doc.fromJSON(updated);
  };
  const deleteActiveNode = () => {
    if (!activeNodeId) return;
    docRef.current?.removeNode?.(activeNodeId);
    setActiveNodeId(null);
  };
  const copyActiveNode = () => {
    if (!activeNodeId) return;
    const flowType = `flow-${activeType}`;
    const id = `${activeNodeId}-copy-${Date.now().toString(36)}`;
    docRef.current?.createWorkflowNodeByType?.(
      flowType,
      { x: 0, y: 0 },
      {
        id,
        type: flowType,
        data: {
          originalType: flowType,
          title: NODE_DATA[activeNodeId]?.title || activeNodeId,
          desc: NODE_DATA[activeNodeId]?.desc || '',
        },
      },
    );
  };

  // v1.7：按节点类型动态加载字段（NODE_SCHEMAS 优先 → fallback 硬编码 sectionFields）
  const renderSectionFields = (section: string) => {
    // 先从新 NODE_SCHEMAS 找
    const schema = NODE_SCHEMAS[activeFlowType];
    if (schema) {
      const sect = schema.sections.find((s) => s.name === section);
      if (sect) {
        return sect.fields.map((f, i) => {
          // 字段 value 优先用节点 data，再退化到 schema 默认
          const liveVal = activeData[f.label] || (activeNodeJson?.data as Record<string, unknown> | undefined)?.[f.label];
          const value = (liveVal != null ? String(liveVal) : f.value) || f.value;
          return (
            <div key={`${f.label}-${i}`} className="mp-mb-4">
              <div className="mp-text-xs mp-flex-center mp-mb-1 mp-gap-1 mp-flow-field-label">
                {f.required && <span className="mp-text-danger">*</span>}
                <span>{f.label}</span>
              </div>
              {f.type === 'json' ? (
                <textarea
                  value={value}
                  readOnly
                  rows={5}
                  className="mp-w-full mp-m-0 mp-text-sm mp-py-2 mp-px-3 mp-mono mp-lh-16 mp-rounded mp-flow-textarea"
                />
              ) : (
                <input
                  value={value}
                  readOnly
                  className={`mp-w-full mp-text-body mp-py-2 mp-px-3 mp-rounded mp-flow-input${f.mono ? ' mp-flow-input--mono' : ' mp-sans'}`}
                />
              )}
            </div>
          );
        });
      }
    }
    // fallback：v1.5 之前硬编码 sectionFields 映射（兼容老 demo 节点）
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
    // 兼容两层结构：activeData[k] 可能是 {value,label}（fallback NODE_DETAIL_PROPS）也可能是 string（live data）
    const getVal = (k: string): string => {
      const f = activeData[k];
      if (f == null) return '';
      if (typeof f === 'string') return f;
      if (typeof f === 'object' && 'value' in (f as Record<string, unknown>)) return String((f as { value: unknown }).value ?? '');
      return '';
    };
    const getLabel = (k: string): string => {
      const f = activeData[k];
      if (f && typeof f === 'object' && 'label' in (f as Record<string, unknown>)) return String((f as { label: unknown }).label);
      return k;
    };
    return keys.map((k) => {
      if (!activeData[k] && getVal(k) === '') return null;
      const value = getVal(k);
      const label = getLabel(k);
      return (
        <div key={k} className="mp-mb-4">
          <div className="mp-text-xs mp-flex-center mp-mb-1 mp-gap-1 mp-flow-field-label">
            {k === 'id' && <Hash className="mp-icon-12" />}
            {k === 'timeout' && <Clock className="mp-icon-12" />}
            {k === 'retry' && <RefreshCw className="mp-icon-12" />}
            {k === 'prompt' && <FileText className="mp-icon-12" />}
            {k === 'model' && <Cpu className="mp-icon-12" />}
            {k === 'temperature' && <Sliders className="mp-icon-12" />}
            {k === 'maxTokens' && <Sliders className="mp-icon-12" />}
            {k === 'inputMap' && <Code2 className="mp-icon-12" />}
            {k === 'outputMap' && <Code2 className="mp-icon-12" />}
            {k === 'schema' && <Code2 className="mp-icon-12" />}
            {k === 'sample' && <Code2 className="mp-icon-12" />}
            {k === 'source' && <Database className="mp-icon-12" />}
            {k === 'target' && <Database className="mp-icon-12" />}
            {k === 'tool' && <Plug className="mp-icon-12" />}
            {k === 'expression' && <Diamond className="mp-icon-12" />}
            {k === 'trueLabel' && <GitBranch className="mp-icon-12" />}
            {k === 'falseLabel' && <GitBranch className="mp-icon-12" />}
            {k === 'branches' && <GitBranch className="mp-icon-12" />}
            {k === 'writeMode' && <Database className="mp-icon-12" />}
            {k === 'format' && <FileText className="mp-icon-12" />}
            {k === 'threshold' && <Sliders className="mp-icon-12" />}
            {k === 'maxRetries' && <RefreshCw className="mp-icon-12" />}
            <span>{label}</span>
          </div>
          {(k === 'prompt' || k === 'schema' || k === 'sample') ? (
            <textarea
              value={value}
              onChange={(e) => updateField(k, e.target.value)}
              rows={5}
              className="mp-w-full mp-m-0 mp-text-sm mp-py-2 mp-px-3 mp-mono mp-lh-16 mp-rounded mp-flow-textarea"
            />
          ) : (
            <input
              value={value}
              onChange={(e) => updateField(k, e.target.value)}
              className="mp-w-full mp-text-body mp-py-2 mp-px-3 mp-rounded mp-flow-input mp-flow-input--inherit"
            />
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
      className="mp-flex mp-flow-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mp-hidden mp-rounded mp-flex-col mp-flex-1 mp-m-4 mp-flow-shell"
      >
        {/* 顶部工具栏 */}
        <div className="mp-gap-3 mp-flex-center mp-py-3 mp-px-5 mp-flow-toolbar">
          <div className="mp-fw-600 mp-gap-2 mp-text-md mp-flex-center mp-flow-toolbar-title">
            <Workflow className="mp-icon-16 mp-flow-accent-text" />
            流程编排 · 全屏编辑
          </div>
          {/* 布局切换 segmented control */}
          <div className="mp-flex mp-gap-1 mp-p-1 mp-rounded mp-flow-segmented">
            <button
              onClick={() => setLayoutMode('fixed')}
              className={`mp-inline-flex mp-items-center mp-fw-500 mp-clickable mp-gap-1 mp-text-xs mp-py-1 mp-px-2 mp-border-none mp-rounded-sm mp-flow-seg-btn${layoutMode === 'fixed' ? ' mp-flow-seg-btn--active' : ''}`}
              title="固定布局：节点位置由 BPMN 引擎自动布局（BPMN 风格，适合审批/业务流程）"
            ><Grid3x3 className="mp-icon-12" />固定布局</button>
            <button
              onClick={() => setLayoutMode('free')}
              className={`mp-inline-flex mp-items-center mp-fw-500 mp-clickable mp-gap-1 mp-text-xs mp-py-1 mp-px-2 mp-border-none mp-rounded-sm mp-flow-seg-btn${layoutMode === 'free' ? ' mp-flow-seg-btn--active' : ''}`}
              title="自由布局：节点可任意拖动（适合 AI 协同流程）"
            ><MousePointerSquareDashed className="mp-icon-12" />自由布局</button>
          </div>
          <div className="mp-flow-divider-v" />
          <select
            className="mp-text-body mp-clickable mp-py-1 mp-px-3 mp-sans mp-rounded mp-flow-select"
            defaultValue="客户数据清洗 Action"
          >
            <option>客户数据清洗 Action</option>
            <option>订单风险评估 Action</option>
          </select>
          {/* 撤销/重做 官方组件 —— 必须在 Provider 内 */}
          <div ref={(el) => setFlowgramSlot('undoSlot', el)}></div>
          <div className="mp-flex-1" />
          <div className="mp-gap-4 mp-text-sm mp-flex-center mp-flow-text-muted">
            <div ref={(el) => setFlowgramSlot('counterSlot', el)}></div>
          </div>
          <div className="mp-flow-divider-v" />
          <button className="mp-inline-flex mp-items-center mp-text-sm mp-clickable mp-gap-1 mp-rounded mp-flow-btn"><Play className="mp-icon-14" />运行调试</button>
          <button className="mp-inline-flex mp-items-center mp-text-sm mp-clickable mp-gap-1 mp-rounded mp-flow-btn"><Download className="mp-icon-14" />导出</button>
          <button
            onClick={() => {
              const flow = (docRef.current as { toJSON?: () => WorkflowJSON } | null)?.toJSON?.() || initialData;
              void onSave(flow, nodeConfig);
            }}
            disabled={saving}
            className="mp-inline-flex mp-items-center mp-fw-600 mp-text-sm mp-gap-1 mp-border-none mp-rounded mp-flow-btn-cta"
          ><Save className="mp-icon-14 mp-flow-on-accent" />{saving ? '保存中…' : '保存'}</button>
          <button
            onClick={onClose}
            title="退出全屏"
            className="mp-flex-center mp-justify-center mp-clickable mp-rounded mp-flow-icon-btn"
          ><Minimize2 className="mp-icon-14" /></button>
        </div>

        {/* 主体：左侧节点库 + 中间大画布 + 右侧节点属性面板 */}
        <div className="mp-flex mp-flex-1 mp-min-h-0" >
          {/* 画布（左侧节点库作为 Provider 的 leftSlot 传入）—— 根据 layoutMode 切换 fixed / free */}
          {layoutMode === 'fixed' ? (
            <FixedLayoutEditor
              initialData={initialData}
              palette={palette}
              onSelectNode={setActiveNodeId}
              onDocumentReady={(doc) => { docRef.current = doc; setDoc(doc); }}
              leftSlot={<FixedNodeLibrary palette={palette} />}
            />
          ) : (
            <FullscreenFlowEditor
              initialData={initialData}
              nodeRegistries={nodeRegistries}
              CustomNode={CustomNode}
              palette={palette}
              onSelectNode={setActiveNodeId}
              onDocumentReady={(doc) => { docRef.current = doc; setDoc(doc); }}
              leftSlot={<FreeNodeLibrary palette={palette} />}
            />
          )}

          {/* 节点属性面板（右侧）—— 默认隐藏，点击节点才显示 */}
          {activeNodeId && (
          <div className="mp-shrink-0 mp-flex-col mp-flow-inspector">
            {/* 头部：节点标识 */}
            <div className="mp-py-4 mp-px-5 mp-flow-panel-head">
              <div className="mp-justify-between mp-mb-2 mp-flex-center">
                <div className="mp-fw-600 mp-gap-2 mp-flex-center mp-text-md mp-flow-panel-title">
                  <Settings className="mp-icon-16 mp-flow-accent-text" />
                  节点配置
                </div>
                <span className="mp-inline-flex mp-items-center mp-fw-500 mp-gap-1 mp-text-xs mp-py-1 mp-px-2 mp-rounded-sm mp-flow-badge">
                  <TypeIcon className="mp-icon-12" />
                  {meta.category}
                </span>
                <button
                  onClick={() => setActiveNodeId(null)}
                  title="关闭面板"
                  className="mp-flex-center mp-justify-center mp-clickable mp-icon-20 mp-border-none mp-rounded-sm mp-flow-icon-btn-ghost"
                  onMouseEnter={(e) => { e.currentTarget.style.background = palette.panelMuted; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                ><X className="mp-icon-14" /></button>
              </div>
              {/* v1.5 R1.6：title/desc 走 liveData（FlowGram document），新拖入节点也能显示 */}
              <input
                value={String(activeData.title || '')}
                placeholder="节点标题"
                onChange={(e) => updateField('title', e.target.value)}
                className="mp-w-full mp-fw-500 mp-mt-1 mp-text-body mp-py-1 mp-px-2 mp-border-none mp-rounded-sm mp-flow-input-plain"
              />
              <input
                value={String(activeData.desc || '')}
                placeholder="节点描述"
                onChange={(e) => updateField('desc', e.target.value)}
                className="mp-w-full mp-mt-1 mp-text-sm mp-py-1 mp-px-2 mp-border-none mp-rounded-sm mp-flow-input-plain mp-flow-input-plain--muted"
              />
            </div>

            {/* 分组 Section tab */}
            <div className="mp-flex mp-gap-1 mp-py-2 mp-px-4 mp-flow-sectionbar">
              {meta.sections.map((s) => {
                const active = activeSection === s;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSection(s)}
                    className={`mp-clickable mp-nowrap mp-text-sm mp-py-1 mp-px-3 mp-rounded mp-flow-sectab${active ? ' mp-flow-sectab--active' : ''}`}
                  >{s}</button>
                );
              })}
            </div>

            {/* 字段内容 */}
            <div className="mp-flex-1 mp-overflow-auto mp-py-4 mp-px-5" >
              {renderSectionFields(activeSection)}
            </div>

            {/* 底部操作 */}
            <div className="mp-flex mp-gap-2 mp-py-3 mp-px-5 mp-flow-panel-foot">
              <button onClick={copyActiveNode} className="mp-inline-flex mp-items-center mp-flex-1 mp-text-sm mp-justify-center mp-clickable mp-gap-1 mp-rounded mp-flow-btn"><Copy className="mp-icon-14" />复制节点</button>
              <button onClick={deleteActiveNode} className="mp-inline-flex mp-items-center mp-flex-1 mp-text-sm mp-justify-center mp-clickable mp-gap-1 mp-rounded mp-flow-btn"><Trash2 className="mp-icon-14" />删除节点</button>
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

// MP-SAL：把 WorkflowDocument 从父层传下来 —— useService 拿不到（DI 容器没注册
// WorkflowDocument 这个 token），改为 React Context 注入，onDocumentReady 触发 setDoc
// 触发 Provider 重渲。
const WorkflowDocumentContext = React.createContext<any>(null);

// 节点面板渲染器：MP-SAL 修复 —— free-node-panel 插件的 WorkflowNodePanelService
// 内部 this.document 未注入（Layer onReady 绑定丢失），onSelect 走它会无效。
// 这里直接从父 WorkflowDocumentContext 取 document（useService 拿不到 —— DI 容器没注册它）。
function MyNodePanelRenderer(props: NodePanelRenderProps & { palette: FlowPalette }) {
  const { onSelect, onClose, palette } = props;
  const document = React.useContext(WorkflowDocumentContext);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mp-grid mp-absolute mp-gap-1 mp-p-1 mp-rounded mp-flow-nodepanel"
    >
      {NODE_LIBRARY.map((n) => {
        const Icon = n.icon;
        return (
          <div
            key={n.type}
            onClick={() => {
              // 自管 addNode：绕开 broken 的 free-node-panel 内部调用链
              const id = `${n.type.replace('flow-', '')}_${Date.now().toString(36)}`;
              const node = document.createWorkflowNodeByType(
                n.type,
                { x: 120 + Math.random() * 200, y: 200 + Math.random() * 200 },
                { id, type: n.type, data: {
                  originalType: n.type, title: n.title, desc: n.desc,
                }},
              );
              // 触发 onSelect 仍走 plugin 协议（保持向后兼容），但确保 addNode 实际生效
              onSelect({ nodeType: n.type, selectEvent: new MouseEvent('click') as unknown as React.MouseEvent });
              void node; // 抑制未用警告；document.addNode 是真实落地
              onClose();
            }}
            className="mp-clickable mp-gap-2 mp-text-sm mp-flex-center mp-py-2 mp-px-2 mp-rounded mp-flow-nodepanel-item"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = palette.lineSelected; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = palette.modalBorder; }}
          >
            <div className={`mp-justify-center mp-shrink-0 mp-flex-center mp-icon-20 mp-rounded mp-flow-type-tile mp-flow-type-tile--${n.type.replace('flow-', '')}`}>
              <Icon className="mp-icon-12" />
            </div>
            <span className="mp-fw-500">{n.title}</span>
          </div>
        );
      })}
      <button
        onClick={onClose}
        className="mp-clickable mp-text-xs mp-border-none mp-py-1 mp-px-1 mp-flow-nodepanel-cancel"
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
      className="mp-justify-center mp-flex-center mp-rounded mp-flow-icon-btn"
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
      className="mp-gap-1 mp-p-1 mp-flex-center mp-rounded mp-flow-float"
    >
      {makeBtn(palette, '缩小 (Cmd+-)', <ZoomOut className="mp-icon-14" />, handleZoom(() => tools.zoomout()))}
      <div className="mp-text-center mp-text-xs mp-mono mp-flow-zoom-label">
        {Math.round(zoom * 100)}%
      </div>
      {makeBtn(palette, '放大 (Cmd+=)', <ZoomIn className="mp-icon-14" />, handleZoom(() => tools.zoomin()))}
      <div className="mp-flow-divider-v" />
      {makeBtn(palette, '适应画布', <Maximize2 className="mp-icon-14" />, handleZoom(() => tools.fitView()))}
      {makeBtn(palette, '自动布局', <Grid3x3 className="mp-icon-14" />, handleZoom(() => tools.autoLayout()))}
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
      className="fixed-base-node mp-justify-center mp-flex-col mp-gap-1 mp-py-2 mp-px-3 mp-sans mp-rounded"
      style={{ width: nodeWidth, minHeight: 80, background: '#0a0a0a', border: `1px solid ${isSelected ? tColor : 'rgba(255,255,255,0.12)'}`, cursor: 'grab', color: '#fafafa', boxShadow: isSelected
          ? `0 0 0 2px ${tColor}50, 0 0 0 1px ${tColor}, 0 0 28px ${tColor}50, 0 6px 16px rgba(0,0,0,0.45)`
          : isActivated
          ? `0 0 0 1px ${tColor}70, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 1px 2px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)', transition: 'box-shadow .18s, border-color .18s, transform .12s', transform: isSelected ? 'translateY(-1px)' : 'translateY(0)', opacity: nodeRender.dragging ? 0.35 : 1 }}
      onMouseDown={(e) => {
        onSelect?.(n.id);
        nodeRender.startDrag(e);
      }}
    >
      <div className="mp-gap-2 mp-flex-center">
        {/* 节点类型 pill —— 官方深色风格：半透明背景 + 类型色文字 */}
        <div className="mp-justify-center mp-shrink-0 mp-text-xs mp-flex-center mp-rounded" style={{ width: 26, height: 22, background: labelInfo.bg, color: labelInfo.text, fontWeight: 700, letterSpacing: '0.02em' }}>{labelInfo.label}</div>
        <div className="mp-fw-600 mp-ellipsis mp-flex-1 mp-text-body mp-flow-node-title">{display.title || n.id}</div>
      </div>
      <div className="mp-text-xs mp-flow-node-sub">{display.desc || ' '}</div>
    </div>
  );
}

// 固定布局编辑器（FixedLayout）
function FixedLayoutEditor({
  initialData, palette, onSelectNode, onDocumentReady, leftSlot,
}: {
  initialData: WorkflowJSON;
  palette: FlowPalette;
  onSelectNode: (id: string) => void;
  onDocumentReady?: (doc: unknown) => void;
  leftSlot?: React.ReactNode;
}) {
  const [doc, setDoc] = React.useState<any>(null);
  const docRef = React.useRef<any>(null);
  const opRef = React.useRef<{ deleteNode?: (id: string) => void } | null>(null);
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
          <div className="mp-w-full mp-h-full mp-flex">
            {leftSlot}
            <div className="mp-flex-1 mp-relative mp-flow-canvas-bg">
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
                  docRef.current = ctx.document; setDoc(ctx.document);
                  opRef.current = (ctx as unknown as { operation?: { deleteNode?: (id: string) => void } }).operation ?? null;
                  (window as unknown as { __flowgram_op__?: unknown }).__flowgram_op__ = opRef.current;
                  onDocumentReady?.(ctx.document);
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
                <div className="mp-w-full mp-h-full mp-flex">
                  <div className="mp-flex-1 mp-relative" >
                    <EditorRenderer className="mp-w-full mp-h-full" />
                    <div ref={(el) => setFlowgramSlot('zoomSlot', el)} className="mp-flex mp-justify-center mp-absolute mp-pe-none mp-flow-zoom-slot"></div>
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
  initialData, nodeRegistries, CustomNode, palette, onSelectNode, onDocumentReady, leftSlot,
}: {
  initialData: WorkflowJSON;
  nodeRegistries: WorkflowNodeRegistry[];
  CustomNode: React.ComponentType;
  palette: FlowPalette;
  onSelectNode: (id: string) => void;
  onDocumentReady?: (doc: unknown) => void;
  leftSlot?: React.ReactNode;
}) {
  const [doc, setDoc] = useState<any>(null);
  const docRef = React.useRef<any>(null);
  const opRef = React.useRef<{ deleteNode?: (id: string) => void } | null>(null);
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

  // 拿 client context 用来在 dropzone onDrop 里访问 linesManager（v1.6：自动建连线）
  const ctx = useClientContext();
  return (
    <WorkflowDocumentContext.Provider value={doc}>
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
            docRef.current = ctx.document; setDoc(ctx.document);
            opRef.current = (ctx as unknown as { operation?: { deleteNode?: (id: string) => void } }).operation ?? null;
            (window as unknown as { __flowgram_op__?: unknown }).__flowgram_op__ = opRef.current;
            onDocumentReady?.(ctx.document);
            try { (ctx.playground as { zoom?: number }).zoom = 1; } catch { /* ignore */ }
            ctx.tools.fitView(false);
          }}
        >
          <div className="mp-w-full mp-h-full mp-flex">
            {/* leftSlot 必须在 Provider 内（依赖 useService/usePlayground） */}
            {leftSlot}
            <FreeLayoutDropZone
              onDocumentReady={onDocumentReady}
              onSelectNode={onSelectNode}
              docRef={docRef}
              setDoc={setDoc}
            />
          </div>
          <FlowToolsWithProvider />
        </FreeLayoutEditorProvider>
      </SelectionContext.Provider>
    </FlowPaletteContext.Provider>
    </WorkflowDocumentContext.Provider>
  );
}

// 内部组件：拿 useClientContext 后的 FreeLayoutEditor 子树（含 dropzone + onDrop）
function FreeLayoutDropZone({
  onDocumentReady,
  onSelectNode,
  docRef,
  setDoc,
}: {
  onDocumentReady?: (doc: unknown) => void;
  onSelectNode: (id: string) => void;
  docRef: React.MutableRefObject<any>;
  setDoc: React.Dispatch<React.SetStateAction<any>>;
}) {
  const ctx = useClientContext();
  return (
    <div
      data-flowgram-dropzone
      className="mp-flex-1 mp-relative"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/flowgram-node')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData('application/flowgram-node');
        if (!raw) return;
        e.preventDefault();
        const doc = docRef.current as null | { createWorkflowNodeByType: Function };
        if (!doc) return;
        const layer = (e.currentTarget.querySelector('.gedit-playground-layer') as HTMLElement | null);
        const rect = layer?.getBoundingClientRect();
        const transform = layer?.style?.transform || '';
        const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
        const transMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
        const tx = transMatch ? parseFloat(transMatch[1]) : 0;
        const ty = transMatch ? parseFloat(transMatch[2]) : 0;
        const cx = ((e.clientX - (rect?.left || 0)) - tx) / scale;
        const cy = ((e.clientY - (rect?.top || 0)) - ty) / scale;
        const id = `${raw.replace('flow-', '')}_${Date.now().toString(36)}`;
        // 默认 title/desc：flow-* → 短名 → NODE_DATA 兜底（v1.6：避免空 title 字段）
        const shortType = raw.replace('flow-', '');
        const nodeMeta = NODE_LIBRARY.find((n) => n.type === raw);
        const defaults = (NODE_DATA as Record<string, { title: string; desc: string }>)[shortType];
        const title = nodeMeta?.title || defaults?.title || raw;
        const desc = nodeMeta?.desc || defaults?.desc || '从节点库拖入';
        doc.createWorkflowNodeByType(raw, { x: cx - 110, y: cy - 40 }, {
          id, type: raw,
          data: { originalType: raw, title, desc },
        });
        // v1.6：port-to-port 自动连线
        // 策略：连到「最后一个节点」（start 跳过连 + 第一个节点时连 start）
        try {
          const c = ctx as unknown as { document?: { linesManager?: { createLine?: (o: any) => void }; toJSON?: () => { nodes?: Array<{id:string}> } | null } } | null;
          const linesManager = c?.document?.linesManager;
          const docAll = doc as unknown as { toJSON?: () => { nodes?: Array<{id:string}> } | null } | null;
          const json = docAll?.toJSON?.() || c?.document?.toJSON?.();
          if (json && linesManager && typeof linesManager.createLine === 'function') {
            const all = (json.nodes || []).map((n) => n.id);
            const candidates = all.filter((nid) => nid !== id);
            // 跳过 start 不主动建线（start 只有 output 端口）
            if (raw === 'flow-start') {
              // do nothing
            } else if (candidates.length === 0) {
              // 没有候选节点时尝试连 start（如有）
              const start = (json.nodes || []).find((n: { id: string }) => n.id.includes('start'));
              if (start) linesManager.createLine({ from: start.id, to: id });
            } else {
              // 默认连到最后一个节点（按 nodes 数组顺序）
              const lastId = candidates[candidates.length - 1];
              if (lastId && lastId !== id) {
                linesManager.createLine({ from: lastId, to: id });
              }
            }
          }
        } catch (err) {
          console.warn('[drop] auto-line failed:', err);
        }
      }}
    >
      <EditorRenderer className="mp-w-full mp-h-full" />
      {/* 缩放/适应/自动布局 —— 画布顶部悬浮 */}
      <div ref={(el) => setFlowgramSlot('zoomSlot', el)} className="mp-flex mp-justify-center mp-absolute mp-pe-none mp-flow-zoom-slot"></div>
    </div>
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
    <div className="mp-gap-1 mp-flex-center">
      {makeBtn(palette, '撤销 (Cmd+Z)', <Undo2 className="mp-icon-14" />, undoRedo.undo, !undoRedo.canUndo)}
      {makeBtn(palette, '重做 (Cmd+Shift+Z)', <Redo2 className="mp-icon-14" />, undoRedo.redo, !undoRedo.canRedo)}
    </div>,
    undoSlot
  );
}

// 实时节点/连线计数（用 WorkflowDocument.toJSON）
function FlowCounterInner() {
  const document = React.useContext(WorkflowDocumentContext);
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
    if (!document) return;
    const d = document as unknown as { onContentChange?: (cb: () => void) => { dispose: () => void } };
    if (d.onContentChange) {
      const disp = d.onContentChange(() => force());
      return () => disp.dispose();
    }
  }, [document]);
  const data = document?.toJSON?.() || {};
  const nodeCount = (data.nodes || []).length;
  const edgeCount = (data.edges || []).length;
  if (!palette || !counterSlot) return null;
  return ReactDOM_createPortal(
    <>
      <div className="mp-gap-1 mp-flex-center">
        <Boxes className="mp-icon-12" />
        <span>节点</span>
        <span className="mp-fw-600 mp-mono mp-flow-text">{nodeCount}</span>
      </div>
      <div className="mp-gap-1 mp-flex-center">
        <Activity className="mp-icon-12" />
        <span>连线</span>
        <span className="mp-fw-600 mp-mono mp-flow-text">{edgeCount}</span>
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
    <div className="mp-shrink-0 mp-flex-col mp-w-240 mp-flow-nodelib">
      <div className="mp-py-3 mp-px-4 mp-flow-nodelib-head">
        <div className="mp-fw-600 mp-text-body mp-flex-center mp-gap-1 mp-flow-text">
          <Boxes className="mp-icon-14 mp-flow-accent-text" />
          节点库
        </div>
        <div className="mp-mt-1 mp-text-xs mp-flow-text-muted">点击或拖拽节点到画布</div>
      </div>
      <div className="mp-flex-1 mp-p-3 mp-overflow-auto" >
        {/* scenario 名需与 NODE_LIBRARY 实际数据一致：'业务流' / '审批流' / 'AI'。
            之前的 'AI 协同' 字面量与 scenario: 'AI' 不匹配，导致 AI 分组整段 return null 静默丢失。 */}
        {(['业务流', '审批流', 'AI'] as const).map((scenario) => {
          // 按 scenario 分组，每个 scenario 内的子分类（数据源/逻辑/AI/审批）合并展示
          const items = NODE_LIBRARY.filter((n) => n.scenario === scenario);
          if (items.length === 0) return null;
          return (
            <div key={scenario} className="mp-mb-5">
              <div className="mp-mb-2 mp-flex-center mp-gap-1 mp-flow-nodelib-group">
                <div className={`mp-icon-12 mp-flow-scenario-dot${scenario === '业务流' ? ' mp-flow-scenario-dot--biz' : scenario === '审批流' ? ' mp-flow-scenario-dot--approval' : ' mp-flow-scenario-dot--ai'}`} />
                <div className="mp-fw-600 mp-text-xs mp-flow-scenario-name">{scenario}</div>
                <div className="mp-text-xs mp-flow-text-muted">({items.length})</div>
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
                    className="mp-mb-1 mp-gap-2 mp-flex-center mp-ml-3 mp-py-2 mp-px-2 mp-rounded mp-flow-nodelib-item"
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = palette.lineSelected; e.currentTarget.style.background = palette.modalPanel; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = palette.modalBorder; e.currentTarget.style.background = palette.panelMuted; }}
                    title={`拖拽「${n.title}」到画布`}
                  >
                    <div className={`mp-justify-center mp-shrink-0 mp-flex-center mp-icon-20 mp-rounded mp-flow-type-tile mp-flow-type-tile--${n.type.replace('flow-', '')}`}>
                      <Icon className="mp-icon-12" />
                    </div>
                    <div className="mp-flex-1">
                      <div className="mp-fw-500 mp-text-sm mp-flow-text">{n.title}</div>
                      <div className="mp-hidden mp-nowrap mp-text-xs mp-ellipsis-text mp-flow-text-muted">{n.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mp-text-xs mp-py-2 mp-px-4 mp-flow-nodelib-foot">
        提示：点击或拖拽节点到画布
      </div>
    </div>
  );
}

/* 旧分组代码已废弃 */

// 自由布局节点库：使用 free-layout 官方 API 添加节点
function FreeNodeLibrary({ palette }: { palette: FlowPalette }) {
  const documentCtx = React.useContext(WorkflowDocumentContext);
  const documentRef = React.useRef<any>(documentCtx);
  React.useEffect(() => { documentRef.current = documentCtx; }, [documentCtx]);
  const playground = usePlayground();
  const addNode = React.useCallback((item: typeof NODE_LIBRARY[number]) => {
    const document = documentRef.current;
    if (!document) { console.warn('[MP-SAL] document not ready; click ignored'); return; }
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
  }, [playground]);
  return <NodeLibrary palette={palette} addNode={addNode} />;
}

// 固定布局节点库：使用 fixed-layout 官方 document.addNode 添加节点
function FixedNodeLibrary({ palette }: { palette: FlowPalette }) {
  const ctx = useClientContext();
  const ctxRef = React.useRef(ctx);
  React.useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  const addNode = React.useCallback((item: typeof NODE_LIBRARY[number]) => {
    const c = ctxRef.current;
    if (!c) return;
    const id = `${item.type.replace('flow-', '')}_${Date.now().toString(36)}`;
    (c.document as unknown as { addNode?: (n: unknown) => void }).addNode?.({
      id,
      type: 'custom',
      data: { originalType: item.type, title: item.title, desc: item.desc },
    });
  }, []);
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
    <div className="mp-gap-1 mp-flex-center">
      {makeBtn(palette, '撤销 (Cmd+Z)', <Undo2 className="mp-icon-14" />, () => tools.undo(), !tools.canUndo)}
      {makeBtn(palette, '重做 (Cmd+Shift+Z)', <Redo2 className="mp-icon-14" />, () => tools.redo(), !tools.canRedo)}
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
      <div className="mp-gap-1 mp-flex-center">
        <Boxes className="mp-icon-12" />
        <span>节点</span>
        <span className="mp-fw-600 mp-mono mp-flow-text">{nodeCount}</span>
      </div>
      <div className="mp-gap-1 mp-flex-center">
        <Activity className="mp-icon-12" />
        <span>连线</span>
        <span className="mp-fw-600 mp-mono mp-flow-text">{edgeCount}</span>
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
      className="mp-gap-1 mp-p-1 mp-flex-center mp-rounded mp-flow-float mp-flow-float--interactive"
    >
      {makeBtn(palette, '缩小 (Cmd+-)', <ZoomOut className="mp-icon-14" />, handleAction(() => tools.zoomout()))}
      <div className="mp-text-center mp-text-xs mp-mono mp-flow-zoom-label">
        {Math.round(tools.zoom * 100)}%
      </div>
      {makeBtn(palette, '放大 (Cmd+=)', <ZoomIn className="mp-icon-14" />, handleAction(() => tools.zoomin()))}
      <div className="mp-flow-divider-v" />
      {makeBtn(palette, '适应画布', <Maximize2 className="mp-icon-14" />, handleAction(() => tools.fitView()))}
      {makeBtn(palette, '切换布局', <Grid3x3 className="mp-icon-14" />, handleAction(() => tools.changeLayout()))}
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
      className="mp-flex mp-flex-1 mp-relative mp-flow-canvas-bg"
    >
      {children}
    </div>
  );
}

// 全屏节点渲染器：从 FlowPaletteContext 读 palette 实现反色
// v1.5 R1.6：参考 FlowGram 官方 base-node.tsx —— 加 onMouseDown={nodeRender.startDrag}
// 让节点能自由拖动定位；加 hover 状态 + Trash2 删除按钮
function FullscreenBaseNode({ onSelect }: { onSelect?: (id: string) => void } = {}) {
  const nodeRender = useNodeRender();
  const ctx = useClientContext();
  const n = nodeRender.node;
  const palette = React.useContext(FlowPaletteContext);
  const [isHover, setIsHover] = React.useState(false);

  const idToType: Record<string, string> = {
    'input': 'input', 'output': 'output',
    'llm-extract': 'llm', 'llm-relation': 'llm',
    'condition': 'condition', 'loop-complete': 'loop', 'tool-ontology': 'tool',
  };
  const shortType = idToType[n.id] || String(n.type || '').replace(/^flow-/, '').toLowerCase();
  // 优先从 nodeRender.data 取（FlowGram 自动从 WorkflowNodeJSON.data 提取）
  const data = (nodeRender.data as { title?: string; desc?: string } | undefined)
    || (NODE_DATA[n.id] as { title?: string; desc?: string } | undefined) || {};
  const isSel = !!nodeRender.selected;

  // CSS 注入已由父级 FlowFullscreenEditor 完成（避免每个节点都操作 DOM）

  if (!palette) return null;

  const labelInfo = palette.nodeLabel(shortType);
  const tColor = palette.typeColor(shortType);
  const doDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.operation.deleteNode(n);
  };

  return (
    <div
      ref={nodeRender.nodeRef as unknown as React.RefObject<HTMLDivElement>}
      onClick={(e) => { e.stopPropagation(); onSelect?.(n.id); nodeRender.selectNode(e); }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onMouseDown={(e) => {
        // 官方 base-node 模式：startDrag + stopPropagation，让节点可拖动
        nodeRender.startDrag(e);
        e.stopPropagation();
      }}
      className="mp-w-full mp-h-full mp-p-3 mp-sans mp-rounded-lg" style={{ background: palette.nodeBg, border: `2px solid ${isSel ? tColor : palette.nodeBorder}`, cursor: 'grab', transition: 'box-shadow .15s, border-color .15s, transform .15s', boxShadow: isSel
          ? `0 0 0 3px ${tColor}, 0 0 0 6px ${tColor}40, 0 8px 24px ${tColor}80`
          : isHover
            ? `0 4px 16px ${tColor}40, 0 0 0 1px ${tColor}60`
            : palette.nodeShadow, boxSizing: 'border-box', color: palette.nodeText, pointerEvents: 'auto', userSelect: 'none', opacity: 1 }}
    >
      <div className="mp-gap-2 mp-flex-center mp-mb-1" >
        <div className="mp-justify-center mp-shrink-0 mp-text-xs mp-flex-center mp-icon-20 mp-rounded" style={{ background: labelInfo.bg, color: labelInfo.text, fontWeight: 700 }}>{labelInfo.label}</div>
        <div className="mp-fw-600 mp-ellipsis mp-flex-1 mp-text-sm" style={{ color: palette.nodeText }}>{data.title || data.title || '未命名'}</div>
        {(isHover || isSel) && (
          <button
            onClick={doDelete}
            title="删除节点"
            className="mp-justify-center mp-clickable mp-p-1 mp-flex-center mp-border-none mp-opacity-70" style={{ background: 'transparent', color: palette.nodeDesc }}
          >✕</button>
        )}
      </div>
      <div className="mp-ellipsis mp-text-xs" style={{ color: palette.nodeDesc, lineHeight: 1.4 }}>{data.desc || ' '}</div>
    </div>
  );
}

// FlowGram 自定义默认节点渲染器：直接基于 node.type 选择 color 和 label
// v1.5 R1.6：加 onMouseDown={nodeRender.startDrag} 跟官方 base-node 一致，让节点可拖动
function CustomBaseNode() {
  const nodeRender = useNodeRender();
  const ctx = useClientContext();
  const n = nodeRender.node;
  const [isHover, setIsHover] = React.useState(false);
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
  const doDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.operation.deleteNode(n);
  };
  return (
    <div
      ref={nodeRender.nodeRef as unknown as React.RefObject<HTMLDivElement>}
      onClick={(e) => { e.stopPropagation(); nodeRender.selectNode(e); }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onMouseDown={(e) => {
        // 官方 base-node 模式：startDrag + stopPropagation，让节点可自由拖动
        nodeRender.startDrag(e);
        e.stopPropagation();
      }}
      className="mp-w-full mp-h-full mp-p-3 mp-sans mp-rounded" style={{ background: '#111111', border: `2px solid ${isSel ? c.border : isHover ? c.text : c.border}`, cursor: 'grab', transition: 'box-shadow .15s, transform .15s, border-color .15s', boxShadow: isSel ? `0 0 0 2px ${c.border}, 0 0 16px ${c.bg}` : isHover ? `0 0 0 1px ${c.text}80` : `0 0 0 1px ${c.bg}`, boxSizing: 'border-box', color: '#fafafa', pointerEvents: 'auto', userSelect: 'none', opacity: 1 }}
    >
      <div className="mp-gap-2 mp-flex-center mp-mb-1" >
        <div className="mp-fw-600 mp-flex-center mp-justify-center mp-shrink-0 mp-text-xs mp-icon-20 mp-rounded" style={{ background: c.bg, color: c.text }}>{c.label}</div>
        <div className="mp-hidden mp-fw-600 mp-flex-1 mp-text-sm mp-nowrap mp-ellipsis-text mp-flow-node-title">{data?.title || '未命名'}</div>
        {(isHover || isSel) && (
          <button
            onClick={doDelete}
            title="删除节点"
            className="mp-justify-center mp-clickable mp-p-1 mp-text-md mp-flex-center mp-border-none mp-opacity-70 mp-flow-node-close-alt"
          >✕</button>
        )}
      </div>
      <div className="mp-hidden mp-nowrap mp-text-xs mp-ellipsis-text mp-flow-node-sub-alt">{data?.desc || ' '}</div>
    </div>
  );
}

export default function OntologyActionPage() {
  const navigate = useNavigate();
    const [actionTypes, setActionTypes] = useState<KernelActionType[]>([]);
  const [objectTypes, setObjectTypes] = useState<KernelObjectType[]>([]);
  const [loadingKernel, setLoadingKernel] = useState(true);
  // 选中 ActionType 的 rid（真实数据按 rid 索引，避免顺序耦合）
  const [selectedActionRid, setSelectedActionRid] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFlowNode, setSelectedFlowNode] = useState('llm-extract');
  const [actionFlowSelect, setActionFlowSelect] = useState('客户数据清洗 Action');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ats, ots] = await Promise.all([
          listActionTypes().catch(() => [] as KernelActionType[]),
          listObjectTypes().catch(() => [] as KernelObjectType[]),
        ]);
        if (!active) return;
        setActionTypes(ats);
        setObjectTypes(ots);
        if (ats.length > 0) setSelectedActionRid((prev) => prev && ats.some((a) => a.rid === prev) ? prev : ats[0].rid);
      } catch (e) {
        console.warn('Action 数据加载失败', e);
      } finally {
        if (active) setLoadingKernel(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedAction = actionTypes.find((a) => a.rid === selectedActionRid) ?? null;

  const otDisplayName = (rid: string) => {
    const ot = objectTypes.find((o) => o.rid === rid);
    if (ot) return ot.display_name || slugAndVersionOfObjectType(rid).slug;
    return rid.split('.').slice(-2, -1)[0] ?? rid;
  };

  // 真实统计（来自 kernel 数据）
  const stats = useMemo(() => ({
    total: actionTypes.length,
    params: actionTypes.reduce((acc, a) => acc + a.parameters.length, 0),
    targets: new Set(actionTypes.flatMap((a) => a.on)).size,
    functions: new Set(actionTypes.map((a) => a.function_ref)).size,
  }), [actionTypes]);

  // 节点颜色已抽取到模块级 colorOf

  // 流程编排定义（初始内置 demo；选中 Action 后加载其持久化 flow，未保存则回退 demo）
  const [initialData, setInitialData] = useState<WorkflowJSON>(DEFAULT_FLOW);
  const [flowConfig, setFlowConfig] = useState<NodeConfig>(() =>
    JSON.parse(JSON.stringify(NODE_DETAIL_PROPS)),
  );
  const [savingFlow, setSavingFlow] = useState(false);

  useEffect(() => {
    if (!selectedActionRid) return;
    let active = true;
    getActionFlow(selectedActionRid)
      .then((f) => {
        if (!active) return;
        setInitialData(f.flow_json as unknown as WorkflowJSON);
        setFlowConfig((f.config || {}) as NodeConfig);
      })
      .catch(() => {
        if (!active) return;
        setInitialData(DEFAULT_FLOW);
        setFlowConfig(JSON.parse(JSON.stringify(NODE_DETAIL_PROPS)));
      });
    return () => { active = false; };
  }, [selectedActionRid]);

  const saveFlow = async (flow: WorkflowJSON, config: NodeConfig) => {
    if (!selectedActionRid || savingFlow) return;
    setSavingFlow(true);
    try {
      await putActionFlow(selectedActionRid, flow as unknown as Record<string, unknown>, config as unknown as Record<string, unknown>);
    } finally {
      setSavingFlow(false);
    }
  };

  // 节点注册：start/end/其他 6 种类型（渲染通过 FreeLayoutEditorProvider 的 materials.renderDefaultNode = CustomBaseNode）
  // start 只有 output 端口（流程起点），end 只有 input 端口（流程终点）—— BPMN 起止语义
  const nodeRegistries: WorkflowNodeRegistry[] = [
    { type: 'flow-start',     meta: { size: { width: 180, height: 64 }, defaultPorts: [{ type: 'output' }] } },
    { type: 'flow-end',       meta: { size: { width: 180, height: 64 }, defaultPorts: [{ type: 'input'  }] } },
    { type: 'flow-input',     meta: { size: { width: 220, height: 80 }, defaultPorts: [{ type: 'output' }] } },
    { type: 'flow-llm',       meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-condition', meta: { size: { width: 200, height: 80 } } },
    { type: 'flow-loop',      meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-tool',      meta: { size: { width: 220, height: 80 } } },
    { type: 'flow-output',    meta: { size: { width: 220, height: 80 }, defaultPorts: [{ type: 'input' }] } },
  ];

  // 详情区子 tab（包含流程编排作为只读预览 tab）
  type DetailTab = 'basic' | 'io' | 'relations' | 'flow';
  const [detailTab, setDetailTab] = useState<DetailTab>('basic');
  // 全屏编辑模式
  const [flowFullscreen, setFlowFullscreen] = useState(false);

  return (
    <div className="mp-flex mp-flex-1 mp-min-h-0 mp-flex-col" >
      <div className="mp-flex-1 mp-overflow-y-auto mp-min-h-0 mp-pb-6" >

      {/* Toolbar（Shell 已统一全局 AI 助手；此处只保留 tab-specific 操作） */}
      <div className="mp-justify-end mp-mt-6 mp-mb-4 mp-flex-center">
          <Button theme="light" type="secondary" ><TestTube className="mp-icon-16" />测试运行</Button>
          <Button theme="solid" type="primary" onClick={() => setDrawerOpen(true)} className="mp-ml-2"><Plus className="mp-icon-16" />新建 Action</Button>
        </div>

      {/* Stats（真实 kernel 数据） */}
      <div className="mp-flex mp-mb-6 mp-gap-4">
        <div className="mp-flex-1 mp-border mp-rounded mp-py-4 mp-px-5 mp-bg-1" >
          <div className="mp-text-xl mp-flow-stat-value">{loadingKernel ? '…' : stats.total}</div>
          <div className="mp-mt-1 mp-text-sm mp-text-2">Action 总数</div>
        </div>
        <div className="mp-flex-1 mp-border mp-rounded mp-py-4 mp-px-5 mp-bg-1" >
          <div className="mp-text-xl mp-flow-stat-value">{loadingKernel ? '…' : stats.targets}</div>
          <div className="mp-mt-1 mp-text-sm mp-text-2">作用对象数</div>
        </div>
        <div className="mp-flex-1 mp-border mp-rounded mp-py-4 mp-px-5 mp-bg-1" >
          <div className="mp-text-xl mp-flow-stat-value">{loadingKernel ? '…' : stats.params}</div>
          <div className="mp-mt-1 mp-text-sm mp-text-2">输入参数总数</div>
        </div>
        <div className="mp-flex-1 mp-border mp-rounded mp-py-4 mp-px-5 mp-bg-1" >
          <div className="mp-text-xl mp-flow-stat-value">{loadingKernel ? '…' : stats.functions}</div>
          <div className="mp-mt-1 mp-text-sm mp-text-2">引用 Function 数</div>
        </div>
      </div>

      <div className="mp-flex mp-gap-4 mp-flow-items-stretch">
        {/* Left: Action List */}
        <div className="mp-shrink-0 mp-w-240" >
          <Card className="mp-h-fit">
            <h3 className="mp-fw-600 mp-mb-4 mp-text-md">Actions</h3>
            {loadingKernel ? (
              <div className="mp-text-sm mp-text-2 mp-py-2 mp-px-3" >加载中…</div>
            ) : actionTypes.length === 0 ? (
              <div className="mp-text-sm mp-text-2 mp-py-2 mp-px-3" >暂无 ActionType</div>
            ) : actionTypes.map((a) => {
              const isSel = a.rid === selectedActionRid;
              return (
                <div
                  key={a.rid}
                  onClick={() => setSelectedActionRid(a.rid)}
                  title={a.rid}
                  className={`mp-clickable mp-mb-1 mp-gap-2 mp-text-body mp-flex-center mp-py-2 mp-px-3 mp-rounded-sm mp-flow-list-item${isSel ? ' mp-flow-list-item--active' : ''}`}
                >
                  <Zap className="mp-icon-16 mp-shrink-0"  />
                  <div className="mp-flex-1">
                    <div className="mp-hidden mp-text-body mp-nowrap mp-ellipsis-text" >{actionDisplayName(a)}</div>
                    <div className="mp-flex-center mp-mt-1 mp-gap-1" >
                      <span className="mp-text-2 mp-text-xs mp-py-1 mp-px-1 mp-rounded-sm mp-flow-chip">
                        {a.on.length > 0 ? otDisplayName(a.on[0]) : '未绑定对象'}
                      </span>
                      <span className="mp-shrink-0 mp-icon-12 mp-flow-dot-success" />
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* Right: Detail */}
        <div className="mp-flex mp-flex-1 mp-flex-col" >
          <Card className="mp-hidden mp-mb-5" bodyStyle={{padding: 0}}>
            {/* Header: title + actions */}
            <div className="mp-justify-between mp-flex-center mp-border mp-py-4 mp-px-5" >
              <h3 className="mp-fw-600 mp-text-lg">{selectedAction ? actionDisplayName(selectedAction) : '未选择 Action'}</h3>
              <div className="mp-flex mp-gap-2">
                <Button theme="light" type="secondary" className="mp-text-sm mp-flow-btn-sm"><Copy className="mp-icon-14" />复制</Button>
                <Button theme="light" type="secondary" className="mp-text-sm mp-flow-btn-sm"><Trash2 className="mp-icon-14" />删除</Button>
                <Button theme="solid" type="primary" className="mp-text-sm mp-flow-btn-sm"><Save className="mp-icon-14" />保存</Button>
              </div>
            </div>

            {/* 子 Tab */}
            <div className="mp-gap-1 mp-flex-center mp-border mp-px-4">
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
                    className={`mp-inline-flex mp-items-center mp-clickable mp-gap-1 mp-text-body mp-py-3 mp-px-3 mp-border-none mp-flow-tab${active ? ' mp-flow-tab--active' : ''}`}
                  >
                    {Icon ? <Icon className="mp-icon-14" /> : null}
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 子 Tab 内容 */}
            <div className="mp-p-5">
              {detailTab === 'basic' && (
                <div>
                  <div className="mp-fw-600 mp-mb-3 mp-text-body mp-text-1">基本信息</div>
                  <div className="mp-grid mp-flow-kv-grid">
                    <div className="mp-text-sm mp-text-2 mp-pt-1" >名称</div>
                    <div className="mp-text-body mp-text-1">{selectedAction ? actionDisplayName(selectedAction) : '—'}</div>
                    <div className="mp-text-sm mp-text-2 mp-pt-1" >标识符</div>
                    <div className="mp-text-body mp-text-1"><code className="mp-flow-code mp-text-sm">{selectedAction?.rid ?? '—'}</code></div>
                    <div className="mp-text-sm mp-text-2 mp-pt-1" >Function 引用</div>
                    <div className="mp-text-body mp-text-1"><code className="mp-flow-code mp-text-sm">{selectedAction?.function_ref ?? '—'}</code></div>
                    <div className="mp-text-sm mp-text-2 mp-pt-1" >描述</div>
                    <div className="mp-text-body mp-text-1 mp-lh-16" >{selectedAction?.description || '（未填写描述）'}</div>
                  </div>
                </div>
              )}

              {detailTab === 'io' && (
                <div>
                  <div className="mp-fw-600 mp-mb-3 mp-text-body mp-text-1">输入参数</div>
                  {selectedAction && selectedAction.parameters.length > 0 ? (
                  <table className="mp-w-full mp-mb-5 mp-text-sm mp-flow-table">
                    <thead>
                      <tr>
                        <th className="mp-fw-500 mp-text-xs mp-text-2 mp-border mp-py-1 mp-px-2 mp-text-left" >参数名</th>
                        <th className="mp-fw-500 mp-text-xs mp-text-2 mp-border mp-py-1 mp-px-2 mp-text-left" >类型</th>
                        <th className="mp-fw-500 mp-text-xs mp-text-2 mp-border mp-py-1 mp-px-2 mp-text-left" >必填</th>
                        <th className="mp-fw-500 mp-text-xs mp-text-2 mp-border mp-py-1 mp-px-2 mp-text-left" >说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAction.parameters.map((p) => {
                        const name = p.rid.split('.').slice(-2, -1)[0] ?? p.rid;
                        return (
                        <tr key={p.rid}>
                          <td className="mp-border mp-py-1 mp-px-2 mp-mono" >{name}</td>
                          <td className="mp-text-2 mp-border mp-py-1 mp-px-2 mp-mono" >{p.type_id}</td>
                          <td className="mp-border mp-py-1 mp-px-2" >{p.nullable ? '否' : '是'}</td>
                          <td className="mp-text-2 mp-border mp-py-1 mp-px-2" >{p.title || '—'}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  ) : (
                    <div className="mp-text-sm mp-text-2 mp-py-3 mp-pb-5">该 Action 无输入参数</div>
                  )}

                  <div className="mp-fw-600 mp-mb-3 mp-text-body mp-text-1">副作用与提交规则</div>
                  <div className="mp-text-sm mp-text-2 mp-rounded mp-py-3 mp-px-4 mp-mono mp-bg-fill-0 mp-flow-lh-18">
                    <div>side_effects: {selectedAction && selectedAction.side_effects.length > 0 ? selectedAction.side_effects.join(', ') : '[]'}</div>
                    <div>submission_criteria: {selectedAction && selectedAction.submission_criteria.length > 0 ? selectedAction.submission_criteria.join('; ') : '[]'}</div>
                    <div>apply: POST /ont/v2/action-types/&#123;rid&#125;/apply</div>
                  </div>
                </div>
              )}

              {detailTab === 'relations' && (
                <div>
                  <div className="mp-mb-5">
                    <div className="mp-fw-600 mp-mb-3 mp-text-body mp-text-1">关联本体概念（作用对象）</div>
                    <div className="mp-flex mp-wrap mp-gap-1" >
                      {selectedAction && selectedAction.on.length > 0 ? selectedAction.on.map((rid) => (
                        <span key={rid} title={rid} className="mp-text-sm mp-text-1 mp-clickable mp-border mp-py-1 mp-px-2 mp-bg-fill-0 mp-rounded-sm" >{otDisplayName(rid)}</span>
                      )) : (
                        <span className="mp-text-sm mp-text-2">该 Action 未绑定作用对象</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mp-fw-600 mp-mb-3 mp-text-body mp-text-1">Function 实现引用</div>
                    <div className="mp-flex mp-gap-2 mp-wrap" >
                      <span className="mp-inline-flex mp-items-center mp-text-sm mp-text-1 mp-border mp-rounded mp-gap-1 mp-py-1 mp-px-3 mp-bg-fill-0" >
                        <GitBranch className="mp-icon-14 mp-text-2" />{selectedAction?.function_ref ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'flow' && (
                <div>
                  <div className="mp-justify-between mp-mb-3 mp-flex-center">
                    <div>
                      <div className="mp-fw-600 mp-text-body mp-text-1">流程编排</div>
                      <div className="mp-mt-1 mp-text-sm mp-text-2">当前 Action 包含 <span className="mp-text-1 mp-mono" >7</span> 个节点 / <span className="mp-text-1 mp-mono" >7</span> 条连线</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFlowFullscreen(true)}
                      data-testid="enter-fullscreen-editor"
                      className="mp-inline-flex mp-items-center mp-fw-500 mp-clickable mp-rounded mp-gap-1 mp-text-sm mp-border-none mp-flow-btn-primary"
                    >
                      <Maximize2 className="mp-icon-14" />进入全屏编辑
                    </button>
                  </div>
                  <div className="mp-hidden mp-relative mp-border mp-rounded mp-flow-preview">
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
                      <EditorRenderer className="mp-w-full mp-h-full" />
                    </FreeLayoutEditorProvider>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Execution history */}
          <Card>
            <div className="mp-justify-between mp-mb-4 mp-flex-center">
              <h3 className="mp-fw-600 mp-text-md">执行历史</h3>
            </div>
            <div className="mp-text-center mp-p-8 mp-text-body mp-text-2">
              暂无执行记录
              <div className="mp-text-sm mp-mt-1" >
                kernel 尚未提供执行历史查询；在概念详情或 SuperAI 编排中触发 ActionType.apply 后可在此回看
              </div>
            </div>
          </Card>
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
          key={selectedActionRid || 'demo'}
          onClose={() => setFlowFullscreen(false)}
          initialData={initialData}
          nodeRegistries={nodeRegistries}
          CustomBaseNode={CustomBaseNode}
          initialConfig={flowConfig}
          onSave={saveFlow}
          saving={savingFlow}
        />
      )}
      </div>
    </div>
  );
}
