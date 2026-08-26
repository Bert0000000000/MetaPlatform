import { expect, test, type Page } from '@playwright/test';
import { GATEWAY, loginViaApi, trackApiFailures } from './helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

const MOCK_ORDER_ID = 'mock-order-review-1001';
const MOCK_PROPOSAL_ID = 'proposal-mock-order-review-1001';

function mockEvidence(
  status: 'complete' | 'unavailable' = 'complete',
  thresholdCents = 100_000,
) {
  return {
    schema_version: 'order-review-evidence.v1',
    status,
    proposal_id: MOCK_PROPOSAL_ID,
    order_id: MOCK_ORDER_ID,
    tenant_id: 'tenant-default',
    order_version: 7,
    captured_at: '2026-08-26T12:00:00Z',
    ontology: {
      source: 'ontology_kernel',
      model_rid: 'ont.tenant-default.obj.crm.order.v1',
      action_rid: 'ont.tenant-default.act.order-review-confirm.v1',
      graph: {
        nodes: [
          {
            id: `order-fact-anchor:${MOCK_ORDER_ID}`,
            type: 'transaction_anchor',
            label: `订单 ${MOCK_ORDER_ID}`,
            properties: { order_id: MOCK_ORDER_ID, source: 'order_review_orders', version: 7 },
          },
          {
            id: 'object-type:ont.tenant-default.obj.crm.order.v1',
            type: 'object_type',
            label: '订单',
            properties: { rid: 'ont.tenant-default.obj.crm.order.v1', version: 'v1' },
          },
          {
            id: 'action-type:ont.tenant-default.act.order-review-confirm.v1',
            type: 'action_type',
            label: '订单复核确认',
            properties: {
              rid: 'ont.tenant-default.act.order-review-confirm.v1',
              action_type: 'order_review_confirm',
            },
          },
        ],
        edges: [
          {
            id: 'order-instance-of-model',
            source: `order-fact-anchor:${MOCK_ORDER_ID}`,
            target: 'object-type:ont.tenant-default.obj.crm.order.v1',
            label: '符合对象模型',
          },
          {
            id: 'model-supports-action',
            source: 'object-type:ont.tenant-default.obj.crm.order.v1',
            target: 'action-type:ont.tenant-default.act.order-review-confirm.v1',
            label: '支持动作',
          },
        ],
      },
      legend: {
        transaction_anchor: '订单交易事实的语义锚点，不是已持久化的 Ontology Individual',
        object_type: '来自 Ontology Kernel 的正式对象模型',
        action_type: '来自 Ontology Kernel 的订单复核动作定义',
      },
    },
    data: {
      source: 'order_review_orders',
      captured_at: '2026-08-26T12:00:00Z',
      facts: [
        { id: 'fact.amount_cents', field: 'amount_cents', label: '订单金额', value: 250_000, display_value: '¥2,500.00', source: 'order_review_orders.amount_cents' },
        { id: 'fact.payment_status', field: 'payment_status', label: '支付状态', value: 'unpaid', display_value: '未支付', source: 'order_review_orders.payment_status' },
        { id: 'fact.review_status', field: 'review_status', label: '复核状态', value: 'pending', display_value: '待复核', source: 'order_review_orders.review_status' },
        { id: 'fact.version', field: 'version', label: '订单版本', value: 7, display_value: 'v7', source: 'order_review_orders.version' },
      ],
    },
    derivation: [
      {
        id: 'threshold',
        label: `订单金额 ≥ ¥${(thresholdCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        passed: true,
        fact_refs: ['fact.amount_cents'],
        details: { operator: '>=', expected_cents: thresholdCents },
      },
      {
        id: 'unpaid',
        label: '支付状态 = 未支付',
        passed: true,
        fact_refs: ['fact.payment_status'],
        details: { operator: '=', expected: 'unpaid' },
      },
      { id: 'eligible', label: '满足订单复核条件', passed: true, fact_refs: ['threshold', 'unpaid'] },
    ],
    recommendation: {
      action: 'follow_up_payment',
      title: '创建回款跟进单',
      reason: '订单金额 ¥2,500.00 且当前未支付，建议人工确认后创建回款跟进单。',
      requires_confirmation: true,
      derivation_refs: ['eligible'],
      source_refs: [
        'ontology://object-type/ont.tenant-default.obj.crm.order.v1',
        'ontology://action-type/ont.tenant-default.act.order-review-confirm.v1',
        'policy://payment-follow-up-policy',
      ],
      confidence: null,
    },
  };
}

function mockProposalPayload(overrides?: Record<string, unknown>) {
  return {
    tenant_id: 'tenant-default',
    proposal_id: MOCK_PROPOSAL_ID,
    review_case_id: 'review-case-mock-order-review-1001',
    order_id: MOCK_ORDER_ID,
    action_type: 'order_review_confirm',
    status: 'pending',
    expected_order_version: 7,
    parameters: {},
    suggestion: { action: 'follow_up_payment' },
    source_refs: [],
    expires_at: '2026-08-26T12:30:00Z',
    created_at: '2026-08-26T12:00:00Z',
    ...overrides,
  };
}

async function mockNegativeOrderReviewProposal(page: Page, proposalOverrides?: Record<string, unknown>) {
  await page.route('**/api/v1/orders/high-value-unpaid**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          tenant_id: 'tenant-default',
          order_id: MOCK_ORDER_ID,
          amount_cents: 250_000,
          payment_status: 'unpaid',
          review_status: 'pending',
          version: 7,
          updated_at: '2026-08-26T11:30:00Z',
        }],
        total: 1,
        threshold_cents: 100_000,
      }),
    });
  });
  await page.route('**/api/v1/review-cases', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        review_case_id: 'review-case-mock-order-review-1001',
        proposal_id: MOCK_PROPOSAL_ID,
        status: 'pending',
        expected_order_version: 7,
      }),
    });
  });
  await page.route(`**/api/v1/action-proposals/${MOCK_PROPOSAL_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProposalPayload(proposalOverrides)),
    });
  });
}

