/** 场景 1：数字员工跨模块一致性（GOVERN-11 Step 4 + 5）。

GOVERN-11 架构盘点结论：
- dw 主数据 = 7 个 kernel builtin 员工（CLAUDE.md 7+1；roleIdentity ∈
  ontology/workflow/app/data_product/obs/security/knowledge）
- ont 个体表 = 8 个业务语义员工（HR/IT/Finance/Sales/SuperAI，由
  seed_hr_it_finance_orchestrator 注入；rid 形如
  ont.tenant-default.ind.dw-<slug>.v1）
- copilot match 端点：GOVERN-12-01 修复后，`match_employees` 透传入站
  Authorization Bearer 头，dw client.list_dw_employees 用 fallback_token
  走真 dw 主数据（dev 环境 keycloak client_secret=stub 不可用场景下）。

跨模块一致性断言（场景 1）：
1. dw 提供 7 个 kernel role
2. ont 提供 8 个 dw/superai business-domain individual（HR/IT/Finance/Sales/
   SuperAI 命名空间齐全）
3. superai match 返回的 employeeId 集合 ⊆ dw 主数据 employeeId 集合（同源）
4. dw 字段 employeeId 形如 dw-emp-default-<n>（命名空间规整）

执行依赖：auth-setup 完成 + seed_hr_it_finance_orchestrator 已注入 +
GOVERN-12-01 fallback_token 修复已合并。
*/

import { test, expect } from '@playwright/test';
import { loginViaApi, trackApiFailures } from '../helpers/auth';

interface DwEmployee {
  employeeId: string;
  name: string;
  role?: string;
  roleCategory?: string;
  roleIdentity?: string;
  code?: string;
}

interface MatchedEmployee {
  employeeId: string;
  name: string;
  role?: string;
  capability?: string;
  confidence: number;
}

interface OntIndividual {
  rid: string;
  primary_key?: string;
  props?: Record<string, unknown>;
  tenant_id?: string;
}

