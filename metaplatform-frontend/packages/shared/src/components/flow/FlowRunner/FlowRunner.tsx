/**
 * FlowRunner —— 可执行的混合流程画布
 * --------------------------------------------------
 * 在 FlowGram fixed-layout 画布之上叠加"执行模拟"能力：
 *  - 顶部控制条：运行 / 暂停 / 继续 / 重置 / 速度
 *  - 左侧节点库（BPMN 审批 / Agent 协作 / HITL / 业务 分组）
 *  - 画布内节点按执行状态高亮（执行中 / 已完成 / 待审批 / 待人工确认 / 已驳回）
 *  - 审批节点暂停 → 弹出 Flowable 审批确认（通过 / 驳回）
 *  - HITL 节点暂停 → 弹出 proposal 人工确认（确认 / 拒绝）
 *  - 右侧执行日志面板
 *
 * 纯前端模拟，不接后端：用于演示"一个画布 + 业务/Agent/审批/HITL 分流执行"的架构形态。
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Modal, Slider, Tag } from '@douyinfe/semi-ui';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  EditorRenderer,
  Field,
  FixedLayoutEditorProvider,
  useNodeRender,
  type FlowDocumentJSON,
  type FlowNodeRegistry,
} from '@flowgram.ai/fixed-layout-editor';

import { buildEditorPropsWith } from '../flowgram-demo/hooks/use-editor-props';
import { NodeAddPanel } from '../flowgram-demo/components/node-add-panel';
import { Minimap } from '../flowgram-demo/components/minimap';
import { FlowgramErrorBoundary } from '../flowgram-demo/flowgram-error-boundary';
import { ensureFlowgramThemeStyle } from '../flowgram-demo/theme-injector';
import { ALL_NODE_REGISTRIES } from '../node-registries';
import { flowDataToFlowgram, type FlowGramDocumentJSON } from '../flow-adapter';
import { HYBRID_SUPPLIER_PRESET } from '../hybrid-presets';
import { useFlowRunner } from './use-flow-runner';
import {
  EXEC_STATE_COLOR,
  EXEC_STATE_TEXT,
  LOG_EVENT_TEXT,
  RUNNER_STATUS_TEXT,
  type RunnerContextValue,
} from './flow-runner-types';

import '@flowgram.ai/fixed-layout-editor/index.css';
import '../flowgram-demo/index.css';

// ============================================================
// Context
// ============================================================
const RunnerContext = createContext<RunnerContextValue | null>(null);

function useRunnerContext(): RunnerContextValue {
  const ctx = useContext(RunnerContext);
  if (!ctx) throw new Error('useRunnerContext 必须在 FlowRunner 内使用');
  return ctx;
}

// ============================================================
// 节点可配置项（schema 驱动表单）
// ============================================================
interface NodeFieldConfig {
  key: string;
  label: string;
  control: 'input' | 'textarea' | 'number' | 'select';
  options?: { label: string; value: string }[];
  placeholder?: string;
}

/** 每类节点的可配置字段。节点点击后内联编辑，值写入节点 data[key]。 */
const NODE_CONFIG_FIELDS: Record<string, NodeFieldConfig[]> = {
  agent_llm: [
    {
      key: 'modelId',
      label: '模型',
      control: 'select',
      options: [
        { label: 'doubao-pro-32k', value: 'doubao-pro-32k' },
        { label: 'gpt-4o', value: 'gpt-4o' },
        { label: 'qwen-max', value: 'qwen-max' },
        { label: 'deepseek-v3', value: 'deepseek-v3' },
      ],
    },
    { key: 'temperature', label: '温度', control: 'number', placeholder: '0 ~ 1' },
    { key: 'maxTokens', label: '最大 Token', control: 'number' },
    { key: 'systemPrompt', label: '系统提示词', control: 'textarea' },
  ],
  agent_tool: [
    {
      key: 'protocol',
      label: '协议',
      control: 'select',
      options: [
        { label: 'MCP', value: 'MCP' },
        { label: 'HTTP', value: 'HTTP' },
        { label: 'Function', value: 'Function' },
      ],
    },
    { key: 'endpoint', label: '端点', control: 'input', placeholder: '工具地址' },
    { key: 'timeout', label: '超时 (ms)', control: 'number' },
  ],
  agent_knowledge: [
    { key: 'source', label: '数据源', control: 'input', placeholder: '向量库 / 知识库名' },
    { key: 'topK', label: '召回数', control: 'number' },
  ],
  agent_if: [
    {
      key: 'branch',
      label: '默认分支',
      control: 'select',
      options: [
        { label: '高风险 high', value: 'high' },
        { label: '低风险 low', value: 'low' },
      ],
    },
    { key: 'condition', label: '条件表达式', control: 'input', placeholder: 'riskLevel == "high"' },
  ],
  bpmnUserTask: [
    { key: 'assignee', label: '审批人', control: 'input', placeholder: '角色 / 用户' },
    { key: 'dueDays', label: '期限 (天)', control: 'number' },
  ],
  hitl_confirm: [
    { key: 'proposal', label: '提案文案', control: 'textarea', placeholder: 'AI 将执行什么变更' },
    { key: 'assignee', label: '确认人', control: 'input' },
  ],
  business_trigger: [{ key: 'cron', label: '触发表达式', control: 'input', placeholder: 'event:* 或 cron' }],
  business_notify: [
    {
      key: 'channel',
      label: '渠道',
      control: 'select',
      options: [
        { label: 'IM', value: 'IM' },
        { label: '邮件', value: '邮件' },
        { label: '短信', value: '短信' },
      ],
    },
  ],
  business_delay: [{ key: 'waitMs', label: '等待 (ms)', control: 'number' }],
};

