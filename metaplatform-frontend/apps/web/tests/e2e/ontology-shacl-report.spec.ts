import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { builderAuth } from './helpers/builder-auth';
const gateway = process.env.E2E_GATEWAY_URL ?? 'http://127.0.0.1:8100/api/v1';

async function fixture(page: Page) {
  const auth = await builderAuth(page);
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const rows = [];
  for (const suffix of ['a', 'b']) {
    const rid = `ont.${auth.tenantId}.obj.aaa.shacl-${stamp}-${suffix}.v1`;
    const property = `ont.${auth.tenantId}.prop.aaa.shacl-${stamp}-${suffix}-id.v1`;
    const name = `SHACL ${stamp} ${suffix.toUpperCase()}`;
    const headers = { Authorization: `Bearer ${auth.token}`, 'X-Tenant-Id': auth.tenantId };
    const created = await page.request.post(`${gateway}/ont/v2/object-types`, { headers, data: {
      rid, display_name: name, primary_key: [property], interfaces: [], properties: [
        { rid: property, title: '编号', type_id: 'STRING', format: 'string', nullable: false, primary_key: true },
      ],
    } });
    expect(created.status(), 'Own synthetic type creation').toBe(200);
    const reread = await page.request.get(`${gateway}/ont/v2/object-types/${encodeURIComponent(rid)}`, { headers });
    expect(reread.status()).toBe(200); expect((await reread.json()).display_name).toBe(name);
    rows.push({ rid, property, name, individual: { rid: `ont.${auth.tenantId}.ind.shacl-${stamp}-${suffix}.v1`, class_rid: rid, props: { [property]: suffix.toUpperCase() } } });
  }
  return rows;
}
async function choose(page: Page, name: string) {
  await page.getByRole('combobox', { name: '对象类型', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
}
async function downloaded(page: Page) {
  const received = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载报告 JSON', exact: true }).click();
  const result = await received;
  const path = await result.path(); expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8'));
}

test('real SHACL: current-target report download preserves response and switching clears it', async ({ page }) => {
  const [a, b] = await fixture(page);
  await page.route('**/ont/v2/shacl/validate', async route => {
    const target = route.request().postDataJSON().target_class;
    const row = target === a.rid ? a : b;
    const response = await route.fetch({ postData: JSON.stringify({ target_class: target, individuals: [row.individual] }) });
    expect(response.status()).toBe(200);
    await route.fulfill({ response });
  });
  await page.goto('/ontology/model/validation'); await choose(page, a.name);
  await expect(page.getByRole('button', { name: '下载报告 JSON' })).toBeDisabled();
  const completed = page.waitForResponse(r => r.url().endsWith('/shacl/validate') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '校验', exact: true }).click();
  const response = await completed; expect(response.status()).toBe(200); const report = await response.json();
  expect(report.stats.nodes_validated).toBe(1); await expect(page.getByText('✓ conforms', { exact: true })).toBeVisible();
  const receipt = await downloaded(page); expect(receipt.target_class).toBe(a.rid); expect(receipt.report).toEqual(report);
  expect(receipt.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); expect(receipt.checkedAt).toBeUndefined(); expect(receipt.scope).toContain('当前对象类型');
  await choose(page, b.name); await expect(page.getByText('✓ conforms', { exact: true })).toHaveCount(0);
  await expect(page.getByText('当前类型尚未校验。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下载报告 JSON' })).toBeDisabled();
});

test('real SHACL with explicit property_shapes: Warning and Info keep server conforms and exact severity counts', async ({ page }) => {
  const [a] = await fixture(page);
  await page.route('**/ont/v2/shacl/validate', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ target_class: a.rid, individuals: [a.individual], property_shapes: [
      { path: a.property, pattern: '^does-not-match$', severity: 'Warning' },
      { path: a.property, datatype: 'integer', severity: 'Info' },
    ] }) });
    expect(response.status()).toBe(200); const report = await response.json();
    expect(report.conforms).toBe(true); expect(report.severity_counts).toEqual({ Violation: 0, Warning: 1, Info: 1 });
    await route.fulfill({ response });
  });
  await page.goto('/ontology/model/validation'); await choose(page, a.name);
  await page.getByRole('button', { name: '校验', exact: true }).click();
  await expect(page.getByText('✓ conforms', { exact: true })).toBeVisible();
  await expect(page.locator('.semi-tag-orange-light').filter({ hasText: '警告 1' })).toBeVisible();
  await expect(page.locator('.semi-tag-blue-light').filter({ hasText: '信息 1' })).toBeVisible();
  await expect(page.getByText('✗ 未通过本次校验', { exact: true })).toHaveCount(0);
  const receipt = await downloaded(page); expect(receipt.report.violations.map((v: { severity: string }) => v.severity)).toEqual(['Warning', 'Info']);
});

test('real SHACL with controlled response order: late A cannot replace the completed B report', async ({ page }) => {
  const [a, b] = await fixture(page);
  let release!: () => void, arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const aArrived = new Promise<void>(resolve => { arrived = resolve; });
  let aDone!: () => void; const done = new Promise<void>(resolve => { aDone = resolve; });
  await page.route('**/ont/v2/shacl/validate', async route => {
    const target = route.request().postDataJSON().target_class, row = target === a.rid ? a : b;
    const response = await route.fetch({ postData: JSON.stringify({ target_class: target, individuals: [row.individual] }) });
    expect(response.status()).toBe(200);
    if (target === a.rid) { arrived(); await held; }
    await route.fulfill({ response }); if (target === a.rid) aDone();
  });
  await page.goto('/ontology/model/validation'); await choose(page, a.name);
  await page.getByRole('button', { name: '校验', exact: true }).click(); await aArrived;
  await choose(page, b.name); await page.getByRole('button', { name: '校验', exact: true }).click();
  await expect(page.getByText('✓ conforms', { exact: true })).toBeVisible();
  release(); await done;
  expect((await downloaded(page)).target_class).toBe(b.rid);
});
