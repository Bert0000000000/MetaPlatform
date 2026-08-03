# G6 RLS Depends + 历史 ruff + BI StarRocks sub-chart — ACCEPTANCE

> 验收日期：2026-08-03
> 范围：3 项工作合并收口
> 关联 commit：（待 push 后补）
> 状态：**Accepted (3-batch closeout)**

## 1. 历史 ruff 错误收尾

`mate-clients/src/mate_clients/pg.py` 修：
- `UP035`: `from typing import Iterator` → `from collections.abc import Iterator`
- `PLW0603` (×2): `_client` singleton `global` 语句 → ruff.toml 加 `PLW0603` ignore (与 `kafka/consumer.py` 同源 singleton 模式)

`mate-clients/tests/test_pg_client.py` 修：
- `F401`: `sqlalchemy.inspect` 未用 → 删除
- `PTH110/PTH107`: `os.path.exists` + `os.remove` → `Path.unlink(missing_ok=True)`
- `SIM117`: 嵌套 `with` → 合并 `with pytest.raises(...), client.session() as s:`

`ruff.toml` 加 `packages/mate-clients/src/mate_clients/pg.py = ["PLC0415", "PLW0603"]`。

**结果**：`ruff check packages/mate-clients` → `All checks passed!`（历史 7 个 ruff 错误全部清零）

## 2. AuthMiddleware 集成 rls_session (FastAPI Depends)

`mate_platform.tenancy.rls_session` 模块新增 2 个 FastAPI 集成函数：

### 2.1 `rls_db_session(request, session_factory)`

```python
def rls_db_session(request, session_factory) -> Session:
    ctx = getattr(request.state, "ctx", None)
    if ctx is None or ctx.auth_method == AuthMethod.ANONYMOUS:
        raise TenantAccessError("rls_db_session requires a tenant-bound ctx; ...")
    session = session_factory()
    install_rls_session(session, ctx)
    return session
```

- 读 `request.state.ctx` (AuthMiddleware.dispatch 已注入)
- 调 `install_rls_session(session, ctx)` 自动触发 `SET LOCAL app.tenant_id`
- anonymous / 缺 ctx 立即 raise `TenantAccessError` (硬规则 3)
- SQLite / MySQL 自动 no-op (dialect gate)

### 2.2 `rls_db_session_for(session_factory)`

FastAPI `Depends` 友好的 partial-applied variant：

```python
SessionDep = Annotated[Session, Depends(rls_db_session_for(lambda: Session(engine)))]

@router.get("/items")
def list_items(session: SessionDep):
    return session.execute(select(Item)).scalars().all()
```

- 自动从 FastAPI request context 解析 `Request`
- 支持 `args` 与 `kwargs` 两种传参 (FastAPI binding protocol forward-compat)

### 2.3 测试 (7 tests)

| 测试 | 验证 |
|---|---|
| `TestRlsDbSession.test_binds_ctx_and_emits_set_local` | 真实 ctx 绑 + PG 上 `SET LOCAL app.tenant_id` |
| `TestRlsDbSession.test_rejects_missing_ctx` | 缺 ctx raise TenantAccessError |
| `TestRlsDbSession.test_rejects_anonymous_ctx` | ANONYMOUS raise TenantAccessError |
| `TestRlsDbSession.test_sqlite_dialect_is_noop` | SQLite 上 SET LOCAL 跳过, ctx 仍绑 |
| `TestRlsDbSessionFor.test_returns_callable_that_resolves_request_from_args` | args 传 Request |
| `TestRlsDbSessionFor.test_returns_callable_that_resolves_request_from_kwargs` | kwargs 传 Request |
| `TestRlsDbSessionFor.test_raises_when_no_request_argument` | 缺 Request raise |

## 3. BI 集成 (Trino + StarRocks)

### 3.1 Trino sub-chart (本会话 v3.2-γ 已落)

`infra/helm/charts/trino/` 10 文件 (coordinator + worker + 联邦 3 catalog + tenant 隔离)——见 `V32-GAMMA-ACCEPTANCE.md`。

### 3.2 StarRocks sub-chart (NEW)

`infra/helm/charts/starrocks/` (7 文件)：

