/** Builder V2 workspace navigation; run against the isolated validation target. */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

const WORKSPACE_DOMAINS: Array<[string, string, string]> = [
  ['总览', '/ontology', '/ontology'],
  ['语义模型', '/ontology/model', '/ontology/model/graph'],
  ['数据映射', '/ontology/data', '/ontology/data/mappings'],
  ['对象与查询', '/ontology/explore', '/ontology/explore/objects'],
  ['动作与函数', '/ontology/logic', '/ontology/logic/actions'],
  ['发布与治理', '/ontology/governance', '/ontology/governance/drafts'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toBeVisible({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 工作区导航', () => {
  test.beforeEach(async ({ context, page }) => { await injectAuth(context, page); });

  test('六域均可达，工作区显示侧栏和上下文，planned 页面不进入导航', async ({ page }) => {
    for (const [label, , canonical] of WORKSPACE_DOMAINS) {
      await gotoApp(page, canonical);
      const nav = page.getByRole('navigation', { name: '本体工作区导航' });
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: '本体上下文' })).toContainText(label);
      await expect(page.locator('.mp-pagetabs')).toHaveCount(0);
      await expect(nav.getByText('保存的查询')).toHaveCount(0);
      await expect(nav.getByText('审批策略')).toHaveCount(0);
    }
  });

  test('点击关系类型后返回/前进保持 URL、高亮与面包屑', async ({ page }) => {
    await gotoApp(page, '/ontology/model/graph');
    const nav = page.getByRole('navigation', { name: '本体工作区导航' });
    await nav.getByRole('link', { name: '关系类型', exact: true }).click();
    await expect(page).toHaveURL(/\/ontology\/model\/link-types$/);
    await expect(nav.getByRole('link', { name: '关系类型', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: '本体上下文' })).toContainText('关系类型');
    await page.goBack();
    await expect(page).toHaveURL(/\/ontology\/model\/graph$/);
    await expect(nav.getByRole('link', { name: '模型工作台', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.goForward();
    await expect(nav.getByRole('link', { name: '关系类型', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('点击功能域打开真实默认页', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await page.getByRole('navigation', { name: '本体工作区导航' }).getByRole('link', { name: '动作与函数', exact: true }).click();
    await expect(page).toHaveURL(/\/ontology\/logic\/actions$/);
  });

  test('域根 redirect 到默认子页，总览别名保留', async ({ page }) => {
    for (const [, root, canonical] of WORKSPACE_DOMAINS.slice(1)) {
      await gotoApp(page, root);
      await expect.poll(() => new URL(page.url()).pathname).toBe(canonical);
    }
    await gotoApp(page, '/ontology/overview');
    await expect(page).toHaveURL(/\/ontology$/);
  });

  test('对象资源详情深链刷新保持，侧栏不错误高亮总览', async ({ page }) => {
    const path = '/ontology/model/object-types/ont.t.obj.customer.v1/properties';
    await gotoApp(page, path);
    const nav = page.getByRole('navigation', { name: '本体工作区导航' });
    await expect(nav.getByRole('link', { name: '对象类型', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: '总览', exact: true })).not.toHaveAttribute('aria-current');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await expect(nav.getByRole('link', { name: '对象类型', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('对象浏览刷新保持现有页面能力', async ({ page }) => {
    await gotoApp(page, '/ontology/explore/objects');
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible({ timeout: 20_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/ontology\/explore\/objects$/);
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible();
  });

  test('390px 可展开导航并通过键盘进入关系类型，无文档横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ontology/model/graph', { waitUntil: 'domcontentloaded' });
    const toggle = page.getByRole('button', { name: '展开本体导航' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const link = page.getByRole('navigation', { name: '本体工作区导航' }).getByRole('link', { name: '关系类型', exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ontology\/model\/link-types$/);
    await expect(page.getByRole('button', { name: '展开本体导航' })).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('离开本体后其他域仍显示 PageTabs', async ({ page }) => {
    await gotoApp(page, '/ontology/model/graph');
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.mp-pagetabs').getByRole('tab', { name: '概览', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
  });
});
