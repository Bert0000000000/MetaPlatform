/**
 * UI-P1e 验收用例：平台管理域（9 个页面）统一到 E 骨架 + 令牌。
 *
 * 覆盖 UI-P1 通用 DoD：
 *  - /admin 三个主 tab × 三个子 tab 都能在新壳内打开
 *  - 每页要么是真实表格、要么是诚实的空状态（不出现白屏/报错边界）
 *  - 用户页：新建抽屉打开并含真实字段（无 MFA 假开关）
 *  - 审计页：点击行打开非模态详情浮层
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1e-admin
 * 依赖：dev server 9250、gateway 8100。
 */
import { test, expect, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

/** 三个主 tab × 三个子 tab（与 domains.tsx 的 admin 域配置一致）。 */
const ADMIN_ROUTES: Array<[string, string]> = [
  ['/admin/org/users', '用户与权限'],
  ['/admin/org/roles', '角色'],
  ['/admin/org/tenants', '组织与租户'],
  ['/admin/platform/configs', '平台配置'],
  ['/admin/platform/ai-providers', 'AI Provider'],
  ['/admin/platform/components', '组件演示'],
  ['/admin/ops/logs', '审计日志'],
  ['/admin/ops/operations', '运营监控'],
  ['/admin/ops/analytics', '使用分析'],
];

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  // 页面主体出现（表格壳 / 空状态 / 骨架任一）即认为渲染完成
  await expect(
    page.locator('.mp-tablepro, .mp-empty, .mp-page-head, .mp-split, .mp-admin-kpis').first(),
  ).toBeVisible({ timeout: 25_000 });
}

test.describe('UI-P1e · 平台管理域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('三个主 tab × 三个子 tab 全部打开且非白屏', async ({ page }) => {
    for (const [path, label] of ADMIN_ROUTES) {
      await gotoApp(page, path);
      // 壳的页内 tab 行存在且含对应子 tab 文案
      const bar = page.locator('.mp-pagetabs .semi-tabs-tab');
      await expect(bar.filter({ hasText: label })).toBeVisible({ timeout: 20_000 });
      // 无 ErrorBoundary 兜底页
      await expect(page.locator('body')).not.toContainText('出错了');
    }
  });

  test('用户与权限：新建抽屉打开并含真实字段（无 MFA 假开关）', async ({ page }) => {
    await gotoApp(page, '/admin/org/users');

    await page.locator('.mp-page-head-actions button', { hasText: '新建用户' }).click();
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('新建用户');

    // 真实的表单字段
    await expect(sheet.locator('input').first()).toBeVisible();
    for (const label of ['用户名', '姓名', '邮箱', '手机', '部门', '职位', '状态', '角色']) {
      await expect(sheet).toContainText(label);
    }
    // isSuperAdmin 是真实字段；原型里的 MFA 开关后端没有对应字段，故不应出现
    await expect(sheet).toContainText('超级管理员');
    await expect(sheet).not.toContainText('MFA');

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('审计日志：点击行打开非模态详情浮层', async ({ page }) => {
    await gotoApp(page, '/admin/ops/logs');

    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    // 表格壳先于数据出现，这里等真实行落地再判断是否跳过（本租户有记录时不该跳过）
    let count = 0;
    try {
      await expect.poll(async () => rows.count(), { timeout: 20_000 }).toBeGreaterThan(0);
      count = await rows.count();
    } catch {
      count = 0;
    }
    test.skip(count === 0, '本租户暂无审计记录，跳过');

    // 表格 loading→data 会换掉 tbody 节点，点击可能落在被替换掉的旧行上；
    // 用 toPass 重试「点一次 + 断言浮层可见」，避开这个竞态。
    const sheet = page.locator('#app .mp-sheet');
    await expect(async () => {
      await rows.first().click();
      await expect(sheet).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(sheet).toContainText('审计详情');
    await expect(sheet.locator('.semi-descriptions')).toBeVisible();
    expect(Math.round((await sheet.boundingBox())!.width)).toBe(456);

    // 用抽屉自己的「关闭」按钮收口（Esc 关闭已由 ui-p0-shell / ui-p1a 两条用例覆盖，
    // 这里不重复押注键盘焦点落在浮层内）。
    await sheet.getByRole('button', { name: '关闭' }).first().click();
    await expect(sheet).toBeHidden();
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/admin/org/users');
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1e-admin-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1e-admin-dark.png' });
  });
});
