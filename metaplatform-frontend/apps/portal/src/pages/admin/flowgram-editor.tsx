/**
 * ACFlowgramEditor (v2)
 * --------------------------------------------------
 * Mate admin/components 专用 FlowGram.AI 编辑器壳。
 *
 * v1.4 R1.5 Sprint 1 重写要点：
 *  - 默认启用 FlowGram 官方 NodeAddPanel（左侧 palette）+ useStartDragNode
 *  - 默认携带 36 节点全量 registry（admin/components 节点库演示用）
 *  - 保留 admin 自定义 CustomBaseNode（拖拽 / hover / 删除）
 *  - getNodeDefaultRegistry 覆盖 formMeta.render 渲染 36 卡片
 *  - mount 时注入 9 个 --g-* CSS 变量 + Semi ConfigProvider 兜底
 *  - 错误边界：捕获 FlowGram 内部错误（InversifyJS DI 失败等）不白屏
 *
 * 注：Semi 2.80 的 ConfigProvider 没有 theme prop；本组件不包 ConfigProvider。
 */
import React, { useEffect } from 'react';
import {
  FixedLayoutEditorProvider,
  EditorRenderer,
  type FixedLayoutProps,
  type FlowDocumentJSON,
  type FlowNodeRegistry,
} from '@flowgram.ai/fixed-layout-editor';
import '@flowgram.ai/fixed-layout-editor/index.css';
import { Field } from '@flowgram.ai/fixed-layout-editor';

import {
  buildEditorPropsWith,
  DemoTools,
  DemoMinimap,
  FlowgramErrorBoundary,
  type FlowgramEditorProps,
  ensureFlowgramThemeStyle,
} from '@mate/shared/flow';
import { CustomBaseNode } from './custom-base-node';
import {
  ensureNodeCardV2Style,
  groupsByCategory,
  NODE_REGISTRIES_36,
  type NodePaletteGroup,
} from './node-render-v2';

interface ACFlowgramEditorProps extends FlowgramEditorProps {
  /**
   * 自定义 palette 分组。默认是 admin 36 节点全集。
   */
  paletteGroups?: Array<NodePaletteGroup & { registries: FlowNodeRegistry[] }>;
  /**
   * 兼容旧版 customRegistries：覆盖默认 formMeta.render。
   * 新版 v2 已把所有 formMeta.render 内置到 NODE_REGISTRIES_36，
   * 通常不需要传这个参数。
   */
  customRegistries?: FlowNodeRegistry[];
}

export const ACFlowgramEditor: React.FC<ACFlowgramEditorProps> = (props) => {
  const {
    initialData,
    nodeRegistries,
    paletteGroups: propPaletteGroups,
    customRegistries: _customRegistries, // 保留 API 兼容，新版已忽略
    hideTools,
    hidePalette = false,
    onChange,
  } = props;

  // v1.4 R1.5：mount 时注入主题色 + 36 卡片样式
  useEffect(() => {
    ensureFlowgramThemeStyle();
    ensureNodeCardV2Style();
  }, []);

  // paletteGroups：未传则用 36 节点全集
  const paletteGroups = (propPaletteGroups && propPaletteGroups.length > 0)
    ? propPaletteGroups
    : groupsByCategory();

  // nodeRegistries：合并所有 palette 分组下的 registry
  const effectiveRegistries: FlowNodeRegistry[] =
    (paletteGroups ?? []).flatMap((g) => g.registries).length > 0
      ? (paletteGroups ?? []).flatMap((g) => g.registries)
      : nodeRegistries ?? NODE_REGISTRIES_36;

  // 完全自建 FixedLayoutProps，确保 getNodeDefaultRegistry 返回 custom formMeta
  const editorProps = React.useMemo(() => {
    const base = buildEditorPropsWith({
      initialData,
      nodeRegistries: effectiveRegistries,
      onChange,
      enableShortcuts: true,
      enableExport: true,
      enableBackground: true,
    });

    return {
      ...base,
      nodeRegistries: effectiveRegistries,
      materials: {
        ...base.materials,
        renderDefaultNode: CustomBaseNode,
      },
      getNodeDefaultRegistry(type: any): FlowNodeRegistry {
        const t = String(type);
        const reg = effectiveRegistries.find((r) => r.type === t);
        if (reg && (reg as any).formMeta) {
          return reg as FlowNodeRegistry;
        }
        // 兜底：与官方一致的 Field name="title" + input content
        return {
          type: t as any,
          meta: { defaultExpanded: true },
          formMeta: {
            render: () => (
              <>
                <Field<string> name="title">
                  {({ field }) => <div className="demo-fixed-node-title">{field.value}</div>}
                </Field>
                <div className="demo-fixed-node-content">
                  <Field<string> name="content">
                    <input />
                  </Field>
                </div>
              </>
            ),
          },
        } as FlowNodeRegistry;
      },
      onInit: (ctx: any) => {
        try {
          const pg: any = (ctx as any).playground;
          const doc: any = (ctx as any).document;
          if (pg && doc) {
            const bounds = doc.root.bounds.pad(30);
            if (typeof pg.config?.fitView === 'function') pg.config.fitView(bounds);
            else if (typeof pg.fitView === 'function') pg.fitView(bounds);
          }
        } catch (err) {
          console.warn('[ACFlowgramEditor] onInit fitView failed', err);
        }
      },
      onAllLayersRendered: (ctx: any) => {
        try {
          const pg: any = (ctx as any).playground;
          const doc: any = (ctx as any).document;
          if (pg && doc) {
            const bounds = doc.root.bounds.pad(30);
            if (typeof pg.config?.fitView === 'function') pg.config.fitView(bounds);
            else if (typeof pg.fitView === 'function') pg.fitView(bounds);
          }
        } catch (err) {
          console.warn('[ACFlowgramEditor] onAllLayersRendered fitView failed', err);
        }
      },
    } as FixedLayoutProps;
  }, [initialData, effectiveRegistries, onChange]);

  return (
    <FlowgramErrorBoundary>
      <FixedLayoutEditorProvider {...editorProps}>
        <ForceFitViewport />
        <div className="demo-fixed-container">
          <div className="demo-fixed-layout">
            {!hidePalette && (
              <NodeAddPanelCustom groups={paletteGroups} />
            )}
            <EditorRenderer className="demo-fixed-editor">
              {/* 子级面板位置 */}
            </EditorRenderer>
          </div>
        </div>
        {!hideTools && (
          <>
            <DemoTools />
            <DemoMinimap />
          </>
        )}
      </FixedLayoutEditorProvider>
    </FlowgramErrorBoundary>
  );
};

