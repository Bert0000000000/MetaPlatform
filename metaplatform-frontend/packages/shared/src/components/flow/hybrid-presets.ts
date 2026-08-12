/**
 * 混合流程 presets（2026-08-12）
 * --------------------------------------------------
 * 区别于 FlowDesigner 的三个独立 mode（bpmn / agent / business），
 * 混合流程在**同一个画布**上编排「业务活动 + Agent 协作 + 审批 + HITL」，
 * 对应"一个画布 + 按节点类型分流执行"的架构：
 *
 *   - 业务活动节点（business_* / bpmnServiceTask）→ 业务执行
 *   - Agent 协作节点（agent_llm / agent_tool / agent_knowledge / agent_if）
 *   - 审批节点（bpmnUserTask）→ 模拟 Flowable 审批
 *   - 人工确认节点（hitl_confirm）→ 模拟自建 HITL proposal/token 确认
 *
 * 初始数据是业务模型 { nodes, edges }，由 flowDataToFlowgram 转为 FlowGram JSON。
 */
import type { FlowData } from './flow-types';

// ============================================================
// 混合场景：供应商准入审核
// 流程：开始 → 供应商注册事件 → AI 风险分析 → 查征信(MCP) →
//       是否高风险(条件分支) → 高风险: 经理审批(Flowable) /
//       低风险: 直接 → 人工确认准入(HITL) → 写入供应商库 → 结束
// ============================================================
export const HYBRID_SUPPLIER_PRESET: FlowData = {
  nodes: [
    {
      id: 'hy_start',
      type: 'bpmnStart',
      name: '开始事件',
      x: 40,
      y: 200,
      width: 150,
      height: 70,
      data: { title: '开始事件', content: '供应商准入流程入口' },
    },
    {
      id: 'hy_trigger',
      type: 'business_trigger',
      name: '供应商注册事件',
      x: 230,
      y: 200,
      width: 150,
      height: 70,
      data: { title: '供应商注册事件', content: 'event:supplier.registered', cron: 'event:supplier.registered' },
    },
    {
      id: 'hy_llm',
      type: 'agent_llm',
      name: 'AI 风险分析',
      x: 420,
      y: 200,
      width: 280,
      height: 90,
      data: {
        title: 'AI 风险分析',
        content: '分析供应商资质与历史风险',
        inputs: {
          type: 'object',
          required: ['modelId', 'temperature'],
          properties: {
            modelId: { type: 'string', default: 'doubao-pro-32k' },
            temperature: { type: 'number', default: 0.3 },
            maxTokens: { type: 'number', default: 1024 },
            systemPrompt: { type: 'string', extra: { formComponent: 'prompt-editor' } },
          },
        },
        inputsValues: {
          modelId: { type: 'constant', content: 'doubao-pro-32k' },
          temperature: { type: 'constant', content: 0.3 },
          maxTokens: { type: 'constant', content: 1024 },
          systemPrompt: { type: 'template', content: '# Role\n你是供应链风险分析助手，输出风险评级与依据。' },
        },
        outputs: { type: 'object', properties: { result: { type: 'string' } } },
      },
    },
    {
      id: 'hy_tool',
      type: 'agent_tool',
      name: '查企业征信 (MCP)',
      x: 610,
      y: 200,
      width: 220,
      height: 80,
      data: {
        title: '查企业征信 (MCP)',
        content: '调用征信服务校验法人 / 股权 / 涉诉',
        inputs: {
          type: 'object',
          required: ['protocol', 'endpoint'],
          properties: {
            protocol: { type: 'string', default: 'MCP' },
            endpoint: { type: 'string', default: 'mcp://credit-check' },
            timeout: { type: 'number', default: 5000 },
          },
        },
        inputsValues: {
          protocol: { type: 'constant', content: 'MCP' },
          endpoint: { type: 'constant', content: 'mcp://credit-check' },
          timeout: { type: 'constant', content: 5000 },
        },
        outputs: { type: 'object', properties: { result: { type: 'object' } } },
      },
    },
    {
      id: 'hy_if',
      type: 'agent_if',
      name: '是否高风险',
      x: 800,
      y: 200,
      width: 150,
      height: 70,
      data: { title: '是否高风险', content: '征信异常 或 涉诉记录', condition: 'riskLevel == "high"' },
    },
    {
      id: 'hy_approve',
      type: 'bpmnUserTask',
      name: '经理审批',
      x: 990,
      y: 80,
      width: 150,
      height: 70,
      data: { title: '经理审批', content: '模拟 Flowable 审批', assignee: '采购经理', decision: 'pending' },
    },
    {
      id: 'hy_hitl',
      type: 'hitl_confirm',
      name: '人工确认准入',
      x: 990,
      y: 360,
      width: 170,
      height: 80,
      data: {
        title: '人工确认准入',
        content: 'HITL：确认 AI 提案后落库',
        proposal: '将创建供应商记录（名称 / 评级 / 征信快照）并写入供应商库，请人工确认',
        assignee: '',
      },
    },
    {
      id: 'hy_out',
      type: 'agent_output',
      name: '写入供应商库',
      x: 1210,
      y: 260,
      width: 150,
      height: 70,
      data: { title: '写入供应商库', content: '持久化到本体 (TECH-ONT)', target: 'TECH-ONT' },
    },
    {
      id: 'hy_end',
      type: 'bpmnEnd',
      name: '结束事件',
      x: 1400,
      y: 260,
      width: 150,
      height: 70,
      data: { title: '结束事件', content: '流程完成' },
    },
  ],
  edges: [
    { id: 'e_start_trigger', source: 'hy_start', target: 'hy_trigger' },
    { id: 'e_trigger_llm', source: 'hy_trigger', target: 'hy_llm' },
    { id: 'e_llm_tool', source: 'hy_llm', target: 'hy_tool' },
    { id: 'e_tool_if', source: 'hy_tool', target: 'hy_if' },
    { id: 'e_if_high', source: 'hy_if', target: 'hy_approve', label: '高风险' },
    { id: 'e_if_low', source: 'hy_if', target: 'hy_hitl', label: '低风险' },
    { id: 'e_approve_hitl', source: 'hy_approve', target: 'hy_hitl', label: '通过' },
    { id: 'e_hitl_out', source: 'hy_hitl', target: 'hy_out' },
    { id: 'e_out_end', source: 'hy_out', target: 'hy_end' },
  ],
};

