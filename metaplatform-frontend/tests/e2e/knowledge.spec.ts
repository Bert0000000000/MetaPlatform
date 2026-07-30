import { test, expect } from '@playwright/test';

test.describe('Knowledge base operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mate_platform_token', 'e2e-token');
      localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'e2e-user', username: 'e2e', tenantId: 'tenant-default', roles: ['admin'] }));
    });
    await page.route('**/api/v1/kb/knowledge-bases', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'kb-new', kbCode: 'ops-handbook', displayName: 'Ops Handbook', kbKind: 'GENERAL', enabled: true, chunkCount: 0 }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'kb-1', kbCode: 'product-docs', displayName: 'Product Docs', kbKind: 'GENERAL', enabled: true, chunkCount: 12, description: 'Product knowledge base' }]) });
    });
  });

  test('lists knowledge bases and exposes create operation', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page.getByText('Product Docs')).toBeVisible();
    await page.locator('button').filter({ hasText: /\u65b0\u5efa\u77e5\u8bc6\u5e93/ }).click();
    await page.locator('#kbCode').fill('ops-handbook');
    await page.locator('#displayName').fill('Ops Handbook');
    await page.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(page.locator('.ant-message')).toContainText(/\u5df2\u521b\u5efa\u77e5\u8bc6\u5e93/);
  });

  test('documents tab loads real API data and supports search', async ({ page }) => {
    await page.route('**/api/v1/kb/documents?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'doc-1', kbId: 'kb-1', title: 'SLA.pdf', status: 'PROCESSED', chunkCount: 24, fileSize: 2048 }]) });
    });
    await page.goto('/knowledge/docs');
    await page.locator('.ant-select').first().click();
    await page.getByText('Product Docs').last().click();
    await expect(page.getByText('SLA.pdf')).toBeVisible();
    await page.locator('input[placeholder]').last().fill('missing');
    await expect(page.getByText('SLA.pdf')).not.toBeVisible();
  });
});
