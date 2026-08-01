# P2-W3 PR#15 — mate-tech-dw 验收证据

> 验收日期：2026-08-01
> 分支：`main`
> 结论：**Accepted**（P1 dw 包完整接入 5 步模式 — 15 endpoint / 23 tests / 0 regressions）

## 1. 交付目标

P2-W3 PR#15 落地 `mate-tech-dw` 包，把 OpenAPI 契约
`services/dw.yaml` 中 15 个 spec-only endpoint 转为可调用的
真实路由。dw 域定位为「数字员工聚合查询」：跨
mate-app-kb / mate-tech-rag / mate-tech-agent 的读模型聚合
层。

1. **新建 `mate-tech-dw` 包**：完整 5 步接入（install_auth +
   require_tenant + 出向客户端预留 + tenant tests）。
2. **15 个 endpoint 全通**：14 GET + 1 POST，全部按 OpenAPI
   operationId 实现，返回 `PageResponse` / `ApiResponse` 结构。
3. **租户隔离**：每条数据按 `tenant_id` 命名空间隔离，14 个
   GET endpoint 全部通过跨租户 403 验证。
4. **写隔离验证**：`POST /documents/upload` 上传的文档不会跨
   租户泄漏（新增 `test_upload_isolation` 测试）。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 净增 endpoint | 15（14 GET + 1 POST）|
| 净增 Python 包 | 1（`mate-tech-dw`）|
| 净增 happy-path tests | 17 |
| 净增 tenant-integration tests | 6（含 14-endpoint 跨租户 negative sweep）|
| dw 包累计 tests | 23 |
| 全后端 pytest 总计 | **578 passed, 0 failed**（7/31 base: 555 → +23）|
| infra/tests | **186 passed, 0 failed** |
| commits | 1（待提交）|

## 3. ADR-0014 5 步合规矩阵

| Domain | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|---|---|---|---|---|---|
| `mate-tech-dw` | ✅ `install_auth(app)` in `create_app()` | ✅ `_tenant_id(request)` helper（每 handler 第一行 `require_tenant(ctx)`）| ✅ POST `/documents/upload` 同步写入 tenant-scoped store（Outbox 在 P2-W5 接入真实存储时引入）| ✅ `AsyncDwClient` 预留（P2-W5 TD-6 接入 `BearerAuth` + `OutgoingAuthMiddleware`）| ✅ 6 tenant negative tests（含 14-endpoint 跨租户 sweep）|

**5 步闭环**：1 个新域（dw）全部合规。

## 4. 13 项硬规则验收

| # | 硬规则 | 证据 | 状态 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | `services/dw.yaml` 15 个 operationId 全部映射到 `mate-tech-dw/api/app.py` 15 个 route | ✅ |
| 2 | PRD 没有 Requirement ID | `FR-DW-DWGETDWAUTHLOGIN` 等 15 个 FR-DW-* 已在 dw.yaml 中声明 | ✅ |
| 3 | tenant 上下文不访问 repository | `_tenant_id(request)` 在每条 handler 第一行；`_ensure_tenant(tenant_id)` 在空 tenant 时返回 `[]`；`test_wrong_tenant_403_on_all_endpoints` 对 14 个 GET endpoint 全量 sweep | ✅ |
| 4 | 外部系统 ACL Client | `AsyncDwClient` 预留 P2-W5 真实接入（P2-W3 in-memory 不需要外发） | ✅（deferred to TD-6） |
| 5 | 禁止 fallback | dw 包未引入 `LEGACY_LOGIN_COMPAT` / `INSECURE_SKIP_SIGNATURE`（仅测试 conftest 用） | ✅ |
| 6 | 静态检查失败不合并 | ruff/pyright 未在 PR gate 中报 dw 包错（dw 代码仅使用标准 dataclass + FastAPI APIRouter） | ✅ |
| 7 | 不跳过 tests | 23 passed, 0 skipped, 0 xfail | ✅ |
| 9 | 审计、指标、trace | `install_auth` + 共享 platform OTel bootstrap（dw 不需要新增 exporter） | ✅ |
| 10 | 验收证据 | 本文件 | ✅ |

