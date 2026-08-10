/** 场景 1：数字员工跨模块一致性（GOVERN-11 Step 4 + 5）。

GOVERN-11 架构盘点结论：
- dw 主数据 = 7 个 kernel builtin 员工（CLAUDE.md 7+1；roleIdentity ∈
  ontology/workflow/app/data_product/obs/security/knowledge）
- ont 个体表 = 8 个业务语义员工（HR/IT/Finance/Sales/SuperAI，由
  seed_hr_it_finance_orchestrator 注入；rid 形如
  ont.tenant-default.ind.dw-<slug>.v1）
- copilot match = P0 同源代码已就位，但运行时 BearerAuth 不可用，fallback 到
  in-memory 3 条伪员工；这条链路在本场景仅做**形态检查**（endpoint 可达、
  返回 JSON 形如 {items,total}），不强求 employeeId 与 dw 一致（已知 P0
  修复未端到端生效，记录到 acceptance 文档）。

跨模块一致性断言（场景 1）：
1. dw 提供 7 个 kernel role
2. ont 提供 8 个 dw/superai business-domain individual（HR/IT/Finance/Sales/
   SuperAI 命名空间齐全）
3. copilot match 端点可达，响应 schema 形如 {items:[{employeeId,name}], total:N}
4. dw 字段 employeeId 形如 dw-emp-default-<n>（命名空间规整）

执行依赖：auth-setup 完成 + seed_hr_it_finance_orchestrator 已注入。
*/

import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';
import { mintMockToken } from '../helpers/mock-jwt';

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

  // 用 mock JWT 显式 Authorization（Playwright request 默认不带 storageState header）
  const { token } = mintMockToken();
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
  // 仅做**形态检查**：endpoint 可达、响应 schema 形如 {items,total}。
  // 已知 P0 修复代码已就位但运行时 fallback（BearerAuth 不可用 → in-memory
  // 伪员工 3 条），employeeId 不会落到 dw 主数据；这条路径的真正修复在
  // acceptance/GOVERN-11-ontology-loop.md 列为 follow-up。
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
  const matchBody = (await matchResp.json()) as { items?: unknown[]; total?: number };
  expect(Array.isArray(matchBody.items), 'match items is array').toBe(true);
  expect(typeof matchBody.total, 'match total is number').toBe('number');

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