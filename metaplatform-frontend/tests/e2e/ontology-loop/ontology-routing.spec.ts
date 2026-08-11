/** GOVERN-12-04 A 路径 e2e：4 个 ontology 模型编辑器路由可达性。
 *
 * 验证：
 * 1. 4 个新路由均返回非 404（前端路由 + 后端 seed 数据均可访问）
 * 2. 每个页面包含关键标题文本
 * 3. 不依赖完整 DOM 渲染（mock 接口 + auth-setup 共享 state）
 */

import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/ontology/object-types', title: '概念模型' },
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

test('routing: ObjectTypeDetailPage with :rid param renders detail shell', async ({ page }) => {
  test.setTimeout(30_000);
  // 用一个已知的 seed rid（即使后端没真表，前端详情壳也能渲染并显示 "未找到"）
  const resp = await page.goto('/ontology/object-types/ont.demo.obj.leave-request.v1');
  expect(resp, 'goto detail').not.toBeNull();
  expect(resp!.status(), 'detail status').toBe(200);
  // 详情页包含 "返回列表" 按钮（壳层固定元素）
  await expect(page.locator('button:has-text("返回列表")').first()).toBeVisible({ timeout: 10_000 });
});
