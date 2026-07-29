import React, { useState } from 'react';
import { Card, Drawer, Empty, Tag, Typography } from 'antd';
import { FileTextOutlined, DatabaseOutlined, LinkOutlined } from '@ant-design/icons';
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
    return <Empty description={emptyText || 'No evidence yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const iconFor = (type: Evidence['type']) => {
    switch (type) {
      case 'ONTOLOGY_OBJECT':
      case 'ONTOLOGY_METRIC':
      case 'ONTOLOGY_RELATION':
        return <DatabaseOutlined style={{ color: '#1677ff' }} />;
      case 'DOCUMENT':
      case 'KB_CHUNK':
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'EXTERNAL':
      case 'MODEL_DERIVED':
        return <LinkOutlined style={{ color: '#722ed1' }} />;
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {evidenceList.map((e) => (
          <Card
            key={e.evidenceId}
            size="small"
            hoverable
            onClick={() => setActiveEvidence(e)}
            style={{ cursor: 'pointer' }}
            data-evidence-id={e.evidenceId}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {iconFor(e.type)}
              <Text strong style={{ flex: 1 }}>{e.ref}</Text>
              <Tag color="default">{e.type}</Tag>
            </div>
            {e.concept && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {e.concept}{e.objectId ? ' / ' + e.objectId : ''}
              </Text>
            )}
            {e.fragment && (
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 2 }}
                style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}
              >
                {e.fragment}
              </Paragraph>
            )}
          </Card>
        ))}
      </div>
      <Drawer
        title={activeEvidence ? 'Evidence: ' + activeEvidence.evidenceId : ''}
        open={!!activeEvidence}
        onClose={() => setActiveEvidence(null)}
        width={560}
      >
        {activeEvidence && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Text type="secondary">Type</Text>
              <div><Tag color="default">{activeEvidence.type}</Tag></div>
            </div>
            <div>
              <Text type="secondary">Reference</Text>
              <div><Text code>{activeEvidence.ref}</Text></div>
            </div>
            {activeEvidence.concept && (
              <div>
                <Text type="secondary">Concept / Object</Text>
                <div><Text>{activeEvidence.concept}{activeEvidence.objectId ? ' / ' + activeEvidence.objectId : ''}</Text></div>
              </div>
            )}
            {activeEvidence.fragment && (
              <div>
                <Text type="secondary">Fragment</Text>
                <Paragraph copyable style={{ background: '#fafafa', padding: 8, borderRadius: 4 }}>
                  {activeEvidence.fragment}
                </Paragraph>
              </div>
            )}
            <div>
              <Text type="secondary">Captured at</Text>
              <div><Text>{activeEvidence.capturedAt}</Text></div>
            </div>
            <div>
              <Text type="secondary">Envelope</Text>
              <div><Text code>{activeEvidence.envelopeId}</Text></div>
            </div>
            {activeEvidence.toolCallId && (
              <div>
                <Text type="secondary">Tool call</Text>
                <div><Text code>{activeEvidence.toolCallId}</Text></div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

export default EvidenceRenderer;
