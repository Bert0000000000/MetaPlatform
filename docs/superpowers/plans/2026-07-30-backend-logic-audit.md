# 后端全量逻辑盘点执行计划

**目标：** 对照 v3.0/v3.1 技术架构、技术选型、全部现行 PRD 与 OpenAPI，逐模块核验后端实现逻辑，形成可追溯证据的详细盘点报告。

**审计方法：** 先锁定现行文档基线及代码边界，再按服务模块建立“需求—契约—路由—业务逻辑—持久化/外部集成—安全/租户—测试”证据链。接口存在不等于业务实现；mock、内存存储、静态返回、宽松降级、未接外部引擎均单独标记。

**状态定义：**
- 已实现：主流程与关键异常路径存在，依赖及持久化符合架构，并有有效测试/验证证据。
- 部分实现：有路由或核心代码，但存在 mock、内存替代、关键分支/集成/安全/持久化缺口。
- 未实现：需求无对应后端能力，或仅占位/固定返回/NotImplemented。
- 无法确认：缺少明确 PRD 映射或运行依赖，静态证据不足。

## 分解任务

- [ ] 1. 建立架构、技术选型、交付路线、PRD、OpenAPI 文档基线与优先级。
- [ ] 2. 建立所有后端代码边界和服务/包清单（含网关、认证、公共包、基础设施配置）。
- [ ] 3. 审计 api-gateway、auth-service、mate-common 与横切能力。
- [ ] 4. 审计 mate-tech-iam（认证、用户、组织、角色权限、审计、配置、Dashboard 聚合）。
- [ ] 5. 审计 mate-tech-rag 与 mate-app-kb（解析、入库、检索、知识库聚合）。
- [ ] 6. 审计 mate-tech-agent（图编排、工具、人审、状态、记忆、流式与安全）。
- [ ] 7. 审计 mate-tech-llmgw（供应商、路由、熔断、配额、流式、embedding）。
- [ ] 8. 审计 mate-tech-ont（本体、实例、关系、推理/SPARQL、Neo4j、多租户）。
- [ ] 9. 审计 mate-tech-mcp、mate-tech-msg、mate-tech-obs。
- [ ] 10. 审计架构声明但代码缺失的模块，尤其 mate-tech-data、Flowable/Drools ACL 与 APP 业务后端覆盖。
- [ ] 11. 核验 OpenAPI/PRD 覆盖、静态检查、单元/集成测试及测试真实性。
- [ ] 12. 汇总模块矩阵、关键缺陷、风险分级、优先级建议和证据索引，并自检报告。

## 交付物

- `docs/active/reports/backend-audit/PROGRESS.md`：跨轮进度与发现。
- `docs/active/reports/backend-audit/evidence/`：机器可读或分模块证据。
- `docs/active/reports/REPORT-后端逻辑全量盘点-2026-07-30.md`：最终详细报告。