async function mockCreatedEvidenceWithDetailMissing(page: Page, action?: 'confirm' | 'reject') {
  await page.route('**/api/v1/orders/high-value-unpaid**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          tenant_id: 'tenant-default',
          order_id: MOCK_ORDER_ID,
          amount_cents: 250_000,
          payment_status: 'unpaid',
          review_status: 'pending',
          version: 7,
          updated_at: '2026-08-26T11:30:00Z',
        }],
        total: 1,
        threshold_cents: 200_000,
      }),
    });
  });
  await page.route('**/api/v1/review-cases', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        review_case_id: 'review-case-mock-order-review-1001',
        proposal_id: MOCK_PROPOSAL_ID,
        status: 'pending',
        expected_order_version: 7,
        evidence: mockEvidence('complete', 200_000),
      }),
    });
  });
  let proposalReads = 0;
  await page.route(`**/api/v1/action-proposals/${MOCK_PROPOSAL_ID}`, async (route) => {
    proposalReads += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProposalPayload(
        proposalReads > 1 && action
          ? { status: action === 'confirm' ? 'confirmed' : 'rejected' }
          : undefined,
      )),
    });
  });
  if (action === 'confirm') {
    await page.route(`**/api/v1/action-proposals/${MOCK_PROPOSAL_ID}:confirm`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal_id: MOCK_PROPOSAL_ID,
          order_id: MOCK_ORDER_ID,
          status: 'confirmed',
          order_version: 8,
          follow_up_task_id: 'task_mock_order_review_1001',
        }),
      });
    });
  }
  if (action === 'reject') {
    await page.route(`**/api/v1/action-proposals/${MOCK_PROPOSAL_ID}:reject`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal_id: MOCK_PROPOSAL_ID,
          order_id: MOCK_ORDER_ID,
          status: 'rejected',
        }),
      });
    });
  }
}

