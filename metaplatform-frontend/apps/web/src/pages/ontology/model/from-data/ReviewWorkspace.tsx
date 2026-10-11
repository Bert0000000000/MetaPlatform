import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Checkbox, Input, Tag } from '@douyinfe/semi-ui';
import { Plus, Search } from 'lucide-react';
import { SheetDetail } from '@/components/skeleton';
import Details, { uniqueId, type DraftEditorProps } from './DraftEditorDetails';
import ReviewBatch from './ReviewBatch';
import { relationshipRepair } from './relationshipReadiness';
import { hierarchyRows } from './hierarchy';
import { classReviewed, classReviewProblem, confirmCandidates, included, relationshipReviewed, relationshipReviewProblem } from './review';

type Kind = 'classes' | 'relationships' | 'mappings';
type Filter = 'all' | 'pending' | 'confirmed' | 'deferred';
const labels: Record<Kind, string> = { classes: '对象类型', relationships: '业务关系', mappings: '数据映射' };
const filterLabels: Record<Filter, string> = { all: '全部', pending: '待审核', confirmed: '已确认', deferred: '暂缓' };

export default function ReviewWorkspace(props: DraftEditorProps & { focusClassId?: string | null; disabled?: boolean }) {
  const { draft, profile, resolutions, identityLocked, disabled } = props;
  const [kind, setKind] = useState<Kind>('classes');
  const [filter, setFilter] = useState<Filter>(() => draft.classes.some(c => included(c) && !classReviewed(c)) ? 'pending' : 'all');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<DraftEditorProps['selection']>();
  const change = (next: typeof draft) => { if (!disabled) props.onChange(next); };
  const incompleteRelations = draft.relationships.filter(r => {
    if (!included(r)) return false;
    const state = relationshipRepair(r, draft);
    return !state.valid.length || state.valid.length !== r.joins.length || (r.targetSelection === 'entity' && !state.complete);
  });
  useEffect(() => {
    if (props.focusClassId) { const targetKind = props.focusClassId.startsWith('fd-relation-') ? 'relationships' : props.focusClassId.startsWith('fd-mapping-') ? 'mappings' : 'classes'; setKind(targetKind); setFilter('all'); setQuery(''); setSelection({ kind: targetKind, id: props.focusClassId.replace(/^fd-(class|relation|mapping)-/, '') }); }
  }, [props.focusClassId]);
  useEffect(() => {
    if (!props.focusClassId || !selection) return;
    const timer = window.setTimeout(() => document.getElementById(props.focusClassId!)?.focus({ preventScroll: true }), 100);
    return () => window.clearTimeout(timer);
  }, [props.focusClassId, selection]);
  const className = (id: string) => draft.classes.find(c => c.id === id)?.name ?? id;
  const rows = kind === 'classes' ? draft.classes.map(c => ({ id: c.id, name: c.name, scoped: included(c), reviewed: classReviewed(c), problem: included(c) ? classReviewProblem(c, draft) : '', summary: c.parentClassId ? `是一种 ${className(c.parentClassId)}` : '独立类', detail: c.identity.map(id => c.properties.find(p => p.id === id)?.name ?? id).join(' + ') || (c.identityStatus === 'unresolved' ? '身份待确定 · 来源记录' : '按来源记录识别'), count: `${c.properties.length} 个属性`, mode: { new: '新建', reuse: '复用', extend: '扩展' }[resolutions[c.id]?.mode ?? 'new'] }))
    : kind === 'relationships' ? draft.relationships.map(r => ({ id: r.id, name: r.name, scoped: included(r), reviewed: relationshipReviewed(r) && !relationshipReviewProblem(r, draft), problem: included(r) ? relationshipReviewProblem(r, draft) : '', summary: `${className(r.source)} → ${className(r.target)}`, detail: r.cardinality ?? '基数待确定', count: `${r.joins.length} 个关联条件`, mode: r.targetSelection === 'group' ? '目标集合' : r.targetSelection === 'entity' ? '单个实体' : '选择方式待确认' }))
      : draft.mappings.map(m => ({ id: m.id, name: `${m.sheet} → ${className(m.classId)}`, scoped: included(draft.classes.find(c => c.id === m.classId) ?? {}), reviewed: m.accepted, problem: !draft.classes.some(c => c.id === m.classId) ? '目标对象不存在' : !profile.sheets.some(s => s.name === m.sheet) ? '来源工作表不存在' : '', summary: m.sheet, detail: className(m.classId), count: `${Object.keys(m.bindings).length} 个字段绑定`, mode: '数据接入' }));
  const matches = rows.filter(row => {
    if (!`${row.name} ${row.id} ${row.summary}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'deferred') return !row.scoped;
    return row.scoped && (filter === 'confirmed' ? row.reviewed && !row.problem : !row.reviewed || Boolean(row.problem));
  });
  const pendingClasses = draft.classes.filter(c => included(c) && (!classReviewed(c) || classReviewProblem(c, draft))).length;
  const pendingRelations = draft.relationships.filter(r => included(r) && (!relationshipReviewed(r) || relationshipReviewProblem(r, draft))).length;
  const pendingMappings = draft.mappings.filter(m => included(draft.classes.find(c => c.id === m.classId) ?? {}) && !m.accepted).length;
  const deferred = [...draft.classes, ...draft.relationships].filter(c => !included(c)).length;
  const selectedName = selection?.kind === 'semantics' ? '业务语义' : selection ? (selection.kind === 'classes' ? className(selection.id) : selection.kind === 'relationships' ? draft.relationships.find(r => r.id === selection.id)?.name : draft.mappings.find(m => m.id === selection.id)?.sheet) : '';
  const selectKind = (next: Kind) => { setKind(next); setQuery(''); setFilter('all'); setSelection(undefined); };
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = Object.keys(labels) as Kind[];
    const index = keys.indexOf(kind);
    const next = event.key === 'ArrowRight' ? (index + 1) % keys.length : event.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length : event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); selectKind(keys[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  };
  const add = () => {
    const next = structuredClone(draft);
    let id: string;
    if (kind === 'classes') { id = uniqueId('concept', next.classes.map(c => c.id)); next.classes.push({ id, name: '新业务对象', description: '', properties: [{ id: 'code', name: '编码', dataType: 'text' }], identity: ['code'], labelProperty: 'code', accepted: false, identityStatus: 'proposed', identityCandidate: ['code'] }); }
    else if (kind === 'relationships') { id = uniqueId('relation', next.relationships.map(r => r.id)); const cls = next.classes[0]; next.relationships.push({ id, name: '关联', source: cls.id, target: cls.id, joins: [{ sourceProperty: cls.properties[0].id, targetProperty: cls.properties[0].id }], reason: '', accepted: false, cardinalityStatus: 'proposed', targetSelection: 'entity', cardinality: 'N:N' }); }
    else { id = uniqueId('mapping', next.mappings.map(m => m.id)); next.mappings.push({ id, classId: next.classes[0].id, sheet: profile.sheets[0]?.name ?? '', bindings: {}, reason: '', accepted: false }); }
    change(next); setSelection({ kind, id });
  };
  return <div className="fd-review-workspace">
    <section className="fd-review-overview" aria-label="审核进度">
      <div><Tag color={identityLocked ? 'green' : 'blue'}>{identityLocked ? '已有发布结果' : '候选审核'}</Tag><strong>{draft.classes.filter(included).length} 个对象 · {draft.relationships.filter(included).length} 条关系</strong></div>
      <span>待审核对象 {pendingClasses} 项 · 待审核关系 {pendingRelations} 项 · 待审核映射 {pendingMappings} 项 · 暂缓 {deferred} 项</span>
      {identityLocked ? <p>稳定标识与发布范围已锁定。后续增量请另建候选并复用已发布类型；正式身份变更需走平台迁移。</p> : <p>核对业务规则与依据后确认；修改后需保存并重新校验。</p>}
    </section>
    {!!incompleteRelations.length && <div className="fd-relationship-repair" role="status"><strong>{incompleteRelations.length} 条关系需要补充关联字段</strong><p>请先完善字段映射或暂不发布这些关系，再进行确认。其他有效对象和关系可以继续审核。</p><Button size="small" onClick={() => { setKind('relationships'); setFilter('pending'); setQuery(''); setSelection({ kind: 'relationships', id: incompleteRelations[0].id }); }}>处理关联字段</Button></div>}
    <section className="fd-review-list">
      <div className="fd-review-tabs" role="tablist" aria-label="候选审核分类">{(Object.keys(labels) as Kind[]).map(key => <button type="button" role="tab" key={key} id={`fd-review-tab-${key}`} tabIndex={kind === key ? 0 : -1} aria-selected={kind === key} aria-controls="fd-review-panel" onKeyDown={moveTab} onClick={() => selectKind(key)}>{labels[key]}<span>{draft[key].length}</span></button>)}</div>
      <div className="fd-review-toolbar">
        <Input aria-label="搜索候选" prefix={<Search size={15} />} placeholder={`搜索${labels[kind]}名称或标识`} value={query} onChange={setQuery} showClear />
        <div className="fd-review-filters" role="group" aria-label="审核状态筛选">{(Object.keys(filterLabels) as Filter[]).map(key => <Button key={key} size="small" theme={filter === key ? 'light' : 'borderless'} type={filter === key ? 'primary' : 'tertiary'} aria-pressed={filter === key} onClick={() => setFilter(key)}>{filterLabels[key]}</Button>)}</div>
        <Button icon={<Plus size={14} />} disabled={disabled || (identityLocked && kind !== 'mappings') || (kind !== 'classes' && !draft.classes[0]?.properties.length)} onClick={add}>添加{kind === 'relationships' ? '关系' : kind === 'mappings' ? '映射' : '对象类型'}</Button>
      </div>
      <div className="fd-review-batch">{kind !== 'mappings' ? <ReviewBatch draft={draft} kind={kind} onChange={change} /> : <><span>映射已确认 {draft.mappings.filter(m => m.accepted).length} / {draft.mappings.length}</span><Button size="small" disabled={!draft.mappings.length} onClick={() => { const next = structuredClone(draft); next.mappings.forEach(m => { m.accepted = true; }); change(next); }}>全部确认映射</Button><Button size="small" theme="borderless" onClick={() => { const next = structuredClone(draft); next.mappings.forEach(m => { m.accepted = false; }); change(next); }}>取消确认映射</Button></>}</div>
      <div id="fd-review-panel" role="tabpanel" aria-labelledby={`fd-review-tab-${kind}`} className="fd-table-scroll"><table className="fd-table fd-review-table"><thead><tr><th>{kind === 'mappings' ? '来源 → 目标' : labels[kind]}</th><th>{kind === 'classes' ? '身份与属性' : kind === 'relationships' ? '关联规则' : '字段绑定'}</th><th>接入方式</th><th>审核状态</th><th>操作</th></tr></thead><tbody>{matches.map(row => <tr key={row.id} className={selection?.id === row.id && selection.kind === kind ? 'is-selected' : undefined}>
        <td><button type="button" className="fd-review-name" onClick={() => setSelection({ kind, id: row.id })}>{row.name}</button><small>{row.summary}</small></td>
        <td>{row.detail}<small>{row.count}</small></td><td>{row.mode}</td>
        <td><Tag size="small" color={!row.scoped ? 'grey' : row.problem ? 'orange' : row.reviewed ? 'green' : 'blue'}>{!row.scoped ? '暂缓' : row.problem ? '需处理' : row.reviewed ? '已确认' : '待审核'}</Tag>{row.problem && <p className="fd-review-problem">{row.problem}</p>}</td>
        <td><div className="fd-review-row-actions"><Button size="small" theme="borderless" aria-label={`审核${row.name}`} onClick={() => setSelection({ kind, id: row.id })}>查看详情</Button><Checkbox aria-label={`确认${kind === 'classes' ? '对象' : kind === 'relationships' ? '关系' : '映射'} ${row.name}`} checked={row.reviewed} disabled={disabled || !row.scoped || Boolean(row.problem)} onChange={e => { const next = e.target.checked && kind !== 'mappings' ? confirmCandidates(draft, kind, [row.id]) : structuredClone(draft); if (!e.target.checked || kind === 'mappings') next[kind].find(item => item.id === row.id)!.accepted = Boolean(e.target.checked); change(next); }}><span aria-hidden="true">确认</span><span className="fd-sr-only">确认{kind === "classes" ? "对象" : kind === "relationships" ? "关系" : "映射"} {row.name}</span></Checkbox></div></td>
      </tr>)}</tbody></table>{!matches.length && <div className="fd-review-empty">{rows.length ? '没有符合筛选条件的候选。' : `暂无${labels[kind]}。`}{rows.length > 0 && <Button theme="borderless" onClick={() => { setQuery(''); setFilter('all'); }}>查看全部</Button>}</div>}</div>
      <div className="fd-review-count">显示 {matches.length} / {rows.length} 项</div>
    </section>
    {kind === 'classes' && <details className="fd-review-supplement"><summary>查看概念层次</summary><ul className="fd-hierarchy">{hierarchyRows(draft.classes).map(({ cls, depth }) => <li key={cls.id} style={{ paddingInlineStart: depth * 20 }}><strong>{cls.name}</strong><Tag size="small">第 {depth + 1} 层</Tag>{cls.parentClassId && <span>是一种 {className(cls.parentClassId)}</span>}</li>)}</ul></details>}
    {(draft.semantics.definitions.length > 0 || draft.notes.length > 0) && <details className="fd-review-supplement"><summary>业务语义与补充建议</summary>{draft.semantics.definitions.length > 0 && <Button onClick={() => setSelection({ kind: 'semantics', id: 'all' })}>审核业务语义（{draft.semantics.definitions.length} 项）</Button>}<ul>{draft.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
    <SheetDetail title={`${selection?.kind === 'semantics' ? '' : '审核 · '}${selectedName ?? ''}`} open={Boolean(selection)} onClose={() => setSelection(undefined)} width={760} className="fd-review-sheet" footer={<div className="fd-review-sheet-footer"><span>修改保留在当前草稿，请保存后重新校验。</span><Button onClick={() => setSelection(undefined)}>完成查看</Button></div>}>
      {selection && <fieldset className="fd-fieldset fd-page" disabled={disabled}><Details {...props} onOpenClass={id => { setKind("classes"); setFilter("all"); setQuery(""); setSelection({ kind: "classes", id }); }} selection={selection} onChange={change} onResolve={(id, value) => { if (!disabled) props.onResolve(id, value); }} onRename={(value, resolved) => { if (!disabled) { props.onRename(value, resolved); const renamed = value.classes.find(c => !draft.classes.some(old => old.id === c.id)); if (renamed) setSelection({ kind: 'classes', id: renamed.id }); } }} /></fieldset>}
    </SheetDetail>
  </div>;
}
