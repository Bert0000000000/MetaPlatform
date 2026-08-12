import React from 'react';
import { Tag, Typography } from '@douyinfe/semi-ui';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';

/**
 * Evidence 渲染器（P4.1.3）。
 */
export interface Evidence {
  evidenceId?: string;
  type: 'ONTOLOGY_OBJECT' | 'ONTOLOGY_METRIC' | 'DOCUMENT' | 'EXTERNAL' | 'MODEL_DERIVED';
  ref: string;
  fragment?: string;
  score?: number;
  title?: string;
}

const TYPE_COLOR: Record<Evidence['type'], TagColor> = {
  ONTOLOGY_OBJECT: 'cyan',
  ONTOLOGY_METRIC: 'indigo',
  DOCUMENT: 'green',
  EXTERNAL: 'orange',
  MODEL_DERIVED: 'purple',
};

export function EvidenceRenderer({ evidence, onClick }: { evidence: Evidence; onClick?: (e: Evidence) => void }) {
  return (
    <Tag
      color={TYPE_COLOR[evidence.type]}
      style={{ cursor: 'pointer', padding: '4px 8px' }}
      onClick={() => onClick?.(evidence)}
    >
      {evidence.type} · {evidence.title ?? evidence.ref}
      {evidence.fragment && (
        <Typography.Text style={{ marginLeft: 8, color: '#999' }} ellipsis>
          {evidence.fragment.slice(0, 60)}
        </Typography.Text>
      )}
    </Tag>
  );
}
