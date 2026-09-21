/**
 * 本体域 AI 入口守卫（原 MP-ONT-PROPOSAL-01「NL → proposal → 确认 → 落库」重写）。
 *
 * <h3>为什么重写（2026-09-18 · IA2-2 处置预存红）</h3>
 * <p>原用例驱动的是**域内浮动 AI 助手**（`button.ai-assistant-trigger` →
 * `ai-assistant-panel`）。该入口已于 2026-09-17 IA 重排时**主动移除**——AI 能力
 * 统一走顶栏的全局 SuperAI Copilot（见 OntologyDomainShell 头注释与 ADR-0065）。
 * 原用例自那时起不可能通过（红不是回归，是被测对象没了）。
 *
 * <p>本文件现在守卫这个**移除决定本身**：
 * <ul>
 *   <li>本体域各页面不再渲染域内 AI 助手触发器（防止悄悄长回来）；</li>
 *   <li>全局 Copilot 入口在本体页面可用（AI 能力的现行唯一通道）；</li>
 *   <li>后端 agent-tools 端点仍活着（NL 建模链路的未来宿主）。</li>
 * </ul>
 *
 * <p>「NL → proposal → 确认 → 落库」的端到端重建挂在**全局 Copilot** 上，
 * 属 Agent 层（ADR-0065 S 系列后续批次），本轮 IA v2 明确不做。
 * proposal 确认→执行链路的现行覆盖：ProposalConfirmDrawer 单测 +
 * ui-p1a 对象浏览用例（ActionFormDrawer → ProposalConfirmDrawer）。
 */
import { expect, test } from '@playwright/test';
import { fetchAccessToken, injectAuth } from './helpers/auth';

const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:8100/api/v1';
const TENANT = process.env.E2E_TENANT ?? 'tenant-default';

process.env.E2E_LOGIN_TIMEOUT_MS ||= '120000';

test.describe('本体域 AI 入口（09-17 收编全局 Copilot）', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectAuth(context, page);
  });

  test('本体各页不再渲染域内 AI 助手触发器；全局 Copilot 入口可用', async ({ page }) => {
    for (const path of ['/ontology', '/ontology/model/object-types', '/ontology/explore/objects']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#app')).toBeAttached({ timeout: 30_000 });
      await expect(page.locator('button.ai-assistant-trigger')).toHaveCount(0);
      await expect(page.getByTestId('ai-assistant-panel')).toHaveCount(0);
    }

    // 全局 Copilot：IconRail 底部入口（shell 级，本体页可用）
    await page.goto('/ontology/model/object-types', { waitUntil: 'domcontentloaded' });
    const copilot = page.locator('#app .mp-rail-foot button[aria-label="SuperAI Copilot"]');
    await expect(copilot).toBeVisible({ timeout: 20_000 });
    await copilot.click();
    await expect(page.locator('#app')).toHaveAttribute('data-copilot', 'open');
  });

  test('agent-tools 端点仍活着（NL 建模链路的未来宿主）', async ({ request }) => {
    const token = await fetchAccessToken(request);
    const probe = await request.get(`${GATEWAY}/ont/v2/agent-tools`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': TENANT },
    });
    expect(probe.status(), 'GET /ont/v2/agent-tools').toBe(200);
  });
});