test('应用中心提供订单复核业务入口', async ({ page, request }) => {
  const { token } = await loginViaApi(page, request);
  const tracker = trackApiFailures(page);
  await page.goto('/apps');

  await expect(page.getByTestId('apphub-order-review')).toBeVisible();
  await page.getByTestId('apphub-open-order-review').click();
  await expect(page).toHaveURL(/\/superai\/order-review$/);
  await expect(page.getByRole('heading', { name: '订单复核' })).toBeVisible();
  expect(token).toBeTruthy();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});

test('SuperAI 订单复核黄金路径：建议、人工确认、Action 写回与跟进单', async ({ page, request }) => {
  test.setTimeout(120_000);
  const { token } = await loginViaApi(page, request);
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': 'tenant-default',
    'Content-Type': 'application/json',
    'X-Trace-Id': `e2e-order-review-${Date.now()}`,
  };
  const orderId = `e2e-order-review-${Date.now()}`;

  const createOrder = await request.post(`${GATEWAY}/orders`, {
    headers,
    data: { order_id: orderId, amount_cents: 250_000, payment_status: 'unpaid' },
  });
  expect(createOrder.status(), await createOrder.text()).toBe(201);

  const tracker = trackApiFailures(page);
  await page.goto('/superai/order-review');
  await expect(page.getByRole('heading', { name: '订单复核' })).toBeVisible();
  const rowAction = page.getByTestId(`review-order-${orderId}`);
  await expect(rowAction).toBeVisible({ timeout: 15_000 });
  await rowAction.click();

  await expect(page.getByTestId('review-proposal')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('review-evidence')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('ontology-node-order-model')).toBeVisible();
  await expect(page.getByTestId('ontology-node-order-model')).toContainText('订单');
  await expect(page.getByTestId('ontology-node-review-action')).toBeVisible();
  await expect(page.getByTestId('ontology-node-review-action')).toContainText('订单复核确认');
  await expect(page.getByTestId('ontology-edge-order-model')).toContainText('支持动作');
  await expect(page.getByTestId('ontology-legend')).toContainText('正式对象模型');
  await expect(page.getByTestId('review-fact-amount')).toContainText('¥2,500.00');
  await expect(page.getByTestId('review-fact-amount')).toContainText('order_review_orders.amount_cents');
  await expect(page.getByTestId('review-fact-payment-status')).toContainText('未支付');
  await expect(page.getByTestId('review-fact-payment-status')).toContainText('order_review_orders.payment_status');
  await expect(page.getByTestId('review-derivation-threshold')).toContainText('订单金额 ≥ ¥1,000.00');
  await expect(page.getByTestId('review-derivation-threshold')).toContainText('fact.amount_cents');
  await expect(page.getByTestId('review-derivation-threshold')).toContainText('expected_cents: 100000');
  await expect(page.getByTestId('review-derivation-eligible')).toContainText('满足订单复核条件');
  await expect(page.getByTestId('review-recommendation')).toContainText('创建回款跟进单');
  await page.getByRole('button', { name: '确认执行' }).click();

  await expect(page.getByTestId('review-result')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('跟进单：task_')).toBeVisible();
  await expect(page.getByText(/订单已更新为已批准/)).toBeVisible();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});

