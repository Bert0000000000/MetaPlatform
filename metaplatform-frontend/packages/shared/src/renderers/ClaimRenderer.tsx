import React from 'react';
import { Tag, Card, Typography } from 'antd';
import { BulbOutlined, FileSearchOutlined, RobotOutlined } from '../icons';

/**
 * Claim 渲染器（P4.1.2）。
 *
 * <p>区分 Fact / Inference / Recommendation 三类。</p>
 */
export interface Claim {
  claimId?: string;
  type: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  content: string;
  confidence?: number;
  evidenceRefs?: string[];
}

const META: Record<Claim['type'], { color: string; icon: React.ReactNode; label: string }> = {
  FACT:           { color: 'blue',   icon: <FileSearchOutlined />, label: '事实' },
  INFERENCE:      { color: 'purple', icon: <RobotOutlined />,       label: '推断' },
  RECOMMENDATION: { color: 'orange', icon: <BulbOutlined />,       label: '建议' },
};

export function ClaimRenderer({ claim }: { claim: Claim }) {
  const meta = META[claim.type];
  return (
    <Card size="small" style={{ marginBottom: 8 }} bordered>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
        {claim.confidence != null && (
          <Tag>置信度 {(claim.confidence * 100).toFixed(0)}%</Tag>
        )}
      </div>
      <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{claim.content}</Typography.Paragraph>
    </Card>
  );
}
