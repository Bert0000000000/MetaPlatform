import { expect, test, type Page } from '@playwright/test';

const portalUrl = process.env.E2E_BASE_URL ?? process.env.PORTAL_E2E_URL ?? 'http://localhost:9200';

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
    expect(panelBox?.width).toBeGreaterThanOrEqual(380);
    expect(panelBox?.width).toBeLessThanOrEqual(400);
    await expect.poll(async () => (await content.boundingBox())?.width).toBeLessThan(before!.width - 350);

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
  test('supports multiline keyboard input and creates a new session when cleared', async ({ page }) => {
    await page.goto(`${portalUrl}/arch`);
    await page.getByRole('button', { name: /AI 助手/ }).click();

    const panel = page.getByTestId('ai-assistant-panel');
    const firstSessionId = await panel.getAttribute('data-session-id');
    const composer = page.getByLabel('向架构规划数字员工发送消息');

    await composer.fill('第一行');
    await composer.press('End');
    await composer.press('Shift+Enter');
    await page.keyboard.insertText('第二行');
    await expect(composer).toHaveValue('第一行\n第二行');
    await composer.press('Enter');
    await expect(page.getByTestId('assistant-message-user')).toContainText('第一行\n第二行');

    await page.getByRole('button', { name: '清空会话' }).click();
    await expect(page.getByTestId('assistant-message-user')).toHaveCount(0);
    await expect(panel).not.toHaveAttribute('data-session-id', firstSessionId!);
  });

  test('keeps employees and current messages isolated between modules', async ({ page }) => {
    const architectureMessage = `架构会话-${Date.now()}`;

    await page.goto(`${portalUrl}/arch`);
    await page.getByRole('button', { name: /AI 助手/ }).click();
    const architectureComposer = page.getByLabel('向架构规划数字员工发送消息');
    await architectureComposer.fill(architectureMessage);
    await architectureComposer.press('Enter');
    await expect(page.getByText(architectureMessage, { exact: true })).toBeVisible();

    await page.goto(`${portalUrl}/knowledge`);
    await page.getByRole('button', { name: /AI 助手/ }).click();
    const panel = page.getByTestId('ai-assistant-panel');
    await expect(panel).toHaveAttribute('data-employee-id', 'knowledge-governor');
    await expect(page.getByText('知识治理数字员工', { exact: true })).toBeVisible();
    await expect(page.getByText(architectureMessage, { exact: true })).toHaveCount(0);
  });

  test('connects every AI entry to its page-specific employee', async ({ page }) => {
    const pages = [
      ['/apps', 'application-designer'],
      ['/ontology', 'ontology-modeler'],
      ['/ontology/datacenter', 'ontology-data-steward'],
      ['/knowledge', 'knowledge-governor'],
      ['/mcp', 'mcp-tool-specialist'],
    ] as const;

    for (const [path, employeeId] of pages) {
      await page.goto(`${portalUrl}${path}`);
      await page.getByRole('button', { name: /AI 助手/ }).click();
      await expect(page.getByTestId('ai-assistant-panel')).toHaveAttribute('data-employee-id', employeeId);
    }
  });
});