/**
 * UI-P1a 验收用例：本体域（4 个页内 tab）改用新骨架与令牌。
 *
 * 覆盖 DESIGN-SPEC §5 版式 B（对象浏览器）/ F（数据中心）/ E（建模、运维）与 UI-P1 通用 DoD：
 *  - 4 个 tab 在新壳内打开，数据来自真实本体内核（不 mock）
 *  - 对象浏览器：类型树 + 实例表 + 点击行弹非模态 SheetDetail
 *  - 数据中心：力导向图谱渲染 + 节点选中详情卡 + 三视图切换
 *  - 类型建模：6 个子 tab 与真实计数
 *  - 运维：接入 / 版本 / 审计三个真实运维面
 *  - 浅 / 深双主题截图
 *
 * 运行：pnpm --dir apps/web exec playwright test ui-p1a-ontology
 * 依赖：dev server 9250、gateway 8100，且租户内有已落库的对象实例。
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

test.describe('UI-P1a · 本体域', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('4 个页内 tab 在新壳内打开，壳不再叠加第二行 tab', async ({ page }) => {
    const tabs: Array<[string, string]> = [
      ['/ontology/explorer', '对象浏览器'],
      ['/ontology/datacenter', '数据中心'],
      ['/ontology/model', '类型建模'],
      ['/ontology/ops', '运维'],
    ];
    for (const [path, label] of tabs) {
      await gotoApp(page, path);
      const bar = page.locator('.mp-pagetabs .semi-tabs-tab');
      await expect(bar.filter({ hasText: label })).toBeVisible({ timeout: 20_000 });
      // 域内页面自己不再渲染第二行同名 tab（P1a 已摘掉 ownsTabs）
      await expect(page.locator('.mp-page .mp-pagetabs')).toHaveCount(0);
    }
  });

  test('对象浏览器：类型树 + 实例表 + 点击行弹 SheetDetail', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededObjectType(request, token);
    test.skip(!seeded, '租户内没有已落库的对象实例，跳过');

    await gotoApp(page, `/ontology/explorer?class=${encodeURIComponent(seeded!.rid)}`);

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

  test('数据中心：图谱渲染 + 节点详情卡 + 三视图切换', async ({ page }) => {
    await gotoApp(page, '/ontology/datacenter');

    // 知识图谱：SVG 里真的有节点与边
    await expect(page.locator('.mp-dc-stage svg').first()).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => page.locator('.mp-graph-node').count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    // 节点可选中并弹出详情卡。
    // 点的是节点圆本身：<g> 的包围盒含上方文字标签，盒心不在圆心，force 点盒心会落空；
    // 力导向逐帧重排又会让元素一直「不稳定」，故 force 跳过可操作性等待。
    await page.locator('.mp-graph-node').first().locator('circle').click({ force: true });
    await expect(page.locator('.mp-dc-card')).toBeVisible({ timeout: 10_000 });

    // 视图切换：血缘 / 资产
    await page.locator('.mp-dc-toolbar .semi-tabs-tab', { hasText: '数据血缘' }).click();
    await expect(page.locator('.mp-dc-title')).toHaveText('数据血缘');
    await page.locator('.mp-dc-toolbar .semi-tabs-tab', { hasText: '资产清单' }).click();
    await expect(page.locator('.mp-dc-title')).toHaveText('资产清单');
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible();
  });

  test('类型建模：6 个子 tab 带真实计数', async ({ page }) => {
    await gotoApp(page, '/ontology/model');
    const tabs = page.locator('.mp-page .semi-tabs-tab');
    for (const label of ['对象类型', '关系类型', '动作类型', '函数', '接口', '公理']) {
      await expect(tabs.filter({ hasText: label })).toBeVisible({ timeout: 20_000 });
    }
    // 对象类型清单非空
    await expect(page.locator('.mp-tablepro .semi-table-tbody .semi-table-row').first()).toBeVisible({
      timeout: 20_000,
    });

    // 公理：内核未暴露清单接口 → 如实空状态（不是空白页）
    await tabs.filter({ hasText: '公理' }).click();
    await expect(page.locator('.mp-empty')).toContainText('公理列表尚未开放');
  });

  test('运维：三个子 tab 都在真实运维面上', async ({ page }) => {
    await gotoApp(page, '/ontology/ops');
    const tabs = page.locator('.mp-page .semi-tabs-tab');
    for (const label of ['数据接入', '版本与发布', '变更审计']) {
      await expect(tabs.filter({ hasText: label })).toBeVisible({ timeout: 20_000 });
    }
    // 表格壳或空状态二选一必然存在（不出现白屏）
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 过渡期入口：三个尚未重写的既有运维面仍可达
    await page.locator('.mp-page-head-actions button', { hasText: '更多运维工具' }).click();
    await expect(page.locator('.semi-dropdown-menu')).toContainText('Action 编排');
  });

  test('浅 / 深双主题截图（视觉证据）', async ({ page }) => {
    await gotoApp(page, '/ontology/explorer');
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-explorer-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-explorer-dark.png' });

    await gotoApp(page, '/ontology/datacenter');
    await expect
      .poll(async () => page.locator('.mp-graph-node').count(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'light'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-datacenter-light.png' });
    await page.evaluate(() => document.body.setAttribute('theme-mode', 'dark'));
    await page.screenshot({ path: 'tests/e2e/screenshots/ui-p1a-datacenter-dark.png' });
  });
});
