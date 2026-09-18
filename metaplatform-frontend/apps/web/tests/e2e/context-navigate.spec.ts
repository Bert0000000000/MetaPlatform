/**
 * ADR-0065 S3（`MP-CONTEXT-AWARE-01`）的**浏览器判据**：agent 的 `navigate` 回向事件
 * 在聊天里渲染成可点击导航卡片，点击才跳转；**不合规路径降级为纯文本、不可点击**。
 *
 * <p>这是评审条件 **R4** 的 negative 判据：`navigate.target.path` 由模型产出，前端
 * 必须在渲染成可点击**之前**过白名单。断言点在**渲染结果**上（有没有可点击元素），
 * 不是只断言校验函数——那才是条件成立的证据。
 *
 * <p>**不依赖模型输出**：SSE 由 `page.route` 直接伪造。判据要验的是"UI 拿到这个事件
 * 会怎么渲染"，模型说什么不由本用例负责，也就不该由它决定本用例红不红。
 *
 * <p>**超时为什么给得宽**：本机是 8GB WSL2 Docker Desktop，同机常驻 kind 集群 +
 * 30 多个容器，实测一次 IAM 登录要 15s、尖峰超过 30s。共用 `helpers/auth` 把登录
 * 超时写死 30s，在这种负载下会**假红**；**不改共用 helper**（别的 spec 在正常负载下
 * 靠它工作），这里照 `session-run-link.spec.ts` 的先例自带一个放宽超时的登录。
 */
import { expect, test, type Page } from '@playwright/test';
import { injectAuthIntoPage } from './helpers/auth';

const SLOW = 90_000;
const IAM_LOGIN_URL =
  process.env.E2E_IAM_LOGIN_URL ?? 'http://127.0.0.1:8100/api/v1/iam/auth/login';
const AGENT_STREAM = '**/api/v1/copilot/chat/agent/stream';

test.setTimeout(300_000);

/** 本用例专用登录：与 helpers/auth 同链路，只把超时放宽（见文件头注释）。 */
async function loginWithWideTimeout(page: Page): Promise<string> {
  const resp = await page.request.post(IAM_LOGIN_URL, {
    data: {
      username: process.env.E2E_USERNAME ?? 'admin',
      password: process.env.E2E_PASSWORD ?? 'admin123',
    },
    headers: { 'Content-Type': 'application/json' },
    timeout: SLOW,
  });
  const body = await resp.text();
  if (!resp.ok()) throw new Error(`IAM login HTTP ${resp.status()}: ${body.slice(0, 200)}`);
  const parsed = JSON.parse(body) as { accessToken?: string };
  if (!parsed.accessToken) throw new Error(`IAM login no accessToken: ${body.slice(0, 200)}`);
  return parsed.accessToken;
}