/**
 * 自定义 palette 渲染：复用 FlowGram 官方的 useStartDragNode 拖拽机制，
 * 但卡片 UI 用 admin/node-render-v2.tsx 的 36 节点样式。
 *
 * 为什么不用官方 NodeAddPanel：
 *   官方组件 (packages/shared/src/components/flow/flowgram-demo/components/node-add-panel.tsx)
 *   写死了一个 fallback ICON_MAP + 半透明 demo 卡片样式，跟我们的
 *   v2 卡片视觉系统不一致。这里在官方拖拽机制之上包一层自定义渲染。
 */
import { useStartDragNode } from '@flowgram.ai/fixed-layout-editor';
import { useAddNode } from '@mate/shared/flow';

const NodeAddPanelCustom: React.FC<{
  groups: Array<{ key: string; label: string; registries: FlowNodeRegistry[] }>;
}> = ({ groups }) => {
  const { startDrag } = useStartDragNode();
  const { handleAdd, handleAddBranch } = useAddNode();

  return (
    <div className="acp-palette-panel">
      {groups.map((group) => (
        <div key={group.key} className="acp-palette-group">
          <div className="acp-palette-group-title">{group.label}</div>
          <div className="acp-palette-items">
            {group.registries.map((registry) => (
              <div
                key={`${group.key}-${registry.type}`}
                className="acp-palette-card"
                draggable={false}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const json = registry.onAdd();
                  void startDrag(
                    e,
                    {
                      dragJSON: json,
                      onCreateNode: async (j: any, dropNode: any) =>
                        handleAdd(j, dropNode),
                    },
                    { disableDragScroll: true }
                  );
                }}
                title={`拖拽「${(registry as any).onAdd?.().data?.title ?? registry.type}」到画布`}
              >
                <PaletteCardPreview registry={registry} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * palette 卡片缩略图：直接复用 36 节点的 formMeta 卡片渲染
 * （但用 <NodeCard spec> 而非 FlowNodeRegistry，避免双层 formMeta 包装）
 */
function PaletteCardPreview({ registry }: { registry: FlowNodeRegistry }) {
  // 用 R/T 直接渲染：直接在 palette 显示 36 卡片的样式（180px 宽）
  return <PaletteMini registry={registry} />;
}

// 为了避免 36 卡片逻辑分散在两处（formMeta + palette），palette 直接渲染 v2 卡片
import { NODES_36 } from './node-render-v2';
function PaletteMini({ registry }: { registry: FlowNodeRegistry }) {
  const spec = NODES_36.find((n) => n.type === registry.type);
  if (!spec) return null;
  return (
    <div className="ac-node-card-v2">
      <div className={`ac-node-card-v2-bar ${spec.accent}`} />
      <div className="ac-node-card-v2-body">
        <div className="ac-node-card-v2-head">
          <span className={`ac-node-card-v2-icon ${spec.accent}`}>
            <spec.Icon />
          </span>
          <span className="ac-node-card-v2-title">{spec.name}</span>
        </div>
        <div className="ac-node-card-v2-desc">{spec.desc}</div>
      </div>
    </div>
  );
}

/**
 * 客户端强制设置 playground transform，让 demo 节点完整显示在画布中心。
 */
const ForceFitViewport: React.FC = () => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const BOUNDS = { x: 40, y: 0, w: 1380, h: 420 };
    const tryFit = () => {
      const pg = document.querySelector<HTMLElement>('.acp-flow-section .gedit-playground, .acp-dropzone .gedit-playground');
      if (!pg) return false;
      const pgRect = pg.getBoundingClientRect();
      const padding = 30;
      const availW = pgRect.width - padding * 2;
      const availH = pgRect.height - padding * 2;
      if (availW <= 0 || availH <= 0) return false;
      const scale = Math.min(availW / BOUNDS.w, availH / BOUNDS.h, 1);
      const offsetX = padding + (availW - BOUNDS.w * scale) / 2 - BOUNDS.x * scale;
      const offsetY = padding + (availH - BOUNDS.h * scale) / 2 - BOUNDS.y * scale;
      pg.style.transformOrigin = '0 0';
      pg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      return true;
    };
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (tryFit() || tries > 30) clearInterval(timer);
    }, 100);
    const ro = new ResizeObserver(() => tryFit());
    const dropzone = document.querySelector('.acp-dropzone .gedit-playground');
    if (dropzone) ro.observe(dropzone);
    return () => {
      clearInterval(timer);
      ro.disconnect();
    };
  }, []);
  return null;
};

export default ACFlowgramEditor;

// 重新导出（避免未使用的 import 警告）
export { Field };
export type { FixedLayoutProps, FlowDocumentJSON, FlowNodeRegistry };
export { NODE_REGISTRIES_36 };