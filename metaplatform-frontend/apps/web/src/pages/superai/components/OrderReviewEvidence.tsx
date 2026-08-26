import { useMemo } from 'react';
import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import SemiGraphCanvas, { type GraphEdgeSpec, type GraphNodeSpec } from '@/components/SemiGraphCanvas';
import type {
  EvidenceBundle,
  EvidenceDerivation,
  EvidenceFact,
  EvidenceGraphEdge,
  EvidenceGraphNode,
} from '@/api/superai/orderReview';

interface OrderReviewEvidenceProps {
  evidence?: EvidenceBundle | null;
}

const GRAPH_WORLD_WIDTH = 520;
const GRAPH_WORLD_HEIGHT = 240;

const GRAPH_POSITIONS: Record<string, { x: number; y: number; color: string; solid?: boolean }> = {
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

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPaymentStatus(value: unknown): string {
  if (value === 'paid') return '已支付';
  if (value === 'unpaid') return '未支付';
  return stringifyValue(value);
}

function factLabel(fact: EvidenceFact): string {
  return fact.label?.trim() || fact.field?.trim() || fact.id;
}

function factValue(fact: EvidenceFact): string {
  const key = fact.field ?? fact.id;
  if (key === 'amount_cents' || fact.id === 'fact.amount_cents') {
    if (typeof fact.value === 'number') return formatAmount(fact.value);
  }
  if (key === 'payment_status' || fact.id === 'fact.payment_status') {
    return formatPaymentStatus(fact.value);
  }
  if (fact.display_value?.trim()) return fact.display_value;
  return stringifyValue(fact.value);
}

function derivationLabel(item: EvidenceDerivation): string {
  return item.label?.trim() || item.id;
}

function derivationRefs(item: EvidenceDerivation): string[] {
  return item.fact_refs?.length ? item.fact_refs : (item.refs ?? []);
}

function legendEntries(legend: EvidenceBundle['ontology']['legend']): Array<{ key: string; value: string }> {
  if (typeof legend === 'string') {
    return [{ key: 'legend', value: legend }];
  }
  return Object.entries(legend).map(([key, value]) => ({ key, value }));
}

function edgeSource(edge: EvidenceGraphEdge): string | undefined {
  return typeof edge.from === 'string' ? edge.from : edge.source;
}

function edgeTarget(edge: EvidenceGraphEdge): string | undefined {
  return typeof edge.to === 'string' ? edge.to : edge.target;
}

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

    const orderedNodes = evidence.ontology.graph.nodes
      .filter((item): item is EvidenceGraphNode => typeof item?.id === 'string' && typeof item?.label === 'string')
      .filter((item) => typeof item.type === 'string' && item.type in GRAPH_POSITIONS);

    const nodes = orderedNodes.map((item) => {
        const position = GRAPH_POSITIONS[item.type as keyof typeof GRAPH_POSITIONS];
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

    const nodeIds = new Set(nodes.map((item) => item.id));
    const edges = evidence.ontology.graph.edges
      .filter((item): item is EvidenceGraphEdge => Boolean(edgeSource(item) && edgeTarget(item)))
      .map((item) => ({
        id: item.id,
        source: edgeSource(item)!,
        target: edgeTarget(item)!,
        label: item.label,
        width: 1.5,
      } satisfies GraphEdgeSpec))
      .filter((item) => nodeIds.has(item.source) && nodeIds.has(item.target));

    return {
      nodes,
      edges,
      orderModelLabel: orderedNodes.find((item) => item.type === 'object_type')?.label,
      reviewActionLabel: orderedNodes.find((item) => item.type === 'action_type')?.label,
    };
  }, [evidence]);

  if (!evidence || evidence.status !== 'complete' || !graph || graph.nodes.length !== 3 || graph.edges.length !== 2) {
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
              {graph.edges.map((item) => item.label ?? item.id ?? `${item.source}->${item.target}`).join(' / ')}
            </Tag>
          </Space>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Typography.Text strong>Legend</Typography.Text>
            {legendEntries(evidence.ontology.legend).map((entry) => (
              <Typography.Text key={entry.key} type="secondary" style={{ fontSize: 12 }}>
                {entry.value}
              </Typography.Text>
            ))}
          </div>
        </Card>

        <Card title="订单事实证据" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {evidence.data.facts.map((fact) => {
            const testId = FACT_TEST_IDS[fact.id] ?? FACT_TEST_IDS[fact.field ?? ''];
            return (
              <div
                key={fact.id}
                data-testid={testId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 1fr)',
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid var(--semi-color-border)',
                }}
              >
                <Typography.Text type="secondary">{factLabel(fact)}</Typography.Text>
                <Typography.Text>{factValue(fact)}</Typography.Text>
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
            <Typography.Text>{derivationLabel(item)}</Typography.Text>
            <Tag color={item.passed ? 'green' : 'red'}>{item.passed ? '通过' : '未通过'}</Tag>
            <Space wrap spacing="tight">
              {derivationRefs(item).map((ref) => (
                <Tag key={ref} color="white">
                  {ref}
                </Tag>
              ))}
            </Space>
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
