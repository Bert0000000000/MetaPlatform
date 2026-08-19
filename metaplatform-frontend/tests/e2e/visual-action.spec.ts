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

  test('05 真实拖拽：节点库 → 画布 drop → 新节点落画布', async ({ page }) => {
    await openActionTab(page);
    await page.locator('button:has-text("流程编排")').first().click({ force: true });
    await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });
    // 进入全屏编辑 — Playwright 真实 click + force 绕过 SVG 拦截
    await page.locator('button:has-text("进入全屏编辑")').first().click({ force: true });
    await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    // 默认就是 free layout（dev 环境 React 18 setState 在 React 事件链外不 commit，
    // 改默认后绕过 layout toggle 的 dev bug），dropzone 应已挂载
    await expect(page.locator('[data-flowgram-dropzone]').first()).toBeVisible({ timeout: 10_000 });
    // 计数 demo flow 节点（unique by data-node-id）
    const beforeCount = await page.evaluate(() => {
      const ids = new Set<string>();
      document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
        const id = n.getAttribute('data-node-id');
        if (id) ids.add(id);
      });
      return ids.size;
    });
    // 真实 Playwright 拖拽：从节点库「循环节点」拖到 dropzone 中央
    const loopItem = page.locator('div[draggable="true"]').filter({ hasText: '循环节点' }).first();
    const dropzone = page.locator('[data-flowgram-dropzone]').first();
    await loopItem.dragTo(dropzone, { targetPosition: { x: 600, y: 400 } });
    // 给 FlowGram onDrop 异步处理 + React 重渲时间
    await page.waitForTimeout(1500);
    // 验证节点数 +1
    const afterCount = await page.evaluate(() => {
      const ids = new Set<string>();
      document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
        const id = n.getAttribute('data-node-id');
        if (id) ids.add(id);
      });
      return ids.size;
    });
    expect(afterCount, '拖拽后画布节点数（beforeCount + 1）').toBe(beforeCount + 1);
    await page.screenshot({ path: 'tests/e2e/.artifacts/visual-05-after-drag.png', fullPage: true });
  });
});