/**
 * Mate: 自定义 nodeRegistries（BPMN + Agent + 业务）
 *
 * 每个注册项提供一个 `onAdd()` 返回 FlowNodeJSON；
 * 业务侧可与官方 demo 的 custom / condition / break / loop 等混合使用。
 */
import { nanoid } from 'nanoid';
import { type FlowNodeRegistry } from '@flowgram.ai/fixed-layout-editor';

// ---------------- BPMN ---------------- //

const BPMN_START: FlowNodeRegistry = {
  type: 'bpmnStart',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnStart_${nanoid(5)}`,
    type: 'bpmnStart',
    data: {
      title: '开始事件',
      content: '审批流程入口',
    },
  }),
};

const BPMN_END: FlowNodeRegistry = {
  type: 'bpmnEnd',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnEnd_${nanoid(5)}`,
    type: 'bpmnEnd',
    data: {
      title: '结束事件',
      content: '审批流程出口',
    },
  }),
};

const BPMN_USER_TASK: FlowNodeRegistry = {
  type: 'bpmnUserTask',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnUserTask_${nanoid(5)}`,
    type: 'bpmnUserTask',
    data: { title: '用户任务', content: '审批人 / 处理人待办' },
  }),
};

const BPMN_SERVICE_TASK: FlowNodeRegistry = {
  type: 'bpmnServiceTask',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnServiceTask_${nanoid(5)}`,
    type: 'bpmnServiceTask',
    data: { title: '服务任务', content: '调用后端 API / 脚本' },
  }),
};

const BPMN_GATEWAY_EXCLUSIVE: FlowNodeRegistry = {
  type: 'bpmnGatewayExclusive',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnGatewayExclusive_${nanoid(5)}`,
    type: 'bpmnGatewayExclusive',
    data: { title: '排他网关', content: 'XOR - 单分支路由' },
  }),
};

const BPMN_GATEWAY_PARALLEL: FlowNodeRegistry = {
  type: 'bpmnGatewayParallel',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnGatewayParallel_${nanoid(5)}`,
    type: 'bpmnGatewayParallel',
    data: { title: '并行网关', content: 'AND - 多路分支' },
  }),
};

const BPMN_GATEWAY_INCLUSIVE: FlowNodeRegistry = {
  type: 'bpmnGatewayInclusive',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `bpmnGatewayInclusive_${nanoid(5)}`,
    type: 'bpmnGatewayInclusive',
    data: { title: '包容网关', content: 'OR - 多分支合并' },
  }),
};

export const BPMN_NODE_REGISTRIES: FlowNodeRegistry[] = [
  BPMN_START,
  BPMN_END,
  BPMN_USER_TASK,
  BPMN_SERVICE_TASK,
  BPMN_GATEWAY_EXCLUSIVE,
  BPMN_GATEWAY_PARALLEL,
  BPMN_GATEWAY_INCLUSIVE,
];

// ---------------- Agent (AI) ---------------- //

const AGENT_INPUT: FlowNodeRegistry = {
  type: 'agent_input',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_input_${nanoid(5)}`,
    type: 'agent_input',
    data: { title: '输入', content: '接收 HTTP / 消息 / 文件' },
  }),
};

const AGENT_OUTPUT: FlowNodeRegistry = {
  type: 'agent_output',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_output_${nanoid(5)}`,
    type: 'agent_output',
    data: { title: '输出', content: '写入数据库 / 知识图谱' },
  }),
};

const AGENT_LLM: FlowNodeRegistry = {
  type: 'agent_llm',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_llm_${nanoid(5)}`,
    type: 'agent_llm',
    data: { title: 'LLM', content: '大模型推理 - 实体抽取、关系推理、文本生成' },
  }),
};

const AGENT_TOOL: FlowNodeRegistry = {
  type: 'agent_tool',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_tool_${nanoid(5)}`,
    type: 'agent_tool',
    data: { title: 'MCP 工具', content: '调用 MCP / 外部 API / 函数' },
  }),
};

