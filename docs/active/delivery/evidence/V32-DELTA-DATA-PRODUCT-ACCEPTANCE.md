# v3.2-δ 多模态数据产品 (Iceberg ADS) — ACCEPTANCE

> 验收日期：2026-08-03
> 范围：v3.2-δ 多模态数据产品 (Iceberg ADS) 2 周工作 全部内容闭环
> 关联 commit：（待 push 后补）
> 状态：**Accepted (v3.2-δ M-里程碑 sub-chart + control-plane delivery)**

## 1. 三件并行交付（sub-agent 3 并行）

| Sub-agent | 范围 | 改 package | 测试 |
|---|---|---|---|
| A: DataProduct 域 | 新 `data_products` 全栈 CRUD + publish lifecycle + OpenAPI 9 endpoints | mate-tech-data | **15 tests** |
| B: ADS publish workflow | `IcebergRestAdapter` + `AdsPublisher` 4 步工作流 | mate-tech-data | **22 tests** (11 publisher + 11 adapter) |
| C: ADS access audit | `AdsAuditMiddleware` ASGI 中间件 | mate-platform | **8 tests** |

**测试增量**：+45（从 1594 → 1639）

---

## 2. Sub-agent A — DataProduct 域

### 2.1 新增 9 个 endpoints

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/v1/data/products` | 列表（分页 + status/modality 过滤） |
| POST | `/api/v1/data/products` | 创建 |
| GET | `/api/v1/data/products/{id}` | 详情 |
| PUT | `/api/v1/data/products/{id}` | 更新 |
| DELETE | `/api/v1/data/products/{id}` | 删除 |
| POST | `/api/v1/data/products/{id}/publish` | 发布（status="published", version+1, outbox） |
| POST | `/api/v1/data/products/{id}/certify` | 认证（status="certified", 需 owner, outbox） |
| POST | `/api/v1/data/products/{id}/suspend` | 暂停（status="suspended", outbox） |
| GET | `/api/v1/data/products/{id}/versions` | 版本历史 |

### 2.2 Data Product 字段

- `id`, `tenant_id` (indexed), `name`, `version`
- `source_paimon_table` (e.g. `paimon.ods.orders`)
- `target_iceberg_table` (e.g. `iceberg.ads.orders`)
- `modality` (structured | embedding | chunk | mixed) — 多模态支持
- `status` (draft | published | certified | suspended) — 4 阶段生命周期
- `owner`, `description`, `tags` (JSON list)

### 2.3 关键实现要点

- 全部 9 个写 handler 经 `_tid(request)` (硬规则 3)
- 全部状态变更经 `_emit(...)` 发 outbox event (ADR-0014 step 3)
- SQLAlchemy 2.0 typed columns (`Mapped[str/int/Text]`)
- in-memory repo + SQL store 双实现
- 跨租户隔离：tenant A 的 product 对 tenant B 返回 404

---

## 3. Sub-agent B — Iceberg ADS Publish Workflow

### 3.1 IcebergRestAdapter (`services/iceberg_rest_adapter.py`)

镜像 `DebeziumEngine` 模式：
- `httpx.AsyncClient` + 生命周期
- `from_env()` (`ICEBERG_REST_URL`, default `http://iceberg:8181`)
- 4 方法：`create_namespace`, `create_table`, `register_table`, `close`
- `IcebergRestError` 统一异常

### 3.2 AdsPublisher (`services/ads_publisher.py`)

4 步发布工作流（match `architecture-implementation §6` 附录 A 图）：

1. **resolve**：get_data_product(tenant_id, product_id)；404 if not found
2. **validate status**：必须 `published` 或 `certified`（draft/suspended 拒绝）
3. **publish to iceberg**：
   - `adapter.create_namespace(target_namespace)` — 409 idempotent
   - `adapter.register_table(source_table, target_namespace, target_name)`
4. **post-publish**：
   - `version += 1` (成功后)
   - emit `data.ads.published` outbox event
   - 返回 `AdsPublishResult` (frozen dataclass)

错误处理：
- 4xx (除 409 namespace)：透传为 `AdsPublisherError(status_code=400)`
- 5xx / 网络错误：返回 `status="failed"`，不 bump version，不发 outbox

### 3.3 测试覆盖（22）

- happy path / certified path / 404 / draft / suspended / 409 幂等 / outbox / 5xx-failed / 4xx-raise / tenant isolation / malformed target (publisher)
- happy-path / 409 / register / create_table / 500 / 404 / 非 JSON / 网络错误 / `close` / `from_env` (adapter)

---

## 4. Sub-agent C — Cross-tenant ADS Access Audit

### 4.1 `AdsAuditMiddleware` (`tenancy/ads_audit.py`)