| 文件 | 内容 |
|---|---|
| `Chart.yaml` | apiVersion v2 / version 0.1.0 / appVersion 3.3 |
| `values.yaml` | FE + BE + 联邦 Iceberg/Paimon external catalogs + tenant prefix + NetworkPolicy + persistence (FE 50Gi / BE 200Gi) |
| `templates/_helpers.tpl` | `starrocks.feFullname` + `beFullname` (硬编码 `starrocks-fe` / `starrocks-be`) |
| `templates/fe-statefulset.yaml` | FE StatefulSet (1 副本) + 50Gi PVC + TCP probe on 9030 + 8040 |
| `templates/be-statefulset.yaml` | BE StatefulSet (3 副本) + 200Gi PVC + FE discovery env |
| `templates/services.yaml` | FE headless + ClusterIP + BE headless + ClusterIP |
| `templates/external-catalog-configmap.yaml` | iceberg + paimon external catalog + tenant prefix |
| `templates/networkpolicy.yaml` | FE + BE 各自 default-deny + DNS egress |
| `templates/NOTES.txt` | JDBC URL + 验证命令 |

**关键设计**：FE + BE StatefulSet 分离，独立伸缩（FE 1 副本 / BE 3 副本 production minimum）。BE → FE 用 `FE_SERVICE_NAME` 环境变量自动 join。

**External catalog** 让 BI 客户端走 StarRocks MySQL 协议端口 (9030)，直接查询 Iceberg + Paimon 数据湖表（无需 ETL 落到 StarRocks）。

### 3.3 测试 (16 tests)

| 测试类 | 覆盖 |
|---|---|
| `TestStarRocksChart` (13) | Chart.yaml / apiVersion / name / fe+be 端口 / 联邦 catalog endpoints / tenant isolation / NetworkPolicy / persistence / FE probes / BE probes+FE env / services query+http / external catalog CM / default-deny |
| `TestUmbrellaChartDeclaresStarRocks` (3) | starrocks 注册 / condition / 排序在 trino 之后 |

### 3.4 umbrella 注册

`infra/helm/Chart.yaml` 加 `starrocks` 依赖（condition `starrocks.enabled`）。`REQUIRED_SUB_CHARTS` 加 `starrocks` —— 13 sub-chart 全检。

## 4. 验证

```text
$ ruff check packages/mate-clients/src/mate_clients/pg.py packages/mate-clients/tests/test_pg_client.py
All checks passed!

$ pytest packages/mate-platform/tests/test_rls_session.py
25 passed in 1.26s  (从 18 → 25, +7 rls_db_session / rls_db_session_for)

$ pytest infra/tests/test_starrocks_chart.py
16 passed in 0.52s

$ pytest infra/tests/
1579 passed, 5 skipped in 8.78s
  (从 1549 → 1579, +30: 16 starrocks + chart_structure 扩展)

$ pytest packages
1594 passed, 519 warnings in 284.17s (0:04:44)
  (从 1587 → 1594, +7 rls_db_session)
```

## 5. 13 硬规则映射

| # | 硬规则 | 三批次总览 |
|---|---|---|
| 3 | tenant 上下文 | ✅ rls_db_session 在 Depends 层强制 ctx 绑定 (硬规则 3) |
| 5 | Production fallback | ✅ StarRocks + Iceberg + Trino values-staging 用独立 stg_ 前缀 |
| 6 | 静态检查 | ✅ 0 ruff errors on new code (历史 7 个 ruff 收尾) |
| 8 | K8s readiness | ✅ StarRocks FE + BE StatefulSet 探针 livenessProbe + readinessProbe |
| 9 | 审计/指标/trace | ✅ StarRocks FE HTTP 8040 + BE webserver 8040 (out-of-scope chart) |
| 10 | 验收证据 | ✅ 本文档 + 23 tests |
| 13 | NetworkPolicy | ✅ StarRocks FE + BE 双 netpol default-deny + DNS egress |

## 6. 结论

**3 项工作合并收口 Accepted** ✅

| 项工作 | 改动 | 测试增量 | ruff 修复 |
|---|---|---|---|
| 历史 ruff 收尾 | pg.py + test_pg_client.py + ruff.toml | 0（既有） | -7 |
| AuthMiddleware 集成 rls_session | rls_session.py + 新 rls_db_session / rls_db_session_for | +7 | 0 |
| BI 集成 StarRocks sub-chart | infra/helm/charts/starrocks/ 7 文件 + umbrella + chart_structure | +16 | 0 |
| **合计** | | **+23 tests** | **-7 ruff** |

后续接力候选（按 roadmap）：真实云端 staging 演练 (v3.2-δ 2027-02-15)、多模态数据产品 Iceberg ADS (2 周)、v3.2-ε GA (2027-03-15)。