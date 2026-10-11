import { expect, test } from '@playwright/test';

test('real API/PostgreSQL: definition, association, cardinality, reload and both endpoint queries', async ({ page, request }) => {
  const api = 'http://127.0.0.1:55498';
  const sessionResponse = await request.get(api + '/__mp11/session');
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();
  const base = api + '/api/v1/ont/v2';
  const headers = { Authorization: 'Bearer ' + session.token };
  const initialTypes = await request.get(base + '/link-types', { headers });
  expect((await initialTypes.json()).map((r: { rid: string }) => r.rid)).toEqual(['ont.' + session.tenant + '.link.paged_relationship']);
  const allEndpoints: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const endpoints = await request.get(base + '/object-types', { headers, params: { limit: 100, offset } });
    const rows = await endpoints.json();
    allEndpoints.push(...rows.map((r: { rid: string }) => r.rid));
    if (rows.length < 100) break;
  }
  expect(allEndpoints).toHaveLength(104);
  expect(allEndpoints).toContain(session.lateSource);
  expect(allEndpoints.every(rid => rid.startsWith('ont.' + session.tenant + '.'))).toBeTruthy();
  const linkRid = 'ont.' + session.tenant + '.link.customer_orders';
  const propRid = linkRid + '.prop.note';
  await page.addInitScript(({ token, tenant }) => {
    localStorage.setItem('mate_platform_token', token);
    localStorage.setItem('mate_platform_user', JSON.stringify({ id: 'mp11-ui-test', username: 'mp11-ui-test', tenantId: tenant, roles: ['PLATFORM_SUPER_ADMIN'] }));
  }, { token: session.token, tenant: session.tenant });
  await page.goto('/ontology/model/link-types?create=1&source=' + encodeURIComponent(session.customer));
  const form = page.getByRole('form', { name: '关系定义表单' });
  await expect(page.getByText('Neighbor Secret Relation', { exact: true })).toHaveCount(0);
  await expect(form.getByRole('option', { name: 'Neighbor customer', exact: true })).toHaveCount(0);
  await expect(form.getByLabel('源对象类型')).toHaveValue(session.customer);
  await form.getByLabel('关系名称', { exact: true }).fill('Customer Orders');
  await form.getByLabel('目标对象类型').selectOption(session.order);
  await form.getByLabel('目标端名称').fill('Customer');
  await form.getByLabel('说明').fill('Customer owns orders');
  await form.getByRole('button', { name: '添加关系属性' }).click();
  await form.getByPlaceholder('例如 dept_name').fill('note');
  await form.getByPlaceholder('例如 部门名称').fill('关联备注');
  const created = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/link-types') && r.request().method() === 'POST');
  await form.getByRole('button', { name: '保存关系' }).click();
  const creationResponse = await created;
  expect(new URL(creationResponse.url()).searchParams.get('create_only')).toBe('true');
  expect(creationResponse.status()).toBe(200);
  const row = page.getByRole('row').filter({ hasText: 'customer_orders' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '实例', exact: true }).click();
  await page.getByRole('button', { name: '关联对象', exact: true }).click();
  const association = page.getByRole('form', { name: '关联对象表单' });
  await expect(association.getByRole('option', { name: 'C201', exact: true })).toHaveCount(1);
  await expect(association.getByRole('button', { name: '加载更多源对象' })).toHaveCount(0);
  await association.getByRole('combobox', { name: '源对象', exact: true }).selectOption('ont.' + session.tenant + '.ind.c001');
  await association.getByRole('combobox', { name: '目标对象', exact: true }).selectOption('ont.' + session.tenant + '.ind.o001');
  await association.getByLabel('关联备注').fill('approved by customer');
  const written = page.waitForResponse(r => r.url().endsWith('/link-instances') && r.request().method() === 'POST');
  await association.getByRole('button', { name: '保存关联' }).click();
  expect((await written).status()).toBe(200);
  await expect(page.getByText('1 条实例', { exact: true })).toBeVisible();
  await expect(page.getByText('note="approved by customer"', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关联对象', exact: true }).click();
  await association.getByRole('combobox', { name: '源对象', exact: true }).selectOption('ont.' + session.tenant + '.ind.c002');
  await association.getByRole('combobox', { name: '目标对象', exact: true }).selectOption('ont.' + session.tenant + '.ind.o001');
  const rejected = page.waitForResponse(r => r.url().endsWith('/link-instances') && r.request().method() === 'POST');
  await association.getByRole('button', { name: '保存关联' }).click();
  expect((await rejected).status()).toBe(409);
  await expect(association.getByRole('alert')).toContainText('cardinality');
  await expect(association.getByRole('combobox', { name: '源对象', exact: true })).toHaveValue('ont.' + session.tenant + '.ind.c002');
  await expect(association.getByRole('combobox', { name: '目标对象', exact: true })).toHaveValue('ont.' + session.tenant + '.ind.o001');
  await association.getByRole('button', { name: '取消关联' }).click();
  await page.reload();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '实例', exact: true }).click();
  await expect(page.getByText('1 条实例', { exact: true })).toBeVisible();
  await expect(page.getByText('note="approved by customer"', { exact: true })).toBeVisible();
  for (const [field, rid] of [['src', 'ont.' + session.tenant + '.ind.c001'], ['dst', 'ont.' + session.tenant + '.ind.o001']]) {
    const response = await request.get(base + '/link-instances', { headers, params: { link_type_rid: linkRid, [field]: rid } });
    expect(response.ok()).toBeTruthy();
    const rows = await response.json(); expect(rows).toHaveLength(1);
    expect(rows[0].props[propRid]).toBe('approved by customer');
  }
  const stats = await request.get(base + '/link-instances/stats', { headers });
  expect((await stats.json()).by_link_type[linkRid]).toBe(1);
  const denied = await request.post(base + '/link-types', { headers: { Authorization: 'Bearer ' + session.readToken },
    data: { rid: linkRid, src: session.customer, dst: session.order, cardinality: '1:N', directionality: 'directed' } });
  expect(denied.status()).toBe(403);
  await page.reload();
  await row.getByRole('button', { name: '编辑关系', exact: true }).click();
  await expect(form.getByLabel('源对象类型')).toBeDisabled();
  await expect(form.getByLabel('基数')).toBeDisabled();
  await form.getByLabel('说明').fill('Updated and persisted');
  const edited = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/link-types') && r.request().method() === 'POST');
  await form.getByRole('button', { name: '保存关系' }).click();
  expect((await edited).status()).toBe(200);
  const persisted = await request.get(base + '/link-types/' + encodeURIComponent(linkRid), { headers });
  expect((await persisted.json()).description).toBe('Updated and persisted');

  // Later-page source deep link and target are selected from the real paginated type API.
  await page.goto('/ontology/model/link-types?create=1&source=' + encodeURIComponent(session.lateSource));
  await expect(form.getByLabel('源对象类型')).toHaveValue(session.lateSource);
  await form.getByLabel('关系名称', { exact: true }).fill('Later Source');
  await form.getByLabel('目标对象类型').selectOption(session.order);
  const laterCreated = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/link-types') && r.request().method() === 'POST');
  await form.getByRole('button', { name: '保存关系' }).click();
  expect((await laterCreated).status()).toBe(200);

  // Directory failure is explicitly injected by the dedicated test helper, then actual PG reads resume.
  await request.post(api + '/__mp11/fault/catalog');
  await page.goto('/ontology/model/link-types?create=1');
  await form.getByLabel('关系名称', { exact: true }).fill('Catalog Retry');
  await expect(form.getByRole('alert')).toContainText('关系目录读取失败');
  await expect(form.getByRole('button', { name: '保存关系' })).toBeDisabled();
  await request.post(api + '/__mp11/fault/clear');
  await form.getByRole('button', { name: '重试关系目录' }).click();
  await expect(form.getByRole('button', { name: '保存关系' })).toBeEnabled();
  await expect(form.getByLabel('关系名称', { exact: true })).toHaveValue('Catalog Retry');

  // Actual second session claims a RID after this browser's catalog snapshot.
  await form.getByLabel('关系名称', { exact: true }).fill('Session Race');
  await form.getByLabel('源对象类型').selectOption(session.customer);
  await form.getByLabel('目标对象类型').selectOption(session.order);
  await form.getByLabel('说明').fill('Retained unsaved input');
  const raceRid = 'ont.' + session.tenant + '.link.session_race';
  const winner = await request.post(base + '/link-types?create_only=true', { headers,
    data: { rid: raceRid, src: session.customer, dst: session.order, cardinality: '1:N', directionality: 'directed', description: 'Other session won' } });
  expect(winner.status()).toBe(200);
  const lost = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/link-types') && r.request().method() === 'POST');
  await form.getByRole('button', { name: '保存关系' }).click();
  expect((await lost).status()).toBe(409);
  await expect(form.getByRole('alert')).toContainText('already exists');
  await expect(form.getByLabel('说明')).toHaveValue('Retained unsaved input');
  const original = await request.get(base + '/link-types/' + encodeURIComponent(raceRid), { headers });
  expect((await original.json()).description).toBe('Other session won');
  const repeated = await request.post(base + '/link-types?create_only=true', { headers,
    data: { rid: raceRid, src: session.customer, dst: session.order, cardinality: '1:N', directionality: 'directed', description: 'Must not overwrite' } });
  expect(repeated.status()).toBe(409);

  // A failed next-page request keeps error visible and permits a genuine previous-page reload.
  await page.goto('/ontology/model/link-types');
  const paged = page.getByRole('row').filter({ hasText: 'paged_relationship' });
  await paged.getByRole('button', { name: '实例', exact: true }).click();
  await expect(page.getByText('200 条实例', { exact: true })).toBeVisible();
  await request.post(api + '/__mp11/fault/page');
  await page.getByRole('button', { name: '下一页实例' }).click();
  await expect(page.getByRole('alert')).toContainText('MP11 injected transient read failure');
  await expect(page.getByRole('button', { name: '上一页实例' })).toBeEnabled();
  await page.getByRole('button', { name: '上一页实例' }).click();
  await expect(page.getByText('200 条实例', { exact: true })).toBeVisible();
  await expect(page.getByText('MP11 injected transient read failure', { exact: true })).toHaveCount(0);
  await request.post(api + '/__mp11/fault/clear');
});
