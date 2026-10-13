/** Display applicability only; original definitions and IDs remain authoritative. */
export interface HierarchyClass { id: string; parentId?: string | null }
export interface DirectedRelationship { id: string; source: string; target: string }

export function relationshipAncestors(id: string, classes: HierarchyClass[]): Set<string> {
  const byId = new Map(classes.map(c => [c.id, c]));
  const chain = new Set<string>();
  const tenantPrefix = id.startsWith('ont.') ? `ont.${id.split('.')[1]}.obj.` : '';
  let current: string | null | undefined = id;
  while (current) {
    if (chain.has(current) || (tenantPrefix && !current.startsWith(tenantPrefix))) return new Set();
    const cls = byId.get(current);
    if (!cls) return new Set();
    chain.add(current);
    current = cls.parentId;
  }
  return chain;
}

export function applicableRelationships<T extends DirectedRelationship>(id: string, classes: HierarchyClass[], relationships: T[]) {
  const ancestors = relationshipAncestors(id, classes);
  return relationships.flatMap(relation => (['source', 'target'] as const)
    .filter(side => relation[side] === id || ancestors.has(relation[side]))
    .map(side => ({ relation, side, declaredOn: relation[side], inherited: relation[side] !== id })));
}

export function inheritedGraphRelationships<T extends DirectedRelationship & { name: string; cardinality?: string }>(id: string, classes: HierarchyClass[], relationships: T[]) {
  return applicableRelationships(id, classes, relationships).filter(item => item.inherited).map(({ relation, side }) => ({
    ...relation, id: `applicable:${side}:${relation.id}:${id}`, relationRef: relation.id,
    [side]: id, kind: 'inherited' as const,
  }));
}
