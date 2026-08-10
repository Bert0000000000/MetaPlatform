/** 场景 4：Ontology 模型编辑 → 即时生效（GOVERN-11 Step 4 + 5）。

GOVERN-11 落地盘点：
- ont kernel 用 in-memory 后端（"backend":"memory"），重启即失；
  缺 PG DDL（GOVERN-04 标记的 5 张表 DDL 没在容器里真正执行）。
- `/api/v1/ont/v2/object-types` GET/POST/PUT/PATCH 路径存在，但 PG 没建表
  → server 启动只 seed 了 demo 数据（3 obj + 5 ind），不支持自定义 property
  写入。
- 前端 `/ontology/object-types/{rid}` 路由**未注册**到 App.tsx（GOVERN-08
  死路由清单第 2 项）。完整 DOM 级"模型编辑器"UI 不存在。

本场景走 **API 探针** 验证：
1. ont /v2/object-types GET 返 items ≥3（seed 3 个 object type）
2. 选一个 ObjectType PUT 加 property → 端点可达（允许 2xx/4xx）
3. 校验 端点 schema 字段名匹配 ont.yaml operationId=getOntV2ObjectTypes
4. 标注**已知缺口**：PG 持久化缺失；前端模型编辑器路由缺失
*/

import { test, expect } from '@playwright/test';
import { trackApiFailures } from '../helpers/auth';
import { mintMockToken } from '../helpers/mock-jwt';

interface ObjectTypeItem {
  rid: string;
  primary_key?: string;
  properties?: Array<{ rid: string; type?: string; nullable?: boolean }>;
}

test('model-edit: ont /v2/object-types schema supports add-property semantic (shape only)', async ({ page, request }) => {
  test.setTimeout(60_000);
  const api = trackApiFailures(page);

  const { token } = mintMockToken();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // --- 1) GET /v2/object-types 看 seed 数据 ---
  const listResp = await request.get(
    'http://localhost:8100/api/v1/ont/v2/object-types?size=20',
    { headers: authHeaders },
  );
  expect(listResp.status(), `object-types ${listResp.status()}`).toBe(200);
  const listBody = (await listResp.json()) as
    | ObjectTypeItem[]
    | { items?: ObjectTypeItem[]; data?: { items?: ObjectTypeItem[] } };
  const items = Array.isArray(listBody)
    ? listBody
    : listBody.items ?? listBody.data?.items ?? [];
  expect(items.length, `seed object-types (got ${items.length})`).toBeGreaterThanOrEqual(3);

  // --- 2) 选 leave-request object type（或任何含 properties 的）---
  const target = items.find((o) => o.rid.includes('leave-request')) ?? items[0];
  expect(target, 'target object type').toBeDefined();
  expect(target!.rid, 'target rid').toBeTruthy();
  const initialProps = (target!.properties ?? []).length;
  expect(initialProps, `seed properties for ${target!.rid}`).toBeGreaterThan(0);

  // --- 3) GET /v2/object-types/{rid} 单个取 ---
  const singleResp = await request.get(
    `http://localhost:8100/api/v1/ont/v2/object-types/${encodeURIComponent(target!.rid)}`,
    { headers: authHeaders },
  );
  // 200 = GET 实现；4xx = 没 GET；不允许 5xx 或 401
  expect(singleResp.status(), `single object-type ${singleResp.status()}`).toBeLessThan(500);
  expect(singleResp.status()).not.toBe(401);

  // --- 4) PUT 加 property（探针；kernel 内存里可能写入成功也可能 4xx）---
  const putResp = await request.post(
    `http://localhost:8100/api/v1/ont/v2/object-types/${encodeURIComponent(target!.rid)}/properties`,
    {
      headers: authHeaders,
      data: {
        rid: `${target!.rid}.prop.overtime-fee.v1`,
        type: 'integer',
        nullable: true,
      },
    },
  );
  // 允许 2xx/4xx；不允许 5xx 或 401
  expect(putResp.status(), `add property ${putResp.status()}`).toBeLessThan(500);
  expect(putResp.status()).not.toBe(401);

  // --- 5) 列端点 schema 路径探测 ——
  const openapiResp = await request.get(
    'http://localhost:8100/api/v1/openapi.json',
    { headers: authHeaders },
  );
  // openapi may not be on gateway; tolerate 404
  if (openapiResp.ok()) {
    const oa = (await openapiResp.json()) as { paths?: Record<string, unknown> };
    const hasObjectType = Object.keys(oa.paths ?? {}).some((p) =>
      p.includes('/ont/v2/object-types'),
    );
    expect(hasObjectType, 'openapi exposes /ont/v2/object-types').toBe(true);
  }

  expect(api.report(), 'unexpected 4xx/5xx during scenario').toBe('');
});