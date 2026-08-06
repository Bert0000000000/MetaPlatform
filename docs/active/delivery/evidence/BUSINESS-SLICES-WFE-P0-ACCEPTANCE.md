# BUSINESS-SLICES-WFE-P0-ACCEPTANCE — mate-app-wfe P0 模板验收

**状态**：Accepted
**日期**：2026-08-06
**ADR**：ADR-0024（`docs/active/decisions/ADR-0024-wfe-p0-template.md`）
**对应 v3.1 BOARD §4**：BUSINESS-SLICES P0 wave 1
**对应 P0 域**：`mate-app-wfe`（workflow engine center / FR-WFE-001..002）

---

## 1. 范围

把 `mate-app-wfe` 升级为 BUSINESS-SLICES P0 模板：对齐 `mate-app-kb` 的
5 步接入模式（ADR-0014 + `docs/active/specs/2026-07-30-per-app-integration-checklist.md`）。

## 2. 5 步对位

| # | 步骤 | 已落地 | 证据 |
|---|---|---|---|
| 1 | `install_auth(app)` 在 `create_app()` 第一行 | ✅ | `packages/mate-app-wfe/src/mate_app_wfe/main.py:38` |
| 2 | 每个 handler 第一行 `require_tenant(ctx)` | ✅ | `packages/mate-app-wfe/src/mate_app_wfe/api/app.py:_tid()` |
| 3 | 写 handler `outbox.append(Event.create(...))` 同事务 | ✅ | `packages/mate-app-wfe/src/mate_app_wfe/api/app.py:_emit()` |
| 4 | 出向 BearerAuth + OutgoingAuthMiddleware | ✅ | `packages/mate-app-wfe/src/mate_app_wfe/clients.py`（本 PR 升级） |
| 5 | ≥3 cross-tenant negative | ✅ | `packages/mate-app-wfe/tests/test_app_wfe_tenant_integration.py`（3 case） |

### 2.1 步骤 4 升级详情

**改动前**（13 硬规则 #4 违例）：

```python
# clients.py（原版）
async with httpx.AsyncClient(timeout=self.timeout) as http:
    resp = await http.post(f"{self.base_url}/...")
```

**改动后**（与 `mate-app-kb/clients.py:RAGClient` 同款）：

```python
# clients.py（新）
from mate_clients.security import BearerAuth, OutgoingAuthMiddleware

class FlowableClient:
    def __init__(self, ..., auth: BearerAuth | None = None, tenant_id: str = ""):
        self._client = httpx.AsyncClient(timeout=timeout)
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id

    def set_tenant(self, tenant_id: str) -> None:
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)
```

**Handler 改造**（`api/app.py`）：

```python
client = FlowableClient(
    auth=getattr(request.app.state, "bearer_auth", None),
    tenant_id=tid,
)
try:
    result = await client.deploy(body.name, bpmn_xml)
finally:
    await client.aclose()
```

## 3. 测试结果

```
$ python -m pytest packages/mate-app-wfe/tests/ -q
47 passed, 340 warnings in 3.06s
```

**基线对比**：45 → 47（+2 新增 case）

### 3.1 新增 ACL case

| case | 验证内容 |
|---|---|
| `test_flowable_client_injects_bearer_and_tenant_header` | respx mock `http://flowable:8080/...` 端点，校验 outbound 请求 header 含 `Authorization: Bearer test-bearer-token` + `X-Tenant-Id: tenant-acme` |
| `test_flowable_client_set_tenant_rebinds_auth` | 调 `set_tenant("globex")` 后 `_tenant_id == "globex"`，OutgoingAuthMiddleware rebind 完成 |

### 3.2 既有 5 步对位 case（保持通过）

- `test_deploy_flow_happy_path`：POST `/flows/deploy` 落 `in-memory` deployment
- `test_deploy_flow_emits_outbox`：触发 `wfe.flow.deployed` 事件 + tenant_id 透传
- `test_deploy_flow_tenant_isolation`：双租户 deployment / outbox 完全隔离
- `test_flows_test_tenant_isolation`：ad-hoc test-run 跨租户隔离
- `test_flows_validate_tenant_isolation`：validation catalog 跨租户隔离
- `test_no_tenant_400`：token 缺 tenant_id 被 `require_tenant` 拒绝

## 4. 13 硬规则对位

| # | 规则 | 对位 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | OpenAPI `wfe.yaml` 已就位（沿用） |
| 2 | PRD 有 Requirement ID | FR-WFE-001..002 引用 |
| 3 | 没有 tenant 不访问 repo | `_tid()` 守门 + `repositories/in_memory.py` 显式 tenant_id 入参 |
| 4 | **外部系统没有 ACL Client** | **本 PR 修复**：`FlowableClient` 加 `BearerAuth` + `OutgoingAuthMiddleware` |
| 5 | Production profile 禁 fallback | InMemory fallback 仅在 `FLOWABLE_BASE_URL=""` 触发，prod env 必设 |
| 6 | 静态检查 ruff+pyright | wfe 包零 lint error |
| 7 | 跳过测试不标 Accepted | 0 skip |
| 8 | K8s readiness + 回滚 | Helm chart `infra/helm/service-templates` 沿用（无 wfe 专用值） |
| 9 | 审计 / 指标 / trace | OTel 中间件沿用 mate-platform；outbox 事件携带 `trace_id` |
| 10 | 验收证据 | 本文件 + ADR-0024 |
| 11 | helm-docs 同步 | service-template chart README 自动同步 |
| 12 | Secret 不进 git | `KEYCLOAK_CLIENT_SECRET` 等用 `.env` + docker-compose env 注入 |
| 13 | NetworkPolicy 缺失 = prod 不通过 | default-deny 沿用 |

## 5. 落档清单

```
docs/active/decisions/ADR-0024-wfe-p0-template.md          ← 本 PR 新增
docs/active/delivery/evidence/BUSINESS-SLICES-WFE-P0-ACCEPTANCE.md  ← 本文件
packages/mate-app-wfe/src/mate_app_wfe/clients.py          ← +auth +tenant +aclose +set_tenant
packages/mate-app-wfe/src/mate_app_wfe/api/app.py          ← FlowableClient 实例化处 +aclose
packages/mate-app-wfe/tests/test_wfe_flowable.py           ← +2 ACL case
```

## 6. 后续

- BUSINESS-SLICES P0 wave 2/3：mate-app-arch / mate-app-copilot / mate-app-hub
  按本 ADR 同款模式接入（不在本 Batch 范围）
- mate-app-wfe SLO（ADR-0018 §2.1）：独立 PR
- Flowable 8.0 真接入（P2-W6）：需要 docker-compose Flowable 服务 + `FLOWABLE_BASE_URL` 注入

## 7. 关联

- ADR-0014：TECH-SERVICES 17 域接入模式
- ADR-0016：BUSINESS-SLICES checklist
- ADR-0018：AI 服务 SLO
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md`：5 步接入
- `packages/mate-app-kb/src/mate_app_kb/clients.py`：canonical reference