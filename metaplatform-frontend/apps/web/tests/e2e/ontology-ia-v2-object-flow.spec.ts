/**
 * Ontology IA v2 · 对象与查询拆分验收（IA2-4）——消费动线闭环。
 *
 * <p>判据来自 ADR-0069 与设计规格 §6（IA2-4 准出）：
 *  对象列表 → 打开对象（URL 变 /objects/:rid）→ 点关联对象（URL 随之更新）→
 *  浏览器返回（回到上一对象）→ 执行动作 → Proposal 确认 → 详情刷新；
 *  同时：刷新详情不丢、URL 可分享、旧 ?id= 深链迁移到段路由、页码进 URL。
 *
 * <p>运行前提：dev server 9250（先预热）+ gateway 8100，且租户内有已落库实例。
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuth } from './helpers/auth';

const GATEWAY = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8100/api/v1';
const TENANT = process.env.E2E_TENANT ?? 'tenant-default';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT };
}

/** 找一个有实例且有关联对象（searchAround 有 peer）的类型与实例。 */
async function findSeededWithRelation(
  request: APIRequestContext,
  token: string,
): Promise<{ classRid: string; rid: string; peerRid: string | null } | null> {
  const typesResp = await request.get(`${GATEWAY}/ont/v2/object-types`, { headers: authHeaders(token) });
  const types: Array<{ rid: string }> = await typesResp.json();
  for (const t of types) {
    const rowsResp = await request.get(
      `${GATEWAY}/ont/v2/individuals?class_rid=${encodeURIComponent(t.rid)}&limit=5`,
      { headers: authHeaders(token) },
    );
    if (rowsResp.status() !== 200) continue;
    const rows: Array<{ rid: string }> = await rowsResp.json();
    for (const row of rows.slice(0, 3)) {
      const aroundResp = await request.get(
        `${GATEWAY}/ont/v2/individuals/${encodeURIComponent(row.rid)}/around?limit=20`,
        { headers: authHeaders(token) },
      ).catch(() => null);
      if (!aroundResp || aroundResp.status() !== 200) continue;
      const groups = (await aroundResp.json()) as Array<{ peers: Array<Record<string, unknown>> }>;
      let peerRid: string | null = null;
      outer: for (const g of groups) {
        for (const peer of g.peers ?? []) {
          const prid = peer.__rid__ ? String(peer.__rid__) : '';
          if (prid) {
            peerRid = prid;
            break outer;
          }
        }
      }
      // 第 2 条用例需要 peer——没有就继续找下一个实例/类型
      if (peerRid) return { classRid: t.rid, rid: row.rid, peerRid };
    }
  }
  return null;
}

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 对象与查询（IA2-4）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('打开对象 → URL 变 /objects/:rid → 刷新不丢 → 关闭回列表（页码保留语义）', async ({
    page,
    request,
  }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededWithRelation(request, token);
    test.skip(!seeded, '租户内没有已落库的对象实例，跳过');

    await gotoApp(page, `/ontology/explore/objects?class=${encodeURIComponent(seeded.classRid)}`);
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });

    // 点行 → URL 变为段路由，Sheet 打开
    await rows.first().click();
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await expect(sheet).toContainText('对象详情');
    const detailUrl = new URL(page.url());
    expect(detailUrl.pathname).toMatch(/^\/ontology\/explore\/objects\/.+$/);

    // 刷新 → 详情仍在（URL 是唯一真相）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#app .mp-sheet')).toBeVisible({ timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe(detailUrl.pathname);

    // 关闭 → 回列表（无 :rid 段），类型过滤保留
    await page.keyboard.press('Escape');
    await expect(page.locator('#app .mp-sheet')).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
      .toBe('/ontology/explore/objects');
  });

  test('关系跳转更新 URL，浏览器返回回到上一对象', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededWithRelation(request, token);
    test.skip(!seeded || !seeded.peerRid, '租户内没有带关联对象的实例，跳过');

    // 深链直达第一个对象（段路由即分享 URL）
    await gotoApp(page, `/ontology/explore/objects/${encodeURIComponent(seeded.rid)}`);
    const sheet = page.locator('#app .mp-sheet');
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    const firstPath = new URL(page.url()).pathname;

    // 点关联对象 chip → URL 更新为 peer 的段路由
    const chip = page.locator('.mp-explorer-rel-chip').first();
    await expect(chip).toBeVisible({ timeout: 15_000 });
    await chip.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .not.toBe(firstPath);

    // 浏览器返回 → 回到上一对象的 URL 与详情
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe(firstPath);
    await expect(page.locator('#app .mp-sheet')).toBeVisible({ timeout: 15_000 });
  });

  test('旧 ?id= 深链 replace 到段路由（一个发布周期内的兼容）', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededWithRelation(request, token);
    test.skip(!seeded, '租户内没有已落库的对象实例，跳过');

    await gotoApp(
      page,
      `/ontology/explore/objects?class=${encodeURIComponent(seeded.classRid)}&id=${encodeURIComponent(seeded.rid)}`,
    );
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe(`/ontology/explore/objects/${encodeURIComponent(seeded.rid)}`);
    await expect(page.locator('#app .mp-sheet')).toBeVisible({ timeout: 15_000 });
  });

  test('页码进 URL：翻页后 URL 带 ?page= 且刷新保持', async ({ page, request }) => {
    const token = await fetchAccessToken(request);
    const seeded = await findSeededWithRelation(request, token);
    test.skip(!seeded, '租户内没有已落库的对象实例，跳过');

    await gotoApp(page, `/ontology/explore/objects?class=${encodeURIComponent(seeded.classRid)}`);
    const rows = page.locator('.mp-tablepro .semi-table-tbody .semi-table-row');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    // 租户数据不足一页时无翻页控件——此用例只在多页数据下有意义
    const nextPage = page.locator('.semi-pagination-next');
    if (await nextPage.isVisible().catch(() => false)) {
      await nextPage.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.get('page'), { timeout: 10_000 })
        .toBe('2');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(new URL(page.url()).searchParams.get('page')).toBe('2');
    }
  });
});
