import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';

test.use({ storageState: 'tests/e2e/.auth/state.json' });

test.describe('联调-应用中心子模块（详情/版本/设计器/页面）', () => {
  test('应用详情页渲染真实应用', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps/app-data');
    await expect(page.getByText('Data Assets', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用生命周期页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps/app-data/lifecycle');
    await expect(page.getByText(/生命周期|发布|版本|上线/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用版本管理页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps/app-data/versions');
    await expect(page.getByText(/版本|新建版本|发布/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('应用市场页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/market');
    await expect(page.getByText(/市场|模板|应用/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('模板提交页渲染', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/my-templates/submit');
    await expect(page.getByText(/模板|提交|发布/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('表单设计器可加载（真实 module）', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps/arch/applications/modules/mod-arch-apps/form-designer');
    // 设计器为画布页面；接口应全部 2xx（无 4xx/5xx）
    await page.waitForTimeout(3000);
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('流程设计器可加载（真实 module）', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/apps/arch/applications/modules/mod-arch-apps/flow-designer');
    await page.waitForTimeout(3000);
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });

  test('页面设计器可加载（真实 page）', async ({ page }) => {
    const tracker = trackApiFailures(page);
    await page.goto('/pages/page-arch-app-list');
    await expect(page.getByText(/页面|设计/).first()).toBeVisible({ timeout: 15000 });
    expect(tracker.failures.length, tracker.report()).toBe(0);
  });
});
