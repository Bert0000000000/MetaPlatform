/**
 * FlowSurface
 * --------------------------------------------------
 * 一站式流程图组件：
 * - 内置 FlowGram minimap 与 history（FlowGram 自带 undo/redo）。
 * - 业务数据通过 { nodes, edges } 业务模型暴露，组件内部是单一数据源。
 * - 通过 FlowEditorMetaContext 把工具能力 + 选中态 + 物料索引广播给 Toolbar / Palette / PropertyPanel。
 * - 通过 ref 暴露 zoom / fitView / undo / redo 给调用方。
 *
 * 设计要点：
 * - FlowSurface 是单一数据源（useFlowHistory + setData）。
 *   FlowEditorCanvas 受控（data prop / onChange 回写），与外层形成闭环。
 * - 选中态由 FlowEditorCanvas 的 onSelectNode 上行 → setSelectedNodeId → 属性面板消费。
 * - 主题：useFlowTheme 既设置 document.documentElement data-theme，也驱动 layout 的 inline style。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { BPMN_NODE_MATERIALS, BPMN_PALETTE_CATEGORIES } from './materials/bpmn';
import { AGENT_NODE_MATERIALS, AGENT_PALETTE_CATEGORIES } from './materials/agent';
import {
  FlowEditorCanvas,
  type FlowEditorCanvasApi,
} from './FlowEditorCanvas';
import { FlowToolbar } from './FlowToolbar';
import { FlowPalette } from './FlowPalette';
import { FlowPropertyPanel } from './FlowPropertyPanel';
import { FlowEditorMetaContext } from './FlowContext';
import { useFlowTheme } from './useFlowTheme';
import { useFlowHistory } from './useFlowHistory';
import { flowDataToFlowgram } from './flow-adapter';
import type {
  FlowData,
  FlowNode,
  FlowNodeMaterial,
  FlowPaletteCategory,
  ResolvedThemeMode,
  ThemeModeSetting,
} from './flow-types';
import './flow-canvas.css';

export type FlowSurfaceMode = 'bpmn' | 'agent' | 'custom';

export interface FlowSurfaceProps {
  mode?: FlowSurfaceMode;
  initialData?: FlowData;
  nodeMaterials?: FlowNodeMaterial[];
  paletteCategories?: FlowPaletteCategory[];
  themeMode?: ThemeModeSetting;
  /** 任意 data 变化都会触发；用于上层持久化 */
  onChange?: (data: FlowData) => void;
  /** 保存（默认产出 FlowGram JSON），可被 onSave 拦截 */
  onSave?: (flowgramJson: unknown) => void;
  /** 发布（默认产出 FlowGram JSON） */
  onPublish?: (flowgramJson: unknown) => void;
  onPreview?: () => void;
  toolbarExtras?: { left?: ReactNode; right?: ReactNode };
  showStatusBar?: boolean;
  showPalette?: boolean;
  showPropertyPanel?: boolean;
  containerStyle?: CSSProperties;
  withMinimap?: boolean;
  withHistory?: boolean;
}

export interface FlowSurfaceHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  /** 当前 data 快照（用于父组件 pull 最新值） */
  data: FlowData;
  /** 注入受控外部 data（重置时使用） */
  setData: (next: FlowData) => void;
}

function resolveDefaultMaterials(
  mode: FlowSurfaceMode,
): { materials: FlowNodeMaterial[]; categories: FlowPaletteCategory[] } {
  if (mode === 'agent') {
    return { materials: AGENT_NODE_MATERIALS, categories: AGENT_PALETTE_CATEGORIES };
  }
  if (mode === 'custom') return { materials: [], categories: [] };
  return { materials: BPMN_NODE_MATERIALS, categories: BPMN_PALETTE_CATEGORIES };
}