test('cross-module: 3 sources (dw API + superai match + ont individuals) align on employee identity', async ({ page, request }) => {
  test.setTimeout(120_000);
  const api = trackApiFailures(page);

  // Playwright request 默认不带 storageState header；显式使用 Keycloak
  // 登录得到的真实 token，保证跨模块检查覆盖生产认证链路。
  const { token } = await loginViaApi(page, request);
  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // --- 1) dw API（agents 与 dw 两个前端页面共享同一 API）---
  const dwResp = await request.get('http://localhost:8100/api/v1/dw/employees', {
    headers: authHeaders,
  });
  expect(dwResp.status(), `dw /employees ${dwResp.status()}`).toBe(200);
  const dwBody = (await dwResp.json()) as { data?: { items?: DwEmployee[] }; items?: DwEmployee[] };
  const dwList = dwBody.data?.items ?? dwBody.items ?? [];
  expect(dwList.length, `dw /employees empty (got ${dwList.length})`).toBeGreaterThanOrEqual(7);
  const dwById = new Map(dwList.map((e) => [e.employeeId, e]));
  const dwIds = new Set(dwList.map((e) => e.employeeId));

  // --- 2) superai match API（前端通过 /superai/employee-match 调用）
  // GOVERN-12-01 后端修复 → fallback_token 透传入站 Bearer → dw 域主数据；
  // employeeId 集合必须 ⊆ dw 主数据（govern12-06 spec 升级到字段级）。
  await page.goto('/superai/employee-match');
  await expect(page).toHaveURL(/\/superai\/employee-match/);

  const matchResp = await request.post(
    'http://localhost:8100/api/v1/copilot/scheduling/employees/match',
    {
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      data: { taskType: 'ontology' },
    },
  );
  expect(matchResp.status(), `copilot match ${matchResp.status()}`).toBe(200);
  const matchBody = (await matchResp.json()) as { items?: MatchedEmployee[]; total?: number };
  expect(Array.isArray(matchBody.items), 'match items is array').toBe(true);
  expect(typeof matchBody.total, 'match total is number').toBe('number');

  // --- 断言 6（场景 1，GOVERN-12-01 升级）：superai match 同源 ---
  // match 返回的每个 employeeId 必须在 dw 主数据命名空间里。
  // 这条断言保证 copilot 不再 fallback 到 in-memory 3 伪员工。
  const matched = (matchBody.items ?? []) as MatchedEmployee[];
  expect(matched.length, `superai match empty for taskType=ontology`).toBeGreaterThan(0);
  for (const m of matched) {
    expect(
      dwIds.has(m.employeeId),
      `superai match employeeId ${m.employeeId} not in dw main data (govern12-01 同源失败)`,
    ).toBe(true);
  }
  // 至少 1 条必须有 roleIdentity=ontology（任务 type=ontology）
  const ontologyHits = matched.filter((m) => m.role === 'ontology').length;
  expect(
    ontologyHits,
    `superai match for 'ontology' should return ≥1 with role=ontology (got ${ontologyHits})`,
  ).toBeGreaterThanOrEqual(1);

  // --- 3) ont v2 individuals API（GOVERN-04 12 基元 PG 全量落地的内存镜像）---
  const ontResp = await request.get(
    'http://localhost:8100/api/v1/ont/v2/individuals?size=200',
    { headers: authHeaders },
  );
  expect(ontResp.status(), `ont /v2/individuals ${ontResp.status()}`).toBe(200);
  const ontList = (await ontResp.json()) as OntIndividual[];
  const dwOntIndividuals = ontList.filter(
    (i) =>
      i.rid?.startsWith('ont.tenant-default.ind.dw-') ||
      i.rid?.startsWith('ont.tenant-default.ind.superai-'),
  );
  expect(
    dwOntIndividuals.length,
    `ont dw/superai individuals (got ${dwOntIndividuals.length})`,
  ).toBeGreaterThanOrEqual(8);

  // --- 断言 1：dw 提供 7 个 kernel builtin employees（CLAUDE.md 7+1）---
  // dw 响应字段是 `roleIdentity`（slug），不是 `role`。
  const expectedRoles = ['ontology', 'workflow', 'app', 'data_product', 'obs', 'security', 'knowledge'];
  const dwRoles = new Set(dwList.map((e) => e.roleIdentity).filter(Boolean));
  for (const role of expectedRoles) {
    expect(
      dwRoles.has(role),
      `dw missing kernel role ${role} (have: ${[...dwRoles].join(', ')})`,
    ).toBe(true);
  }

  // --- 断言 2（场景1）：dw employeeId 命名空间规整（dw-emp-default-N）---
  for (const e of dwList) {
    expect(
      /^dw-emp-default-\d+$/.test(e.employeeId),
      `dw employeeId malformed: ${e.employeeId}`,
    ).toBe(true);
  }

  // --- 断言 3（场景1）：ont 的 8 个 dw/superai individual rid 命名空间一致 ---
  // 每个 ont individual rid 必须形如 ont.<tenant>.ind.dw-<slug>.v1
  for (const ind of dwOntIndividuals) {
    expect(
      /^ont\.tenant-default\.ind\.(dw-[a-z-]+|superai-[a-z-]+)\.v\d+$/.test(ind.rid),
      `ont individual rid malformed: ${ind.rid}`,
    ).toBe(true);
  }

  // --- 断言 4（场景1）：SuperAI 编排员工个体在 ont 中恰好 1 个 ---
  const orchestrators = dwOntIndividuals.filter((i) => i.rid.includes('superai-orchestrator'));
  expect(orchestrators.length, 'superai orchestrator individuals').toBe(1);

  // --- 断言 5（场景1）：7 个业务域员工（HR/IT/Finance/Sales）必须齐全 ---
  // ont individual rid 形如 ont.tenant-default.ind.dw-<slug>.v1
  const businessDomains = ['hr-recruiter', 'hr-payroll', 'it-helpdesk', 'it-devops', 'finance-ar', 'finance-expense', 'sales-crm'];
  for (const slug of businessDomains) {
    const hit = dwOntIndividuals.some((i) => i.rid.includes(`.ind.dw-${slug}.`));
    expect(hit, `ont missing business domain employee: ${slug}`).toBe(true);
  }

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});
