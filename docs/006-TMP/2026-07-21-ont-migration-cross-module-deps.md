# ONT 模块迁移 - 跨模块依赖跟踪表

> 生成日期：2026-07-22
> 关联：ONT 模块 v1.2 迁移设计（spec 2026-07-21-ont-module-monorepo-v12-design.md）

## 阻塞 APP-ONTSTUDIO 完整 E2E 的依赖

| 依赖项 | 在哪个服务 | 端点数 | 阻塞的前端功能 | 下游负责模块 | 期望排期 |
|---|---|---|---|---|---|
| RuleDefinitionController (CRUD + test) | TECH-RULE | 6 | 规则管理页 | RULE 迁移 | v1.2 阶段 2-3 |
| DecisionTableController (CRUD + execute) | TECH-RULE | 6 | 决策表编辑器 | RULE 迁移 | v1.2 阶段 2-3 |
| TestCaseController (CRUD + run) | TECH-RULE | 6 | 测试用例管理 | RULE 迁移 | v1.2 阶段 2-3 |
| ActionDefinitionController (CRUD) | TECH-ACTION | 4 | 动作定义页 | ACTION 迁移 | v1.2 阶段 2-3 |
| DataSourceController (CRUD + test) | TECH-DATA | 4 | 数据源管理 | DATA 迁移 | v1.2 阶段 2 |
| DataMappingController (CRUD + run) | TECH-DATA | 4 | 数据映射 | DATA 迁移 | v1.2 阶段 2 |
| DataQualityController (overview/issues/rules/run/status) | TECH-DATA | 5 | 数据质量 | DATA 迁移 | v1.2 阶段 2 |
| LineageController (scope/nodeId/impact) | TECH-DATA | 3 | 数据血缘 | DATA 迁移 | v1.2 阶段 2 |
| TECH-LLMGW 服务本体 (Java) | TECH-LLMGW | - | SAA ChatModel 调用目标 | v1.2 阶段 2 | v1.2 阶段 2 |

## 本次已解决

| 阻塞项 | 解决方案 | 落地 commit |
|---|---|---|
| versions.ts 5 端点 (3 ⚠️ + 2 ❌) | 阶段 2 修复 | 8e1b34d, 213c6f9 |
| discovery.py 4 端点 (Python 违反 v1.2) | 阶段 3 Java 化 | bdd97b2 |
| Spring Boot 3.4 → 3.5 升级 | 阶段 2 | 55845aa |
| SAA 1.1.2.0 引入 | 阶段 2 | 3a124c5 + 1a1b212 |
| Java 端 Python HTTP 调用清理 | 已确认无（Task 2.5/2.6 SKIP）| 950ebe7 |
| Python 残留 (21 文件 + .venv) 删除 | 阶段 3 | 0c5f4d0 |
| 前端 monorepo 收敛 (apps/ontstudio) | 阶段 0+1 | d1f1088 - dc626c0 |
| versions.ts createVersion URL 补 /snapshot | 阶段 2 | 213c6f9 |

## 已知环境阻塞（需运维配置）

| 阻塞项 | 影响 | 解决方式 |
|---|---|---|
| DashScope API key 缺失 | TECH-ONT 启动失败（Task 2.14/3.8/4.1 三次）| 在 application.yml 或 Nacos 配 `spring.ai.dashscope.api-key` |
| PostgreSQL/Neo4j/Nacos 外部依赖 | E2E 完整流 | 部署 docker-compose 或 K8s 集群 |
| pnpm install Windows EPERM | apps/ontstudio 部分依赖未装 | 用 Linux/Mac/CI 环境重跑，或用 npm + 改 workspace 协议 |

## 后续前端接入候选（24 条 🆕，spec 11.5）

| 模块 | 端点数 | 用例 |
|---|---|---|
| ConceptController (ancestors/descendants/search/detail/sub-concepts/move) | 6 | 概念树增强 |
| EntityController (batch/by-concept) + EntityAttributeController (3) | 5 | 实体批量/属性管理 |
| RelationTypeController (by-code) + RelationInstanceController (CRUD) | 4 | 关系类型按 code 查、实例 CRUD |
| OntologyVersionController (current/publish/rollback) | 3 | 版本生命周期 |
| GraphController (query/expand/stats) | 3 | 图查询增强 |

**合计 24 端点，待后续模块接入。**

## 状态总结

| 阶段 | 任务数 | 完成 | 跳过 | 阻塞 | commit |
|---|---|---|---|---|---|
| 0 | 3 + 1 修复 | 4 | 0 | 0 | d1f1088 542d1be a813ffb d44c1747 |
| 1 | 5 + 3 修复 | 8 | 0 | 0 | 075b43b 8784586 e54db3f fbc32d1 980470f 6f5fae4 dc626c0 |
| 2 | 9 实质 | 9 | 2 (2.5/2.6 SKIP) | 1 (env 验证) | 55845aa 3a124c5 1a1b212 aefd527 ea31aa4 3facde2 950ebe7 8e1b34d 213c6f9 74a8d5f 4bfdb24 |
| 3 | 10 | 10 | 0 | 1 (env 验证) | 8b2c4b4 ccb5501 2cf32bc 1a93bc2 8224cbb bdd97b2 b44048a 8fbbe63 0c5f4d0 dc6cefc |
| 4 | 5 (进行中) | 1 | 0 | 0 | 43b2677 |
| **合计** | **30+** | **32** | **2** | **2** | **30+** |

## 下一步建议

1. **运维**：配置 DashScope API key 解决 8201 启动
2. **运维**：提供 docker-compose 一键启动 PostgreSQL + Neo4j + Nacos
3. **CI**：在 Linux runner 上跑 pnpm install（避开 Windows EPERM）
4. **下一个模块**：APP-DASHBOARD（按相同模板 monorepo 化）
5. **后端服务**：TECH-LLMGW / TECH-RULE / TECH-DATA / TECH-ACTION 各自 Java 化（v1.2 阶段 2 启动）
