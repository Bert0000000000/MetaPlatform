import { useMemo } from 'react';
import type { KernelObjectType, KernelLinkType } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import OntologySchemaGraph from './OntologySchemaGraph';
import { inheritedGraphRelationships } from './relationshipInheritance';

export default function SchemaGraphCanvas({ types, links, selectedRid, selectedRelation, onRelationSelect, onSelect, onOpen, catalogTypes = types, catalogLinks = links }: {
  types: KernelObjectType[];
  links: KernelLinkType[];
  catalogTypes?: KernelObjectType[];
  catalogLinks?: KernelLinkType[];
  selectedRid?: string;
  selectedRelation?: string;
  onRelationSelect?: (rid: string) => void;
  onSelect: (rid: string) => void;
  onOpen: (rid: string) => void;
}) {
  const classes = useMemo(() => types.map(t => ({
    id: t.rid, name: t.display_name || ridTail(t.rid),
    description: t.description || '', properties: t.properties,
  })), [types]);
  const relationships = useMemo(() => {
    const toRelationship = (l: KernelLinkType) => ({
    id: l.rid,
    name: l.src_display_name?.trim() || l.dst_display_name?.trim() || ridTail(l.rid),
    cardinality: l.cardinality,
    source: l.src,
    target: l.dst,
    });
    const business = links.map(toRelationship);
    const hierarchy = catalogTypes.map(t => ({ id: t.rid, parentId: t.parent_class }));
    const inheritance = types.filter(t => t.parent_class && types.some(p => p.rid === t.parent_class)).map(t => ({
      id: `inheritance:${t.rid}`, name: '继承', source: t.rid, target: t.parent_class!, kind: 'inheritance' as const,
    }));
    return [...business, ...inheritance, ...inheritedGraphRelationships(selectedRid || '', hierarchy, catalogLinks.map(toRelationship))];
  }, [links, types, catalogTypes, catalogLinks, selectedRid]);
  return <OntologySchemaGraph classes={classes} relationships={relationships}
    selectedRelation={selectedRelation} onRelationSelect={onRelationSelect}
    selected={selectedRid} onSelect={onSelect} onOpen={onOpen} layoutKey="model-workbench" compact />;
}
