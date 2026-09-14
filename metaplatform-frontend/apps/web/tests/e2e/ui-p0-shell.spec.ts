/**
 * UI-P0 验收用例：新应用壳 + 新 IA + 五骨架共享组件。
 *
 * 覆盖 DESIGN-SPEC §3（壳）/ §4（令牌）/ §5（骨架）与 UI-P0 DoD：
 *  - 8 域新路由都能在新壳内打开
 *  - 旧路由 301 全量生效（抽查 20+ 条，见 LEGACY_REDIRECTS）
 *  - Ctrl+K 命令面板可开合 / 可过滤 / Enter 跳转
 *  - /admin/demo 五骨架组件齐全
 *  - 浅 / 深双主题可用
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p0-shell
 * 依赖：dev server 在 9250（.claude/launch.json: mate-web）、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/** 旧路径 → 新路径（对照 UI-P0 新 IA 301 表抽查）。 */
const LEGACY_REDIRECTS: Array<{ from: string; to: string; note?: string }> = [
  { from: '/dashboard', to: '/home' },
  { from: '/dashboard/my-apps', to: '/home/apps' },
  { from: '/dashboard/my-agents', to: '/agents' },
  { from: '/dashboard/messages', to: '/home/messages' },
  { from: '/dashboard/notifications', to: '/home/todos' },
  { from: '/dashboard/deliverables', to: '/home/deliverables' },
  { from: '/dashboard/settings', to: '/home/me' },
  { from: '/dashboard/portal', to: '/home/portal' },
  { from: '/dashboard/aiops', to: '/home/aiops' },

  { from: '/ontology', to: '/ontology/explorer' },
  { from: '/ontology?tab=datacenter', to: '/ontology/datacenter' },
  { from: '/ontology?tab=action', to: '/ontology/ops/actions' },   // UI-P1a 起 Action 编排归运维
  { from: '/ontology?tab=concept', to: '/ontology/model' },
  { from: '/ontology/object-types', to: '/ontology/model' },
  { from: '/ontology/datacenter', to: '/ontology/datacenter' },

  { from: '/dw/employees', to: '/agents/employees' },
  { from: '/dw/tasks', to: '/agents/dw-tasks' },
  { from: '/dw/documents', to: '/agents/documents' },
  { from: '/dw/a2a', to: '/agents/external' },

  { from: '/superai', to: '/superai/chat' },
  { from: '/superai/tasks', to: '/superai/plans' },
  { from: '/superai/schedule', to: '/superai/schedules' },
  { from: '/superai/execution', to: '/superai/plans' },
  { from: '/wfe/action-orchestration/order-review', to: '/superai/plans/order-review' },

  { from: '/marketplace', to: '/apps/market' },
  { from: '/my-templates', to: '/apps/templates' },
  { from: '/ai-designer', to: '/apps/designer' },
  { from: '/apps?tab=market', to: '/apps/market' },

  { from: '/knowledge', to: '/ki/kb' },
  { from: '/knowledge/docs', to: '/ki/kb/docs' },
  { from: '/knowledge/test', to: '/ki/test' },
  { from: '/mcp/tools', to: '/ki/mcp/tools' },
  { from: '/mcp/clients/abc', to: '/ki/mcp/clients/abc' },

  { from: '/arch', to: '/gov/business' },
  { from: '/arch/tech-radar', to: '/gov/tech/radar' },
  { from: '/arch/data/entities/E-1', to: '/gov/data/entities/E-1' },

  { from: '/admin', to: '/admin/org/users' },
  { from: '/admin/users', to: '/admin/org/users' },
  { from: '/admin/permissions', to: '/admin/org/roles' },
  { from: '/admin/ai-providers', to: '/admin/platform/ai-providers' },
  { from: '/admin/analytics', to: '/admin/ops/analytics' },
];

/** 新 IA 8 个域的代表路径。 */
const DOMAIN_ENTRIES: Array<{ path: string; domain: string }> = [
  { path: '/home', domain: '工作台' },
  { path: '/ontology/explorer', domain: '本体' },
  { path: '/agents', domain: '数字员工' },
  { path: '/superai/chat', domain: 'SuperAI' },
  { path: '/apps/mine', domain: '应用中心' },
  { path: '/ki/kb', domain: '知识与集成' },
  { path: '/gov/business', domain: '数据与治理' },
  { path: '/admin/org/users', domain: '平台管理' },
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('UI-P0 · 应用壳与新 IA', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('8 个域都能在新壳内打开，且导航栏与顶层 tab 正确', async ({ page }) => {
    for (const { path, domain } of DOMAIN_ENTRIES) {
      await gotoApp(page, path);
      // 壳存在
      await expect(page.locator('#app .mp-app, #app')).toBeAttached();
      // 一级图标栏 / 顶栏一级 tab 至少一处可见
      const rail = page.locator('#app .mp-rail-sider');
      const topnav = page.locator('#app .mp-topnav');
      expect(
        (await rail.isVisible()) || (await topnav.isVisible()),
        `${path} 缺少一级导航`,
      ).toBe(true);
      // 面包屑含域标签
      await expect(page.locator('.mp-crumbs')).toContainText(domain);
    }
  });

  test('页内主 tab 切换即路由（工作台）', async ({ page }) => {
    await gotoApp(page, '/home');
    await page.locator('.mp-pagetabs-line .semi-tabs-tab', { hasText: '消息' }).click();
    await expect(page).toHaveURL(/\/home\/messages$/);
    await page.locator('.mp-pagetabs-line .semi-tabs-tab', { hasText: '交付物' }).click();
    await expect(page).toHaveURL(/\/home\/deliverables$/);
  });

  test('过渡期：域内旧 shell 的 tab 行已换成新 IA 路径（数据与治理）', async ({ page }) => {
    await gotoApp(page, '/gov/business');
    const bar = page.locator('.mp-page .semi-tabs-tab');
    await expect(bar.filter({ hasText: '技术架构' })).toBeVisible();
    await bar.filter({ hasText: '技术架构' }).click();
    await expect(page).toHaveURL(/\/gov\/tech$/);
    // 壳不叠加第二行 tab（DomainDef.ownsTabs）
    await expect(page.locator('.mp-pagetabs')).toHaveCount(0);
  });

  test('布局模式切换写 localStorage 并切换 rail / 顶栏 tab', async ({ page }) => {
    await gotoApp(page, '/home');
    await expect(page.locator('#app')).toHaveAttribute('data-nav', 'side');
    await page.locator('.mp-topbar button[aria-label="切换导航布局"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-nav', 'top');
    await expect(page.locator('#app .mp-topnav')).toBeVisible();
    await expect(page.locator('#app .mp-rail-sider')).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('mp_nav_mode'));
    expect(stored).toBe('top');
  });

  test('Copilot dock 可开合（P0 仅壳）', async ({ page }) => {
    await gotoApp(page, '/home');
    await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'closed');
    await page.locator('#app .mp-rail-foot button[aria-label="SuperAI Copilot"]').click();
    await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'open');
    await expect(page.locator('#app .mp-dock')).toBeVisible();
  });
});

