/** 场景 2：A2A 协议协同（GOVERN-11 Step 4）。

SuperAI 编排跨 HR/IT/FINANCE 审批，3 个 employee 各执行 Function，
envelope 含 W3C traceparent，OTel span 数 >= 4。
*/

import { test, expect } from '@playwright/test';
import { waitForSpans } from '../helpers/otel';
import { trackApiFailures } from '../helpers/auth';

interface A2aEnvelope {
  @type: string;
  taskId: string;
  contextId: string;
  parts: Array<{ kind: string; payload: unknown; metadata?: Record<string, string> }>;
}

test('a2a: SuperAI orchestrates cross-domain task with shared trace_id', async ({ page, request }) => {
  test.setTimeout(120_000);
  const api = trackApiFailures(page);

  // 监听 a2a/messages POST envelope
  let envelope: A2aEnvelope | null = null;
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/v1/a2a/messages') && resp.request().method() === 'POST') {
      try {
        envelope = (await resp.json()) as A2aEnvelope;
      } catch {
        // ignore parse error
      }
    }
  });

  await page.goto('/superai/schedule-execute');
  await page.locator('[data-testid="intent-input"]').fill(
    'Approve HR leave: EMP-001 3 days, need IT ticket + Finance calc',
  );
  await page.locator('[data-testid="submit-btn"]').click();

  // 等候 orchestrator 提交
  await page.waitForResponse(
    (r) => r.url().includes('/api/v1/a2a/messages') && r.request().method() === 'POST' && r.status() < 500,
    { timeout: 15_000 },
  );

  expect(envelope, 'A2A envelope not captured').not.toBeNull();
  expect(envelope!.@type).toBeTruthy();
  expect(envelope!.parts.length).toBeGreaterThanOrEqual(3);

  // traceparent 注入校验
  const traceparent = envelope!.parts
    .flatMap((p) => [p.metadata?.['traceparent']])
    .find((tp) => typeof tp === 'string' && tp.startsWith('00-'));
  expect(traceparent, 'W3C traceparent missing in A2A envelope').toBeTruthy();

  const traceId = traceparent!.split('-')[1];

  // 轮询 task 状态
  const taskId = envelope!.taskId;
  let finalStatus = '';
  for (let i = 0; i < 15; i++) {
    const r = await request.get(`/api/v1/a2a/tasks/${taskId}`);
    if (r.ok()) {
      const body = (await r.json()) as { status?: string };
      finalStatus = body.status ?? '';
      if (finalStatus === 'completed' || finalStatus === 'failed') break;
    }
    await page.waitForTimeout(2_000);
  }
  expect(finalStatus, `task ${taskId} did not complete`).toBe('completed');

  // OTel 断言：orchestrator + 3 employees = >= 4 spans
  const spans = await waitForSpans(traceId, 4, 30_000);
  expect(spans.length, `expected >=4 OTel spans, got ${spans.length}`).toBeGreaterThanOrEqual(4);

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});
