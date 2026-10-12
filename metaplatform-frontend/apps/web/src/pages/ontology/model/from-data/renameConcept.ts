import type { ModelingDraft, ModelingResolution } from '@/api/ont/modeling';

/** Rename an unpublished concept and its references as one candidate edit. */
export function renameConcept(
  draft: ModelingDraft,
  resolutions: Record<string, ModelingResolution>,
  from: string,
  to: string,
): { draft: ModelingDraft; resolutions: Record<string, ModelingResolution> } {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(to)) throw new Error('标识须以字母开头，仅含字母、数字、连字符或下划线，最多 40 个字符。');
  if (!draft.classes.some(item => item.id === from)) throw new Error('对象类型不存在，请刷新候选。');
  if (from !== to && draft.classes.some(item => item.id === to)) throw new Error('该标识已被其他候选对象使用。');
  const next = structuredClone(draft);
  const nextResolutions = structuredClone(resolutions);
  if (from === to) return { draft: next, resolutions: nextResolutions };
  const cls = next.classes.find(item => item.id === from)!;
  cls.id = to;
  cls.accepted = false;
  for (const child of next.classes) if (child.parentClassId === from) { child.parentClassId = to; child.accepted = false; }
  for (const mapping of next.mappings) if (mapping.classId === from) { mapping.classId = to; mapping.accepted = false; }
  for (const relation of next.relationships) {
    if (relation.source === from || relation.target === from) relation.accepted = false;
    if (relation.source === from) relation.source = to;
    if (relation.target === from) relation.target = to;
  }
  for (const definition of next.semantics.definitions) {
    if (definition.target === `class:${from}`) { definition.target = `class:${to}`; definition.confirmed = false; }
    if (definition.target.startsWith(`property:${from}:`)) { definition.target = `property:${to}:${definition.target.slice(`property:${from}:`.length)}`; definition.confirmed = false; }
  }
  for (const instance of next.instances) {
    if (instance && typeof instance === 'object' && 'classId' in instance && instance.classId === from) {
      instance.classId = to;
      if ('accepted' in instance) instance.accepted = false;
    }
  }
  // Row keys hash the concept ID. Overrides cannot safely be re-targeted to a new
  // identity; refuse rather than silently losing or applying them to other objects.
  if (next.instanceEdits.length || next.links.length) throw new Error('候选包含实例或关系修订，请先移除这些修订或另建候选，再修改稳定标识。');
  if (nextResolutions[from]) {
    nextResolutions[to] = nextResolutions[from];
    delete nextResolutions[from];
  }
  return { draft: next, resolutions: nextResolutions };
}