const AGENT_KNOWLEDGE: FlowNodeRegistry = {
  type: 'agent_knowledge',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_knowledge_${nanoid(5)}`,
    type: 'agent_knowledge',
    data: { title: '知识检索', content: '向量库 / 知识图谱 RAG 召回' },
  }),
};

const AGENT_IF: FlowNodeRegistry = {
  type: 'agent_if',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_if_${nanoid(5)}`,
    type: 'agent_if',
    data: { title: '条件分支', content: '检查必填字段是否齐全' },
  }),
};

const AGENT_LOOP: FlowNodeRegistry = {
  type: 'agent_loop',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `agent_loop_${nanoid(5)}`,
    type: 'agent_loop',
    data: { title: '循环', content: '迭代替全缺失数据' },
  }),
};

export const AGENT_NODE_REGISTRIES: FlowNodeRegistry[] = [
  AGENT_INPUT,
  AGENT_OUTPUT,
  AGENT_LLM,
  AGENT_TOOL,
  AGENT_KNOWLEDGE,
  AGENT_IF,
  AGENT_LOOP,
];

// ---------------- 人工确认 (HITL) ---------------- //

const HITL_CONFIRM: FlowNodeRegistry = {
  type: 'hitl_confirm',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `hitl_confirm_${nanoid(5)}`,
    type: 'hitl_confirm',
    data: {
      title: '人工确认 (HITL)',
      content: 'AI 动作落库前的人工确认（proposal + token）',
      proposal: 'AI 将执行以下变更，请人工确认：\n- 变更对象\n- 影响范围',
      assignee: '',
    },
  }),
};

export const HITL_NODE_REGISTRIES: FlowNodeRegistry[] = [HITL_CONFIRM];

// ---------------- FlowGram 官方复合节点（并行 / 条件 / 循环 / 异常） ----------------
// 官方 fixed-layout 的复合节点：容器内部通过 `blocks` 嵌套分支块，
// 每个分支块可独立连线 → 实现并行 / 条件分叉。extend 决定布局形态。
// 参考官方文档 docs/guide/fixed-layout/composite-nodes.mdx。

const COMPOSITE_CONDITION: FlowNodeRegistry = {
  type: 'condition',
  extend: 'dynamicSplit',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `condition_${nanoid(5)}`,
    type: 'condition',
    data: { title: '条件 / 并行分支', content: '一个入口分多条并行分支' },
    blocks: [
      { id: nanoid(5), type: 'block', data: { title: '分支 A' } },
      { id: nanoid(5), type: 'block', data: { title: '分支 B' } },
    ],
  }),
};

const COMPOSITE_MULTI_OUTPUTS: FlowNodeRegistry = {
  type: 'multiOutputs',
  extend: 'dynamicSplit',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `multiOutputs_${nanoid(5)}`,
    type: 'multiOutputs',
    data: { title: '多输出', content: '一个输入分多条输出' },
    blocks: [
      { id: nanoid(5), type: 'output', data: { title: '输出 1' } },
      { id: nanoid(5), type: 'output', data: { title: '输出 2' } },
    ],
  }),
};

const COMPOSITE_MULTI_INPUTS: FlowNodeRegistry = {
  type: 'multiInputs',
  extend: 'dynamicSplit',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `multiInputs_${nanoid(5)}`,
    type: 'multiInputs',
    data: { title: '多输入', content: '多条输入汇聚为一个输出' },
    blocks: [
      { id: nanoid(5), type: 'input', data: { title: '输入 1' } },
      { id: nanoid(5), type: 'input', data: { title: '输入 2' } },
    ],
  }),
};

const COMPOSITE_LOOP: FlowNodeRegistry = {
  type: 'loop',
  extend: 'loop',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `loop_${nanoid(5)}`,
    type: 'loop',
    data: { title: '循环', content: '循环执行内部节点' },
    blocks: [{ id: nanoid(5), type: 'block', data: { title: '循环体' } }],
  }),
};

