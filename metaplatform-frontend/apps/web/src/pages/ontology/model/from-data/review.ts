import type { ModelingClass, ModelingDraft, ModelingRelationship } from '@/api/ont/modeling';

export type ReviewKind = 'classes' | 'relationships';
export type SemanticOwner = ReviewKind | 'mappings';
export function semanticOwner(draft: ModelingDraft, target: string): { kind: SemanticOwner; id: string } | undefined {
  const [type, id, propertyId] = target.split(':');
  if (type === 'class' || type === 'property') {
    const cls = draft.classes.find(c => c.id === id && included(c));
    if (cls && (type === 'class' || cls.properties.some(p => p.id === propertyId && included(p)))) return { kind: 'classes', id };
  }
  if (type === 'relationship' && draft.relationships.some(r => r.id === id && included(r) && draft.classes.some(c => c.id === r.source && included(c)) && draft.classes.some(c => c.id === r.target && included(c)))) return { kind: 'relationships', id };
  if (type === 'mapping' && draft.mappings.some(m => m.id === id && draft.classes.some(c => c.id === m.classId && included(c)))) return { kind: 'mappings', id };
}
export const scopedDefinitions = (draft: ModelingDraft) => draft.semantics.definitions.filter(d => semanticOwner(draft, d.target));
export const relatedDefinitions = (draft: ModelingDraft, kind: SemanticOwner, id: string) => scopedDefinitions(draft).filter(d => { const owner = semanticOwner(draft, d.target)!; return owner.kind === kind && owner.id === id; });
export const semanticsReviewed = (draft: ModelingDraft, kind: SemanticOwner, id: string) => relatedDefinitions(draft, kind, id).every(d => d.confirmed);
export function setSemanticConfirmation(draft: ModelingDraft, kind: SemanticOwner, ids: string[], confirmed: boolean) {
  for (const id of ids) for (const definition of relatedDefinitions(draft, kind, id)) definition.confirmed = confirmed;
}

/** Keep approvals scoped to the exact candidate and semantic content the user reviewed. */
export function invalidateSemanticChanges(previous: ModelingDraft, next: ModelingDraft): ModelingDraft {
  const content = (item: object) => JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => !['accepted', 'identityStatus', 'cardinalityStatus'].includes(key))));
  for (const kind of ['classes', 'relationships', 'mappings'] as const) for (const item of next[kind]) {
    const old = previous[kind].find(c => c.id === item.id);
    if (old && (content(old) !== content(item) || (old.accepted && !item.accepted))) {
      item.accepted = false;
      setSemanticConfirmation(next, kind, [item.id], false);
    }
  }
  for (const definition of next.semantics.definitions) {
    const old = previous.semantics.definitions.find(d => d.target === definition.target);
    if (!old) continue;
    const changed = JSON.stringify({ ...old, confirmed: false }) !== JSON.stringify({ ...definition, confirmed: false });
    if (changed || (old.confirmed && !definition.confirmed)) {
      definition.confirmed = false;
      const owner = semanticOwner(next, definition.target);
      const item = owner && next[owner.kind].find(c => c.id === owner.id);
      if (item) item.accepted = false;
    }
  }
  return next;
}
export const included = (item: { included?: boolean }) => item.included !== false;
export const classReviewed = (cls: ModelingClass) => cls.accepted && ['confirmed', 'unresolved', 'source-record'].includes(cls.identityStatus ?? 'legacy');
export const relationshipReviewed = (rel: ModelingRelationship) => rel.accepted && rel.cardinalityStatus === 'confirmed';

export function classReviewProblem(cls: ModelingClass, draft: ModelingDraft): string {
  if (!included(cls)) return '已暂缓，不参与本次发布';
  if (!cls.identity.length && !['unresolved', 'source-record'].includes(cls.identityStatus ?? '')) return '请选择身份字段，或明确选择身份未确定';
  if (cls.identity.length && !cls.identityReason?.trim()) return '请填写身份依据';
  if (cls.identity.some(id => !cls.properties.some(p => p.id === id && included(p)))) return '身份引用了已暂缓或不存在的属性';
  if (!cls.properties.some(p => p.id === cls.labelProperty && included(p))) return '显示标签不能暂缓';
  if (['unresolved', 'source-record'].includes(cls.identityStatus ?? '') && cls.identity.length) return '未确定身份不能启用业务身份字段';
  if (cls.parentClassId) {
    const parent = draft.classes.find(c => c.id === cls.parentClassId && included(c));
    if (!parent) return '父类未纳入本次发布';
    if (!cls.inheritanceReason?.trim()) return '请填写继承依据';
    if (!cls.identity.length || JSON.stringify(cls.identity) !== JSON.stringify(parent.identity)) return '子类须与父类保持相同的非空身份';
  }
  return '';
}

