import { expect, test, type Page } from '@playwright/test';

const portalUrl = process.env.PORTAL_E2E_URL ?? 'http://localhost:9200';

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mate_platform_token', 'e2e-token');
    localStorage.setItem('mate_platform_user', JSON.stringify({
      id: 'e2e-user',
      username: 'e2e',
      realName: 'E2E User',
      tenantId: 'default',
      roles: ['admin'],
    }));
  });
}

test.describe('page-level AI assistant', () => {
  test.beforeEach(async ({ page }) => authenticate(page));

  test('opens beside business architecture content and preserves messages while closed', async ({ page }) => {
    await page.goto(`${portalUrl}/arch`);
    const content = page.getByTestId('assistant-page-content');
    const before = await content.boundingBox();

    await page.getByRole('button', { name: /AI 助手/ }).click();
    const panel = page.getByTestId('ai-assistant-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-employee-id', 'architecture-planner');

    const panelBox = await panel.boundingBox();
    const after = await content.boundingBox();
    expect(panelBox?.width).toBeGreaterThanOrEqual(380);
    expect(panelBox?.width).toBeLessThanOrEqual(400);
    expect(after!.width).toBeLessThan(before!.width - 350);

    const composer = page.getByLabel('向架构规划数字员工发送消息');
    await composer.fill('帮我分析当前业务架构');
    await composer.press('Enter');
    await expect(page.getByText('帮我分析当前业务架构', { exact: true })).toBeVisible();
    await expect(page.getByText('正在思考')).toBeVisible();
    await expect(page.getByTestId('assistant-message-assistant').last()).toBeVisible();

    await page.getByRole('button', { name: '关闭 AI 助手' }).click();
    await expect(panel).not.toBeVisible();
    await page.getByRole('button', { name: /AI 助手/ }).click();
    await expect(page.getByText('帮我分析当前业务架构', { exact: true })).toBeVisible();
  });
});