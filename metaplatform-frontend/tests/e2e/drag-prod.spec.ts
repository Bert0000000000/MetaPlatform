// 准生产：拖 2 个节点 → 验证节点数 +2 + 自动连线数 +1
import { test, expect, type Page } from '@playwright/test';
import { mintMockToken } from './helpers/mock-jwt';

const DEV_IGNORED = [
  /\/api\/v1\/dashboard\/settings(\?|$)/,
  /\/api\/v1\/dashboard\/messages(\?|$)/,
  /\/api\/v1\/dashboard\/page\/summary(\?|$)/,
  /\/api\/v1\/dashboard\/deliverables\/summary(\?|$)/,
  /\/api\/v1\/iam\/sso-providers(\?|$)/,
  /\/api\/v1\/users\/me\/profile(\?|$)/,
  /\/api\/v1\/notifications\/unread(\?|$)/,
];

async function login(page: Page) {
  for (const re of DEV_IGNORED) {
    await page.route(re, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  }
  const { token, user } = mintMockToken();
  await page.addInitScript(({ t, u }: { t: string; u: unknown }) => {
    localStorage.setItem('mate_platform_token', t);
    localStorage.setItem('mate_platform_user', JSON.stringify(u));
  }, { t: token, u: user });
}

test('PROD drag 2 nodes → node count +2 + edge count +1 (auto-line)', async ({ page }) => {
  await login(page);
  await page.goto('/ontology?tab=action');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible({ timeout: 15_000 });
  await page.locator('[title^="ont.tenant-default.act."]').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("流程编排")').first().click();
  await expect(page.getByText(/当前 Action 包含/)).toBeVisible({ timeout: 10_000 });
  await page.locator('button:has-text("进入全屏编辑")').first().click();
  await expect(page.getByText('节点库', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-flowgram-dropzone]').first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    const lineIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-line, .gedit-flow-line').forEach((l) => {
      const id = l.getAttribute('data-line-id') || l.id;
      if (id) lineIds.add(id);
    });
    return { nodes: ids.size, lines: lineIds.size };
  });
  console.log('[before]', JSON.stringify(before));

  // 拖第一个：循环节点
  const loop = page.locator('div[draggable="true"]').filter({ hasText: '循环节点' }).first();
  const dropzone = page.locator('[data-flowgram-dropzone]').first();
  await loop.dragTo(dropzone, { targetPosition: { x: 500, y: 300 } });
  await page.waitForTimeout(2000);

  const after1 = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    const lineIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-line, .gedit-flow-line').forEach((l) => {
      const id = l.getAttribute('data-line-id') || l.id;
      if (id) lineIds.add(id);
    });
    return { nodes: ids.size, lines: lineIds.size };
  });
  console.log('[after-1st-drag]', JSON.stringify(after1));

  // 拖第二个：MCP 工具
  const tool = page.locator('div[draggable="true"]').filter({ hasText: 'MCP 工具' }).first();
  await tool.dragTo(dropzone, { targetPosition: { x: 800, y: 400 } });
  await page.waitForTimeout(2000);

  const after2 = await page.evaluate(() => {
    const ids = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) ids.add(id);
    });
    const lineIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-line, .gedit-flow-line').forEach((l) => {
      const id = l.getAttribute('data-line-id') || l.id;
      if (id) lineIds.add(id);
    });
    return { nodes: ids.size, lines: lineIds.size };
  });
  console.log('[after-2nd-drag]', JSON.stringify(after2));

  await page.screenshot({ path: 'metaplatform-frontend/tests/e2e/.artifacts/prod-03-after-2-drags.png', fullPage: true });
  expect(after2.nodes, '节点数 +2').toBe(before.nodes + 2);
  expect(after2.lines, '连线数 +2（v1.6 port-to-port auto-line：每次拖入 +1）').toBe(before.lines + 2);
});