export const FlowSurface = forwardRef<FlowSurfaceHandle, FlowSurfaceProps>(
  function FlowSurface(props, ref) {
    const {
      mode = 'bpmn',
      initialData,
      nodeMaterials,
      paletteCategories,
      themeMode = 'auto',
      onChange,
      onSave,
      onPublish,
      onPreview,
      toolbarExtras,
      showStatusBar = true,
      showPalette = true,
      showPropertyPanel = true,
      containerStyle,
      withMinimap = true,
      withHistory = true,
    } = props;

    const defaults = useMemo(() => resolveDefaultMaterials(mode), [mode]);
    const materials = useMemo<FlowNodeMaterial[]>(
      () => (nodeMaterials && nodeMaterials.length > 0 ? nodeMaterials : defaults.materials ?? []),
      [nodeMaterials, defaults.materials],
    );
    const categories = useMemo<FlowPaletteCategory[]>(
      () => (paletteCategories && paletteCategories.length > 0
        ? paletteCategories
        : defaults.categories ?? []),
      [paletteCategories, defaults.categories],
    );

    const { resolvedMode, theme } = useFlowTheme(themeMode);

    // -------- 单数据源：useFlowHistory 维护 current + past + future --------
    const fallbackData: FlowData = { nodes: [], edges: [] };
    const history = useFlowHistory<FlowData>(initialData ?? fallbackData, {
      capacity: 200,
      withSeed: true,
    });
    // 防御：useFlowHistory 在 lazy initializer 阶段若 T 上偶发失败，
    // 也保证 .nodes 一定存在。
    const data: FlowData = (history.state && Array.isArray((history.state as FlowData).nodes))
      ? (history.state as FlowData)
      : fallbackData;

    // 外部 initialData 变更时，重置历史
    const lastInitialRef = useRef(initialData);
    useEffect(() => {
      if (lastInitialRef.current !== initialData && initialData) {
        history.reset(initialData);
        lastInitialRef.current = initialData;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    // 选中态
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const selectedNode = useMemo<FlowNode | null>(() => {
      if (!selectedNodeId) return null;
      return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
    }, [data.nodes, selectedNodeId]);

    // 透传 onChange：data 变化时通知上层
    useEffect(() => {
      onChange?.(data);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // 编辑单个节点（属性面板回调）→ 推入历史栈
    const handlePatchNode = useCallback(
      (id: string, patch: Partial<FlowNode>) => {
        const next: FlowData = {
          ...data,
          nodes: data.nodes.map((n) =>
            n.id === id ? { ...n, ...patch, data: { ...(n.data ?? {}), ...(patch.data ?? {}) } } : n,
          ),
        };
        history.push(next);
      },
      [data, history],
    );

    // 应用层 onSave / onPublish：默认产出 FlowGram JSON
    const handleSave = useCallback(() => {
      onSave?.(flowDataToFlowgram(data));
    }, [data, onSave]);
    const handlePublish = useCallback(() => {
      onPublish?.(flowDataToFlowgram(data));
    }, [data, onPublish]);

    // FlowGram 的 usePlaygroundTools() 通过 onToolsReady 上抛
    const apiRef = useRef<FlowEditorCanvasApi | null>(null);
    const [api, setApi] = useState<FlowEditorCanvasApi | null>(null);
    const handleToolsReady = useCallback((incoming: FlowEditorCanvasApi) => {
      apiRef.current = incoming;
      setApi(incoming);
    }, []);

    // 暴露给上层：ref handle
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          apiRef.current?.zoomIn();
        },
        zoomOut: () => {
          apiRef.current?.zoomOut();
        },
        fitView: () => {
          void apiRef.current?.fitView();
        },
        undo: () => {
          const restored = history.undo();
          // ref 调用是命令式，无需返回值
          void restored;
        },
        redo: () => {
          const restored = history.redo();
          void restored;
        },
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        zoom: apiRef.current?.zoom ?? 1,
        data,
        setData: (next: FlowData) => history.replace(next),
      }),
      [history, data],
    );

    // 编辑后由 canvas 反写：目前未接入节点 add/del 的内层回调，预留接口。
    const handleCanvasChange = useCallback(
      (next: FlowData) => {
        if (next !== data) history.push(next);
      },
      [data, history],
    );

    const materialsByType = useMemo(() => {
      const m: Record<string, FlowNodeMaterial> = {};
      materials.forEach((mat) => {
        m[mat.type] = mat;
      });
      return m;
    }, [materials]);

    return (
      <div
        data-theme={resolvedMode as ResolvedThemeMode}
        className="flow-surface"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          background: theme.bg,
          color: theme.nodeText,
          ...containerStyle,
        }}
      >
        <FlowEditorMetaContext.Provider
          value={{
            categories,
            materials,
            selectedNodeId,
            selectedNode,
            onSelectNode: (id: string | null) => setSelectedNodeId(id),
            onPatchNode: handlePatchNode,
            api,
          }}
        >
          <FlowToolbar
            title={`流程设计器 · ${mode === 'bpmn' ? 'BPMN' : mode === 'agent' ? 'Agent' : '自定义'}`}
            version={`v2.1 · ${data.nodes.length} 节点`}
            extraLeft={toolbarExtras?.left}
            extraRight={toolbarExtras?.right}
            onSave={handleSave}
            onPublish={handlePublish}
            onPreview={onPreview}
            onUndo={() => history.undo()}
            onRedo={() => history.redo()}
            onZoomIn={() => apiRef.current?.zoomIn()}
            onZoomOut={() => apiRef.current?.zoomOut()}
            onFitView={() => {
              void apiRef.current?.fitView();
            }}
            zoomPercent={Math.round((api?.zoom ?? 1) * 100)}
          />

          <div className="flow-canvas__body">
            {showPalette && <FlowPalette />}
            <div className="flow-canvas__main">
              <FlowEditorCanvas
                ref={(node) => {
                  // 给 ref 重新挂接一个代理，保留上层可通过 handle 调用方法
                  if (node) {
                    apiRef.current = Object.assign({}, apiRef.current ?? {}, node);
                  }
                }}
                data={data}
                materials={materials}
                paletteCategories={categories}
                themeMode={themeMode}
                onChange={handleCanvasChange}
                onSelectNode={(id: string | null) => setSelectedNodeId(id)}
                onToolsReady={handleToolsReady}
                withMinimap={withMinimap}
                withHistory={withHistory}
                containerStyle={{ height: '100%' }}
              />
            </div>
            {showPropertyPanel && <FlowPropertyPanel materialsByType={materialsByType} />}
          </div>

          {showStatusBar && (
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--flow-node-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--flow-node-subtext)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--flow-base-color-activated)',
                    }}
                  />
                  已保存
                </span>
                <span>分支: main</span>
                <span>最后编辑: 刚刚</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>节点: {data.nodes.length}</span>
                <span>连线: {data.edges.length}</span>
                <span>缩放: {Math.round((api?.zoom ?? 1) * 100)}%</span>
              </div>
            </div>
          )}
        </FlowEditorMetaContext.Provider>
      </div>
    );
  },
);
