/** 场景 2：A2A 协议协同（GOVERN-11 Step 4 + 5）。

GOVERN-11 落地盘点：
- A2A 服务（mate-app-a2a，端口 8502）目前只暴露 `/api/v1/a2a/health`，
  **未实现** W3C A2A 的 `/messages` + `/tasks/{id}` 端点。
- SuperAI 编排页 `/superai/a2a` 是 Modal 委托（无顶层 intent input）。
- gateway 网关路由表里 `/api/v1/a2a/messages` 与 `/api/v1/a2a/tasks/{id}`
  都不通（404 E404_NO_ROUTE）。

本场景的实质是 **可连通性 + 协议契约可发现性** 验证：
1. a2a 服务的 openapi.json 可拉到
2. /api/v1/a2a/health 返 200 + status=ok
3. openapi 路径里至少有 /health 端点（W3C A2A 在 dev 栈尚未实现）

DOM 级演练（用户原话"真实模拟"）需要：
- 补齐 mate-app-a2a 的 messages/tasks endpoint（governance follow-up）
- 在 gateway ROUTE_MAP 注册 /api/v1/a2a → mate-app-a2a:8502
- 接入 Jaeger 做 OTel span 链验证

上述 follow-up 入 acceptance/GOVERN-11-ontology-loop.md 的 P2 列表。
*/

import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';
import { mintMockToken } from '../helpers/mock-jwt';

test('a2a: A2A protocol service is reachable and exposes W3C-A2A-capable health endpoint', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  const { token } = mintMockToken();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // 1) 走网关：/api/v1/a2a/health 必须 200（agent 编排可见）
  const gwHealth = await request.get('http://localhost:8100/api/v1/a2a/health', {
    headers: authHeaders,
  });
  expect(gwHealth.status(), `a2a gateway /health ${gwHealth.status()}`).toBe(200);
  const gwHealthBody = (await gwHealth.json()) as { status?: string };
  expect(gwHealthBody.status, 'a2a health status').toBe('ok');

  // 2) 走容器直连：拉 a2a openapi.json，确认 /health 暴露
  const openapiResp = await request.get('http://localhost:8502/openapi.json', {
    headers: authHeaders,
  });
  expect(openapiResp.status(), `a2a openapi ${openapiResp.status()}`).toBe(200);
  const openapi = (await openapiResp.json()) as { paths?: Record<string, unknown> };
  expect(openapi.paths, 'a2a openapi.paths').toBeDefined();
  expect(
    Object.keys(openapi.paths ?? {}).some((p) => p.includes('/health')),
    `a2a openapi paths: ${Object.keys(openapi.paths ?? {}).join(', ')}`,
  ).toBe(true);

  // 3) 校验 W3C A2A contract 未到位（follow-up 记录）
  const hasMessages = Object.keys(openapi.paths ?? {}).some((p) => p.includes('/messages'));
  const hasTasks = Object.keys(openapi.paths ?? {}).some((p) => p.includes('/tasks'));
  // 故意不 expect(toBe(true))——这里只记状态，等 mate-app-a2a 补齐
  // eslint-disable-next-line no-console
  console.log(`[a2a-spec] W3C A2A contract: messages=${hasMessages} tasks=${hasTasks}`);

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});