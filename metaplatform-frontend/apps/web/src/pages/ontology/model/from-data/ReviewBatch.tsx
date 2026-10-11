import { useState } from 'react';
import { Button, Checkbox, Modal, Tag } from '@douyinfe/semi-ui';
import type { ModelingDraft } from '@/api/ont/modeling';
import { classReviewed, classReviewProblem, confirmCandidates, included, relationshipReviewed, relationshipReviewProblem, type ReviewKind } from './review';

export default function ReviewBatch({ draft, kind, onChange }: { draft: ModelingDraft; kind: ReviewKind; onChange: (draft: ModelingDraft) => void }) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const items = draft[kind].filter(included);
  const label = kind === 'classes' ? '对象' : '关系';
  const rows = items.map(item => {
    const cls = kind === 'classes' ? draft.classes.find(c => c.id === item.id) : undefined;
    const rel = kind === 'relationships' ? draft.relationships.find(r => r.id === item.id) : undefined;
    return { id: item.id, name: item.name,
      problem: cls ? classReviewProblem(cls, draft) : relationshipReviewProblem(rel!, draft),
      rule: cls ? cls.identity.map(id => cls.properties.find(p => p.id === id)?.name ?? id).join(' + ') || '身份明确未确定' : `${rel?.cardinality ?? '基数未确定'} · ${rel?.targetSelection === 'entity' ? '单个业务实体' : '匹配目标集合'}`,
      reason: cls ? cls.identityReason || '按来源记录识别，不能跨文件合并' : rel?.cardinalityReason || '未填写基数依据',
      reviewed: cls ? classReviewed(cls) && !classReviewProblem(cls, draft) : relationshipReviewed(rel!) && !relationshipReviewProblem(rel!, draft),
    };
  });
  return <div className="fd-batch-review" role="group" aria-label={`${label}批量审核`}>
    <span className="mp-onto-muted" role="status">{label}已确认 {rows.filter(r => r.reviewed).length} / {items.length}</span>
    <Button size="small" disabled={!items.length || rows.every(r => r.reviewed)} onClick={() => { setSelected(rows.filter(r => !r.problem && !r.reviewed).map(r => r.id)); setVisible(true); }}>全部确认{label}</Button>
    <Button size="small" theme="borderless" disabled={!rows.some(r => r.reviewed)} onClick={() => { const next = structuredClone(draft); next[kind].forEach(item => { item.accepted = false; }); onChange(next); }}>取消确认{label}</Button>
    <Modal className="fd-batch-modal" centered width="min(960px, calc(100vw - 32px))" title={`批量审核${label}${kind === 'classes' ? '及身份' : '及基数'}`} visible={visible} okText={`确认所选 ${selected.length} 项`} okButtonProps={{ disabled: !selected.length, 'aria-label': `确认所选 ${selected.length} 项` }} cancelText="取消" onCancel={() => setVisible(false)} onOk={() => { onChange(confirmCandidates(draft, kind, selected)); setVisible(false); }}>
      <div className="fd-batch-intro"><p>核对{kind === 'classes' ? '身份规则' : '关系基数'}及依据后确认，缺少依据的项需先完善。</p><span>共 {rows.length} 项 · 已选 {selected.length} 项</span></div>
      <div className="fd-batch-table-scroll" tabIndex={0} role="region" aria-label={`${label}审核列表`}><table className="fd-table fd-batch-table"><colgroup><col className="fd-batch-check-col" /><col className="fd-batch-name-col" /><col /><col className="fd-batch-status-col" /></colgroup><thead><tr><th>选择</th><th>候选{label}</th><th>规则与依据</th><th>审核状态</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
        <td><Checkbox aria-label={`批量选择 ${row.name}`} disabled={Boolean(row.problem)} checked={selected.includes(row.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} /></td>
        <td className="fd-batch-name">{row.name}</td><td><div className="fd-batch-rule">{row.rule}</div><p className="fd-batch-reason">{row.reason}</p>{row.problem && <p className="fd-batch-problem">{row.problem}</p>}</td><td><Tag color={row.problem ? 'orange' : row.reviewed ? 'green' : 'grey'} type="light">{row.problem ? '需完善' : row.reviewed ? '已确认' : '可确认'}</Tag></td>
      </tr>)}</tbody></table></div>
    </Modal>
  </div>;
}