test('创建响应 evidence 在 proposal detail 暂缺时仍驱动复核 UI', async ({ page, request }) => {
  const { token } = await loginViaApi(page, request);
  await mockCreatedEvidenceWithDetailMissing(page);

  const tracker = trackApiFailures(page, 'created-evidence');
  await page.goto('/superai/order-review');
  await expect(page.getByText('高价值未支付订单（≥ ¥2,000.00）')).toBeVisible();
  await page.getByTestId(`review-order-${MOCK_ORDER_ID}`).click();

  await expect(page.getByTestId('review-evidence')).toContainText('captured_at: 2026-08-26T12:00:00Z');
  await expect(page.getByTestId('review-fact-amount')).toContainText('¥2,500.00');
  await expect(page.getByTestId('review-fact-amount')).toContainText('order_review_orders.amount_cents');
  await expect(page.getByTestId('review-fact-payment-status')).toContainText('未支付');
  await expect(page.getByTestId('review-derivation-threshold')).toContainText('expected_cents: 200000');
  await expect(page.getByRole('button', { name: '确认执行' })).toBeEnabled();
  expect(token).toBeTruthy();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});

test('确认后 proposal detail 缺少 evidence 时保留当前证据链', async ({ page }) => {
  await mockCreatedEvidenceWithDetailMissing(page, 'confirm');
  await page.goto('/superai/order-review');
  await page.getByTestId(`review-order-${MOCK_ORDER_ID}`).click();
  await page.getByRole('button', { name: '确认执行' }).click();

  await expect(page.getByTestId('review-result')).toBeVisible();
  await expect(page.getByTestId('review-evidence')).toContainText('captured_at: 2026-08-26T12:00:00Z');
  await expect(page.getByTestId('review-fact-amount')).toContainText('¥2,500.00');
});

test('拒绝后 proposal detail 缺少 evidence 时保留当前证据链', async ({ page }) => {
  await mockCreatedEvidenceWithDetailMissing(page, 'reject');
  await page.goto('/superai/order-review');
  await page.getByTestId(`review-order-${MOCK_ORDER_ID}`).click();
  await page.getByRole('button', { name: '拒绝建议' }).click();

  await expect(page.getByTestId('review-evidence')).toContainText('captured_at: 2026-08-26T12:00:00Z');
  await expect(page.getByTestId('review-fact-payment-status')).toContainText('未支付');
});

test('历史提案缺少 evidence 快照时展示结构化不可用状态且禁止确认', async ({ page, request }) => {
  const { token } = await loginViaApi(page, request);
  await mockNegativeOrderReviewProposal(page);

  const tracker = trackApiFailures(page, 'missing-evidence');
  await page.goto('/superai/order-review');
  await expect(page.getByRole('heading', { name: '订单复核' })).toBeVisible();

  const rowAction = page.getByTestId(`review-order-${MOCK_ORDER_ID}`);
  await expect(rowAction).toBeVisible({ timeout: 15_000 });
  await rowAction.click();

  await expect(page.getByTestId('review-proposal')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('review-evidence')).toBeVisible();
  await expect(page.getByTestId('review-evidence')).toContainText('历史提案无证据快照');
  await expect(page.getByRole('button', { name: '确认执行' })).toBeDisabled();
  await expect(page.getByTestId('ontology-node-order-model')).toHaveCount(0);
  expect(token).toBeTruthy();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});

test('evidence status unavailable 时展示结构化不可用状态且禁止确认', async ({ page, request }) => {
  const { token } = await loginViaApi(page, request);
  await mockNegativeOrderReviewProposal(page, {
    evidence: mockEvidence('unavailable'),
  });

  const tracker = trackApiFailures(page, 'unavailable-evidence');
  await page.goto('/superai/order-review');
  await expect(page.getByRole('heading', { name: '订单复核' })).toBeVisible();

  const rowAction = page.getByTestId(`review-order-${MOCK_ORDER_ID}`);
  await expect(rowAction).toBeVisible({ timeout: 15_000 });
  await rowAction.click();

  await expect(page.getByTestId('review-proposal')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('review-evidence')).toBeVisible();
  await expect(page.getByText('证据链暂不可用')).toBeVisible();
  await expect(page.getByRole('button', { name: '确认执行' })).toBeDisabled();
  await expect(page.getByTestId('ontology-node-order-model')).toHaveCount(0);
  expect(token).toBeTruthy();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});
