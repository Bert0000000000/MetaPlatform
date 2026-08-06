import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-MCP 中心模块', () => {
  test('工具列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp');
    await expect(page.getByText(/MCP|工具|资源/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 服务渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/server');
    await expect(page.getByText(/服务|Server|服务器/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 客户端渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/client');
    await expect(page.getByText(/客户端|Client/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 权限渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/permissions');
    await expect(page.getByText(/权限|授权/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 审计渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/audit');
    await expect(page.getByText(/审计|日志/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-数字员工 Agents 模块', () => {
  test('员工列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents');
    await expect(page.getByText(/数字员工|员工|Agent/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('任务列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/tasks');
    await expect(page.getByText(/任务|Task/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('协作列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/collab');
    await expect(page.getByText(/协作|Collaboration/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('评估中心渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/evaluation');
    await expect(page.getByText(/评估|Evaluation/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-SuperAI 模块', () => {
  test('SuperAI 聊天页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/superai/chat');
    await expect(page.getByText(/SuperAI|对话|你好/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('任务编排渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/superai/tasks');
    await expect(page.getByText(/任务|编排|模板/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
