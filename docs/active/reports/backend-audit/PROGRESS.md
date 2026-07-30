# 后端逻辑盘点进度

- 审计日期：2026-07-30
- 状态：进行中
- 当前阶段：文档基线与代码清单
- 审计边界：现行 Python 后端、部署/基础设施配置、接口契约、测试；legacy 仅作迁移参照，不计为现行实现。

## 已确认基线

- 主架构：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`
- 技术栈：`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
- 交付路线：`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`
- PRD 根目录：`docs/active/prd/`（8 个 APP 域 + `_top`）
- 汇总 OpenAPI：`docs/active/api/openapi.yaml`
- 服务契约：`mate-platform-backend/contracts/openapi/`

## 初步代码边界

- 部署入口：api-gateway、auth-service
- 业务/技术包：mate-common、mate-tech-iam、mate-tech-rag、mate-tech-agent、mate-tech-llmgw、mate-tech-ont、mate-tech-mcp、mate-tech-msg、mate-tech-obs、mate-app-kb
- 架构声明但当前 packages 清单未见：mate-tech-data

## 重要审计原则/初步风险

1. `docs/swagger/IMPLEMENTATION-STATUS.md` 的“100%”仅按 OpenAPI path 与路由存在性统计，不能作为业务逻辑完成证据。
2. 需重点识别固定返回、内存仓储、可选依赖自动降级、外部系统未接通、测试只断言状态码等“表面实现”。
3. 工作区已有用户改动；本次只新增审计文档，不改动业务代码或覆盖现有改动。

## 已审模块

- 暂无（仅完成初始清单）。

## 下一步

1. 生成 PRD/规范索引与代码静态证据清单。
2. 审计横切能力及 IAM。
3. 按服务持续填充模块证据和最终报告。

## 本轮新增证据

- `evidence/routes.txt`：静态检出 138 条装饰器路由（仅表示入口存在，不表示业务完成）。
- `evidence/suspicious-patterns.txt`：生产代码中的占位、mock、内存实现、fallback、NotImplemented 等候选证据。
- 后端现行代码约 10 个 packages + 2 个 deployment services；其中业务代码规模较大的模块为 IAM（约 4.8k 行）、LLMGW（约 2k 行）、RAG（约 1.6k 行）、Agent（约 1.5k 行）、ONT（约 1.4k 行）。

## 初步实质性发现（待逐文件复核）

- RAG 明确存在 `InMemory placeholder`、hash-based demo embedder、LightRAG stub id 和整块内容 fallback。
- LLMGW 流式接口注释明确为 mock token 流，embedding 仍有 TODO，未知 provider 会抛 `NotImplementedError`。
- ONT 实例存储标注为 in-memory + Neo4j 适配点，SPARQL 注释为 mock 返回空。
- IAM Dashboard 使用模块级 `_TODOS` 等内存种子集合，需核验其与 Flowable/真实业务域的对接情况。
- v3.1 架构要求 `mate-tech-data`，当前 packages/services 清单未发现该模块；PRD 合同还列出 data/etl/scheduler/metrics 增量接口。
- 顶层 API Contract 声明约 141 条基础端点并包含 APPHUB/WFE/COPILOT/DW/KB/EA/A2A 等业务域，而现有服务契约报告只统计 124 个 path；需要逐域做缺口矩阵，不能接受“11/11 服务路由 100%”作为 PRD 完成结论。

## 下轮起点

- 读取主架构关键约束（DDD/CQRS/Outbox/Saga/ACL/多租户）和交付任务验收项。
- 完成网关、Auth、common、IAM 的逐文件逻辑核验。

## Compose 部署核验

- `docker-compose.yml` 共解析到 30 个 service，包括 9 个当前 Python 业务/技术服务、gateway/auth、Keycloak/Flowable/KIE 和基础设施。
- Compose 中没有 `mate-tech-data` 及 Data Track 的 Flink/Airflow/Trino/StarRocks/Gravitino/OpenMetadata/Marquez/Ranger/OpenBao 等完整服务集合，进一步印证 v3.1 未落地。
- 外部引擎容器“已声明”不代表 ACL/业务流程已实现；必须以调用代码和契约测试为准。

## 完成状态（2026-07-30）

- 已审模块：api-gateway、auth-service、mate-common、mate-tech-iam、mate-tech-rag、mate-app-kb、mate-tech-agent、mate-tech-llmgw、mate-tech-ont、mate-tech-mcp、mate-tech-msg、mate-tech-obs。
- 已审缺失域：mate-tech-data、APPHUB、EA/ARCH、WFE、COPILOT/SUPERAI、DW、A2A。
- 已完成架构模式、技术栈、PRD 路径域、OpenAPI/路由、持久化与外部引擎、安全/租户、测试和 Compose 交叉核验。
- 最终报告：`docs/active/reports/REPORT-后端逻辑全量盘点-2026-07-30.md`。
- 验证：packages pytest 通过；integration pytest、Ruff、Pyright 均失败，结果已纳入报告。
- 状态：审计完成；不修改业务代码。
