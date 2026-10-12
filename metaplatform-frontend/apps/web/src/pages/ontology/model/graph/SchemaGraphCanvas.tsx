import { useMemo } from 'react';
import type { KernelObjectType, KernelLinkType } from '@/api/ont/kernel';
import { ridTail } from '../../rid';
import OntologySchemaGraph from './OntologySchemaGraph';

export default function SchemaGraphCanvas({ types, links, selectedRid, onSelect, onOpen }: {
  types: KernelObjectType[];
  links: KernelLinkType[];
  selectedRid?: string;
  onSelect: (rid: string) => void;
  onOpen: (rid: string) => void;
}) {
  const classes = useMemo(() => types.map(t => ({
    id: t.rid, name: t.display_name || ridTail(t.rid),
    description: t.description || '', properties: t.properties,
  })), [types]);
  const relationships = useMemo(() => links.map(l => ({
    id: l.rid, name: ridTail(l.rid), source: l.src, target: l.dst,
  })), [links]);
  return <OntologySchemaGraph classes={classes} relationships={relationships}
    selected={selectedRid} onSelect={onSelect} onOpen={onOpen} layoutKey="model-workbench" compact />;
}
