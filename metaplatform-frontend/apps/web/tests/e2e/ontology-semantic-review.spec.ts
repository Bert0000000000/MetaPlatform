import { test, expect } from '@playwright/test';
import type { ModelingSource } from '../../src/api/ont/modeling';

/** UI regression only: all API calls are intercepted, no real publication or data writes. */
test('semantic review is visible, included in confirmation and editable from validation', async ({ page }, testInfo) => {
  let source: ModelingSource = {
    id: 'semantic-ui', name: '植物标本.xlsx', revision: 1, context: '植物调查', questions: [], resolutions: {},
    profile: { rowCount: 0, sheets: [] },
    draft: { schemaVersion: 2, name: '标本模型', classes: [{ id: 'specimen', name: '植物标本', description: '采集的植物标本',
      properties: [{ id: 'code', name: '标本编号', dataType: 'text' }], identity: ['code'], identityStatus: 'proposed', identityReason: '每份标本编号唯一', labelProperty: 'code', accepted: false }],
      relationships: [], mappings: [], instances: [], instanceEdits: [], links: [], notes: ['业务依据需人工核对。'],
      semantics: { context: '', questions: [], definitions: [{ target: 'class:specimen', definition: '每份独立采集的植物标本', aliases: [], scope: '植物调查', grain: '一份标本', unit: '', constraints: '编号唯一', basis: '标本登记规则', confirmed: false }] } },
    job: null, review: null, validation: null, plan: null, preview: null, publication: null, sync: null,
  };
  const operations: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('mate_platform_token', 'isolated-ui-fixture');
    localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'ui-reviewer', username: 'UI reviewer', tenantId: 'ui-isolated', roles: ['PLATFORM_ADMIN'] }));
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: unknown = [];
    if (path.endsWith('/modeling/sources')) body = { sources: [source] };
    else if (path.endsWith('/modeling/sources/semantic-ui')) {
      if (method === 'PUT' || method === 'PATCH') {
        operations.push('save');
        source = { ...source, ...route.request().postDataJSON(), revision: source.revision + 1, validation: null, plan: null, review: null };
      }
      body = source;
    } else if (path.endsWith('/validate')) {
      operations.push('validate');
      source.validation = { scope: 'ontology', errors: 0, warnings: 1, canPublish: true, configHash: `revision-${source.revision}`, counts: { classes: 1, nodes: 0, edges: 0 }, issues: [{ severity: 'warning', item: 'class:specimen', message: '请核对标本业务口径' }] };
      body = source;
    }
    await route.fulfill({ json: body });
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/ontology/model/from-data?source=semantic-ui');
  await expect(page.getByText(/待审核语义 1 项/)).toBeVisible();
  await expect(page.getByText('定义：每份独立采集的植物标本')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('review-light.png'), fullPage: true });
  await page.getByRole('button', { name: '全部确认对象', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('定义：每份独立采集的植物标本')).toBeVisible();
  await dialog.getByRole('button', { name: '确认所选 1 项', exact: true }).click();
  await expect(page.getByText(/待审核语义 0 项/)).toBeVisible();
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看并处理', exact: true })).toBeVisible();
  expect(operations).toEqual(['save', 'validate']);
  expect(source.draft!.semantics.definitions[0].confirmed).toBe(true);
  await page.getByRole('button', { name: '查看并处理', exact: true }).click();
  await page.getByRole('textbox', { name: 'class:specimen 定义', exact: true }).fill('按采集事件区分的独立标本');
  await expect(page.getByRole('checkbox', { name: '确认对象及业务语义', exact: true })).not.toBeChecked();
  await page.getByText('确认对象及业务语义', { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('validation-drawer-light.png'), fullPage: true });
  await page.getByRole('button', { name: '保存并重新校验', exact: true }).click();
  await expect(page.getByRole('button', { name: /3.*变更草稿与校验/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.fd-review-sheet:visible')).toHaveCount(0);
  expect(operations).toEqual(['save', 'validate', 'save', 'validate']);
  expect(source.draft!.semantics.definitions[0].definition).toBe('按采集事件区分的独立标本');
  expect(source.draft!.semantics.definitions[0].confirmed).toBe(true);
  await page.getByRole('button', { name: /2.*候选匹配与合并确认/ }).click();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.body.setAttribute('theme-mode', 'dark'); });
  await page.screenshot({ path: testInfo.outputPath('review-dark.png'), fullPage: true });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText(/待审核语义 0 项/)).toBeVisible();
    await page.getByRole('button', { name: '审核植物标本', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'class:specimen 定义', exact: true })).toBeVisible();
    const sheet = page.locator('.fd-review-sheet:visible');
    await expect.poll(async () => {
      const inner = await sheet.locator('.semi-sidesheet-inner').boundingBox();
      return inner && inner.x >= -1 && inner.x + inner.width <= width + 1;
    }).toBe(true);
    const bounds = await sheet.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`review-drawer-dark-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: '完成查看', exact: true }).click();
    await expect(page.locator('.fd-review-sheet:visible')).toHaveCount(0);
  }
  expect(pageErrors).toEqual([]);
});
