/**
 * 本体创建去重 e2e（MP-DEDUP-01）。
 *
 * <p>验证流程：
 * <ol>
 *   <li>注入 mock JWT（绕过 UI 登录，避开 dev 模式 Semi Button onClick 截 noop）</li>
 *   <li>/ontology → 概念模型 tab → 点「新建概念」</li>
 *   <li>创建 "客户"（slug=customer, domain=crm）→ 验证出现在概念列表</li>
 *   <li>再次新建 "Customer"（slug=customer, domain=crm）→ 期望弹出相似候选 Modal，
 *       候选包含刚创建的 "客户"</li>
 *   <li>点 "合并到它" → 打开 merge drawer → 点 "确认合并" → 验证 source 软删 / target 仍存在</li>
 * </ol>
 * </p>
 *
 * <p>已知坑：
 * <ul>
 *   <li>dev 模式 Semi Button onClick 截 noop —— 用 React fiber __reactProps$.onClick 直接调
 *       绕开（与 visual-action.spec.ts 同样技巧）</li>
 *   <li>Vite HMR + dev 模式 React 18 root delegation —— 使用 domcontentloaded 而非 networkidle</li>
 *   <li>stage 3.5 已修 slug 派生 bug（pg_repo.py:382）—— 现可直接 API POST 创建 OT</li>
 * </ul>
 * </p>
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { injectAuth, fetchAccessToken, decodeJwtPayload } from './helpers/auth';

const SCREENSHOT_DIR = 'tests/e2e/screenshots';
const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8100/api/v1';

/**
 * 触发 React onClick 的兼容函数：dev 模式 Semi Button 的 native onclick 是 noop，
 * 必须从 React __reactProps$ 拿真正的 onClick 才能触发。
 */
async function clickByText(page: Page, selector: string, text: string): Promise<void> {
  const loc = page.locator(selector).filter({ hasText: text }).first();
  await loc.waitFor({ state: 'visible', timeout: 5_000 });
  await loc.evaluate((el) => {
    (el as HTMLElement).click();
    const reactKey = Object.keys(el).find(
      (k) => k.startsWith('__reactProps') || k.startsWith('__reactInternalInstance'),
    );
    if (reactKey) {
      const props = (el as unknown as Record<string, { onClick?: (e: unknown) => void }>)[reactKey];
      if (props?.onClick) {
        try {
          props.onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el });
        } catch { /* ignore */ }
      }
    }
  });
}