export const HYBRID_PRESETS: Record<string, FlowData> = {
  supplier: HYBRID_SUPPLIER_PRESET,
};

// ============================================================
// 混合场景 · 并行版：供应商准入审核（并行分支）
// 流程：开始 → 供应商注册事件 → AI 风险分析 →
//       条件节点（并行 3 分支：查合规库 / 查征信 MCP / 通知财务）→
//       汇聚写入供应商库 → 结束
// 并行由 FlowGram 复合节点 condition 的 blocks 表达（每个 block 一条分支）。
// ============================================================
export const HYBRID_PARALLEL_PRESET: FlowData = {
  nodes: [
    {
      id: 'hp_start',
      type: 'bpmnStart',
      name: '开始事件',
      x: 40,
      y: 260,
      width: 150,
      height: 70,
      data: { title: '开始事件', content: '供应商准入流程入口' },
    },
    {
      id: 'hp_trigger',
      type: 'business_trigger',
      name: '供应商注册事件',
      x: 230,
      y: 260,
      width: 150,
      height: 70,
      data: { title: '供应商注册事件', content: 'event:supplier.registered', cron: 'event:supplier.registered' },
    },
    {
      id: 'hp_llm',
      type: 'agent_llm',
      name: 'AI 风险分析',
      x: 420,
      y: 260,
      width: 280,
      height: 90,
      data: {
        title: 'AI 风险分析',
        content: '初评供应商风险画像',
        inputs: {
          type: 'object',
          required: ['modelId', 'temperature'],
          properties: {
            modelId: { type: 'string', default: 'doubao-pro-32k' },
            temperature: { type: 'number', default: 0.3 },
            maxTokens: { type: 'number', default: 1024 },
          },
        },
        inputsValues: {
          modelId: { type: 'constant', content: 'doubao-pro-32k' },
          temperature: { type: 'constant', content: 0.3 },
          maxTokens: { type: 'constant', content: 1024 },
        },
        outputs: { type: 'object', properties: { result: { type: 'string' } } },
      },
    },
    {
      id: 'hp_condition',
      type: 'condition',
      name: '并行核验',
      x: 640,
      y: 200,
      width: 320,
      height: 220,
      data: { title: '并行核验', content: '三路并行：合规 / 征信 / 财务' },
      blocks: [
        {
          id: 'hp_branchA',
          type: 'block',
          name: '合规检查',
          x: 0,
          y: 0,
          data: { title: '合规检查' },
          blocks: [
            {
              id: 'hp_legal',
              type: 'agent_knowledge',
              name: '查合规库',
              x: 0,
              y: 0,
              width: 200,
              height: 80,
              data: {
                title: '查合规库',
                content: '检索供应商合规记录',
                inputs: {
                  type: 'object',
                  properties: {
                    source: { type: 'string', default: 'compliance-kb' },
                    topK: { type: 'number', default: 5 },
                  },
                },
                inputsValues: {
                  source: { type: 'constant', content: 'compliance-kb' },
                  topK: { type: 'constant', content: 5 },
                },
                outputs: { type: 'object', properties: { docs: { type: 'array' } } },
              },
            },
          ],
        },
        {
          id: 'hp_branchB',
          type: 'block',
          name: '征信核验',
          x: 0,
          y: 0,
          data: { title: '征信核验' },
          blocks: [
            {
              id: 'hp_credit',
              type: 'agent_tool',
              name: '查企业征信 (MCP)',
              x: 0,
              y: 0,
              width: 220,
              height: 80,
              data: {
                title: '查企业征信 (MCP)',
                content: '调用征信服务核验法人 / 股权',
                inputs: {
                  type: 'object',
                  required: ['endpoint'],
                  properties: {
                    protocol: { type: 'string', default: 'MCP' },
                    endpoint: { type: 'string', default: 'mcp://credit-check' },
                  },
                },
                inputsValues: {
                  protocol: { type: 'constant', content: 'MCP' },
                  endpoint: { type: 'constant', content: 'mcp://credit-check' },
                },
                outputs: { type: 'object', properties: { result: { type: 'object' } } },
              },
            },
          ],
        },
        {
          id: 'hp_branchC',
          type: 'block',
          name: '财务通知',
          x: 0,
          y: 0,
          data: { title: '财务通知' },
          blocks: [
            {
              id: 'hp_fin',
              type: 'business_notify',
              name: '通知财务',
              x: 0,
              y: 0,
              width: 150,
              height: 70,
              data: { title: '通知财务', content: '同步供应商注册给财务', channel: 'IM' },
            },
          ],
        },
      ],
    },
    {
      id: 'hp_out',
      type: 'agent_output',
      name: '汇聚写入供应商库',
      x: 1080,
      y: 260,
      width: 160,
      height: 70,
      data: { title: '汇聚写入供应商库', content: '汇总并行结果持久化到本体 (TECH-ONT)', target: 'TECH-ONT' },
    },
    {
      id: 'hp_end',
      type: 'bpmnEnd',
      name: '结束事件',
      x: 1290,
      y: 260,
      width: 150,
      height: 70,
      data: { title: '结束事件', content: '流程完成' },
    },
  ],
  edges: [
    { id: 'hp_e1', source: 'hp_start', target: 'hp_trigger' },
    { id: 'hp_e2', source: 'hp_trigger', target: 'hp_llm' },
    { id: 'hp_e3', source: 'hp_llm', target: 'hp_condition' },
    // 三条并行分支末端 → 汇聚节点
    { id: 'hp_e4', source: 'hp_legal', target: 'hp_out', label: '合规' },
    { id: 'hp_e5', source: 'hp_credit', target: 'hp_out', label: '征信' },
    { id: 'hp_e6', source: 'hp_fin', target: 'hp_out', label: '财务' },
    { id: 'hp_e7', source: 'hp_out', target: 'hp_end' },
  ],
};
