/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 把官方 demo 的 useEditorProps 重写为纯函数 buildEditorProps，
 * 把 initialData / nodeRegistries / onChange 注入到 FlowGram FixedLayoutProps。
 *
 * v1.4 R1.5 Sprint 1 升级：
 * - 新增官方插件：background（网格+Logo）/ export（JSON/YAML/PNG/JPEG/SVG）/ shortcuts（Cmd+Z/Y/C/V/Delete/S）
 * - 9 个 --g-* CSS 主题变量通过 flowgram-theme.css 注入（外部）
 * - Semi Design 通过 ConfigProvider 注入（外部）
 */
import type { ReactNode } from 'react';
import { createMinimapPlugin } from '@flowgram.ai/minimap-plugin';
import { createBackgroundPlugin } from '@flowgram.ai/background-plugin';
import { createDownloadPlugin, FlowDownloadFormat } from '@flowgram.ai/export-plugin';
import { createShortcutsPlugin } from '@flowgram.ai/shortcuts-plugin';
import { defaultFixedSemiMaterials } from '@flowgram.ai/fixed-semi-materials';
import {
  Field,
  type FixedLayoutProps,
  type FlowDocumentJSON,
  type FlowNodeRegistry,
  FlowRendererKey,
  FlowTextKey,
} from '@flowgram.ai/fixed-layout-editor';

import { SlotAdder } from '../components/slot-adder';
import { NodeAdder } from '../components/node-adder';
import { BranchAdder } from '../components/branch-adder';
import { BaseNode } from '../components/base-node';

export interface BuildEditorPropsOptions {
  initialData: FlowDocumentJSON;
  nodeRegistries: FlowNodeRegistry[];
  onChange?: (json: FlowDocumentJSON) => void;
  /** 是否启用快捷键（默认 true） */
  enableShortcuts?: boolean;
  /** 是否启用导出能力（默认 true） */
  enableExport?: boolean;
  /** 是否启用网格背景（默认 true） */
  enableBackground?: boolean;
  /**
   * 按节点 type 定制节点表单渲染（formMeta.render）。
   * 返回 null/undefined 时回落默认 title/content 表单。
   * 渲染函数内可用 useNodeRender() 拿当前 node，用于读取执行状态做高亮。
   */
  defaultFormMeta?: (type: string) =>
    | { formMeta?: { render: () => ReactNode } }
    | null
    | undefined;
  /** 定制默认节点渲染组件（缺省用 BaseNode）。 */
  renderDefaultNode?: typeof BaseNode;
}

export function buildEditorProps(
  initialData: FlowDocumentJSON,
  nodeRegistries: FlowNodeRegistry[],
  onChange?: (json: FlowDocumentJSON) => void
): FixedLayoutProps {
  return buildEditorPropsWith({
    initialData,
    nodeRegistries,
    onChange,
    enableShortcuts: true,
    enableExport: true,
    enableBackground: true,
  });
}

/**
 * 完整版 buildEditorProps，支持精细开关。
 * v1.4 R1.5 Sprint 1 新增。
 */
