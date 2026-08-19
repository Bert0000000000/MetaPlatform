// 准生产环境（vite preview prod build）拖拽验证
// production 没有 dev 的 React 18 event chain 坑，drag-drop 链路应当可手动验证。
// 跑法：E2E_BASE_URL=http://localhost:9260 pnpm exec playwright test drag-prod.spec.ts

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

test('PROD drag node from library to canvas actually adds a node', async ({ page }) => {
  await login(page);
  // 监听 console 错误和 page error
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser-error]', msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => console.log('[page-error]', err.message.slice(0, 500), 'STACK:', err.stack?.slice(0, 500)));
  await page.goto('/ontology?tab=action');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 调试：等标题可见
  const state = await page.evaluate(() => ({
    url: window.location.href,
    bodyLen: document.body.outerHTML.length,
    headingCount: document.querySelectorAll('h3').length,
    headingTexts: Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.slice(0, 30)),
    btnTexts: Array.from(document.querySelectorAll('button')).slice(0, 15).map(b => b.textContent?.slice(0, 30)),
    actionItemCount: document.querySelectorAll('[title^="ont.tenant-default.act."]').length,
  }));
  console.log('[prod-debug] state:', JSON.stringify(state));

  // 1) 等 Actions 列表加载
  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[title^="ont.tenant-default.act."]').first()).toBeVisible({ timeout: 15_000 });

  // 2) 选第一个 Action（必须，否则 getActionFlow 不会触发）
  await page.locator('[title^="ont.tenant-default.act."]').first().click();
  await page.waitForTimeout(800);

  // 3) 切到「流程编排」子 tab —— production Playwright click 应走真实事件链
  await page.locator('button:has-text("流程编排")').first().click();
  await page.waitForTimeout(800);
  const flowState = await page.evaluate(() => ({
    activeTabText: document.querySelector('[style*="border-bottom"]')?.textContent?.slice(0, 30),
    btnTexts: Array.from(document.querySelectorAll('button')).slice(0, 25).map(b => b.textContent?.slice(0, 30)),
    hasFlowPreview: !!document.body.textContent?.includes('当前 Action 包含'),
  }));
  console.log('[prod-debug] after-flow-tab-click:', JSON.stringify(flowState));
  await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });

  // 4) 进入全屏编辑 —— production 下 SVG zIndex 仍可能拦截，但 Playwright 默认 click 走真实鼠标
  await page.locator('button:has-text("进入全屏编辑")').first().click();
  await page.waitForTimeout(1500);
  const afterFullscreen = await page.evaluate(() => ({
    btnTexts: Array.from(document.querySelectorAll('button')).slice(0, 30).map(b => b.textContent?.slice(0, 30)),
    hasLibTitle: !!document.body.textContent?.includes('节点库'),
    hasDropzone: !!document.querySelector('[data-flowgram-dropzone]'),
  }));
  console.log('[prod-debug] after-fullscreen-click:', JSON.stringify(afterFullscreen));
  await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // 5) 默认 free layout，dropzone 应已挂载
  await expect(page.locator('[data-flowgram-dropzone]').first()).toBeVisible({ timeout: 10_000 });

  // 截图：进入全屏 + 自由布局
  await page.screenshot({ path: 'tests/e2e/.artifacts/prod-01-fullscreen.png', fullPage: true });

  // 6) 计数 demo flow 节点
  const beforeCount = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    return ids.size;
  });

  // 7) Playwright 真实 dragTo：从节点库「循环节点」拖到 dropzone 中央
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

  // 截图：拖拽后
  await page.screenshot({ path: 'tests/e2e/.artifacts/prod-02-after-drag.png', fullPage: true });

  expect(afterCount, `拖拽后画布节点数（before=${beforeCount} + 1）`).toBe(beforeCount + 1);

  // 点新拖入的节点，验证属性面板可正常打开并显示 FlowGram document 里的 data
  // （v1.5 R1.6 修复：之前 nodeConfig 独立 state 对新拖入节点空白）
  const newNode = page.locator('.gedit-flow-activity-node[data-node-id]').last();
  await newNode.click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/.artifacts/prod-03-property-panel.png', fullPage: true });

  // 验证属性面板标题输入框有值（不再是空白）
  const titleInput = page.locator('input[placeholder="节点标题"]');
  await expect(titleInput).toBeVisible({ timeout: 5_000 });
  const titleValue = await titleInput.inputValue();
  expect(titleValue.length, '新拖入节点的 title 应有默认值').toBeGreaterThan(0);
});