import { useState } from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';
import type { ModelingClass, ModelingDraft, ModelingProfile } from '@/api/ont/modeling';
import { applyParent } from './hierarchy';

export default function ParentIdentityRepair({ cls, draft, profile, locked, onChange }: {
  cls: ModelingClass; draft: ModelingDraft; profile: ModelingProfile; locked: boolean; onChange: (draft: ModelingDraft) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [bindings, setBindings] = useState<Record<string, Record<string, string>>>({});
  const parent = draft.classes.find(c => c.id === cls.parentClassId);
  if (!parent || JSON.stringify(cls.identity) === JSON.stringify(parent.identity)) return null;
  const mappings = draft.mappings.filter(m => m.classId === cls.id);
  const names = parent.identity.map(id => parent.properties.find(p => p.id === id)?.name ?? id).join(' + ');
  const complete = parent.identity.length > 0 && parent.identity.every(id => parent.properties.some(p => p.id === id))
    && mappings.every(m => parent.identity.every(id => Boolean(bindings[m.id]?.[id])));
  const open = () => {
    const next: typeof bindings = {};
    for (const mapping of mappings) {
      const columns = profile.sheets.find(s => s.name === mapping.sheet)?.columns.map(c => c.name) ?? [];
      next[mapping.id] = {};
      for (const id of parent.identity) {
        // A single previous identity is only a suggestion, explicitly reviewed in this dialog.
        const column = mapping.bindings[id] || (parent.identity.length === 1 && cls.identity.length === 1 ? mapping.bindings[cls.identity[0]] : '');
        next[mapping.id][id] = columns.includes(column) ? column : '';
      }
    }
    setBindings(next); setVisible(true);
  };
  return <div className="fd-parent-identity-repair">
    <span>父类“{parent.name}”使用 {names || '尚未确定的身份'}；当前子类身份与父类不一致。</span>
    <Button size="small" disabled={locked || !parent.identity.length} onClick={open}>沿用父类身份</Button>
    <Modal title="沿用父类身份" visible={visible} centered width="min(680px, calc(100vw - 32px))" bodyStyle={{ maxHeight: 'calc(100dvh - 240px)', overflow: 'auto' }} okText="应用并重新审核" okButtonProps={{ disabled: !complete, 'aria-label': '应用并重新审核' }} cancelText="取消" onCancel={() => setVisible(false)} onOk={() => {
      const next = structuredClone(draft);
      applyParent(next, cls.id, parent.id);
      for (const mapping of next.mappings.filter(m => m.classId === cls.id)) Object.assign(mapping.bindings, bindings[mapping.id]);
      onChange(next); setVisible(false);
    }}>
      <div className="fd-page"><p>“{cls.name}”将沿用“{parent.name}”的身份：<strong>{names}</strong>。原有属性保留，请确认下列来源列表示同一个业务身份。</p>
        {mappings.map(mapping => <div key={mapping.id} className="fd-card"><strong>{mapping.sheet}</strong>{parent.identity.map(id => <label key={id}>{parent.properties.find(p => p.id === id)?.name ?? id} 对应来源列
          <select aria-label={`${mapping.id} ${id} 对应来源列`} value={bindings[mapping.id]?.[id] ?? ''} onChange={e => setBindings(current => ({ ...current, [mapping.id]: { ...current[mapping.id], [id]: e.target.value } }))}><option value="">请选择来源列</option>{profile.sheets.find(s => s.name === mapping.sheet)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
        </label>)}</div>)}
        {!mappings.length && <p>当前子类没有数据映射，接入数据前需补充身份字段映射。</p>}
        <p className="mp-onto-muted">子类及后代将补齐父类属性，并取消相关对象、关系、映射和语义确认。请重新核对身份依据及关联字段，保存后重新校验。</p>
      </div>
    </Modal>
  </div>;
}
