/** 场景 3：执行 + 评估闭环（GOVERN-11 Step 4 + 5）。

GOVERN-11 落地盘点：
- ont kernel 在 dev 栈使用 in-memory 后端（"backend":"memory"），重启即失。
- PG metaplatform_ont 库里没有 ont_individual / ont_axiom 表（kernel 不建 DDL）。
- ActionType.apply 在 kernel API 层有 `/api/v1/ont/v2/action-types/{rid}/apply`，
  但要求对应 individual 在内存里存在（重启后丢失）。
- dw /api/v1/dw/evaluations **只支持 GET**，POST 返 405（无 write 端点）。
  Seed 已经预置 ≥7 条评估记录（QA-CS-1 / QA-SALES-1 / ...），覆盖
  全部 7 builtin dw 员工。

本场景走 **API 探针** 验证：
1. ont /v2/action-types/apply endpoint 可达（2xx/4xx 协议合规）
2. dw /evaluations GET 返 items 数组，每个 item 含 score / employee_id /
   evaluated_at 字段（schema 规整）
3. 标注**已知缺口**：dw POST evaluation 端点缺失；kernel PG 持久化缺失
*/

import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';
import { mintMockToken } from '../helpers/mock-jwt';

interface EvaluationItem {
  id: string;
  employee_id: string;
  score: number;
  passed: boolean;
  evaluated_at: string;
  qa_set_id?: string;
}

test('evaluation: ont apply endpoint + dw evaluations GET schema are reachable and well-formed', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  const { token } = mintMockToken();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // --- 1) ont action apply endpoint 探针 ---
  const applyResp = await request.post(
    'http://localhost:8100/api/v1/ont/v2/action-types/ont.tenant-default.act.approve-leave.v1/apply',
    {
      headers: authHeaders,
      data: {
        target_iid: 'ont.tenant-default.ind.leave-request.govern11-test',
        parameters: { decision: 'approve' },
      },
    },
  );
  // 允许 2xx/4xx；不允许 5xx 或 401
  expect(applyResp.status(), `apply status ${applyResp.status()}`).toBeLessThan(500);
  expect(applyResp.status()).not.toBe(401);

  // --- 2) dw /evaluations GET 校验 schema ---
  const listResp = await request.get(
    'http://localhost:8100/api/v1/dw/evaluations?size=20',
    { headers: authHeaders },
  );
  expect(listResp.status(), `dw /evaluations ${listResp.status()}`).toBe(200);
  const listBody = (await listResp.json()) as {
    code?: number;
    data?: { items?: EvaluationItem[] };
    items?: EvaluationItem[];
  };
  const items = listBody.data?.items ?? listBody.items ?? [];
  expect(Array.isArray(items), 'items is array').toBe(true);
  expect(items.length, `dw evaluations seeded (got ${items.length})`).toBeGreaterThanOrEqual(3);

  // --- 3) 每条 evaluation 必须有 score + employee_id + evaluated_at ---
  for (const ev of items) {
    expect(typeof ev.score, `eval ${ev.id} score type`).toBe('number');
    expect(typeof ev.employee_id, `eval ${ev.id} employee_id type`).toBe('string');
    expect(typeof ev.evaluated_at, `eval ${ev.id} evaluated_at type`).toBe('string');
  }

  // --- 4) score 范围合理性 [0, 100] ---
  for (const ev of items) {
    expect(ev.score, `eval ${ev.id} score ${ev.score} in [0,100]`).toBeGreaterThanOrEqual(0);
    expect(ev.score, `eval ${ev.id} score ${ev.score} in [0,100]`).toBeLessThanOrEqual(100);
  }

  // --- 5) evaluation employee_id 与 dw 主数据命名空间一致 ---
  const dwListResp = await request.get(
    'http://localhost:8100/api/v1/dw/employees',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(dwListResp.status(), `dw /employees ${dwListResp.status()}`).toBe(200);
  const dwBody = (await dwListResp.json()) as { data?: { items?: { employeeId: string }[] }; items?: { employeeId: string }[] };
  const dwIds = new Set((dwBody.data?.items ?? dwBody.items ?? []).map((e) => e.employeeId));
  for (const ev of items) {
    expect(
      dwIds.has(ev.employee_id),
      `evaluation employee_id ${ev.employee_id} not in dw`,
    ).toBe(true);
  }

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});