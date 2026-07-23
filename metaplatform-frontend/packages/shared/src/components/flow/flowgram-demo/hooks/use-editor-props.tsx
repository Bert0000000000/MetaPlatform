/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 把官方 demo 的 useEditorProps 重写为纯函数 buildEditorProps，
 * 把 initialData / nodeRegistries / onChange 注入到 FlowGram FixedLayoutProps。
 */
import { createMinimapPlugin } from '@flowgram.ai/minimap-plugin';
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

export function buildEditorProps(
  initialData: FlowDocumentJSON,
  nodeRegistries: FlowNodeRegistry[],
  onChange?: (json: FlowDocumentJSON) => void
): FixedLayoutProps {
  return {
    background: true,
    readonly: false,
    initialData,
    nodeRegistries,
    getNodeDefaultRegistry(type) {
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
      renderDefaultNode: BaseNode,
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
        // 整文档级 undo / redo / 自动保存：把最新文档 onChange 到上层。
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
    onInit: (ctx) => {
      console.log('---- Playground Init ----');
    },
    onAllLayersRendered: (ctx) => {
      setTimeout(() => {
        try {
          ctx.playground.config.fitView(ctx.document.root.bounds.pad(30));
        } catch (err) {
          // 老版本 API 不一致时不报错
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
    plugins: () => [
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
    ],
  };
}
