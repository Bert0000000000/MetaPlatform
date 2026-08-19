// Visual proof spec for action orchestration — captures screenshots
// of each key UI state. Run with: pnpm exec playwright test visual-action.spec.ts
// Output: tests/e2e/.artifacts/visual-*.png

import { test, expect, type Page } from '@playwright/test';
import { mintMockToken } from './helpers/mock-jwt';

async function openActionTab(page: Page): Promise<void> {
  for (const re of [
    /\/api\/v1\/dashboard\/settings(\?|$)/,
    /\/api\/v1\/dashboard\/messages(\?|$)/,
    /\/api\/v1\/dashboard\/page\/summary(\?|$)/,
    /\/api\/v1\/dashboard\/deliverables\/summary(\?|$)/,
    /\/api\/v1\/iam\/sso-providers(\?|$)/,
    /\/api\/v1\/users\/me\/profile(\?|$)/,
    /\/api\/v1\/notifications\/unread(\?|$)/,
  ]) {
    await page.route(re, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  }
  const { token, user } = mintMockToken();
  await page.addInitScript(({ t, u }: { t: string; u: unknown }) => {
    localStorage.setItem('mate_platform_token', t);
    localStorage.setItem('mate_platform_user', JSON.stringify(u));
  }, { t: token, u: user });
  await page.goto('/ontology?tab=action');
  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[title^="ont.tenant-default.act."]').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Action 编排 · 视觉证据', () => {
  test.beforeEach(async ({ page, context }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await context.clearCookies();
  });

  test('01 主列表页', async ({ page }) => {
    await openActionTab(page);
    await page.screenshot({ path: 'tests/e2e/.artifacts/visual-01-main.png', fullPage: true });
  });

  test('02 流程编排 tab → demo flow 预览', async ({ page }) => {
    await openActionTab(page);
    await page.locator('button:has-text("流程编排")').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/e2e/.artifacts/visual-02-flow-tab.png', fullPage: true });
  });

  test('03 全屏编辑：节点库 + 工具栏', async ({ page }) => {
    await openActionTab(page);
    await page.locator('button:has-text("流程编排")').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });
    await page.locator('button:has-text("进入全屏编辑")').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/e2e/.artifacts/visual-03-fullscreen.png', fullPage: true });
  });

  test('04 自由布局切换：dropzone 挂载', async ({ page }) => {
    await openActionTab(page);
    await page.locator('button:has-text("流程编排")').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });
    await page.locator('button:has-text("进入全屏编辑")').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    // 切到自由布局
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.textContent || '').includes('自由布局')) as HTMLElement | undefined;
      if (!btn) return;
      const key = Object.keys(btn).find((k) => k.startsWith('__reactProps'));
      const props = (btn as unknown as Record<string, { onClick?: (e: unknown) => void }>)[key!];
      props.onClick?.({});
    });
    await expect(page.locator('[data-flowgram-dropzone]').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/e2e/.artifacts/visual-04-free-layout.png', fullPage: true });
  });
});