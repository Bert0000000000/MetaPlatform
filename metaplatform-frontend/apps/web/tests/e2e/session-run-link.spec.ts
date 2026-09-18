/**
 * C-1 / `MP-SESSION-RUN-LINK-01` 的**浏览器**判据：会话 ↔ run 的关系源在后端。
 *
 * <p>准出 ①：**换机器 / 清浏览器 → 会话仍看得到历史轮次的 run**。
 *
 * <p>这条用例刻意**删掉**本地那份缓存再刷新——`mp-agent-team-run:*` 是 C-1 之前的
 * 唯一关系存放地，把它清掉就等价于"换了一台机器"。刷新后调度面板还能回来，只可能
 * 是因为那个关系从**后端**读回来了。同时断言真的打了一次
 * `GET /api/v1/agent-team/runs?conversation=…`，免得"面板恰好还在内存里"被当成关系源。
 *
 * <p>依赖：真 IAM 登录（helpers/auth）、活的网关（:8100）、活的 agent-team 服务、
 * 以及一个跑着的 dev server（默认 9250，见 playwright.config.ts 的 E2E_BASE_URL）。
 *
 * <p>**超时为什么给得比别的 spec 宽**：本机是 8GB 的 WSL2 Docker Desktop，同一台
 * 机器上还常驻着一个 kind 集群 + 30 多个容器。实测一次 IAM 登录要 15s（空载时
 * 亚秒级），所以这里的等待按"慢机器"配，不是按"功能慢"。**这是环境事实，不是
 * 被测行为的一部分**——别把调大超时读成"这条判据很勉强"。
 */
import { expect, test, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuthIntoPage } from './helpers/auth';

const RUN_CACHE_PREFIX = 'mp-agent-team-run:';
/** 慢机器下的统一等待上限（见文件头注释）。 */
const SLOW = 90_000;
// 2.1-C 曾因共用登录 helper 写死 30s 各抄了一份放宽副本；closeout 批给 helper
// 加了 E2E_LOGIN_TIMEOUT_MS 后副本退役——这三条 spec 默认抬到 120s（外部仍可覆盖）。
process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';


// 单条用例的整体上限：本机空载时这条链路 ~30s，重载（kind + 30 容器）下实测
// 光一次 IAM 登录就要 15s，所以给到 5 分钟；同时把上面各 assert 的上限统一到 SLOW。
test.setTimeout(300_000);

test.describe('C-1 会话 ↔ run：后端是唯一关系源', () => {
  test('清掉浏览器本地关系后刷新，调度视图仍从后端恢复', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await fetchAccessToken(page.request));
    await page.goto('/superai/chat', { waitUntil: 'domcontentloaded' });

    // 先建一个真的后端会话——只有 `conv-*` 是落库的会话，本地草稿不在本用例范围内。
    //
    // 锚点用「新建会话」按钮而**不是**「会话历史」标题：后者只在**已经有会话**时才
    // 渲染，而这个 workspace 的会话列表可能是空的（实测就是空的）。用标题当锚点会
    // 在"干净环境"下假红——而"干净环境"恰恰是本用例要模拟的那种。
    const createdResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/copilot/conversations') &&
        response.request().method() === 'POST',
    );
    const newConversation = page.getByRole('button').filter({ hasText: '新建会话' }).first();
    await expect(newConversation).toBeVisible({ timeout: SLOW });
    await newConversation.click();
    const created = (await (await createdResponse).json()) as { data: { id: string } };
    const conversationId = created.data.id;
    expect(conversationId).toMatch(/^conv-/);

    // 打开「Agent 产品层」模式，发一句话 → 后端受理并落关系。
    await page.getByTestId('chat-team-mode').click();
    const composer = page.locator('[contenteditable="true"]').first();
    await expect(composer).toBeVisible();
    await composer.fill('C-1 浏览器判据：这一轮属于本次会话');
    await composer.press('Enter');

    await expect(page.getByText(/已受理这一轮（run_id：/)).toBeVisible({ timeout: SLOW });

    const panel = page.getByTestId('chat-schedule-panel');
    await expect(panel).toBeVisible({ timeout: SLOW });
    await expect(page.getByTestId('chat-schedule-status')).toBeVisible({ timeout: SLOW });

    // 本地缓存此刻应当有值——它还存在，只是**降级成了缓存**。
    const cachedRunId = await page.evaluate(
      (prefix) => localStorage.getItem(prefix),
      RUN_CACHE_PREFIX + conversationId,
    );
    expect(cachedRunId, '受理后本地缓存应记下这一轮的 run_id').toBeTruthy();

    // ── 换机器：把关系从浏览器里抹掉，只留下登录态 ──────────────────────────
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('mp-agent-team-run:')) localStorage.removeItem(key);
      }
    });
    expect(
      await page.evaluate(
        (prefix) => localStorage.getItem(prefix),
        RUN_CACHE_PREFIX + conversationId,
      ),
      '抹掉之后本地就不该再有这条关系',
    ).toBeNull();

    // 刷新时必须**向后端**问这一次会话的 run（不是"面板恰好还在内存里"）。
    const backendLookup = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/agent-team/runs?') &&
        response.url().includes(`conversation=${encodeURIComponent(conversationId)}`) &&
        response.request().method() === 'GET',
      { timeout: SLOW },
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    const lookup = await backendLookup;
    expect(lookup.status(), '关系读路径必须是 200').toBe(200);
    const body = (await lookup.json()) as { items?: Array<{ run_id: string }> };
    expect(
      (body.items ?? []).map((item) => item.run_id),
      '后端答的必须包含刚才那一轮',
    ).toContain(cachedRunId!);

    // 判据本身：缓存没了，调度面板仍然回来 —— 关系只可能来自后端。
    await expect(page.getByTestId('chat-schedule-panel')).toBeVisible({ timeout: SLOW });
    await expect(page.getByTestId('chat-schedule-status')).toBeVisible({ timeout: SLOW });
    await expect(page.getByTestId('chat-schedule-empty')).toBeHidden();
  });
});
