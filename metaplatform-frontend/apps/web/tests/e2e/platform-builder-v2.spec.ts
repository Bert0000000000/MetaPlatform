import { expect, test, type Response } from '@playwright/test';
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
    if (route === '/ontology/explore/objects') {
      const typeTree = page.locator('.mp-explorer-tree .semi-tree-option').first();
      if (width === 390) {
        const expand = page.getByRole('button', { name: '展开面板', exact: true });
        await expect(expand).toHaveAttribute('aria-expanded', 'false');
        await expect(typeTree).toBeHidden();
        await expand.click();
        await expect(page.getByRole('button', { name: '折叠面板', exact: true })).toHaveAttribute('aria-expanded', 'true');
      }
      await expect(typeTree).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 390) {
        await page.keyboard.press('Escape');
        await expect(typeTree).toBeHidden();
        await expect(page.getByRole('button', { name: '展开面板', exact: true })).toBeFocused();
      }
    }
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
  const settingsPath = '/api/v1/dashboard/settings';
  const matchesSettings = (method: string) => (response: Response) =>
    new URL(response.url()).pathname === settingsPath && response.request().method() === method;
  const firstRead = page.waitForResponse(matchesSettings('GET'));
  await page.goto('/home');
  await expect(page.getByText('HTTP 边界统计')).toBeVisible();
  const userId = await page.evaluate(() => JSON.parse(localStorage.getItem('mate_platform_user') ?? '{}').id as string);
  expect(typeof userId === 'string' && !!userId.trim(), 'Actual provider UserInfo identity required').toBe(true);
  const initial = await firstRead;
  expect(initial.status(), 'Initial real settings GET HTTP status').toBe(200);
  expect(new URL(initial.url()).searchParams.get('userId') === userId, 'GET uses actual provider identity').toBe(true);
  const initialBody = await initial.json();
  const original = (initialBody.data ?? initialBody) as {
    userId: string; language: string; timezone: string; dateFormat: string;
    defaultPage: string; theme: 'light' | 'dark' | 'system'; layout: string[];
  };
  expect(original.userId === userId, 'GET returns matching provider identity').toBe(true);
  expect(['light', 'dark', 'system'].includes(original.theme), 'GET returns a supported real theme').toBe(true);
  const originalResolved = original.theme === 'system'
    ? await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : original.theme;
  await expect(page.locator('body')).toHaveAttribute('theme-mode', originalResolved);
  // Navigation mode is the existing local shell preference, not a server DTO field.
  const originalNav = await page.evaluate(() => localStorage.getItem('mp_nav_mode') ?? 'side');
  const changed = originalResolved === 'dark' ? 'light' : 'dark';
  let writeAttempted = false;
  try {
    const write = page.waitForResponse(matchesSettings('PUT'));
    writeAttempted = true;
    await page.getByRole('button', { name: '切换主题', exact: true }).click();
    const written = await write;
    expect(written.status(), 'Real settings PUT HTTP status').toBe(200);
    const payload = written.request().postDataJSON();
    expect(payload.userId === userId && payload.theme === changed, 'UI PUT uses actual identity and chosen theme').toBe(true);
    expect(Object.keys(payload).sort().join(',') === 'theme,userId', 'UI writes only the chosen preference').toBe(true);
    const writtenBody = await written.json();
    const persisted = writtenBody.data ?? writtenBody;
    expect(persisted.userId === userId && persisted.theme === changed, 'Successful PUT returns chosen preference for actual identity').toBe(true);
    await expect(page.locator('body')).toHaveAttribute('theme-mode', changed);
    await page.getByRole('button', { name: '切换导航布局' }).click();
    const changedNav = originalNav === 'side' ? 'top' : 'side';
    await expect.poll(() => page.evaluate(() => localStorage.getItem('mp_nav_mode'))).toBe(changedNav);
    const reread = page.waitForResponse(matchesSettings('GET'));
    await page.reload();
    const reloaded = await reread;
    expect(reloaded.status(), 'Reload real settings GET HTTP status').toBe(200);
    expect(new URL(reloaded.url()).searchParams.get('userId') === userId, 'Reload GET uses actual identity').toBe(true);
    const reloadBody = await reloaded.json();
    const restoredRead = reloadBody.data ?? reloadBody;
    expect(restoredRead.userId === userId && restoredRead.theme === changed, 'Reload GET proves server-persisted chosen theme').toBe(true);
    await expect(page.locator('body')).toHaveAttribute('theme-mode', changed);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('mp_nav_mode'))).toBe(changedNav);
    if (changedNav === 'top') await expect(page.locator('.mp-topnav')).toBeVisible();
    else await expect(page.locator('.mp-topnav')).toBeHidden();
  } finally {
    try {
      if (writeAttempted) {
        // Restore the actual captured server preferences even if a later assertion fails.
        // Session/body stay inside the page; return safe status/boolean evidence only.
        const restoration = await page.evaluate(async ({ settingsPath, original }) => {
          const response = await fetch(settingsPath, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('mate_platform_token')}` },
            body: JSON.stringify(original), signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) return { status: response.status, matches: false };
          const body = await response.json();
          const saved = body.data ?? body;
          return { status: response.status, matches: Object.entries(original).every(([key, value]) => JSON.stringify(saved[key]) === JSON.stringify(value)) };
        }, { settingsPath, original });
        expect(restoration.status, 'Restore original real settings PUT HTTP status').toBe(200);
        expect(restoration.matches, 'Original server preferences restored exactly').toBe(true);
      }
    } finally {
      const currentNav = await page.evaluate(() => localStorage.getItem('mp_nav_mode') ?? 'side');
      if (currentNav !== originalNav) await page.getByRole('button', { name: '切换导航布局' }).click();
      const finalRead = page.waitForResponse(matchesSettings('GET'));
      await page.reload();
      const finalResponse = await finalRead;
      expect(finalResponse.status(), 'Restored settings GET HTTP status').toBe(200);
      const finalBody = await finalResponse.json();
      const finalSettings = finalBody.data ?? finalBody;
      expect(Object.entries(original).every(([key, value]) => JSON.stringify(finalSettings[key]) === JSON.stringify(value)), 'Final GET confirms original server preferences').toBe(true);
      await expect(page.locator('body')).toHaveAttribute('theme-mode', originalResolved);
      await expect.poll(() => page.evaluate(() => localStorage.getItem('mp_nav_mode') ?? 'side')).toBe(originalNav);
    }
  }
});
