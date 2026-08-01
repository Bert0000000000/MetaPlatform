# Code 模式执行 prompt(Mate Platform v3.1 收口)

> 版本:v1.0 · 2026-08-01
> 配套:`docs/active/specs/2026-08-01-*-{mcp-federation-spec-revision,r6-rls-migration,g8-legacy-infra-cleanup,roadmap-v3.2}.md`
> 状态:**Active**(供 code 模式立即执行)

---

## Part 1:总入口 prompt(给 code 模式的工作全景)

```text
你是 Mate Platform 的 code 模式执行者。今天是 2026-08-01,v3.0 GA 与 v3.1 增量已收口:
- 17/17 域接入完成(SPEC 命中 209/214,仅 5 个 mcp endpoint 待修)
- G2/G3/G4/G7 Accepted;TD-5/TD-6 收口
- 1500+ tests pass

**你的任务**是按优先级执行 6 个 code 层任务(需求层规范已就绪,无需重新设计):

## 工作顺序(建议)

1. **B-1 mcp 路径修**(0.5 天,立即执行)
   - 规范:`docs/active/specs/2026-08-01-mcp-federation-spec-revision.md`
   - 修改:`contracts/openapi/services/mcp.yaml`(+ 7 federation endpoint)+ `packages/mate-tech-mcp/src/mate_tech_mcp/main.py`(挂 5 原 endpoint router)
   - 测试:`pytest packages/mate-tech-mcp/tests/` ≥ 14 cases(7 原 + 7 federation)
   - 验收:`docs/active/delivery/evidence/P3-W10-MCP-ACCEPTANCE.md`

2. **B-4 G8 旧 infra 清理**(0.5 天,B-1 完成后立即)
   - 规范:`docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md`
   - 删:`infra/otel/`、`infra/lightrag/`、`infra/promtail/`(3 个目录)
   - 改:`docker-compose.yml`(删 3 处 mount)+ 2 份 docs
   - 测试:`docker compose --profile infra up -d` + `pytest infra/tests/`
   - 验收:PROGRAM-BOARD G8 状态 Not Started → Accepted

3. **B-3 G6 RLS 迁移**(1-2 周,启动后长跑)
   - 规范:`docs/active/specs/2026-08-01-r6-rls-migration.md`
   - 新建:`packages/mate-tech-db/alembic/versions/0008_rls_tenant.py`(4 张主表 + 7 张回填 + RLS 策略)
   - 改:`packages/mate-platform/src/mate_platform/auth/middleware.py`(注入 SET LOCAL mate.tenant_id)
   - 新建:`packages/mate-tech-db/tests/test_rls_tenant.py` ≥ 6 cases
   - 验收:`docs/active/delivery/evidence/G6-RLS-MIGRATION-ACCEPTANCE.md`

4. **B-5 staging 集群部署**(2-4 周,独立可并行)
   - 路径:4 个 DATA sub-chart(debezium/marquez/datahub/ge)推到真实 staging
   - 验收:GA 真实集群演练通过

5. **B-6 v3.2 准备**(4-6 周,长周期)
   - 路径:mcp federation 真实化 + llmgw 多模态 + ont SHACL 推理
   - 规范:`docs/active/specs/2026-08-01-roadmap-v3.2.md`

## 工作约束(必读)

- **ADR-0014 5 步合规**:每个新 endpoint 必须经过 install_auth / require_tenant / outbox / BearerAuth / 跨租户 tests
- **§13 硬规则**:不动生产 fallback,不绕过 ACL client
- **TD-1~TD-7**:不要引入新 deprecated 路径;新代码走 PostgreSQL(TD-5 收口)
- **OpenAPI parity**:每次修改 spec 必须 `redocly bundle` + `spectral lint` + `oasdiff` 通过
- **测试**:每 PR ≥ 5 cases(7+ 更好);全后端回归必须 1700+ 通过
- **ADR-0016 数据平台架构**:新加 capability 必须从 DATA-D0-D8 已落地模块调用,不要重复实现
- **每次 PR 必须在 commit 信息里引用对应 ADR 编号 + operationId + 验收证据路径**

## 文档生态

所有需求文档与规范就绪:
- `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` v1.5 — 主 Roadmap
- `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.4 — 17 域进度
- `docs/active/specs/2026-07-31-features-backlog.md` v1.3 — 功能盘点
- `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.7 — 接口盘点
- `docs/active/decisions/ADR-0014-tech-services-integration.md` — 集成模式
- `docs/active/specs/2026-08-01-*` 4 份新规范

需要任何需求变更时回退给需求层(我),不要在 spec 文档里擅自修改。
```

