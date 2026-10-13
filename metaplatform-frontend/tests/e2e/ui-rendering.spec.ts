import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/ui-repair-api.json', import.meta.url), 'utf8')) as Record<string, unknown>;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mate_platform_token', 'isolated-ui-fixture');
    localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'ui-reader', username: 'UI校验', realName: 'UI校验', tenantId: 'ui-repair' }));
  });
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() !== 'GET') throw new Error('Rendering regression must not write business data');
    const path = new URL(route.request().url()).pathname;
    const payload = (fixtures as Record<string, unknown>)[path] ?? [];
    await route.fulfill({ json: payload });
  });
});

for (const width of [390, 768, 1024, 1440]) {
  test(`object models retain a usable list and reachable actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/ontology/model/object-types');
    await expect(page.getByRole('button', { name: '查看', exact: true }).first()).toBeAttached();
    const search = page.getByPlaceholder('搜索概念名称 / rid...');
    const bounds = await search.boundingBox();
    expect(bounds?.width).toBeGreaterThan(100);
    const table = page.locator('table.om-table');
    const usable = await table.evaluate(e => {
      let parent = e.parentElement;
      while (parent && parent.clientWidth < e.scrollWidth && getComputedStyle(parent).overflowX !== 'auto') parent = parent.parentElement;
      return !!parent && parent.clientWidth > 100 && (parent.clientWidth >= e.scrollWidth || getComputedStyle(parent).overflowX === 'auto');
    });
    expect(usable).toBe(true);
    await page.getByRole('button', { name: '查看', exact: true }).first().scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '查看', exact: true }).first()).toBeVisible();
    await page.screenshot({ path: `tests/e2e/.artifacts/ui-repair/object-types-${width}.png` });
  });
}

test('home onboarding controls fit the mobile content column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  await page.getByRole('button', { name: '接入真实数据', exact: true }).click();
  await expect(page.getByLabel('本次对象模型')).toBeVisible();
  const container = await page.getByRole('region', { name: '开始使用平台' }).boundingBox();
  const fields = await page.getByRole('region', { name: '开始使用平台' }).locator('select').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().toJSON()));
  expect(container).not.toBeNull();
  for (const field of fields) { expect(field.width).toBeGreaterThan(100); expect(field.right).toBeLessThanOrEqual(container!.x + container!.width + 1); }
  await page.screenshot({ path: 'tests/e2e/.artifacts/ui-repair/home-mobile.png' });
  await expect(page.getByText('3 项演示审批', { exact: false })).toBeVisible();
  await expect(page.getByText('演示审批 1', { exact: true })).toBeVisible();
  await expect(page.getByText('没有待办审批', { exact: true })).not.toBeVisible();
});

for (const width of [390, 1440]) {
  test(`publication controls remain styled and inside the content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/ontology/governance/drafts');
    const select = page.getByRole('combobox', { name: '目标草稿' });
    await expect(select).toBeEnabled();
    const section = await page.locator('.mp-publication').boundingBox();
    const field = await select.boundingBox();
    expect(field!.width).toBeGreaterThan(100);
    expect(field!.x + field!.width).toBeLessThanOrEqual(section!.x + section!.width + 1);
    const button = page.getByRole('button', { name: '刷新草稿' });
    await expect(button).toBeEnabled();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(32);
    await page.screenshot({ path: `tests/e2e/.artifacts/ui-repair/drafts-${width}.png` });
  });
}

test('failed summary does not expose a contradictory empty statistics card', async ({ page }) => {
  await page.route('**/dashboard/page/summary', route => route.fulfill({ status: 503, json: { message: '汇总暂不可用' } }));
  await page.goto('/home');
  await expect(page.getByText('工作台数据加载失败')).toBeVisible();
  await expect(page.getByText('暂无统计口径')).not.toBeVisible();
});

test('login starts with empty credentials and removes the obsolete default account hint', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('mate_platform_token');
    localStorage.removeItem('mate_platform_user');
  });
  await page.goto('/login');
  await expect(page.getByPlaceholder('用户名', { exact: true })).toHaveValue('');
  await expect(page.getByPlaceholder('密码', { exact: true })).toHaveValue('');
  await expect(page.getByText('请使用管理员提供的账号登录')).toBeVisible();
  await expect(page.getByText(/默认账号/)).not.toBeVisible();
});