/** 伪造一条只有 navigate 事件的 SSE 流。 */
async function stubNavigate(page: Page, path: string, label: string): Promise<void> {
  await page.route(AGENT_STREAM, async (route) => {
    const sse =
      `data: ${JSON.stringify({ type: 'navigate', target: { path, label } })}\n\n` +
      'data: [DONE]\n\n';
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
}

/** 打开一个会话、切到 Agent 调度模式、发一句话——所有用例共用的起手式。 */
async function askInAgentMode(page: Page, text: string): Promise<void> {
  const newConversation = page.getByRole('button').filter({ hasText: '新建会话' }).first();
  await expect(newConversation).toBeVisible({ timeout: SLOW });
  await newConversation.click();

  const agentToggle = page.getByRole('button').filter({ hasText: 'Agent 调度' }).first();
  await expect(agentToggle).toBeVisible({ timeout: SLOW });
  await agentToggle.click();
  await expect(page.getByRole('button').filter({ hasText: 'Agent 调度中' }).first())
    .toBeVisible({ timeout: SLOW });

  const composer = page.locator('[contenteditable="true"]').first();
  await expect(composer).toBeVisible({ timeout: SLOW });
  await composer.click();
  await composer.pressSequentially(text, { delay: 20 });
  // **必须点「发送」按钮，不能按 Enter**：本页 `AIChatInput` 的 Enter 热键在这条
  // 路径上没有触发出请求（实测 POST /copilot/chat/agent/stream 一次都没发出去，
  // 页面停在输入态），而显式点发送按钮会。别处 spec 用 Enter 能过，是因为那条
  // 路径上编辑器的内部状态已经就绪。判据要验的是 navigate 卡片怎么渲染，不是
  // "回车键灵不灵"——所以这里用确定能过的那个入口。
  await page.getByRole('button', { name: '发送' }).first().click();
}

test.describe('ADR-0065 S3 navigate 卡片（R4 白名单）', () => {
  test('合规路径：渲染可点击卡片，点击后跳转到目标路由', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await loginWithWideTimeout(page));
    await stubNavigate(page, '/ontology/objects', '看客户详情');

    await page.goto('/superai/chat', { waitUntil: 'domcontentloaded' });
    await askInAgentMode(page, '帮我把这一轮的结论整理一下');

    const card = page.getByTestId('navigate-card');
    await expect(card).toBeVisible({ timeout: SLOW });
    await expect(card).toContainText('看客户详情');
    await expect(page.getByTestId('navigate-card-blocked')).toBeHidden();

    const go = page.getByTestId('navigate-card-go');
    await expect(go).toHaveAttribute('data-navigate-path', '/ontology/objects');
    await go.click();

    // 点击才跳转（卡片不是自动跟随）——URL 真的走到目标路由。
    await expect.poll(() => page.url(), { timeout: SLOW }).toContain('/ontology/objects');
  });

  test('敌意路径（javascript:）：不渲染任何可点击元素，降级为纯文本', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await loginWithWideTimeout(page));
    await stubNavigate(page, 'javascript:alert(1)', '危险跳转');

    await page.goto('/superai/chat', { waitUntil: 'domcontentloaded' });
    await askInAgentMode(page, '帮我把这一轮的结论整理一下');

    const blocked = page.getByTestId('navigate-card-blocked');
    await expect(blocked).toBeVisible({ timeout: SLOW });
    // 核心断言：**没有**可点击的导航按钮，也没被渲染成合规卡片
    await expect(page.getByTestId('navigate-card-go')).toHaveCount(0);
    await expect(page.getByTestId('navigate-card')).toHaveCount(0);
    // 降级文案要如实说明"目标不在应用内已知路由范围内"
    await expect(blocked).toContainText('不可点击');
    // 仍然停在原路由（没有任何跳转发生）
    expect(page.url()).toContain('/superai/chat');
  });

  test('敌意路径（协议相对 //evil.com）：同样不可点击', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await loginWithWideTimeout(page));
    await stubNavigate(page, '//evil.example.com/ontology', '外站跳转');

    await page.goto('/superai/chat', { waitUntil: 'domcontentloaded' });
    await askInAgentMode(page, '帮我把这一轮的结论整理一下');

    await expect(page.getByTestId('navigate-card-blocked')).toBeVisible({ timeout: SLOW });
    await expect(page.getByTestId('navigate-card-go')).toHaveCount(0);
    await expect(page.getByTestId('navigate-card')).toHaveCount(0);
    expect(page.url()).toContain('/superai/chat');
  });
});

/**
 * S2 的**端到端**判据：全局 Copilot 在请求体里**真的带上**分层上下文。
 *
 * <p>此前 `CopilotDock` 只把路由渲染成给人看的 `contextLabel`（"已感知当前页面"），
 * 请求体里一个字段都没有——面板说感知到了，agent 其实看不到。这条用例断言的就是
 * 那句承诺变成了字段：拦截 agent stream，读它实际发出的 `context`。
 *
 * <p>导航态由路由决定（`/ontology/objects` → `ontology-objects`），**不依赖任何
 * 后端数据**；选中态依赖列表里真有对象，不在本用例里断言（见交付说明的边界登记）。
 */
test.describe('ADR-0065 S2 宿主写入', () => {
  test('Copilot 把本体域的 navigation 写进 agent stream 的 context', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await loginWithWideTimeout(page));

    let requestBody: Record<string, any> | null = null;
    await page.route(AGENT_STREAM, async (route) => {
      requestBody = JSON.parse(route.request().postData() ?? '{}') as Record<string, any>;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: [DONE]\n\n',
      });
    });

    await page.goto('/ontology/objects', { waitUntil: 'domcontentloaded' });

    const railToggle = page.getByRole('button', { name: 'SuperAI Copilot' });
    await expect(railToggle).toBeVisible({ timeout: SLOW });
    await railToggle.click();

    const input = page.getByLabel('向 SuperAI 提问');
    await expect(input).toBeVisible({ timeout: SLOW });
    await input.fill('我现在在哪个页面');
    await page.getByRole('button', { name: '发送' }).click();

    await expect.poll(() => requestBody, { timeout: SLOW }).not.toBeNull();

    const sent = requestBody as unknown as { context?: Record<string, any> };
    expect(sent.context, '请求体必须带 context').toBeTruthy();
    // 分层导航态：语义视图名 + 原始 URL（可分享过滤器的唯一事实源）
    expect(sent.context?.navigation?.view).toBe('ontology-objects');
    expect(sent.context?.navigation?.tab).toBe('objects');
    expect(sent.context?.navigation?.url).toContain('/ontology/objects');
    // 兼容三键仍在（R3：旧键与新分层并存渲染）
    expect(sent.context?.interaction?.pageCode).toBe('ontology-objects');
    expect(sent.context?.interaction?.appCode).toBe('app-superai');
  });
});