---

## Part 2:单任务 prompt — B-1 mcp federation 修复(立即执行)

```text
你是 Mate Platform 的 code 模式执行者,任务是 **P3-W10 mcp federation 路径修复**。
今天 2026-08-01,SPEC 命中 209/214,只有 5 个 mcp endpoint 未实现。

## 任务目标

1. **修复 5 个原 spec endpoint**:把代码侧 `/api/v1/mcp/{prompts,resources,tools}` 真正挂载
   - `GET /api/v1/mcp/prompts`
   - `POST /api/v1/mcp/prompts/{name}`
   - `GET /api/v1/mcp/resources`
   - `GET /api/v1/mcp/tools`
   - `POST /api/v1/mcp/tools/{name}`

2. **在 spec 端补 7 个 federation endpoint**(代码侧 P3-W7 已实现,但 spec 漏了)
   - `GET /api/v1/mcp/federation/servers`
   - `POST /api/v1/mcp/federation/servers`
   - `GET /api/v1/mcp/federation/servers/{id}`
   - `PUT /api/v1/mcp/federation/servers/{id}`
   - `DELETE /api/v1/mcp/federation/servers/{id}`
   - `GET /api/v1/mcp/federation/tools`
   - `POST /api/v1/mcp/federation/tools/{name}/invoke`

## 完整规范

**必读**:`docs/active/specs/2026-08-01-mcp-federation-spec-revision.md`

包含:
- 5 个原 endpoint 的 operationId + x-mate-* 字段规范
- 7 个 federation endpoint 的完整 OpenAPI yaml 片段(可直接复制到 mcp.yaml)
- 12 个 FR-MCP-* Requirement ID
- 验收标准

## 修改文件清单

```
contracts/openapi/services/mcp.yaml
  + paths 追加 12 个 endpoint(5 原 + 7 federation)
  + components.schemas 追加 9 个 schema(MCPPrompt / MCPPromptRender / MCPArgument / MCPResource /
    MCPTool / MCPToolInvoke / MCPToolResult / MCPFederationServer / MCPFederationServerCreate /
    MCPFederationServerUpdate / MCPToolFederation)
  + 每个 endpoint 加 security: 三段式(bearerAuth + tenantHeader + oidcScopes)

packages/mate-tech-mcp/src/mate_tech_mcp/main.py
  + 挂 5 个原 endpoint 的 router(prefix /api/v1/mcp)
  + federation router 已存在,确认挂载位置正确
  + require_tenant(ctx) 守卫(handler 第一行)

packages/mate-tech-mcp/tests/test_mcp_http_endpoints.py
  + 5 个原 endpoint 测试(每个 happy-path + 跨租户 negative)
  + 7 个 federation endpoint 测试
  ≥ 14 cases
```

## ADR-0014 5 步 checklist

- [ ] 步骤 1:`install_auth(app)` 在 `create_app()` 第一行(已就绪)
- [ ] 步骤 2:每个 handler 第一行 `require_tenant(ctx)`
- [ ] 步骤 3:federation 的 POST/PUT/DELETE 用 `outbox.append(Event.create(...))` 同事务
- [ ] 步骤 4:跨 server 调用用 `BearerAuth` + `OutgoingAuthMiddleware`
- [ ] 步骤 5:`tests/test_mcp_http_endpoints.py` ≥ 14 cases
- [ ] 步骤 6:OpenAPI `security:` 段已升级三段式(每个 endpoint)

## 验收

```bash
cd mate-platform-backend/contracts
npm run check  # bundle + lint + spectral

cd ..
python -m pytest packages/mate-tech-mcp/tests/ -v
# 期望 ≥ 14 passed,0 failed

python -m pytest packages/ -q
# 期望 1700+ passed,0 failed
```

## 提交与 PR

```
commit: feat(mcp): P3-W10 mcp federation path alignment + 5 原 endpoint 挂载 (FR-MCP-FEDERATION-*)

