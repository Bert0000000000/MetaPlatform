import { useState } from 'react';
import { Button, Checkbox, Modal, Tag } from '@douyinfe/semi-ui';
import { Plus, Trash2 } from 'lucide-react';
import type { KernelObjectType } from '@/api/ont/kernel';
import type { ModelingDraft, ModelingProfile, ModelingResolution } from '@/api/ont/modeling';
import IdentityReview from './IdentityReview';
import ReuseComparison from './ReuseComparison';
import ParentIdentityRepair from './ParentIdentityRepair';
import RelationshipReview from './RelationshipReview';
import RelationshipRepair from './RelationshipRepairPanel';
import { renameConcept } from './renameConcept';
import { applyParent, canSelectParent, hierarchyRows } from './hierarchy';
import ReviewBatch from './ReviewBatch';
import { relatedDefinitions, scopedDefinitions, semanticsReviewed, setSemanticConfirmation, invalidateSemanticChanges } from './review';
import { semanticFields, semanticLabels } from './SemanticSummary';
import { classReviewed, classReviewProblem, confirmCandidates, included, relationshipReviewed, relationshipReviewProblem, setIncluded, type ReviewKind } from './review';

export interface DraftEditorProps {
  onOpenClass?: (id: string) => void;
  selection?: { kind: "classes" | "relationships" | "mappings" | "semantics"; id: string };
  draft: ModelingDraft; profile: ModelingProfile; types: KernelObjectType[];
  resolutions: Record<string, ModelingResolution>;
  onChange: (draft: ModelingDraft) => void;
  onResolve: (classId: string, resolution: ModelingResolution) => void;
  onRename: (draft: ModelingDraft, resolutions: Record<string, ModelingResolution>) => void;
  identityLocked?: boolean;
  catalogStatus?: string;
}
export const uniqueId = (prefix: string, ids: string[]) => {
  let n = 1; while (ids.includes(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
};

function BatchReview({ name, total, confirmed, onChange }: { name: string; total: number; confirmed: number; onChange: (accepted: boolean) => void }) {
  return <div className="fd-batch-review" role="group" aria-label={`${name}批量审核`}>
    <span className="mp-onto-muted" role="status">{name}已确认 {confirmed} / {total}</span>
    <Button size="small" disabled={!total || confirmed === total} onClick={() => onChange(true)}>全部确认{name}</Button>
    <Button size="small" theme="borderless" disabled={!confirmed} onClick={() => onChange(false)}>取消确认{name}</Button>
  </div>;
}

export default function DraftEditor({ draft, profile, types, resolutions, onChange, onResolve, onRename, identityLocked = false, selection, onOpenClass, catalogStatus }: DraftEditorProps) {
  const [renaming, setRenaming] = useState<{ from: string; value: string } | null>(null);
  const [renameError, setRenameError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const changeScope = (kind: ReviewKind, id: string) => {
    const item = draft[kind].find(candidate => candidate.id === id)!;
    const next = setIncluded(draft, kind, id, !included(item));
    if (!included(item)) { onChange(next); return; }
    const affected = [...next.classes.filter(c => !included(c) && included(draft.classes.find(p => p.id === c.id)!)), ...next.relationships.filter(r => !included(r) && included(draft.relationships.find(p => p.id === r.id)!))];
    Modal.confirm({ title: '本次暂不发布？', content: `以下候选将保留在草稿，不进入本次生效模型：${affected.map(c => c.name).join('、')}。相关业务问题可能尚未覆盖。`, okText: '保留候选，暂不发布', okButtonProps: { 'aria-label': '保留候选，暂不发布' }, cancelText: '继续审核', onOk: () => onChange(next) });
  };
  const update = (fn: (value: ModelingDraft) => void) => {
    const next = structuredClone(draft); fn(next);
    for (const cls of next.classes) {
      const previous = draft.classes.find(item => item.id === cls.id);
      if (!previous) continue;
      const identityChanged = JSON.stringify(previous.identity) !== JSON.stringify(cls.identity)
        || previous.grain !== cls.grain
        || previous.identity.some(id => previous.properties.find(p => p.id === id)?.dataType !== cls.properties.find(p => p.id === id)?.dataType);
      if (cls.identityStatus === 'confirmed' && identityChanged) cls.identityStatus = 'proposed';
      const structureChanged = identityChanged || previous.parentClassId !== cls.parentClassId
        || JSON.stringify(previous.properties.map(p => [p.id, p.dataType])) !== JSON.stringify(cls.properties.map(p => [p.id, p.dataType]))
        || JSON.stringify(previous.uniqueKeys) !== JSON.stringify(cls.uniqueKeys);
      if (structureChanged) {
        for (const relation of next.relationships) if (relation.source === cls.id || relation.target === cls.id) {
          relation.accepted = false;
          if (identityChanged && relation.cardinalityStatus === 'confirmed') relation.cardinalityStatus = 'proposed';
        }
      }
    }
    for (const relation of next.relationships) {
      const previous = draft.relationships.find(item => item.id === relation.id);
      if (previous && relation.cardinalityStatus === 'confirmed'
        && (previous.source !== relation.source || previous.target !== relation.target || JSON.stringify(previous.joins) !== JSON.stringify(relation.joins))) {
        relation.cardinalityStatus = 'proposed';
      }
    }
    onChange(invalidateSemanticChanges(draft, next));
  };
  const definitions = selection && selection.kind !== 'semantics' ? relatedDefinitions(draft, selection.kind, selection.id) : scopedDefinitions(draft);
  const classOptions = draft.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>);
  return <div className="fd-editor">
    {!selection && <section className="fd-card" aria-label="审核进度"><strong>本次发布 {draft.classes.filter(included).length} 个对象、{draft.relationships.filter(included).length} 条关系</strong><p className="mp-onto-muted">确认包含身份或基数审核，修改需保存后生效。暂缓候选保留在草稿，对应业务问题可能尚未覆盖。</p><p>待审核对象 {draft.classes.filter(c => included(c) && !classReviewed(c)).length} 项 · 待审核关系 {draft.relationships.filter(r => included(r) && !relationshipReviewed(r)).length} 项 · 暂缓 {draft.classes.filter(c => !included(c)).length + draft.relationships.filter(r => !included(r)).length} 项</p></section>}
    <Modal title="修改候选对象的稳定标识" visible={Boolean(renaming)} okText="修改标识及引用" cancelText="取消" okButtonProps={{ 'aria-label': '修改标识及引用' }} cancelButtonProps={{ 'aria-label': '取消修改标识' }} onCancel={() => setRenaming(null)} onOk={() => {
      if (!renaming || identityLocked) return;
      try { const renamed = renameConcept(draft, resolutions, renaming.from, renaming.value.trim()); onRename(renamed.draft, renamed.resolutions); setRenaming(null); }
      catch (error) { setRenameError(error instanceof Error ? error.message : '标识修改失败'); }
    }}>
      <div className="fd-page"><p>不同业务概念应使用不同标识，例如制造产品用 manufacturing-product，销售商品用 sales-product。修改会同步候选中的继承、映射、关系和语义引用，并取消相关确认。</p>
      <label className="mp-onto-field">稳定模型标识<input aria-label="新的稳定模型标识" value={renaming?.value ?? ''} maxLength={40} onChange={e => { setRenaming(current => current ? { ...current, value: e.target.value } : null); setRenameError(''); }} /></label>
      <p className="mp-onto-muted">字母开头，仅字母、数字、连字符或下划线，最多 40 字符。发布后不能在此更换身份。</p>
      {renameError && <p role="alert" className="fd-warning">{renameError}</p>}
      </div>
    </Modal>
    {!selection && identityLocked && <p className="mp-onto-muted">此候选已开始发布，稳定标识与发布范围已锁定。后续增量请另建候选并复用已发布类型；正式身份变更需走平台迁移。</p>}
    {!selection && <>
    <div className="fd-section-head"><div><h2>对象类型</h2><p>确认业务概念、粒度与稳定身份，再选择新建或复用平台模型。</p></div>
      <Button icon={<Plus size={14} />} onClick={() => update(next => {
        const id = uniqueId('concept', next.classes.map(c => c.id));
        next.classes.push({ id, name: '新业务对象', description: '', properties: [{ id: 'code', name: '编码', dataType: 'text' }], identity: ['code'], labelProperty: 'code', accepted: false, identityStatus: 'proposed', identityCandidate: ['code'] });
      })}>添加对象类型</Button></div>
    <section className="fd-card" aria-label="候选继承层次"><h3>概念层次</h3><p className="mp-onto-muted">只有“是一种”才建立父子类；“包含、归属、使用”应建业务关系。无充分证据时保持独立类，不强行分层。</p><ul className="fd-hierarchy">{hierarchyRows(draft.classes).map(({ cls, depth }) => <li key={cls.id} style={{ paddingInlineStart: depth * 20 }}><span aria-hidden="true">{depth ? '└ ' : ''}</span><strong>{cls.name}</strong><Tag size="small">第 {depth + 1} 层</Tag>{cls.parentClassId && <span className="mp-onto-muted">是一种 {draft.classes.find(parent => parent.id === cls.parentClassId)?.name ?? cls.parentClassId}</span>}</li>)}</ul></section>
    <div className="fd-batch-bar"><ReviewBatch draft={draft} kind="classes" onChange={onChange} />
      <div className="fd-inline"><Button size="small" disabled={!draft.classes.length} onClick={() => setCollapsed(new Set(draft.classes.map(c => c.id)))}>收起全部对象</Button><Button size="small" disabled={!collapsed.size} onClick={() => setCollapsed(new Set())}>展开全部对象</Button></div>
      <p className="mp-onto-muted">批量确认会展示身份及依据供你核对，不会自动补写规则。保存并校验后发布。</p>
    </div>
    </>}
    {draft.classes.map((cls, i) => {
      if (selection && (selection.kind !== "classes" || selection.id !== cls.id)) return null;
      return <section className="fd-card" id={`fd-class-${cls.id}`} tabIndex={-1} onFocus={() => setCollapsed(current => { if (!current.has(cls.id)) return current; const next = new Set(current); next.delete(cls.id); return next; })} key={cls.id} aria-label={`对象类型 ${cls.name}`}>
        <div className="fd-section-head"><div className="fd-inline"><Tag>{cls.id}</Tag><strong>{cls.name}</strong><Button size="small" theme="borderless" disabled={identityLocked} title={identityLocked ? '发布已开始，请另建候选；正式身份变更需走平台迁移。' : '为不同业务概念选择不同的稳定标识'} onClick={() => { setRenaming({ from: cls.id, value: cls.id }); setRenameError(''); }}>修改稳定标识</Button></div>
          <div className="fd-inline">{!selection && <Button size="small" theme="borderless" aria-expanded={!collapsed.has(cls.id)} aria-label={`${collapsed.has(cls.id) ? "展开" : "收起"}${cls.name}详情`} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(cls.id)) next.delete(cls.id); else next.add(cls.id); return next; })}>{collapsed.has(cls.id) ? "展开详情" : "收起详情"}</Button>}<Button size="small" theme="borderless" disabled={identityLocked} onClick={() => changeScope('classes', cls.id)}>{included(cls) ? '本次暂不发布' : '恢复本次发布'}</Button><Checkbox disabled={!included(cls) || Boolean(classReviewProblem(cls, draft))} checked={classReviewed(cls) && semanticsReviewed(draft, 'classes', cls.id)} onChange={e => e.target.checked ? onChange(confirmCandidates(draft, 'classes', [cls.id])) : update(next => { next.classes[i].accepted = false; })}>{relatedDefinitions(draft, 'classes', cls.id).length ? '确认对象及业务语义' : '已确认对象定义'}</Checkbox>
            <Button disabled={identityLocked} aria-label={`删除对象类型 ${cls.name}`} type="danger" theme="borderless" icon={<Trash2 size={14} />} onClick={() => update(next => {
              next.classes.splice(i, 1); next.mappings = next.mappings.filter(m => m.classId !== cls.id);
              for (const child of next.classes) if (child.parentClassId === cls.id) { child.parentClassId = null; child.inheritanceReason = ''; child.accepted = false; }
              next.relationships = next.relationships.filter(r => r.source !== cls.id && r.target !== cls.id);
              next.semantics.definitions = next.semantics.definitions.filter(d => d.target !== `class:${cls.id}` && !d.target.startsWith(`property:${cls.id}:`));
            })} /></div></div>
        {!included(cls) ? <p className="mp-onto-muted">已暂缓，完整定义保留在草稿。恢复后需重新审核。</p> : classReviewProblem(cls, draft) ? <p className="fd-warning" role="status">待处理：{classReviewProblem(cls, draft)}</p> : !classReviewed(cls) && <p className="mp-onto-muted">规则已完整，可勾选上方确认，一次确认对象及身份规则。</p>}
        {!collapsed.has(cls.id) && <>{selection && <h3>基本定义与平台接入</h3>}<div className="fd-grid"><label>业务名称<input value={cls.name} onChange={e => update(next => { next.classes[i].name = e.target.value; next.classes[i].accepted = false; })} /></label>
          <label>业务定义与粒度<input value={cls.description} placeholder="例如：一个工厂中的一个库存批次" onChange={e => update(next => { next.classes[i].description = e.target.value; next.classes[i].accepted = false; })} /></label>
          <label>父类（可选）<select aria-label={`${cls.name} 父类`} disabled={identityLocked} value={cls.parentClassId ?? ''} onChange={e => update(next => applyParent(next, cls.id, e.target.value || null))}><option value="">独立类（不推断继承）</option>{draft.classes.filter(parent => canSelectParent(draft.classes, cls.id, parent.id)).map(parent => <option key={parent.id} value={parent.id}>{parent.name}</option>)}</select></label>
          {cls.parentClassId && <label>继承依据<input aria-label={`${cls.name} 继承依据`} required maxLength={1000} value={cls.inheritanceReason ?? ''} placeholder="说明为什么它是一种父类，并引用业务或数据依据" onChange={e => update(next => { next.classes[i].inheritanceReason = e.target.value; next.classes[i].accepted = false; })} /></label>}
        </div>
        <p className="mp-onto-muted">此处只审核候选定义；新建、复用或增加属性在发布前选择。</p>
        <ParentIdentityRepair cls={cls} draft={draft} profile={profile} locked={identityLocked} onChange={value => update(next => Object.assign(next, value))} />
        <IdentityReview cls={cls} profile={profile} locked={identityLocked} onChange={patch => update(next => { Object.assign(next.classes[i], patch, { accepted: false }); })} />
        {cls.parentClassId && <p className="mp-onto-muted">子类继承父类的属性与身份。选择父类会补齐缺失属性、沿用父类身份并取消相关审核，请核对数据映射；已有同名标识的类型冲突由校验指出。</p>}
        <ReuseComparison cls={cls} resolution={resolutions[cls.id] ?? { mode: 'new', propertyMap: {} }} types={types} catalogStatus={catalogStatus} />
        {selection && <h3>属性定义</h3>}
        <div className="fd-table-scroll"><table className="fd-table"><thead><tr><th>属性</th><th>数据类型</th><th>业务身份</th><th>显示标签</th><th>本次发布</th><th>操作</th></tr></thead><tbody>
          {cls.properties.map((prop, p) => { const structural = cls.identity.includes(prop.id) || cls.labelProperty === prop.id || (cls.uniqueKeys ?? []).some(key => key.confirmed && key.properties.includes(prop.id)) || draft.relationships.some(rel => included(rel) && rel.joins.some(join => (rel.source === cls.id && join.sourceProperty === prop.id) || (rel.target === cls.id && join.targetProperty === prop.id))); return <tr key={prop.id}><td><input aria-label={`${cls.name} 属性 ${prop.id}`} value={prop.name} onChange={e => update(next => { next.classes[i].properties[p].name = e.target.value; next.classes[i].accepted = false; })} /><small>{prop.id}</small>{prop.included === false && prop.deferReason && <small>暂缓原因：{prop.deferReason}</small>}</td>
            <td><select disabled={identityLocked && cls.identity.includes(prop.id)} aria-label={`${prop.name} 数据类型`} value={prop.dataType} onChange={e => update(next => { next.classes[i].properties[p].dataType = e.target.value as typeof prop.dataType; next.classes[i].accepted = false; })}><option value="text">文本</option><option value="number">数值</option><option value="date">日期</option></select></td>
            <td><Checkbox aria-label={`${cls.name} ${prop.name} 作为身份`} disabled={identityLocked || cls.identityStatus === 'unresolved' || cls.identityStatus === 'source-record'} checked={cls.identity.includes(prop.id)} onChange={e => update(next => { next.classes[i].identityStatus = 'proposed'; next.classes[i].identity = e.target.checked ? [...cls.identity, prop.id] : cls.identity.filter(id => id !== prop.id); next.classes[i].accepted = false; })} /></td>
            <td><input type="radio" aria-label={`${cls.name} ${prop.name} 作为标签`} name={`label-${cls.id}`} checked={cls.labelProperty === prop.id} onChange={() => update(next => { next.classes[i].labelProperty = prop.id; next.classes[i].accepted = false; })} /></td>
            <td><Checkbox aria-label={`${cls.name} ${prop.name} 纳入本次发布`} disabled={identityLocked || structural} checked={prop.included !== false} onChange={e => { if (identityLocked || structural) return; update(next => { const target = next.classes[i].properties[p]; target.included = Boolean(e.target.checked); target.deferReason = e.target.checked ? '' : '用户选择本次暂缓'; next.classes[i].accepted = false; }); }}>{prop.included === false ? '暂缓' : '纳入'}</Checkbox></td>
            <td><Button aria-label={`删除属性 ${cls.name} ${prop.name}`} disabled={identityLocked || cls.properties.length <= 1} theme="borderless" icon={<Trash2 size={14} />} onClick={() => update(next => { const c = next.classes[i]; c.properties.splice(p, 1); c.identity = c.identity.filter(id => id !== prop.id); c.identityStatus = 'proposed'; if (c.labelProperty === prop.id) c.labelProperty = c.properties[0].id; c.accepted = false; for (const m of next.mappings.filter(m => m.classId === cls.id)) { delete m.bindings[prop.id]; m.accepted = false; } })} /></td>
          </tr>; })}</tbody></table></div>
        <Button theme="borderless" icon={<Plus size={14} />} onClick={() => update(next => { next.classes[i].properties.push({ id: uniqueId('property', cls.properties.map(p => p.id)), name: '新属性', dataType: 'text' }); next.classes[i].accepted = false; })}>添加属性</Button>
        {!cls.identity.length && <p className="fd-warning">未设置业务身份，身份尚需审核；当前结构发布将使用来源记录技术身份，不代表已确定业务实体身份。</p>}</>}
      </section>;
    })}
    {!selection && <>
    <div className="fd-section-head"><div><h2>数据映射</h2><p>同一张表可以填充多个业务对象，多张表也可以填充同一个对象。</p></div>
      <Button disabled={!draft.classes.length} icon={<Plus size={14} />} onClick={() => update(next => next.mappings.push({ id: uniqueId('mapping', next.mappings.map(m => m.id)), classId: next.classes[0].id, sheet: profile.sheets[0]?.name ?? '', bindings: {}, reason: '', accepted: false }))}>添加映射</Button></div>
    <BatchReview name="映射" total={draft.mappings.length} confirmed={draft.mappings.filter(item => item.accepted).length} onChange={accepted => update(next => { next.mappings.forEach(item => { item.accepted = accepted; }); })} />
    </>}
    {draft.mappings.map((mapping, i) => {
      if (selection && (selection.kind !== "mappings" || selection.id !== mapping.id)) return null;
      const cls = draft.classes.find(c => c.id === mapping.classId);
      const sheet = profile.sheets.find(s => s.name === mapping.sheet);
      return <section className="fd-card" key={mapping.id} aria-label={`映射 ${mapping.id}`}>
        <div className="fd-section-head"><strong>{mapping.id}</strong><div className="fd-inline"><Checkbox checked={mapping.accepted && semanticsReviewed(draft, 'mappings', mapping.id)} onChange={e => update(next => { next.mappings[i].accepted = Boolean(e.target.checked); setSemanticConfirmation(next, 'mappings', [mapping.id], Boolean(e.target.checked)); })}>已确认映射</Checkbox><Button aria-label={`删除映射 ${mapping.id}`} theme="borderless" icon={<Trash2 size={14} />} onClick={() => update(next => { next.mappings.splice(i, 1); })} /></div></div>
        <div className="fd-grid"><label>来源工作表<select value={mapping.sheet} onChange={e => update(next => { next.mappings[i].sheet = e.target.value; next.mappings[i].bindings = {}; next.mappings[i].accepted = false; })}>{profile.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
          <label>目标对象<select value={mapping.classId} onChange={e => update(next => { next.mappings[i].classId = e.target.value; next.mappings[i].bindings = {}; next.mappings[i].accepted = false; })}>{classOptions}</select></label>
          {cls?.properties.map(prop => <label key={prop.id}>{prop.name} ← 来源列<select value={mapping.bindings[prop.id] ?? ''} onChange={e => update(next => { if (e.target.value) next.mappings[i].bindings[prop.id] = e.target.value; else delete next.mappings[i].bindings[prop.id]; next.mappings[i].accepted = false; })}><option value="">不绑定</option>{sheet?.columns.map(c => <option key={c.name}>{c.name}</option>)}</select></label>)}
        </div><label>映射依据<textarea rows={2} value={mapping.reason} onChange={e => update(next => { next.mappings[i].reason = e.target.value; next.mappings[i].accepted = false; })} /></label>
      </section>;
    })}
    {!selection && <>
    <div className="fd-section-head"><div><h2>业务关系</h2><p>分别确认关系含义与关联字段；字段匹配本身不能证明业务关系成立。</p></div>
      <Button disabled={!draft.classes.length} icon={<Plus size={14} />} onClick={() => update(next => next.relationships.push({ id: uniqueId('relation', next.relationships.map(r => r.id)), name: '关联', source: next.classes[0].id, target: next.classes[0].id, joins: [{ sourceProperty: next.classes[0].properties[0].id, targetProperty: next.classes[0].properties[0].id }], reason: '', accepted: false, cardinalityStatus: 'proposed', targetSelection: 'entity', cardinality: 'N:N' }))}>添加关系</Button></div>
    {!draft.relationships.length && <p className="mp-onto-muted">尚无关系建议。可以根据明确的业务依据添加。</p>}
    <ReviewBatch draft={draft} kind="relationships" onChange={onChange} />
    </>}
    {draft.relationships.map((relation, i) => {
      if (selection && (selection.kind !== "relationships" || selection.id !== relation.id)) return null;
      const src = draft.classes.find(c => c.id === relation.source), dst = draft.classes.find(c => c.id === relation.target);
      return <section className="fd-card" id={`fd-relation-${relation.id}`} tabIndex={-1} key={relation.id} aria-label={`关系 ${relation.name}`}>
        <div className="fd-section-head"><strong>{relation.id}</strong><div className="fd-inline"><Button size="small" theme="borderless" disabled={identityLocked} onClick={() => changeScope('relationships', relation.id)}>{included(relation) ? '本次暂不发布' : '恢复本次发布'}</Button><Checkbox disabled={!included(relation) || Boolean(relationshipReviewProblem(relation, draft))} checked={relationshipReviewed(relation) && semanticsReviewed(draft, 'relationships', relation.id) && !relationshipReviewProblem(relation, draft)} onChange={e => e.target.checked ? onChange(confirmCandidates(draft, 'relationships', [relation.id])) : update(next => { next.relationships[i].accepted = false; })}>{relatedDefinitions(draft, 'relationships', relation.id).length ? '确认关系及业务语义' : '已确认关系'}</Checkbox><Button disabled={identityLocked} aria-label={`删除关系 ${relation.name}`} theme="borderless" icon={<Trash2 size={14} />} onClick={() => update(next => { next.relationships.splice(i, 1); })} /></div></div>
        <div className="fd-grid"><label>关系名称<input value={relation.name} onChange={e => update(next => { next.relationships[i].name = e.target.value; next.relationships[i].accepted = false; })} /></label>
          <label>来源对象<select value={relation.source} onChange={e => update(next => { next.relationships[i].source = e.target.value; next.relationships[i].joins = []; next.relationships[i].accepted = false; })}>{classOptions}</select></label>
          <label>目标对象<select value={relation.target} onChange={e => update(next => { next.relationships[i].target = e.target.value; next.relationships[i].joins = []; next.relationships[i].accepted = false; })}>{classOptions}</select></label></div>
        {!included(relation) ? <p className="mp-onto-muted">已暂缓，完整定义保留在草稿。恢复后需重新审核。</p> : relationshipReviewProblem(relation, draft) ? <p role="status" className="fd-warning">待处理：{relationshipReviewProblem(relation, draft)}</p> : !relationshipReviewed(relation) && <p className="mp-onto-muted">规则已完整，可勾选上方确认，一次确认关系及基数。</p>}
        <RelationshipRepair relation={relation} draft={draft} locked={identityLocked} onChange={onChange} onOpenTarget={onOpenClass} />
        <RelationshipReview relation={relation} target={dst} profile={profile} onChange={patch => update(next => { Object.assign(next.relationships[i], patch, { accepted: false }); })} />
        {relation.joins.map((join, j) => <div className="fd-join" key={j}><label>来源属性<select aria-label={`${relation.name} 来源属性 ${j + 1}`} value={join.sourceProperty} onChange={e => update(next => { next.relationships[i].joins[j].sourceProperty = e.target.value; next.relationships[i].accepted = false; })}><option value="">请选择来源属性</option>{src?.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><span aria-hidden="true">＝</span><label>目标属性<select aria-label={`${relation.name} 目标属性 ${j + 1}`} value={join.targetProperty} onChange={e => update(next => { next.relationships[i].joins[j].targetProperty = e.target.value; next.relationships[i].accepted = false; })}><option value="">请选择目标属性</option>{dst?.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><Button aria-label={`移除关联条件 ${relation.id} ${j + 1}`} theme="borderless" icon={<Trash2 size={14} />} onClick={() => update(next => { next.relationships[i].joins.splice(j, 1); next.relationships[i].accepted = false; })} /></div>)}
        <Button theme="borderless" disabled={relation.joins.length >= 4 || !src || !dst} onClick={() => update(next => { next.relationships[i].joins.push({ sourceProperty: '', targetProperty: '' }); next.relationships[i].accepted = false; })}>添加复合关联条件</Button>
        <label>业务含义与依据<textarea rows={2} value={relation.reason} onChange={e => update(next => { next.relationships[i].reason = e.target.value; next.relationships[i].accepted = false; })} /></label>
      </section>;
    })}
    {!!definitions.length && <><div className="fd-section-head"><div><h2>业务语义</h2><p>确认定义、粒度和证据；保留不确定项供后续修订。</p></div></div>
      <BatchReview name="业务语义" total={definitions.length} confirmed={definitions.filter(item => item.confirmed).length} onChange={confirmed => update(next => { next.semantics.definitions.filter(item => definitions.some(d => d.target === item.target)).forEach(item => { item.confirmed = confirmed; }); })} />
      {definitions.map(definition => { const i = draft.semantics.definitions.findIndex(d => d.target === definition.target); return <section className="fd-card" key={definition.target}><div className="fd-section-head"><strong>{definition.target}</strong><Checkbox checked={definition.confirmed} onChange={e => update(next => { next.semantics.definitions[i].confirmed = Boolean(e.target.checked); })}>业务已确认</Checkbox></div>
        <div className="fd-grid">{semanticFields.map((key, k) => <label key={key}>{semanticLabels[k]}<textarea rows={2} aria-label={`${definition.target} ${semanticLabels[k]}`} value={definition[key]} onChange={e => update(next => { next.semantics.definitions[i][key] = e.target.value; next.semantics.definitions[i].confirmed = false; })} /></label>)}</div></section>; })}</>}
    {!selection && !!draft.notes.length && <section className="fd-card"><h3>模型建议与待确认项</h3><ul>{draft.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></section>}
  </div>;
}
