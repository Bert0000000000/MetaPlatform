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

// MP11 isolated acceptance: normal signed private input; all source/schema/sync calls hit real HTTP + PostgreSQL.
// Disable trace recording because the browser holds a test bearer token.
if (process.env.MP11_UI_TOKEN) test.use({ trace: 'off', video: 'off' });
test.describe('MP11 verified PG and CSV ingestion', () => {
  test.skip(!process.env.MP11_UI_TOKEN, 'Requires the explicitly owned signed candidate');
  test('real fields feed modeling, confirmed mappings synchronize and CSV retry is idempotent', async ({ page, request }) => {
    const { injectAuthIntoPage } = await import('./helpers/auth');
    const token = process.env.MP11_UI_TOKEN!;
    await injectAuthIntoPage(page, token, { tenantId: process.env.MP11_UI_TENANT! });
    const headers = { Authorization: `Bearer ${token}` };
    const api = process.env.MP11_API_URL!;
    const sources = await request.get(`${api}/data/sources`, { headers });
    expect(sources.ok()).toBeTruthy();
    const pgSource = (await sources.json()).items.find((s: { name: string }) => s.name === 'MP11 Verified PostgreSQL');
    expect(pgSource).toBeTruthy();
    expect(pgSource.connection_config).not.toHaveProperty('password');
    await page.goto('/gov/data/sources');
    const sourceRow = page.getByRole('row').filter({ hasText: 'MP11 Verified PostgreSQL' });
    await sourceRow.getByRole('button', { name: '测试连接' }).click();
    await expect(page.getByRole('status')).toContainText('连接已验证');
    await sourceRow.getByRole('button', { name: '发现字段' }).click();
    await expect(page.getByRole('heading', { name: 'mp11_ui_source.orders' })).toBeVisible();

    // Actual Task4 importer consumes the same verified discovery contract.
    await page.goto('/ontology/model/object-types');
    await page.getByRole('button', { name: '新建对象类型', exact: true }).click();
    await page.getByRole('button', { name: '读取数据源', exact: true }).click();
    await page.getByLabel('选择数据源').selectOption(pgSource.id);
    const realTotal = page.getByRole('button', { name: '添加字段 total（integer）', exact: true });
    await expect(realTotal).toBeVisible();
    await realTotal.click();
    await expect(page.getByText('属性定义（2 个，主键 1 个）', { exact: true })).toBeVisible();

    async function bind(type: string, source: string, table: string, csv = false) {
      await page.goto(`/ontology/data/mappings?source=${encodeURIComponent(source)}`);
      await page.getByLabel('对象类型', { exact: true }).selectOption(`ont.${process.env.MP11_UI_TENANT}.obj.${type}`);
      await page.getByRole('button', { name: '验证连接并发现字段', exact: true }).click();
      await page.getByLabel('源表', { exact: true }).selectOption(table);
      if (csv) await page.getByLabel('主键列', { exact: true }).selectOption('id');
      else await page.getByLabel('时间列', { exact: true }).selectOption('modified_at');
      await page.getByLabel('确认字段映射', { exact: true }).check();
      const saved = page.waitForResponse(r => r.url().endsWith('/datasources') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '预检并保存映射', exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await expect(page.getByRole('status')).toContainText('服务器预检通过');
      const synced = page.waitForResponse(r => r.url().includes('/datasources/sync') && r.request().method() === 'POST');
      await page.getByRole('button', { name: '全量同步 / CSV批量导入', exact: true }).click();
      const body = await (await synced).json();
      expect(body.ok).toBe(true); expect(body.run_id).toBeTruthy();
      await expect(page.getByRole('status').last()).toContainText('succeeded');
      return body;
    }
    await bind('customer', pgSource.id, 'mp11_ui_source.customers');
    await bind('order', pgSource.id, 'mp11_ui_source.orders');
    const count = async () => {
      const response = await request.get(`${api}/ont/v2/individuals`, { headers, params: { class_rid: `ont.${process.env.MP11_UI_TENANT}.obj.order` } });
      expect(response.ok()).toBeTruthy(); return (await response.json()).length;
    };
    const baseline=await count(); const csvId=Date.now();
    const csvName = `MP11 CSV ${Date.now()}`;
    await page.goto('/gov/data/sources');
    await page.getByLabel('数据源名称').fill(csvName);
    await page.getByLabel('数据源类型').selectOption('CSV');
    await page.getByLabel('CSV文件').setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from(`id,total,status\n${csvId},100,pending\n${csvId+1},110,pending\n`) });
    await page.getByLabel('CSV表名').fill('orders_csv');
    const created = page.waitForResponse(r => r.url().endsWith('/data/sources') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '保存数据源', exact: true }).click();
    const csvSource = await (await created).json();
    expect(csvSource.id).toBeTruthy();
    await bind('order', csvSource.id, 'orders_csv', true);
    const before = await count(); expect(before).toBe(baseline+2);
    const retryResponse = page.waitForResponse(r => r.url().includes('/datasources/sync') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '全量同步 / CSV批量导入', exact: true }).click();
    expect((await (await retryResponse).json()).ok).toBe(true);
    await expect(page.getByRole('status').last()).toContainText('succeeded');
    expect(await count()).toBe(before);
    const linkType = { rid: `ont.${process.env.MP11_UI_TENANT}.link.customer_orders`, src: `ont.${process.env.MP11_UI_TENANT}.obj.customer`, dst: `ont.${process.env.MP11_UI_TENANT}.obj.order`, cardinality: '1:N', directionality: 'directed' };
    expect((await request.post(`${api}/ont/v2/link-types`, { headers, data: linkType })).ok()).toBeTruthy();
    const link = { rid: `ont.${process.env.MP11_UI_TENANT}.lnk.customer_orders.1`, link_type_rid: linkType.rid, src: `ont.${process.env.MP11_UI_TENANT}.ind.customer.1`, dst: `ont.${process.env.MP11_UI_TENANT}.ind.order.1`, props: {} };
    expect((await request.post(`${api}/ont/v2/link-instances`, { headers, data: link })).ok()).toBeTruthy();
    const links = await request.get(`${api}/ont/v2/link-instances`, { headers });
    expect(links.ok()).toBeTruthy();
    expect((await links.json()).some((l: { rid: string }) => l.rid === link.rid)).toBeTruthy();
    await page.getByRole('status').last().scrollIntoViewIfNeeded();

  });
});
