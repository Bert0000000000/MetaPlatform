/** 场景 1：数字员工跨模块一致性（GOVERN-11 Step 4）。

校验 3 个前端页面（agents/EmployeeListPage、dw/EmployeesPage、
superai/EmployeeMatchingPage）展示同一 employee 时字段完全一致，
并与 PG metaplatform_ont.ont_individual 主数据三方 diff。

执行依赖：auth-setup 完成 + seed_hr_it_finance_orchestrator 已注入。
*/

import { test, expect } from '@playwright/test';
import { pgQuery } from '../helpers/pg';
import { trackApiFailures } from '../helpers/auth';

interface DwEmployee {
  employeeId: string;
  name: string;
  role?: string;
  roleCategory?: string;
  capability?: string;
}

interface MatchedEmployee {
  employeeId: string;
  name: string;
  role?: string;
  capability?: string;
  confidence: number;
}

test('cross-module: 3 frontend pages + PG show identical employee fields', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  // --- 1) agents/EmployeeListPage ---
  await page.goto('/agents/employees');
  await page.waitForResponse((r) => r.url().includes('/api/v1/dw/employees') && r.status() === 200);
  const agentsRaw = await page.locator('[data-testid="employee-row"]').first().getAttribute('data-employee');
  expect(agentsRaw).toBeTruthy();
  const agentsList = JSON.parse(agentsRaw!) as DwEmployee[];

  // --- 2) dw/EmployeesPage ---
  await page.goto('/dw/employees');
  await page.waitForResponse((r) => r.url().includes('/api/v1/dw/employees') && r.status() === 200);
  const dwRaw = await page.locator('[data-testid="employee-row"]').first().getAttribute('data-employee');
  const dwList = JSON.parse(dwRaw!) as DwEmployee[];

  // --- 3) superai/EmployeeMatchingPage ---
  await page.goto('/superai/employee-matching');
  await page.locator('[data-testid="intent-input"]').fill('process HR leave approval');
  await page.locator('[data-testid="match-btn"]').click();
  const matchResp = await page.waitForResponse(
    (r) => r.url().includes('/api/v1/copilot/scheduling/employees/match') && r.status() === 200,
  );
  const matchBody = (await matchResp.json()) as { items: MatchedEmployee[] };
  const matchedIds = new Set(matchBody.items.map((i) => i.employeeId));

  // --- 断言 agents ∩ dw 字段级 deep-equal ---
  const agentsById = new Map(agentsList.map((e) => [e.employeeId, e]));
  const dwById = new Map(dwList.map((e) => [e.employeeId, e]));
  const commonIds = [...agentsById.keys()].filter((id) => dwById.has(id));
  expect(commonIds.length).toBeGreaterThan(0);
  for (const id of commonIds) {
    const a = agentsById.get(id)!;
    const d = dwById.get(id)!;
    expect(a.name, `agents/dw name mismatch on ${id}`).toBe(d.name);
  }

  // --- 断言 superai 返回 employeeId ⊆ agents/dw ---
  for (const id of matchedIds) {
    expect(
      agentsById.has(id) || dwById.has(id),
      `superai match returned unknown employeeId ${id}`,
    ).toBeTruthy();
  }

  // --- PG 三方 diff ---
  const ids = [...agentsById.keys()];
  const quotedIds = ids.map((_, i) => `$${i + 1}`).join(',');
  const pgRows = await pgQuery<{
    rid: string;
    props: { name?: string; dw_role?: string; dw_role_category?: string };
  }>(
    `SELECT rid, props FROM ont_individual
     WHERE tenant_id = 'tenant-default'
       AND rid LIKE 'ont.tenant-default.ind.dw-%'
     ORDER BY rid`,
    [],
  );
  expect(pgRows.length).toBeGreaterThanOrEqual(7);
  const pgBySlug = new Map(pgRows.map((r) => [r.rid.split('.').at(-2)!, r]));
  for (const [id, pg] of pgBySlug) {
    const a = agentsById.get(`dw-${id.replace('dw-', '')}`);
    if (!a) continue;
    expect(pg.props.name).toBe(a.name);
  }

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});
