import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-架构中心 Arch 模块', () => {
  test('能力地图渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/capabilities');
    await expect(page.getByText('能力地图', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/能力列表|能力树|新增/).first()).toBeVisible();
    await expect(page.locator('.semi-table-row').first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用系统渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/applications');
    await expect(page.getByText(/应用系统管理|注册应用|应用名称/).first()).toBeVisible();
    await expect(page.locator('.semi-table-row').first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('价值流渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/value-streams');
    await expect(page.getByText('价值流', { exact: true }).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('业务流程渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/processes');
    await expect(page.getByText(/业务流程|业务过程/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('组织角色渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/org-roles');
    await expect(page.getByText(/组织角色|组织|角色/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('数据架构渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/data');
    await expect(page.getByText(/主题域|数据架构|数据流/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('技术架构渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/tech');
    await expect(page.getByText(/技术架构|技术栈|技术组件/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('架构治理渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/reviews');
    await expect(page.getByText(/架构治理|评审|治理/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('Ontology联动渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/arch/ontology-mapping');
    await expect(page.getByText(/Ontology|本体|映射/).first()).toBeVisible();
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