export function buildEditorPropsWith(
  opts: BuildEditorPropsOptions
): FixedLayoutProps {
  const {
    initialData,
    nodeRegistries,
    onChange,
    enableShortcuts = true,
    enableExport = true,
    enableBackground = true,
    defaultFormMeta,
    renderDefaultNode,
  } = opts;

  return {
    background: true,
    readonly: false,
    initialData,
    nodeRegistries,
    getNodeDefaultRegistry(type) {
      const override = defaultFormMeta?.(String(type));
      if (override?.formMeta) {
        return {
          type,
          meta: { defaultExpanded: true },
          formMeta: override.formMeta,
        };
      }
      return {
        type,
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
      };
    },
    materials: {
      components: {
        ...defaultFixedSemiMaterials,
        [FlowRendererKey.ADDER]: NodeAdder,
        [FlowRendererKey.BRANCH_ADDER]: BranchAdder,
        [FlowRendererKey.SLOT_ADDER]: SlotAdder,
      },
      renderDefaultNode: renderDefaultNode ?? BaseNode,
      renderTexts: {
        [FlowTextKey.LOOP_END_TEXT]: 'loop end',
        [FlowTextKey.LOOP_TRAVERSE_TEXT]: 'looping',
      },
    },
    dragdrop: {
      onDrop: () => undefined,
      canDrop: () => true,
    },
    nodeEngine: { enable: true },
    history: {
      enable: true,
      enableChangeNode: true,
      onApply(ctx, opt) {
        try {
          if (ctx?.document && typeof ctx.document.toJSON === 'function') {
            const json = ctx.document.toJSON();
            onChange?.(json as FlowDocumentJSON);
          }
        } catch (err) {
          console.warn('[FlowgramEditor] history.onApply failed', err);
        }
        console.log('auto apply:', opt);
      },
    },
    onInit: () => {
      // Playground init
    },
    onAllLayersRendered: (ctx) => {
      setTimeout(() => {
        try {
          ctx.playground.config.fitView(ctx.document.root.bounds.pad(30));
        } catch (err) {
          console.warn('[FlowgramEditor] fitView failed', err);
        }
      }, 10);
    },
    onDispose: () => {
      console.log('---- Playground Dispose ----');
    },
    fromNodeJSON(node, json) {
      void node;
      return json;
    },
    toNodeJSON(node, json) {
      void node;
      return json;
    },
    plugins: () => {
      const plugins: any[] = [
        // === minimap === (dark theme 适配)
        createMinimapPlugin({
          disableLayer: true,
          enableDisplayAllNodes: true,
          canvasStyle: {
            canvasWidth: 182,
            canvasHeight: 102,
            canvasPadding: 50,
            canvasBackground: 'rgba(17, 17, 17, 1)',
            canvasBorderRadius: 10,
            viewportBackground: 'rgba(38, 38, 38, 1)',
            viewportBorderRadius: 4,
            viewportBorderColor: 'rgba(82, 82, 91, 1)',
            viewportBorderWidth: 1,
            viewportBorderDashLength: 2,
            nodeColor: 'rgba(250, 250, 250, 0.7)',
            nodeBorderRadius: 2,
            nodeBorderWidth: 0.145,
            nodeBorderColor: 'rgba(6, 7, 9, 0.10)',
            overlayColor: 'rgba(255, 255, 255, 0)',
          },
        }),
      ];

      // === background 网格 + Logo ===
      if (enableBackground) {
        try {
          plugins.push(
            createBackgroundPlugin({
              backgroundColor: 'transparent',
              dotColor: '#404040',
              dotSize: 1,
              gridSize: 20,
              dotOpacity: 0.6,
            })
          );
        } catch (err) {
          console.warn('[FlowgramEditor] background plugin load failed', err);
        }
      }

      // === export JSON / YAML / PNG / JPEG / SVG ===
      if (enableExport) {
        try {
          plugins.push(
            createDownloadPlugin({
              getFilename: (format: FlowDownloadFormat) => {
                const ext =
                  format === FlowDownloadFormat.JSON
                    ? 'json'
                    : format === FlowDownloadFormat.YAML
                      ? 'yaml'
                      : format === FlowDownloadFormat.SVG
                        ? 'svg'
                        : format === FlowDownloadFormat.JPEG
                          ? 'jpg'
                          : 'png';
                return `mate-flowgram-${Date.now()}.${ext}`;
              },
            })
          );
        } catch (err) {
          console.warn('[FlowgramEditor] export plugin load failed', err);
        }
      }

      // === shortcuts Cmd/Ctrl+Z/Y ===
      if (enableShortcuts) {
        try {
          plugins.push(
            createShortcutsPlugin({
              registerShortcuts() {
                // 撤销 / 重做由 history 插件自身支持，这里只注册扩展占位
                // 完整快捷键（Delete/C/Ctrl+S/Backspace 等）由 Tools 按钮与 keydown 监听实现
              },
            })
          );
        } catch (err) {
          console.warn('[FlowgramEditor] shortcuts plugin load failed', err);
        }
      }

      // 注：free-hover-plugin 必须配合 free-layout-editor 才能工作（依赖 WorkflowDocument
      // 服务绑定），不能在 fixed-layout 模式下使用 —— 会抛 "No matching bindings found for
      // serviceIdentifier: WorkflowDocument"。如需 hover 高亮，fixed-layout 默认已支持。

      return plugins;
    },
  };
}