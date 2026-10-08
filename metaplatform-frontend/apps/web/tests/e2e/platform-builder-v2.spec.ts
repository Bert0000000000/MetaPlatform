import { expect, test } from '@playwright/test';
import { builderAuth } from './helpers/builder-auth';
import { platformBoundary } from './helpers/platform-boundary';

test.beforeEach(async ({ page }) => { await builderAuth(page); });
test('HTTP boundary: summary and approvals retry independently, app references retain directory, activation is truthful', async ({ page }) => {
  const reads = await platformBoundary(page);
  await page.goto('/home');
  await expect(page.getByText('HTTP 边界统计')).toBeVisible();
  await expect(page.getByText('审批边界读取失败', { exact: true })).toBeVisible();
  await expect(page.getByText('没有待办审批')).toHaveCount(0);
  await page.getByRole('button', { name: '重试审批' }).click();
  await expect(page.getByText('没有待办审批')).toBeVisible();
  expect(reads.get('/api/v1/dashboard/page/summary')).toBe(1);
  await page.getByRole('navigation', { name: '平台导航' }).getByRole('link', { name: '业务应用' }).click();
  await expect(page.getByRole('button', { name: 'HTTP 边界应用', exact: true })).toBeVisible();
  await expect(page.getByText('分类边界读取失败', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试分类' }).click();
  await page.getByRole('button', { name: '重试业务域' }).click();
  await expect(page.getByText('分类边界读取失败', { exact: true })).toHaveCount(0);
  expect(reads.get('/api/v1/apphub/apps')).toBe(1);
  await expect(page.getByRole('button', { name: '设计应用', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '平台导航' }).getByRole('link', { name: '数字员工' }).click();
  await expect(page.getByText('1 名员工 · 1 名已启用')).toBeVisible();
  await expect(page.getByRole('button', { name: '配置员工' })).toBeVisible();
});

test('HTTP boundary: session, dialogue and actual context stay reachable without model claims', async ({ page }) => {
  await platformBoundary(page);
  await page.goto('/superai/chat');
  await expect(page.getByRole('heading', { name: '会话工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'HTTP 边界会话', exact: true })).toBeVisible();
  await expect(page.getByText('实际 DTO 会话内容')).toBeVisible();
  await expect(page.getByRole('complementary', { name: '运行上下文' })).toContainText('模型配置未读取或不可用');
  await page.getByRole('button', { name: '运行上下文', exact: true }).click();
  await expect(page.getByRole('complementary', { name: '运行上下文' })).toHaveCount(0);
});

for (const width of [1440, 1920, 1024, 390]) test(`HTTP boundary: seven entry page patterns and SuperAI at ${width}px`, async ({ page }) => {
  await platformBoundary(page);
  await page.setViewportSize({ width, height: 1000 });
  const paths = ['/home', '/apps/mine', '/ontology/explore/objects', '/ontology/model/graph', '/agents', '/ki/kb', '/gov/business', '/superai/chat'];
  for (const route of paths) {
    await page.goto(route);
    await expect(page.getByRole('navigation', { name: '工作区功能组' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    if (route === '/home') await expect(page.getByText('HTTP 边界统计')).toBeVisible();
    if (route === '/apps/mine') await expect(page.getByRole('button', { name: 'HTTP 边界应用', exact: true })).toBeVisible();
    if (route === '/agents') await expect(page.getByText('1 名员工 · 1 名已启用')).toBeVisible();
    if (route === '/superai/chat') await expect(page.getByText('实际 DTO 会话内容')).toBeVisible();
    if (route === '/ki/kb') await expect(page.getByText('知识库加载失败', { exact: true })).toBeVisible();
    if (route === '/gov/business') await expect(page.getByText('业务架构加载失败', { exact: true })).toBeVisible();
    if (route === '/ontology/explore/objects') await expect(page.locator('.mp-explorer-tree .semi-tree-option').first()).toBeVisible();
    if (route === '/ontology/model/graph') await expect(page.getByText('模型关系图', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (route !== '/ontology/model/graph') await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`${route.replaceAll('/', '-').slice(1)}-${width}.png`) });
  }
});

test('real provider negative cache: editor relogin link reaches usable login despite incomplete historical ID', async ({ page }) => {
  await builderAuth(page, true);
  await page.goto('/ontology/model/object-types?create=true');
  const editor = page.getByRole('dialog', { name: '模型编辑器' });
  await expect(editor.getByRole('alert')).toContainText('身份不可用');
  await editor.getByRole('link', { name: '重新登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('shared-login-submit')).toBeVisible();
});

test('real signed settings: theme and navigation preference survive reload and restore original choice', async ({ page }) => {
  await platformBoundary(page);
  await page.goto('/home');
  await expect(page.getByText('HTTP 边界统计')).toBeVisible();
  const original = await page.locator('body').getAttribute('theme-mode');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await expect.poll(() => page.locator('body').getAttribute('theme-mode')).not.toBe(original);
  const changed = await page.locator('body').getAttribute('theme-mode');
  await page.getByRole('button', { name: '切换导航布局' }).click();
  await expect(page.locator('.mp-topnav')).toBeVisible();
  await page.reload();
  await expect(page.locator('.mp-topnav')).toBeVisible();
  await expect.poll(() => page.locator('body').getAttribute('theme-mode')).toBe(changed);
  await page.getByRole('button', { name: '切换导航布局' }).click();
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await expect.poll(() => page.locator('body').getAttribute('theme-mode')).toBe(original);
});
