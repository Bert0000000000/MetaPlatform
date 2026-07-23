/**
 * FlowProvider
 * --------------------------------------------------
 * 维护 FlowData + 选中态 + 主题模式；
 * 将主题变量同步到 :root，向子组件提供 FlowContext。
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useFlowTheme } from './useFlowTheme';
import { FlowContext } from './FlowContext';
import type {
  FlowData,
  FlowNode,
  FlowPaletteCategory,
  ThemeModeSetting,
} from './flow-types';

export interface FlowProviderProps {
  initialData?: FlowData;
  children: ReactNode;
  themeMode?: ThemeModeSetting;
  paletteCategories?: FlowPaletteCategory[];
  onChange?: (data: FlowData) => void;
}

export function FlowProvider({
  initialData,
  children,
  themeMode = 'auto',
  paletteCategories = [],
  onChange,
}: FlowProviderProps) {
  const [data, setDataInternal] = useState<FlowData>(
    initialData ?? { nodes: [], edges: [] },
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const setData = useCallback(
    (next: FlowData) => {
      setDataInternal(next);
      onChange?.(next);
    },
    [onChange],
  );

  const selectedNode: FlowNode | null = useMemo(() => {
    if (!selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [data.nodes, selectedNodeId]);

  useFlowTheme(themeMode);

  return (
    <FlowContext.Provider
      value={{
        data,
        setData,
        selectedNodeId,
        setSelectedNodeId,
        selectedNode,
        paletteCategories,
        themeMode,
        materials: [],
      }}
    >
      {children}
    </FlowContext.Provider>
  );
}
