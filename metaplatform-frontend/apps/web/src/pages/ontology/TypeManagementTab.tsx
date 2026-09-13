// TypeManagementTab —— "类型管理" tab 的子导航（对象/关系/动作三合一）。
// 原"概念模型"/"关系类型"/"动作类型"三个一级 tab 合并为一个，减少 tab 拥挤。
// 概念模型（OntologyModelingPage）内容最重，作为默认子 tab 直接挂载；
// 关系/动作 tab 是轻量列表页，按需挂载。

import { useState, type CSSProperties, type ReactNode } from 'react';
import RelationshipTypeListPage from './relationship-types/RelationshipTypeListPage';
import ActionTypeListPage from './actions/ActionTypeListPage';

export interface TypeManagementTabProps {
  initialSub?: string;
  /** 概念模型页的受控 props（ShellPage 管理刷新 key 和新建 drawer 状态） */
  conceptNode: ReactNode;
}

type SubKey = 'object' | 'relationship' | 'action';

const SUB_LABELS: Record<SubKey, string> = {
  object: '对象类型',
  relationship: '关系类型',
  action: '动作类型',
};

const BTN_BASE: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default function TypeManagementTab({
  initialSub,
  conceptNode,
}: TypeManagementTabProps) {
  const [sub, setSub] = useState<SubKey>(
    initialSub === 'relationship' ? 'relationship' : initialSub === 'action' ? 'action' : 'object',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        {(Object.keys(SUB_LABELS) as SubKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            style={{
              ...BTN_BASE,
              background: sub === k ? 'var(--foreground)' : 'var(--card)',
              color: sub === k ? 'var(--background)' : 'var(--muted-foreground)',
              fontWeight: sub === k ? 600 : 400,
            }}
          >
            {SUB_LABELS[k]}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {sub === 'object' && conceptNode}
        {sub === 'relationship' && <RelationshipTypeListPage />}
        {sub === 'action' && <ActionTypeListPage />}
      </div>
    </div>
  );
}
