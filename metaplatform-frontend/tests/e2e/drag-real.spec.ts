// 单一目的：：验证拖拽真的能落节点上画布
// 绕过 dev 模式 React 18 setState 不 commit 的坑：
//   - flowFullscreen 默认 true（modal 一上来就开）
//   - layoutMode 默认 free（dropzone 默认挂载）
// 走 Playwright 真实 dragTo + 节点数对比。

import { test, expect, type Page } from '@playwright/test';
import { mintMockToken } from './helpers/mock-jwt';

const DEV_IGNORED_ENDPOINTS: Array<{ match: RegExp; body: unknown }> = [
  { match: /\/api\/v1\/dashboard\/settings(\?|$)/, body: {} },
  { match: /\/api\/v1\/dashboard\/messages(\?|$)/, body: { items: [] } },
  { match: /\/api\/v1\/dashboard\/page\/summary(\?|$)/, body: {} },
  { match: /\/api\/v1\/dashboard\/deliverables\/summary(\?|$)/, body: {} },
  { match: /\/api\/v1\/iam\/sso-providers(\?|$)/, body: { items: [] } },
  { match: /\/api\/v1\/users\/me\/profile(\?|$)/, body: {} },
  { match: /\/api\/v1\/notifications\/unread(\?|$)/, body: { count: 0 } },
];

async function login(page: Page): Promise<void> {
  for (const ep of DEV_IGNORED_ENDPOINTS) {
    await page.route(ep.match, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ep.body) }));
  }
  const { token, user } = mintMockToken();
  await page.addInitScript(({ t, u }: { t: string; u: unknown }) => {
    localStorage.setItem('mate_platform_token', t);
    localStorage.setItem('mate_platform_user', JSON.stringify(u));
  }, { t: token, u: user });
}

test('drag node from library to canvas actually adds a node', async ({ page }) => {
  await login(page);
  await page.goto('/ontology?tab=action');
  // 等页面真的渲染（vite 第一次访问可能慢）
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 选第一个 Action（demo flow 必须有 rid 才能 getActionFlow 渲染节点）
  await page.locator('[title^="ont.tenant-default.act."]').first().click({ force: true });
  await page.waitForTimeout(800);

  // 切到「流程编排」子 tab
  await page.locator('button:has-text("流程编排")').first().click({ force: true });
  await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });

  // 进入全屏编辑 — Playwright force-click 走真实 mouse event，
  // SVG zIndex 2000+ 拦截由 force 绕开（force 跳过 actionability check）
  await page.locator('button:has-text("进入全屏编辑")').first().click({ force: true });
  // 等 React 18 setState commit + FlowGram EditorRenderer 挂载
  await page.waitForTimeout(2000);
  await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // 默认 free layout，dropzone 应已挂载
  await expect(page.locator('[data-flowgram-dropzone]').first()).toBeVisible({ timeout: 10_000 });

  // 计数 demo flow 节点（unique by data-node-id）
  const beforeCount = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    return ids.size;
  });

  // Playwright 真实拖拽：从节点库「循环节点」拖到 dropzone 中央
  const loopItem = page.locator('div[draggable="true"]').filter({ hasText: '循环节点' }).first();
  const dropzone = page.locator('[data-flowgram-dropzone]').first();
  await loopItem.dragTo(dropzone, { targetPosition: { x: 600, y: 400 } });
  // 给 FlowGram onDrop 异步处理 + React 重渲时间
  await page.waitForTimeout(2500);

  const afterCount = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    return ids.size;
  });

  await page.screenshot({ path: 'tests/e2e/.artifacts/visual-05-after-drag.png', fullPage: true });
  expect(afterCount, `拖拽后画布节点数（before=${beforeCount} + 1）`).toBe(beforeCount + 1);
});