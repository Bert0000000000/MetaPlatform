/**
 * FlowGram 1.0.12 内部 renderer 键的全集 (从 FlowRendererKey 反查得到)。
 * 把这些键一次性注册为返回 null 的占位组件，避免 FlowGram 内置层抛
 * `Unknown render key '...'`。业务的物料节点仍由 FlowGram 自身的
 * node-render 机制渲染，外层 `<EditorRenderer>` 接管。
 */
const FLOWGRAM_RENDER_KEYS: string[] = [
  'node-render',
  'adder',
  'collapse',
  'branch-adder',
  'try-catch-collapse',
  'drag-node',
  'draggable-adder',
  'drag-highlight-adder',
  'drag-branch-highlight-adder',
  'selector-box-popover',
  'context-menu-popover',
  'sub-canvas',
  'slot-adder',
  'slot-label',
  'slot-collapse',
  'arrow-renderer',
  'marker-arrow',
  'marker-active-arrow',
];

/**
 * FlowEditorCanvas
 * --------------------------------------------------
 * 基于 @flowgram.ai/fixed-layout-editor 的 FixedLayoutEditorProvider：
 *
 * 设计要点：
 * - data 走受控：由 `data` prop 传入；变更通过 onChange 回写上层，
 *   组件内部不维护独立的 data state，与外层单一数据源。
 * - tools 通过 `onToolsReady` 回调把 usePlaygroundTools() 的能力传出，
 *   由调用方决定如何绑定到 Toolbar / 按钮。toolbarSlot 保留兼容。
 * - minimap / history 通过 withMinimap / withHistory 控制；
 *   key 只跟随 (materials + history flag) 组合变化，避免不必要 remount。
 */
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  FixedLayoutEditorProvider,
  EditorRenderer,
  useClientContext,
  usePlaygroundTools,
  type PlaygroundTools,
} from '@flowgram.ai/fixed-layout-editor';
import { createMinimapPlugin } from '@flowgram.ai/minimap-plugin';
import { PALETTE_ADD_EVENT, type PaletteAddDetail } from './FlowPalette';
import {
  flowDataToFlowgramJSON,
  buildFlowNodeRegistries,
  ALL_NODE_MATERIALS,
} from './FlowNodeRegistries';
import type {
  FlowData,
  FlowNodeMaterial,
  FlowPaletteCategory,
  ThemeModeSetting,
} from './flow-types';

export interface FlowEditorCanvasApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: (padding?: number) => Promise<void> | void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
}

const EMPTY_API: FlowEditorCanvasApi = {
  zoomIn: () => {},
  zoomOut: () => {},
  fitView: () => {},
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
  zoom: 1,
};

export interface FlowEditorCanvasProps {
  data: FlowData;
  materials?: FlowNodeMaterial[];
  paletteCategories?: FlowPaletteCategory[];
  themeMode?: ThemeModeSetting;
  onChange?: (data: FlowData) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onToolsReady?: (api: FlowEditorCanvasApi) => void;
  toolbarSlot?: (tools: { zoomIn: () => void; zoomOut: () => void; fitView: () => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; zoom: number }) => ReactNode;
  statusBarSlot?: (snapshot: { nodeCount: number; edgeCount: number; zoomPercent: number }) => ReactNode;
  containerStyle?: CSSProperties;
  withMinimap?: boolean;
  withHistory?: boolean;
}

