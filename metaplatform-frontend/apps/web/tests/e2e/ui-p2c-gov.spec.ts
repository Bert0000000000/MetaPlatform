/**
 * UI-P2c 验收用例：数据与治理域（4 主 tab × 子 tab 收编原 arch 20 页）。
 *
 * 覆盖 UI-P1/P2 通用 DoD：
 *  - 壳渲染 4 个主 tab + 胶囊子 tab，切换即路由（原 ArchLayout 自带导航已删除）
 *  - 每个主 tab 及其子页都能打开、非白屏、无报错边界
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p2c-gov
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/** 每个主 tab 抽 1–2 个子页。 */
const ROUTES: Array<{ path: string; main: string; sub?: string }> = [
  // 每个主 tab 的首个子 tab 路径 == 主 tab 路径，面包屑会去重 → 这些条目不断言第三级
  { path: '/gov/business', main: '业务架构' },
  { path: '/gov/business/processes', main: '业务架构', sub: '业务流程' },
  { path: '/gov/data', main: '数据架构' },
  { path: '/gov/data/assets', main: '数据架构', sub: '资产目录' },
  { path: '/gov/tech', main: '技术架构' },
  { path: '/gov/tech/radar', main: '技术架构', sub: '技术雷达' },
  { path: '/gov/governance', main: '治理' },
  { path: '/gov/governance/reviews', main: '治理', sub: '架构评审' },
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  await expect(
    page.locator('.mp-page-head, .mp-tablepro, .mp-empty, .mp-split, .mp-home-kpis').first(),
  ).toBeVisible({ timeout: 25_000 });
}

test.describe('UI-P2c · 数据与治理域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('主 tab + 子 tab 双行由壳渲染，切换即路由', async ({ page }) => {
    await gotoApp(page, '/gov/business');

    // 主 tab
    const mainBar = page.locator('.mp-pagetabs-line .semi-tabs-tab');
    for (const label of ['业务架构', '数据架构', '技术架构', '治理']) {
      await expect(mainBar.filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible({ timeout: 20_000 });
    }

    // 子 tab（胶囊）：业务架构下应出现业务能力/应用系统/…
    const subBar = page.locator('.mp-subtabs .semi-tabs-tab');
    await expect(subBar.filter({ hasText: '业务流程' })).toBeVisible({ timeout: 15_000 });
    await subBar.filter({ hasText: '业务流程' }).click();
    await expect(page).toHaveURL(/\/gov\/business\/processes$/);

    // 切主 tab：数据架构 → 子 tab 行换成数据架构的子集
    await mainBar.filter({ hasText: /^数据架构$/ }).click();
    await expect(page).toHaveURL(/\/gov\/data$/);
    await expect(page.locator('.mp-subtabs .semi-tabs-tab').filter({ hasText: '资产目录' })).toBeVisible({
      timeout: 15_000,
    });

    // 页内不再有 legacy ArchLayout 的导航（页内 tab 数为 0）
    await expect(page.locator('.mp-page .mp-pagetabs')).toHaveCount(0);
  });

  test('各主 tab 与子页均能打开且非白屏', async ({ page }) => {
    for (const { path, main, sub } of ROUTES) {
      await gotoApp(page, path);
      await expect(
        page.locator('.mp-pagetabs-line .semi-tabs-tab').filter({ hasText: new RegExp(`^${main}$`) }),
      ).toBeVisible({ timeout: 20_000 });
      // 面包屑含主 tab（子页时应含子 tab）
      await expect(page.locator('.mp-crumbs')).toContainText(main);
      if (sub) {
        await expect(page.locator('.mp-crumbs')).toContainText(sub);
      }
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/gov/business');
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2c-gov-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2c-gov-dark.png' });
  });
});
