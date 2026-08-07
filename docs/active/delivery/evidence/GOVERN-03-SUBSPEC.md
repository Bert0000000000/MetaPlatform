# GOVERN-03 子 Spec 索引

> 编制：2026-08-07 · 维护：MatePlatform Architecture Council
> 关联：GOVERN-03 顶层 spec + ADR-0021 + `evidence/MP-ONT-V1-SUNSET-NOTICE.md`
> 状态：**In Progress**（子 spec 拆分完成，逐项接力落地）

## 总览

GOVERN-03 = 6 个子 spec；当前进度：✅ 子 spec-01（Sunset 头 + tenant 白名单 + Sunset 文档）。剩余 5 个按依赖序接力。

## 子 Spec 列表

| ID | 子 Spec | 范围 | 前置 | 状态 | 估计影响 tests |
|---|---|---|---|---|---:|
| ✅ 03-01 | Sunset 头 + tenant 白名单 + Sunset 通知文档 | `main.py:1-58,86-104`；`evidence/MP-ONT-V1-SUNSET-NOTICE.md` | — | **Accepted** | 0 |
| 03-02 | sparql/cypher tenant guard（必传 RequestContext + namespace 防伪造） | `sparql/cypher.py:123-152` + `instances/store.py:102` | 03-01 | Planned | ~10 |
| 03-03 | StoreProxy：强制 tenant namespace；删除 module singleton | `instances/store.py` + `sparql/api.py` | 03-02 | Planned | ~6 |
| 03-04 | neo4j_repo.create_node 等 `@deprecated` + 启动 warn log | `repos/neo4j_repo.py:33` | 03-01 | Planned | ~2 |
| 03-05 | ont.yaml x-sunset 标注 + openapi-ci lint `x-migration-target` | `contracts/openapi/services/ont.yaml` + `openapi-ci.yml` | 03-01 | Planned | 0 |
| 03-06 | test_cypher_tenant_guard.py ≥4 攻击向量 + accept | `packages/mate-tech-ont/tests/` | 03-02 / -03 | Planned | ≥4 |

## 子 Spec 03-02 详细（sparql/cypher tenant guard）

### 范围

- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/sparql/cypher.py:123-152`
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/instances/store.py:102`（module-level singleton）

### 当前漏洞

1. `_execute_inmemory` 直接 import `from mate_tech_ont.instances.store import store as instance_store`（模块级单例）
2. `tenant_id` 接受 `None` —— 攻击者可构造 `tenant_id=None` payload 绕过
3. namespace 比较使用 `i.namespace == tenant_id` —— 没有 `ont.<tenant>.` 前缀校验；payload.namespace 可被前端伪造成任意值

### 动作

1. `_execute_inmemory(parsed: ParsedQuery, ctx: RequestContext)` 改为必传 `RequestContext`（去掉 `tenant_id: str | None`）
2. `instances.store` 删除 module singleton；改 `class InstanceStoreProxy` + DI 注入到 `_execute_inmemory`
3. namespace 拼接统一为 `f"ont.{ctx.tenant_id}."` 前缀；payload.namespace 若不以此前缀开头则抛 `TenantAccessError`
4. `sparql/api.py` 路由处理器显式取 `request.state.ctx`，不再 fallback 到 payload 字段

### 验收

```bash
pytest packages/mate-tech-ont/tests/security/test_cypher_tenant_guard.py -v
# 4 攻击向量：
# 1) tenant_id=None payload → 401
# 2) payload.namespace='acme' 但 ctx.tenant_id='other' → 403
# 3) payload.namespace='ont.other.acme'（前缀伪造） → 403
# 4) 跨租户 namespace 越权读 → 0 行
```

### 关联 ADR

ADR-0021 §4（双租户上下文统一） + `forbid_legacy_tenant_ctx.py`（scripts/ci/）

## 子 Spec 03-03 详细（StoreProxy）

### 范围

`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/instances/store.py`

### 动作

1. `store` 单例删除
2. 新增 `class InstanceStoreProxy`：`set/get/list/delete` 都接受 `RequestContext`，内部用 `f"ont.{ctx.tenant_id}.{namespace}"` 拼接实际 key
3. `sparql/api.py:30-52`（之前盘点为"未挂 `_ctx/require_tenant`"）改走 `InstanceStoreProxy(request.state.ctx)`
4. tests 中 mock 现有 module singleton 的写法改为 DI

### 验收

```bash
grep -RE 'mate_tech_ont\.instances\.store\.singleton|singleton_store' packages/mate-tech-ont/src  # 0
pytest packages/mate-tech-ont/tests/ -q  # 全绿
```

## 子 Spec 03-04 详细（neo4j_repo @deprecated）

### 范围

`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/repos/neo4j_repo.py:33`

### 动作

1. `Neo4jGraphRepository.create_node / get_node / create_edge / find_path` 加 `@deprecated("v3.1 → v2_kernel ObjectSet; GOVERN-03")`
2. `_warn_unused()` 在 `main.py:on_startup` 触发一次 `WARN` log（说明 Neo4j 实例化但无生产调用）
3. compose 端口 `NEO4J_BOLT_URL` 环境变量保留（运维审计需要），但 `Neo4jGraphRepository` 实例化放 `profiles: ["legacy-ont"]` 默认不启

### 验收

```bash
pytest packages/mate-tech-ont/tests/ -q  # 全绿
python -c "from mate_tech_ont.main import app" 2>&1 | grep -i 'neo4j deprecated'
```

## 子 Spec 03-05 详细（ont.yaml x-sunset + openapi-ci lint）

### 范围

- `mate-platform-backend/contracts/openapi/services/ont.yaml`
- `mate-platform-backend/contracts/scripts/`（新增 `lint_sunset_headers.py`）

### 动作

1. ont.yaml 每个 v1 endpoint 加 `x-sunset: "2026-12-31"` + `x-migration-target: /api/v1/ont/v2/...`
2. `openapi-ci.yml` 新增 job `lint-sunset-headers`：跑 `python contracts/scripts/lint_sunset_headers.py`；FAIL on `WARN`
3. bundled.yaml 重生成（`contracts/openapi/generated/bundled.yaml`）

### 验收

```bash
python contracts/scripts/lint_sunset_headers.py  # exit 0
oasdiff lint contracts/openapi/services/ont.yaml --fail-on WARN  # exit 0
```

## 子 Spec 03-06 详细（test_cypher_tenant_guard.py）

### 范围

`mate-platform-backend/packages/mate-tech-ont/tests/security/test_cypher_tenant_guard.py`（新建）

### 动作

1. ≥4 攻击向量 case（见 03-02 验收）
2. 用 `pytest-asyncio` + `httpx.AsyncClient` 跑 FastAPI in-process
3. 接入 `mate-platform-backend/pyproject.toml:95` pythonpath

### 验收

```bash
pytest packages/mate-tech-ont/tests/security/test_cypher_tenant_guard.py -v  # ≥4 全绿
```

## 整体 GOVERN-03 收口（5 周末）

- 6 个子 spec 全部 Accepted
- `evidence/MP-ONT-V1-SUNSET-NOTICE.md` 中所有 v1 endpoint 在前端无调用（grep `metaplatform-frontend/apps/web/src` 0 命中 `/api/v1/ont/(instances|sparql|...)`）
- main.py v1 router 代码移 `_legacy/v1/`，启动日志 `DeprecationWarning`
- 整体 GOVERN-03 在 PROGRAM-BOARD 升 `Accepted`
