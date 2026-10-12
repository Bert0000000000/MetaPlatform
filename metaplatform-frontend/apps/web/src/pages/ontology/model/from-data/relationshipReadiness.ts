import type { ModelingDraft, ModelingRelationship } from '@/api/ont/modeling';

/** Suggestions use exact, unambiguous field matches; they never establish uniqueness. */
export function relationshipRepair(relation: ModelingRelationship, draft: ModelingDraft) {
  const source = draft.classes.find(c => c.id === relation.source);
  const target = draft.classes.find(c => c.id === relation.target);
  const valid = relation.joins.filter(j => source?.properties.some(p => p.id === j.sourceProperty) && target?.properties.some(p => p.id === j.targetProperty));
  const keys = [target?.identity ?? [], ...(target?.uniqueKeys ?? []).filter(k => k.confirmed && k.reason.trim()).map(k => k.properties)].filter(k => k.length);
  const covered = new Set(valid.map(j => j.targetProperty));
  const key = keys.find(k => k.every(id => covered.has(id))) ?? keys[0] ?? [];
  const missing = key.filter(id => !covered.has(id));
  const suggestions: ModelingRelationship['joins'] = [];
  for (const id of missing) {
    const prop = target?.properties.find(p => p.id === id);
    if (!prop) continue;
    const matches = source?.properties.filter(p => p.dataType === prop.dataType && (p.id === prop.id || p.name.trim() === prop.name.trim())) ?? [];
    if (matches.length === 1 && !valid.some(j => j.sourceProperty === matches[0].id) && !suggestions.some(j => j.sourceProperty === matches[0].id)) {
      suggestions.push({ sourceProperty: matches[0].id, targetProperty: prop.id });
    }
  }
  return { source, target, key, missing, valid, suggestions, complete: keys.some(k => k.every(id => covered.has(id))) };
}
