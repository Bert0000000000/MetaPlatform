/**
 * UI-P1c 验收用例：数字员工域（C 骨架卡片网格 + 6 个页内 tab）。
 *
 * 覆盖 UI-P1 通用 DoD：
 *  - 6 个域内 tab 都能在新壳内打开、非白屏
 *  - 员工 tab 是卡片网格 + 虚线「招聘新员工」卡，数据来自真实接口
 *  - 点卡片打开非模态详情浮层（SheetDetail），不跳走
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1c-agents
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const DOMAIN_TABS: Array<[string, string]> = [
  ['/agents', '员工'],
  ['/agents/external', '外部员工'],
  ['/agents/tasks', '任务中心'],
  ['/agents/collab', '协作编排'],
  ['/agents/evaluation', '能力评估'],
  ['/agents/documents', '文档处理'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  await expect(
    page.locator('.mp-page-head, .mp-tablepro, .mp-empty, .mp-agents-grid, .mp-agent-loading').first(),
  ).toBeVisible({ timeout: 25_000 });
}

test.describe('UI-P1c · 数字员工域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('6 个域内 tab 全部打开且非白屏', async ({ page }) => {
    for (const [path, label] of DOMAIN_TABS) {
      await gotoApp(page, path);
      // 页内主 tab 行由壳渲染（原 AgentsLayout 自带的 ModuleTabsLayout 已摘除）
      const bar = page.locator('.mp-pagetabs-line .semi-tabs-tab');
      await expect(bar.filter({ hasText: label }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.mp-page .mp-pagetabs')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('员工 tab：卡片网格 + 虚线「招聘新员工」卡', async ({ page }) => {
    await gotoApp(page, '/agents');

    await expect(page.locator('.mp-page-head-title')).toContainText('数字员工');
    await expect(page.locator('.mp-page-head-desc')).toContainText('名员工');

    // 卡片网格：至少一张员工卡 + 且必有虚线新建卡
    await expect
      .poll(async () => page.locator('.mp-agent-card-wrap').count(), { timeout: 25_000 })
      .toBeGreaterThan(0);
    await expect(page.locator('.mp-agents-new')).toBeVisible();
    await expect(page.locator('.mp-agents-new')).toContainText('招聘新员工');

    // 卡片含三列统计与操作行
    const card = page.locator('.mp-agent-card-wrap').first();
    await expect(card.locator('.mp-agent-stats')).toBeVisible();
    await expect(card.getByRole('button', { name: '详情' })).toBeVisible();
  });

  test('点员工卡「详情」打开非模态浮层（不跳走）', async ({ page }) => {
    await gotoApp(page, '/agents');
    await expect(page.locator('.mp-agent-card-wrap').first()).toBeVisible({ timeout: 25_000 });

    await page
      .locator('.mp-agent-card-wrap')
      .first()
      .getByRole('button', { name: '详情' })
      .click();

    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('员工详情');
    await expect(sheet.locator('.semi-descriptions')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/agents');

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/agents');
    await expect(page.locator('.mp-agent-card-wrap').first()).toBeVisible({ timeout: 25_000 });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1c-agents-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1c-agents-dark.png' });
  });
});
