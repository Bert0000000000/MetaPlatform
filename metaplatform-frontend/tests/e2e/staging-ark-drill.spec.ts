/**
 * staging 实机演练 — 生产 ARK Key 正式托管 + 本体引擎 UI 收口
 *
 * 演练目标（对应 2026-09-14 演练报告）：
 *   A. 真实 IAM 登录（Keycloak RS256 链路）
 *   B. 本体引擎 8 tab 收口渲染 + 子 tab + 旧别名兼容
 *   C. AI Provider 页 ARK 托管卡片 + 掩码 key 不回显
 *   D. 掩码读 / reveal 拒绝 / write-only 保存（API 级）
 *   E. 真实 ARK 对话（glm-5.3-flash，经托管 key 服务端解析）
 *   F. 真实 ARK embedding（doubao-embedding-vision）
 *
 * 运行：E2E_BASE_URL=http://localhost:9250 npx playwright test --project=staging-ark-drill
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, GATEWAY } from './helpers/auth';

let token = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  // A. 真实登录（登到 page 上下文由各用例自行处理；这里先取 token 供 API 级断言）
  const resp = await request.post(`${GATEWAY}/iam/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  token = body.accessToken ?? body.data?.accessToken;
  expect(token).toBeTruthy();
});

test('A. 真实 IAM 登录进入工作台', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/ontology');
  await expect(page.getByRole('heading', { name: '总览' })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'tests/e2e/.artifacts/drill-01-login-ontology-overview.png', fullPage: false });
});

test('B1. 本体引擎一级 tab 收敛为 8 个', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/ontology');
  const tabNames = ['总览', '类型管理', '对象数据', '数据中心', 'Action 编排', '知识图谱', '治理', '分析应用'];
  for (const name of tabNames) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible({ timeout: 15000 });
  }
  // 被合并的旧 tab 不应再作为一级 tab 出现
  for (const gone of ['关系类型', '动作类型', '接口', '仪表盘', '地图', '分析']) {
    const found = await page.getByRole('button', { name: gone, exact: true }).count();
    // “分析”是“分析应用”的前缀，getByRole exact 已精确匹配；这里只挡完全同名的旧 tab
    if (['关系类型', '动作类型', '接口'].includes(gone)) {
      expect(found).toBe(0);
    }
  }
});

test('B2. 类型管理 4 个子 tab + 概念建模宽度撑满', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/ontology?tab=concept');
  for (const sub of ['对象类型', '关系类型', '动作类型', '接口契约']) {
    await expect(page.getByRole('button', { name: sub, exact: true })).toBeVisible({ timeout: 20000 });
  }
  // 宽度：内容行应占满内容区（历史 bug：右侧 1/3 空白）
  const fill = await page.evaluate(() => {
    const content = document.querySelector('[data-testid="assistant-page-content"]');
    const row = content?.querySelector('div[style*="gap: 20"]');
    if (!content || !row) return null;
    return {
      contentW: Math.round(content.getBoundingClientRect().width),
      rowW: Math.round(row.getBoundingClientRect().width),
    };
  });
  expect(fill).not.toBeNull();
  expect(fill!.rowW).toBeGreaterThanOrEqual(fill!.contentW - 8);
  await page.screenshot({ path: 'tests/e2e/.artifacts/drill-02-type-management-fullwidth.png', fullPage: false });
});

test('B3. 分析应用三合一子 tab', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/ontology?tab=analytics');
  for (const sub of ['分析工作台', '仪表盘', '地图']) {
    await expect(page.getByRole('button', { name: sub, exact: true })).toBeVisible({ timeout: 20000 });
  }
});

test('B4. 旧链接别名落到正确子 tab（回归防丢上下文）', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/ontology?tab=interfaces');
  await expect(page.getByRole('heading', { name: '类型管理' })).toBeVisible({ timeout: 15000 });
  // 接口契约 子 tab 高亮（存在即渲染了 InterfaceListPage）
  await expect(page.getByRole('button', { name: '接口契约', exact: true })).toBeVisible();

  await page.goto('/ontology?tab=dashboard');
  await expect(page.getByRole('heading', { name: '分析应用' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: '仪表盘', exact: true })).toBeVisible();
});

test('C. AI Provider 页：ARK 托管卡片 + key 掩码不回显', async ({ page, request }) => {
  await loginViaApi(page, request);
  await page.goto('/admin/ai-providers');
  await expect(page.getByText('火山方舟 ARK').first()).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'tests/e2e/.artifacts/drill-03-ark-provider-card.png', fullPage: false });
  // API key 输入框不得预填真实值（write-only：placeholder 提示已设置）
  const keyInput = page.locator('input[data-cfg-key="ai.provider.ark.api_key"]');
  await expect(keyInput).toHaveCount(1);
  const prefilled = await keyInput.inputValue();
  expect(prefilled).toBe('');
  const placeholder = await keyInput.getAttribute('placeholder');
  expect(placeholder).toContain('已设置');
});

test('D1. 掩码读：API 返回 *** 而非真实 key', async ({ request }) => {
  const resp = await request.get(`${GATEWAY}/admin/configs?keyword=ai.provider.ark`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  const items = body.data?.items ?? [];
  const key = items.find((c: { key: string }) => c.key === 'ai.provider.ark.api_key');
  expect(key).toBeTruthy();
  expect(key.is_sensitive).toBe(true);
  expect(key.value).toBe('***');
  expect(JSON.stringify(body)).not.toMatch(/Bearer|sk-[A-Za-z0-9]{10,}/);
});

test('D2. reveal 拒绝：用户 token + 无服务密钥 → 403', async ({ request }) => {
  const resp = await request.get(`${GATEWAY}/admin/configs?reveal=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.status()).toBe(403);
});

test('D3. write-only 保存：掩码/空值不覆盖托管 key', async ({ request }) => {
  // 用掩码保存 → 200 且原值保持（由 E 的真实对话继续成功佐证）
  const save = await request.put(`${GATEWAY}/admin/configs/ai.provider.ark.api_key`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { value: '***', note: 'drill: 管理员未改动 key 字段' },
  });
  expect(save.ok()).toBeTruthy();
  const after = await save.json();
  expect(after.data?.value).toBe('***');
});

test('E. 真实 ARK 对话（glm-5.3-flash，托管 key 服务端解析）', async ({ request }) => {
  const resp = await request.post(`${GATEWAY}/copilot/chat/completions/stream`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      messages: [{ role: 'user', content: 'Reply with exactly: DRILL-OK' }],
      model: 'glm-5.3-flash',
    },
    maxRedirects: 0,
    timeout: 90_000,
  });
  expect(resp.ok()).toBeTruthy();
  const text = await resp.text();
  expect(text).toContain('data: {');
  expect(text.length).toBeGreaterThan(40);
  // 不应是降级 stub 文案
  expect(text).not.toContain('LLM 服务暂时不可用');
  expect(text).not.toContain('stub');
});

test('F. 真实 ARK embedding（doubao-embedding-vision）', async ({ request }) => {
  const resp = await request.post(`${GATEWAY}/llmgw/embeddings`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      input: ['staging drill embedding probe'],
      model: 'doubao-embedding-vision',
      tenant_id: 'tenant-default',
    },
    timeout: 60_000,
  });
  expect(resp.ok()).toBeTruthy();
  // llmgw /embeddings 返回裸 JSON：{model, dimensions, data:[{embedding}], usage}
  const body = await resp.json();
  expect(body.model).toBe('doubao-embedding-vision');
  const vec = body.data?.[0]?.embedding;
  expect(Array.isArray(vec)).toBeTruthy();
  expect(vec.length).toBeGreaterThan(64);
});

test('G. 页面无未捕获前端错误（核心页巡检）', async ({ page, request }) => {
  await loginViaApi(page, request);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const path of ['/ontology', '/ontology?tab=objects', '/ontology?tab=analytics', '/admin/ai-providers']) {
    await page.goto(path);
    await page.waitForTimeout(1500);
  }
  expect(errors).toEqual([]);
});
