import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Space, Steps, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { CheckCircle2, ClipboardCheck, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { PageRoot } from '@mate/shared';
import {
  confirmActionProposal,
  createReviewCase,
  getActionProposal,
  listHighValueUnpaid,
  rejectActionProposal,
  type ActionProposal,
  type ActionResult,
  type ReviewOrder,
} from '@/api/superai/orderReview';
import OrderReviewEvidence from '@/pages/superai/components/OrderReviewEvidence';

const REVIEW_THRESHOLD_CENTS = 100_000;

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function statusLabel(status: ReviewOrder['review_status']): string {
  if (status === 'approved') return '已批准';
  return status === 'pending' ? '待复核' : status;
}

export default function OrderReviewPage() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [proposal, setProposal] = useState<ActionProposal>();
  const [result, setResult] = useState<ActionResult>();
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();

  const selectedOrder = useMemo(
    () => orders.find((order) => order.order_id === selectedOrderId),
    [orders, selectedOrderId],
  );
  const canConfirmProposal = proposal?.status === 'pending'
    && proposal.evidence?.status === 'complete'
    && proposal.evidence.recommendation.requires_confirmation === true;
  const confirmationMessage = !proposal
    ? undefined
    : !proposal.evidence
      ? '历史提案无证据快照，不能确认执行。'
      : proposal.evidence.status !== 'complete'
        ? `证据状态 ${proposal.evidence.status}，不能确认执行。`
        : proposal.evidence.recommendation.requires_confirmation !== true
          ? '当前建议不允许人工确认执行。'
          : undefined;

  const loadOrders = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const items = await listHighValueUnpaid(REVIEW_THRESHOLD_CENTS);
      setOrders(items);
      if (!selectedOrderId && items[0]) setSelectedOrderId(items[0].order_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '订单加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const generateSuggestion = async (order: ReviewOrder) => {
    setWorking(true);
    setError(undefined);
    setResult(undefined);
    try {
      const created = await createReviewCase({
        orderId: order.order_id,
        suggestion: {
          action: 'follow_up_payment',
        },
        sourceRefs: [],
      });
      setProposal(await getActionProposal(created.proposal_id));
      Toast.success('复核建议已生成，等待人工确认');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '复核建议生成失败');
    } finally {
      setWorking(false);
    }
  };

  const confirm = async () => {
    if (!proposal) return;
    setWorking(true);
    setError(undefined);
    try {
      const actionResult = await confirmActionProposal(
        proposal.proposal_id,
        `order-review-${proposal.proposal_id}`,
        'current-user',
      );
      setResult(actionResult);
      setProposal(await getActionProposal(proposal.proposal_id));
      await loadOrders();
      Toast.success('已确认并创建跟进单');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '确认执行失败');
    } finally {
      setWorking(false);
    }
  };

  const reject = async () => {
    if (!proposal) return;
    setWorking(true);
    setError(undefined);
    try {
      const actionResult = await rejectActionProposal(
        proposal.proposal_id,
        `order-review-reject-${proposal.proposal_id}`,
        'current-user',
        '人工复核后暂不执行',
      );
      setResult(actionResult);
      setProposal(await getActionProposal(proposal.proposal_id));
      Toast.success('已拒绝复核建议');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '拒绝操作失败');
    } finally {
      setWorking(false);
    }
  };

  return (
    <PageRoot>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Typography.Title heading={3} style={{ margin: 0 }}>订单复核</Typography.Title>
          <Typography.Text type="tertiary">
            SuperAI 基于服务端 evidence 快照生成建议，人工确认后通过 Action 更新订单并创建跟进单。
          </Typography.Text>
        </div>

        {error && (
          <div role="alert" style={{ padding: '10px 12px', color: 'var(--danger)', background: 'var(--danger-light, #fff1f2)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        <Card title="复核流程">
          <Steps current={result ? 3 : proposal ? 2 : selectedOrder ? 1 : 0} type="basic">
            <Steps.Step title="识别高价值未支付订单" />
            <Steps.Step title="生成 evidence 建议" />
            <Steps.Step title="人工确认 Action" />
            <Steps.Step title="订单更新与跟进单" />
          </Steps>
        </Card>

        <Card
          title={`高价值未支付订单（≥ ${formatAmount(REVIEW_THRESHOLD_CENTS)}）`}
          headerExtraContent={<Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void loadOrders()}>刷新</Button>}
        >
          {orders.length === 0 && !loading ? (
            <Empty description="当前没有待复核订单" />
          ) : (
            <Table
              rowKey="order_id"
              dataSource={orders}
              loading={loading}
              pagination={false}
              columns={[
                { title: '订单号', dataIndex: 'order_id' },
                { title: '金额', dataIndex: 'amount_cents', render: (value: number) => formatAmount(value) },
                { title: '支付状态', dataIndex: 'payment_status', render: () => <Tag color="orange">未支付</Tag> },
                { title: '复核状态', dataIndex: 'review_status', render: (value: ReviewOrder['review_status']) => <Tag color={value === 'approved' ? 'green' : 'orange'}>{statusLabel(value)}</Tag> },
                {
                  title: '操作',
                  render: (_: unknown, order: ReviewOrder) => (
                    <Button
                      data-testid={`review-order-${order.order_id}`}
                      theme="solid"
                      type="primary"
                      icon={<Sparkles size={14} />}
                      loading={working && selectedOrderId === order.order_id}
                      onClick={() => { setSelectedOrderId(order.order_id); void generateSuggestion(order); }}
                    >
                      生成复核建议
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Card>

        {proposal && (
          <Card data-testid="review-proposal" title="AI 复核建议" headerExtraContent={<Tag color={proposal.status === 'pending' ? 'orange' : 'green'}>{proposal.status}</Tag>}>
            <Space vertical align="start" style={{ width: '100%' }}>
              <Typography.Text strong>订单：{proposal.order_id}</Typography.Text>
              <OrderReviewEvidence evidence={proposal.evidence} />
              {proposal.status === 'pending' && confirmationMessage && <Typography.Text type="danger">{confirmationMessage}</Typography.Text>}
              <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
                proposal_id：{proposal.proposal_id}
              </Typography.Text>
              {proposal.status === 'pending' && (
                <Space>
                  <Button
                    theme="solid"
                    type="primary"
                    icon={<CheckCircle2 size={14} />}
                    loading={working}
                    disabled={!canConfirmProposal}
                    onClick={() => void confirm()}
                  >
                    确认执行
                  </Button>
                  <Button type="danger" icon={<XCircle size={14} />} loading={working} onClick={() => void reject()}>
                    拒绝建议
                  </Button>
                </Space>
              )}
            </Space>
          </Card>
        )}

        {result?.status === 'confirmed' && (
          <Card data-testid="review-result" title="Action 执行结果">
            <Space>
              <ClipboardCheck size={18} color="var(--success)" />
              <Typography.Text>订单已更新为已批准，版本 {result.order_version}；跟进单：{result.follow_up_task_id}</Typography.Text>
            </Space>
          </Card>
        )}
      </div>
    </PageRoot>
  );
}
