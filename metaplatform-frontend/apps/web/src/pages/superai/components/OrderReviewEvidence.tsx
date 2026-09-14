import { useMemo } from 'react';
import { Card, Col, Row, Tag, Typography } from '@douyinfe/semi-ui';
import SemiGraphCanvas, { type GraphEdgeSpec, type GraphNodeSpec } from '@/components/SemiGraphCanvas';
import type { EvidenceBundle, EvidenceGraphNode } from '@/api/superai/orderReview';

interface OrderReviewEvidenceProps {
  evidence?: EvidenceBundle | null;
}

const GRAPH_WORLD_WIDTH = 520;
const GRAPH_WORLD_HEIGHT = 240;

/**
 * 图节点配色统一取 DSM 主题令牌（SemiGraphCanvas 的 color 会直接作为
 * background/border 使用，故节点设为 solid，避免组件内部 `color + '33'`
 * 的 alpha 拼接对 CSS 变量失效）。
 */
const GRAPH_POSITIONS: Record<EvidenceGraphNode['type'], { x: number; y: number; color: string }> = {
  transaction_anchor: { x: 100, y: 120, color: 'var(--semi-color-warning)' },
  object_type: { x: 260, y: 120, color: 'var(--semi-color-primary)' },
  action_type: { x: 420, y: 120, color: 'var(--semi-color-success)' },
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
        solid: true,
      } satisfies GraphNodeSpec;
    });

    const edges = evidence.ontology.graph.edges.map(
      (item) =>
        ({
          id: item.id,
          source: item.source,
          target: item.target,
          label: item.label,
          width: 1.5,
        }) satisfies GraphEdgeSpec,
    );

    return {
      nodes,
      edges,
      orderModelLabel: orderedNodes.find((item) => item.type === 'object_type')?.label,
      reviewActionLabel: orderedNodes.find((item) => item.type === 'action_type')?.label,
    };
  }, [evidence]);

  if (!evidence || evidence.status !== 'complete' || !graph) {
    return (
      <div data-testid="review-evidence" className="mp-exec-col">
        <span className="mp-exec-chips">
          {evidence?.status ? (
            <Tag type="light" color="red">
              status: {evidence.status}
            </Tag>
          ) : null}
          {evidence?.captured_at ? (
            <Tag type="light" color="blue">
              captured_at: {evidence.captured_at}
            </Tag>
          ) : null}
          {typeof evidence?.order_version === 'number' ? (
            <Tag type="light" color="cyan">
              order_version: {evidence.order_version}
            </Tag>
          ) : null}
        </span>
        <Card>
          <div className="mp-exec-col">
            <Typography.Text strong>{statusTitle(evidence)}</Typography.Text>
            <Typography.Text type="secondary">{statusDescription(evidence)}</Typography.Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="review-evidence" className="mp-exec-col">
      <span className="mp-exec-chips">
        <Tag type="light" color="green">
          status: {evidence.status}
        </Tag>
        <Tag type="light" color="blue">
          captured_at: {evidence.captured_at}
        </Tag>
        <Tag type="light" color="cyan">
          order_version: {evidence.order_version}
        </Tag>
      </span>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="Ontology 关系图">
            <div className="mp-exec-col">
              <span className="mp-exec-chips">
                <Tag type="light">source: {evidence.ontology.source}</Tag>
                <Tag type="light" color="blue">
                  model_rid: {evidence.ontology.model_rid}
                </Tag>
                <Tag type="light" color="green">
                  action_rid: {evidence.ontology.action_rid}
                </Tag>
              </span>
              <SemiGraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                worldWidth={GRAPH_WORLD_WIDTH}
                worldHeight={GRAPH_WORLD_HEIGHT}
                height={260}
                autoFit
                showGrid
              />
              <span className="mp-exec-chips">
                {graph.orderModelLabel ? (
                  <Tag type="light" color="blue" data-testid="ontology-node-order-model">
                    {graph.orderModelLabel}
                  </Tag>
                ) : null}
                {graph.reviewActionLabel ? (
                  <Tag type="light" color="green" data-testid="ontology-node-review-action">
                    {graph.reviewActionLabel}
                  </Tag>
                ) : null}
                <Tag type="light" data-testid="ontology-edge-order-model">
                  {graph.edges.map((item) => item.label).join(' / ')}
                </Tag>
              </span>
              <div data-testid="ontology-legend" className="mp-exec-col">
                <Typography.Text strong>Legend</Typography.Text>
                {Object.entries(evidence.ontology.legend).map(([type, description]) => (
                  <Typography.Text key={type} type="secondary">
                    {type}: {description}
                  </Typography.Text>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        <Col span={10}>
          <Card title="订单事实证据">
            <div className="mp-exec-col">
              {evidence.data.facts.map((fact) => {
                const testId = FACT_TEST_IDS[fact.id] ?? FACT_TEST_IDS[fact.field];
                return (
                  <span key={fact.id} data-testid={testId} className="mp-exec-line">
                    <Typography.Text type="secondary">{fact.label}</Typography.Text>
                    <Typography.Text>{fact.display_value}</Typography.Text>
                    <Typography.Text type="tertiary">来源：{fact.source}</Typography.Text>
                  </span>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="推导过程">
        <div className="mp-exec-col">
          {evidence.derivation.map((item) => (
            <div key={item.id} data-testid={DERIVATION_TEST_IDS[item.id]} className="mp-exec-col">
              <span className="mp-exec-step-head">
                <span className="mp-exec-step-title">{item.label}</span>
                <Tag type="light" color={item.passed ? 'green' : 'red'}>
                  {item.passed ? '通过' : '未通过'}
                </Tag>
              </span>
              <span className="mp-exec-chips">
                {item.fact_refs.map((ref) => (
                  <Tag key={ref} type="light">
                    {ref}
                  </Tag>
                ))}
              </span>
              {item.details ? (
                <Typography.Text type="tertiary">
                  {Object.entries(item.details)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(' · ')}
                </Typography.Text>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card data-testid="review-recommendation" title="行动建议">
        <div className="mp-exec-col">
          <span className="mp-exec-step-head">
            <span className="mp-exec-step-title">{evidence.recommendation.title}</span>
            <Tag type="light" color={evidence.recommendation.requires_confirmation ? 'orange' : 'grey'}>
              {evidence.recommendation.requires_confirmation ? '需要人工确认' : '无需人工确认'}
            </Tag>
            {typeof evidence.recommendation.confidence === 'number' ? (
              <Tag type="light" color="blue">
                confidence: {(evidence.recommendation.confidence * 100).toFixed(0)}%
              </Tag>
            ) : null}
          </span>
          <Typography.Text>{evidence.recommendation.reason}</Typography.Text>
          <span className="mp-exec-chips">
            {evidence.recommendation.source_refs.map((ref) => (
              <Tag key={ref} type="light">
                {ref}
              </Tag>
            ))}
          </span>
        </div>
      </Card>
    </div>
  );
}
