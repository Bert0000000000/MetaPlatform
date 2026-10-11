import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { injectAuthIntoPage } from './helpers/auth';

test.use({ trace: 'off', video: 'off' });
test.describe('MP11 actual order application', () => {
  test.skip(!process.env.MP11_UI_TOKEN, 'Requires explicitly owned Task6 API/PG and fixture identity');
  const api = 'http://127.0.0.1:55510/api/v1';
  test('empty tenant explicitly creates its own business group and order page', async ({ page, request }) => {
    const token = process.env.MP11_EMPTY_TOKEN!;
    const tenant = process.env.MP11_EMPTY_TENANT!;
    await injectAuthIntoPage(page, token, { tenantId: tenant });
    const headers = { Authorization: 'Bearer ' + token };
    const before = await request.get(api + '/apphub/apps/groups', { headers });
    expect((await before.json()).items).toEqual([]);
    await page.goto('/apps/mine');
    await page.getByLabel('订单应用名称', { exact: true }).fill('Empty tenant order app');
    await page.getByRole('button', { name: '创建订单审核应用', exact: true }).click();
    await expect(page.getByRole('heading', { name: /页面设计器/ })).toBeVisible();
    expect((await (await request.get(api + '/apphub/apps/groups', { headers })).json()).items).toHaveLength(1);
    const apps = (await (await request.get(api + '/apphub/apps', { headers })).json()).items;
    expect(apps).toHaveLength(1); expect(apps[0].status).toBe('DESIGNING');
    expect(apps[0].published_version_id).toBeNull();
  });

  test('actual metadata preview save publish shortlink and human receipt survive reopening', async ({ page, request }) => {
    test.setTimeout(120000);
    const token = process.env.MP11_UI_TOKEN!;
    const tenant = 'mp11-app-ui';
    const headers = { Authorization: 'Bearer ' + token };
    const pendingStatus = 'pending-browser-' + Date.now();
    const orderRid = 'ont.' + tenant + '.ind.order.' + pendingStatus;
    const createdOrder = await request.post(api + '/ont/v2/individuals', { headers, data: {
      rid: orderRid, class_rid: 'ont.' + tenant + '.obj.order', primary_key: pendingStatus,
      props: { ['ont.' + tenant + '.prop.id']: { value: Date.now(), type: 'integer' },
        ['ont.' + tenant + '.prop.total']: { value: 30, type: 'integer' },
        ['ont.' + tenant + '.prop.status']: { value: pendingStatus, type: 'string' } },
    } });
    expect(createdOrder.ok()).toBeTruthy();
    await injectAuthIntoPage(page, token, { tenantId: tenant });
    await page.goto('/apps/mine');
    await page.getByLabel('订单应用名称', { exact: true }).fill('Browser Order ' + Date.now());
    await page.getByRole('button', { name: '创建订单审核应用', exact: true }).click();
    await expect(page.getByRole('heading', { name: /页面设计器/ })).toBeVisible();
    const designer = page.url(); const params = new URL(designer).searchParams;
    const appId = params.get('app')!; const pageId = params.get('page')!;
    await page.getByLabel('订单对象', { exact: true }).selectOption('ont.' + tenant + '.obj.order');
    await page.getByLabel('客户对象', { exact: true }).selectOption('ont.' + tenant + '.obj.customer');
    await page.getByLabel('客户关系', { exact: true }).selectOption('ont.' + tenant + '.link.customer_orders');
    await page.getByLabel('审核动作', { exact: true }).selectOption('ont.' + tenant + '.act.review');
    await expect(page.getByText('total（integer）', { exact: true })).toBeVisible();
    await page.getByLabel('ObjectSet 筛选表达式', { exact: true }).fill(`status == '${pendingStatus}'`);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: /返回$/ }).click();
    await expect(page.getByLabel('审核动作', { exact: true })).toHaveValue('ont.' + tenant + '.act.review');
    await page.getByRole('button', { name: /预览$/ }).click();
    await expect(page.getByRole('heading', { name: '订单审核草稿预览' })).toBeVisible();
    await expect(page.getByText('订单 1 条 · 客户 1 条 · 关联 1 条', { exact: true })).toBeVisible();
    await page.route('**/api/v1/apphub/pages/' + pageId, async route => {
      if (route.request().method() === 'PUT') await route.fulfill({ status: 503, json: { detail: 'Injected page save unavailable' } });
      else await route.continue();
    });
    const failedSave = page.waitForResponse(r => r.url().endsWith('/pages/' + pageId) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /保存$/ }).click();
    expect((await failedSave).status()).toBe(503);
    await expect(page.getByLabel('审核动作', { exact: true })).toHaveValue('ont.' + tenant + '.act.review');
    await page.unroute('**/api/v1/apphub/pages/' + pageId);
    const saved = page.waitForResponse(r => r.url().endsWith('/pages/' + pageId) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /保存$/ }).click();
    expect((await saved).ok()).toBeTruthy();
    await page.goto('/apps/mine?app=' + appId);
    await expect(page.getByRole('button', { name: '编辑页面：订单审核', exact: true })).toBeVisible();
    await page.route('**/apps/' + appId + '/publication-check', route => route.fulfill({ status: 503, json: { detail: 'Injected validation unavailable' } }));
    await page.getByRole('button', { name: /发布检查$/ }).click();
    const checkpoint = page.getByRole('region', { name: '应用发布检查' });
    await expect(checkpoint.getByRole('alert')).toBeVisible();
    await expect(checkpoint.getByRole('button', { name: '确认发布' })).toBeDisabled();
    await page.unroute('**/apps/' + appId + '/publication-check');
    await checkpoint.getByRole('button', { name: '重新检查' }).click();
    await expect(checkpoint.getByRole('button', { name: '确认发布' })).toBeEnabled();
    await expect(checkpoint.getByText(/：通过/)).toHaveCount(6);
    const published = page.waitForResponse(r => r.url().endsWith('/apps/' + appId + '/publish'));
    await checkpoint.getByRole('button', { name: '确认发布' }).click();
    expect((await published).ok()).toBeTruthy();
    await page.getByRole('button', { name: /打开应用$/ }).click();
    await expect(page.getByRole('heading', { name: '订单审核', exact: true })).toBeVisible();
    const shortUrl = page.url();
    await page.getByRole('button', { name: '创建审核提案', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '确认并执行', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '确认并执行', exact: true }).click();
    await expect(page.getByText('已执行成功', { exact: true })).toBeVisible();
    // The visible runtime also reads the persisted audit list, not a local success label.
    await page.goto(shortUrl);
    await expect(page.getByRole('heading', { name: '实际执行回执' })).toBeVisible();
    await expect(page.getByText(/执行人 mp11-order-reviewer/).first()).toBeVisible();
    const runtime = await request.get(api + '/apphub/apps/' + appId + '/runtime/data?page_id=' + pageId, { headers });
    expect(runtime.ok()).toBeTruthy();
    expect((await runtime.json()).orders).toHaveLength(0);
    const history = await request.get(api + '/apphub/apps/' + appId + '/runtime/history?page_id=' + pageId, { headers });
    expect(history.ok()).toBeTruthy();
    const receipts = await history.json();
    expect(receipts).toHaveLength(1); expect(receipts[0].target_iid).toBe(orderRid);
    const proposal = await request.get(api + '/ont/v2/proposals/' + receipts[0].proposal_id, { headers });
    expect((await proposal.json()).parameters.provenance).toMatchObject({ app_id: appId, page_id: pageId });
    await page.screenshot({ path: process.env.MP11_UI_SCREENSHOT, fullPage: true });
  });
  test('onboarding resumes selected real artifacts and treats query failures as unknown', async ({ page }) => {
    const evidence = JSON.parse(readFileSync(process.env.MP11_API_EVIDENCE!, 'utf8'));
    await injectAuthIntoPage(page, process.env.MP11_UI_TOKEN!, { tenantId: 'mp11-app-ui' });
    await page.goto('/');
    const guide = page.getByRole('region', { name: '开始使用平台' });
    await guide.getByRole('button', { name: '接入真实数据', exact: true }).click();
    await guide.getByLabel('本次数据源', { exact: true }).selectOption(evidence.source_id);
    await guide.getByLabel('本次对象模型', { exact: true }).selectOption('ont.mp11-app-ui.obj.order');
    await guide.getByLabel('本次映射', { exact: true }).selectOption(evidence.mappings[1].rid);
    await guide.getByLabel('本次导入运行', { exact: true }).selectOption(evidence.runs[1].run_id);
    await guide.getByLabel('本次客户关系', { exact: true }).selectOption('ont.mp11-app-ui.link.customer_orders');
    await guide.getByLabel('本次应用', { exact: true }).selectOption(evidence.app.id);
    await expect(guide.getByText(/：已验证/)).toHaveCount(5);
    await guide.getByRole('button', { name: '前往创建应用', exact: true }).click();
    await page.goto('/');
    await expect(guide.getByLabel('本次应用', { exact: true })).toHaveValue(evidence.app.id);
    await expect(guide.getByRole('button', { name: '前往创建应用', exact: true })).toHaveAttribute('aria-current', 'step');
    await expect(guide.getByText(/：已验证/)).toHaveCount(5);
    await page.route('**/api/v1/apphub/apps*', route => route.fulfill({ status: 503, json: { detail: 'Injected catalog unavailable' } }));
    await guide.getByRole('button', { name: '重新核验产物', exact: true }).click();
    await expect(guide.getByRole('alert')).toContainText('状态未知');
    await expect(guide.getByText(/：未知/)).toHaveCount(5);
    await expect(guide.getByLabel('本次应用', { exact: true })).toHaveValue(evidence.app.id);
    await page.unroute('**/api/v1/apphub/apps*');
    await guide.getByRole('button', { name: '重试检查', exact: true }).click();
    await expect(guide.getByText(/：已验证/)).toHaveCount(5);
  });

});
