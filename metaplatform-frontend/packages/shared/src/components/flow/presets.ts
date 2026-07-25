/**
 * FlowDesigner 三场景初始数据（presets）
 * --------------------------------------------------
 * 三种 mode 对应 Mate Platform v1.2 三大流程编排场景：
 *
 *   - 'bpmn'      → 审批流程编排（TECH-WFE 状态机后端）
 *   - 'agent'     → AI 协作流程编排（TECH-AGENT SAA Graph Core 后端）
 *   - 'business'  → 业务流程编排（TECH-ACTION + TECH-ONT 协同）
 *
 * 初始数据是业务模型 { nodes, edges }，由 flow/utils/adapter 转为 FlowGram JSON。
 * 实际接入时三个 mode 都可以用 ALL_NODE_REGISTRIES（全 17 节点），
 * 也可分别传 BPMN_NODE_REGISTRIES / AGENT_NODE_REGISTRIES / BUSINESS_FLOW_REGISTRIES 做限定。
 *
 * 创建于 2026-07-24，R1 UI 优化阶段。
 */
import type { FlowData } from './flow-types';
import { LEAVE_FLOW_INITIAL_DATA } from './bpmn-initial-data';

// ============================================================
// 场景 1：审批流程编排（BPMN）—— 已存在 LEAVE_FLOW_INITIAL_DATA
// ============================================================
// 这里重新导出便于 FlowDesigner 内部统一从 presets 取数据
// 注意：必须先 import 建立本地绑定，再 export；不能直接用
// `export { X as Y } from ...`，否则本地作用域没有 Y，后续引用会 ReferenceError
export const BPMN_LEAVE_PRESET = LEAVE_FLOW_INITIAL_DATA;

// ============================================================
// 场景 2：AI 协作流程编排（Agent ReAct / Plan-and-Resolve）
// 模板：知识问答 Agent（输入 → LLM → RAG → 工具 → 输出）
// ============================================================
export const AGENT_REACT_PRESET: FlowData = {
  nodes: [
    {
      id: 'agent_in_1',
      type: 'agent_input',
      name: '用户输入',
      x: 60,
      y: 60,
      width: 150,
      height: 70,
      data: { title: '用户输入', content: '接收用户问题', source: 'HTTP / 消息' },
    },
    {
      id: 'agent_llm_1',
      type: 'agent_llm',
      name: 'LLM 推理',
      x: 250,
      y: 60,
      width: 150,
      height: 70,
      data: {
        title: 'LLM 推理',
        content: 'ReAct 主循环',
        modelId: 'doubao-pro-32k',
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
    {
      id: 'agent_rag_1',
      type: 'agent_knowledge',
      name: '知识检索',
      x: 440,
      y: 0,
      width: 150,
      height: 70,
      data: { title: 'RAG 检索', content: '查询企业知识库', topK: 5 },
    },
    {
      id: 'agent_tool_1',
      type: 'agent_tool',
      name: 'MCP 工具',
      x: 440,
      y: 130,
      width: 150,
      height: 70,
      data: { title: 'MCP 工具调用', content: 'Function Calling', protocol: 'MCP' },
    },
    {
      id: 'agent_if_1',
      type: 'agent_if',
      name: '是否需要行动',
      x: 630,
      y: 60,
      width: 150,
      height: 70,
      data: { title: 'Agent 条件分支', content: '需要工具?' },
    },
    {
      id: 'agent_out_1',
      type: 'agent_output',
      name: '回复用户',
      x: 820,
      y: 60,
      width: 150,
      height: 70,
      data: { title: '输出', content: '返回结果', target: 'HTTP' },
    },
  ],
  edges: [
    { id: 'e_in_llm', source: 'agent_in_1', target: 'agent_llm_1' },
    { id: 'e_llm_rag', source: 'agent_llm_1', target: 'agent_rag_1', label: 'RAG' },
    { id: 'e_llm_tool', source: 'agent_llm_1', target: 'agent_tool_1', label: '工具' },
    { id: 'e_rag_if', source: 'agent_rag_1', target: 'agent_if_1' },
    { id: 'e_tool_if', source: 'agent_tool_1', target: 'agent_if_1' },
    { id: 'e_if_out', source: 'agent_if_1', target: 'agent_out_1', label: '完成' },
  ],
};

// ============================================================
// 场景 3：业务流程编排（Business）
// 模板：订单售后（触发 → 数据查询 → 通知 → 延时 → 写入）
// ============================================================
export const BUSINESS_ORDER_AFTERSALE_PRESET: FlowData = {
  nodes: [
    {
      id: 'biz_trigger_1',
      type: 'business_trigger',
      name: '订单完成触发',
      x: 60,
      y: 60,
      width: 150,
      height: 70,
      data: { title: '触发器', content: '订单状态 → 已完成', cron: 'event:order.completed' },
    },
    {
      id: 'biz_query_1',
      type: 'agent_knowledge',
      name: '查询订单详情',
      x: 250,
      y: 60,
      width: 150,
      height: 70,
      data: { title: '数据查询', content: 'ON T 业务对象-订单', source: 'TECH-ONT' },
    },
    {
      id: 'biz_notify_1',
      type: 'business_notify',
      name: '通知客户',
      x: 440,
      y: 0,
      width: 150,
      height: 70,
      data: { title: '通知', content: '发送 IM / 短信', channel: 'IM' },
    },
    {
      id: 'biz_delay_1',
      type: 'business_delay',
      name: '等待客户确认',
      x: 440,
      y: 130,
      width: 150,
      height: 70,
      data: { title: '定时器', content: '24h 内未申诉则结案', waitMs: 86400000 },
    },
    {
      id: 'biz_out_1',
      type: 'agent_output',
      name: '写入售后单',
      x: 630,
      y: 130,
      width: 150,
      height: 70,
      data: { title: '数据写入', content: '持久化到本体', target: 'TECH-ONT' },
    },
  ],
  edges: [
    { id: 'e_t_q', source: 'biz_trigger_1', target: 'biz_query_1' },
    { id: 'e_q_n', source: 'biz_query_1', target: 'biz_notify_1', label: '通知' },
    { id: 'e_q_d', source: 'biz_query_1', target: 'biz_delay_1', label: '等' },
    { id: 'e_d_w', source: 'biz_delay_1', target: 'biz_out_1' },
  ],
};

// ============================================================
// 按 mode 取初始数据
// ============================================================
export type FlowMode = 'bpmn' | 'agent' | 'business';

export const FLOW_MODE_PRESETS: Record<FlowMode, FlowData> = {
  bpmn: BPMN_LEAVE_PRESET,
  agent: AGENT_REACT_PRESET,
  business: BUSINESS_ORDER_AFTERSALE_PRESET,
};

export const FLOW_MODE_META: Record<
  FlowMode,
  { label: string; description: string; accent: 'bpmn' | 'ai' | 'business' }
> = {
  bpmn: {
    label: '审批流程',
    description: 'BPMN 固定布局 · 对接 TECH-WFE 状态机',
    accent: 'bpmn',
  },
  agent: {
    label: 'AI 协作流程',
    description: 'Agent ReAct / Plan-and-Resolve · 对接 TECH-AGENT (SAA Graph Core)',
    accent: 'ai',
  },
  business: {
    label: '业务流程',
    description: '业务动作编排 · 对接 TECH-ACTION + TECH-ONT',
    accent: 'business',
  },
};