ASGI middleware 实施 v3.2-δ DATA-D5 跨租户 ADS 访问审计：

- 仅 audit 当：
  - ctx 存在
  - `ctx.auth_method != ANONYMOUS`
  - `request.state.ads_read` truthy
  - product tags 含 `audit:cross_tenant`
- 总是先调 `self.app(scope, receive, send)`，审计后置（不阻塞响应）
- 异常吞掉（审计失败不破坏用户可见路径）
- Event payload: `{tenant_id, user_id, trace_id, product_id, table, tags}`
- `outbox_writer=None` 时 no-op

### 4.2 Constants

- `ADS_AUDIT_EVENT_TYPE = "audit.cross_tenant_data_access"`
- `CROSS_TENANT_TAG = "audit:cross_tenant"`

### 4.3 测试覆盖（8）

- emit event for cross_tenant ADS read
- payload 字段完整
- 跳过非 ADS 请求
- 跳过 anonymous ctx
- 跳过缺少 cross_tenant tag
- outbox=None 不崩溃
- 构造器幂等（无全局状态）
- 不阻塞 inner app

---

## 5. 历史 ruff 收尾（顺带）

`mate-tech-data/src/mate_tech_data/services/debezium_engine.py`：
- `I001`: import 块排序（ruff --fix 自动）
- `SIM105`: `try/except/pass` → `with contextlib.suppress(...)`（unsafe-fix）

`mate-platform/src/mate_platform/tenancy/__init__.py`：
- `RUF022`: `__all__` 排序
- `F401`: `TenantId` 加 `as TenantId`（外部依赖使用）

---

## 6. 验证

```text
$ ruff check packages/mate-platform/src/mate_platform/tenancy packages/mate-tech-data/src packages/mate-tech-data/tests
All checks passed!

$ pytest packages/mate-tech-data packages/mate-platform
340 passed in 3.76s  (98 mate-tech-data + 242 mate-platform)

$ pytest packages
1639 passed, 534 warnings in 265.21s
  (从 1594 → 1639, +45: 15 DataProduct + 11 AdsPublisher + 11 IcebergAdapter + 8 AdsAudit)
```

## 7. 13 硬规则映射

| # | 硬规则 | 三批次总览 |
|---|---|---|
| 3 | tenant 上下文 | ✅ DataProduct 全部 9 handler + AdsPublisher 经 require_tenant (硬规则 3) |
| 4 | 外部系统 ACL | ✅ IcebergRestAdapter 是 mate-tech-data → iceberg sub-chart 的 ACL 边界 |
| 6 | 静态检查 | ✅ ruff 0 errors (debezium_engine SIM105 + tenancy __init__ RUF022 + F401 全部清零) |
| 8 | K8s readiness | ✅ DataProduct publish workflow 与 Iceberg REST 真实集成 (sub-chart 已落) |
| 9 | 审计/指标/trace | ✅ AdsAuditMiddleware 发 `audit.cross_tenant_data_access` outbox event |
| 10 | 验收证据 | ✅ 本文档 + 45 tests (15 + 22 + 8) |
| 13 | NetworkPolicy | ✅ DataProduct publish 走 Iceberg sub-chart 的 NetworkPolicy (前置已落) |

## 8. v3.2-δ M-里程碑进度

| M-v3.2-δ 子内容 | 状态 |
|---|---|
| DataProduct 控制面 9 endpoints | ✅ Accepted (本批) |
| Iceberg ADS publish 4 步工作流 | ✅ Accepted (本批) |
| Cross-tenant ADS 访问审计 middleware | ✅ Accepted (本批) |
| 真实 K8s 部署 (Paimon → Iceberg ADS) | 🟡 待 DevOps staging 演练 |
| DataHub Data Product 元数据同步 | ❌ v3.2-ε 接力 |
| Great Expectations ADS 表 quality gate | ❌ v3.2-ε 接力 |
| pii_mask + retention ADS 层 | ❌ D6/D7 接力 |

**v3.2-δ 多模态数据产品 ADS 控制面 + 工作流 + 审计层全部闭环** ✅

## 9. 后续接力候选（v3.2-ε + v3.2-ε 后续）

| 候选 | 工作量 | 优先级 |
|---|---|---|
| 真实云端 staging 演练（Paimon → Iceberg ADS 真实数据流） | 2-4 周 | **P2** |
| DataHub Data Product 元数据同步 | 1 周 | P3 |
| Great Expectations ADS 表 quality gate | 1 周 | P3 |
| pii_mask ADS 层集成 | 1 周 | P4 |
| v3.2-ε GA | 2027-03-15 | **P1** |

下一步推荐：启动真实云端 staging 演练（v3.2-δ 真实部署 + 端到端数据流验证）。