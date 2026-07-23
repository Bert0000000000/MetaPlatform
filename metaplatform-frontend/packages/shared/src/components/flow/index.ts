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
 */

export { FlowgramEditor, type FlowgramEditorProps } from './flowgram-demo/editor';
export { Tools as DemoTools } from './flowgram-demo/components/tools';
export { Minimap as DemoMinimap } from './flowgram-demo/components/minimap';
export { FlowSelect as DemoFlowSelect, type FlowSelectProps } from './flowgram-demo/components/flow-select';
export { buildEditorProps } from './flowgram-demo/hooks/use-editor-props';
export { useAddNode } from './flowgram-demo/hooks/use-add-node';
export {
  BPMN_NODE_REGISTRIES,
  AGENT_NODE_REGISTRIES,
  ALL_NODE_REGISTRIES,
  BUSINESS_FLOW_REGISTRIES,
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

import './flowgram-demo/index.css';
