/**
 * Ontology IA v2 · 视觉与响应式验收（IA2-7 清理批）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §11.4：双主题 + 三视口（1024 / 1440 / 1920）
 * 不遮挡主内容；工作区导航可用。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

const SHOT_DIR = 'tests/e2e/screenshots';

/** 六大功能组代表页。 */
const PAGES: Array<[string, string]> = [
  ['/ontology', 'overview'],
  ['/ontology/model/object-types', 'model'],
  ['/ontology/data/mappings', 'data'],
  ['/ontology/explore/objects', 'explore'],
  ['/ontology/logic/actions', 'logic'],
  ['/ontology/governance/drafts', 'governance'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 视觉与响应式（IA2-7）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  for (const [width, label] of [[1024, '1024'], [1440, '1440'], [1920, '1920']] as const) {
    test(`${label}px：六大功能组代表页不遮挡主内容（左导航 + 无横向 PageTabs）`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const [path] of PAGES) {
        await gotoApp(page, path);
        const ok = await page.evaluate(() => {
          const nav = document.querySelector('.mp-onto-sidenav');
          const main = document.querySelector('.mp-onto-shell-main');
          if (!nav || !main) return { nav: !!nav, main: !!main, clear: false };
          const navRect = nav.getBoundingClientRect();
          const mainRect = main.getBoundingClientRect();
          return {
            nav: true,
            main: true,
            clear: mainRect.left >= navRect.right - 1,
            mainWidth: Math.round(mainRect.width),
          };
        });
        expect(ok.clear, `${path} @${width}px 主内容被左导航遮挡`).toBe(true);
        await expect(page.locator('.mp-pagetabs')).toHaveCount(0);
      }
    });
  }

  test('1024px 窄视口：侧栏收窄（不遮挡且仍可点）', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoApp(page, '/ontology');
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.mp-onto-sidenav');
      return el ? Math.round(el.getBoundingClientRect().width) : null;
    });
    expect(nav).not.toBeNull();
    expect(nav!).toBeLessThanOrEqual(200);
    // 导航链接仍可点击跳转
    await page.locator('.mp-onto-sidenav-link', { hasText: '对象类型' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/model/object-types');
  });

  test('六大功能组代表页双主题截图归档', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [path, name] of PAGES) {
      await gotoApp(page, path);
      await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOT_DIR}/ia2-final-${name}-light.png` });
      await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOT_DIR}/ia2-final-${name}-dark.png` });
    }
  });

  test('键盘可达：Tab 聚焦左导航链接后 Enter 跳转', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await page.locator('.mp-onto-sidenav-link', { hasText: '模型图谱' }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/model/graph');
  });
});
