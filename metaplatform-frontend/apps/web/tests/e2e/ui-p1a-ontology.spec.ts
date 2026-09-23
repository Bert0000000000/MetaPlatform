/**
 * UI-P1a 验收用例：本体域（IA v2 工作区）在新骨架与令牌下可用。
 *
 * IA2-1 重写（ADR-0069）：本域改为左侧工作区导航后，原「4 个页内横向 tab」断言
 * 已随 09-17 IA 重排过期（文案漂移红）并再度随 IA v2 作废。本文件现在覆盖：
 *  - 导航形态：与全站一致的横向 PageTabs（2026-09-24 tab 模式）；
 *  - 对象浏览：类型树 + 实例表 + 点击行弹非模态 SheetDetail；
 *  - 数据映射：三子页独立成页（IA2-3 拆分）；
 *  - 类型建模：7 个子 tab 带真实计数（容器内部 tab，IA2-2 拆分）；
 *  - 发布与治理（草稿）：独立成页（IA2-6 拆分）；
 *  - 浅 / 深双主题截图。
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1a-ontology
 * 依赖：dev server 9250（先预热）、gateway 8100，且租户内有已落库的对象实例。
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuth } from './helpers/auth';

const GATEWAY = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8100/api/v1';
const TENANT = process.env.E2E_TENANT ?? 'tenant-default';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT };
}

/** 找一个确实有实例的 ObjectType，避免把「空表」误判成「没渲染」。 */
async function findSeededObjectType(request: APIRequestContext, token: string) {
  const typesResp = await request.get(`${GATEWAY}/ont/v2/object-types`, { headers: authHeaders(token) });
  expect(typesResp.status(), 'GET /ont/v2/object-types').toBe(200);
  const types: Array<{ rid: string; display_name?: string }> = await typesResp.json();
  for (const t of types) {
    const rowsResp = await request.get(
      `${GATEWAY}/ont/v2/individuals?class_rid=${encodeURIComponent(t.rid)}&limit=1`,
      { headers: authHeaders(token) },
    );
    if (rowsResp.status() !== 200) continue;
    const rows = await rowsResp.json();
    if (Array.isArray(rows) && rows.length > 0) return t;
  }
  return null;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('UI-P1a · 本体域（IA v2 工作区）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('导航形态：与全站一致的横向 PageTabs（2026-09-24 tab 模式）', async ({ page }) => {
    for (const path of [
      '/ontology/explore/objects',
      '/ontology/data/mappings',
      '/ontology/model/object-types',
      '/ontology/governance/drafts',
    ]) {
      await gotoApp(page, path);
      await expect(page.locator('.mp-pagetabs-line .semi-tabs-tab').first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator('.mp-onto-sidenav')).toHaveCount(0);
    }
  });

  test('对象浏览：类型树 + 实例表 + 点击行弹 SheetDetail', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededObjectType(request, token);
    test.skip(!seeded, '租户内没有已落库的对象实例，跳过');

    await gotoApp(page, `/ontology/explore/objects?class=${encodeURIComponent(seeded!.rid)}`);

    // 左类型树 + 可折叠分栏
    await expect(page.locator('.mp-split')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.mp-split-pane .semi-tree-option').first()).toBeVisible({ timeout: 20_000 });

    // 满宽实例表（DataTablePro）拿到真实行
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    expect(await rows.count()).toBeGreaterThan(0);

    // 点行 → 非模态详情浮层（456px，mask=false）
    await rows.first().click();
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('对象详情');
    await expect(sheet.locator('.semi-descriptions')).toBeVisible();
    expect(Math.round((await sheet.boundingBox())!.width)).toBe(456);

    // Esc 关闭
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('数据映射：三子页独立成页（IA2-3 拆分，容器视图 Tab 消亡）', async ({ page }) => {
    // 对象映射：背挂数据源声明工具条在工作
    await gotoApp(page, '/ontology/data/mappings');
    await expect(page.locator('.mp-dc-ingest-bar')).toBeVisible({ timeout: 20_000 });

    // 同步任务：健康快照表独立到达（原「数据接入」下半区升格）
    await gotoApp(page, '/ontology/data/sync');
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 血缘：分层 DAG（有登记数据时出节点，否则空态——二选一）
    await gotoApp(page, '/ontology/data/lineage');
    await expect(page.locator('.mp-graph-ln-node, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 容器时代的三个内部视图 Tab 不复存在（详细断言在 ontology-ia-v2-data-flow）
    await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);
  });

  test('语义模型：基元独立成页，公理计数回归锁保留（IA2-2 拆分）', async ({ page }) => {
    // 工作台在对象类型页（建模能力不退化）
    await gotoApp(page, '/ontology/model/object-types');
    await expect(page.getByRole('heading', { name: '一级本体' })).toBeVisible({ timeout: 20_000 });
    // 容器时代的 7-kind 横向 Tab 已消亡（详细断言在 ontology-ia-v2-model-flow）
    await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);

    // 公理计数回归锁：曾被子 tab 写死为 0，现在锁 PageHeader 描述里的真实计数
    await gotoApp(page, '/ontology/model/axioms');
    await expect(page.locator('.mp-onto-shell')).toContainText(/·\s*数据取自本体内核/, {
      timeout: 20_000,
    });
    await expect(page.locator('.mp-onto-shell')).toContainText(/[1-9]\d* 个公理/, {
      timeout: 20_000,
    });
    await expect(page.locator('.mp-tablepro .semi-table-tbody .semi-table-row').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('发布与治理（草稿）：独立成页（IA2-6 拆分，容器 Tab 消亡）', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/drafts');
    // 草稿清单 + 应用/丢弃操作卡（SchemaWipCard）
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });
    // OpsPage 容器时代的内部 Tab 不复存在（详细断言在 governance-flow）
    await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/ontology/explore/objects');
    await expect(page.getByRole('button', { name: '刷新类型清单' })).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-explorer-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-explorer-dark.png' });

    await gotoApp(page, '/ontology/model/graph');
    await expect(page.locator('.mp-onto-graph')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-graph-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-graph-dark.png' });
  });
});
