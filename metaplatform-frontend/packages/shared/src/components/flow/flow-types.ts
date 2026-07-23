/**
 * FlowCanvas 业务模型
 * --------------------------------------------------
 * 对外暴露 { nodes, edges } 业务模型，
 * 内部由 flow/utils/adapter.ts 转换为 FlowGram.AI fixed-layout JSON。
 *
 * 参考 FlowGram materials（https://flowgram.ai/materials/introduction.html）
 * 的 "Material = 渲染组件 + 表单 + 图标 + 元数据" 思路。
 */

import type { ComponentType } from 'react';

export interface FlowNode<T = unknown> {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  data?: T;
}

export interface FlowEdge<T = unknown> {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  label?: string;
  data?: T;
}

export interface FlowData<N = unknown, E = unknown> {
  nodes: FlowNode<N>[];
  edges: FlowEdge<E>[];
}

export type FlowFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'json'
  | 'variable'
  | 'condition'
  | 'boolean';

export interface FlowNodeFormField {
  key: string;
  label: string;
  type: FlowFieldType;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface FlowNodeMaterial<T = unknown> {
  type: string;
  name: string;
  category: string;
  icon?: ComponentType<{ size?: number }>;
  component: ComponentType<{
    node: FlowNode<T>;
    selected: boolean;
  }>;
  form?: ComponentType<{
    node: FlowNode<T>;
    onChange: (patch: Partial<FlowNode<T>>) => void;
  }>;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  fields?: FlowNodeFormField[];
  defaultData?: T;
}

export interface FlowPaletteCategory {
  key: string;
  label: string;
  items: FlowNodeMaterial[];
}

export type ThemeModeSetting = 'light' | 'dark' | 'auto';
export type ResolvedThemeMode = 'light' | 'dark';
