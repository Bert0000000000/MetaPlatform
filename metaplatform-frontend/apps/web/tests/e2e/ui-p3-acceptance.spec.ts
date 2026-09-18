/**
 * UI-P3 验收收口用例。
 *
 * 1. 视觉基线：8 域 × 浅/深双主题截图归档到 tests/visual/ui-redesign/
 * 2. 交互验收：⌘K 全域跳转 / Copilot dock 任意页开合 / 详情 Sheet Esc 关闭 / 双主题切换
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p3-acceptance
 * 依赖：dev server 9250、gateway 8100。
 * 产物：docs/active/specs/2026-09-14-ui-redesign/UI-ACCEPTANCE.md 引用的截图。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/** 8 个域的代表页（每域取迁移后的入口 tab）。workspace 域用左侧导航做就绪标记。 */
const DOMAINS: Array<{ key: string; label: string; path: string; workspace?: boolean }> = [
  { key: '1-home', label: '工作台', path: '/home' },
  { key: '2-ontology', label: '本体', path: '/ontology/explore/objects', workspace: true },
  { key: '3-agents', label: '数字员工', path: '/agents' },
  { key: '4-superai', label: 'SuperAI', path: '/superai/chat' },
  { key: '5-apps', label: '应用中心', path: '/apps/mine' },
  { key: '6-ki', label: '知识与集成', path: '/ki/kb' },
  { key: '7-gov', label: '数据与治理', path: '/gov/business' },
  { key: '8-admin', label: '平台管理', path: '/admin/org/users' },
];

const SHOT_DIR = 'tests/visual/ui-redesign';

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('UI-P3 · 视觉基线（8 域 × 双主题）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  for (const d of DOMAINS) {
    test(`${d.label} 浅/深双主题截图`, async ({ page }) => {
      await gotoApp(page, d.path);
      // 等壳与页内容都就位（IA v2 起本体域是工作区：无横向 PageTabs，改看左导航）
      const ready = d.workspace
        ? page.locator('.mp-onto-sidenav-link')
        : page.locator('.mp-pagetabs-line .semi-tabs-tab');
      await expect(ready.first()).toBeVisible({ timeout: 25_000 });
      await expect(page.locator('body')).not.toContainText('出错了');

      await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOT_DIR}/${d.key}-light.png` });

      await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOT_DIR}/${d.key}-dark.png` });
    });
  }
});

test.describe('UI-P3 · 交互验收', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('⌘K 全域搜索：开合 / 过滤 / Enter 跳转', async ({ page }) => {
    await gotoApp(page, '/home');
    await page.keyboard.press('Control+k');
    const body = page.locator('.mp-cmdk-body');
    await expect(body).toBeVisible({ timeout: 15_000 });

    await page.locator('.mp-cmdk-field input').fill('对象类型');
    await expect(body.locator('.mp-cmdk-item').first()).toContainText('对象类型');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ontology\/model\/object-types$/);
  });

  test('Copilot dock 在任意页面开合', async ({ page }) => {
    for (const path of ['/home', '/gov/business', '/ki/mcp/tools']) {
      await gotoApp(page, path);
      await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'closed', { timeout: 20_000 });
      await page.locator('#app .mp-rail-foot button[aria-label="SuperAI Copilot"]').click();
      await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'open');
      await expect(page.locator('#app .mp-dock')).toBeVisible();
      await page.locator('#app .mp-rail-foot button[aria-label="SuperAI Copilot"]').click();
      await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'closed');
    }
  });

  test('详情 Sheet 非模态且 Esc 关闭（知识库列表）', async ({ page }) => {
    await gotoApp(page, '/ki/kb');
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    await rows.first().click();

    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    // mask=false：遮罩不存在，后方表格仍可交互
    await expect(page.locator('.semi-sidesheet-mask')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('双主题切换换的是同一套令牌的两组值', async ({ page }) => {
    await gotoApp(page, '/home');
    const read = () =>
      page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--semi-color-primary').trim());
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    const light = await read();
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    const dark = await read();
    expect(light).not.toBe(dark);
    expect(light.length).toBeGreaterThan(0);
    expect(dark.length).toBeGreaterThan(0);
  });
});
