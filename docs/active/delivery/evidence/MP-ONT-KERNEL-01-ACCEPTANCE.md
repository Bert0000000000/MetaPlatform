# MP-ONT-KERNEL-01 ACCEPTANCE

> 起草：2026-08-06 · 状态：**Accepted**（KERNEL-01 内部收口，5 个兄弟 Batch 后续补）
> 关联 ADR：ADR-0021（Kernel 12 基元）/ ADR-0040（Function Sandbox）/ ADR-0041（Session Sandbox）
> Worktree：`.worktrees/mp-ont-kernel-01`，分支 `refactor/mp-ont-kernel-01`

## 1. 范围

KERNEL-01 Batch（M1 第 1 周）：把 v3.0 GA 期间仅以"理念 + 旧 OWL 实体"存在的 Ontology 资产，提升到 v3.1 增量所需的 **12 个不可变 / 可变基元** + 协议 + service-layer + serde + OpenAPI 契约 + 迁移工具 + 双租户 ctx 的统一入口。

不在本 Batch 范围（后续 Batch）：M1 后续 / M2 / M3 — 已记录于 `docs/active/delivery/V31-ONTOLOGY-BOARD.md`。

## 2. 交付清单

| # | 资产 | 路径 |
|---|---|---|
| 1 | 12 基元 dataclass | `packages/mate-kernel/src/mate_kernel/ontology/{identity,types,instances,reasoning,query}/` |
| 2 | serde 模块 | `packages/mate-kernel/src/mate_kernel/ontology/serde/{__init__,codec,serde}.py` |
| 3 | service-layer Protocol + InMemory repo | `packages/mate-kernel/src/mate_kernel/ontology/{api,in_memory}.py` |
| 4 | OWL v1 → v2 迁移脚本 | `packages/mate-kernel/src/mate_kernel/ontology/migrate_v1_v2.py` + `tests/fixtures/owl_sample.nt` |
| 5 | 双租户上下文统一 | `packages/mate-kernel/src/mate_kernel/ontology/tenant.py` |
| 6 | OpenAPI 增量（23 v2 端点） | `contracts/openapi/services/ont.yaml` |
| 7 | 旧租户 ctx 守门 hook | `scripts/ci/forbid_legacy_tenant_ctx.py` |
| 8 | 启动 README | `packages/mate-kernel/README-KERNEL-01.md` |
| 9 | 测试集（111 tests pass） | `packages/mate-kernel/tests/` |

## 3. 13 硬规则对位

| # | 硬规则 | 本 Batch 实施 | 守门 |
|---|---|---|---|
| 1 | Swagger 没有接口，不写 route | 12 基元端点契约写入 `ont.yaml`（23 v2 operationId） | `contracts/openapi/services/ont.yaml` + oasdiff |
| 2 | PRD 没有 Requirement ID | 23 operationId 各挂 `FR-ONT-KERNEL01-*` | `manifest.yaml` 收录 |
| 3 | **没有 tenant 上下文，不访问 repository** | `ontology/tenant.py` + `assert_same_tenant` + 14 tests | `test_tenant_ctx.py` |
| 4 | 外部系统没有 ACL Client | KERNEL-01 不依赖外部系统（纯 in-memory + dataclass） | 无 |
| 5 | Production profile 禁止 fallback | 不引入 fallback（dev/in-memory repo 显式标注） | `InMemoryOntologyRepository` 命名 |
| 6 | 静态检查失败不合并 | 全部用 stdlib + `dataclass` + `enum`，无 type errors | ruff 须通过 |
| 7 | 契约或集成测试跳过不标记 Accepted | **111/111 tests pass，无 skip** | `tests/` |
| 8 | 没有 K8s readiness + 回滚 | KERNEL-01 不部署 runtime，仅 library | N/A（runtime 在 mate-tech-ont-v2 后续 Batch） |
| 9 | 没有审计、指标、trace | `apply_action` 返回 `(datetime, side_effects)`，提供 OTel hook 点 | KERNEL-02+ 实现 |
| 10 | 所有状态以验收证据为准 | 本文档 | `MP-ONT-KERNEL-01-ACCEPTANCE.md` |
| 11 | helm-docs 同步 | N/A（KERNEL-01 无 helm chart） | N/A |
| 12 | Secret 不进 git | 代码无 secret | gitleaks 默认扫描 |
| 13 | NetworkPolicy 缺失 = prod 不通过 | N/A（runtime 在后续 Batch） | N/A |

## 4. 风险与回退

| 风险 | 触发 | 缓解 |
|---|---|---|
| 旧 OWL/SPARQL 端点被破坏 | ont.yaml YAML 错误 | KERNEL-01 **仅追加** v2 路径，旧路径/操作未触碰；已用 yaml.safe_load 验证 26 paths / 39 operations |
| rid 正则过严 | 迁移脚本里大写 OWL 名空间 | `_local()` lowercase + `_strip_brackets()`；测试覆盖 N-Triples 输入 |
| 双租户 ctx 缺漏 | runtime 写裸 SQL 绕过 ctx | `forbid_legacy_tenant_ctx.py` 拒绝 `from mate_tech_ont.security.tenant import` |

## 5. 后续 Batch 接力（v3.1 M1）

- W3-W7（W3 已完成）：OpenAPI / FastAPI runtime / OWL migration / dual tenant / 13 硬规则对位 + ACCEPTANCE
- MODEL-02 / SANDBOX-01 / SESSION-01 / AIP-GATEWAY-01 / AGENT-ORCH-01：见 `docs/active/delivery/V31-ONTOLOGY-BOARD.md`

## 6. 测试

```bash
cd packages/mate-kernel
python -m pytest tests/ -v
# 111 passed
```

测试覆盖：
- `test_ontology_primitives.py`（43）— 12 基元 dataclass 不变量
- `test_ontology_serde.py`（28）— to_dict/from_dict round-trip + rid codec + 错误路径 + 跨基元
- `test_ontology_api.py`（17）— `OntologyRepository` Protocol + `InMemoryOntologyRepository`
- `test_migrate_v1_v2.py`（5）— N-Triples 解析 + CLI 端到端
- `test_tenant_ctx.py`（14）— TenantContext / set/require / 跨租户禁止
- `test_types.py`（4）— baseline

## 7. 链接

- 蓝图：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4
- ADR-0021：`docs/active/decisions/ADR-0021-kernel-12-primitives.md`
- 任务板：`docs/active/delivery/V31-ONTOLOGY-BOARD.md`
- 启动 README：`packages/mate-kernel/README-KERNEL-01.md`