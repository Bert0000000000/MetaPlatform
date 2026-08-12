/**
 * FlowCanvas 模块统一导出
 *
 * Mate 内部封装 FlowGram.AI 1.0.12 fixed-layout-editor 的统一入口，
 * 复刻官方 demo-fixed-layout-simple / demo-free-layout-simple 风格，
 * 业务侧只需：
 *
 *   import { FlowgramEditor } from '@mate/shared/components/flow';
 *   import { ALL_NODE_REGISTRIES, BPMN_REGISTRIES, AGENT_REGISTRIES } from '@mate/shared/components/flow';
 *
 *   <FlowgramEditor initialData={initialData} nodeRegistries={ALL_NODE_REGISTRIES} />
 *
 *   # 三场景统一编辑器（2026-07-24 R1 UI 优化）
 *   import { FlowDesigner } from '@mate/shared/components/flow';
 *   <FlowDesigner mode="bpmn" storageKey="process-bpmn-2026-q3" />
 */

export { FlowgramEditor, type FlowgramEditorProps } from './flowgram-demo/editor';
export { Tools as DemoTools } from './flowgram-demo/components/tools';
export { Minimap as DemoMinimap } from './flowgram-demo/components/minimap';
export { FlowSelect as DemoFlowSelect, type FlowSelectProps } from './flowgram-demo/components/flow-select';
export { buildEditorProps, buildEditorPropsWith, type BuildEditorPropsOptions } from './flowgram-demo/hooks/use-editor-props';
export { useAddNode } from './flowgram-demo/hooks/use-add-node';
export { ensureFlowgramThemeStyle, removeFlowgramThemeStyle } from './flowgram-demo/theme-injector';
export { getSemiProviderProps, getMateSemiTheme, type SemiThemeMode } from './flowgram-demo/semi-theme';
export { FlowgramErrorBoundary } from './flowgram-demo/flowgram-error-boundary';
export {
  BPMN_NODE_REGISTRIES,
  AGENT_NODE_REGISTRIES,
  HITL_NODE_REGISTRIES,
  ALL_NODE_REGISTRIES,
  BUSINESS_FLOW_REGISTRIES,
  FLOWGRAM_COMPOSITE_REGISTRIES,
} from './node-registries';
export {
  flowDataToFlowgram,
  flowgramToFlowData,
  type FlowGramNodeJSON,
  type FlowGramEdgeJSON,
  type FlowGramDocumentJSON,
} from './flow-adapter';
export { LEAVE_FLOW_INITIAL_DATA } from './bpmn-initial-data';
export type {
  FlowNode,
  FlowEdge,
  FlowData,
  FlowNodeMaterial,
  FlowPaletteCategory,
  FlowNodeFormField,
  FlowFieldType,
  ThemeModeSetting,
  ResolvedThemeMode,
} from './flow-types';

// 三场景统一编辑器（2026-07-24 R1 UI 优化）
export { FlowDesigner, type FlowDesignerProps } from './FlowDesigner';
export {
  BPMN_LEAVE_PRESET,
  AGENT_REACT_PRESET,
  BUSINESS_ORDER_AFTERSALE_PRESET,
  FLOW_MODE_PRESETS,
  FLOW_MODE_META,
  type FlowMode,
} from './presets';

// 混合流程 preset（业务活动 + Agent 协作 + 审批 + HITL）
export { HYBRID_SUPPLIER_PRESET, HYBRID_PARALLEL_PRESET, HYBRID_PRESETS } from './hybrid-presets';

// 可执行混合画布（FlowRunner）
export { FlowRunner, type FlowRunnerProps } from './FlowRunner/FlowRunner';
export { useFlowRunner } from './FlowRunner/use-flow-runner';
export {
  EXEC_STATE_TEXT,
  EXEC_STATE_COLOR,
  RUNNER_STATUS_TEXT,
  LOG_EVENT_TEXT,
  type ExecState,
  type RunnerStatus,
  type RunnerLog,
  type RunnerApi,
} from './FlowRunner/flow-runner-types';

import './flowgram-demo/index.css';
