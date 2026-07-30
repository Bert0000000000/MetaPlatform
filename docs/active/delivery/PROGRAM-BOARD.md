# Mate Platform 交付项目计划板（Program Board）

> 更新时间：2026-07-30
> 本表跟踪各交付批次在契约、代码、测试、运行时和验收证据上的当前状态。

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| API-GOV-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ local/docs | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | Not Started | ⏳ | ⏳ | ⏳ | ⏳ | — |
| SEC-IAM-01 | Not Started | planned | ⏳ | ⏳ | ⏳ | — |
| SEC-TENANT-01 | Not Started | planned | ⏳ | ⏳ | ⏳ | — |
| PLATFORM-EVENT-01 | Not Started | planned | ⏳ | ⏳ | ⏳ | — |
| TECH-SERVICES | Not Started | mixed | partial legacy | ⏳ | ⏳ | — |
| BUSINESS-SLICES | Not Started | planned/placeholder | ⏳ | ⏳ | ⏳ | — |
| DATA-D0-D8 | Not Started | planned | ⏳ | ⏳ | ⏳ | — |
| GA-ACCEPTANCE | Not Started | ⏳ | ⏳ | ⏳ | ⏳ | — |

## 状态说明

- **Not Started**：批次尚未启动，尚未产出任何交付物。
- **In Progress**：已启动并在契约、代码或测试任一维度上推进，但尚未闭环验收。
- **Blocked**：存在阻塞依赖或外部决策，需协调后才能恢复推进。
- **Accepted**：交付完成、证据闭环、CI 全绿、Owner 已签字。

## 后续计划

按上下游依赖顺序：`ARCH-CORE-01` 与 `PLATFORM-K8S-01` 在 API-GOV-01 完成后并行启动；其后 SEC-IAM-01、SEC-TENANT-01、PLATFORM-EVENT-01 解锁；最后再进入技术服务与业务域迁移。HTTP 网关与 canonical OpenAPI 由 API-GOV-01 提供基线。