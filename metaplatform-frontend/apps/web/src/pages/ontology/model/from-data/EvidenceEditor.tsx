import type { ModelingEvidence, ModelingProfile } from '@/api/ont/modeling';
import { Button } from '@douyinfe/semi-ui';
export default function EvidenceEditor({ evidence = [], profile, label, onChange }: { evidence?: ModelingEvidence[]; profile: ModelingProfile; label: string; onChange: (value: ModelingEvidence[]) => void }) {
  const edit = (i: number, patch: Partial<ModelingEvidence>) => onChange(evidence.map((item, n) => n === i ? { ...item, ...patch } : item));
  return <fieldset><legend>{label}证据</legend><p className="mp-onto-muted">来源统计只能作为证据，推断不等于业务确认。</p>{evidence.map((item, i) => <div className="fd-grid" key={i}>
    <label>证据类型<select aria-label={`${label}证据类型 ${i + 1}`} value={item.kind} onChange={e => edit(i, { kind: e.target.value as ModelingEvidence['kind'] })}><option value="source">来源数据</option><option value="business">业务依据</option><option value="inference">推断</option></select></label>
    <label>证据说明<textarea aria-label={`${label}证据说明 ${i + 1}`} value={item.detail} onChange={e => edit(i, { detail: e.target.value })} /></label>
    <label>引用工作表<select value={item.sheet} onChange={e => edit(i, { sheet: e.target.value, columns: [] })}><option value="">未引用</option>{profile.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
    <label>引用列<select multiple aria-label={`${label}证据引用列 ${i + 1}`} value={item.columns} onChange={e => edit(i, { columns: Array.from(e.target.selectedOptions, o => o.value) })}>{profile.sheets.find(s => s.name === item.sheet)?.columns.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
    <Button onClick={() => onChange(evidence.filter((_, n) => n !== i))}>删除证据</Button></div>)}<Button onClick={() => onChange([...evidence, { kind: 'inference', detail: '', sheet: '', columns: [] }])}>添加{label}证据</Button></fieldset>;
}
