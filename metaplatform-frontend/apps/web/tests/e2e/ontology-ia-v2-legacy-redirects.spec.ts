/**
 * Ontology IA v2 · 旧路径迁移矩阵（IA2-0 失败测试，IA2-1 起随矩阵推进转绿）。
 *
 * <p>表驱动覆盖设计规格 §4.2 的**全部**旧路径与 `?tab=` 变体：每个旧入口最终
 * 必须落在新正式路径上（允许保留可安全迁移的 query，故按 pathname 断言）。
 * 矩阵是唯一权威：`legacy-redirects.tsx`（按路径 301）与 `routes/ontology.tsx`
 * （`?tab=` 转发 + 新路由）不得重复注册同一路径。
 *
 * <p>运行前提同 ontology-ia-v2-navigation.spec.ts（9250 已预热 + 8100 网关）。
 * 红因：现有 301 的目标仍是 6-tab 旧路径（如 /ontology/objects、/ontology/ops），
 * 未指向 IA v2 新路径。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

/**
 * [旧入口, 期望最终 pathname]。
 * 行顺序与设计规格 §4.2 一致；新增旧路径必须同时登记规格与本表。
 */
const CASES: Array<[string, string]> = [
  // ---- /ontology?tab=* 变体（routes/ontology.tsx 的 LEGACY_TAB_TARGET 演进） ----
  ['/ontology?tab=overview', '/ontology'],
  ['/ontology?tab=concept', '/ontology/model/object-types'],
  ['/ontology?tab=modeling', '/ontology/model/object-types'],
  ['/ontology?tab=model', '/ontology/model/object-types'],
  ['/ontology?tab=graph', '/ontology/model/graph'],
  ['/ontology?tab=objects', '/ontology/explore/objects'],
  ['/ontology?tab=data', '/ontology/data/mappings'],
  ['/ontology?tab=datacenter', '/ontology/data/mappings'],
  ['/ontology?tab=action', '/ontology/logic/actions'],
  ['/ontology?tab=analytics', '/ontology/explore/analysis'],
  ['/ontology?tab=governance', '/ontology/governance/releases'],
  // ---- 6-tab 时代路径 ----
  ['/ontology/model', '/ontology/model/object-types'],
  ['/ontology/model/editor', '/ontology/model/object-types'],
  ['/ontology/object-types', '/ontology/model/object-types'],
  ['/ontology/relationship-types', '/ontology/model/link-types'],
  ['/ontology/graph', '/ontology/model/graph'],
  ['/ontology/action', '/ontology/logic/actions'],
  ['/ontology/actions', '/ontology/logic/actions'],
  ['/ontology/objects', '/ontology/explore/objects'],
  ['/ontology/explorer', '/ontology/explore/objects'],
  ['/ontology/datacenter', '/ontology/data/mappings'],
  ['/ontology/apps', '/ontology/explore/analysis'],
  ['/ontology/analytics', '/ontology/explore/analysis'],
  ['/ontology/ops/actions', '/ontology/logic/designer'],
  ['/ontology/ops/governance', '/ontology/governance/releases'],
  ['/ontology/ops', '/ontology/governance/drafts'],
  ['/ontology/governance', '/ontology/governance/releases'],
];

test.describe('Ontology IA v2 · 旧路径迁移矩阵', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  for (const [legacy, target] of CASES) {
    test(`redirect：${legacy} → ${target}`, async ({ page }) => {
      await page.goto(legacy, { waitUntil: 'domcontentloaded' });
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
        .toBe(target);
      await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
    });
  }

  // 深链上下文参数透传（设计规格 §4.2 迁移要求：保留可安全迁移的 query）。
  // pathname 断言先行；`?class=` 在 IA2-4 对象浏览路由化后补参数级断言。
  test('redirect：/ontology/explorer?class=… → /ontology/explore/objects（参数随迁）', async ({
    page,
  }) => {
    await page.goto('/ontology/explorer?class=probe-rid', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/explore/objects');
    await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
  });
});
