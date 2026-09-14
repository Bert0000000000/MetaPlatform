import { Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import { CheckCircleOutlined, BulbOutlined, ThunderboltOutlined } from '@mate/shared';
import type { Claim } from '@/api/superai/types';

const { Text } = Typography;

export interface ClaimRendererProps {
  claim: Claim;
  onEvidenceClick?: (evidenceId: string) => void;
}

/** claim 类型 → 语义色与图标的样式类（颜色全在 CSS 里）。 */
const CLAIM_META: Record<string, { cls: string; color: 'green' | 'blue' | 'orange' }> = {
  FACT: { cls: 'is-fact', color: 'green' },
  INFERENCE: { cls: 'is-inference', color: 'blue' },
  RECOMMENDATION: { cls: 'is-recommendation', color: 'orange' },
};

/**
 * P4.5 ClaimRenderer - 渲染单条 Claim（FACT / INFERENCE / RECOMMENDATION）：
 * 类型徽标 + 置信度 + 可点击的 evidence 引用。
 */
export function ClaimRenderer({ claim, onEvidenceClick }: ClaimRendererProps) {
  const meta = CLAIM_META[claim.type] ?? { cls: '', color: 'blue' as const };

  const icon = (() => {
    switch (claim.type) {
      case 'FACT':
        return <CheckCircleOutlined />;
      case 'RECOMMENDATION':
        return <ThunderboltOutlined />;
      default:
        return <BulbOutlined />;
    }
  })();

  const confidenceText = claim.confidence != null ? `${(claim.confidence * 100).toFixed(0)}%` : '-';

  return (
    <div className="mp-claim" data-claim-id={claim.claimId}>
      <span className={`mp-claim-icon ${meta.cls}`}>{icon}</span>
      <div className="mp-claim-main">
        <div className="mp-claim-head">
          <Tag color={meta.color} type="light">
            {claim.type}
          </Tag>
          <Tooltip content={`Confidence: ${confidenceText}`}>
            <Text type="tertiary" className="mp-claim-conf">
              {confidenceText}
            </Text>
          </Tooltip>
        </div>
        <Text>{claim.text}</Text>
        {claim.evidenceRefs && claim.evidenceRefs.length > 0 ? (
          <div className="mp-claim-refs">
            <Text type="tertiary" className="mp-claim-conf">
              Evidence:
            </Text>
            {claim.evidenceRefs.map((ref) => (
              <Tag
                key={ref}
                color="indigo"
                type="light"
                className={`mp-claim-ref${onEvidenceClick ? '' : ' is-static'}`}
                onClick={() => onEvidenceClick?.(ref)}
              >
                {ref}
              </Tag>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ClaimRenderer;
