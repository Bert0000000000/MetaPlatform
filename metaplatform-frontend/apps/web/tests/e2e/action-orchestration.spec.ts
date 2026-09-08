import { expect, test } from '@playwright/test';
import { injectAuth } from './helpers/auth';

test.describe('Action Orchestration local acceptance (PRD08)', () => {
  test('saves, publishes, runs, and reloads a tenant-owned Plan', async ({ page, context }) => {
    await injectAuth(context, page);
    const definitionId = `order-review-e2e-${Date.now()}`;

    await page.goto(`/wfe/action-orchestration/${definitionId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '行动编排' })).toBeVisible();
    await expect(page.getByLabel('Plan 画布')).toBeVisible();

    const orderIdInput = page.getByPlaceholder('输入 order_id');
    await expect(orderIdInput).toBeVisible();
    await orderIdInput.fill('order-e2e-001');
    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect(page.getByText('草稿已保存')).toBeVisible();

    await page.getByRole('button', { name: '发布', exact: true }).click();
    await expect(page.getByText('已发布版本 1')).toBeVisible();
    await expect(page.getByText('已发布 v1')).toBeVisible();

    await page.getByRole('button', { name: '启动运行' }).click();
    await expect(page.getByText(/运行已启动：run-/)).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('已发布 v1')).toBeVisible();
    await expect(orderIdInput).toHaveValue('order-e2e-001');
  });

  test('shows a recoverable stale-save conflict across two tabs', async ({ browser }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    const definitionId = `order-review-conflict-${Date.now()}`;

    await injectAuth(firstContext, firstPage);
    await injectAuth(secondContext, secondPage);
    await Promise.all([
      firstPage.goto(`/wfe/action-orchestration/${definitionId}`, { waitUntil: 'domcontentloaded' }),
      secondPage.goto(`/wfe/action-orchestration/${definitionId}`, { waitUntil: 'domcontentloaded' }),
    ]);

    await firstPage.getByPlaceholder('输入 order_id').fill('order-conflict-first');
    await firstPage.getByRole('button', { name: '保存草稿' }).click();
    await expect(firstPage.getByText('草稿已保存')).toBeVisible();

    await secondPage.getByPlaceholder('输入 order_id').fill('order-conflict-second');
    await secondPage.getByRole('button', { name: '保存草稿' }).click();
    await expect(secondPage.getByText('草稿已在另一处更新，请重新加载后再保存。')).toBeVisible();
    await secondPage.getByRole('button', { name: '重新加载' }).click();
    await expect(secondPage.getByPlaceholder('输入 order_id')).toHaveValue('order-conflict-first');

    await Promise.all([firstContext.close(), secondContext.close()]);
  });
});
