import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-后台管理 Admin 模块', () => {
  test('总览渲染真实后端数据', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin');
    await expect(page.getByText('后台管理', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('用户总数', { exact: true })).toBeVisible();
    await expect(page.getByText('角色总数', { exact: true })).toBeVisible();
    await expect(page.getByText('今日日志', { exact: true })).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('用户管理列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/users');
    await expect(page.getByText('用户管理', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/新建用户|批量导入/).first()).toBeVisible();
    // antd renders a hidden measure row first; wait for a non-hidden body row
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('权限管理列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/permissions');
    await expect(page.getByText('权限管理', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/角色总数|权限总数|新建角色/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('组织管理树渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/orgs');
    await expect(page.getByText('组织管理', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/组织总数|新建组织|人员调岗/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('日志管理渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/logs');
    await expect(page.getByText('日志管理', { exact: true }).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('系统配置渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/configs');
    await expect(page.getByText('系统配置', { exact: true }).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('AI 提供方渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/admin/ai-providers');
    await expect(page.getByText('AI 提供方', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/OpenAI|Azure|Ollama/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
