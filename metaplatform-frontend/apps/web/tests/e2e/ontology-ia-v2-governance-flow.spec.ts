/**
 * Ontology IA v2 · 发布与治理拆分验收（IA2-6）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §6（IA2-6 准出）：
 *  - 治理每个能力有正式 URL（七子页）；
 *  - Agent 服务关闭时页面仍正常（agentMetrics 依赖已删）；
 *  - 版本 / Diff / Rollback / Import/Export / Usage 等现有操作没有丢失；
 *  - OpsPage / GovernancePage 大容器消亡。
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

test.describe('Ontology IA v2 · 发布与治理（IA2-6）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('七子页有独立 URL 且容器消亡（逐页真数据面或空态）', async ({ page }) => {
    const cases: Array<[string, string]> = [
      ['/ontology/governance/drafts', '草稿'],
      ['/ontology/governance/releases', '版本与发布'],
      ['/ontology/governance/usage', '使用量'],
      ['/ontology/governance/lint', '模型检查'],
      ['/ontology/governance/security', '安全策略'],
      ['/ontology/governance/import-export', '导入导出'],
      ['/ontology/governance/audit', '审计'],
    ];
    for (const [path, title] of cases) {
      await gotoApp(page, path);
      await expect(page.locator('.mp-onto-shell')).toContainText(title, { timeout: 20_000 });
      await expect(page.locator('.mp-tablepro, .mp-empty, .mp-onto-detail-list, select').first()).toBeVisible({
        timeout: 20_000,
      });
    }

    // 容器时代的内部 Tab 消亡（OpsPage 的 release/governance 按钮行）
    await gotoApp(page, '/ontology/governance/drafts');
    await expect(page.locator('.mp-onto-shell .semi-tabs-bar-button')).toHaveCount(0);
  });

  test('治理组子 tab 胶囊行七页全亮', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/drafts');
    const sub = page.locator('.mp-subtabs .semi-tabs-tab');
    for (const label of ['草稿', '版本与发布', '使用量', '模型检查', '安全策略', '导入导出', '审计']) {
      await expect(sub.filter({ hasText: label })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Agent 指标已删：治理任何页面无 Agent 回归指标区块', async ({ page }) => {
    for (const path of ['/ontology/governance/releases', '/ontology/governance/usage', '/ontology/governance/audit']) {
      await gotoApp(page, path);
      await expect(page.locator('.mp-onto-shell')).not.toContainText('Agent 回归指标');
      await expect(page.locator('.mp-onto-shell')).not.toContainText('接受率基线');
    }
  });

  test('模型检查是入口页：链接到语义模型组的模型校验', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/lint');
    const link = page.getByRole('link', { name: /前往模型校验/ });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/model/validation');
  });

  test('版本操作能力未退化：分支/差异/回滚表单在工作', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/releases');
    await expect(page.getByPlaceholder('分支新 rid：ont.<租户>.obj.<域>.<slug>.vN')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByPlaceholder('对比 rid（against）')).toBeVisible();
    await expect(page.getByPlaceholder(/回滚来源 rid/)).toBeVisible();
    await expect(page.getByRole('button', { name: /创建分支/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /对比差异/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /回滚/ })).toBeVisible();
  });

  test('导入导出能力未退化', async ({ page }) => {
    await gotoApp(page, '/ontology/governance/import-export');
    await expect(page.getByRole('button', { name: /导出当前类型/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[type="file"][accept$=".json"]')).toBeVisible();
  });
});
