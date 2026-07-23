/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Mate: 原生 select + 紫色 Active Theme。
 */
import { useEffect, useState } from 'react';
import { useClientContext, FlowLayoutDefault } from '@flowgram.ai/fixed-layout-editor';
import type { FlowDocumentJSON } from '@flowgram.ai/fixed-layout-editor';

export interface FlowSelectProps {
  /**
   * 业务侧提供的可选 demo 数据（与 palette categories 一一对应）；
   * key 用作 option value，value 是对应的 FlowDocumentJSON
   */
  options: Array<{ key: string; label: string; data: FlowDocumentJSON }>;
  /**
   * 当前选中的 key；受控可省略（内部默认 mode）
   */
  value?: string;
  onChange?: (key: string) => void;
  /**
   * 切换 option 时是否 fitView
   */
  fitViewOnChange?: boolean;
}

export function FlowSelect(props: FlowSelectProps) {
  const [demoKey, updateDemoKey] = useState<string>(props.value ?? props.options[0]?.key ?? '');
  const clientContext = useClientContext();

  useEffect(() => {
    if (props.value && props.value !== demoKey) {
      updateDemoKey(props.value);
    }
  }, [props.value]);

  useEffect(() => {
    if (!demoKey) return;
    const opt = props.options.find((o) => o.key === demoKey);
    if (!opt) return;
    clientContext.history.stop();
    clientContext.history.clear();
    clientContext.document.fromJSON(opt.data);
    clientContext.document.setLayout(FlowLayoutDefault.VERTICAL_FIXED_LAYOUT);
    clientContext.history.start();
    if (props.fitViewOnChange !== false) {
      setTimeout(() => {
        try {
          clientContext.playground.config.fitView(
            clientContext.document.root.bounds,
            true,
            40
          );
        } catch (err) {
          console.warn('[FlowSelect] fitView failed', err);
        }
      }, 20);
    }
  }, [demoKey]);

  return (
    <div style={{ position: 'absolute', zIndex: 100, top: 12, right: 12 }}>
      <label style={{ marginRight: 12, color: '#fff' }}>选择流程：</label>
      <select
        style={{
          width: 220,
          height: 32,
          fontSize: 14,
          background: 'rgba(15,15,20,0.7)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 6,
          padding: '0 8px',
        }}
        onChange={(e) => {
          updateDemoKey(e.target.value);
          props.onChange?.(e.target.value);
        }}
        value={demoKey}
      >
        {props.options.map((opt) => (
          <option key={opt.key} value={opt.key} style={{ background: '#1a1a1a' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
