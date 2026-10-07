/**
 * ONT-MIGRATION-PLAN（ADR-0082）· 存量适配端到端验收。
 *
 * <p>判据（ADR-0082 §4 / 验收 §1~§8）：
 *  发布与发布页「存量适配」面板：评估只读给出真实影响计数 → 执行迁移（默认
 *  preserve 不丢数据）→ 迁移记录入档；家族发布（发布新版本）自动携带实例
 *  （reattach 记录 + 新 rid 下实例可见）。
 *
 * <p>运行前提：dev server 9250（先无头预热）+ gateway 8100 + ont 容器。
 * 种子：专属类型 `...mige2e-<ts>-<test>-.v1`；清理尽力而为——使用量删除保护
 * 会拦「30 天内有读」的类型（断言读本身计入），所以每个用例用独立 slug，
 * 残留行不互相污染（与既有 E2E 的 客户_* 系列同口径）。
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuth } from './helpers/auth';

const GATEWAY = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8100/api/v1';
const TENANT = process.env.E2E_TENANT ?? 'tenant-default';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

interface SeedIds {
  v1: string;
  v2: string;
  pId: string;
  pLeg: string;
  ind: string;
  name: string;
}

/** 每个用例独立 slug（Date.now + 用例号），清理失败也不串号。 */
function idsFor(testId: string): SeedIds {
  const sfx = `${Date.now().toString(36)}-${testId}`;
  return {
    v1: `ont.${TENANT}.obj.crm.mige2e-${sfx}.v1`,
    v2: `ont.${TENANT}.obj.crm.mige2e-${sfx}.v2`,
    pId: `ont.${TENANT}.prop.migeid-${sfx}.v1`,
    pLeg: `ont.${TENANT}.prop.migeleg-${sfx}.v1`,
    ind: `ont.${TENANT}.ind.mige2e-${sfx}.s1`,
    name: `mige2e-${sfx}`,
  };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT };
}

function otBody(ids: SeedIds, props: string[], confirm = false) {
  const body: Record<string, unknown> = {
    rid: ids.v1,
    display_name: ids.name,
    primary_key: [ids.pId],
    properties: props.map((p) => {
      const parts = p.split('.');
      return {
        rid: p,
        type_id: 'string',
        nullable: p !== ids.pId,
        primary_key: p === ids.pId,
        title: parts[parts.length - 2] ?? p,
        format: 'string',
      };
    }),
    interfaces: [],
  };
  if (confirm) body.confirm_name = ids.name;
  return body;
}

async function seed(request: APIRequestContext, token: string, ids: SeedIds): Promise<void> {
  const h = { ...authHeaders(token), 'Content-Type': 'application/json' };
  // v1：id + legacy；实例一条（legacy 键将有值）；破坏性重发布删 legacy（带确认）
  let r = await request.post(`${GATEWAY}/ont/v2/object-types`, {
    headers: h,
    data: otBody(ids, [ids.pId, ids.pLeg]),
  });
  expect(r.status(), `seed publish v1: ${await r.text()}`).toBe(200);
  r = await request.post(`${GATEWAY}/ont/v2/individuals`, {
    headers: h,
    data: {
      rid: ids.ind,
      class_rid: ids.v1,
      props: {
        [ids.pId]: { value: 's1', type: 'string' },
        [ids.pLeg]: { value: 'keep-me', type: 'string' },
      },
      primary_key: 's1',
    },
  });
  expect(r.status(), `seed instance: ${await r.text()}`).toBe(200);
  r = await request.post(`${GATEWAY}/ont/v2/object-types`, {
    headers: h,
    data: otBody(ids, [ids.pId], true),
  });
  expect(r.status(), `seed destructive republish: ${await r.text()}`).toBe(200);
}

async function cleanup(request: APIRequestContext, token: string, ids: SeedIds): Promise<void> {
  const h = { ...authHeaders(token), 'Content-Type': 'application/json' };
  for (const rid of [ids.v2, ids.v1]) {
    await request
      .post(`${GATEWAY}/ont/v2/object-types/${encodeURIComponent(rid)}/lifecycle`, {
        headers: h,
        data: { action: 'deprecate', actor: 'e2e-migration' },
      })
      .catch(() => null);
    await request
      .delete(`${GATEWAY}/ont/v2/object-types/${encodeURIComponent(rid)}?hard=true`, { headers: h })
      .catch(() => null);
  }
}

