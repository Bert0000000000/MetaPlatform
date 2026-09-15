import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Button, Card, Space, Steps, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { CheckCircle2, ClipboardCheck, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import {
  confirmActionProposal,
  createReviewCase,
  getActionProposalWithCreatedEvidence,
  getActionProposalWithExistingEvidence,
  listHighValueUnpaid,
  rejectActionProposal,
  type ActionProposal,
  type ActionResult,
  type ReviewOrder,
} from '@/api/superai/orderReview';
import { DataTablePro, EmptyState, PageHeader } from '@/components/skeleton';
import OrderReviewEvidence from '@/pages/superai/components/OrderReviewEvidence';

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function statusLabel(status: ReviewOrder['review_status']): string {
  if (status === 'approved') return '已批准';
  return status === 'pending' ? '待复核' : status;
}

/**
 * SuperAI · 订单复核（app 入口 /apps/order-review）。
 *
 * 数据面沿用 src/api/superai/orderReview：listHighValueUnpaid 列高价值未支付订单，
 * createReviewCase 生成 evidence 建议，confirm/reject 走 Action + 幂等键。
 * 这里是真实 HITL 链路：没有 evidence 快照或证据非 complete 时不允许确认执行。
 */
export default function OrderReviewPage() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [thresholdCents, setThresholdCents] = useState<number>();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [proposal, setProposal] = useState<ActionProposal>();
  const [result, setResult] = useState<ActionResult>();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.order_id === selectedOrderId),
    [orders, selectedOrderId],
  );

  const canConfirmProposal =
    proposal?.status === 'pending' &&
    proposal.evidence?.status === 'complete' &&
    proposal.evidence.recommendation.requires_confirmation === true;

  const confirmationMessage = !proposal
    ? undefined
    : !proposal.evidence
      ? '历史提案无证据快照，不能确认执行。'
      : proposal.evidence.status !== 'complete'
        ? `证据状态 ${proposal.evidence.status}，不能确认执行。`
        : proposal.evidence.recommendation.requires_confirmation !== true
          ? '当前建议不允许人工确认执行。'
          : undefined;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await listHighValueUnpaid();
      setOrders(response.items ?? []);
      setThresholdCents(response.threshold_cents);
      setSelectedOrderId((prev) => prev ?? response.items?.[0]?.order_id);
    } catch (cause) {
      setOrders([]);
      setLoadError(cause instanceof Error ? cause.message : '订单加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const generateSuggestion = useCallback(async (order: ReviewOrder) => {
    setWorking(true);
    setActionError('');
    setResult(undefined);
    try {
      const created = await createReviewCase({
        orderId: order.order_id,
        suggestion: { action: 'follow_up_payment' },
        sourceRefs: [],
      });
      setProposal(await getActionProposalWithCreatedEvidence(created.proposal_id, created.evidence));
      Toast.success('复核建议已生成，等待人工确认');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '复核建议生成失败');
      Toast.error('复核建议生成失败');
    } finally {
      setWorking(false);
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!proposal) return;
    setWorking(true);
    setActionError('');
    try {
      const actionResult = await confirmActionProposal(
        proposal.proposal_id,
        `order-review-${proposal.proposal_id}`,
        'current-user',
      );
      setResult(actionResult);
      setProposal(await getActionProposalWithExistingEvidence(proposal.proposal_id, proposal.evidence));
      await loadOrders();
      Toast.success('已确认并创建跟进单');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '确认执行失败');
      Toast.error('确认执行失败');
    } finally {
      setWorking(false);
    }
  }, [proposal, loadOrders]);

  const reject = useCallback(async () => {
    if (!proposal) return;
    setWorking(true);
    setActionError('');
    try {
      const actionResult = await rejectActionProposal(
        proposal.proposal_id,
        `order-review-reject-${proposal.proposal_id}`,
        'current-user',
        '人工复核后暂不执行',
      );
      setResult(actionResult);
      setProposal(await getActionProposalWithExistingEvidence(proposal.proposal_id, proposal.evidence));
      Toast.success('已拒绝复核建议');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '拒绝操作失败');
      Toast.error('拒绝操作失败');
    } finally {
      setWorking(false);
    }
  }, [proposal]);

  const columns: ColumnProps<ReviewOrder>[] = useMemo(
    () => [
      { title: '订单号', dataIndex: 'order_id', width: 200, ellipsis: true },
      {
        title: '金额',
        dataIndex: 'amount_cents',
        width: 140,
        render: (value: number) => formatAmount(value),
      },
      {
        title: '支付状态',
        dataIndex: 'payment_status',
        width: 110,
        render: () => (
          <Tag size="small" type="light" color="orange">
            未支付
          </Tag>
        ),
      },
      {
        title: '复核状态',
        dataIndex: 'review_status',
        width: 110,
        render: (value: ReviewOrder['review_status']) => (
          <Tag size="small" type="light" color={value === 'approved' ? 'green' : 'orange'}>
            {statusLabel(value)}
          </Tag>
        ),
      },
      {
        title: '操作',
        width: 150,
        render: (_: unknown, order: ReviewOrder) => (
          <Button
            data-testid={`review-order-${order.order_id}`}
            theme="solid"
            type="primary"
            size="small"
            icon={<Sparkles size={14} strokeWidth={1.5} />}
            loading={working && selectedOrderId === order.order_id}
            onClick={() => {
              setSelectedOrderId(order.order_id);
              void generateSuggestion(order);
            }}
          >
            生成复核建议
          </Button>
        ),
      },
    ],
    [working, selectedOrderId, generateSuggestion],
  );

  return (
    <>
      <PageHeader
        title="订单复核"
        desc="SuperAI 基于服务端 evidence 快照生成建议，人工确认后通过 Action 更新订单并创建跟进单。"
        actions={
          <Button
            icon={<RefreshCw size={15} strokeWidth={1.5} />}
            loading={loading}
            onClick={() => void loadOrders()}
          >
            刷新
          </Button>
        }
      />

      {loadError ? (
        <EmptyState
          illustration="failure"
          title="订单加载失败"
          desc={loadError}
          actions={
            <Button theme="solid" type="primary" onClick={() => void loadOrders()}>
              重试
            </Button>
          }
        />
      ) : (
        <>
          <Card title="复核流程">
            <Steps current={result ? 3 : proposal ? 2 : selectedOrder ? 1 : 0} type="basic">
              <Steps.Step title="识别高价值未支付订单" />
              <Steps.Step title="生成 evidence 建议" />
              <Steps.Step title="人工确认 Action" />
              <Steps.Step title="订单更新与跟进单" />
            </Steps>
          </Card>

          {actionError ? <Banner type="danger" closeIcon={null} description={actionError} /> : null}

          <Card
            title={
              thresholdCents === undefined
                ? '高价值未支付订单'
                : `高价值未支付订单（≥ ${formatAmount(thresholdCents)}）`
            }
          >
            <DataTablePro<ReviewOrder>
              columns={columns}
              dataSource={orders}
              rowKey="order_id"
              loading={loading}
              columnSettings={false}
              empty={
                <EmptyState
                  illustration="no-content"
                  title="当前没有待复核订单"
                  desc="出现高价值未支付订单后，会在这里列出。"
                />
              }
            />
          </Card>

          {proposal ? (
            <Card
              data-testid="review-proposal"
              title="AI 复核建议"
              headerExtraContent={
                <Tag type="light" color={proposal.status === 'pending' ? 'orange' : 'green'}>
                  {proposal.status}
                </Tag>
              }
            >
              <div className="mp-exec-col">
                <Typography.Text strong>订单：{proposal.order_id}</Typography.Text>
                <OrderReviewEvidence evidence={proposal.evidence} />
                {proposal.status === 'pending' && confirmationMessage ? (
                  <Banner type="warning" closeIcon={null} description={confirmationMessage} />
                ) : null}
                <Typography.Text type="tertiary">proposal_id：{proposal.proposal_id}</Typography.Text>
                {proposal.status === 'pending' ? (
                  <div className="mp-exec-step-actions">
                    <Button
                      theme="solid"
                      type="primary"
                      icon={<CheckCircle2 size={14} strokeWidth={1.5} />}
                      loading={working}
                      disabled={!canConfirmProposal}
                      onClick={() => void confirm()}
                    >
                      确认执行
                    </Button>
                    <Button
                      type="danger"
                      icon={<XCircle size={14} strokeWidth={1.5} />}
                      loading={working}
                      onClick={() => void reject()}
                    >
                      拒绝建议
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {result?.status === 'confirmed' ? (
            <Card data-testid="review-result" title="Action 执行结果">
              <Space>
                <ClipboardCheck size={18} strokeWidth={1.5} color="var(--semi-color-success)" />
                <Typography.Text>
                  订单已更新为已批准，版本 {result.order_version}；跟进单：{result.follow_up_task_id}
                </Typography.Text>
              </Space>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