export function relationshipReviewProblem(rel: ModelingRelationship, draft: ModelingDraft): string {
  if (!included(rel)) return '已暂缓，不参与本次发布';
  const src = draft.classes.find(c => c.id === rel.source && included(c));
  const dst = draft.classes.find(c => c.id === rel.target && included(c));
  if (!src || !dst) return '来源或目标对象未纳入本次发布';
  if (!rel.joins.length || rel.joins.some(j => !src.properties.some(p => p.id === j.sourceProperty && included(p)) || !dst.properties.some(p => p.id === j.targetProperty && included(p)))) return '缺少有效关联字段映射，请在关联修复区补充或暂不发布';
  if (!rel.cardinalityReason?.trim()) return '请填写基数依据';
  if (!rel.cardinality || rel.cardinalityStatus === 'unresolved') return '请选择业务基数';
  if (!['entity', 'group'].includes(rel.targetSelection ?? '')) return '请选择单个业务实体或匹配目标集合';
  if (rel.targetSelection === 'group' && ['N:1', '1:1'].includes(rel.cardinality)) return '集合匹配不能声明每个来源只有一个目标';
  if (rel.targetSelection === 'entity') {
    const keys = [dst.identity, ...(dst.uniqueKeys ?? []).filter(k => k.confirmed && k.reason.trim()).map(k => k.properties)].filter(k => k.length);
    const covered = new Set(rel.joins.map(j => j.targetProperty));
    if (!keys.some(key => key.every(id => covered.has(id)))) {
      const missing = keys[0]?.filter(id => !covered.has(id)).map(id => dst.properties.find(p => p.id === id)?.name ?? id);
      return missing?.length ? `关联缺少目标身份字段：${missing.join('、')}` : '目标对象尚未定义可定位的完整身份或唯一键';
    }
  }
  return '';
}

export function confirmCandidates(draft: ModelingDraft, kind: ReviewKind, ids: string[]): ModelingDraft {
  const next = structuredClone(draft);
  if (kind === 'classes') next.classes.forEach(cls => {
    if (!ids.includes(cls.id) || classReviewProblem(cls, next)) return;
    if (cls.identity.length) cls.identityStatus = 'confirmed';
    cls.accepted = true;
    setSemanticConfirmation(next, kind, [cls.id], true);
  });
  else next.relationships.forEach(rel => {
    if (!ids.includes(rel.id) || relationshipReviewProblem(rel, next)) return;
    rel.cardinalityStatus = 'confirmed'; rel.accepted = true;
    setSemanticConfirmation(next, kind, [rel.id], true);
  });
  return next;
}

export function setIncluded(draft: ModelingDraft, kind: ReviewKind, id: string, value: boolean): ModelingDraft {
  const next = structuredClone(draft);
  const classes = new Set(kind === 'classes' ? [id] : []);
  if (!value) {
    let size = -1;
    while (size !== classes.size) {
      size = classes.size;
      next.classes.forEach(c => { if (c.parentClassId && classes.has(c.parentClassId)) classes.add(c.id); });
    }
  }
  next.classes.forEach(c => { if (classes.has(c.id)) { c.included = value; c.accepted = false; } });
  next.relationships.forEach(r => {
    if ((kind === 'relationships' && r.id === id) || (!value && (classes.has(r.source) || classes.has(r.target)))) {
      r.included = value; r.accepted = false;
    }
  });
  return next;
}

export function selectedDraft(draft: ModelingDraft): ModelingDraft {
  return { ...draft, classes: draft.classes.filter(included), relationships: draft.relationships.filter(included) };
}
