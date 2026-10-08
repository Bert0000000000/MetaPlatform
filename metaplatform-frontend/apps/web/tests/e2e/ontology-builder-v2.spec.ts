import { expect, test } from '@playwright/test';
import { builderAuth } from './helpers/builder-auth';
const gateway = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:8100/api/v1';

test('real Ont: model selection, dirty editor history restoration, binding samples and same-resource publication', async ({ page }) => {
  const auth = await builderAuth(page);
  const slug = `builder-e2e-${Date.now()}`;
  const rid = `ont.${auth.tenantId}.obj.builder.${slug}.v1`;
  const property = `ont.${auth.tenantId}.prop.builder.${slug}-id.v1`;
  const created = await page.request.post(`${gateway}/ont/v2/object-types`, {
    headers: { Authorization: `Bearer ${auth.token}`, 'X-Tenant-Id': auth.tenantId },
    data: { rid, display_name: 'Builder 浏览器资源', primary_key: [property], interfaces: [], properties: [{ rid: property, title: '浏览器编号', type_id: 'STRING', format: 'string', nullable: false, primary_key: true }] },
  });
  expect(created.ok(), `Isolated builder resource HTTP ${created.status()}`).toBeTruthy();
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/ont/')) mutations.push(request.method() + ' ' + new URL(request.url()).pathname); });
  await page.goto(`/ontology/model/graph?typeRef=${encodeURIComponent(rid)}`);
  const inspector = page.getByRole('complementary', { name: '资源属性' });
  await expect(inspector).toContainText(rid);
  await expect(page.getByText('尚未校验', { exact: false })).toBeVisible();
  await inspector.getByRole('button', { name: '打开模型编辑器' }).click();
  await page.getByRole('button', { name: '编辑模型', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '模型编辑器' });
  await expect(editor).toBeVisible();
  await editor.getByLabel('概念显示名').fill('浏览器未提交输入');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '未保存的修改' })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/ontology\/model\/graph/);
  await page.goForward();
  await page.getByRole('button', { name: '编辑模型', exact: true }).click();
  const detailEditor = page.getByRole('dialog', { name: '模型编辑器' });
  // Returning and reopening restores the identity-isolated local input.
  await expect(detailEditor).toBeVisible();
  await expect(detailEditor.getByLabel('概念显示名')).toHaveValue('浏览器未提交输入');
  await expect(detailEditor.getByRole('status')).toContainText('尚未提交后端');
  expect(mutations).toEqual([]);
  await detailEditor.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: /放弃/ }).click();
  await page.goto(`/ontology/data/mappings?class=${encodeURIComponent(rid)}`);
  await expect(page.getByText('物化样本', { exact: true })).toBeVisible();
  await expect(page.getByText('服务端计数', { exact: false })).toBeVisible();
  await page.goto(`/ontology/governance/releases?class=${encodeURIComponent(rid)}`);
  await expect(page.getByRole('combobox', { name: '目标类型' })).toHaveValue(rid);
  await expect(page.getByText('版本历史尚未成功读取')).toHaveCount(0);
  await expect(page.getByText(/尚无对应版本快照|对应已发布版本/).first()).toBeVisible();
  expect(mutations).toEqual([]);
});

test('real Ont + explicit HTTP error: create references retry and failed model read stay distinguishable', async ({ page }) => {
  await builderAuth(page);
  let calls = 0;
  await page.route('**/ont/v2/interfaces*', async route => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 503, json: { detail: '辅助接口边界故障' } });
    return route.continue();
  });
  await page.goto('/ontology/model/object-types?create=true');
  const editor = page.getByRole('dialog', { name: '模型编辑器' });
  await expect(editor.getByRole('button', { name: '重试编辑辅助信息' })).toBeVisible();
  await editor.getByPlaceholder('例如：客户').fill('保留新建输入');
  await editor.getByRole('button', { name: '重试编辑辅助信息' }).click();
  await expect(editor.getByPlaceholder('例如：客户')).toHaveValue('保留新建输入');
  expect(calls).toBeGreaterThan(1);
});
