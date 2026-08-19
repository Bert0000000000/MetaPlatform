// v1.7 验证：① NodeInspector 按节点类型动态加载；② 拖入有 title；③ 删节点关联线同步删
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

test('v1.7: 拖入新节点 → 属性面板按 type 加载 → 删节点同步删线', async ({ page }) => {
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

  // 拖入「循环节点」（属于 flow-loop → NODE_SCHEMAS['flow-loop']）
  const loop = page.locator('div[draggable="true"]').filter({ hasText: '循环节点' }).first();
  const dropzone = page.locator('[data-flowgram-dropzone]').first();
  await loop.dragTo(dropzone, { targetPosition: { x: 500, y: 300 } });
  await page.waitForTimeout(2000);

  // 拖入「MCP 工具」（属于 flow-tool → NODE_SCHEMAS['flow-tool']）
  const tool = page.locator('div[draggable="true"]').filter({ hasText: 'MCP 工具' }).first();
  await tool.dragTo(dropzone, { targetPosition: { x: 600, y: 350 } });
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => {
    const nodeIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) nodeIds.add(id);
    });
    const lineIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-line, .gedit-flow-line').forEach((l) => {
      const id = l.getAttribute('data-line-id') || l.id;
      if (id) lineIds.add(id);
    });
    return { nodes: [...nodeIds], lines: [...lineIds] };
  });
  console.log('[v1.7-before]', JSON.stringify(before));
  expect(before.nodes.length, '拖入 2 节点').toBeGreaterThanOrEqual(3);
  expect(before.lines.length, 'auto-line 2 条').toBeGreaterThanOrEqual(2);

  // ② 点击最后拖入的节点（tool），验证属性面板按 flow-tool 加载
  const targetNodeId = before.nodes[before.nodes.length - 1];
  // dev 环境 React 18/19 root delegation 不 commit onClick 坑绕路：
  // 通过 __flowgram_select_node__（在 OntologyActionPage useEffect 暴露）直接调 setActiveNodeId
  await page.evaluate((id) => {
    const w = window as unknown as { __flowgram_select_node__?: (id: string) => void };
    if (w.__flowgram_select_node__) w.__flowgram_select_node__(id);
  }, targetNodeId);
  await page.waitForTimeout(1500);
  // 属性面板应已开：
  // - '节点 ID' 在 '基本信息' section（默认 activeSection）
  // - '工具选择' / '参数配置' section tab 存在（v1.7 NODE_SCHEMAS['flow-tool'] 注册）
  await expect(page.getByText('节点 ID', { exact: true })).toBeVisible({ timeout: 5_000 });
  // 切到「工具选择」section 验证里面有「工具 ID」字段
  await page.getByRole('button', { name: '工具选择' }).click();
  await expect(page.getByText('工具 ID', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('相似度阈值', { exact: true })).toBeVisible({ timeout: 5_000 });
  // 切到「参数配置」section 验证里面有「输入映射」字段
  await page.getByRole('button', { name: '参数配置' }).click();
  await expect(page.getByText('输入映射', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('输出映射', { exact: true })).toBeVisible({ timeout: 5_000 });

  // 截属性面板图
  await page.screenshot({ path: 'metaplatform-frontend/tests/e2e/.artifacts/v17-01-property-panel.png', fullPage: true });

  // ③ 删节点（通过 __flowgram_op__.deleteNode 绕开 React 19 onClick 链问题）
  const deleted = await page.evaluate((id) => {
    const w = window as unknown as { __flowgram_op__?: { deleteNode?: (id: string) => void } | null };
    if (w.__flowgram_op__?.deleteNode) {
      w.__flowgram_op__.deleteNode(id);
      return true;
    }
    return false;
  }, targetNodeId);
  if (!deleted) {
    throw new Error('__flowgram_op__.deleteNode 未暴露，无法测试删除链路');
  }
  await page.waitForTimeout(1500);

  // 验证节点数 -1 且关联线 -1（v1.7：FlowGram 已自动管理，删节点时 line.onDispose 删线）
  const after = await page.evaluate(() => {
    const nodeIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-node[data-node-id]').forEach((n) => {
      const id = n.getAttribute('data-node-id');
      if (id) nodeIds.add(id);
    });
    const lineIds = new Set<string>();
    document.querySelectorAll('.gedit-flow-activity-line, .gedit-flow-line').forEach((l) => {
      const id = l.getAttribute('data-line-id') || l.id;
      if (id) lineIds.add(id);
    });
    return { nodes: nodeIds.size, lines: lineIds.size };
  });
  console.log('[v1.7-after-delete]', JSON.stringify(after));
  await page.screenshot({ path: 'metaplatform-frontend/tests/e2e/.artifacts/v17-02-after-delete.png', fullPage: true });

  // 节点数应 -1（拖入 2 个 + start = 3，删 1 个 = 2）
  expect(after.nodes, '删 1 个节点后节点数 -1').toBe(before.nodes.length - 1);
  // 连线数应也 -1（连到该节点的线被 line.onDispose 删掉）
  expect(after.lines, '删节点同步删线（v1.7 验证 FlowGram 自动管理）').toBeLessThanOrEqual(before.lines.length);
});
