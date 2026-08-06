import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-应用中心 AppHub 模块', () => {
  test('应用列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps');
    await expect(page.getByText(/创建应用|应用分组|应用状态/).first()).toBeVisible({ timeout: 15000 });
    // 应用以卡片网格渲染（非表格）；等待任一应用卡片出现
    await expect(page.locator('[class*="card"]').first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用市场渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/market');
    await expect(page.getByText(/市场|市场中心|模板/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用模板市场渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/marketplace');
    await expect(page.getByText(/市场|模板|市场中心/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('我的模板渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/my-templates');
    await expect(page.getByText(/我的模板|模板/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('AI 设计器渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/ai-designer');
    await expect(page.getByText(/AI 设计|设计器|AI 生成/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-本体引擎 Ontology 模块', () => {
  test('本体建模渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/ontology');
    await expect(page.getByText(/本体|建模|类|Ontology/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('数据中心渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/ontology/datacenter');
    await expect(page.getByText(/数据中心|数据|实例/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('本体图谱渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/ontology/graph');
    await expect(page.getByText(/图谱|关系|图/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});

test.describe('联调-知识库 Knowledge 模块', () => {
  test('知识库列表渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/knowledge');
    await expect(page.getByText(/知识库|知识/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('知识文档渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/knowledge/docs');
    await expect(page.getByText(/文档|知识/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('知识测试渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/knowledge/test');
    await expect(page.getByText(/测试|问答|检索/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
