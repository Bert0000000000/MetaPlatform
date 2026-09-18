/**
 * C-5 / `MP-AGENT-PROFILE-MGMT-01` 的**浏览器**判据：执行面配置从管理界面落库。
 *
 * <p>准出 ⑤：「员工 Runtime 配置**从管理界面**落库、重启后保持，且不静默切换」。
 * 后半句（落库、重启保持、拒绝陌生值）已经在 API 层验过（见验收文件 §C-5）。这条
 * 用例补的是**前半句**——它必须能从**界面上**做到，而不是只有 curl 做得到。
 *
 * <p>做法刻意绕开"LLM 会不会听话"这类不可控因素：只点 **UI 控件**、只看 **UI 与
 * 后端** 的结果。
 *
 * <p>超时同 `session-run-link.spec.ts`：本机是 8GB WSL2 + kind 集群 + 30 个容器，
 * 一次 IAM 登录实测可达 15s，共用 helper 写死的 30s 在这里会假红（不改共用 helper）。
 */
import { expect, test, type Page } from '@playwright/test';
import { fetchAccessToken, injectAuthIntoPage } from './helpers/auth';

const SLOW = 90_000;
// 2.1-C 曾因共用登录 helper 写死 30s 各抄了一份放宽副本；closeout 批给 helper
// 加了 E2E_LOGIN_TIMEOUT_MS 后副本退役——这三条 spec 默认抬到 120s（外部仍可覆盖）。
process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';
/** 这条改的是**真库**里的真员工，所以取一个专门的探针 id。 */
const PROBE_ID = process.env.E2E_RUNTIME_PROBE_PROFILE ?? 'EMP-SMOKE-1';

test.setTimeout(300_000);

test.describe('C-5 员工执行面：从管理界面落库', () => {
  test('在界面上勾选执行面 → 保存 → 刷新后仍是勾上的那一档', async ({ context, page }) => {
    await context.clearCookies();
    await injectAuthIntoPage(page, await fetchAccessToken(page.request));

    await page.goto('/superai/team', { waitUntil: 'domcontentloaded' });

    const row = page.getByTestId(`employee-runtime-row-${PROBE_ID}`);
    const loadError = page.getByTestId('employee-runtime-error');
    // 先分辨"读不到名册"与"名册里没有这个员工"——两者的修法完全不同，
    // 全报成"元素找不到"就等于没有诊断信息。
    await expect
      .poll(
        async () => {
          if (await loadError.isVisible().catch(() => false)) return 'error';
          if (await row.isVisible().catch(() => false)) return 'row';
          return 'pending';
        },
        { timeout: SLOW, message: '执行面面板既没出行、也没出错误提示（面板本身没渲染？）' },
      )
      .not.toBe('pending');
    if (await loadError.isVisible().catch(() => false)) {
      throw new Error(`界面读不到员工名册：${await loadError.innerText()}`);
    }
    await expect(row, '工作台上应有这个员工的执行面配置行').toBeVisible({ timeout: SLOW });

    const cli = page.getByTestId(`employee-runtime-${PROBE_ID}-claude_code`);
    const before = await cli.getAttribute('aria-pressed');
    // 断言写成"与初始状态相反"而不是"变成开"：探针员工在别的用例/手工验证之后
    // 可能已经是开的，写死方向会让这条用例依赖执行顺序。
    const expectOn = before !== 'true';

    // 点一下切换，再点保存 → 断言真的打了 PUT（不是只改了本地 state）
    const putCall = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/agent-team/profiles/${PROBE_ID}`) &&
        response.request().method() === 'PUT',
      { timeout: SLOW },
    );
    await cli.click();
    await expect(page.getByTestId(`employee-runtime-save-${PROBE_ID}`)).toBeEnabled({ timeout: SLOW });
    await page.getByTestId(`employee-runtime-save-${PROBE_ID}`).click();

    const put = await putCall;
    expect(put.status(), '保存必须是后端接受的（422 说明界面发了非法值）').toBe(200);
    const saved = (await put.json()) as { runtimes?: string[] };

    // 界面上的勾选状态必须与后端回执**一致**——"看起来保存了但没生效"是本条最该防的
    const after = await cli.getAttribute('aria-pressed');
    expect(after).not.toBe(before);
    expect(after).toBe(String(expectOn));
    expect(saved.runtimes ?? []).toContain('superai'); // 另一档必须还在（不是整体覆盖掉）
    expect((saved.runtimes ?? []).includes('claude_code')).toBe(expectOn);
    expect(saved.runtimes).toEqual(
      expectOn ? ['superai', 'claude_code'] : ['superai'],
    );

    // 刷新页面（重新从后端读）——状态仍在，说明落的是库不是内存
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloaded = page.getByTestId(`employee-runtime-${PROBE_ID}-claude_code`);
    await expect(reloaded).toBeVisible({ timeout: SLOW });
    await expect(reloaded).toHaveAttribute('aria-pressed', String(expectOn));
  });
});
