// TypeManagementTab —— "类型管理" tab 的子导航（对象/关系/动作/接口四合一）。
// 类型层四类 Kernel 基元（ObjectType / LinkType / ActionType / Interface）统一入口，
// 避免四个一级 tab 语义重复。对象类型（OntologyModelingPage）内容最重，
// 作为默认子 tab 直接挂载；关系/动作/接口是轻量列表页，按需挂载。

import { useState, type CSSProperties, type ReactNode } from 'react';
import RelationshipTypeListPage from './relationship-types/RelationshipTypeListPage';
import ActionTypeListPage from './actions/ActionTypeListPage';
import InterfaceListPage from './InterfaceListPage';

export interface TypeManagementTabProps {
  initialSub?: string;
  /** 概念模型页的受控 props（ShellPage 管理刷新 key 和新建 drawer 状态） */
  conceptNode: ReactNode;
}

type SubKey = 'object' | 'relationship' | 'action' | 'interface';

const SUB_LABELS: Record<SubKey, string> = {
  object: '对象类型',
  relationship: '关系类型',
  action: '动作类型',
  interface: '接口契约',
};

const SUB_KEYS = Object.keys(SUB_LABELS) as SubKey[];

const BTN_BASE: CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function normalizeSub(raw: string | undefined): SubKey {
  return SUB_KEYS.includes(raw as SubKey) ? (raw as SubKey) : 'object';
}

export default function TypeManagementTab({
  initialSub,
  conceptNode,
}: TypeManagementTabProps) {
  const [sub, setSub] = useState<SubKey>(normalizeSub(initialSub));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        {SUB_KEYS.map((k) => (
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {sub === 'object' && conceptNode}
        {sub === 'relationship' && <RelationshipTypeListPage />}
        {sub === 'action' && <ActionTypeListPage />}
        {sub === 'interface' && <InterfaceListPage />}
      </div>
    </div>
  );
}
