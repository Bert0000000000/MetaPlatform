import React, { useState } from 'react';
import { Card, SideSheet, Empty, Tag, Typography } from '@douyinfe/semi-ui';
import { FileText, Database, Link } from 'lucide-react';
import type { Evidence } from '@/api/superai/types';

const { Text, Paragraph } = Typography;

export interface EvidenceRendererProps {
  evidenceList: Evidence[];
  emptyText?: string;
}

/**
 * P4.5 EvidenceRenderer - renders a list of Evidence with
 * type-aware icon and a click-to-detail drawer.
 */
export function EvidenceRenderer({ evidenceList, emptyText }: EvidenceRendererProps) {
  const [activeEvidence, setActiveEvidence] = useState<Evidence | null>(null);

  if (evidenceList.length === 0) {
    return <Empty description={emptyText || 'No evidence yet'} />;
  }

  const iconFor = (type: Evidence['type']) => {
    switch (type) {
      case 'ONTOLOGY_OBJECT':
      case 'ONTOLOGY_METRIC':
      case 'ONTOLOGY_RELATION':
        return <Database size={16} style={{ color: 'var(--semi-color-primary)' }} />;
      case 'DOCUMENT':
      case 'KB_CHUNK':
        return <FileText size={16} style={{ color: 'var(--semi-color-success)' }} />;
      case 'EXTERNAL':
      case 'MODEL_DERIVED':
        return <Link size={16} style={{ color: 'var(--semi-color-violet)' }} />;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {evidenceList.map((e) => (
          <Card key={e.evidenceId} style={{ cursor: 'pointer' }}>
            <div onClick={() => setActiveEvidence(e)} data-evidence-id={e.evidenceId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {iconFor(e.type)}
              <Text strong style={{ flex: 1 }}>{e.ref}</Text>
              <Tag color="grey">{e.type}</Tag>
            </div>
            {e.concept && (
              <Text type="tertiary" style={{ fontSize: 12 }}>
                {e.concept}{e.objectId ? ' / ' + e.objectId : ''}
              </Text>
            )}
            {e.fragment && (
              <Paragraph
                type="tertiary"
                ellipsis={{ rows: 2 }}
                style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}
              >
                {e.fragment}
              </Paragraph>
            )}
            </div>
          </Card>
        ))}
      </div>
      <SideSheet
        title={activeEvidence ? 'Evidence: ' + activeEvidence.evidenceId : ''}
        visible={!!activeEvidence}
        onCancel={() => setActiveEvidence(null)}
        width={560}
      >
        {activeEvidence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="tertiary">Type</Text>
              <div><Tag color="grey">{activeEvidence.type}</Tag></div>
            </div>
            <div>
              <Text type="tertiary">Reference</Text>
              <div><code style={{ fontSize: 13 }}>{activeEvidence.ref}</code></div>
            </div>
            {activeEvidence.concept && (
              <div>
                <Text type="tertiary">Concept / Object</Text>
                <div><Text>{activeEvidence.concept}{activeEvidence.objectId ? ' / ' + activeEvidence.objectId : ''}</Text></div>
              </div>
            )}
            {activeEvidence.fragment && (
              <div>
                <Text type="tertiary">Fragment</Text>
                <Paragraph copyable style={{ background: 'var(--muted)', padding: 8, borderRadius: 4 }}>
                  {activeEvidence.fragment}
                </Paragraph>
              </div>
            )}
            <div>
              <Text type="tertiary">Captured at</Text>
              <div><Text>{activeEvidence.capturedAt}</Text></div>
            </div>
            <div>
              <Text type="tertiary">Envelope</Text>
              <div><code style={{ fontSize: 13 }}>{activeEvidence.envelopeId}</code></div>
            </div>
            {activeEvidence.toolCallId && (
              <div>
                <Text type="tertiary">Tool call</Text>
                <div><code style={{ fontSize: 13 }}>{activeEvidence.toolCallId}</code></div>
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </>
  );
}

export default EvidenceRenderer;
