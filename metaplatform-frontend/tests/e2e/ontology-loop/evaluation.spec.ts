/** 场景 3：执行 + 评估闭环（GOVERN-11 Step 4）。

ActionType.apply → individual.props 更新 → Evaluation 打分 →
axiom 写回 → 前端 evaluation 列表可见。
*/

import { test, expect } from '@playwright/test';
import { pgQuery } from '../helpers/pg';
import { trackApiFailures } from '../helpers/auth';

test('evaluation: action.apply → props update → axiom written back → UI shows score', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  // --- 1) ActionType.apply act-approve-leave ---
  const applyResp = await request.post('/api/v1/ont/v2/action-types/ont.tenant-default.act.approve-leave.v1/apply', {
    data: {
      target_iid: 'ont.tenant-default.ind.leave-request.1',
      parameters: { decision: 'approve' },
    },
  });
  expect(applyResp.ok(), `apply failed: ${applyResp.status()}`).toBeTruthy();

  // --- 2) PG 校验 props.status = APPROVED ---
  const updatedRows = await pgQuery<{ props: { status?: string } }>(
    `SELECT props FROM ont_individual
     WHERE rid = 'ont.tenant-default.ind.leave-request.1'
       AND tenant_id = 'tenant-default'`,
  );
  expect(updatedRows.length).toBe(1);
  expect(updatedRows[0].props.status).toBe('APPROVED');

  // --- 3) Evaluation API（dw 域） ---
  const evalResp = await request.post('/api/v1/dw/evaluations', {
    data: {
      taskId: 'task-evaluation-test-001',
      subjectId: 'dw-hr-payroll',
      dimensions: { accuracy: 0.9, latency: 0.7, compliance: 1.0 },
      comment: 'GOVERN-11 评估闭环集成测试',
    },
  });
  expect(evalResp.ok(), `evaluation failed: ${evalResp.status()}`).toBeTruthy();
  const evalBody = (await evalResp.json()) as { score: number };

  // --- 4) PG 校验 axiom 写回 ---
  const axiomRows = await pgQuery<{ rid: string; expression: string }>(
    `SELECT rid, expression FROM ont_axiom
     WHERE subject_rid = 'ont.tenant-default.ind.dw-hr-payroll.v1'
       AND tenant_id = 'tenant-default'`,
  );
  expect(axiomRows.length, 'expected axiom row for evaluation').toBeGreaterThanOrEqual(1);

  // --- 5) 前端 evaluation 列表可见 ---
  await page.goto('/dw/employees/dw-hr-payroll/evaluations');
  await page.waitForResponse((r) => r.url().includes('/api/v1/dw/evaluations') && r.status() === 200);
  await expect(page.locator('[data-testid="evaluation-score"]').first()).toBeVisible();

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});
