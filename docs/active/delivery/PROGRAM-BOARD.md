# Mate Platform 交付项目计划板（Program Board）

> 更新时间：2026-07-30
> 本表跟踪各交付批次在契约、代码、测试、运行时和验收证据上的当前状态。

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| API-GOV-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ local/docs | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` |
| SEC-IAM-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-IAM-01-ACCEPTANCE.md` |
| SEC-TENANT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-TENANT-01-ACCEPTANCE.md` |
| PLATFORM-EVENT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-EVENT-01-ACCEPTANCE.md` |
| TECH-SERVICES | **Accepted** | ✓ | ✓ | 7/17 ✓ | ⏳ 10/17 P2 | `evidence/TECH-SERVICES-ACCEPTANCE.md` |
| GA-ACCEPTANCE | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/GA-ACCEPTANCE.md` |
| BUSINESS-SLICES | **Accepted** | ✓ | ✓ | 7/17 ✓ | ⏳ 10/17 P2 | `evidence/BUSINESS-SLICES-ACCEPTANCE.md` |
| **DATA-D0-D8** | **D0 Accepted** (⏳ D1-D8) | ✓ | partial | 6/6 ✓ | partial | `evidence/DATA-D0-D8-D0-ACCEPTANCE.md` |

## 状态说明

- **Not Started**：批次尚未启动，尚未产出任何交付物。
- **In Progress**：已启动并在契约、代码或测试任一维度上推进，但尚未闭环验收。
- **Blocked**：存在阻塞依赖或外部决策，需协调后才能恢复推进。
- **Accepted**：交付完成、证据闭环、CI 全绿、Owner 已签字。

## v3.0 GA + v3.1 增量

9 个核心批次中 9 个 Accepted;TECH-SLICES 7/17 域已接入;DATA-D0-D8 D0 sub-batch 落地(debezium + marquez chart 完整,datahub + ge stub),D1-D8 在后续子批推进。

## 已完成批次时间线

| 批次 | 接受日期 | Commit | 证据 |
|---|---|---|---|
| API-GOV-01 | 2026-07-30 | 1fa521fd | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | 2026-07-30 | eeaab5c5 | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | 2026-07-30 | 4d0b73d6 | `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` |
| SEC-IAM-01 | 2026-07-30 | 4d3d894e | `evidence/SEC-IAM-01-ACCEPTANCE.md` |
| SEC-TENANT-01 | 2026-07-30 | 026ce4a8 | `evidence/SEC-TENANT-01-ACCEPTANCE.md` |
| PLATFORM-EVENT-01 | 2026-07-30 | 95b35e43 | `evidence/PLATFORM-EVENT-01-ACCEPTANCE.md` |
| TECH-SERVICES | 2026-07-30 | 7fa52dc8 | `evidence/TECH-SERVICES-ACCEPTANCE.md` |
| GA-ACCEPTANCE | 2026-07-30 | 87f589be | `evidence/GA-ACCEPTANCE.md` |
| BUSINESS-SLICES | 2026-07-30 | 5f53524a + b85d8c89 + 41bef84d | `evidence/BUSINESS-SLICES-ACCEPTANCE.md` |
| DATA-D0-D8 D0 | 2026-07-30 | 2ee18610 | `evidence/DATA-D0-D8-D0-ACCEPTANCE.md` |