async function pickType(page: Page, rid: string): Promise<void> {
  const sel = page.locator('.mp-gov-card select').first();
  await sel.waitFor({ state: 'visible', timeout: 20_000 });
  await sel.selectOption(rid);
}

test.describe('Ontology · 存量适配（ADR-0082）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('评估 → 执行（默认 preserve）→ 记录；家族发布自动携带实例', async ({
    page,
    request,
  }) => {
    const token = await fetchAccessToken(page.request);
    const ids = idsFor('flow');
    await cleanup(request, token, ids);
    await seed(request, token, ids);
    try {
      // ① 页面渲染：存量适配面板存在
      await page.goto('/ontology/governance/releases', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.mp-onto-shell')).toContainText('存量适配', { timeout: 20_000 });
      await pickType(page, ids.v1);

      // ② 评估：真实影响计数（悬空 legacy 键 1 条实例）
      await page.getByRole('button', { name: /评估影响/ }).click();
      await expect(page.locator('.mp-onto-shell')).toContainText('评估结果', { timeout: 15_000 });
      await expect(page.locator('.mp-onto-shell')).toContainText('受影响实例');
      await expect(page.locator('.mp-onto-shell')).toContainText('悬空属性键');
      await expect(page.locator('.mp-onto-shell')).toContainText('保留键');

      // ③ 执行迁移：确认对话框 → 完成消息（preserve 计数）
      page.once('dialog', (d) => void d.accept());
      await page.getByRole('button', { name: /执行迁移/ }).click();
      await expect(page.locator('.mp-onto-shell')).toContainText('迁移完成', { timeout: 20_000 });
      await expect(page.locator('.mp-onto-shell')).toContainText('计划执行');

      // 数据核验（preserve 默认不丢数据）
      const ind = await request.get(
        `${GATEWAY}/ont/v2/individuals/${encodeURIComponent(ids.ind)}`,
        { headers: authHeaders(token) },
      );
      expect(ind.status()).toBe(200);
      const props = ((await ind.json()) as { props: Record<string, unknown> }).props ?? {};
      expect(String(props[ids.pLeg] ?? '')).toContain('keep-me');

      // ④ 家族发布（v1 → v2）：自动携带实例 + 发布携带记录
      await page.locator('input[placeholder*="新版本 rid"]').fill(ids.v2);
      await page.getByRole('button', { name: /发布新版本/ }).click();
      await expect(page.locator('.mp-onto-shell')).toContainText('发布成功', { timeout: 20_000 });
      await expect(page.locator('.mp-onto-shell')).toContainText('发布携带', { timeout: 15_000 });

      // 新 rid 下实例可见（修复前此处为 0 行）
      const rows = await request.get(
        `${GATEWAY}/ont/v2/individuals?class_rid=${encodeURIComponent(ids.v2)}&limit=10`,
        { headers: authHeaders(token) },
      );
      expect(rows.status()).toBe(200);
      const list = (await rows.json()) as Array<{ rid: string }>;
      expect(list.map((r) => r.rid)).toContain(ids.ind);
    } finally {
      await cleanup(request, token, ids);
    }
  });

  test('无幂等键执行被拒（400）——后端守卫', async ({ page, request }) => {
    const token = await fetchAccessToken(page.request);
    const ids = idsFor('nokey');
    await cleanup(request, token, ids);
    await seed(request, token, ids);
    try {
      const a = await request.post(
        `${GATEWAY}/ont/v2/object-types/${encodeURIComponent(ids.v1)}/migration/assess`,
        { headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, data: {} },
      );
      expect(a.status()).toBe(200);
      const assessment = (await a.json()) as { plan: unknown; to_checksum: string };
      const noKey = await request.post(
        `${GATEWAY}/ont/v2/object-types/${encodeURIComponent(ids.v1)}/migration/run`,
        {
          headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
          data: { plan: assessment.plan, expected_checksum: assessment.to_checksum },
        },
      );
      expect(noKey.status()).toBe(400);

      // UI 面板在该类型下也正常渲染（评估只读可用）
      await page.goto('/ontology/governance/releases', { waitUntil: 'domcontentloaded' });
      await pickType(page, ids.v1);
      await page.getByRole('button', { name: /评估影响/ }).click();
      await expect(page.locator('.mp-onto-shell')).toContainText('评估结果', { timeout: 15_000 });
    } finally {
      await cleanup(request, token, ids);
    }
  });
});
