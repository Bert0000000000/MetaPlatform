# ADR-0021: Ontology Kernel 12 基元冻结

> 状态：Draft v0.1 · 日期：2026-08-06 · 决策人：TBD
>
> 上游：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 §3
> 关联：MP-ONT-KERNEL-01 / MP-ONT-MODEL-02 / MP-ONT-ACTION-03

## 1. 背景

MetaPlatform 现有 `mate-kernel` 仅有 5 个空 Protocol（entity/value/event/error/result），本体相关能力散落在 `mate-tech-ont` 的 OWL 风格 5 张 ORM 表中，且存在双租户上下文、SPARQL bug、回滚缺失等 10+ 处缺口。Blueprint v0.4 要求把本体作为一等公民纳入 Kernel，定义 12 个不可再分的基元。

## 2. 决策

冻结 12 个 Kernel 基元（按 5 层组织）：

| 层 | 基元 | rid 形如 | 不可变 |
|---|---|---|---|
| 标识 | `ClassRef` | `ont.<tenant>.cls.<slug>` | — |
| 标识 | `Version` | `ont.<tenant>.ver.<rid>.<n>` | ✅ |
| 类型 | `Property` | `ont.<tenant>.prop.<type>.<slug>` | ✅ |
| 类型 | `ObjectType` | `ont.<tenant>.obj.<slug>` | ✅ |
| 类型 | `LinkType` | `ont.<tenant>.link.<slug>` | ✅ |
| 类型 | `ActionType` | `ont.<tenant>.act.<slug>` | ✅ |
| 类型 | `Interface` | `ont.<tenant>.if.<slug>` | ✅ |
| 实例 | `Individual` | `ont.<tenant>.ind.<type>.<pk>` | ❌ 可变 |
| 实例 | `LinkInstance` | `ont.<tenant>.lnk.<link>.<sid>.<did>` | ❌ 可变 |
| 推理 | `Axiom` | `ont.<tenant>.ax.<kind>.<slug>` | ✅ |
| 函数 | `Function` | `ont.<tenant>.fn.<slug>.<ver>` | ✅ |
| 查询 | `ObjectSet` | `ont.<tenant>.oset.<hash>` | ❌ 一次性 |

**强约束**：

- 12 基元 API 签名**一旦冻结不得随意变更**；变更需新 ADR
- 所有上层 Batch 必须消费这 12 基元，不得再引入新的"基元"
- 任何 ActionType 的写操作必须经 `ActionType.apply`，并产生 outbox 事件 + ADS 审计
- 任何 Individual / LinkInstance 的读写必须经 `ObjectSet` 编译器或 `TenantScopedRepository`，**不得**裸 SQL

## 3. OWL 兼容层（L1 锁死）

- 一次性数据迁移：把 `OntologyClassORM / OntologyInstanceORM / OntologyRelationORM / OntologyVersionORM` 数据迁到 v2 新表
- 旧表 deprecate，但保留 `owl/io.py` 作为**导入导出**入口
- 迁移窗口：MP-ONT-KERNEL-01 内 1 周；回滚窗口 7 天

## 4. 双租户上下文统一

- 弃用 `mate-tech-ont/security/tenant.py:12-37`
- 全部走 `mate_platform/tenancy/context.py:15-54` 的 `RequestContext`
- KERNEL-01 内做替换，CI 加 `forbid_legacy_tenant_ctx.py`

## 5. 验收

- 12 个基元每个有 Protocol/dataclass + ≥3 单测
- ≥60 tests（5 × 12 = 60 起步）
- OpenAPI 先行：12 个基元对应 schema 全部入 `ont.yaml` + ADR 引用
- `mp-ont-kernel-01-ACCEPTANCE.md` 通过 GA CI
- 13 硬规则 ①/③/④/⑤/⑥/⑨/⑩/⑬ 全部对位

## 6. 影响

- MP-ONT-KERNEL-01 / MP-ONT-MODEL-02 / MP-ONT-ACTION-03 / MP-ONT-OBJECTSET-04 全部依赖
- 一旦冻结，后续 17 个 Batch 不能绕过
- ADR-0040（沙箱）/ ADR-0041（Session）引用本 ADR 的 12 基元

## 7. 替代方案与拒绝理由

- **保持 5 个空 Protocol + 业务侧 ORM**：被拒——业务重复造轮子，跨域一致性难
- **直接用 OWL 2 推理（HermiT / Pellet）**：被拒——性能不足以承载业务 ObjectSet
- **完全照搬 Palantir 闭源服务**：被拒——不可行 + 自建原则
