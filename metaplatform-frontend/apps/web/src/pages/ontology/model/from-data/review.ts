import type { ModelingClass, ModelingDraft, ModelingRelationship } from '@/api/ont/modeling';

export type ReviewKind = 'classes' | 'relationships';
export const included = (item: { included?: boolean }) => item.included !== false;
export const classReviewed = (cls: ModelingClass) => cls.accepted && ['confirmed', 'unresolved', 'source-record'].includes(cls.identityStatus ?? 'legacy');
export const relationshipReviewed = (rel: ModelingRelationship) => rel.accepted && rel.cardinalityStatus === 'confirmed';

export function classReviewProblem(cls: ModelingClass, draft: ModelingDraft): string {
  if (!included(cls)) return '已暂缓，不参与本次发布';
  if (!cls.identity.length && !['unresolved', 'source-record'].includes(cls.identityStatus ?? '')) return '请选择身份字段，或明确选择身份未确定';
  if (cls.identity.length && !cls.identityReason?.trim()) return '请填写身份依据';
  if (cls.identity.some(id => !cls.properties.some(p => p.id === id))) return '身份引用不存在的属性';
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
  if (!rel.joins.length || rel.joins.some(j => !src.properties.some(p => p.id === j.sourceProperty) || !dst.properties.some(p => p.id === j.targetProperty))) return '缺少有效关联字段映射，请在关联修复区补充或暂不发布';
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
  });
  else next.relationships.forEach(rel => {
    if (!ids.includes(rel.id) || relationshipReviewProblem(rel, next)) return;
    rel.cardinalityStatus = 'confirmed'; rel.accepted = true;
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