const COMPOSITE_TRY_CATCH: FlowNodeRegistry = {
  type: 'tryCatch',
  extend: 'tryCatch',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `tryCatch_${nanoid(5)}`,
    type: 'tryCatch',
    data: { title: 'Try / Catch', content: '异常处理分支' },
    blocks: [{ id: nanoid(5), type: 'block', data: { title: 'Try 分支' } }],
  }),
};

export const FLOWGRAM_COMPOSITE_REGISTRIES: FlowNodeRegistry[] = [
  COMPOSITE_CONDITION,
  COMPOSITE_MULTI_OUTPUTS,
  COMPOSITE_MULTI_INPUTS,
  COMPOSITE_LOOP,
  COMPOSITE_TRY_CATCH,
];

// ---------------- 业务流程 ---------------- //

const BUSINESS_TRIGGER: FlowNodeRegistry = {
  type: 'business_trigger',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `business_trigger_${nanoid(5)}`,
    type: 'business_trigger',
    data: { title: '触发器', content: '定时 / 事件驱动启动流程' },
  }),
};

const BUSINESS_NOTIFY: FlowNodeRegistry = {
  type: 'business_notify',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `business_notify_${nanoid(5)}`,
    type: 'business_notify',
    data: { title: '通知抄送', content: '通知抄送人（不阻塞流程）' },
  }),
};

const BUSINESS_DELAY: FlowNodeRegistry = {
  type: 'business_delay',
  meta: { defaultExpanded: true },
  onAdd: () => ({
    id: `business_delay_${nanoid(5)}`,
    type: 'business_delay',
    data: { title: '定时器', content: '延时 / 定时触发' },
  }),
};

export const BUSINESS_FLOW_REGISTRIES: FlowNodeRegistry[] = [
  BUSINESS_TRIGGER,
  BUSINESS_NOTIFY,
  BUSINESS_DELAY,
];

// ---------------- 汇总 ---------------- //

export const ALL_NODE_REGISTRIES: FlowNodeRegistry[] = [
  ...BPMN_NODE_REGISTRIES,
  ...AGENT_NODE_REGISTRIES,
  ...HITL_NODE_REGISTRIES,
  ...BUSINESS_FLOW_REGISTRIES,
  ...FLOWGRAM_COMPOSITE_REGISTRIES,
];

export interface PaletteCategory {
  key: string;
  label: string;
  /** 该分组下的 FlowNodeRegistry 类型集合，顺序按顺序展示 */
  types: string[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  { key: 'bpmn', label: '审批流', types: BPMN_NODE_REGISTRIES.map((r) => r.type as unknown as string) },
  { key: 'agent', label: 'AI 协作流', types: AGENT_NODE_REGISTRIES.map((r) => r.type as unknown as string) },
  { key: 'hitl', label: '人工确认 (HITL)', types: HITL_NODE_REGISTRIES.map((r) => r.type as unknown as string) },
  { key: 'business', label: '业务流程', types: BUSINESS_FLOW_REGISTRIES.map((r) => r.type as unknown as string) },
  { key: 'parallel', label: '并行与条件', types: FLOWGRAM_COMPOSITE_REGISTRIES.map((r) => r.type as unknown as string) },
];

/**
 * 按 PALETTE_CATEGORIES 将 ALL_NODE_REGISTRIES 切片为分组列表，方便 NodeAddPanel 直接消费。
 */
export function groupsByCategory(): Array<{
  key: string;
  label: string;
  registries: FlowNodeRegistry[];
}> {
  return PALETTE_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    registries: c.types
      .map((t) => ALL_NODE_REGISTRIES.find((r) => (r.type as unknown as string) === t))
      .filter((r): r is FlowNodeRegistry => Boolean(r)),
  }));
}
