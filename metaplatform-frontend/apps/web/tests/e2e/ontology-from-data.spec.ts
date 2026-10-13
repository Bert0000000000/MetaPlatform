import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { decodeJwtPayload, fetchAccessToken, injectAuth } from './helpers/auth';

const gateway = process.env.E2E_GATEWAY ?? 'http://127.0.0.1:8200/api/v1';
const samples = path.resolve(import.meta.dirname, '../../public/modeling-samples');

async function confirmPublication(page: Page) {
  await page.getByRole('button', {name: '发布本体', exact: true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', {name: '确认发布本体', exact: true})).toBeEnabled();
  await dialog.getByRole('button', {name: '校验发布方案', exact: true}).click();
  await expect(dialog.getByText('发布方案校验通过，请核对操作及属性对应后确认发布。')).toBeVisible();
  await dialog.getByRole('button', {name: '确认发布本体', exact: true}).click();
  await expect(dialog).not.toBeVisible();
}

async function reviewTab(page: Page, label: string) {
  await page.getByRole('navigation', { name: '逆向发现本体流程', exact: true }).getByRole('button', { name: /候选匹配与合并确认/ }).click();
  await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click();
  await expect(page.getByRole('tab', { name: new RegExp(`^${label}`) })).toHaveAttribute('aria-selected', 'true');
}

async function openClass(page: Page, name: string) {
  await reviewTab(page, '对象类型');
  await page.getByRole('button', { name: `审核${name}`, exact: true }).click();
}

async function confirmReview(page: Page, objects: number, mappings: number, relationships: number) {
  for (const [tab, kind, count] of [['对象类型', '对象', objects], ['数据映射', '映射', mappings], ['业务关系', '关系', relationships]] as const) {
    await reviewTab(page, tab);
    if (!count) continue;
    await page.getByRole('button', { name: `全部确认${kind}`, exact: true }).click();
    if (kind !== '映射') await page.getByRole('dialog').getByRole('button', { name: /^确认所选 \d+ 项$/ }).click();
    const checks = page.getByRole('tabpanel').getByRole('checkbox', { name: new RegExp(`^确认${kind} `) });
    await expect(checks).toHaveCount(count);
    for (const checkbox of await checks.all()) await expect(checkbox).toBeChecked();
  }
}

async function syncReviewedData(page: Page, repeat = false) {
  const checked = page.waitForResponse(r => r.url().endsWith('/sync-check') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /^(检查本次数据|重新检查数据)$/ }).click();
  expect((await checked).ok()).toBeTruthy();
  await page.getByRole('checkbox', { name: '我已确认同步范围，写入正式实例', exact: true }).press('Space');
  const synced = page.waitForResponse(r => r.url().endsWith('/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: repeat ? '重新同步本次数据' : '开始同步', exact: true }).click();
  const response = await synced;
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  const authorization = response.request().headers()['authorization'];
  expect(authorization).toBeTruthy();
  await expect.poll(async () => {
    const latest = await page.request.get(response.url().replace(/\/sync$/, ''), {
      headers: { Authorization: authorization },
    });
    expect(latest.ok()).toBeTruthy();
    const current = await latest.json();
    const sync = current.sync;
    if (Date.parse(sync.startedAt) < Date.parse(result.sync.startedAt)) return 'previous sync';
    return sync.status === 'failed' ? `failed: ${sync.error}` : sync.status;
  }, { timeout: 60_000, intervals: [250, 500, 1000], message: 'The newly requested sync must complete successfully' }).toBe('succeeded');
  await expect(page.getByRole('heading', { name: '同步结果 · 已完成', exact: true })).toBeVisible({ timeout: 60_000 });
}

test('普通用户令牌不包含管理员角色且不能上传建模来源', async ({ request }) => {
  const token = await fetchAccessToken(request, { username: 'metaplatform', password: 'metaplatform' });
  expect(decodeJwtPayload(token).realm_access?.roles).toContain('user');
  expect(decodeJwtPayload(token).realm_access?.roles).not.toContain('PLATFORM_ADMIN');
  const fs = await import('node:fs/promises');
  const response = await request.post(`${gateway}/ont/v2/modeling/sources`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { file: { name: 'manufacturing.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await fs.readFile(path.join(samples, 'manufacturing.xlsx')) } },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).detail).toBe('数据建模修改需要管理员权限');
});

test('统一审核 → 暂缓无效关系 → 保存重开 → 所选图谱及原生发布一致', async ({ page, context, request }) => {
  const token = await injectAuth(context, page);
  expect(decodeJwtPayload(token).realm_access?.roles).toContain('PLATFORM_ADMIN');
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = `scope${Date.now().toString(36)}`;
  const fs = await import('node:fs/promises');
  const response = await request.post(`${gateway}/ont/v2/modeling/sources`, { headers, multipart: { file: { name: 'manufacturing.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await fs.readFile(path.join(samples, 'manufacturing.xlsx')) } } });
  expect(response.status()).toBe(201);
  const source = await response.json();
  const endpoint = `${gateway}/ont/v2/modeling/sources/${source.id}`;
  const draft = { schemaVersion: 2, name: '范围验收', classes: [{ id: prefix, name: `物料-${prefix}`, properties: [{ id: 'code', name: '物料编码', dataType: 'text' }], identity: ['code'], identityStatus: 'proposed', identityReason: '物料主数据中编码唯一', labelProperty: 'code', accepted: false }], mappings: [], relationships: [{ id: `${prefix}-later`, name: '待完善关系', source: prefix, target: prefix, joins: [{ sourceProperty: 'code', targetProperty: 'code' }], cardinalityStatus: 'proposed', targetSelection: 'entity', cardinality: 'N:1', accepted: false }], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } };
  expect((await request.put(endpoint, { headers, data: { revision: source.revision, draft } })).ok()).toBeTruthy();
  await page.goto(`/ontology/model/from-data?source=${source.id}`);
  await page.getByRole('button', { name: '全部确认对象', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('物料主数据中编码唯一');
  await page.getByRole('button', { name: '确认所选 1 项', exact: true }).click();
  await reviewTab(page, '对象类型');
  await expect(page.getByRole('checkbox', { name: `确认对象 物料-${prefix}`, exact: true })).toBeChecked();
  await reviewTab(page, '业务关系');
  await expect(page.getByRole('checkbox', { name: '确认关系 待完善关系', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '审核待完善关系', exact: true }).click();
  await page.getByRole('region', { name: '关系 待完善关系', exact: true }).getByRole('button', { name: '本次暂不发布', exact: true }).click();
  await page.getByRole('button', { name: '保留候选，暂不发布', exact: true }).click();
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '已保存', exact: true })).toBeVisible();
  await page.reload();
  await reviewTab(page, '业务关系');
  await page.getByRole('button', { name: '审核待完善关系', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复本次发布', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('region', { name: '暂缓候选', exact: true })).toContainText('待完善关系');
  const graph = page.getByLabel('候选本体图谱', { exact: true });
  await expect(graph.getByRole('button', { name: `查看本体类 物料-${prefix}`, exact: true })).toBeVisible();
  await expect(graph.getByText(/待完善关系/)).toHaveCount(0);
  await page.getByRole('button', { name: '查看发布方案', exact: true }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  const result = await (await request.get(endpoint, { headers })).json();
  expect(result.draft.relationships).toHaveLength(1);
  expect(result.draft.relationships[0].included).toBe(false);
  expect(result.plan.relationships).toHaveLength(0);
  expect(result.publication.acceptance.status).toBe('passed');
});

test('真实来源 → 人工候选审核 → 原生发布 → 重复同步 → 对象探索', async ({ page, context, request }) => {
  // Real AI generation is a separate business acceptance: this case fixes the candidate
  // so that model nondeterminism cannot hide publication, identity or UI regressions.
  const token = await injectAuth(context, page);
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = `ui${Date.now().toString(36)}`;
  await page.goto('/ontology/model/from-data');
  await expect(page.getByRole('heading', { name: '逆向发现本体', exact: true })).toBeVisible();
  const uploaded = page.waitForResponse(r => r.url().endsWith('/modeling/sources') && r.request().method() === 'POST');
  await page.getByLabel('上传 Excel 文件').setInputFiles(path.join(samples, 'manufacturing.xlsx'));
  const response = await uploaded;
  expect(response.status(), await response.text()).toBe(201);
  const source = await response.json();
  await expect(page).toHaveURL(new RegExp(`source=${source.id}`));
  await expect(page.getByRole('heading', { name: '数据画像' })).toBeVisible();
  await page.getByLabel('业务背景').fill('制造齐套：物料与库存业务对象及关系');
  const saved = page.waitForResponse(r => r.url().endsWith(`/modeling/sources/${source.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存修改' }).click();
  expect((await saved).ok()).toBeTruthy();
  const fresh = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  const cls = (id: string, name: string, properties: Array<[string, string, string]>, identity: string[]) => ({ id: `${prefix}-${id}`, name: `${name}-${prefix}`, description: name, properties: properties.map(([pid, pname, type]) => ({ id: pid, name: pname, dataType: type })), identity, labelProperty: properties[0][0], accepted: false });
  const material = cls('material', '物料', [['code', '物料编码', 'text'], ['name', '物料名称', 'text']], ['code']);
  const inventory = cls('inventory', '库存', [['code', '物料编码', 'text'], ['warehouse', '仓库', 'text'], ['quantity', '可用量', 'number']], ['code', 'warehouse']);
  const draft = { schemaVersion: 2, name: '浏览器验收候选', classes: [material, inventory], mappings: [
    { id: 'master', classId: material.id, sheet: '物料', bindings: { code: '物料编码', name: '物料名称' }, reason: '主数据', accepted: false },
    { id: 'material_inventory', classId: material.id, sheet: '库存', bindings: { code: '物料编码', name: '物料名称' }, reason: '跨表同物料', accepted: false },
    { id: 'stock', classId: inventory.id, sheet: '库存', bindings: { code: '物料编码', warehouse: '仓库', quantity: '可用量' }, reason: '一表多类、复合身份', accepted: false },
  ], relationships: [{ id: `${prefix}-stock_material`, name: '库存所属物料', source: inventory.id, target: material.id, joins: [{ sourceProperty: 'code', targetProperty: 'code' }], reason: '库存属于编码一致的物料', accepted: false }], instances: [], instanceEdits: [], links: [], notes: ['缺少供应商与交期，不能回答到货问题'], semantics: { context: fresh.context, questions: fresh.questions, definitions: [] } };
  for (const type of draft.classes) Object.assign(type, { identityStatus: 'proposed', identityReason: '业务主数据定义该编码在对应粒度内唯一', grain: type.id === material.id ? '一个物料' : '一个物料在一个仓库的库存余额' });
  Object.assign(draft.relationships[0], { cardinality: 'N:1', cardinalityStatus: 'proposed', cardinalityReason: '一个库存余额属于一个物料', targetSelection: 'entity' });
  const candidate = await request.put(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers, data: { revision: fresh.revision, draft, context: fresh.context, questions: fresh.questions, resolutions: {} } });
  expect(candidate.ok(), await candidate.text()).toBeTruthy();
  await page.reload();
  await openClass(page, `物料-${prefix}`);
  await page.getByRole('button', { name: '修改稳定标识', exact: true }).click();
  material.id = `${prefix}-material-renamed`;
  await page.getByRole('textbox', { name: '新的稳定模型标识' }).fill(material.id);
  await page.getByRole('button', { name: '修改标识及引用' }).click();
  await expect(page.getByRole('textbox', { name: '新的稳定模型标识' })).not.toBeVisible();
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '业务名称' })).toHaveCount(0);
  await page.getByRole('button', { name: '全部确认对象', exact: true }).click();
  await page.getByRole('button', { name: /^确认所选 \d+ 项$/ }).click();
  await page.getByRole('button', { name: '取消确认对象', exact: true }).click();
  await expect(page.getByRole('tabpanel').getByRole('checkbox')).toHaveCount(2);
  for (const checkbox of await page.getByRole('tabpanel').getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
  await confirmReview(page, 2, 3, 1);
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本体结构校验与接入预览', exact: true })).toBeVisible();
  const graph = page.getByLabel('候选本体图谱', { exact: true });
  await expect(graph.getByRole('button', { name: `查看本体类 物料-${prefix}` })).toBeVisible();
  const stockRelation = graph.getByRole('button', { name: '查看关系 库存所属物料 · N:1', exact: true });
  await stockRelation.press('Enter');
  await expect(stockRelation.locator('text')).toHaveText('库存所属物料 · N:1');
  await expect(stockRelation.locator('text')).toBeVisible();
  await graph.getByRole('button', { name: `查看本体类 库存-${prefix}` }).click();
  await expect(graph.getByLabel('候选模型详情')).toContainText('一个物料在一个仓库的库存余额');
  await graph.getByRole('button', { name: '适应本体图' }).click();
  await page.getByText('可选：实例样本', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '对象与关系预览' })).toBeVisible();
  const verified = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  expect(verified.validation.dataValidation.counts).toMatchObject({ nodes: 5, edges: 3, classes: 2 });
  expect(verified.validation.errors).toBe(0);
  await expect(page.getByRole('cell', { name: `库存-${prefix}`, exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '查看发布方案' }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  await expect(page.getByText('原生定义与已审核发布方案一致', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新核验原生定义' }).click();
  await expect(page.getByText('原生定义与已审核发布方案一致', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '同步本次数据', exact: true }).click();
  await syncReviewedData(page);
  await syncReviewedData(page, true);
  const synced = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  expect(synced.sync.links).toBe(3);
  expect(synced.publication.acceptance.status).toBe('passed');
  expect(synced.plan.relationships[0].payload.cardinality).toBe('N:1');
  for (const type of synced.plan.types) {
    const instances = await request.get(`${gateway}/ont/v2/individuals`, { headers, params: { class_rid: type.rid } });
    expect(instances.ok()).toBeTruthy();
    const rows = await instances.json();
    expect(rows).toHaveLength(type.classId === material.id ? 2 : 3);
  }
  await page.getByRole('link', { name: '查看实例', exact: true }).first().click();
  await expect(page).toHaveURL(/\/ontology\/explore\/objects/);
  await expect(page.getByRole('heading', { name: '对象浏览', exact: true })).toBeVisible();
});

test('390px 独立入口可访问且保留正向建模入口', async ({ page, context }) => {
  await injectAuth(context, page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ontology/model/from-data');
  await expect(page.getByRole('heading', { name: '逆向发现本体', exact: true })).toBeVisible();
  const dimensions = await page.locator('.fd-page').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  await page.goto('/ontology/model/object-types');
  await expect(page.getByRole('button', { name: '新建本体', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '逆向发现本体', exact: true })).toBeVisible();
});

test('客户订单跨表复用与复合行身份 → 发布同步 → 原生数量一致', async ({ page, context, request }) => {
  const token = await injectAuth(context, page);
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = `sales${Date.now().toString(36)}`;
  await page.goto('/ontology/model/from-data');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/modeling/sources') && r.request().method() === 'POST');
  await page.getByLabel('上传 Excel 文件').setInputFiles(path.join(samples, 'sales.xlsx'));
  const response = await uploaded;
  expect(response.status(), await response.text()).toBe(201);
  const source = await response.json();
  await expect(page.getByRole('heading', { name: '数据画像' })).toBeVisible();
  const classId = (name: string) => `${prefix}-${name}`;
  const prop = (id: string, name: string, dataType = 'text') => ({ id, name, dataType });
  const cls = (id: string, name: string, properties: ReturnType<typeof prop>[], identity: string[]) => ({ id: classId(id), name: `${name}-${prefix}`, description: name, properties, identity, identityStatus: 'proposed', identityReason: '测试业务规则：指定字段在对象业务粒度内唯一', labelProperty: properties[0].id, accepted: false });
  const mapping = (id: string, className: string, sheet: string, bindings: Record<string, string>) => ({ id, classId: classId(className), sheet, bindings, reason: '明确来源和业务粒度', accepted: false });
  const relation = (id: string, name: string, from: string, to: string, fromProp: string, toProp: string) => ({ id: `${prefix}-${id}`, name, source: classId(from), target: classId(to), joins: [{ sourceProperty: fromProp, targetProperty: toProp }], reason: '明确业务关系与字段关联', cardinality: 'N:1', cardinalityStatus: 'proposed', cardinalityReason: '订单引用一个客户，订单行引用一个订单或商品', targetSelection: 'entity', accepted: false });
  const draft = { schemaVersion: 2, name: '客户订单验收候选', classes: [
    cls('customer', '客户', [prop('code', '客户号'), prop('name', '客户名称')], ['code']),
    cls('order', '订单', [prop('code', '订单号'), prop('customer', '客户号')], ['code']),
    cls('line', '订单行', [prop('order', '订单号'), prop('line', '行号', 'number'), prop('product', '商品号'), prop('quantity', '数量', 'number')], ['order', 'line']),
    cls('product', '商品', [prop('code', '商品号'), prop('name', '商品名称')], ['code']),
  ], mappings: [mapping('customers', 'customer', '客户', { code: '客户号', name: '客户名称' }), mapping('order_customers', 'customer', '订单', { code: '客户号', name: '客户名称' }), mapping('orders', 'order', '订单', { code: '订单号', customer: '客户号' }), mapping('lines', 'line', '订单行', { order: '订单号', line: '行号', product: '商品号', quantity: '数量' }), mapping('products', 'product', '订单行', { code: '商品号', name: '商品名称' })],
  relationships: [relation('customer_order', '订单所属客户', 'order', 'customer', 'customer', 'code'), relation('line_order', '订单行所属订单', 'line', 'order', 'order', 'code'), relation('line_product', '订单行对应商品', 'line', 'product', 'product', 'code')], instances: [], instanceEdits: [], links: [], notes: ['缺配送和签收数据，不能回答签收时间'], semantics: { context: '客户、订单和订单行粒度不同', questions: [{ id: 'q1', question: 'O01何时签收？', expected: '无法回答，缺配送数据' }], definitions: [] } };
  const saved = await request.put(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers, data: { revision: source.revision, draft, context: draft.semantics.context, questions: draft.semantics.questions, resolutions: {} } });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  await page.reload();
  await confirmReview(page, 4, 5, 3);
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本体结构校验与接入预览', exact: true })).toBeVisible();
  await page.getByText('可选：实例样本', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '对象与关系预览' })).toBeVisible();
  const verified = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  expect(verified.validation.dataValidation.counts).toMatchObject({ nodes: 11, edges: 11, classes: 4 });
  expect(verified.validation.errors).toBe(0);
  await page.getByRole('button', { name: '查看发布方案' }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '同步本次数据', exact: true }).click();
  await syncReviewedData(page);
  const synced = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  const expected: Record<string, number> = { [classId('customer')]: 2, [classId('order')]: 3, [classId('line')]: 4, [classId('product')]: 2 };
  for (const type of synced.plan.types) {
    const instances = await request.get(`${gateway}/ont/v2/individuals`, { headers, params: { class_rid: type.rid } });
    expect(instances.ok()).toBeTruthy();
    expect(await instances.json()).toHaveLength(expected[type.classId]);
  }
  expect(synced.sync.links).toBe(11);
});

test('三级设备分类经表单继承与父标识重命名 → 原生父查询包含叶实例', async ({ page, context, request }) => {
  const token = await injectAuth(context, page);
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = `h${Date.now().toString(36)}`;
  await page.goto('/ontology/model/from-data');
  const uploaded = page.waitForResponse(r => r.url().endsWith('/modeling/sources') && r.request().method() === 'POST');
  await page.getByLabel('上传 Excel 文件').setInputFiles(path.join(samples, 'equipment.xlsx'));
  const response = await uploaded;
  expect(response.status(), await response.text()).toBe(201);
  const source = await response.json();
  const code = { id: 'equipment_code', name: '设备编号', dataType: 'text' };
  const rootId = `${prefix}-equipment`, machineId = `${prefix}-machine`, leafId = `${prefix}-cnc`;
  const rootName = `设备-${prefix}`, machineName = `机床-${prefix}`, leafName = `数控机床-${prefix}`;
  const draft = { schemaVersion: 2, name: '三级设备分类验收', classes: [
    { id: leafId, name: leafName, description: '由数控系统控制加工的机床', properties: [code, { id: 'control', name: '控制系统', dataType: 'text' }, { id: 'axes', name: '轴数', dataType: 'number' }], identity: ['equipment_code'], identityStatus: 'proposed', identityReason: '设备主数据以设备编号唯一识别设备，父子类共用编号', labelProperty: 'equipment_code', accepted: false, parentClassId: null, inheritanceReason: '' },
    { id: rootId, name: rootName, description: '可独立编号管理的生产设备', properties: [code, { id: 'name', name: '设备名称', dataType: 'text' }, { id: 'brand', name: '品牌', dataType: 'text' }], identity: ['equipment_code'], identityStatus: 'proposed', identityReason: '设备主数据以设备编号唯一识别设备，父子类共用编号', labelProperty: 'name', accepted: false, parentClassId: null, inheritanceReason: '' },
    { id: machineId, name: machineName, description: '用于加工的设备', properties: [{ id: 'method', name: '加工方式', dataType: 'text' }], identity: ['method'], identityStatus: 'proposed', identityReason: '选择父类后以继承的设备编号识别设备', labelProperty: 'method', accepted: false, parentClassId: null, inheritanceReason: '' },
  ], mappings: [{ id: 'cnc_only', classId: leafId, sheet: '数控机床', bindings: { equipment_code: '设备编号', name: '设备名称', brand: '品牌', method: '加工方式', control: '控制系统', axes: '轴数' }, reason: '类型分类表仅作证据，每台设备仅映射到叶类', accepted: false }], relationships: [], instances: [], instanceEdits: [], links: [], notes: ['没有维修记录，无法回答最近维修时间'], semantics: { context: '数控机床是一种机床，机床是一种设备；统一设备编号，父分类不复制实例', questions: [], definitions: [] } };
  const saved = await request.put(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers, data: { revision: source.revision, draft, context: draft.semantics.context, questions: [], resolutions: {} } });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  await page.goto(`/ontology/model/from-data?source=${source.id}`);
  await openClass(page, machineName);
  await page.getByRole('combobox', { name: `${machineName} 父类`, exact: true }).selectOption(rootId);
  await page.getByRole('textbox', { name: `${machineName} 继承依据`, exact: true }).fill('类型分类表明确机床是一种设备');
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await openClass(page, leafName);
  await page.getByRole('combobox', { name: `${leafName} 父类`, exact: true }).selectOption(machineId);
  await page.getByRole('textbox', { name: `${leafName} 继承依据`, exact: true }).fill('类型分类表明确数控机床是一种机床');
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await page.getByText('查看概念层次', { exact: true }).click();
  await expect(page.getByText('第 3 层', { exact: true })).toBeVisible();
  // Rename the root after building the hierarchy: the middle parent reference must follow.
  await openClass(page, rootName);
  await page.getByRole('button', { name: '修改稳定标识', exact: true }).click();
  const renamedRoot = `${prefix}-asset`;
  await page.getByRole('textbox', { name: '新的稳定模型标识' }).fill(renamedRoot);
  await page.getByRole('button', { name: '修改标识及引用' }).click();
  await expect(page.getByRole('textbox', { name: '新的稳定模型标识' })).not.toBeVisible();
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await openClass(page, machineName);
  await expect(page.getByRole('combobox', { name: `${machineName} 父类`, exact: true })).toHaveValue(renamedRoot);
  await page.getByRole('button', { name: '完成查看', exact: true }).click();
  await confirmReview(page, 3, 1, 0);
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本体结构校验与接入预览', exact: true })).toBeVisible();
  const graph = page.getByLabel('候选本体图谱', { exact: true });
  await expect(graph.getByText('继承', { exact: true })).toHaveCount(2);
  await graph.getByRole('button', { name: `查看本体类 ${leafName}` }).dblclick();
  await expect(graph.getByLabel('候选模型详情')).toContainText(`父类：${machineName}`);
  await page.getByText('可选：实例样本', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '对象与关系预览' })).toBeVisible();
  const verified = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  expect(verified.validation.dataValidation.counts).toMatchObject({ nodes: 2, edges: 0, classes: 3 });
  expect(verified.draft.classes.find((item: { id: string }) => item.id === leafId).properties.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(['equipment_code', 'name', 'brand', 'method', 'control', 'axes']));
  await page.getByRole('button', { name: '查看发布方案' }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '同步本次数据', exact: true }).click();
  await syncReviewedData(page);
  const synced = await (await request.get(`${gateway}/ont/v2/modeling/sources/${source.id}`, { headers })).json();
  expect(synced.sync.types.map((item: { total_synced: number }) => item.total_synced)).toEqual([0, 0, 2]);
  for (const [index, type] of synced.plan.types.entries()) {
    const native = await (await request.get(`${gateway}/ont/v2/object-types/${encodeURIComponent(type.rid)}`, { headers })).json();
    expect(native.parent_class || '').toBe(index ? synced.plan.types[index - 1].rid : '');
    const instances = await (await request.get(`${gateway}/ont/v2/individuals`, { headers, params: { class_rid: type.rid } })).json();
    expect(instances).toHaveLength(2);
    expect(instances.every((item: { class_rid: string }) => item.class_rid === synced.plan.types[2].rid)).toBeTruthy();
  }
});

test('缺失身份仍可发布本体 → 同步受阻 → 补齐来源复用模型 → 重复同步', async ({ page, context, request }) => {
  const token = await injectAuth(context, page);
  const headers = { Authorization: `Bearer ${token}` };
  const fixtures = path.resolve(import.meta.dirname, '../fixtures');
  const fs = await import('node:fs/promises');
  const cid = `repair-${Date.now().toString(36)}`;
  const draft = { schemaVersion: 2, name: '身份修正验收', classes: [{ id: cid, name: `验收对象-${cid}`, description: '编号为业务身份，当前来源可能未填写', properties: [{ id: 'code', name: '编号', dataType: 'text' }, { id: 'name', name: '名称', dataType: 'text' }], identity: ['code'], labelProperty: 'name', accepted: true }], mappings: [{ id: 'items', classId: cid, sheet: 'Items', bindings: { code: 'Code', name: 'Name' }, reason: '测试来源映射', accepted: true }], relationships: [], instances: [], instanceEdits: [], links: [], notes: [], semantics: { context: '', questions: [], definitions: [] } };
  const upload = async (filename: string) => {
    const response = await request.post(`${gateway}/ont/v2/modeling/sources`, { headers, multipart: { file: { name: filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await fs.readFile(path.join(fixtures, filename)) } } });
    expect(response.status()).toBe(201); return response.json();
  };
  let source = await upload('modeling-missing-identity.xlsx');
  let endpoint = `${gateway}/ont/v2/modeling/sources/${source.id}`;
  let response = await request.put(endpoint, { headers, data: { revision: source.revision, draft, context: '', questions: [], resolutions: {} } });
  expect(response.ok()).toBeTruthy(); source = await response.json();
  await page.goto(`/ontology/model/from-data?source=${source.id}`);
  await reviewTab(page, '对象类型');
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本体结构校验与接入预览', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看发布方案', exact: true }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '同步本次数据', exact: true }).click();
  const blockedCheck = page.waitForResponse(r => r.url().endsWith('/sync-check') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '检查本次数据', exact: true }).click();
  const checkedResponse = await blockedCheck;
  expect(checkedResponse.ok()).toBeTruthy();
  const blockedReport = (await checkedResponse.json()).syncCheck;
  expect(blockedReport.canSync).toBe(false);
  expect(blockedReport.report.errors).toBe(2);
  await expect(page.getByText('当前还不能同步实例', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 分析批量修复', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  source = await (await request.get(endpoint, { headers })).json();
  expect(source.validation.canPublish).toBeTruthy();
  expect(source.validation.dataValidation.errors).toBe(2);
  const deniedSync = await request.post(endpoint + '/sync', { headers, data: { revision: source.revision } });
  expect(deniedSync.status()).toBe(422);
  expect((await deniedSync.json()).detail).toContain('数据校验尚未通过');
  const target = source.plan.types[0];
  let individuals = await (await request.get(`${gateway}/ont/v2/individuals?class_rid=${encodeURIComponent(target.rid)}&limit=100&offset=0`, { headers })).json();
  expect(individuals).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole('navigation', { name: '逆向发现本体流程', exact: true }).getByRole('button', { name: /数据同步（可选）/ })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('navigation', { name: '逆向发现本体流程', exact: true }).getByRole('button', { name: /本体发布与验收/ }).click();
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();

  source = await upload('modeling-repaired-identity.xlsx'); endpoint = `${gateway}/ont/v2/modeling/sources/${source.id}`;
  response = await request.put(endpoint, { headers, data: { revision: source.revision, draft, context: '', questions: [], resolutions: { [cid]: { mode: 'reuse', targetRid: target.rid, propertyMap: target.propertyMap } } } });
  expect(response.ok()).toBeTruthy(); source = await response.json();
  await page.goto(`/ontology/model/from-data?source=${source.id}`);
  await reviewTab(page, '对象类型');
  await page.getByRole('button', { name: '校验并预览', exact: true }).click();
  await page.getByRole('button', { name: '查看发布方案', exact: true }).click();
  await confirmPublication(page);
  await expect(page.getByText('本次所选本体已发布', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '同步本次数据', exact: true }).click();
  await syncReviewedData(page);
  await syncReviewedData(page, true);
  individuals = await (await request.get(`${gateway}/ont/v2/individuals?class_rid=${encodeURIComponent(target.rid)}&limit=100&offset=0`, { headers })).json();
  expect(individuals).toHaveLength(2);
});
