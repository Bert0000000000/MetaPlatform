import { test, expect } from '@playwright/test';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('Knowledge base operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/kb/collections', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'kb-new', name: 'Ops Handbook', description: '', document_count: 0, status: 'active', config: { kind: 'GENERAL' } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'kb-1', name: 'Product Docs', description: 'Product knowledge base', document_count: 12, status: 'active', config: { kind: 'GENERAL' } }]) });
    });
  });

  test('lists knowledge bases and exposes create operation', async ({ page }) => {
    await page.goto('/knowledge');
    await expect(page.getByText('Product Docs')).toBeVisible();
    await page.locator('button').filter({ hasText: /\u65b0\u5efa\u77e5\u8bc6\u5e93/ }).click();
    await page.locator('#kbCode').fill('ops-handbook');
    await page.locator('#displayName').fill('Ops Handbook');
    await page.getByRole('dialog').getByRole('button', { name: 'confirm' }).click();
    await expect(page.getByText('已创建知识库')).toBeVisible();
  });

  test('documents tab loads real API data and supports search', async ({ page }) => {
    await page.route('**/api/v1/kb/documents?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'doc-1', collection_id: 'kb-1', filename: 'SLA.pdf', status: 'PROCESSED', chunk_count: 24, size_bytes: 2048 }]) });
    });
    await page.goto('/knowledge/docs');
    await page.locator('.semi-select').first().click();
    await page.getByText('Product Docs').last().click();
    await expect(page.getByText('SLA.pdf')).toBeVisible();
    await page.locator('input[placeholder]').last().fill('missing');
    await expect(page.getByText('SLA.pdf')).not.toBeVisible();
  });
});
