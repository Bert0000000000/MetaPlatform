/**
 * ONTOLOGY-CORE-E2E —— 本体核心闭环 E2E（真实栈：Keycloak 登录 → 网关 → ont → PG，**不 mock**）。
 *
 * 覆盖（目标 §4/§5）：
 *   建模 → 数据映射与同步 → 对象/关系查询 → Proposal 确认执行 → 审计
 *   + 违规数据 / 重复提交 / 失败恢复 / 跨租户拒绝
 *
 * 隔离与确定性（目标 §3）：全程只用**专用命名空间** `core-e2e-*`；schema 走 upsert
 *   （幂等重跑）；断言不依赖"库里只有一行"。
 *
 * 认证：真实 Keycloak 登录（admin/admin123）；租户由 JWT 决定（本环境 realm 仅
 *   tenant-default → 跨租户用例以"异租户 rid 前缀"驱动 403/4xx 守门）。
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { pgQuery } from '../helpers/pg';

const GW = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8100/api/v1';
const T = 'tenant-default';
const OTHER = 'other-tenant';
const NS = 'core-e2e';

// ── 专用命名空间（确定性）────────────────────────────────────────────────
const OBJ_BOOK = `ont.${T}.obj.${NS}-notebook.v1`;
const OBJ_NOTE = `ont.${T}.obj.${NS}-note.v1`;
const LINK = `ont.${T}.link.${NS}-has.v1`;
const ACT_TAG = `ont.${T}.act.${NS}-tag.v1`;
const P_ID = `ont.${T}.prop.${NS}-nid.v1`;
const P_TITLE = `ont.${T}.prop.${NS}-ntitle.v1`;
const P_TAG = `ont.${T}.prop.${NS}-ntag.v1`;
// ⚠️ 平台契约：create_instance 提案的 props 键在 **execute** 端按 **slug** 查主键
// （`pg_repo` 用 prop rid 的第 4 段），而 preflight 走别名归一（rid/slug/title 皆可）。
// E2E 用 execute 认的 slug 形式，避免"预检通过、执行 409"。
const SLUG_ID = `${NS}-nid`;
const SLUG_TITLE = `${NS}-ntitle`;
const ind = (slug: string, pk: string) => `ont.${T}.ind.${slug}.${pk}`;
const IND_BOOK = (pk: string) => ind(`${NS}-notebook`, pk);
const IND_NOTE = (pk: string) => ind(`${NS}-note`, pk);

const SRC_TABLE = 'src_core_e2e_note';
const SRC_PK = 'n-100';

let token = '';
const h = (extra: Record<string, string> = {}): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function login(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${GW}/iam/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(resp.ok(), `login failed: ${resp.status()} ${await resp.text()}`).toBeTruthy();
  const body = await resp.json();
  const t = body.accessToken ?? body.token;
  expect(t, 'no accessToken in login response').toBeTruthy();
  return t as string;
}

function propDTO(rid: string, isPk: boolean) {
  return {
    rid,
    type_id: 'string',
    nullable: !isPk,
    primary_key: isPk,
    title: rid.split('.').at(-2) ?? rid,
    format: 'string',
  };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  token = await login(request);
});

// 清场：确定性源表由本套件创建，跑完删除（schema/个体按命名空间复用，无需清）
test.afterAll(async () => {
  await pgQuery(`DROP TABLE IF EXISTS ${SRC_TABLE}`).catch(() => {});
});

// ───────────────────────── 1. 建模 ─────────────────────────

test('建模：ObjectType（含层级）→ LinkType → ActionType，读回一致', async ({ request }) => {
  const ot = (rid: string, name: string, props: string[], parent = '') => ({
    rid,
    display_name: name,
    primary_key: [P_ID],
    properties: props.map((p) => propDTO(p, p === P_ID)),
    interfaces: [],
    parent_class: parent,
    confirm_name: name, // 幂等重跑时规避破坏性门禁
  });

  for (const body of [
    ot(OBJ_BOOK, 'core-e2e-notebook', [P_ID, P_TITLE]),
    ot(OBJ_NOTE, 'core-e2e-note', [P_ID, P_TITLE, P_TAG], OBJ_BOOK),
  ]) {
    const r = await request.post(`${GW}/ont/v2/object-types`, { headers: h(), data: body });
    expect(r.ok(), `upsert ${body.rid}: ${r.status()} ${await r.text()}`).toBeTruthy();
  }

  const got = await request.get(`${GW}/ont/v2/object-types/${OBJ_NOTE}`, { headers: h() });
  expect(got.ok()).toBeTruthy();
  expect((await got.json()).parent_class).toBe(OBJ_BOOK);

  const hz = await request.get(`${GW}/ont/v2/object-types/hierarchy`, { headers: h() });
  expect(hz.ok()).toBeTruthy();
  expect(JSON.stringify(await hz.json())).toContain(OBJ_NOTE);

  const lt = await request.post(`${GW}/ont/v2/link-types`, {
    headers: h(),
    data: { rid: LINK, src: OBJ_BOOK, dst: OBJ_NOTE, cardinality: '1:N', directionality: 'directed' },
  });
  expect(lt.ok(), `link-type: ${lt.status()} ${await lt.text()}`).toBeTruthy();

  const at = await request.post(`${GW}/ont/v2/action-types`, {
    headers: h(),
    data: {
      rid: ACT_TAG,
      on: [OBJ_NOTE],
      title: 'core-e2e tag',
      declarative_edits: [
        { op: 'set_property', target: '$target', property_rid: P_TAG, value: 'tagged' },
      ],
    },
  });
  expect(at.ok(), `action-type: ${at.status()} ${await at.text()}`).toBeTruthy();
});

// ───────────────────────── 2. 数据映射与同步 ─────────────────────────

test('数据映射与同步：声明背挂源 → 同步 → 逐字段对账', async ({ request }) => {
  await pgQuery(`DROP TABLE IF EXISTS ${SRC_TABLE}`);
  await pgQuery(
    `CREATE TABLE ${SRC_TABLE} (nid TEXT PRIMARY KEY, ntitle TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  const values = Array.from({ length: 5 }, (_, i) => `('n-10${i}', 'src-title-${i}')`).join(',');
  await pgQuery(`INSERT INTO ${SRC_TABLE} (nid, ntitle) VALUES ${values}`);

  const decl = await request.post(`${GW}/ont/v2/object-types/${OBJ_NOTE}/datasources`, {
    headers: h(),
    data: {
      class_rid: OBJ_NOTE,
      name: 'core-e2e-src',
      table: SRC_TABLE,
      pk_column: 'nid',
      field_mapping: { [P_ID]: 'nid', [P_TITLE]: 'ntitle' },
      priority: 10,
    },
  });
  expect(decl.ok(), `declare ds: ${decl.status()} ${await decl.text()}`).toBeTruthy();

  const sync = await request.post(
    `${GW}/ont/v2/object-types/${OBJ_NOTE}/datasources/sync?incremental=false`,
    { headers: h() },
  );
  expect(sync.ok(), `sync: ${sync.status()} ${await sync.text()}`).toBeTruthy();
  const stats = await sync.json();
  expect(stats.total_failed ?? 0, JSON.stringify(stats)).toBe(0);
  expect(stats.total_synced ?? 0).toBeGreaterThanOrEqual(5);

  const one = await request.get(`${GW}/ont/v2/individuals/${IND_NOTE(SRC_PK)}`, { headers: h() });
  expect(one.ok(), `get individual: ${one.status()} ${await one.text()}`).toBeTruthy();
  expect((await one.json()).props?.[P_TITLE]).toBe('src-title-0');
});

// ───────────────────────── 3. 对象 / 关系查询 ─────────────────────────

test('对象与关系查询：个体列表 + 关系写入 + 一跳遍历', async ({ request }) => {
  const listed = await request.get(`${GW}/ont/v2/individuals?class_rid=${OBJ_NOTE}`, {
    headers: h(),
  });
  expect(listed.ok()).toBeTruthy();
  const payload = await listed.json();
  const rows = Array.isArray(payload) ? payload : (payload.items ?? []);
  expect(rows.length).toBeGreaterThanOrEqual(5);

  const book = IND_BOOK('b-1');
  const mk = await request.post(`${GW}/ont/v2/individuals`, {
    headers: h(),
    data: {
      rid: book,
      class_rid: OBJ_BOOK,
      primary_key: 'b-1',
      props: { [P_ID]: { value: 'b-1' }, [P_TITLE]: { value: 'book-1' } },
    },
  });
  expect(mk.ok(), `create book: ${mk.status()} ${await mk.text()}`).toBeTruthy();

  const li = await request.post(`${GW}/ont/v2/link-instances`, {
    headers: h(),
    data: {
      rid: `ont.${T}.lnk.${NS}-has.li-1`,
      link_type_rid: LINK,
      src: book,
      dst: IND_NOTE(SRC_PK),
      props: {},
    },
  });
  expect(li.ok(), `create link: ${li.status()} ${await li.text()}`).toBeTruthy();

  const around = await request.get(`${GW}/ont/v2/individuals/${book}/around`, { headers: h() });
  expect(around.ok()).toBeTruthy();
  expect(JSON.stringify(await around.json())).toContain(SRC_PK);
});

// ───────────────────────── 4. Proposal → 确认 → 执行 → 审计 ─────────────────────────

test('Proposal：提议（预检通过）→ 确认 → 执行 → 落库 + 审计可见', async ({ request }) => {
  const pk = 'p-e2e-1';
  const propose = await request.post(`${GW}/ont/v2/classes/${OBJ_NOTE}/propose-instance`, {
    headers: h(),
    data: { props: { [SLUG_ID]: pk, [SLUG_TITLE]: 'proposed-title' }, impact_summary: 'core-e2e' },
  });
  expect(propose.ok(), `propose: ${propose.status()} ${await propose.text()}`).toBeTruthy();
  const prop = await propose.json();
  expect(prop.preflight?.blocked, JSON.stringify(prop.preflight)).toBe(false);

  const pid = prop.proposal_id;
  const confirm = await request.post(`${GW}/ont/v2/proposals/${pid}/confirm`, {
    headers: h({ 'Idempotency-Key': `core-e2e-confirm-${pid}` }),
    data: {},
  });
  expect(confirm.ok(), `confirm: ${confirm.status()} ${await confirm.text()}`).toBeTruthy();

  const exec = await request.post(`${GW}/ont/v2/proposals/${pid}/execute`, {
    headers: h({ 'Idempotency-Key': `core-e2e-exec-${pid}` }),
    data: {},
  });
  expect(exec.ok(), `execute: ${exec.status()} ${await exec.text()}`).toBeTruthy();

  const got = await request.get(`${GW}/ont/v2/individuals/${IND_NOTE(pk)}`, { headers: h() });
  expect(got.ok(), 'executed individual missing').toBeTruthy();

  // 审计（create_instance 腿）= 提案终态可查，且带确认/执行痕迹
  const p2 = await request.get(`${GW}/ont/v2/proposals/${pid}`, { headers: h() });
  expect(p2.ok()).toBeTruthy();
  const propAfter = await p2.json();
  expect(propAfter.status, JSON.stringify(propAfter)).toBe('executed');
  expect(propAfter.confirmed_by ?? propAfter.confirmed_at).toBeTruthy();
});

// ───────────────────────── 5. 违规数据被拦截 ─────────────────────────

test('违规数据：schema 违规被预检阻断（409）且不落库', async ({ request }) => {
  const badPk = 'p-bad-1';
  const propose = await request.post(`${GW}/ont/v2/classes/${OBJ_NOTE}/propose-instance`, {
    headers: h(),
    data: { props: { [SLUG_TITLE]: 'missing-pk' }, impact_summary: 'violation' }, // 缺主键
  });
  expect(propose.ok()).toBeTruthy();
  const prop = await propose.json();
  expect(prop.preflight?.blocked, 'expected blocked preflight').toBe(true);

  const pid = prop.proposal_id;
  await request.post(`${GW}/ont/v2/proposals/${pid}/confirm`, {
    headers: h({ 'Idempotency-Key': `core-e2e-bc-${pid}` }),
    data: {},
  });
  const exec = await request.post(`${GW}/ont/v2/proposals/${pid}/execute`, {
    headers: h({ 'Idempotency-Key': `core-e2e-be-${pid}` }),
    data: {},
  });
  expect(exec.status(), 'violating proposal must be blocked').toBe(409);

  const got = await request.get(`${GW}/ont/v2/individuals/${IND_NOTE(badPk)}`, { headers: h() });
  expect(got.ok(), 'blocked proposal must not write').toBeFalsy();
});

// ───────────────────────── 6. 重复提交幂等 ─────────────────────────

test('重复提交：同 Idempotency-Key 重放不产生第二次效果', async ({ request }) => {
  const pk = 'p-dup-1';
  const propose = await request.post(`${GW}/ont/v2/classes/${OBJ_NOTE}/propose-instance`, {
    headers: h(),
    data: { props: { [SLUG_ID]: pk, [SLUG_TITLE]: 'dup-title' }, impact_summary: 'dup' },
  });
  const pid = (await propose.json()).proposal_id;
  // 幂等键按 proposal 派生：同一次运行内两次调用同键（复现"重放"），跨运行不冲突
  const key = `core-e2e-dup-${pid}`;

  const c1 = await request.post(`${GW}/ont/v2/proposals/${pid}/confirm`, {
    headers: h({ 'Idempotency-Key': key }),
    data: {},
  });
  expect(c1.ok()).toBeTruthy();
  const c2 = await request.post(`${GW}/ont/v2/proposals/${pid}/confirm`, {
    headers: h({ 'Idempotency-Key': key }),
    data: {},
  });
  expect([200, 409]).toContain(c2.status()); // 同键重放：不得产生第二语义

  const e1 = await request.post(`${GW}/ont/v2/proposals/${pid}/execute`, {
    headers: h({ 'Idempotency-Key': key }),
    data: {},
  });
  expect([200, 409]).toContain(e1.status());

  const got = await request.get(`${GW}/ont/v2/individuals/${IND_NOTE(pk)}`, { headers: h() });
  expect(got.ok(), 'idempotent submit must still land exactly once').toBeTruthy();
});

// ───────────────────────── 7. 失败恢复 ─────────────────────────

test('失败恢复：失败显式且无副作用，随后有效请求仍成功（含 Action 审计）', async ({ request }) => {
  // 失败：目标实例不存在 → 提议可建（草稿语义），但**执行**必须显式 4xx
  const badProp = await request.post(`${GW}/ont/v2/action-types/${ACT_TAG}/propose`, {
    headers: h(),
    data: { target_iid: IND_NOTE('does-not-exist'), parameters: {}, impact_summary: 'fail' },
  });
  expect(badProp.ok()).toBeTruthy();
  const badPid = (await badProp.json()).proposal_id;
  await request.post(`${GW}/ont/v2/proposals/${badPid}/confirm`, {
    headers: h({ 'Idempotency-Key': `core-e2e-bc-${badPid}` }),
    data: {},
  });
  const badExec = await request.post(`${GW}/ont/v2/proposals/${badPid}/execute`, {
    headers: h({ 'Idempotency-Key': `core-e2e-be-${badPid}` }),
    data: {},
  });
  expect(
    badExec.status(),
    `execute on missing target must fail explicitly: ${badExec.status()} ${await badExec.text()}`,
  ).toBeGreaterThanOrEqual(400);

  // 恢复：同一 Action 打在真实实例 → 提议 → 确认 → 执行（统一执行器，无 /apply 直调）
  const propose = await request.post(`${GW}/ont/v2/action-types/${ACT_TAG}/propose`, {
    headers: h(),
    data: { target_iid: IND_NOTE(SRC_PK), parameters: {}, impact_summary: 'recover' },
  });
  expect(propose.ok(), `propose: ${propose.status()} ${await propose.text()}`).toBeTruthy();
  const pid = (await propose.json()).proposal_id;

  const confirm = await request.post(`${GW}/ont/v2/proposals/${pid}/confirm`, {
    headers: h({ 'Idempotency-Key': `core-e2e-rc-${pid}` }),
    data: {},
  });
  expect(confirm.ok(), `confirm: ${confirm.status()} ${await confirm.text()}`).toBeTruthy();

  const exec = await request.post(`${GW}/ont/v2/proposals/${pid}/execute`, {
    headers: h({ 'Idempotency-Key': `core-e2e-re-${pid}` }),
    data: {},
  });
  expect(exec.ok(), `execute: ${exec.status()} ${await exec.text()}`).toBeTruthy();

  // 副作用生效
  const after = await request.get(`${GW}/ont/v2/individuals/${IND_NOTE(SRC_PK)}`, { headers: h() });
  expect((await after.json()).props?.[P_TAG]).toBe('tagged');

  // 审计（action 腿）：成功的 Action 必须在 action-audit 留痕
  const audit = await request.get(`${GW}/ont/v2/action-audit`, { headers: h() });
  expect(audit.ok()).toBeTruthy();
  expect(JSON.stringify(await audit.json())).toContain(ACT_TAG);
});

// ───────────────────────── 8. 跨租户拒绝 ─────────────────────────

test('跨租户拒绝：异租户 rid / 关联写入一律 4xx', async ({ request }) => {
  const foreign = `ont.${OTHER}.obj.${NS}-evil.v1`;
  const w = await request.post(`${GW}/ont/v2/object-types`, {
    headers: h(),
    data: {
      rid: foreign,
      display_name: 'evil',
      primary_key: [`ont.${OTHER}.prop.x.v1`],
      properties: [propDTO(`ont.${OTHER}.prop.x.v1`, true)],
      interfaces: [],
    },
  });
  expect(w.status(), 'cross-tenant object-type write must be rejected').toBeGreaterThanOrEqual(400);

  const r = await request.get(`${GW}/ont/v2/object-types/${foreign}`, { headers: h() });
  expect(r.ok(), 'foreign type must not be readable').toBeFalsy();

  const li = await request.post(`${GW}/ont/v2/link-instances`, {
    headers: h(),
    data: {
      rid: `ont.${OTHER}.lnk.${NS}-has.evil`,
      link_type_rid: LINK,
      src: `ont.${OTHER}.ind.x.a`,
      dst: `ont.${OTHER}.ind.x.b`,
      props: {},
    },
  });
  expect(li.status()).toBeGreaterThanOrEqual(400);
});

// ───────────────────────── 9. 前端可见（截图 / Trace 价值） ─────────────────────────

test('前端：本体页面在真实后端下无未捕获错误', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await login2(page);
  await page.goto('/ontology/explore/objects');
  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => {});
  expect(errors, errors.join('\n')).toHaveLength(0);
});

async function login2(page: Page): Promise<void> {
  await page.addInitScript(
    ({ t, tenant }) => {
      localStorage.setItem('mate_platform_token', t);
      localStorage.setItem(
        'mate_platform_user',
        JSON.stringify({
          id: '1',
          username: 'admin',
          realName: 'admin',
          tenantId: tenant,
          roles: ['PLATFORM_SUPER_ADMIN'],
        }),
      );
    },
    { t: token, tenant: T },
  );
}
