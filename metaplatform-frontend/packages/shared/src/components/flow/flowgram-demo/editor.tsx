/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate 内部封装 - 基于 FlowGram.AI 官方 fixed-layout-simple demo。
 * 把 editor.tsx 抽出来作为一个简单的 `<FlowgramEditor />` 容器。
 */
import React from 'react';
import {
  FixedLayoutEditorProvider,
  EditorRenderer,
  type FlowDocumentJSON,
  type FlowNodeRegistry,
} from '@flowgram.ai/fixed-layout-editor';

import '@flowgram.ai/fixed-layout-editor/index.css';
import './index.css';

import { buildEditorProps } from './hooks/use-editor-props';
import { Tools } from './components/tools';
import { NodeAddPanel } from './components/node-add-panel';
import { Minimap } from './components/minimap';
import { FlowSelect } from './components/flow-select';

export interface FlowgramEditorProps {
  initialData: FlowDocumentJSON;
  nodeRegistries?: FlowNodeRegistry[];
  /**
   * 节点库分组。默认按 type 前缀拆为 "审批流" (bpmn*) / "AI 协作流" (agent*) / "业务流程" (其它)
   */
  paletteGroups?: Array<{ key: string; label: string; registries: FlowNodeRegistry[] }>;
  /**
   * 切换 demo 时切换 initialData，dataKey 用 string 标识
   */
  dataKey?: string;
  /**
   * 是否隐藏顶部 / 底部全局控制条
   */
  hideTools?: boolean;
  /**
   * 是否隐藏左侧节点库面板
   */
  hidePalette?: boolean;
  /**
   * 暴露的回调：document 变化时拿到 FlowDocumentJSON
   */
  onChange?: (json: FlowDocumentJSON) => void;
  /**
   * demo 切换器选项；当存在时，默认会渲染顶部的 <FlowSelect />。
   * Mate admin/components 暂不展示这个 demo 切换器。
   */
  flowSelectOptions?: import('./components/flow-select').FlowSelectProps['options'];
}

/**
 * 默认的节点库分组拆分规则：按 type 前缀 / 业务关键字。
 */
function defaultPaletteGroups(registries: FlowNodeRegistry[]) {
  const groups: Record<string, FlowNodeRegistry[]> = {
    '审批流 (BPMN)': [],
    'AI 协作流 (Agent)': [],
    '业务流程': [],
  };
  for (const r of registries) {
    const t = String(r.type);
    if (t.startsWith('bpmn')) {
      groups['审批流 (BPMN)'].push(r);
    } else if (t.startsWith('agent')) {
      groups['AI 协作流 (Agent)'].push(r);
    } else {
      groups['业务流程'].push(r);
    }
  }
  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, regs], i) => ({ key: `pg-${i}`, label, registries: regs }));
}

export const FlowgramEditor: React.FC<FlowgramEditorProps> = (props) => {
  const {
    initialData,
    nodeRegistries = [],
    paletteGroups,
    hideTools,
    hidePalette,
    onChange,
  } = props;
  const editorProps = React.useMemo(
    () => buildEditorProps(initialData, nodeRegistries, onChange),
    [initialData, nodeRegistries, onChange]
  );
  const groups = React.useMemo(
    () =>
      paletteGroups && paletteGroups.length > 0
        ? paletteGroups
        : defaultPaletteGroups(nodeRegistries),
    [paletteGroups, nodeRegistries]
  );
  return (
    <FixedLayoutEditorProvider {...editorProps}>
      <div className="demo-fixed-container">
        <div className="demo-fixed-layout">
          {!hidePalette && !hideTools ? (
            <NodeAddPanel categories={groups} />
          ) : null}
          <EditorRenderer className="demo-fixed-editor">{/* 子级面板位置 */}</EditorRenderer>
        </div>
      </div>
      {!hideTools ? (
        <>
          <Tools />
          {props.flowSelectOptions && props.flowSelectOptions.length > 0 ? (
            <FlowSelect options={props.flowSelectOptions} />
          ) : null}
          <Minimap />
        </>
      ) : null}
    </FixedLayoutEditorProvider>
  );
};

export default FlowgramEditor;
