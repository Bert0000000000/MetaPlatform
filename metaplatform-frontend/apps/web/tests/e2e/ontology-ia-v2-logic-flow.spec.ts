/**
 * Ontology IA v2 · 动作与函数拆分验收（IA2-5）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §6（IA2-5 准出）：
 *  - actions/:rid 与 functions/:rid 详情路由（真数据 Tab 进 URL）；
 *  - Action Designer 不挂 /ops（/ontology/logic/designer 正式路由）；
 *  - 执行记录唯一权威页（logic/runs，?action= 深链过滤）；
 *  - Action/Function 不在语义模型（IA2-2 已迁出，本批复验）。
 *
 * <p>运行前提：dev server 9250（先预热）+ gateway 8100。
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuth } from './helpers/auth';

const GATEWAY = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8100/api/v1';
const TENANT = process.env.E2E_TENANT ?? 'tenant-default';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT };
}

async function firstOf(request: APIRequestContext, token: string, path: string): Promise<string | null> {
  const resp = await request.get(`${GATEWAY}${path}`, { headers: authHeaders(token) });
  if (resp.status() !== 200) return null;
  const rows: Array<{ rid: string }> = await resp.json();
  return rows.length > 0 ? rows[0].rid : null;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 动作与函数（IA2-5）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('ActionType 详情：深链 + Tab 进 URL + 刷新保持', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const rid = await firstOf(request, token, '/ont/v2/action-types');
    test.skip(!rid, '租户内没有动作类型，跳过');
    const enc = encodeURIComponent(rid);

    await gotoApp(page, `/ontology/logic/actions/${enc}`);
    await expect(page.locator('.mp-onto-shell')).toContainText('动作类型详情', { timeout: 20_000 });
    await expect(page.locator('.mp-onto-detail-list')).toBeVisible({ timeout: 20_000 });

    // 切「运行记录」Tab —— URL 变 /runs
    await page.locator('.mp-onto-shell .semi-tabs-tab', { hasText: '运行记录' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/logic/actions/${enc}/runs`);
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 刷新保持 Tab
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/logic/actions/${enc}/runs`);

    // 无真实数据的审批页签不显示
    await expect(
      page.locator('.mp-onto-shell .semi-tabs-tab', { hasText: '审批' }),
    ).toHaveCount(0);
  });

  test('Function 详情：深链 + 使用方 Tab（被哪些 Action 引用）', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const rid = await firstOf(request, token, '/ont/v2/functions');
    test.skip(!rid, '租户内没有函数，跳过');
    const enc = encodeURIComponent(rid);

    await gotoApp(page, `/ontology/logic/functions/${enc}`);
    await expect(page.locator('.mp-onto-shell')).toContainText('函数详情', { timeout: 20_000 });
    await expect(page.locator('.mp-onto-detail-list')).toBeVisible({ timeout: 20_000 });

    await page.locator('.mp-onto-shell .semi-tabs-tab', { hasText: '使用方' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/logic/functions/${enc}/usage`);
    await expect(page.locator('.mp-onto-detail-list')).toBeVisible({ timeout: 20_000 });
  });

  test('执行记录唯一权威页：?action= 深链过滤 + 全量视图', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const rid = await firstOf(request, token, '/ont/v2/action-types');
    test.skip(!rid, '租户内没有动作类型，跳过');

    // ?action= 过滤态
    await gotoApp(page, `/ontology/logic/runs?action=${encodeURIComponent(rid)}`);
    await expect(page.locator('.mp-onto-shell')).toContainText('执行记录', { timeout: 20_000 });
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 无过滤全量视图（表壳或空态）
    await gotoApp(page, '/ontology/logic/runs');
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });
  });

  test('Action Designer 正式路由可达（编排画布）', async ({ page }) => {
    await gotoApp(page, '/ontology/logic/designer');
    // 2267 行编排工作台：页面挂载即可（画布初始化依赖动作清单）
    await expect(page.locator('.mp-onto-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#app')).toBeAttached();
  });
});
