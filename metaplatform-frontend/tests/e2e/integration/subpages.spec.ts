import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-架构中心子模块（数据/治理）', () => {
  test('数据实体详情渲染（真实 ID）', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/data/entities/de-order-detail');
    await expect(page.getByText('order_detail', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('数据流渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/data/flows');
    await expect(page.getByText(/数据流|数据流图|新增/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('数据资产目录渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/data/assets');
    await expect(page.getByText(/资产|目录|数据/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('数据标准渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/data/standards');
    await expect(page.getByText(/标准|规范/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('架构原则渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/principles');
    await expect(page.getByText(/原则|原则分类/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('架构评审模板渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/review-templates');
    await expect(page.getByText(/评审|模板/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('技术债渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/tech-debt');
    await expect(page.getByText(/技术债|债务/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('技术组件渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/tech-components');
    await expect(page.getByText(/组件|技术/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-MCP 子模块（概览/监控/资源/提示词/策略/外部/信任）', () => {
  test('MCP 概览渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/overview');
    await expect(page.getByText(/概览|服务|工具/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('连接监控渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/connection-monitor');
    await expect(page.getByText(/监控|连接|服务/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 资源列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/resources');
    await expect(page.getByText(/资源|新增资源/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 提示词列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/prompts');
    await expect(page.getByText(/提示词|模板|新增/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 策略管理渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/policies');
    await expect(page.getByText(/策略|权限|策略管理/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 外部集成渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/external');
    await expect(page.getByText(/外部|集成|API/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 信任管理渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/trusts');
    await expect(page.getByText(/信任|代理|信任管理/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('MCP 调试器渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/mcp/debugger');
    await expect(page.getByText(/调试|会话|执行/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-数字员工子模块（任务/协作/评估/外部）', () => {
  test('员工列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents');
    await expect(page.getByText(/数字员工|员工|创建/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('创建员工页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/create');
    await expect(page.getByText(/创建|员工|姓名/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('任务列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/tasks');
    await expect(page.getByText(/任务|Task/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('协作列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/collab');
    await expect(page.getByText(/协作|Collaboration/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('评估中心渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/evaluation');
    await expect(page.getByText(/评估|报告|对话/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('外部 Agent 渲染（A2A）', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/agents/external');
    await expect(page.getByText(/外部|Agent|代理/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