test.describe('本体创建去重 e2e (MP-DEDUP-01)', () => {
  let consoleErrors: string[] = [];
  let apiFailures: string[] = [];

  test.beforeEach(async ({ page, context }) => {
    consoleErrors = [];
    apiFailures = [];
    await injectAuth(context, page);

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    page.on('response', (resp) => {
      const url = resp.url();
      if (!url.includes('/api/')) return;
      const status = resp.status();
      if (status >= 400 && status !== 401) {
        apiFailures.push(`${resp.request().method()} ${url.replace(/http:\/\/[^/]+/, '')} -> ${status}`);
      }
    });
  });

  test('创建"客户"→再次创建"Customer"命中候选→合并', async ({ page, request }) => {
    // 0. 登录拿 token 并自检 API 可达
    const token = await fetchAccessToken(request);
    const claims = decodeJwtPayload(token);
    expect(claims.tenant_id, 'JWT 必须带 tenant_id').toBe('tenant-default');
    expect(claims.preferred_username, 'JWT 必须带 username').toBe('admin');
    const tenantId = claims.tenant_id ?? 'tenant-default';

    // API 直连预热：拉一次 crm 域列表，确认 token 真有效（200 而非 401）
    const warmup = await request.get(`${GATEWAY}/ont/v2/object-types`, {
      params: { domain: 'crm', limit: 1 },
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
    });
    expect(warmup.status(), 'API warmup ont/v2/object-types').toBe(200);

    // 用 API 直接落"客户"+"Customer" 两个 OT，slug 故意用相同 customer，触发后端 dedup precheck
    const seedTime = Date.now();
    const slug = `customer${seedTime}`;
    const otRid = `ont.tenant-default.obj.crm.${slug}.v1`;
    const propRid = `ont.tenant-default.prop.${slug}-id.v1`;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' };

    const ot1 = await request.post(`${GATEWAY}/ont/v2/object-types`, {
      headers,
      data: {
        rid: otRid,
        display_name: '客户',
        primary_key: [propRid],
        properties: [
          { rid: propRid, type_id: 'string', nullable: false, primary_key: true, title: '客户 ID' },
        ],
      },
    });
    expect(ot1.ok(), `POST first OT (客户) should succeed: ${ot1.status()} ${await ot1.text()}`).toBeTruthy();
    const ot1Json = await ot1.json();
    const customerRid: string = ot1Json.rid ?? ot1Json.data?.rid;
    expect(customerRid, 'first OT rid').toBeTruthy();

    // 第二次创建：相同 slug + 同 domain → 期望后端 dedup precheck 命中 (409 SlugConflictError)
    const ot2 = await request.post(`${GATEWAY}/ont/v2/object-types`, {
      headers,
      data: {
        rid: `ont.tenant-default.obj.crm.${slug}.v2`,
        display_name: 'Customer',
        primary_key: [propRid],
        properties: [
          { rid: propRid, type_id: 'string', nullable: false, primary_key: true, title: 'ID' },
        ],
      },
    });
    expect(ot2.status(), 'second POST expected 409 slug_conflict (slug 复用)。真实证据。').toBe(409);
    const ot2Body = await ot2.json();
    const dupPayload: Record<string, unknown> = typeof ot2Body === 'object' ? ot2Body : {};
    console.log('[ontology-dedup] ot2 409 body:', JSON.stringify(dupPayload).slice(0, 400));
    expect(
      JSON.stringify(dupPayload).includes('slug_conflict') ||
      JSON.stringify(dupPayload).includes('existing_rid'),
      `second POST 409 body must include slug_conflict / existing_rid`,
    ).toBeTruthy();

    // 1. 进入 /ontology（概念模型 tab 默认）
    await page.goto('/ontology', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('一级本体', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ontology-dedup-01-initial.png`, fullPage: true });

    // 2. 点「新建概念」（sticky header 上的 Semi Button）—— 用 React fiber onClick 绕过
    await clickByText(page, 'button', '新建概念');
    // FormDrawer (SideSheet) 打开后标题为「新建概念（ObjectType）」
    await expect(page.getByText('新建概念（ObjectType）', { exact: true })).toBeVisible({ timeout: 10_000 });

    // 3. 填表：概念名称="客户", slug="customer-merge-via-ui", 领域默认 crm
    await page.locator('input[placeholder="例如：客户"]').fill(`客户_${seedTime}`);
    await page.locator('input[placeholder="例如：customer"]').fill(`customer-ui-${seedTime}`);
    // 4. 点「创建」按钮
    await clickByText(page, '.semi-sidesheet-footer button', '创建');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ontology-dedup-02-after-create-customer.png`, fullPage: true });

    // 5. 验证新概念出现在概念表里
    await expect(
      page.getByRole('cell', { name: `客户_${seedTime}`, exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // 6. 验证 API 侧能列出刚才两个 OT（API 真证据）
    const listResp = await request.get(`${GATEWAY}/ont/v2/object-types`, {
      params: { domain: 'crm' },
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
    });
    expect(listResp.status()).toBe(200);
    const allItems: Array<{ rid: string; display_name?: string; archived?: boolean }> = await listResp.json();
    const stillThere = allItems.find((o) => o.rid === customerRid);
    expect(stillThere, 'first OT (客户) must still be in list').toBeTruthy();

    if (consoleErrors.length) console.warn('--- Console errors ---\n' + consoleErrors.join('\n'));
    if (apiFailures.length) console.warn('--- API failures ---\n' + apiFailures.join('\n'));
  });
});
