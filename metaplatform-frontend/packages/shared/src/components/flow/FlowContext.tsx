/**
 * FlowCanvas 状态上下文
 *
 * - FlowContext：仅在 FlowProvider 内部有效，承载 data / selectedNodeId / palette。
 * - FlowEditorMetaContext：独立通道；FlowPalette / FlowPropertyPanel 在 Provider 之外也可读取，
 *   这样集成方可以选择是否用 FlowProvider 包裹，还是通过 props 直接传 palette/materials。
 */
import { createContext, useContext } from 'react';
import type {
  FlowData,
  FlowNode,
  FlowNodeMaterial,
  FlowPaletteCategory,
  ThemeModeSetting,
} from './flow-types';

export interface FlowContextValue {
  data: FlowData;
  setData: (next: FlowData) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNode: FlowNode | null;
  paletteCategories: FlowPaletteCategory[];
  materials: FlowNodeMaterial[];
  themeMode: ThemeModeSetting;
}

export const FlowContext = createContext<FlowContextValue | null>(null);

/**
 * 元信息独立通道：palette / materials。
 * 上层（如 FlowSurface）通过此 context 注入；FlowPalette / FlowPropertyPanel 读取。
 */
export interface FlowEditorMetaValue {
  categories: FlowPaletteCategory[];
  materials?: FlowNodeMaterial[];
  selectedNodeId?: string | null;
  selectedNode?: FlowNode | null;
  onSelectNode?: (id: string | null) => void;
  /** 编辑单个节点的回调（属性面板触发） */
  onPatchNode?: (id: string, patch: Partial<FlowNode>) => void;
  /** 全局工具能力（zoom/undo/redo） */
  api?: import('./FlowEditorCanvas').FlowEditorCanvasApi | null;
}

export const FlowEditorMetaContext = createContext<FlowEditorMetaValue>({
  categories: [],
});

export function useFlowContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) {
    throw new Error('useFlowContext must be used within <FlowProvider>');
  }
  return ctx;
}

export function useFlowEditorMeta(): FlowEditorMetaValue {
  return useContext(FlowEditorMetaContext);
}