PR 描述:
  - 关联 spec: docs/active/specs/2026-08-01-mcp-federation-spec-revision.md
  - 关联 ADR: ADR-0014(5 步接入模式)
  - 验收证据: docs/active/delivery/evidence/P3-W10-MCP-ACCEPTANCE.md(本 PR 内新建)
  - operationId: mcpGetMcpPrompts 等 12 个
  - 测试: 14+ cases pass / 全后端回归 1700+ 通过
```

## 风险与回滚

- federation endpoint 改 spec 不破坏现有代码(代码路径已实现)
- 新增 5 个原 endpoint 可能与 federation 路径冲突,需检查 router mount 顺序
- 回滚:`git revert HEAD~1` + `oasdiff` 对比前后 spec

## 工作模式

- 单人独立 PR,不留 TODO 代码
- 不修改需求规范,如需调整回退给需求层
- 完成 PR 后等待 review,不要直接合并 main
```

---

## Part 3:单任务 prompt — B-3 G6 RLS 迁移(长跑任务)

```text
你是 Mate Platform 的 code 模式执行者,任务是 **G6 真实 RLS 迁移**(§13 硬规则 3 强化)。
今天 2026-08-01,TD-5 已收口(10 域 in-memory → PostgreSQL 持久化完成)。

## 任务目标

在 4 张主表 + 7 张回填表上启用 PostgreSQL 原生 RLS,使 §13 硬规则 3
("没有 tenant 上下文,不访问 repository")在 **数据库层**也有强制保障(目前仅应用层 listener)。

## 完整规范

**必读**:`docs/active/specs/2026-08-01-r6-rls-migration.md`

包含:
- 4 张主表 RLS 策略(KB / RAG / ONT 各 2 张)
- 7 张回填表的 tenant_id 补齐策略
- Alembic 0008 migration 完整 SQL
- 应用层中间件更新(PG session variable 注入)
- 测试矩阵(7 cases)
- 回滚 SOP

## 修改文件清单

```
packages/mate-tech-db/alembic/versions/0008_rls_tenant.py  [新建]
  - revision = "0008",down_revision = "0007"
  - upgrade(): 7 张表回填 + 4 张表 NOT NULL + 4 张表 ENABLE RLS + 4 张表 CREATE POLICY
  - downgrade(): 删 POLICY → 关闭 RLS → 取消 NOT NULL

packages/mate-platform/src/mate_platform/auth/middleware.py  [改]
  + inject PG session variable: SET LOCAL mate.tenant_id = <tenant_id>
  + 注意:每个请求 SET LOCAL,事务结束自动释放

packages/mate-tech-db/tests/test_rls_tenant.py  [新建]
  + 7 cases(隔离 / service_role 旁路 / WITH CHECK 约束 / 跨 tenant / 审计 / 性能 / 回滚)

docs/active/delivery/evidence/G6-RLS-MIGRATION-ACCEPTANCE.md  [新建]
  + 13 硬规则对齐表
  + 7 测试结果
  + 回滚演练
```

## 验收

```bash
cd mate-platform-backend/packages/mate-tech-db

# Alembic 升级
alembic upgrade head  # exit 0,无报错
alembic downgrade -1  # exit 0

# pytest
python -m pytest tests/test_rls_tenant.py -v
# 期望 7 passed,0 failed

# 全后端回归
python -m pytest packages/ -q
# 期望 1700+ passed,0 failed

# PG 端 RLS 验证
psql -U mate -d mate_platform -c "
  SELECT tablename, rowsecurity, forcerowsecurity
  FROM pg_tables WHERE schemaname='mate_platform' AND tablename IN
  ('kb_documents','rag_chunks','ont_classes','ont_instances');
"
# 期望 4 行,rowsecurity=t,forcerowsecurity=t
```

## 提交与 PR

```
commit: feat(rls): G6 Alembic 0008 tenant_id RLS migration (FR-KB-ISOLATION)

PR 描述:
  - 关联 spec: docs/active/specs/2026-08-01-r6-rls-migration.md
  - 关联 ADR: ADR-0012-sec-tenant-isolation / ADR-0016-data-platform-architecture
  - 关联硬规则: §13 硬规则 3
  - 验收证据: docs/active/delivery/evidence/G6-RLS-MIGRATION-ACCEPTANCE.md
  - 测试: 7 RLS tests + 全后端 1700+ 回归
  - 回滚: alembic downgrade -1(5 分钟 SOP)