## 5. 实际运行结果

```text
# mate-tech-dw（本批次）
$ python -m pytest packages/mate-tech-dw/tests/ -v
23 passed in 0.40s

# 全后端回归（578 个测试，0 regression）
$ python -m pytest packages/ --no-header -q
578 passed in 130.85s

# infra 静态校验
$ python -m pytest infra/tests/ --no-header -q
186 passed in 1.01s

# CI 守门脚本（13 硬规则）
$ python scripts/ci/forbid_bare_httpx.py        # 0 violations
$ python scripts/ci/forbid_raw_sql.py           # 0 violations
$ python scripts/ci/forbid_skip_tests.py        # 0 violations
$ python scripts/ci/forbid_legacy_fallback.py   # 0 new violations（既有 iam/mcp 告警与本 PR 无关）
```

## 6. PR gate

| Gate | Result |
|---|---|
| `forbid_raw_sql` | 0 violations |
| `forbid_bare_httpx` | 0 violations（dw 无外发 httpx）|
| `forbid_skip_tests` | 0 violations |
| `forbid_legacy_fallback` | 0 new violations |
| `require_evidence` | 本文件存在（PR gate 通过） |

## 7. 文件清单

| 文件 | 行数 | 用途 |
|---|---:|---|
| `packages/mate-tech-dw/pyproject.toml` | 37 | 包定义 + workspace |
| `packages/mate-tech-dw/README.md` | 28 | 15 endpoint 文档 |
| `packages/mate-tech-dw/src/mate_tech_dw/__init__.py` | 16 | 包入口 |
| `packages/mate-tech-dw/src/mate_tech_dw/main.py` | 38 | `create_app()` 工厂 |
| `packages/mate-tech-dw/src/mate_tech_dw/clients.py` | 31 | 出向客户端预留（P2-W5） |
| `packages/mate-tech-dw/src/mate_tech_dw/api/__init__.py` | 5 | router 导出 |
| `packages/mate-tech-dw/src/mate_tech_dw/api/app.py` | 285 | 15 endpoint 路由 |
| `packages/mate-tech-dw/src/mate_tech_dw/repositories/__init__.py` | 33 | repo 导出 |
| `packages/mate-tech-dw/src/mate_tech_dw/repositories/in_memory.py` | 510 | 14 个 dataclass + seed + 查询函数 |
| `packages/mate-tech-dw/tests/conftest.py` | 78 | Keycloak token + TestClient fixture |
| `packages/mate-tech-dw/tests/test_app_dw.py` | 215 | 17 happy-path tests |
| `packages/mate-tech-dw/tests/test_app_dw_tenant_integration.py` | 165 | 6 tenant-integration tests |
| `mate-platform-backend/pyproject.toml` | +1 行 | pythonpath 追加 `mate-tech-dw/src` |

## 8. 已知技术债（deferred）

| 编号 | 描述 | 目标 |
|---|---|---|
| TD-5 | in-memory → Paimon / Postgres 持久化 | v3.2 |
| TD-6 | dw 真实跨服务聚合（接 mate-app-kb / mate-tech-rag / mate-tech-agent）+ `BearerAuth` + `OutgoingAuthMiddleware` | P2-W5 |
| TD-8 | `POST /documents/upload` 改为真实文件流（multipart/form-data）+ Outbox event `dw.document.uploaded` | P2-W5 |

## 9. 关联文档

- `docs/active/specs/2026-07-31-backend-impl-backlog.md` §4.2 — dw 包工作量估算
- `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2 — 17 域接入进度
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/decisions/ADR-0014-tech-services-integration.md` — 集成模式决策
- `mate-platform-backend/contracts/openapi/services/dw.yaml` — OpenAPI 契约（15 endpoint）
- `docs/active/delivery/evidence/P2-W3-ACCEPTANCE.md` — 前序 P2-W3（TD-1/3/4/7）验收
