import type { Concept, Entity, SearchResult } from '@/types';
import { listConcepts, getConceptHierarchy } from './concepts';
import { listEntities } from './entities';

export async function globalSearch(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return [];
  const [concepts, entities] = await Promise.all([
    listConcepts(),
    listEntities({ keyword, includeAttributes: false }),
  ]);

  const conceptResults: SearchResult[] = (concepts.items || [])
    .filter(
      (c: Concept) =>
        c.name.toLowerCase().includes(keyword.toLowerCase()) ||
        c.code.toLowerCase().includes(keyword.toLowerCase())
    )
    .map((c: Concept) => ({
      type: 'concept' as const,
      id: c.conceptId,
      code: c.code,
      name: c.name,
      description: c.description,
    }));

  const entityResults: SearchResult[] = (entities.items || []).map((e: Entity) => ({
    type: 'entity' as const,
    id: e.entityId,
    code: e.code,
    name: e.name,
    description: e.description,
    conceptName: e.conceptName,
  }));

  return [...conceptResults, ...entityResults].slice(0, 20);
}

export { getConceptHierarchy };
