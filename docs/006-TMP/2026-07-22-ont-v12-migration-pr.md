# ONT 模块 v1.2 迁移 PR 说明

> 分支：`feat/platform-menu-unification`
> 关联 spec：`docs/superpowers/specs/2026-07-21-ont-module-monorepo-v12-design.md`
> 关联 plan：`docs/superpowers/plans/2026-07-21-ont-module-monorepo-v12.md`

## 标题

`feat(monorepo): ONT module v1.2 migration (frontend monorepo + SAA + Python Java 化)`

## 描述

ONT 模块按 v1.2 架构（Java 21 + Spring Boot 3.5 + SAA 1.1.2.0 + pnpm monorepo）迁移。

**变更范围**：
- 前端：APP-ONTSTUDIO/src/ 迁入 metaplatform-frontend/apps/ontstudio/（60 文件，monorepo 模式）
- 后端：TECH-ONT Spring Boot 3.4→3.5 升级 + SAA BOM 1.1.2.0 引入 + NacosConfig/LlmGwProperties
- 后端：versions 5 端点修复（list/compare/PUT/DELETE）
- 后端：Python FastAPI ontology_discovery（4 端点 + 21 文件）Java 化
- 文档：CLAUDE.md / spec / plan / README / 跨模块依赖跟踪表 同步

**commit 数**：约 35 个（阶段 0-4 全部）

## 测试

- 后端：`mvn test` → 112 tests, 0 new failures（3 个 pre-existing failures 与本次无关）
- 后端：`mvn compile` → BUILD SUCCESS
- 前端：9220 启动 OK（Vite v8.1.5），11 路由 HTTP 200

## 已知环境阻塞（不影响代码）

- DashScope API key 缺失 → TECH-ONT 启动失败（需要运维配 `spring.ai.dashscope.api-key`）
- PostgreSQL/Neo4j/Nacos 外部依赖 → E2E 完整流需 docker-compose 或 K8s
- Windows pnpm install EPERM → apps/ontstudio 部分依赖未完整装（建议 Linux/Mac/CI 重跑）

## Checklist

- [x] Spec 已批准
- [x] Plan 完整
- [x] 阶段 0-4 全部 commit
- [x] mvn compile BUILD SUCCESS
- [x] mvn test 0 new failures
- [x] 前端 dev server 启动
- [x] 跨模块依赖表登记（`docs/006-TMP/2026-07-21-ont-migration-cross-module-deps.md`）
- [x] 4 个文档更新（PRD / API SPEC / ontstudio README / TECH-ONT README）
- [x] APP-ONTSTUDIO 旧目录清理（保留 docs/ 作为历史）
- [ ] 推送到 origin / 创建 PR（环境无凭证）

## Reviewer 重点

1. **CLAUDE.md v1.2**（commit 6805816）—— 确认 monorepo 段描述正确
2. **spec/plan** —— 确认 v1.2 假设无误
3. **versions 5 端点**（commit 8e1b34d）—— 后端 list/compare/PUT/DELETE
4. **OntologyDiscoveryController**（commit bdd97b2）—— 4 端点 Java 化
5. **Python 残留删除**（commit 0c5f4d0）—— 21 文件

## 下一步

1. 运维：配 DashScope API key + docker-compose
2. CI：在 Linux runner 重跑 pnpm install
3. 下一个模块：APP-DASHBOARD（按相同模板 monorepo 化）
4. 后端：TECH-LLMGW / TECH-RULE / TECH-DATA / TECH-ACTION 各自 Java 化
