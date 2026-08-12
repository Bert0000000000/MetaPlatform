/** GOVERN-12-04 模型编辑器路由可达性 e2e：合并后单页 + 两个子页。
 *
 * 背景（2026-08-12 合并）：ObjectType「概念模型」编辑器已并入 /ontology
 * 单页 master-detail（旧「本体论管理」卡片页 + 新 object-types 列表/详情合一），
 * /ontology/object-types 两个路由已删除。关系/动作仍为独立子路由。
 *
 * 验证：
 * 1. /ontology 单页返回 200 且含「概念模型」标题
 * 2. relationship-types / actions 两个子路由 200 + 标题
 * 3. /ontology 不依赖后端即可渲染查询壳（搜索框可见）
 */

import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/ontology', title: '概念模型' },
  { path: '/ontology/relationship-types', title: '关系模型' },
  { path: '/ontology/actions', title: 'Action 模型' },
];

for (const route of ROUTES) {
  test(`routing: ${route.path} returns 200 and shows page title`, async ({ page }) => {
    test.setTimeout(30_000);
    const resp = await page.goto(route.path);
    expect(resp, `goto ${route.path}`).not.toBeNull();
    const status = resp!.status();
    // 前端路由 SPA：vite dev server 对 SPA 路径一律返 200；prod 同样由 history fallback
    expect(status, `${route.path} status`).toBe(200);
    // 等关键标题渲染（不依赖后端接口返回）
    await expect(page.locator(`h1:has-text("${route.title}")`).first()).toBeVisible({ timeout: 10_000 });
  });
}

test('routing: merged /ontology renders concept search shell without backend', async ({ page }) => {
  test.setTimeout(30_000);
  const resp = await page.goto('/ontology');
  expect(resp, 'goto /ontology').not.toBeNull();
  expect(resp!.status(), '/ontology status').toBe(200);
  // 合并页壳层：概念搜索输入框（页面加载即渲染，不依赖后端数据）
  await expect(page.locator('input[placeholder*="搜索概念名称"]').first()).toBeVisible({ timeout: 10_000 });
});