```

## 风险与回滚

- 性能:RLS 每行增加 1-5ms 检查;在 tenant_id 列建覆盖索引,P95 < 10ms
- 服务不可用风险:运维团队演练 5 分钟 ROLLBACK SOP
- service_role 误用:仅 Outbox / Audit / Alembic 临时 GRANT,业务代码禁止

## 工作模式

- 1-2 周长跑任务,可拆为 4 个 sub-PR:
  1. PR-A:7 张表 tenant_id 回填(独立 PR)
  2. PR-B:4 张主表 NOT NULL + DEFAULT
  3. PR-C:RLS 启用 + CREATE POLICY
  4. PR-D:中间件 + 测试 + 回滚 runbook
- 完成后等待需求层验收(我)
```

---

## Part 4:单任务 prompt — B-4 G8 旧 infra 清理(轻量任务)

```text
你是 Mate Platform 的 code 模式执行者,任务是 **G8 旧 infra 清理**(纯文件删除)。
今天 2026-08-01。

## 任务目标

删 3 个已被 K8s sub-chart 完全替代的旧目录,**不**触及仍被 helm chart 或本地 dev 引用的目录。

## 完整规范

**必读**:`docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md`

## 修改文件清单

```
infra/otel/                           [git rm -r]   1 文件
infra/lightrag/                       [git rm -r]   1 文件(Dockerfile)
infra/promtail/                       [git rm -r]   1 文件
docker-compose.yml                    [改]          删 3 处 mount / scrape_config
docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md  [改]  §1.2 删 3 行
docs/active/specs/PROFILES.md         [改]          移除对 otel/lightrag/promtail 的引用
docs/active/delivery/PROGRAM-BOARD.md [改]          G8 状态 Not Started → Accepted
```

## 验收

```bash
ls infra/otel infra/lightrag infra/promtail 2>/dev/null
# 期望:目录不存在

docker compose --profile infra up -d
# 期望:exit 0,服务起来

pytest infra/tests/ -v
# 期望 119+ passed

helm install test infra/helm/umbrella/ --dry-run
# 期望 exit 0
```

## 提交与 PR

```
commit: chore(infra): G8 旧 infra 清理(otel/lightrag/promtail)

PR 描述:
  - 关联 spec: docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md
  - 关联硬规则: §13(代码体积)
  - 删除: 3 目录 + 3 处 mount
  - 测试: docker compose + infra/tests + helm dry-run
```

## 风险

- 本地 dev 启动失败:docker-compose.yml 已同步删 mount,无风险
- 误删有用配置:步骤 1 扫描 + 步骤 2 三重确认 + git revert 预案
- CI 失效:grep 扫描所有 .yml 已验证无引用

## 工作模式

- 0.5 天轻量任务,可一次 PR 完成
- 不动 PROFILES.md 之外的 docs(架构基线与 PROFILES 是唯一需更新的引用点)
```

---

## 配套使用说明

### 优先级

| 优先级 | 任务 | 工作量 | 何时启动 |
|---|---|---:|---|
| **P0** | **B-1 mcp federation** | 0.5 天 | **立即**(基于 R-1) |
| **P1** | **B-4 G8 旧 infra** | 0.5 天 | B-1 完成后 |
| **P2** | **B-3 G6 RLS** | 1-2 周 | 与 B-4 并行 |
| P3 | B-5 staging 部署 | 2-4 周 | B-3 完成后 |
| P4 | B-6 v3.2 准备 | 4-6 周 | 长周期 |

### 总计

- **短周期(< 1 周)**:B-1 + B-4 共 1 天,清空 backlog 的轻量缺口
- **中周期(1-2 周)**:B-3 完成 G6 RLS 收口
- **长周期(2-6 周)**:B-5 + B-6 是真实集群与 v3.2 准备

---

## 关联文档

- `2026-08-01-mcp-federation-spec-revision.md` — R-1 → B-1
- `2026-08-01-r6-rls-migration.md` — R-2 → B-3
- `2026-08-01-g8-legacy-infra-cleanup.md` — R-3 → B-4
- `2026-08-01-roadmap-v3.2.md` — R-6 → B-5/B-6
- `2026-07-31-features-backlog.md` v1.3 — 功能盘点
- `2026-07-31-backend-impl-backlog.md` v1.7 — 接口盘点
- `2026-07-27-mate-platform-delivery-roadmap.md` v1.5 — 主 Roadmap

---

## 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-01 | v1.0 初版(总入口 prompt + 3 单任务 prompt) | 需求层(TRAE) |