export const FlowEditorCanvas = forwardRef<FlowEditorCanvasApi, FlowEditorCanvasProps>(
  function FlowEditorCanvas(
    {
      data,
      materials,
      paletteCategories,
      withMinimap = true,
      withHistory = true,
      toolbarSlot,
      statusBarSlot,
      containerStyle,
      onChange,
      onSelectNode,
      onToolsReady,
    },
    ref,
  ) {
    const resolvedMaterials = useMemo<FlowNodeMaterial[]>(() => {
      if (materials && materials.length > 0) return materials;
      return ALL_NODE_MATERIALS;
    }, [materials]);

    const documentJSON = useMemo(
      () => flowDataToFlowgramJSON(data),
      [data],
    );

    const registries = useMemo(
      () => buildFlowNodeRegistries(resolvedMaterials),
      [resolvedMaterials],
    );

    void paletteCategories;

    const apiRef = useRef<FlowEditorCanvasApi>(EMPTY_API);
    useImperativeHandle(ref, () => apiRef.current, []);

    return (
      <div
        data-flow-theme="flowgram-mate"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...containerStyle,
        }}
      >
        <FixedLayoutEditorProvider
          key={`${resolvedMaterials.map((m) => m.type).join('|')}|${
            withHistory ? 'h1' : 'h0'
          }`}
          background
          readonly={false}
          initialData={documentJSON as unknown as Parameters<typeof FixedLayoutEditorProvider>[0]['initialData']}
          nodeRegistries={registries as unknown as Parameters<typeof FixedLayoutEditorProvider>[0]['nodeRegistries']}
          history={
            withHistory
              ? ({
                  enable: true,
                  enableBeforeCommandHandle: true,
                } as unknown as Parameters<typeof FixedLayoutEditorProvider>[0]['history'])
              : undefined
          }
          onAllLayersRendered={(ctx: unknown) => {
            const c = ctx as {
              playground: { config: { fitView: (b: unknown) => void } };
              document: { root: { bounds: { pad: (n: number) => unknown } } };
            };
            c.playground.config.fitView(c.document.root.bounds.pad(30));
          }}
          materials={{
            // 同时挂多个 FlowGram 内部 renderer 键的占位实现，
            // 防止 FreeDragPlugin / Adder 等内置层在挂载时找不到键。
            // FlowGram 1.0.12 renderer keys 全集 (FlowRendererKey)。
            components: FLOWGRAM_RENDER_KEYS.reduce<Record<string, () => null>>(
              (acc, key) => {
                acc[key] = () => null;
                return acc;
              },
              {},
            ),
          }}
          plugins={
            withMinimap
              ? () => [
                  createMinimapPlugin({
                    disableLayer: true,
                    enableDisplayAllNodes: true,
                    canvasStyle: {
                      canvasWidth: 182,
                      canvasHeight: 102,
                      canvasPadding: 50,
                      canvasBackground: 'rgba(245, 245, 245, 1)',
                      canvasBorderRadius: 10,
                      viewportBackground: 'rgba(235, 235, 235, 1)',
                      viewportBorderRadius: 4,
                      viewportBorderColor: 'rgba(201, 201, 201, 1)',
                      viewportBorderWidth: 1,
                      viewportBorderDashLength: 2,
                      nodeColor: 'rgba(255, 255, 255, 1)',
                      nodeBorderRadius: 2,
                      nodeBorderWidth: 0.145,
                      nodeBorderColor: 'rgba(6, 7, 9, 0.10)',
                      overlayColor: 'rgba(255, 255, 255, 0)',
                    },
                  }),
                ]
              : undefined
          }
        >
          <EditorContentSync
            data={data}
            onChange={onChange}
            onSelectNode={onSelectNode}
          />

          <EditorRenderer className="flowgram-mate-editor" />

          <OnPaletteAddBridge materials={resolvedMaterials} />

          <ToolsBridge
            onReady={(tools) => {
              const api: FlowEditorCanvasApi = {
                zoomIn: () => tools.zoomin(),
                zoomOut: () => tools.zoomout(),
                fitView: () => {
                  void tools.fitView();
                },
                undo: () => tools.undo(),
                redo: () => tools.redo(),
                canUndo: tools.canUndo,
                canRedo: tools.canRedo,
                zoom: tools.zoom,
              };
              apiRef.current = api;
              onToolsReady?.(api);
            }}
          />

          {toolbarSlot ? (
            <ToolsBridge
              render={(tools) =>
                toolbarSlot({
                  zoomIn: () => tools.zoomin(),
                  zoomOut: () => tools.zoomout(),
                  fitView: () => {
                    void tools.fitView();
                  },
                  undo: () => tools.undo(),
                  redo: () => tools.redo(),
                  canUndo: tools.canUndo,
                  canRedo: tools.canRedo,
                  zoom: Math.round(tools.zoom * 100),
                })
              }
            />
          ) : null}

          {statusBarSlot ? (
            <ToolsBridge
              render={(tools) =>
                statusBarSlot({
                  nodeCount: data.nodes.length,
                  edgeCount: data.edges.length,
                  zoomPercent: Math.round(tools.zoom * 100),
                })
              }
            />
          ) : null}
        </FixedLayoutEditorProvider>
      </div>
    );
  },
);

function ToolsBridge(props: {
  onReady?: (tools: PlaygroundTools) => void;
  render?: (tools: PlaygroundTools) => ReactNode;
}) {
  const tools = usePlaygroundTools();
  // 仅在 zoom/canUndo/canRedo 等关键状态变更时通知上层；
  // 避免 tools 引用本身抖动时频繁 onReady。
  useEffect(() => {
    props.onReady?.(tools);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.zoom, tools.canUndo, tools.canRedo]);
  if (props.render) return <>{props.render(tools)}</>;
  return null;
}

function EditorContentSync({
  data: _data,
  onChange: _onChange,
  onSelectNode: _onSelectNode,
}: {
  data: FlowData;
  onChange?: (d: FlowData) => void;
  onSelectNode?: (id: string | null) => void;
}) {
  // 当前简化版本不做内部同步，data 由外层控制流入；
  // 保留 props 解构避免未来接入时报错。
  void _data;
  void _onChange;
  void _onSelectNode;
  return null;
}

