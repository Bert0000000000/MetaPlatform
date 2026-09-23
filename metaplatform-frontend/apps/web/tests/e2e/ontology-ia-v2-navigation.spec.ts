/**
 * Ontology IA v2 · 导航骨架验收（2026-09-24 tab 模式版）。
 *
 * <p>用户决策：本体导航回归与全站一致的横向 PageTabs（主 tab = 六大功能组 +
 * children 胶囊行）。IA v2 的正式 URL / redirect / 深链语义全部保留。
 *
 * <p>判据：PageTabs 渲染且无左侧导航遗留；六大组主 tab 可点击；子页胶囊行
 * 正确出现并高亮；域根 redirect；刷新保持；前进后退；⌘K 不变。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

/** 六大功能组：主 tab 文案 → 组根路径（redirect 到默认子页）。 */
const WORKSPACE_DOMAINS: Array<[string, string, string]> = [
  ['总览', '/ontology', '/ontology'],
  ['语义模型', '/ontology/model', '/ontology/model/object-types'],
  ['数据映射', '/ontology/data', '/ontology/data/mappings'],
  ['对象与查询', '/ontology/explore', '/ontology/explore/objects'],
  ['动作与函数', '/ontology/logic', '/ontology/logic/actions'],
  ['发布与治理', '/ontology/governance', '/ontology/governance/drafts'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · tab 模式导航', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('六大功能组以横向 PageTabs 呈现（无左侧导航遗留）', async ({ page }) => {
    for (const [label, , canonical] of WORKSPACE_DOMAINS) {
      await gotoApp(page, canonical);
      await expect(
        page.locator('.mp-pagetabs-line .semi-tabs-tab', { hasText: label }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('.mp-onto-sidenav')).toHaveCount(0);
      await expect(page.locator('.mp-onto-contextbar')).toHaveCount(0);
    }
  });

  test('子页胶囊行渲染并高亮当前子页', async ({ page }) => {
    await gotoApp(page, '/ontology/model/link-types');
    // 主 tab 高亮：语义模型
    await expect(
      page.locator('.mp-pagetabs-line .semi-tabs-tab-active', { hasText: '语义模型' }),
    ).toBeVisible({ timeout: 20_000 });
    // 子 tab 胶囊行：六个语义模型子页都在，当前高亮关系类型
    const sub = page.locator('.mp-subtabs .semi-tabs-tab');
    for (const label of ['对象类型', '关系类型', '接口', '公理', '模型图谱', '模型校验']) {
      await expect(sub.filter({ hasText: label })).toBeVisible({ timeout: 20_000 });
    }
    await expect(
      page.locator('.mp-subtabs .semi-tabs-tab-active', { hasText: '关系类型' }),
    ).toBeVisible();
  });

  test('点击主 tab 跳组根并 redirect 到默认子页', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await page.locator('.mp-pagetabs-line .semi-tabs-tab', { hasText: '动作与函数' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/logic/actions');
  });

  test('点击子 tab 即路由（对象类型 → 关系类型）', async ({ page }) => {
    await gotoApp(page, '/ontology/model/object-types');
    await page.locator('.mp-subtabs .semi-tabs-tab', { hasText: '公理' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/model/axioms');
  });

  test('域根 redirect 到默认子页', async ({ page }) => {
    for (const [, root, canonical] of WORKSPACE_DOMAINS.slice(1)) {
      await gotoApp(page, root);
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
        .toBe(canonical);
    }
  });

  test('刷新保持当前页面', async ({ page }) => {
    await gotoApp(page, '/ontology/explore/objects');
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible({ timeout: 20_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/explore/objects');
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible({ timeout: 20_000 });
  });

  test('浏览器后退 / 前进切换正确', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await gotoApp(page, '/ontology/explore/objects');
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology');
    await page.goForward();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/explore/objects');
  });
});
