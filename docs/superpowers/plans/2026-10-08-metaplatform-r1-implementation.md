# MetaPlatform R1 Implementation Plan

> 状态：Accepted；2026-10-08 用户已授权执行迭代。
> 使用 executing-plans / subagent-driven-development，按任务顺序实现与审查。

**Goal:** 完成路线图的准备工作与第一轮 C0–C2，让管理员在隔离环境中安全评估、执行并核对模型字段迁移。

**Architecture:** 沿用现有 PgOntologyRepository、Ontology Kernel、迁移 API 和发布 UI。修复现有边界，建立真实数据库及浏览器门禁。

**Spec:** ADR-0082、ADR-0080；[已接受路线图](2026-10-08-metaplatform-optimization-roadmap.md)。R2–R6 仍按路线图依赖与业务验收滚动推进，本文件只定义 R1。

## Global Constraints

- 工作目录为当前 `2026-07-02-MetaPlatform` 隔离工作树，起始 HEAD 为 `e965d866b20dddf8d9ebb0418869b58a4697ee32`。用户指定当前仓库作为研发依据。
- 保留现有服务、数据库、工作树及未提交文件。测试使用独立 PostgreSQL 容器、独立数据库、明确的 loopback 端口和独立前端端口；清理只作用于本次创建的资源。
- 所有引用及副作用限定在授权租户、ObjectType 家族及执行前固定的目标实例集合内。Repository 与 API 都验证。
- 默认保留数据；新旧字段同时有有效值时中止并报告冲突。复合主键重派生继续报告不支持。模型回滚仍只恢复模型。
- 服务端验证完整计划和选项；允许显式属性 rename 和 preserve/drop，但不能扩大类型或属性范围、伪造目标定义或任意格式转换。
- 文档/ADR、契约、失败测试、实现和证据按顺序提交。测试先复现实际错误，再实现修复。
- 必需数据库和浏览器用例须被实际采集并执行。连接缺失、未采集、环境性 skip 使必需作业失败。
- 本地证据与 PR/主干 CI 证据分别登记，不把本地通过描述为合并、部署或业务验收。

### Task 1: C0 统一接管入口与 Git 索引

**Files:** 根 `AGENTS.md`（新增）、`agent.md`、`CLAUDE.md`、`docs/README.md`、`.gitignore`（必要时）；Git 索引生成物。

- [ ] 建立短标准入口，引用单源 ADR/规格、uv/pnpm 锁文件、当前工作树和验证入口。
- [ ] 将旧迁移指针明确改为历史决策；当前研发以用户指定仓库为准。保留历史验收与当前证据边界。
- [ ] 核对跟踪的字节码与 `.worktrees` gitlink，只取消已确认生成物的跟踪，保留本地文件和工作树。
- [ ] 自查链接、命令、Git 差异及无历史上下文的可接管性，提交独立变更。文档/索引更改不写镜像实现的测试。

### Task 2: C1 真正执行数据库与迁移浏览器门禁

**Files:** `.github/workflows/ga-acceptance.yml`、`.github/workflows/ontology-loop.yml`、`scripts/ci/` 专用准备/验证脚本、相关 pytest DSN/fixture、专用 Playwright 配置及前端 package 脚本（必要时）。

- [ ] 在独立 pgvector/PostgreSQL 16 上执行原 22 个迁移测试，记录 passed/failed/skipped 基线。
- [ ] 建立必需的 PostgreSQL 作业和连接预检，兼容 `VER_PG_DSN` / `PG_DSN`；缺环境即明确失败。保留非特权 RLS 专项。
- [ ] 使用非 superuser、非 BYPASSRLS 业务测试角色，明确 FORCE RLS/辅助表的验证范围；必要时将 schema 准备与业务访问分开。
- [ ] 加入迁移、数据同步、模型原子性、关系并发、版本和查询语义的受影响回归；为必需测试生成 JUnit 并检查实际执行与 skip。
- [ ] 显式选择 `apps/web/tests/e2e/ontology-migration-plan.spec.ts`，保留根 ontology core 测试；CI 收集 Playwright 执行清单与结果。
- [ ] 在本工作树隔离服务与前端执行两个迁移浏览器用例，记录服务目标和实际用例。若外部认证或浏览器依赖不可用，记录具体阻断及已完成的门禁，继续完成不依赖它的任务，不能宣称 R1 完整验收。

### Task 3: C2 迁移引用、计划与 SQL 范围

**Files:** `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/{api.py,pg_repo.py}`、`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/migration.py`、迁移集成测试、`mate-platform-backend/contracts/openapi/services/ont.yaml`、ADR-0082。

- [ ] 先补真实双租户版本快照、同租户不同类型共享属性、篡改计划/目标/格式/选项、新旧字段并存冲突的负例。
- [ ] 同时验证失败响应及数据库零变更，逐项断言非目标实例、覆盖、来源及数据源映射未变化。
- [ ] 验证 baseline/target/live/snapshot 的租户及 ObjectType 家族归属；不能只按快照 RID 读取。
- [ ] 服务端根据实际模型定义验证或派生规范计划，拒绝未知字段、越界属性、非法格式、伪造目标和范围扩大。保留 ADR 支持的显式重命名与 drop 选项。
- [ ] 所有迁移步骤共用执行前固定的目标集合；overlay 去重/更新及 mapping 更新有相同边界。统一旧新字段并存冲突，默认中止并说明。
- [ ] 更新 ADR/契约错误语义；跑完整 C1 的受影响数据库回归与浏览器测试，再提交实现与证据。

## R1 退出检查

- [ ] 接管入口、Git 索引清理和安装/验证入口经过审查。
- [ ] 原 22 个迁移测试及新增边界负例真实通过，必需环境性 skip 为零。
- [ ] 两个迁移浏览器用例在本工作树代码及独立数据库上真实通过。
- [ ] 独立最终审查完成，未解决问题与本地/CI证据边界记录在 `docs/acceptance/2026-10-08-metaplatform-r1.md`。
- [ ] 后续 R2 入口及所需业务决策可定位，现有服务保持运行。