/**
 * Palette → addNode 桥接。
 *
 * - 监听 `window` 上的 `m8:flow-palette-add` CustomEvent；
 * - 通过 useClientContext 拿到 FlowGram 的 client；
 * - 调 client.document.toJSON() 取出当前文档，把新节点追加到 nodes；
 * - 写回 client.document.fromJSON(json, true) → 画布自动重新渲染。
 *
 * 这条路径不走我们自己的 useFlowHistory（外层 React 端的 history），
 * 原因：FlowGram 内部维护自己的内部 document，外层写 data 不回回流到
 * document。这里直接和 FlowGram API 配合能保证节点真实出现在画布上。
 */
function OnPaletteAddBridge({ materials }: { materials: FlowNodeMaterial[] }) {
  const client = useClientContext() as unknown as {
    operation?: unknown;
    document?: {
      toJSON?: () => unknown;
      fromJSON?: (json: unknown, fireRender?: boolean) => void;
    };
    playground?: { config?: { fitView?: (b: unknown) => void }; zoom?: number };
  };
  // usePlaygroundTools 返回的 fitView/zoom 才是真正可以调用 FitView 的 API。
  const tools = usePlaygroundTools();

  // 初次挂载 & 切换模式后自动 fitView 一波：让 FlowGram 把节点按视区尺寸缩放到可见。
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (typeof tools.fitView === 'function') {
          void tools.fitView();
        } else {
          const c = client as unknown as {
            playground?: { config?: { fitView?: (b: unknown) => void } };
            document?: { root?: { bounds?: { pad: (n: number) => unknown } } };
          };
          const bounds = c.document?.root?.bounds?.pad(30);
          if (c.playground?.config?.fitView && bounds !== undefined) {
            c.playground.config.fitView(bounds);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FlowCanvas] auto fitView failed', err);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [client, tools]);

  const materialsByTypeRef = useRef<Record<string, FlowNodeMaterial>>({});

  const materialsByType = useMemo(() => {
    const m: Record<string, FlowNodeMaterial> = {};
    materials.forEach((mat) => {
      m[mat.type] = mat;
    });
    return m;
  }, [materials]);
  materialsByTypeRef.current = materialsByType;

  useEffect(() => {
    function onPaletteAdd(event: Event) {
      const e = event as CustomEvent<PaletteAddDetail>;
      if (!e.detail?.type) return;
      const material = materialsByTypeRef.current[e.detail.type];
      if (!material) return;

      // 1) operation: 历史友好入口
      try {
        const op: unknown = client.operation;
        if (op && typeof op === 'object' && 'addNode' in (op as Record<string, unknown>)) {
          const addNode = (op as { addNode: (cfg: unknown) => void }).addNode;
          addNode({
            nodeType: material.type,
            nodeJSON: {
              id: `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`,
              type: material.type,
              data: {
                title: material.name,
                ...((material.defaultData ?? {}) as Record<string, unknown>),
              },
            },
            position: { x: 120, y: 120 },
          });
          // eslint-disable-next-line no-console
          console.info('[FlowPalette] addNode via operation:', material.type);
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FlowPalette] operation.addNode failed', err);
      }

      // 2) fromJSON 兜底
      try {
        const doc = client.document;
        if (doc && typeof doc.fromJSON === 'function' && typeof doc.toJSON === 'function') {
          const current = (doc.toJSON() ?? {}) as {
            nodes?: Array<{
              id: string;
              type: string;
              meta?: { position?: { x: number; y: number } };
              data?: Record<string, unknown>;
            }>;
            edges?: unknown[];
          };
          const existingNodes = current.nodes ?? [];
          const existingEdges = current.edges ?? [];
          let maxX = 60;
          let maxY = 60;
          existingNodes.forEach((n) => {
            const x = n.meta?.position?.x ?? 0;
            const y = n.meta?.position?.y ?? 0;
            if (x + y > maxX + maxY) {
              maxX = x;
              maxY = y;
            }
          });

          const id = `n_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;
          const nextNodes = [
            ...existingNodes,
            {
              id,
              type: material.type,
              meta: { position: { x: maxX + 60, y: maxY + 40 } },
              data: {
                title: material.name,
                ...((material.defaultData ?? {}) as Record<string, unknown>),
              },
            },
          ];

          doc.fromJSON({ nodes: nextNodes, edges: existingEdges }, true);
          // eslint-disable-next-line no-console
          console.info('[FlowPalette] addNode via fromJSON:', material.type, 'count:', nextNodes.length);
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[FlowPalette] document.fromJSON failed', err);
      }

      // eslint-disable-next-line no-console
      console.warn('[FlowPalette] addNode skipped: no API available');
    }

    window.addEventListener(PALETTE_ADD_EVENT, onPaletteAdd);
    return () => {
      window.removeEventListener(PALETTE_ADD_EVENT, onPaletteAdd);
    };
  }, [client]);

  return null;
}
