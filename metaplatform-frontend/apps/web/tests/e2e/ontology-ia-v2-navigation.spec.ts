/**
 * Ontology IA v2 · 工作区导航骨架验收（IA2-0 失败测试，IA2-1 转绿）。
 *
 * <p>判据来自 ADR-0069 与设计规格 §4 / §8：
 *  - 六大功能域（总览 / 语义模型 / 数据映射 / 对象与查询 / 动作与函数 / 发布与治理）
 *    的默认路径是正式 URL，域根路径 redirect 到默认子页；
 *  - 本体工作区有左侧导航（二级页面以链接可达），且**不再渲染全局横向 PageTabs**；
 *  - 刷新保持当前页面；浏览器后退 / 前进切换正确；点左侧导航项按路由跳转。
 *
 * <p>运行前提（ONTOLOGY-IA2-0-BASELINE §2）：dev server 9250（先预热，冷启动会假红）
 * + gateway 8100。红因：新路由未注册，访问落 `*` 兜底被甩回 /home；无左侧导航；
 * PageTabs 仍在渲染。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuth } from './helpers/auth';

// 2.1-C 先例：本机 IAM 登录尖峰可超 30s，共用 helper 支持环境变量放宽。
process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

/** 六大功能域：域名（左侧导航分组文案）→ 默认正式路径。设计规格 §4.3。 */
const WORKSPACE_DOMAINS: Array<[string, string]> = [
  ['总览', '/ontology'],
  ['语义模型', '/ontology/model/object-types'],
  ['数据映射', '/ontology/data/mappings'],
  ['对象与查询', '/ontology/explore/objects'],
  ['动作与函数', '/ontology/logic/actions'],
  ['发布与治理', '/ontology/governance/drafts'],
];

/** 域根路径 → 默认子页（redirect 契约）。 */
const DOMAIN_ROOTS: Array<[string, string]> = [
  ['/ontology/model', '/ontology/model/object-types'],
  ['/ontology/data', '/ontology/data/mappings'],
  ['/ontology/explore', '/ontology/explore/objects'],
  ['/ontology/logic', '/ontology/logic/actions'],
  ['/ontology/governance', '/ontology/governance/drafts'],
];

/** 对象浏览页稳定内容锚点：IA2-4 只「原样迁入」ObjectExplorerPage，锚点应保留。 */
const EXPLORER_MARKER = '刷新类型清单';

async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
}

test.describe('Ontology IA v2 · 工作区导航', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('六大功能域默认路径均为正式 URL，左侧导航可达，且无全局横向 PageTabs', async ({
    page,
  }) => {
    for (const [domainLabel, path] of WORKSPACE_DOMAINS) {
      await gotoApp(page, path);
      // 域根 redirect 后最终 URL 就是默认子页（/ontology 总览为落地页，本身就是终态）
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
        .toBe(path);
      // 左侧导航分组文案可见（工作区级导航存在）
      await expect(page.getByText(domainLabel, { exact: true }).first()).toBeVisible({
        timeout: 20_000,
      });
      // 本体域不渲染全局横向 PageTabs（ADR-0069 决策本体）
      await expect(page.locator('.mp-pagetabs')).toHaveCount(0);
    }
  });

  test('域根路径 redirect 到默认子页', async ({ page }) => {
    for (const [root, target] of DOMAIN_ROOTS) {
      await gotoApp(page, root);
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
        .toBe(target);
    }
  });

  test('刷新保持当前页面', async ({ page }) => {
    await gotoApp(page, '/ontology/explore/objects');
    await expect(page.getByRole('button', { name: EXPLORER_MARKER })).toBeVisible({
      timeout: 20_000,
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/explore/objects');
    await expect(page.getByRole('button', { name: EXPLORER_MARKER })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('浏览器后退 / 前进切换正确', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await gotoApp(page, '/ontology/explore/objects');
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology');
    await page.goForward();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/explore/objects');
  });

  test('点击左侧导航「对象类型」按路由跳转', async ({ page }) => {
    await gotoApp(page, '/ontology');
    await page.getByRole('link', { name: '对象类型' }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
      .toBe('/ontology/model/object-types');
  });
});
