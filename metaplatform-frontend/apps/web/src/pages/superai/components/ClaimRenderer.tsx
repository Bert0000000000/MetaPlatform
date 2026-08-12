import React from 'react';
import { Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import { CheckCircleOutlined, BulbOutlined, ThunderboltOutlined } from '@mate/shared';
import type { Claim } from '@/api/superai/types';

const { Text } = Typography;

export interface ClaimRendererProps {
  claim: Claim;
  onEvidenceClick?: (evidenceId: string) => void;
}

/**
 * P4.5 ClaimRenderer - renders a single Claim (FACT / INFERENCE / RECOMMENDATION)
 * with type-aware styling and clickable evidence references.
 */
export function ClaimRenderer({ claim, onEvidenceClick }: ClaimRendererProps) {
  const icon = (() => {
    switch (claim.type) {
      case 'FACT':
        return <CheckCircleOutlined style={{ color: 'var(--semi-color-success)' }} />;
      case 'INFERENCE':
        return <BulbOutlined style={{ color: 'var(--semi-color-primary)' }} />;
      case 'RECOMMENDATION':
        return <ThunderboltOutlined style={{ color: 'var(--semi-color-warning)' }} />;
    }
  })();

  const color = (() => {
    switch (claim.type) {
      case 'FACT':
        return 'green';
      case 'INFERENCE':
        return 'blue';
      case 'RECOMMENDATION':
        return 'orange';
    }
  })();

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        border: '1px solid var(--border)',
        borderRadius: 6,
        marginBottom: 8,
        background: 'var(--muted)',
      }}
      data-claim-id={claim.claimId}
    >
      <div style={{ flex: '0 0 auto', paddingTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Tag color={color}>{claim.type}</Tag>
          <Tooltip content={'Confidence: ' + (claim.confidence != null ? (claim.confidence * 100).toFixed(0) + '%' : 'N/A')}>
            <Text type="tertiary" style={{ fontSize: 12 }}>
              {claim.confidence != null ? (claim.confidence * 100).toFixed(0) + '%' : '-'}
            </Text>
          </Tooltip>
        </div>
        <Text>{claim.text}</Text>
        {claim.evidenceRefs && claim.evidenceRefs.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Text type="tertiary" style={{ fontSize: 12 }}>Evidence:</Text>
            {claim.evidenceRefs.map((ref) => (
              <Tag
                key={ref}
                color="indigo"
                style={{ cursor: onEvidenceClick ? 'pointer' : 'default' }}
                onClick={() => onEvidenceClick?.(ref)}
              >
                {ref}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClaimRenderer;
