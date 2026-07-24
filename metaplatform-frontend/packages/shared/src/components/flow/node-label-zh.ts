/**
 * Mate: 节点 type → 中文 label 字典
 *
 * 给 NodeAddPanel 渲染侧栏时把 bpmnStart 这种英文 key 翻译为
 * '开始事件' 这种业务中文，让侧栏与画布节点标题风格统一。
 */
export const NODE_TYPE_LABEL_ZH: Record<string, string> = {
  start: '开始',
  end: '结束',
  condition: '条件分支',
  branch: '分支',
  custom: '自定义节点',
  break: '分支断开',
  loop: '循环',
  multiInputs: '多输入汇聚',
  multiOutputs: '多输出分支',
  tryCatch: 'Try / Catch',
  slot: '插槽',

  // BPMN
  bpmnStart: '开始事件',
  bpmnEnd: '结束事件',
  bpmnUserTask: '用户任务',
  bpmnServiceTask: '服务任务',
  bpmnGatewayExclusive: '排他网关',
  bpmnGatewayParallel: '并行网关',
  bpmnGatewayInclusive: '包容网关',

  // Agent
  agent_input: 'AI 输入',
  agent_output: 'AI 输出',
  agent_llm: '大模型推理',
  agent_tool: 'MCP 工具',
  agent_knowledge: '知识检索',
  agent_if: '条件分支',
  agent_loop: '循环',

  // Business
  business_trigger: '触发器',
  business_notify: '通知抄送',
  business_delay: '定时器',

  // Fallback / internal
  block: '分支',
};

/**
 * 取注册节点的中文标签，缺失则回退 type key。
 */
export function getNodeTypeLabel(type: string | number): string {
  const key = String(type);
  return NODE_TYPE_LABEL_ZH[key] ?? key;
}
