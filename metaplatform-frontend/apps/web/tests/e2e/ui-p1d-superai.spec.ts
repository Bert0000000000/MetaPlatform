/**
 * UI-P1d 验收用例：SuperAI 域（5 个页内 tab + 执行计划 D 骨架 + 全局 Copilot dock）。
 *
 * 覆盖 UI-P1 通用 DoD：
 *  - 5 个域内 tab 都能在新壳内打开、非白屏
 *  - 执行计划：计划列表来自真实接口，点行进入 D 骨架详情（状态卡 + 步骤），
 *    stub 后端如实给出说明条而不是编造进度
 *  - Copilot dock：可开合、上下文条跟随路由、能发出消息（agent 流为真实 SSE）
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1d-superai
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const DOMAIN_TABS: Array<[string, string]> = [
  ['/superai/chat', '会话'],
  ['/superai/plans', '执行计划'],
  ['/superai/schedules', '意图与调度'],
  ['/superai/cost', '成本优化'],
  ['/superai/templates', '任务模板'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  await expect(
    page.locator('.mp-page-head, .mp-tablepro, .mp-empty, .mp-exec-kpis, .mp-exec-loading, .mp-split').first(),
  ).toBeVisible({ timeout: 25_000 });
}

test.describe('UI-P1d · SuperAI 域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('5 个域内 tab 全部打开且非白屏', async ({ page }) => {
    for (const [path, label] of DOMAIN_TABS) {
      await gotoApp(page, path);
      const bar = page.locator('.mp-pagetabs .semi-tabs-tab');
      await expect(bar.filter({ hasText: label }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('执行计划：列表 → D 骨架详情（含 stub 说明条，不编造进度）', async ({ page }) => {
    await gotoApp(page, '/superai/plans');

    // 列表来自真实接口
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect.poll(async () => rows.count(), { timeout: 25_000 }).toBeGreaterThan(0);

    await rows.first().click();

    // D 骨架：状态卡 + 真实步骤名
    await expect(page.locator('.mp-exec-kpis')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.mp-exec-step-title').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // 后端为 stub 时给出如实说明；契约齐备时不显示
    const banner = page.locator('.semi-banner');
    if ((await banner.count()) > 0) {
      await expect(banner).toContainText('stub');
    }

    // 详情页不出现伪造的进度百分比
    await expect(page.locator('.mp-exec-kpi-label', { hasText: '总进度' })).toHaveCount(0);
  });

  test('Copilot dock：开合 + 上下文条跟随路由 + 能发出消息', async ({ page }) => {
    await gotoApp(page, '/ontology/explorer');

    // 打开 dock
    await page.locator('#app .mp-rail-foot button[aria-label="SuperAI Copilot"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'open');
    await expect(page.locator('#app .mp-dock')).toBeVisible();

    // 上下文条读取当前路由（域 / 页内 tab）
    await expect(page.locator('#app .mp-dock-ctx')).toContainText('本体');

    // 发一条消息：用户气泡必须出现（assistant 回复依赖真实 SSE，允许慢）
    await page.locator('.mp-dock-textarea').fill('有哪些客户');
    await page.locator('.mp-dock-send').click();
    await expect(page.locator('.mp-dock-msg.is-user')).toContainText('有哪些客户');

    // 收起
    await page.locator('#app .mp-dock-head button[aria-label="收起 Copilot"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'closed');
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/superai/plans');
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1d-superai-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1d-superai-dark.png' });
  });
});
