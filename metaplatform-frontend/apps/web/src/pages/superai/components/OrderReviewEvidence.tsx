import { useMemo } from 'react';
import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import SemiGraphCanvas, { type GraphEdgeSpec, type GraphNodeSpec } from '@/components/SemiGraphCanvas';
import type {
  EvidenceBundle,
  EvidenceGraphNode,
} from '@/api/superai/orderReview';

interface OrderReviewEvidenceProps {
  evidence?: EvidenceBundle | null;
}

const GRAPH_WORLD_WIDTH = 520;
const GRAPH_WORLD_HEIGHT = 240;

const GRAPH_POSITIONS: Record<EvidenceGraphNode['type'], { x: number; y: number; color: string; solid?: boolean }> = {
  transaction_anchor: { x: 100, y: 120, color: '#fa8c16' },
  object_type: { x: 260, y: 120, color: '#1677ff', solid: true },
  action_type: { x: 420, y: 120, color: '#52c41a', solid: true },
};

const FACT_TEST_IDS: Record<string, string> = {
  'fact.amount_cents': 'review-fact-amount',
  amount_cents: 'review-fact-amount',
  'fact.payment_status': 'review-fact-payment-status',
  payment_status: 'review-fact-payment-status',
};

const DERIVATION_TEST_IDS: Record<string, string> = {
  threshold: 'review-derivation-threshold',
  eligible: 'review-derivation-eligible',
};

function statusTitle(evidence?: EvidenceBundle | null): string {
  if (!evidence) return '历史提案无证据快照';
  if (evidence.status === 'unavailable') return '证据链暂不可用';
  return '证据结构暂不可渲染';
}

function statusDescription(evidence?: EvidenceBundle | null): string {
  if (!evidence) return '该提案创建时未保留 evidence 快照，因此只能查看提案状态，不能确认执行。';
  if (evidence.status === 'unavailable') return '服务端明确返回 evidence.status=unavailable，当前不渲染 Ontology 图回退视图。';
  return '当前 proposal evidence 缺少可渲染的图数据或事实数据。';
}

