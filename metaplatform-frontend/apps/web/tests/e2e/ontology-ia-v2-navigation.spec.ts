/** Builder V2 workspace navigation; run against the isolated validation target. */
import { expect, test, type Page } from '@playwright/test';
import { builderAuth } from './helpers/builder-auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

const WORKSPACE_DOMAINS: Array<[string, string, string]> = [
  ['概览', '/ontology', '/ontology'],
  ['业务模型', '/ontology/model', '/ontology/model/graph'],
  ['数据接入', '/ontology/data', '/ontology/data/mappings'],
  ['业务动作', '/ontology/logic', '/ontology/logic/actions'],
  ['变更发布', '/ontology/governance', '/ontology/governance/drafts'],
  ['运行与质量', '/ontology/data/sync', '/ontology/data/sync'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 工作区导航', () => {
  test.beforeEach(async ({ page }) => { await builderAuth(page); });

  test('六域均可达，工作区显示侧栏和上下文，planned 页面不进入导航', async ({ page }) => {
    for (const [label, , canonical] of WORKSPACE_DOMAINS) {
      await gotoApp(page, canonical);
      const nav = page.getByRole('navigation', { name: '本体工作区导航' });
      await expect(page.getByRole('navigation', { name: '工作区功能组' }).getByRole('link', { name: label, exact: true })).toBeVisible();
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
    await page.getByRole('navigation', { name: '工作区功能组' }).getByRole('link', { name: '业务动作', exact: true }).click();
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
    await expect(page.getByRole('navigation', { name: '工作区功能组' }).getByRole('link', { name: '概览', exact: true })).not.toHaveAttribute('aria-current');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await expect(nav.getByRole('link', { name: '对象类型', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('对象浏览刷新保持现有页面能力', async ({ page }) => {
    await gotoApp(page, '/ontology/explore/objects');
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get('class') ?? '').toMatch(/^ont\./);
    const selectedClass = new URL(page.url()).searchParams.get('class');
    const instanceSearch = page.getByPlaceholder(/^搜索「.*」：主键、属性值…$/);
    await expect(instanceSearch).toBeVisible();
    const selectedTypePlaceholder = await instanceSearch.getAttribute('placeholder');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname).toBe('/ontology/explore/objects');
    await expect.poll(() => new URL(page.url()).searchParams.get('class')).toBe(selectedClass);
    await expect(instanceSearch).toHaveAttribute('placeholder', selectedTypePlaceholder!);
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '工作区页面导航' }).getByRole('link', { name: 'ObjectSet 构建器' })).toBeVisible();
  });

  test('390px 可展开导航并通过键盘进入关系类型，无文档横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ontology/model/graph', { waitUntil: 'domcontentloaded' });
    const toggle = page.getByRole('button', { name: '展开本体导航' });
    await expect(toggle).toBeVisible();
    for (let step = 0; step < 40 && !await toggle.evaluate(node => node === document.activeElement); step++) await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    const nav = page.getByRole('navigation', { name: '本体工作区导航' });
    await expect(nav.getByRole('link', { name: '模型工作台', exact: true })).toBeFocused();
    for (const name of ['对象类型', '关系类型']) {
      await page.keyboard.press('Tab');
      await expect(nav.getByRole('link', { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ontology\/model\/link-types$/);
    const closedToggle = page.getByRole('button', { name: '展开本体导航' });
    await expect(closedToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(closedToggle).toBeVisible();
    await expect(closedToggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(nav.getByRole('link', { name: '模型工作台', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(closedToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(closedToggle).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('离开本体后其他域显示自己的功能组和页面', async ({ page }) => {
    await gotoApp(page, '/ontology/model/graph');
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('navigation', { name: '工作区页面导航' }).getByRole('link', { name: '概览', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
  });

  test('七个产品菜单 side/top 同序可达，SuperAI 常驻与旧会话路由保留', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mp_nav_mode', 'side'));
    await gotoApp(page, '/home');
    const names = ['工作台', '业务应用', '对象探索', '本体工作室', '数字员工', '连接与知识', '治理与管理'];
    await expect(page.getByRole('navigation', { name: '平台导航' }).getByRole('link')).toHaveText(names);
    const paths = ['/home', '/apps/mine', '/ontology/explore/objects', '/ontology/model/graph', '/agents', '/ki/kb', '/gov/business'];
    for (let index = 0; index < names.length; index++) {
      await page.getByRole('navigation', { name: '平台导航' }).getByRole('link', { name: names[index], exact: true }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(paths[index]);
    }
    await page.getByRole('button', { name: '切换导航布局' }).click();
    await expect(page.locator('.mp-topnav').getByRole('link')).toHaveText(names);
    let releaseTypes!: () => void;
    const typesReady = new Promise<void>(resolve => { releaseTypes = resolve; });
    let typesBlocked = false;
    await page.route('**/ont/v2/object-types**', async route => {
      const request = route.request();
      if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/ont/v2/object-types')) {
        typesBlocked = true;
        await typesReady;
      }
      await route.continue();
    });
    try {
      await page.locator('.mp-topnav').getByRole('link', { name: '对象探索', exact: true }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe('/ontology/explore/objects');
      await expect.poll(() => typesBlocked).toBe(true);
      await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
      await page.getByRole('button', { name: '打开 SuperAI Copilot' }).click();
      await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'open');
      await page.getByRole('button', { name: '打开 SuperAI 会话' }).click();
      await expect(page).toHaveURL(/\/superai\/chat$/);
      const lateTypes = page.waitForResponse(response => response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith('/ont/v2/object-types'));
      releaseTypes();
      expect((await lateTypes).ok()).toBe(true);
      await expect(page.getByRole('navigation', { name: '工作区页面导航' }).getByRole('link', { name: '会话', exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/superai\/chat$/);
    } finally {
      releaseTypes();
    }
    for (const path of ['/superai/plans', '/superai/schedules', '/superai/cost', '/superai/templates', '/admin/org/users', '/gov/tech/components']) {
      await gotoApp(page, path);
      await expect(page.getByRole('navigation', { name: '工作区页面导航' })).toBeVisible();
    }
  });

  test('运行质量别名复用校验且保留 query，统一权限策略不套建设侧栏', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/lint?class=probe-type');
    await expect(page).toHaveURL(/\/ontology\/model\/validation\?class=probe-type$/);
    await expect(page.getByRole('navigation', { name: '本体上下文' })).toContainText('运行与质量');
    await gotoApp(page, '/ontology/governance/security');
    await expect(page.getByRole('navigation', { name: '本体工作区导航' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '工作区页面导航' }).getByRole('link', { name: '权限策略', exact: true })).toBeVisible();
  });
});
