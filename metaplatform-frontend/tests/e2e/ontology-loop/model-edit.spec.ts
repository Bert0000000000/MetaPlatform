/** 场景 4：Ontology 模型编辑 → 即时生效（GOVERN-11 Step 4）。

修改 ObjectType property → 业务字段 <3s 内可见。
*/

import { test, expect } from '@playwright/test';
import { pgQuery } from '../helpers/pg';
import { trackApiFailures } from '../helpers/auth';

test('model-edit: ObjectType property change → UI refresh < 3s', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  // --- 1) 加载模型编辑器 ---
  await page.goto('/ontology/object-types/ont.tenant-default.obj.leave-request.v1');
  await page.waitForResponse(
    (r) => r.url().includes('/api/v1/ont/v2/object-types/') && r.status() === 200,
  );

  // --- 2) Form 增 property: overtime-fee ---
  await page.locator('[data-testid="add-property-btn"]').click();
  await page.locator('[data-testid="prop-name"]').fill('overtime-fee');
  await page.locator('[data-testid="prop-type"]').selectOption('integer');
  await page.locator('[data-testid="prop-nullable"]').check();
  await page.locator('[data-testid="prop-save"]').click();

  // --- 3) PUT 触发 ---
  const putResp = await page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/ont/v2/object-types/') &&
      r.request().method() === 'PUT' &&
      r.status() < 500,
    { timeout: 5_000 },
  );
  expect(putResp.ok(), `PUT failed: ${putResp.status()}`).toBeTruthy();

  // --- 4) 计时：访问 /dw/employees 看 capability 描述含 "overtime fee" ---
  const start = Date.now();
  await page.goto('/dw/employees');
  await expect(page.locator('[data-testid="capability-text"]'))
    .toContainText(/overtime/i, { timeout: 3_000 });
  const elapsed = Date.now() - start;
  expect(elapsed, `refresh took ${elapsed}ms, expected <3000`).toBeLessThan(3_000);

  // --- 5) ActionType.apply 用新字段 ---
  const applyResp = await request.post(
    '/api/v1/ont/v2/action-types/ont.tenant-default.act.approve-leave.v1/apply',
    {
      data: {
        target_iid: 'ont.tenant-default.ind.leave-request.2',
        parameters: { decision: 'approve', overtime_fee: 500 },
      },
    },
  );
  expect(applyResp.ok(), `apply with new field failed: ${applyResp.status()}`).toBeTruthy();

  // --- 6) PG 直查 properties 含 overtime-fee ---
  const rows = await pgQuery<{ properties: Array<{ rid: string }> }>(
    `SELECT properties FROM ont_object_type
     WHERE rid = 'ont.tenant-default.obj.leave-request.v1'
       AND tenant_id = 'tenant-default'`,
  );
  expect(rows.length).toBe(1);
  const propNames = rows[0].properties.map((p) => String(p.rid).split('.').at(-2));
  expect(propNames).toContain('overtime-fee');

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});
