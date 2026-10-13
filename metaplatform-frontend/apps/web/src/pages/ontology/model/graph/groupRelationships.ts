export interface GraphRelationship {
  id: string;
  name: string;
  cardinality?: string;
  source: string;
  target: string;
  kind?: 'inheritance' | 'inherited';
  relationRef?: string;
}

export type RelationshipGroup = GraphRelationship & { members: GraphRelationship[] };

/** Presentation only: endpoints may share a line without merging native definitions. */
export function groupRelationships(relationships: GraphRelationship[], collapsed: boolean): RelationshipGroup[] {
  const groups = new Map<string, RelationshipGroup>();
  for (const relationship of relationships) {
    const key = collapsed
      ? JSON.stringify([relationship.source, relationship.target].sort())
      : JSON.stringify(['individual', relationship.id]);
    const group = groups.get(key);
    if (group) {
      group.members.push(relationship);
      if (relationship.kind === 'inheritance') groups.set(key, { ...relationship, members: group.members });
    }
    else groups.set(key, { ...relationship, members: [relationship] });
  }
  return [...groups.values()];
}
