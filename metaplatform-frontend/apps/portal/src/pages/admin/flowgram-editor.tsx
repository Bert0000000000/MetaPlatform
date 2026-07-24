/**
 * Mate: 复刻 @mate/shared/flow 的 FlowgramEditor，但覆盖 getNodeDefaultRegistry：
 * 如果外部注入了带 formMeta.render 的 registry，就用它；否则走默认兜底。
 * 这样 admin/components 页能为每种节点渲染专属卡片，而不是统一 input。
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
import { createMinimapPlugin } from '@flowgram.ai/minimap-plugin';
import { defaultFixedSemiMaterials } from '@flowgram.ai/fixed-semi-materials';
import { Field, FlowRendererKey, FlowTextKey } from '@flowgram.ai/fixed-layout-editor';

import {
  buildEditorProps,
  DemoTools,
  DemoMinimap,
  type FlowgramEditorProps,
  ALL_NODE_REGISTRIES,
} from '@mate/shared/flow';
import { CustomBaseNode } from './custom-base-node';

// SlotAdder / NodeAdder / BranchAdder / BaseNode 由 buildEditorProps 默认带入，无需自接管。

type Registry = (typeof ALL_NODE_REGISTRIES)[number];

interface ACFlowgramEditorProps extends FlowgramEditorProps {
  /** 业务侧提供的额外 registry，会覆盖默认的 formMeta.render */
  customRegistries?: Registry[];
}

export const ACFlowgramEditor: React.FC<ACFlowgramEditorProps> = (props) => {
  const {
    initialData,
    nodeRegistries = [],
    customRegistries = [],
    hideTools,
    hidePalette,
    onChange,
  } = props;

  // 合并：默认 registry + 业务 customRegistries（按 type 覆盖）
  const merged: Registry[] = (() => {
    const byType: Record<string, Registry> = {};
    for (const r of nodeRegistries) byType[r.type] = r;
    for (const r of customRegistries) {
      const prev = byType[r.type];
      byType[r.type] = (prev ? { ...prev, ...r } : r) as Registry;
    }
    return Object.values(byType);
  })();

  // 完全自建 FixedLayoutProps，确保 getNodeDefaultRegistry 返回 custom formMeta
  const editorProps = React.useMemo(() => {
    const base = buildEditorProps(initialData, merged, onChange);
    const result: any = {
      ...base,
      nodeRegistries: merged,
      materials: {
        ...base.materials,
        renderDefaultNode: CustomBaseNode,
      },
      getNodeDefaultRegistry(type: any): FlowNodeRegistry {
        const t = String(type);
        const custom = merged.find((r) => r.type === t);
        if (custom && custom.formMeta) {
          return {
            type: t as any,
            meta: { defaultExpanded: true, ...(custom.meta ?? {}) },
            formMeta: custom.formMeta,
          } as FlowNodeRegistry;
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
        // 在 playground ready 后立刻 fitView 一次
        try {
          const pg: any = (ctx as any).playground;
          const doc: any = (ctx as any).document;
          if (pg && doc) {
            const bounds = doc.root.bounds.pad(30);
            if (typeof pg.config?.fitView === 'function') {
              pg.config.fitView(bounds);
            } else if (typeof pg.fitView === 'function') {
              pg.fitView(bounds);
            }
          }
        } catch (err) {
          console.warn('[ACFlowgramEditor] onInit fitView failed', err);
        }
      },
      onAllLayersRendered: (ctx: any) => {
        // 二次保险：全部层渲染后再 fitView 一次
        try {
          const pg: any = (ctx as any).playground;
          const doc: any = (ctx as any).document;
          if (pg && doc) {
            const bounds = doc.root.bounds.pad(30);
            if (typeof pg.config?.fitView === 'function') {
              pg.config.fitView(bounds);
            } else if (typeof pg.fitView === 'function') {
              pg.fitView(bounds);
            }
          }
        } catch (err) {
          console.warn('[ACFlowgramEditor] onAllLayersRendered fitView failed', err);
        }
      },
      };
      return result as FixedLayoutProps;
  }, [initialData, merged, onChange]);

  return (
    <FixedLayoutEditorProvider {...editorProps}>
      <ForceFitViewport />
      <div className="demo-fixed-container">
        <div className="demo-fixed-layout">
          {!hidePalette && <PalettePlaceholder />}
          <EditorRenderer className="demo-fixed-editor">{/* 子级面板位置 */}</EditorRenderer>
        </div>
      </div>
      {!hideTools && (
        <>
          <DemoTools />
          <DemoMinimap />
        </>
      )}
    </FixedLayoutEditorProvider>
  );
};

/** 客户端强制设置 playground transform，让 demo 节点完整显示在画布中心。
 *  使用 demo 数据的**逻辑坐标 bounds**计算（与 layer DOM 尺寸无关），
 *  避免依赖被 transform 后的 layer 尺寸造成循环 / 漂移。 */
const ForceFitViewport: React.FC = () => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // demo 节点真实逻辑 bounds（与 AC_COMPONENTS_FLOW 中节点坐标一致）
    const BOUNDS = { x: 40, y: 0, w: 1380, h: 420 };
    const tryFit = () => {
      const pg = document.querySelector<HTMLElement>('.acp-dropzone .gedit-playground');
      if (!pg) return false;
      const pgRect = pg.getBoundingClientRect();
      const padding = 30;
      const availW = pgRect.width - padding * 2;
      const availH = pgRect.height - padding * 2;
      if (availW <= 0 || availH <= 0) return false;
      // bounds 已是逻辑坐标，pg 起点也是 (0,0)
      const scale = Math.min(availW / BOUNDS.w, availH / BOUNDS.h, 1);
      const offsetX = padding + (availW - BOUNDS.w * scale) / 2 - BOUNDS.x * scale;
      const offsetY = padding + (availH - BOUNDS.h * scale) / 2 - BOUNDS.y * scale;
      pg.style.transformOrigin = '0 0';
      pg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      return true;
    };
    // 多次尝试直到成功（FlowGram 异步渲染）
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (tryFit() || tries > 30) clearInterval(timer);
    }, 100);
    // 监听 dropzone 尺寸变化（窗口 resize / layout 调整）也重算
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

/** 内置 palette 占位：本页使用自定义 palette，此处不再渲染官方 NodeAddPanel */
const PalettePlaceholder: React.FC = () => null;

export default ACFlowgramEditor;

// 重新导出（避免未使用的 import 警告）
export { createMinimapPlugin, defaultFixedSemiMaterials, FlowRendererKey, FlowTextKey };
export type { FixedLayoutProps, FlowDocumentJSON };