const CONFIG_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  fontSize: 11,
  marginTop: 2,
  color: '#f3f4f6',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 4,
  padding: '3px 6px',
};

const ConfigFieldRow: React.FC<{ config: NodeFieldConfig }> = ({ config }) => {
  return (
    <div className="demo-fixed-node-content" style={{ padding: '2px 10px' }}>
      <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6 }}>{config.label}</div>
      <Field<any> name={config.key}>
        {({ field }) => {
          const value = field.value;
          if (config.control === 'select') {
            return (
              <select
                value={value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                style={CONFIG_INPUT_STYLE}
              >
                {config.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          }
          if (config.control === 'number') {
            return (
              <input
                type="number"
                value={value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
                placeholder={config.placeholder}
                style={CONFIG_INPUT_STYLE}
              />
            );
          }
          if (config.control === 'textarea') {
            return (
              <textarea
                rows={2}
                value={value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={config.placeholder}
                style={CONFIG_INPUT_STYLE}
              />
            );
          }
          return (
            <input
              value={value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={config.placeholder}
              style={CONFIG_INPUT_STYLE}
            />
          );
        }}
      </Field>
    </div>
  );
};

// ============================================================
// 官方 schema 驱动表单（数据模型对齐 @flowgram.ai/form-materials）
// ------------------------------------------------------------
// 节点 data 采用官方结构：inputs(schema) + inputsValues(值，{type,content}) + outputs。
// 渲染用轻量自研控件。官方 DynamicValueInput 需 flowgram ScopeProvider（变量作用域）
// 上下文，待接入 variable scope 插件后可平滑切换（数据格式已对齐）。
// ============================================================
const SchemaFormInputs: React.FC = () => {
  return (
    <Field<any> name="inputs">
      {({ field: inputsField }) => {
        const schema = inputsField.value as
          | { required?: string[]; properties?: Record<string, any> }
          | undefined;
        const required = schema?.required ?? [];
        const properties = schema?.properties;
        if (!properties) return <></>;
        return (
          <>
            {Object.keys(properties).map((key) => {
              const prop = properties[key] as {
                type?: string;
                default?: unknown;
                extra?: { formComponent?: string };
              };
              const isTextarea =
                prop.type === 'string' && prop.extra?.formComponent === 'prompt-editor';
              return (
                <div key={key} className="demo-fixed-node-content" style={{ padding: '2px 10px' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6 }}>
                    {key}
                    {required.includes(key) ? ' *' : ''}
                  </div>
                  <Field<any> name={`inputsValues.${key}`} defaultValue={prop.default}>
                    {({ field }) => {
                      const val = field.value;
                      const content = val?.content ?? val ?? '';
                      if (prop.type === 'number') {
                        return (
                          <input
                            type="number"
                            value={content === '' || content == null ? '' : Number(content)}
                            onChange={(e) =>
                              field.onChange({
                                type: 'constant',
                                content: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            style={CONFIG_INPUT_STYLE}
                          />
                        );
                      }
                      if (isTextarea) {
                        return (
                          <textarea
                            rows={2}
                            value={content ?? ''}
                            onChange={(e) =>
                              field.onChange({ type: 'template', content: e.target.value })
                            }
                            placeholder="输入提示词，可用 {{变量}} 引用"
                            style={CONFIG_INPUT_STYLE}
                          />
                        );
                      }
                      return (
                        <input
                          value={content ?? ''}
                          onChange={(e) =>
                            field.onChange({ type: 'constant', content: e.target.value })
                          }
                          style={CONFIG_INPUT_STYLE}
                        />
                      );
                    }}
                  </Field>
                </div>
              );
            })}
          </>
        );
      }}
    </Field>
  );
};

/** 使用官方 schema 表单的节点类型 */
const SCHEMA_NODE_TYPES = new Set(['agent_llm', 'agent_tool', 'agent_knowledge']);

// ============================================================
// 节点渲染（表单 + 执行状态高亮）
// ============================================================
const NodeForm: React.FC = () => {
  const nodeRender = useNodeRender();
  const { api } = useRunnerContext();
  const nodeId = nodeRender.node.id;
  const state = api.stateMap[nodeId] ?? 'idle';
  // flowgram 节点类型：node.flowNodeType 才是类型字符串，node.type 是实体对象
  const type = String(nodeRender.node.flowNodeType ?? nodeRender.node.type ?? '');
  const fields = NODE_CONFIG_FIELDS[type] ?? [];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Field<string> name="title">
        {({ field }) => <div className="demo-fixed-node-title">{field.value}</div>}
      </Field>
      <div className="demo-fixed-node-content" style={{ padding: '6px 10px' }}>
        <Field<string> name="content">
          <input />
        </Field>
      </div>

      {/* 官方 schema 表单（inputs + inputsValues）或轻量配置字段 */}
      {SCHEMA_NODE_TYPES.has(type) ? (
        <SchemaFormInputs />
      ) : (
        fields.map((f) => <ConfigFieldRow key={f.key} config={f} />)
      )}

      {state !== 'idle' && (
        <span
          className="fr-state-badge"
          style={{
            position: 'absolute',
            top: 2,
            right: 24,
            fontSize: 10,
            lineHeight: '14px',
            padding: '0 6px',
            borderRadius: 3,
            color: '#fff',
            background: EXEC_STATE_COLOR[state],
            zIndex: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {EXEC_STATE_TEXT[state]}
        </span>
      )}
    </div>
  );
};

// ============================================================
// 控制条
// ============================================================
const ControlBar: React.FC = () => {
  const { api } = useRunnerContext();
  const running = api.status === 'running';
  const paused = api.status === 'paused';
  const idle = api.status === 'idle';
  const tagColor = running ? 'blue' : paused ? 'orange' : api.status === 'finished' ? 'green' : 'grey';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--background)',
        flexWrap: 'wrap',
      }}
    >
      <Tag color={tagColor}>{RUNNER_STATUS_TEXT[api.status]}</Tag>
      <Button size="small" type="primary" icon={<Play size={13} />} onClick={api.run} disabled={running}>
        运行
      </Button>
      <Button size="small" icon={<Pause size={13} />} onClick={api.pause} disabled={!running}>
        暂停
      </Button>
      <Button size="small" icon={<Play size={13} />} onClick={api.resume} disabled={!paused}>
        继续
      </Button>
      <Button size="small" icon={<RotateCcw size={13} />} onClick={api.reset} disabled={idle}>
        重置
      </Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>速度</span>
        <Slider
          min={150}
          max={1500}
          step={50}
          value={api.stepDelay}
          onChange={(v) => api.setStepDelay(Array.isArray(v) ? v[0] : v ?? 150)}
          style={{ width: 120, margin: '0 4px' }}
        />
      </div>
    </div>
  );
};

// ============================================================
// 执行日志面板
// ============================================================
const LogPanel: React.FC = () => {
  const { api } = useRunnerContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [api.logs]);

  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--background)',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--foreground)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        执行日志（{api.logs.length}）
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {api.logs.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: 8 }}>
            点击「运行」开始模拟执行
          </div>
        )}
        {api.logs.map((l) => (
          <div
            key={l.id}
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              borderBottom: '1px dashed var(--border)',
              padding: '4px 6px',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>{l.time}</span>
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{l.nodeTitle || '—'}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--info)' }}>
                {LOG_EVENT_TEXT[l.event] ?? l.event}
              </span>
            </div>
            {l.detail && <div style={{ color: 'var(--muted-foreground)' }}>{l.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// HITL / 审批 弹层
// ============================================================
const Modals: React.FC = () => {
  const { api, waitingHitlId, waitingApprovalId, getNodeData } = useRunnerContext();
  const hitlData = waitingHitlId ? getNodeData(waitingHitlId) : undefined;
  const apprData = waitingApprovalId ? getNodeData(waitingApprovalId) : undefined;

  return (
    <>
      {/* HITL 人工确认 */}
      <Modal
        visible={!!waitingHitlId}
        title="人工确认 (HITL)"
        footer={null}
        maskClosable={false}
        width={480}
        onCancel={() => { if (waitingHitlId) api.resolveHitl(waitingHitlId, false); }}
      >
        {waitingHitlId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              AI 输出为 proposal，需人工确认后由 ActionType.apply 落库
              （模拟自建 HITL proposal / token 校验）。
            </div>
            <div
              style={{
                background: 'var(--muted)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                color: 'var(--foreground)',
              }}
            >
              {String(hitlData?.proposal ?? '（未填写 proposal 文案）')}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="danger" onClick={() => api.resolveHitl(waitingHitlId, false)}>
                拒绝
              </Button>
              <Button theme="solid" type="primary" onClick={() => api.resolveHitl(waitingHitlId, true)}>
                确认
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 审批（Flowable 模拟） */}
      <Modal
        visible={!!waitingApprovalId}
        title="审批 (Flowable 模拟)"
        footer={null}
        maskClosable={false}
        width={480}
        onCancel={() => { if (waitingApprovalId) api.resolveApproval(waitingApprovalId, false); }}
      >
        {waitingApprovalId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              审批节点由 BPMN 引擎（Flowable）承担：任务分配 / 会签 / 驳回 / 历史。
            </div>
            <div
              style={{
                background: 'var(--muted)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: 'var(--foreground)',
              }}
            >
              审批人：{String(apprData?.assignee ?? '—')}　·　节点：{String(apprData?.title ?? '')}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="danger" onClick={() => api.resolveApproval(waitingApprovalId, false)}>
                驳回
              </Button>
              <Button theme="solid" type="primary" onClick={() => api.resolveApproval(waitingApprovalId, true)}>
                通过
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

// ============================================================
// 样式注入（一次性）
// ============================================================
const STYLE_ID = 'flow-runner-style-v1';
const STYLE = `
  .flow-runner-root .demo-fixed-container,
  .flow-runner-root .demo-fixed-layout,
  .flow-runner-root .demo-fixed-editor { width: 100%; height: 100%; min-height: 0; }
  .flow-runner-root .demo-fixed-layout { grid-template-columns: 200px 1fr; }
  .flow-runner-root .gedit-flow-background-layer,
  .flow-runner-root .gedit-grid-svg { position: absolute !important; inset: 0 !important; }
`;
let styleInjected = false;
const StyleInjector: React.FC = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || styleInjected) return;
    if (!document.getElementById(STYLE_ID)) {
      const node = document.createElement('style');
      node.id = STYLE_ID;
      node.textContent = STYLE;
      document.head.appendChild(node);
    }
    styleInjected = true;
  }, []);
  return null;
};

// ============================================================
// FlowRunner
// ============================================================
export interface FlowRunnerProps {
  initialData?: FlowGramDocumentJSON;
  /** 画布高度，默认 640 */
  height?: number | string;
  /** 节点库，默认 ALL_NODE_REGISTRIES（BPMN + Agent + HITL + 业务） */
  nodeRegistries?: FlowNodeRegistry[];
  /** 隐藏左侧节点库 */
  hidePalette?: boolean;
  /** 隐藏顶部控制条 */
  hideToolbar?: boolean;
  /** 隐藏右侧日志面板 */
  hideLog?: boolean;
}

const DEFAULT_DATA = (() =>
  flowDataToFlowgram(HYBRID_SUPPLIER_PRESET) as unknown as FlowGramDocumentJSON)();

/** FlowGram 官方复合节点（并行 / 条件 / 循环 / 异常）——使用官方容器渲染，不注入 NodeForm */
const COMPOSITE_TYPES = new Set([
  'condition',
  'loop',
  'multiOutputs',
  'multiInputs',
  'tryCatch',
  'break',
  'slot',
  'block',
  'output',
  'input',
  'custom',
]);

export const FlowRunner: React.FC<FlowRunnerProps> = (props) => {
  const {
    initialData,
    height = 640,
    nodeRegistries = ALL_NODE_REGISTRIES,
    hidePalette = false,
    hideToolbar = false,
    hideLog = false,
  } = props;

  const docRef = useRef<FlowGramDocumentJSON>(initialData ?? DEFAULT_DATA);
  const runner = useFlowRunner(docRef);

  useEffect(() => {
    ensureFlowgramThemeStyle();
  }, []);

  // 画布 props 固定基于首次 doc，避免 onChange 触发重建导致画布重置
  const editorProps = useMemo(
    () =>
      buildEditorPropsWith({
        initialData: docRef.current as unknown as FlowDocumentJSON,
        nodeRegistries,
        onChange: (json) => {
          const incoming = json as unknown as FlowGramDocumentJSON;
          const prev = docRef.current;
          // flowgram toJSON 输出只有 nodes（含 blocks），无 edges——
          // 这里保留并过滤原始 edges（删除的节点对应边丢弃），保证执行模拟可建图
          const ids = new Set((incoming.nodes ?? []).map((n) => n.id));
          const kept = (prev.edges ?? []).filter(
            (e) => ids.has(e.sourceNodeID) && ids.has(e.targetNodeID)
          );
          docRef.current = {
            nodes: incoming.nodes ?? [],
            edges: incoming.edges && incoming.edges.length > 0 ? incoming.edges : kept,
          };
        },
        // 官方复合节点（condition/loop/multiOutputs 等）回落官方容器渲染，
        // 自定义节点（BPMN/Agent/HITL/业务）使用 NodeForm（表单 + 执行状态高亮）
        defaultFormMeta: (type) =>
          COMPOSITE_TYPES.has(type)
            ? null
            : { formMeta: { render: () => <NodeForm /> } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeRegistries]
  );

  const groups = useMemo(() => {
    const map: Record<string, FlowNodeRegistry[]> = {
      '审批流 (BPMN)': [],
      'AI 协作流 (Agent)': [],
      '人工确认 (HITL)': [],
      业务流程: [],
      并行与条件: [],
    };
    for (const r of nodeRegistries) {
      const t = String(r.type);
      if (COMPOSITE_TYPES.has(t)) map['并行与条件'].push(r);
      else if (t.startsWith('bpmn')) map['审批流 (BPMN)'].push(r);
      else if (t.startsWith('agent')) map['AI 协作流 (Agent)'].push(r);
      else if (t.startsWith('hitl')) map['人工确认 (HITL)'].push(r);
      else map['业务流程'].push(r);
    }
    return Object.entries(map)
      .filter(([, v]) => v.length > 0)
      .map(([label, regs], i) => ({ key: `pg-${i}`, label, registries: regs }));
  }, [nodeRegistries]);

  const waitingHitlId = useMemo(
    () => Object.entries(runner.stateMap).find(([, s]) => s === 'hitl_waiting')?.[0] ?? null,
    [runner.stateMap]
  );
  const waitingApprovalId = useMemo(
    () => Object.entries(runner.stateMap).find(([, s]) => s === 'approval_waiting')?.[0] ?? null,
    [runner.stateMap]
  );
  const getNodeData = useCallback(
    (id: string) => docRef.current.nodes.find((n) => n.id === id)?.data,
    []
  );

  const ctxValue: RunnerContextValue = useMemo(
    () => ({ api: runner, waitingHitlId, waitingApprovalId, getNodeData }),
    [runner, waitingHitlId, waitingApprovalId, getNodeData]
  );

  return (
    <RunnerContext.Provider value={ctxValue}>
      <div
        className="flow-runner-root"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          background: 'var(--card)',
        }}
      >
        {!hideToolbar && <ControlBar />}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <FlowgramErrorBoundary>
              <FixedLayoutEditorProvider {...editorProps}>
                <div className="demo-fixed-container">
                  <div className="demo-fixed-layout">
                    {!hidePalette && <NodeAddPanel categories={groups} />}
                    <EditorRenderer className="demo-fixed-editor" />
                  </div>
                </div>
                <Minimap />
              </FixedLayoutEditorProvider>
            </FlowgramErrorBoundary>
          </div>
          {!hideLog && <LogPanel />}
        </div>
        <Modals />
        <StyleInjector />
      </div>
    </RunnerContext.Provider>
  );
};

export default FlowRunner;
