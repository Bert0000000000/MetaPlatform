/**
 * UI-P1b 验收用例：工作台域（概览 bento + 6 个页内 tab）。
 *
 * 覆盖 UI-P1 通用 DoD：
 *  - /home 及 5 个 tab 都能在新壳内打开、非白屏
 *  - 概览 bento 的 KPI / 今日动态 / 快捷入口 / 数字员工状态来自真实接口
 *  - 待办审批卡要么是真实待办、要么是诚实空态（不出现 mock 数据）
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1b-home
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const HOME_TABS: Array<[string, string]> = [
  ['/home', '概览'],
  ['/home/todos', '待办'],
  ['/home/messages', '消息'],
  ['/home/deliverables', '交付物'],
  ['/home/apps', '我的应用'],
  ['/home/me', '我的'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  await expect(
    page.locator('.mp-page-head, .mp-tablepro, .mp-empty, .mp-home-kpis').first(),
  ).toBeVisible({ timeout: 25_000 });
}

test.describe('UI-P1b · 工作台域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('概览 + 5 个页内 tab 全部打开且非白屏', async ({ page }) => {
    for (const [path, label] of HOME_TABS) {
      await gotoApp(page, path);
      const bar = page.locator('.mp-pagetabs .semi-tabs-tab');
      // 精确匹配，避免「我的」命中「我的应用」
      await expect(bar.filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('概览 bento：KPI / 动态 / 入口 / 员工状态均为真实数据', async ({ page }) => {
    await gotoApp(page, '/home');

    // 页头问候语 + 日期
    await expect(page.locator('.mp-page-head-title')).toContainText('好，');
    await expect(page.locator('.mp-page-head-desc')).toContainText('年');

    // KPI 行：最多 4 张卡，每张有 label 与 value
    const kpis = page.locator('.mp-home-kpi');
    await expect
      .poll(async () => kpis.count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    expect(await kpis.count()).toBeLessThanOrEqual(4);
    await expect(kpis.first().locator('.mp-home-kpi-value')).not.toBeEmpty();

    // 四个版块齐备（按卡片锚点类断言，不依赖 Semi 内部类名）
    await expect(page.locator('.mp-home-card-feed')).toContainText('今日动态');
    await expect(page.locator('.mp-home-card-links')).toContainText('快捷入口');
    await expect(page.locator('.mp-home-card-todos')).toContainText('待办审批');
    await expect(page.locator('.mp-home-card-agents')).toContainText('数字员工状态');

    // 动态 / 状态 / 入口三块至少各有一个真实条目（本租户有数据）
    await expect(page.locator('.mp-home-card-feed .mp-home-feed-row').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.mp-home-card-agents .mp-home-agent').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.mp-home-card-links .mp-home-link').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('待办审批：真实待办可审批，无待办时是空态而非 mock', async ({ page }) => {
    await gotoApp(page, '/home');
    const card = page.locator('.mp-home-card-todos');
    // 等这一卡完成 loading →（待办 | 空态）。两种计数在同一次求值里取，避免跨次查询的竞态。
    const counts = () =>
      card.evaluate((el) => ({
        todo: el.querySelectorAll('.mp-home-todo').length,
        empty: el.querySelectorAll('.mp-empty').length,
      }));
    await expect.poll(async () => {
      const c = await counts();
      return c.todo + c.empty;
    }, { timeout: 25_000 }).toBeGreaterThan(0);

    const { todo: todoCount, empty: emptyCount } = await counts();
    if (todoCount > 0) {
      await expect(card.locator('.mp-home-todo').first().getByRole('button', { name: '通过' })).toBeVisible();
      await expect(card.locator('.mp-home-todo').first().getByRole('button', { name: '驳回' })).toBeVisible();
    } else {
      expect(emptyCount).toBeGreaterThan(0);
      await expect(card.locator('.mp-empty')).toContainText('没有待办审批');
    }
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/home');
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1b-home-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1b-home-dark.png' });
  });
});
