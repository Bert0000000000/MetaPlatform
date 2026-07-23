/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 把 FlowGram 官方 demo 里的 condition / custom / break 这类通用容器节点，
 * 与我们业务侧 BPMN / Agent / 业务节点合并成一个统一的 `nodeRegistries`，
 * 供 demo editor / NodeAdder 共享。
 */
import { nanoid } from 'nanoid';
import type { FlowNodeRegistry } from '@flowgram.ai/fixed-layout-editor';
import { ALL_NODE_REGISTRIES } from '../node-registries';

// ---------------- FlowGram 官方 demo 的通用容器 ---------------- //

const CONDITION: FlowNodeRegistry = {
  type: 'condition',
  extend: 'dynamicSplit',
  meta: {},
  onAdd: () => ({
    id: `condition_${nanoid(5)}`,
    type: 'condition',
    data: { title: 'Condition' },
    blocks: [
      { id: nanoid(5), type: 'block', data: { title: 'If_0' } },
      { id: nanoid(5), type: 'block', data: { title: 'If_1' } },
    ],
  }),
};

const CUSTOM: FlowNodeRegistry = {
  type: 'custom',
  meta: {},
  onAdd: () => ({
    id: `custom_${nanoid(5)}`,
    type: 'custom',
    data: { title: 'Custom', content: 'this is custom content' },
  }),
};

const OFFICIAL_REGISTRIES: FlowNodeRegistry[] = [CONDITION, CUSTOM];

export const nodeRegistries: FlowNodeRegistry[] = [
  ...OFFICIAL_REGISTRIES,
  ...ALL_NODE_REGISTRIES,
];

export { ALL_NODE_REGISTRIES } from '../node-registries';
