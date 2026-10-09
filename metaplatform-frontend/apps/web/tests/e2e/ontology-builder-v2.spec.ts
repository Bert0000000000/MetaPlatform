import { expect, test } from '@playwright/test';
import { builderAuth } from './helpers/builder-auth';
import { pgConfigFromEnv, pgQuery } from '../../../../tests/e2e/helpers/pg';
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

test('real Ont + own PG: editor WIP, five-step publication, saved source sync and actual sample query', async ({ page }) => {
  const auth = await builderAuth(page);
  const pg = pgConfigFromEnv();
  // Refuse helper defaults/shared targets. Only this runner's isolated app database
  // and its actually connected non-privileged role can seed test-owned source data.
  const expectedPg = process.env.CI === 'true'
    ? { host: '127.0.0.1', port: 5432, user: 'builder_source_fixture', database: 'metaplatform_ont' }
    : { host: '127.0.0.1', port: 55493, user: 'builder_app', database: 'codex_builder_ontology' };
  expect({ host: pg.host, port: pg.port, user: pg.user, database: pg.database }).toEqual(expectedPg);
  expect(Boolean(process.env.PGPASSWORD), 'Runner must supply its own PG credential').toBe(true);
  const identity = await pgQuery('SELECT current_database() AS db, current_user AS role, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user', [], pg);
  expect(identity).toEqual([{ db: pg.database, role: pg.user, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false }]);
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const slug = `builder-e2e-write-${suffix.replaceAll('_', '-')}`;
  const name = `Builder 发布 ${suffix}`;
  const table = `src_builder_e2e_${suffix}`;
  expect(table).toMatch(/^src_builder_e2e_[0-9]+_[a-f0-9]+$/);
  const pathOf = (url: string) => decodeURIComponent(new URL(url).pathname);
  const writes: Array<{ method: string; path: string }> = [];
  page.on('request', request => {
    if (request.method() !== 'GET' && pathOf(request.url()).startsWith('/api/v1/ont/')) writes.push({ method: request.method(), path: pathOf(request.url()) });
  });
  await page.goto('/ontology/model/object-types?create=true');
  const editor = page.getByRole('dialog', { name: '模型编辑器' });
  await editor.getByPlaceholder('例如：customer').fill(slug);
  await editor.getByPlaceholder('例如：客户').fill(name);
  const domain = await editor.locator('select').first().inputValue();
  const rid = `ont.${auth.tenantId}.obj.${domain}.${slug}.v1`;
  const savedWip = page.waitForResponse(r => pathOf(r.url()) === '/api/v1/ont/v2/object-types/wip' && r.request().method() === 'POST');
  await editor.getByRole('button', { name: '保存草稿（WIP）', exact: true }).click();
  const wipResponse = await savedWip;
  expect(wipResponse.status(), 'UI WIP save HTTP status').toBe(200);
  const definition = wipResponse.request().postDataJSON().payload;
  expect(definition.rid).toBe(rid);
  expect(definition.display_name).toBe(name);
  expect(definition.primary_key).toHaveLength(1);
  const property = definition.primary_key[0] as string;
  expect(property.startsWith(`ont.${auth.tenantId}.prop.${domain}.`)).toBe(true);
  expect(definition.properties).toEqual(expect.arrayContaining([expect.objectContaining({ rid: property, primary_key: true, nullable: false, format: 'string' })]));
  expect(definition.confirm_name).toBeUndefined();
  expect(await wipResponse.json()).toEqual(expect.objectContaining({ rid, status: 'staged', base_checksum: '' }));
  await expect(editor).toHaveCount(0);
  // Name-blur precheck is an existing POST read; WIP is the only staged write.
  expect(writes).toEqual([{ method: 'POST', path: '/api/v1/ont/v2/object-types/precheck' }, { method: 'POST', path: '/api/v1/ont/v2/object-types/wip' }]);

  const readWip = page.waitForResponse(r => pathOf(r.url()) === '/api/v1/ont/v2/object-types/wip' && r.request().method() === 'GET');
  await page.goto(`/ontology/governance/drafts?typeRef=${encodeURIComponent(rid)}`);
  const readWipResponse = await readWip;
  expect(readWipResponse.status()).toBe(200);
  const wipList = await readWipResponse.json();
  const stored = (Array.isArray(wipList) ? wipList : wipList.items).find((row: { rid: string }) => row.rid === rid);
  expect(stored.payload).toEqual({ ...definition, marking: [] });
  await expect(page.getByRole('combobox', { name: '目标草稿' })).toHaveValue(rid);
  const steps = page.getByRole('list', { name: '发布步骤' });
  await expect(steps.locator('li')).toHaveCount(5);
  await expect(steps).toContainText('影响预览');
  const publish = page.getByRole('button', { name: '确认发布', exact: true });
  await expect(publish).toBeDisabled();
  const validated = page.waitForResponse(r => pathOf(r.url()) === '/api/v1/ont/v2/object-types/validate' && r.request().method() === 'POST');
  const absenceStatuses: number[] = [];
  page.on('response', r => { if (pathOf(r.url()) === `/api/v1/ont/v2/object-types/${rid}` && r.request().method() === 'GET') absenceStatuses.push(r.status()); });
  await page.getByRole('button', { name: '校验草稿', exact: true }).click();
  const validation = await validated;
  expect(validation.status(), 'Real model validation HTTP status').toBe(200);
  expect(validation.request().postDataJSON()).toEqual(stored.payload);
  const validationResult = await validation.json();
  expect(validationResult.valid, `Actual validation errors: ${validationResult.errors.join('; ')}`).toBe(true);
  await expect.poll(() => absenceStatuses, { message: 'Exact 404 proves newly absent publication target' }).toEqual([404]);
  await expect(page.getByText('新类型：已完成现有类型读取，无存量实例迁移目标。', { exact: true })).toBeVisible();
  await expect(publish).toBeEnabled();
  const applied = page.waitForResponse(r => pathOf(r.url()) === `/api/v1/ont/v2/object-types/wip/${rid}/apply` && r.request().method() === 'POST');
  await publish.click();
  const appliedResponse = await applied;
  expect(appliedResponse.status(), 'Actual confirmed WIP apply HTTP status').toBe(200);
  expect(appliedResponse.request().postDataJSON()).toEqual({});
  expect(new URL(appliedResponse.url()).searchParams.has('expected_checksum')).toBe(false);
  const published = await appliedResponse.json();
  expect(published).toEqual(expect.objectContaining({ rid, display_name: name, primary_key: [property] }));
  expect(Boolean(published.checksum), 'Published server checksum returned').toBe(true);
  await expect(page.getByRole('status').filter({ hasText: `发布成功：${name}` })).toBeVisible();
  await expect(steps.locator('li[aria-current="step"]')).toContainText('结果');
  await expect(page.getByText('当前生效', { exact: true })).toBeVisible();
  const active = await page.request.get(`${gateway}/ont/v2/object-types/${encodeURIComponent(rid)}`, { headers: { Authorization: `Bearer ${auth.token}` } });
  expect(active.status()).toBe(200);
  expect((await active.json()).checksum).toBe(published.checksum);

  // Only now create a newly named source table; never drop/reuse any existing table.
  await pgQuery(`CREATE TABLE ${table} (nid TEXT PRIMARY KEY, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`, [], pg);
  await pgQuery(`INSERT INTO ${table} (nid) VALUES ($1), ($2)`, ['builder-row-a', 'builder-row-b'], pg);
  await page.goto(`/ontology/data/mappings?typeRef=${encodeURIComponent(rid)}`);
  await page.getByRole('textbox', { name: '源名', exact: true }).fill(`builder-source-${suffix}`);
  await page.getByRole('textbox', { name: '来源表', exact: true }).fill(table);
  await page.getByRole('textbox', { name: '源主键列', exact: true }).fill('nid');
  await page.getByRole('textbox', { name: / 来源列$/ }).fill('nid');
  const sync = page.getByRole('button', { name: '全量同步全部来源', exact: true });
  await expect(sync).toBeDisabled();
  const declared = page.waitForResponse(r => pathOf(r.url()) === `/api/v1/ont/v2/object-types/${rid}/datasources` && r.request().method() === 'POST');
  await page.getByRole('button', { name: '保存映射', exact: true }).click();
  const declaration = await declared;
  expect(declaration.status(), 'UI source binding HTTP status').toBe(200);
  expect(declaration.request().postDataJSON()).toEqual({ class_rid: rid, name: `builder-source-${suffix}`, kind: 'pg_table', dsn_env: 'ONT_SOURCE_DSN', table, pk_column: 'nid', priority: 100, field_mapping: { [property]: 'nid' } });
  await expect(page.getByText('映射已保存并回读', { exact: true })).toBeVisible();
  await expect(sync).toBeEnabled();
  const synced = page.waitForResponse(r => pathOf(r.url()) === `/api/v1/ont/v2/object-types/${rid}/datasources/sync` && r.request().method() === 'POST');
  await sync.click();
  const syncResponse = await synced;
  expect(syncResponse.status(), 'Actual sync HTTP status').toBe(200);
  // Current full-sync client omits the optional incremental flag (backend default false).
  expect(new URL(syncResponse.url()).searchParams.has('incremental')).toBe(false);
  expect(syncResponse.request().postDataJSON()).toEqual({});
  const result = await syncResponse.json();
  expect(result).toEqual(expect.objectContaining({ ok: true, total_synced: 2, total_failed: 0, total_deleted: 0 }));
  await expect(page.getByRole('region', { name: '同步结果' }).getByRole('status').filter({ hasText: '同步完成' })).toContainText('同步完成 · 同步 2 · 失败 0');
  await expect(sync).toBeEnabled();
  const sampled = page.waitForResponse(r => pathOf(r.url()) === `/api/v1/ont/v2/object-types/${rid}/materialization`);
  await page.getByRole('button', { name: '读取物化样本', exact: true }).click();
  const sampleResponse = await sampled;
  expect(sampleResponse.status()).toBe(200);
  const sample = await sampleResponse.json();
  expect(sample.count).toBe(2);
  expect(sample.rows.map((row: Record<string, unknown>) => Object.values(row)).flat()).toEqual(expect.arrayContaining(['builder-row-a', 'builder-row-b']));
  await expect(page.locator('.mp-mapping-samples tbody tr').filter({ hasText: 'builder-row-a' })).toBeVisible();
  const queried = page.waitForResponse(r => pathOf(r.url()) === '/api/v1/ont/v2/individuals' && new URL(r.url()).searchParams.get('class_rid') === rid);
  await page.goto(`/ontology/explore/objects?class=${encodeURIComponent(rid)}`);
  const queriedResponse = await queried;
  expect(queriedResponse.status()).toBe(200);
  const queryPayload = await queriedResponse.json();
  const individuals = Array.isArray(queryPayload) ? queryPayload : queryPayload.items;
  expect(individuals).toHaveLength(2);
  expect(individuals.map((row: { class_rid: string }) => row.class_rid)).toEqual([rid, rid]);
  expect(individuals.map((row: { props: Record<string, unknown> }) => row.props[property])).toEqual(expect.arrayContaining(['builder-row-a', 'builder-row-b']));
  await expect(page.getByRole('row').filter({ hasText: 'builder-row-a' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'builder-row-b' })).toBeVisible();
  expect(writes).toEqual([
    { method: 'POST', path: '/api/v1/ont/v2/object-types/precheck' },
    { method: 'POST', path: '/api/v1/ont/v2/object-types/wip' },
    { method: 'POST', path: '/api/v1/ont/v2/object-types/validate' },
    { method: 'POST', path: `/api/v1/ont/v2/object-types/wip/${rid}/apply` },
    { method: 'POST', path: `/api/v1/ont/v2/object-types/${rid}/datasources` },
    { method: 'POST', path: `/api/v1/ont/v2/object-types/${rid}/datasources/sync` },
  ]);
});
