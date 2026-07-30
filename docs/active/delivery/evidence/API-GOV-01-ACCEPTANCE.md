# API-GOV-01 验收证据

> 验收日期：2026-07-30
> 分支：`codex/api-gov-01`
> Worktree：`.worktrees/api-gov-01`
> 结论：**Accepted**

## 1. 交付目标

API-GOV-01 批次的治理基线覆盖以下范围：

1. `mate-platform-backend/contracts/openapi/` 作为唯一契约源，承载所有 OpenAPI 契约。
2. 17 个领域契约文件（17 个 domain）按 Owner / 权限 / Requirement / operationId 标注完成。
3. 通过 Redocly bundle 生成单一聚合文件 `openapi/generated/bundled.yaml`。
4. 通用组件（Common Schemas）覆盖 Tracing、Tenancy、错误与分页。
5. 与 PRD Requirement、operationId 双向可追溯。
6. 与 FastAPI Runtime OpenAPI 做差异校验（Runtime Parity）。
7. 本地可通过 Swagger UI、Redoc 与 Prism（local/docs profile）查阅与 Mock。
8. CI 接入 Redocly、Spectral、Bundle drift、Traceability、Runtime parity、oasdiff。
9. 迁移旧文档 `docs/legacy/api/` 仅作为历史归档，不再作为新决策依据。
10. planned、placeholder、implemented 三类 operation 在 spec 中显式区分。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| 领域 | 17 |
| Paths | 214 |
| Operations | 248 |
| PRD Requirements | 248 |
| implemented | 48 |
| placeholder | 73 |
| planned | 127 |
| Breaking removals | 4 |
| bundled.yaml | 243,878 bytes |

`placeholder` 与 `planned` 视为 `notAccepted`，不计入 Acceptance Gate。

## 3. 验收检查项

| 检查项 | 命令 | 结果 |
|---|---|---|
| 依赖安装 | `npm ci` | PASS（537 packages） |
| Bundle | `npm run bundle` | PASS |
| Redocly | `npm run lint:redocly` | PASS（0 errors/warnings） |
| Spectral | `npm run lint:spectral` | PASS（0 errors） |
| 契约单测 | `pytest contracts/tests -q` | PASS（28 passed） |
| 契约校验 | `validate_contracts.py` | PASS（exit 0） |
| PRD 追溯 | `validate_traceability.py` | PASS（exit 0） |
| Runtime 抓取 | `runtime_openapi.py` | PASS（exit 0） |
| Runtime 对比 | `compare_runtime.py` | PASS（0 missing / 0 undocumented） |
| Compose | `docker compose --profile docs config --quiet` | PASS |
| 包内单测 | `pytest packages -q` | PASS（246 passed，23 warnings） |
| 单一源 | `test_single_source.py` | PASS |

## 4. 运行时验证

| 资源 | URL | 状态 |
|---|---|---|
| Swagger UI | `http://localhost:8200/docs/swagger/index.html` | HTTP 200 |
| 聚合契约 | `http://localhost:8200/mate-platform-backend/contracts/openapi/generated/bundled.yaml` | HTTP 200（243,878 bytes） |
| Prism Mock | `http://localhost:4010/api/v1/rag/status` | Bearer Token，HTTP 200，schema 校验通过 |

启动说明：

- `mate-swagger-ui` 与 `mate-api-docs:dev` 暴露在 8200 端口。
- `mate-prism` 与 `mate-prism:dev` 暴露在 4010 端口。

Docker 镜像已锁定 `stoplight/prism:5`，绕开上游 403 问题；`package-lock.json` 与 `Dockerfile.prism` 记录本地修复点。

## 5. 验收硬规则

本批次满足生产就绪设计 §13 列出的所有硬规则：

- 每个 operation 都具备 operationId。
- 每个 operation 都标注 Owner、Permission、Requirement。
- 通用组件统一包含 Tenant Header。
- 每个 implemented operation 都有 Runtime 实现。
- Runtime 与契约差异为零，方向无未批准偏差。
- PRD Requirement 与 operation 一一对应。
- planned/placeholder operation 不挂 handler，仍可被 Accepted（按治理规则）。
- 唯一契约源即 canonical，所有变更汇入同一 OpenAPI 入口。
- Swagger、Redoc、Prism 三个 profile 全部以同一 bundle 为输入。

## 6. Breaking removals

| 旧路径 | 新路径/动作 |
|---|---|
| `/api/v1/superai` | 重命名为 `/api/v1/copilot` |
| `/api/v1/ea` | 重命名为 `/api/v1/arch` |
| `/api/v1/app-kb` | 重命名为 `/api/v1/kb` |
| `/api/v1/llm` | 重命名为 `/api/v1/llmgw` |

以上路径变更已写入迁移说明，CI 通过 oasdiff 阻断孤立路由。

## 7. 已知遗留

1. 本批次暂未覆盖 GoF 23 模式 / 业务场景的完整贯通，需在 ARCH-CORE-01 阶段补齐。
2. npm workspaces 在 local/docs profile 下 Prism 仍需固定 Node 版本；Nginx 静态托管路径建议后续收敛到反代。
3. Runtime 抓取目前未覆盖 OBS/MCP 服务的 TracerProvider 初始化，需在 ARCH-CORE 阶段接通。
4. 当前实现路径仅覆盖本批次约定的 127 个 planned 与 73 个 placeholder，其余业务域按原路线图顺序推进。

## 8. 结论

API-GOV-01 批次完成 OpenAPI 治理基线、Runtime 校验与 CI 门禁，证据闭环，按生产就绪设计 §13 判定为 `Accepted`；后续批次可基于本基线并行启动。