test.describe('UI-P0 · 旧路由 301', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  for (const { from, to } of LEGACY_REDIRECTS) {
    test(`${from} → ${to}`, async ({ page }) => {
      await page.goto(from, { waitUntil: 'domcontentloaded' });
      const [expectedPath, expectedQuery] = to.split('?');
      const escaped = expectedPath.replace(/[/:[\]()*+?^$|{}.\\]/g, '\\$&');
      await expect(page).toHaveURL(new RegExp(`${escaped}(\\?|$)`), { timeout: 30_000 });
      if (expectedQuery) {
        expect(new URL(page.url()).searchParams.toString()).toContain(expectedQuery);
      }
    });
  }
});

test.describe('UI-P0 · ⌘K 命令面板', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('Ctrl+K 开合 / 过滤 / Enter 跳转', async ({ page }) => {
    await gotoApp(page, '/home');

    await page.keyboard.press('Control+k');
    const body = page.locator('.mp-cmdk-body');
    await expect(body).toBeVisible();
    await expect(body.locator('.mp-cmdk-group').first()).toContainText('跳转');

    // 过滤：只剩包含关键词的条目
    await page.locator('.mp-cmdk-field input').fill('数据中心');
    await expect(body.locator('.mp-cmdk-item').first()).toContainText('数据中心');
    const count = await body.locator('.mp-cmdk-item').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(5);

    // Enter 跳转
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ontology\/datacenter$/);

    // Esc 关闭
    await page.keyboard.press('Control+k');
    await expect(body).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(body).toBeHidden();
  });
});

test.describe('UI-P0 · 五骨架演示页', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('/admin/demo 五骨架齐全 + 令牌间距 10 档', async ({ page }) => {
    await gotoApp(page, '/admin/demo');

    // PageHeader
    await expect(page.locator('.mp-page-head-title')).toHaveText('组件演示 · 五骨架');
    await expect(page.locator('.mp-page-head-actions')).toBeVisible();

    // FilterBar
    await expect(page.locator('.mp-filterbar-search')).toBeVisible();

    // DataTablePro：勾选 → 底部「已选 n 项 · 清除」
    await expect(page.locator('.mp-tablepro')).toBeVisible();
    await page.locator('.mp-tablepro .semi-table-tbody .semi-checkbox').first().click({ force: true });
    await expect(page.locator('.mp-table-foot-count')).toContainText('已选 1 项');

    // SheetDetail：点行 → 非模态详情浮层
    await page.locator('.mp-tablepro .semi-table-tbody .semi-table-row').first().click();
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('实例详情');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // EmptyState
    await page.locator('.mp-filterbar-right button', { hasText: '显示空状态' }).click();
    await expect(page.locator('.mp-empty')).toBeVisible();
    await expect(page.locator('.mp-empty')).toContainText('没有匹配的实例');

    // 令牌演示：10 档间距
    await page.locator('.mp-filterbar-right button', { hasText: '显示表格' }).click();
    await expect(page.locator('.mp-demo-swatch')).toHaveCount(10);
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/admin/demo');
    // 强制浅色
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p0-demo-light.png', fullPage: false });
    // 强制深色
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await expect(page.locator('body')).toHaveAttribute('theme-mode', 'dark');
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p0-demo-dark.png', fullPage: false });

    // 主题令牌确实换了一套值
    const lightPrimary = await page.evaluate(() => {
      document.body.setAttribute('theme-mode', 'light');
      return getComputedStyle(document.body).getPropertyValue('--semi-color-primary').trim();
    });
    const darkPrimary = await page.evaluate(() => {
      document.body.setAttribute('theme-mode', 'dark');
      return getComputedStyle(document.body).getPropertyValue('--semi-color-primary').trim();
    });
    expect(lightPrimary).toBe('rgba(59, 91, 246, 1)');
    expect(darkPrimary).toBe('rgba(124, 143, 255, 1)');
  });
});
