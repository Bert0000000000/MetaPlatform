# Mate Platform 交付项目计划板（Program Board）

> 更新时间：2026-07-30（**v3.0 GA 收口**）
> 本表跟踪各交付批次在契约、代码、测试、运行时和验收证据上的当前状态。

| Batch | 状态 | Contract | Code | Tests | K8s/Runtime | 证据路径 |
|---|---|---:|---:|---:|---:|---|
| API-GOV-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ local/docs | `evidence/API-GOV-01-ACCEPTANCE.md` |
| ARCH-CORE-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/ARCH-CORE-01-ACCEPTANCE.md` |
| PLATFORM-K8S-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` |
| SEC-IAM-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-IAM-01-ACCEPTANCE.md` |
| SEC-TENANT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/SEC-TENANT-01-ACCEPTANCE.md` |
| PLATFORM-EVENT-01 | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/PLATFORM-EVENT-01-ACCEPTANCE.md` |
| TECH-SERVICES | **Accepted** | ✓ | ✓ | 1/17 ✓ | ⏳ 16/17 P0/P1/P2 | `evidence/TECH-SERVICES-ACCEPTANCE.md` |
| **GA-ACCEPTANCE** | **Accepted** | ✓ | ✓ | ✓ | ✓ | `evidence/GA-ACCEPTANCE.md` |
| BUSINESS-SLICES | Not Started | planned/placeholder | ⏳ | ⏳ | ⏳ | — |
| DATA-D0-D8 | Not Started | planned | ⏳ | ⏳ | ⏳ | — |

## 状态说明

- **Not Started**：批次尚未启动，尚未产出任何交付物。
- **In Progress**：已启动并在契约、代码或测试任一维度上推进，但尚未闭环验收。
- **Blocked**：存在阻塞依赖或外部决策，需协调后才能恢复推进。
- **Accepted**：交付完成、证据闭环、CI 全绿、Owner 已签字。

## v3.0 GA 收口

8 个核心批次全部 Accepted。GA-ACCEPTANCE 收口 §13 硬规则 1-13：
pre-commit 钩子（7）+ CI jobs（7）+ 测试覆盖三层保障闭环。

后续 BUSINESS-SLICES（17 域 P0/P1/P2 接入）与 DATA-D0-D8（数据平台）是 v3.1 增量工作。

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