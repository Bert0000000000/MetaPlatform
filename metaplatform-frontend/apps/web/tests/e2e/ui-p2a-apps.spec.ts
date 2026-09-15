/**
 * UI-P2a 验收用例：应用中心域（C 骨架卡片网格 + 页内 4 主 tab）。
 *
 * 覆盖 UI-P1/P2 通用 DoD：
 *  - 4 个主 tab 由壳渲染（原 ApphubShellPage 自渲染的 SubTabs 已摘除），切换即路由
 *  - 卡片网格 + 虚线「创建应用」卡 + 模板市场入口 banner
 *  - 应用详情二级视图（详情/生命周期/版本）保留 ?app= 上下文
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p2a-apps
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const MAIN_TABS = [
  { label: '我的应用', path: '/apps/mine' },
  { label: '模板市场', path: '/apps/market' },
  { label: '我的模板', path: '/apps/templates' },
  { label: 'AI 设计器', path: '/apps/designer' },
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('UI-P2a · 应用中心域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('4 个主 tab 由壳渲染且切换即路由', async ({ page }) => {
    await gotoApp(page, '/apps/mine');

    const bar = page.locator('.mp-pagetabs-line .semi-tabs-tab');
    for (const t of MAIN_TABS) {
      await expect(bar.filter({ hasText: new RegExp(`^${t.label}$`) })).toBeVisible({ timeout: 20_000 });
    }

    for (const t of MAIN_TABS) {
      await bar.filter({ hasText: new RegExp(`^${t.label}$`) }).click();
      await expect(page).toHaveURL(new RegExp(`${t.path.replace(/\//g, '\\/')}$`));
    }

    // 页内不再有 apphub 自渲染的重复 tab 行
    await expect(page.locator('.mp-page .mp-pagetabs')).toHaveCount(0);
  });

  test('我的应用：卡片网格 + 虚线创建卡 + 模板市场入口 banner', async ({ page }) => {
    await gotoApp(page, '/apps/mine');

    await expect(page.locator('.mp-page-head-title')).toHaveText('应用中心');

    // 模板市场入口
    const banner = page.locator('.mp-apps-banner');
    await expect(banner).toContainText('模板市场');
    await banner.getByRole('button', { name: '浏览模板市场' }).click();
    await expect(page).toHaveURL(/\/apps\/market$/);

    await gotoApp(page, '/apps/mine');
    // 卡片网格：后端已注册应用非空，最后一张是虚线新建卡
    const cards = page.locator('.mp-apps-grid .semi-card');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(page.locator('.mp-apps-new')).toBeVisible();

    // 卡片渲染的是真实字段（名称 / 编码 / 分类 / 版本）
    await expect(cards.first().locator('.mp-app-name')).not.toBeEmpty();
    await expect(cards.first().locator('.mp-app-code')).not.toBeEmpty();
    await expect(cards.first().locator('.mp-app-meta')).toContainText('v');

    // 筛选栏：关键词过滤把网格收敛到 0 时给出空态而非空白
    await page.locator('.mp-filterbar-search input').fill('zzz-不存在的应用-zzz');
    await expect(page.locator('.mp-empty')).toBeVisible({ timeout: 10_000 });
  });

  test('应用详情二级视图保留 ?app= 上下文', async ({ page }) => {
    await gotoApp(page, '/apps/mine');

    const first = page.locator('.mp-apps-grid .semi-card').first();
    await expect(first).toBeVisible({ timeout: 20_000 });
    const name = (await first.locator('.mp-app-name').textContent())?.trim() ?? '';
    await first.locator('.mp-app-name').click();

    await expect(page).toHaveURL(/\/apps\/mine\?app=/);
    await expect(page.locator('.mp-app-subtabs .semi-tabs-tab').first()).toBeVisible({ timeout: 20_000 });

    // 二级视图：版本
    await page.locator('.mp-app-subtabs .semi-tabs-tab', { hasText: '版本' }).click();
    await expect(page).toHaveURL(/tab=versions/);
    await expect(page.locator('body')).not.toContainText('出错了');

    // 返回主 tab：我的应用 tab 仍高亮（主 tab 由路径决定，不受 ?tab= 影响）
    await expect(
      page.locator('.mp-pagetabs-line .semi-tabs-tab').filter({ hasText: /^我的应用$/ }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(name.length).toBeGreaterThan(0);
  });

  test('模板市场 / 我的模板 / AI 设计器均可打开且非白屏', async ({ page }) => {
    for (const path of ['/apps/market', '/apps/templates', '/apps/designer']) {
      await gotoApp(page, path);
      // 主 tab 命中（壳渲染，active 下划线 tab 可见）
      await expect(
        page.locator('.mp-pagetabs-line .semi-tabs-tab[aria-selected="true"]'),
      ).toBeVisible({ timeout: 25_000 });
      // 正文区有实际内容（助手面板收起时应为 hidden，故只查内容区）
      const content = page.locator('.mp-page .ai-assistant-workspace__content');
      await expect(content).toBeVisible({ timeout: 25_000 });
      await expect
        .poll(async () => ((await content.innerText()) ?? '').trim().length, { timeout: 25_000 })
        .toBeGreaterThan(20);
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/apps/mine');
    await expect(page.locator('.mp-apps-grid')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2a-apps-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2a-apps-dark.png' });
  });
});
