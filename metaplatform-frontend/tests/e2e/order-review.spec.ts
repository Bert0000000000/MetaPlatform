import { expect, test } from '@playwright/test';
import { GATEWAY, loginViaApi, trackApiFailures } from './helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

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
  await expect(page.getByText(`ontology://Order/${orderId}`)).toBeVisible();
  await page.getByRole('button', { name: '确认执行' }).click();

  await expect(page.getByTestId('review-result')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('跟进单：task_')).toBeVisible();
  await expect(page.getByText(/订单已更新为已批准/)).toBeVisible();
  expect(tracker.failures.length, tracker.report()).toBe(0);
});
