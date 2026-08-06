import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

// Reuses the once-logged-in storageState saved by auth.setup.ts — avoids
// hammering the SQLite-backed IAM with concurrent logins (database is locked).
test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-工作台 Dashboard 模块', () => {
  test('工作台渲染真实后端数据', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard');
    await expect(page.getByText('工作台', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('活跃应用', { exact: true })).toBeVisible();
    await expect(page.getByText('最近任务', { exact: true })).toBeVisible();
    await expect(page.getByText('系统状态', { exact: true })).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('我的应用页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/my-apps');
    await expect(page.getByText('我的应用', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/新建应用|全部应用|打开/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('我的数字员工页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/my-agents');
    await expect(page.getByText('我的数字员工', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/创建数字员工|运行中|查看详情/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('消息页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/messages');
    await expect(page.getByText('消息', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/全部已读|系统通知/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('门户页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/portal');
    await expect(page.getByText('门户', { exact: true }).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('通知页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/notifications');
    await expect(page.getByText(/通知|消息/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('交付材料页面渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/dashboard/deliverables');
    await expect(page.getByText(/交付材料|交付/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
