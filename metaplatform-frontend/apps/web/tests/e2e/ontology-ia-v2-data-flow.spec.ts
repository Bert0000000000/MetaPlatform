/**
 * Ontology IA v2 · 数据映射拆分验收（IA2-3）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §6（IA2-3 准出）：
 *  - 数据映射三子页（对象映射 / 同步任务 / 本体血缘）有独立 URL，各自渲染真实数据面；
 *  - 原 DatacenterPage 容器的内部视图 Tab 消亡；
 *  - 全局资产清单不再是本体路由（/ontology/datacenter 301 到 mappings，无 assets 路由）；
 *  - 同步任务页（原「数据接入」下半区）可独立到达。
 *
 * <p>运行前提：dev server 9250（先预热）+ gateway 8100。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 数据映射（IA2-3）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('三个子页有独立 URL 且容器内部 Tab 消亡', async ({ page }) => {
    // 对象映射：背挂数据源声明面板在工作
    await gotoApp(page, '/ontology/data/mappings');
    await expect(page.locator('.mp-onto-shell')).toContainText('对象映射', { timeout: 20_000 });
    await expect(page.locator('.mp-onto-shell').getByText('背挂数据源', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // 同步任务：健康快照表（或空态）独立成页
    await gotoApp(page, '/ontology/data/sync');
    await expect(page.locator('.mp-onto-shell')).toContainText('同步任务', { timeout: 20_000 });
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 本体血缘：分层 DAG（或空态）
    await gotoApp(page, '/ontology/data/lineage');
    await expect(page.locator('.mp-onto-shell')).toContainText('本体血缘', { timeout: 20_000 });
    await expect(page.locator('.mp-graph-ln-node, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 容器时代的三个内部视图 Tab 不复存在
    for (const path of ['/ontology/data/mappings', '/ontology/data/sync', '/ontology/data/lineage']) {
      await gotoApp(page, path);
      await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);
    }
  });

  test('数据映射组子 tab「同步任务」可达（planned → active）', async ({ page }) => {
    await gotoApp(page, '/ontology/data/mappings');
    const tab = page.locator('.mp-subtabs .semi-tabs-tab', { hasText: '同步任务' });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/data/sync');
  });

  test('资产清单不再是本体路由（容器旧路径 301 到对象映射）', async ({ page }) => {
    await gotoApp(page, '/ontology/datacenter');
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/data/mappings');
    // 本体导航中没有资产清单入口
    await gotoApp(page, '/ontology/data/mappings');
    await expect(page.locator('.mp-onto-sidenav-link', { hasText: '资产清单' })).toHaveCount(0);
  });
});
