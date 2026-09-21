/**
 * Ontology IA v2 · 语义模型拆分验收（IA2-2）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §6（IA2-2 准出）：
 *  - /model/* 每页有独立 URL，各自渲染自己的真实数据面；
 *  - 原 7-kind 容器横向 Tab 消亡（语义模型不含 Action/Function——它们在 /logic/*）；
 *  - 对象类型详情路由：:rid 深链 + 四个真 Tab 进 URL + 刷新/返回保持；
 *  - 建模工作台（OntologyModelingPage）原样保留，能力不退化。
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

/** 取第一个对象类型的 rid（详情路由用；租户一定有类型，否则前置失败）。 */
async function firstObjectTypeRid(request: APIRequestContext, token: string): Promise<string> {
  const resp = await request.get(`${GATEWAY}/ont/v2/object-types`, { headers: authHeaders(token) });
  expect(resp.status(), 'GET /ont/v2/object-types').toBe(200);
  const types: Array<{ rid: string }> = await resp.json();
  expect(types.length, '租户内应有对象类型').toBeGreaterThan(0);
  return types[0].rid;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 语义模型（IA2-2）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('基元页各有独立 URL 且出真实表格（关系/接口/公理）', async ({ page }) => {
    const cases: Array<[string, string]> = [
      ['/ontology/model/link-types', '关系类型'],
      ['/ontology/model/interfaces', '接口'],
      ['/ontology/model/axioms', '公理'],
    ];
    for (const [path, title] of cases) {
      await gotoApp(page, path);
      // 标题（PageHeader）与表格壳（或空态）二选一
      await expect(page.locator('.mp-onto-shell')).toContainText(title, { timeout: 20_000 });
      await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test('语义模型不再有 7-kind 容器 Tab；动作/函数在 /logic/* 各自成页', async ({ page }) => {
    await gotoApp(page, '/ontology/model/object-types');
    // 工作台在（建模能力不退化）
    await expect(page.getByRole('heading', { name: '一级本体' })).toBeVisible({ timeout: 20_000 });
    // 容器时代的 7-kind 横向 Tab 行不复存在（整个 model 组内无 button 型 Tabs）
    await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);

    // 动作 / 函数已迁往「动作与函数」组
    await gotoApp(page, '/ontology/logic/actions');
    await expect(page.locator('.mp-onto-shell')).toContainText('动作类型', { timeout: 20_000 });
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });
    await gotoApp(page, '/ontology/logic/functions');
    await expect(page.locator('.mp-onto-shell')).toContainText('函数', { timeout: 20_000 });
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });
  });

  test('模型校验页（lint 从治理页迁入）可达', async ({ page }) => {
    await gotoApp(page, '/ontology/model/validation');
    await expect(page.locator('.mp-onto-shell')).toContainText('模型校验', { timeout: 20_000 });
    // 有发现 → 列表；无发现 → 空态；两者必有其一
    await expect(page.locator('.mp-onto-lint-item, .mp-empty').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('对象类型详情：深链 + Tab 进 URL + 刷新/返回保持', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const rid = await firstObjectTypeRid(request, token);
    const enc = encodeURIComponent(rid);

    // 深链直达概览
    await gotoApp(page, `/ontology/model/object-types/${enc}`);
    await expect(page.locator('.mp-onto-shell')).toContainText('对象类型详情', { timeout: 20_000 });
    await expect(page.locator('.mp-onto-detail-list')).toBeVisible({ timeout: 20_000 });

    // 切「属性」Tab —— URL 变为 /properties，且表格（或空态）出现
    await page.locator('.mp-onto-shell .semi-tabs-tab', { hasText: '属性' }).click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/model/object-types/${enc}/properties`);
    await expect(page.locator('.mp-tablepro, .mp-empty').first()).toBeVisible({ timeout: 20_000 });

    // 刷新保持 Tab
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/model/object-types/${enc}/properties`);

    // 返回 → 概览 Tab（路由历史，不丢）
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/model/object-types/${enc}`);
    await expect(page.locator('.mp-onto-detail-list')).toBeVisible({ timeout: 20_000 });
  });

  test('模型图谱正式路由可达', async ({ page }) => {
    await gotoApp(page, '/ontology/model/graph');
    await expect(page.locator('.mp-onto-shell')).toContainText('模型图谱', { timeout: 20_000 });
    await expect(page.locator('.mp-onto-graph')).toBeVisible({ timeout: 20_000 });
  });
});
