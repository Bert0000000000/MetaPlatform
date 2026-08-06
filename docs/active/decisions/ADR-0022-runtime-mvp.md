# ADR-0022 — v4 RUNTIME-MVP：合并 RUNTIME-HTTP-01 + RUNTIME-PG-03

**状态**：Accepted（2026-08-06）
**作者**：Codex（基于 v3.1 子计划收口 + 用户决策）
**关联文档**：
- v3.1 子计划 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- v4 BOARD `docs/active/delivery/V31-ONTOLOGY-BOARD.md` §6
- KERNEL-01 ADR-0021（12 基元 Protocol）
- 13 硬规则 `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13

---

## 背景

v3.1 Ontology 子计划（M1+M2+M3 = 20/20 Batch）已收口，但全部是 **Python library**：
- `mate_kernel/ontology/api.py:OntologyRepository` Protocol + `in_memory.py:InMemoryOntologyRepository` 实现
- 12 基元 dataclass（`ObjectType` / `Individual` / `ActionType` / `ObjectSet` ...）
- `ObjectSet` filter / sort 编译器（`objectset/compiler.py`，含 Bug A/B/C 修复）

仓库**不能对外服务**：没有 HTTP 入口、没有持久化、没有 K8s、没有 Keycloak 真集成。业务用户无法 `curl` 验收。

## 决策

### D1 — 在 mate-tech-ont 现有 FastAPI 服务里挂 v3.1 kernel HTTP 适配层

新增 `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`，把 KERNEL-01 Protocol 暴露为 5 核心 REST 端点：

| 端点 | method | 用途 |
|---|---|---|
| `/api/v1/ont/v2/object-types` | POST | upsert ObjectType |
| `/api/v1/ont/v2/object-types` | GET | list ObjectTypes (分页) |
| `/api/v1/ont/v2/object-types/{rid:path}` | GET | get one |
| `/api/v1/ont/v2/individuals` | POST | create Individual（rid prefix 强制等于 ctx.tenant） |
| `/api/v1/ont/v2/individuals` | GET | list (class_rid 过滤) |
| `/api/v1/ont/v2/object-sets:evaluate` | POST | 真消费 filter_expr + sort + paging |
| `/api/v1/ont/v2/action-types:apply` | POST | ActionType.apply（单合法写路径） |

每个 handler 都走 `mate_platform.tenancy.guards.require_tenant(ctx)` —— 直接复用 v3.0 SEC-TENANT-01 的 13 硬规则 #3 守门。

### D2 — Repository 后端由 env 切换：InMemory（dev）vs PG（prod）

`mate_tech_ont.main.on_startup` 读取 `KERNEL_BACKEND` env：
- `memory`（默认 dev）→ `InMemoryOntologyRepository`（KERNEL-01 已就位）
- `pg`（prod）→ `PgOntologyRepository`（RUNTIME-PG-03 新增，SQLAlchemy 2.x ORM）

### D3 — PgOntologyRepository 翻译 Protocol 到 ORM（不真生成 SQL DSL）

沿用 `persistence.py` 的 `PersistentOntologyRepository` Protocol 思路，扩展 SQLAlchemy 2.x ORM 建 5 表（`ont_object_type` / `ont_property` / `ont_individual` / `ont_link_type` / `ont_action_type`），把 KERNEL-01 Protocol 调用翻译到 ORM Session。**ObjectSet 真 SQL 生成留 v4 full-scope**——PG 后端直接用 InMemoryObjectSetExecutor 在 PG 查回内存再过滤（in-memory filter），保证 5 端点功能等价；后续 SQL 优化阶段由 RUNTIME-OPT 跟进。

### D4 — 复用既有 auth + tenant 中间件（0 新基础设施）

`install_auth(app)` + `_enforce_tenant_per_request` 中间件（main.py 已就位）自动覆盖 v2_kernel 路由：
- 401：未带 bearer token
- 403：`require_tenant(ctx)` 失败（13 硬规则 #3）
- 403（v2_kernel 层）：rid / class_rid prefix 与 ctx.tenant_id 不一致（额外防御层）

### D5 — 合并提速：原 RUNTIME-HTTP-01 + RUNTIME-PG-03 = 1 Batch

v4 BOARD 计划 4 周 + 4 周 = 8 周。**用户决策**：合并 1 Batch，目标 = 业务可 `curl` 验收。代价：
- 不实现 SQL DSL → SQL 编译（保留 InMemoryObjectSetExecutor 在 PG 后端做内存过滤）
- 不开 23 全 v2 operationId（先 7 端点；其余 16 待 v4 full-scope）
- 不接 Keycloak 真 JWT 验签（用 INSECURE_SKIP_SIGNATURE=1 dev profile；prod profile 由 IAM-COPILOT-04 跟进）

## 不在本 Batch 范围（v4 后续）

- RUNTIME-OPT：ObjectSet 真 SQL 生成
- RUNTIME-K8S-02：真 K8s Job 调度
- IAM-COPILOT-04：Keycloak 真鉴权 + Kernel ManagerContext
- MARKETPLACE-05：Marketplace 真上架
- 其余 16 个 v2 operationId

## 验证

```bash
# 1. 单测不破（392/392 pass）
cd mate-platform-backend
python -m pytest packages/mate-kernel/tests/ -q

# 2. v2 kernel e2e（7/7 pass）
python -m pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_e2e.py -v

# 3. 端到端 curl 验收
bash examples/02_curl_walkthrough.sh
# 期望：ObjectSet 真过滤 3/5 hit；Action apply 落 audit_id
```

## 收口证据

- `docs/active/delivery/evidence/RUNTIME-MVP-01-ACCEPTANCE.md`
- `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/__init__.py`
- `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py`
- `packages/mate-tech-ont/tests/integration/test_v2_kernel_e2e.py`
- `examples/02_curl_walkthrough.sh`