export default function OrderReviewEvidence({ evidence }: OrderReviewEvidenceProps) {
  const graph = useMemo(() => {
    if (!evidence || evidence.status !== 'complete') return null;

    const orderedNodes = evidence.ontology.graph.nodes;

    const nodes = orderedNodes.map((item) => {
      const position = GRAPH_POSITIONS[item.type];
      return {
        id: item.id,
        label: item.label,
        title: item.id,
        x: position.x,
        y: position.y,
        w: item.type === 'transaction_anchor' ? 148 : 164,
        h: 56,
        color: position.color,
        solid: position.solid,
      } satisfies GraphNodeSpec;
    });

    const edges = evidence.ontology.graph.edges
      .map((item) => ({
        id: item.id,
        source: item.source,
        target: item.target,
        label: item.label,
        width: 1.5,
      } satisfies GraphEdgeSpec));

    return {
      nodes,
      edges,
      orderModelLabel: orderedNodes.find((item) => item.type === 'object_type')?.label,
      reviewActionLabel: orderedNodes.find((item) => item.type === 'action_type')?.label,
    };
  }, [evidence]);

  if (!evidence || evidence.status !== 'complete' || !graph) {
    return (
      <div data-testid="review-evidence" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Space wrap>
          {evidence?.status && <Tag color="red">status: {evidence.status}</Tag>}
          {evidence?.captured_at && <Tag color="blue">captured_at: {evidence.captured_at}</Tag>}
          {typeof evidence?.order_version === 'number' && <Tag color="cyan">order_version: {evidence.order_version}</Tag>}
        </Space>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Typography.Text strong>{statusTitle(evidence)}</Typography.Text>
            <Typography.Text type="secondary">{statusDescription(evidence)}</Typography.Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="review-evidence" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Space wrap>
        <Tag color="green">status: {evidence.status}</Tag>
        <Tag color="blue">captured_at: {evidence.captured_at}</Tag>
        <Tag color="cyan">order_version: {evidence.order_version}</Tag>
      </Space>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Card title="Ontology 关系图" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Space wrap spacing="tight">
            <Tag color="grey">source: {evidence.ontology.source}</Tag>
            <Tag color="blue">model_rid: {evidence.ontology.model_rid}</Tag>
            <Tag color="green">action_rid: {evidence.ontology.action_rid}</Tag>
          </Space>
          <SemiGraphCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            worldWidth={GRAPH_WORLD_WIDTH}
            worldHeight={GRAPH_WORLD_HEIGHT}
            height={260}
            autoFit
            showGrid
          />
          <Space wrap>
            {graph.orderModelLabel && (
              <Tag color="blue" data-testid="ontology-node-order-model">
                {graph.orderModelLabel}
              </Tag>
            )}
            {graph.reviewActionLabel && (
              <Tag color="green" data-testid="ontology-node-review-action">
                {graph.reviewActionLabel}
              </Tag>
            )}
            <Tag color="grey" data-testid="ontology-edge-order-model">
              {graph.edges.map((item) => item.label).join(' / ')}
            </Tag>
          </Space>
          <div data-testid="ontology-legend" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Typography.Text strong>Legend</Typography.Text>
            {Object.entries(evidence.ontology.legend).map(([type, description]) => (
              <Typography.Text key={type} type="secondary" style={{ fontSize: 12 }}>
                {type}: {description}
              </Typography.Text>
            ))}
          </div>
        </Card>

        <Card title="订单事实证据" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {evidence.data.facts.map((fact) => {
            const testId = FACT_TEST_IDS[fact.id] ?? FACT_TEST_IDS[fact.field];
            return (
              <div
                key={fact.id}
                data-testid={testId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 1fr) minmax(120px, 1fr)',
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--semi-color-border)',
                }}
              >
                <Typography.Text type="secondary">{fact.label}</Typography.Text>
                <Typography.Text>{fact.display_value}</Typography.Text>
                <Typography.Text type="tertiary">来源：{fact.source}</Typography.Text>
              </div>
            );
          })}
        </Card>
      </div>

      <Card title="推导过程" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {evidence.derivation.map((item) => (
          <div
            key={item.id}
            data-testid={DERIVATION_TEST_IDS[item.id]}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 180px) minmax(90px, 120px) minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
              paddingBottom: 10,
              borderBottom: '1px solid var(--semi-color-border)',
            }}
          >
            <Typography.Text>{item.label}</Typography.Text>
            <Tag color={item.passed ? 'green' : 'red'}>{item.passed ? '通过' : '未通过'}</Tag>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Space wrap spacing="tight">
                {item.fact_refs.map((ref) => (
                  <Tag key={ref} color="white">
                    {ref}
                  </Tag>
                ))}
              </Space>
              {item.details && (
                <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                  {Object.entries(item.details)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(' · ')}
                </Typography.Text>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Card title="行动建议" data-testid="review-recommendation" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Space wrap>
          <Typography.Text strong>{evidence.recommendation.title}</Typography.Text>
          <Tag color={evidence.recommendation.requires_confirmation ? 'orange' : 'grey'}>
            {evidence.recommendation.requires_confirmation ? '需要人工确认' : '无需人工确认'}
          </Tag>
          {typeof evidence.recommendation.confidence === 'number' && (
            <Tag color="blue">confidence: {(evidence.recommendation.confidence * 100).toFixed(0)}%</Tag>
          )}
        </Space>
        <Typography.Paragraph style={{ margin: 0 }}>
          {evidence.recommendation.reason}
        </Typography.Paragraph>
        <Space wrap>
          {evidence.recommendation.source_refs.map((ref) => (
            <Tag key={ref} color="white">
              {ref}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
}
