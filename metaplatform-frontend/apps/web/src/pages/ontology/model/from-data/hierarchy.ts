import type { ModelingClass, ModelingDraft } from '@/api/ont/modeling';

/** Called on an editable clone; inherited definitions remain explicit in the candidate. */
export function applyParent(draft: ModelingDraft, classId: string, parentId: string | null): void {
  if (parentId && !canSelectParent(draft.classes, classId, parentId)) throw new Error('不能选择自身或后代作为父类。');
  const selected = draft.classes.find(item => item.id === classId)!;
  selected.parentClassId = parentId;
  if (!parentId) selected.inheritanceReason = '';
  const affected = new Set<string>();
  const visit = (cls: ModelingClass) => {
    if (affected.has(cls.id)) return;
    affected.add(cls.id); cls.accepted = false;
    const parent = draft.classes.find(item => item.id === cls.parentClassId);
    if (parent) {
      for (const property of parent.properties) if (!cls.properties.some(existing => existing.id === property.id)) cls.properties.push(structuredClone(property));
      // Existing same-ID type conflicts are intentionally preserved for validation.
      cls.identity = [...parent.identity];
      cls.identityCandidate = [...parent.identity];
      cls.identityStatus = 'proposed';
    }
    for (const child of draft.classes.filter(item => item.parentClassId === cls.id)) visit(child);
  };
  visit(selected);
  for (const mapping of draft.mappings) if (affected.has(mapping.classId)) mapping.accepted = false;
  for (const relation of draft.relationships) if (affected.has(relation.source) || affected.has(relation.target)) { relation.accepted = false; if (relation.cardinalityStatus === 'confirmed') relation.cardinalityStatus = 'proposed'; }
  for (const definition of draft.semantics.definitions) if ([...affected].some(id => definition.target === `class:${id}` || definition.target.startsWith(`property:${id}:`))) definition.confirmed = false;
}

export function canSelectParent(classes: ModelingClass[], classId: string, parentId: string): boolean {
  const visited = new Set<string>();
  let current: string | null | undefined = parentId;
  while (current) {
    if (current === classId || visited.has(current)) return false;
    visited.add(current);
    current = classes.find(item => item.id === current)?.parentClassId;
  }
  return true;
}

/** Every concept is displayed once, including invalid imported cycles. */
export function hierarchyRows(classes: ModelingClass[]): Array<{ cls: ModelingClass; depth: number }> {
  const rows: Array<{ cls: ModelingClass; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (cls: ModelingClass, depth: number) => {
    if (visited.has(cls.id)) return;
    visited.add(cls.id); rows.push({ cls, depth });
    for (const child of classes.filter(item => item.parentClassId === cls.id)) visit(child, depth + 1);
  };
  for (const cls of classes.filter(item => !item.parentClassId || !classes.some(parent => parent.id === item.parentClassId))) visit(cls, 0);
  for (const cls of classes) visit(cls, 0);
  return rows;
}
