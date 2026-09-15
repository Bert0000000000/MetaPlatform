/**
 * UI-P2b 验收用例：知识与集成域（两层 tab + E 骨架知识库列表）。
 *
 * 覆盖 UI-P1/P2 通用 DoD：
 *  - 主 tab 由壳渲染（原 KnowledgeLayout 4 tab / McpCenterLayout 三 HUB 已摘除）
 *  - MCP 下 segmented 子 tab = 工具/服务器/客户端/调试器/权限策略/调用审计/连接监控
 *  - A2A 子 tab = 外部智能体 / 信任管理
 *  - 知识库列表 = DataTablePro（真实行）→ 行点击开非模态 SheetDetail，Esc 关闭
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p2b-ki
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

const MAIN_TABS = ['知识库', 'MCP 工具', 'A2A', '检索测试'];
const MCP_SUB_TABS = ['工具', '服务器', '客户端', '调试器', '权限策略', '调用审计', '连接监控'];
const A2A_SUB_TABS = ['外部智能体', '信任管理'];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('UI-P2b · 知识与集成域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('4 个主 tab 由壳渲染，页内无重复 tab 行', async ({ page }) => {
    await gotoApp(page, '/ki/kb');
    const bar = page.locator('.mp-pagetabs-line .semi-tabs-tab');
    for (const label of MAIN_TABS) {
      await expect(bar.filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.locator('.mp-page .mp-pagetabs')).toHaveCount(0);

    await bar.filter({ hasText: /^MCP 工具$/ }).click();
    // /ki/mcp 自身落到第一个子 tab
    await expect(page).toHaveURL(/\/ki\/mcp\/tools$/);
  });

  test('MCP 下 7 个 segmented 子 tab 切换即路由', async ({ page }) => {
    await gotoApp(page, '/ki/mcp/tools');
    const sub = page.locator('.mp-subtabs .semi-tabs-tab');
    for (const label of MCP_SUB_TABS) {
      await expect(sub.filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible({ timeout: 20_000 });
    }

    await sub.filter({ hasText: /^服务器$/ }).click();
    await expect(page).toHaveURL(/\/ki\/mcp\/servers$/);
    await sub.filter({ hasText: /^调用审计$/ }).click();
    await expect(page).toHaveURL(/\/ki\/mcp\/audit$/);

    await expect(page.locator('body')).not.toContainText('出错了');
  });

  test('A2A 下 2 个 segmented 子 tab', async ({ page }) => {
    await gotoApp(page, '/ki/a2a/external-agents');
    const sub = page.locator('.mp-subtabs .semi-tabs-tab');
    for (const label of A2A_SUB_TABS) {
      await expect(sub.filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible({ timeout: 20_000 });
    }
    await sub.filter({ hasText: /^信任管理$/ }).click();
    await expect(page).toHaveURL(/\/ki\/a2a\/trusts$/);
  });

  test('知识库列表 = DataTablePro，行点击开 SheetDetail 且 Esc 关闭', async ({ page }) => {
    await gotoApp(page, '/ki/kb');

    await expect(page.locator('.mp-page-head-title')).toHaveText('知识库');
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    expect(await rows.count()).toBeGreaterThan(0);

    // 行渲染真实字段：名称 / 编码 / 文档数
    await expect(rows.first()).toContainText(/kb-/);

    await rows.first().click();
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('知识库 ·');
    await expect(sheet.locator('.semi-descriptions')).toBeVisible();
    expect(Math.round((await sheet.boundingBox())!.width)).toBe(456);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('文档管理 / 检索测试 / 检索配置均可打开且非白屏', async ({ page }) => {
    for (const path of ['/ki/kb/docs', '/ki/test', '/ki/kb/config']) {
      await gotoApp(page, path);
      await expect(
        page.locator('.mp-pagetabs-line .semi-tabs-tab[aria-selected="true"]'),
      ).toBeVisible({ timeout: 25_000 });
      await expect
        .poll(async () => (await page.locator('.mp-ki-shell-main').innerText()).trim().length, {
          timeout: 25_000,
        })
        .toBeGreaterThan(20);
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/ki/kb');
    await expect(page.locator('.mp-tablepro')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2b-ki-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p2b-ki-dark.png' });
  });
});
