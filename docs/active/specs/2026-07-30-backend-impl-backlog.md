# 后端接口未实现开发清单

> 版本:v1.0 · 2026-07-30
> 数据源:`mate-platform-backend/contracts/openapi/generated/bundled.yaml`(252,516 bytes,214 个 spec 路由)
> 代码扫描:`mate-platform-backend/` 下所有 `.py` 文件(`.venv` / `node_modules` / `tests` / `.wheels` / `__pycache__` 已排除)
> 关联:`docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2(8/17 已接入)
> 关联:`docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0(5 步模式)
> 关联:`docs/active/decisions/ADR-0014-tech-services-integration.md`
> 关联:`docs/active/delivery/PROGRAM-BOARD.md`(v3.0 GA 收口版)

---

## 1. 总览(2026-07-30 主分支)

| 项 | 数 |
|---|---:|
| Spec 路由(去重后) | 214 |
| 代码路由(`@router.*` + `@app.*`,去重) | 103 |
| Spec 命中代码 | 89 |
| Spec-only(**未实现**) | **125** |
| Impl-only(legacy / 内部探针) | 14 |

**8 / 17 域已按 5 步模式接入**(kb / msg / obs / agent / llmgw / rag / mcp / ont);**8 域 P2 待建包代码**(apphub / arch / copilot / dashboard / dw / data / a2a / wfe);**1 域 deprecated**(iam);**业务侧 125 个 endpoint 无 handler**。

---

## 2. P0(本周内)

### 2.1 路径对齐 · `app-kb → kb`(1 行改动)

- **现象**:`mate-app-kb/src/mate_app_kb/api/app.py` 用 `@app.post("/api/v1/app-kb/chat")`,但 spec 是 `/api/v1/kb/chat`。
- **修复**:`mate-app-kb/src/mate_app_kb/main.py` 把 router 挂到 `prefix="/api/v1/kb"`(或保留 app-kb 别名 + 加 kb 别名路由)。
- **解锁 endpoint**:5 个(`chat` / `chat/stream` / `search` / `stats` / `upload`)
- **阻塞**:无

### 2.2 路径对齐 · `llm → llmgw`(SEC-IAM-01 已标 breaking)

- **现象**:`mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py` 与 main.py 使用 `/api/v1/llm/` 前缀,spec 是 `/api/v1/llmgw/`(API-GOV-01 ACCEPTANCE §6 已记录为 breaking change)。
- **修复**:`mate-tech-llmgw/src/mate_tech_llmgw/main.py` 重挂 router 到 `prefix="/api/v1/llmgw"`,并把 `infra/helm/charts/keycloak/` 与 `nginx` 反代同步。
- **解锁 endpoint**:3 个(`chat` / `chat/stream` / `embeddings`)
- **阻塞**:无

### 2.3 mcp 路由挂载(1 PR)

- **现状**:`packages/mate-tech-mcp/` 包代码存在,但 spec 5 个 endpoint 未挂 router。
- **缺失**:
  - `GET /api/v1/mcp/prompts`
  - `POST /api/v1/mcp/prompts/{name}`
  - `GET /api/v1/mcp/resources`
  - `GET /api/v1/mcp/tools`
  - `POST /api/v1/mcp/tools/{name}`
- **修复**:在 `mate-tech-mcp/src/mate_tech_mcp/` 新建 `api/router.py`,挂 5 个 handler,落到 `main.py` 的 `install_auth` 入口。
- **5 步 checklist**:必装 install_auth + require_tenant + 至少 3 跨租户 negative test。
- **阻塞**:无

---

## 3. P1(2 周内)

### 3.1 dashboard 缺 9 个 endpoint(1 PR)

- **现状**:dashboard 38 个 spec 中,29 个已在 `mate-tech-iam/src/mate_tech_iam/api/dashboard.py` 实现(由 admin service 代理),**剩 9 个 PUT/PATCH 改写接口未实现**。
- **缺失**:
  - `PUT /api/v1/dashboard/notifications/{notification_id}/read`
  - `PUT /api/v1/dashboard/profile`(当前只有 GET)
  - `PUT /api/v1/dashboard/profile/permissions`(其他改写)
  - 等(共 9 个,需要拉 mate-tech-iam/dashboard.py 全文对照 spec)
- **修复**:在 admin service 中补 PUT/PATCH handler,从 SPEC 端对齐 5 步 checklist。
- **阻塞**:IAM 拆分(把 dashboard / admin / iam 三套拆到独立 service)

### 3.2 apphub 包代码 + 5 endpoint(1 PR)

- **现状**:OpenAPI `services/apphub.yaml` 已签,但 `packages/mate-app-hub/` 不存在。
- **缺失**:
  - `GET /api/v1/apphub/apps`
  - `GET /api/v1/apphub/apps/groups`
  - `GET /api/v1/apphub/modules`
  - `GET /api/v1/apphub/pages`
  - `GET /api/v1/apphub/templates`
- **修复**:仿 `mate-app-kb/` 建包,4 src files:`pyproject.toml` + `src/mate_app_hub/clients.py` + `src/mate_app_hub/api/app.py` + `tests/test_tenant_integration.py`。
- **5 步 checklist**:全量。
- **阻塞**:无

### 3.3 a2a 包代码 + 2 endpoint(1 PR)

- **现状**:OpenAPI `services/a2a.yaml` 已签,`packages/mate-app-a2a/` 不存在。
- **缺失**:
  - `GET /api/v1/a2a/agent-cards/search`
  - `GET /api/v1/a2a/delegations`
- **修复**:新建 `mate-app-a2a` 包,挂 2 个只读 GET。
- **5 步 checklist**:全量。
- **阻塞**:无

### 3.4 wfe 包代码 + 2 endpoint(1 PR)

- **现状**:OpenAPI `services/wfe.yaml` 已签,`packages/mate-app-wfe/` 不存在。
- **缺失**:
  - `POST /api/v1/wfe/flows/test`
  - `GET /api/v1/wfe/flows/validate`
- **修复**:新建 `mate-app-wfe`,挂 Flowable engine client(POST /flows/test 用 BPMN XML 试运行,GET /flows/validate 做 schema 校验)。
- **5 步 checklist**:全量。
- **阻塞**:Flowable engine 8.0.0 集成(docker-compose.override.yml 已配 `flowable/flowable-engine:8.0.0`)

---

## 4. P2(GA 收口前 / DATA-D0-D8 完成后)

### 4.1 数据平台 4 子域 39 endpoint(1 大 PR 或拆 4 PR)

- **现状**:DATA-D0-D8 已落地后端模块(debezium / marquez / datahub / pii_mask / xdomain_audit),但 **OpenAPI 控制面路由未挂**。
- **缺失**:
  - `data` 域 15 个(endpoint 见 `services/data.yaml`)
  - `etl` 域 8 个(endpoint 见 `services/data.yaml`)
  - `metrics` 域 8 个
  - `scheduler` 域 8 个
- **修复**:在 `packages/mate-tech-data/` 内新增 `api/control_plane/router.py`,把 DATA-D0-D8 已落地的 4 类能力(debezium task / marquez lineage / pii_mask / xdomain_audit)以 HTTP 形式暴露。
- **5 步 checklist**:全量。
- **阻塞**:DATA-D0-D8 D0-D8 全部 Accepted ✅(已落地),仅需挂路由。

### 4.2 dw 包代码 + 15 endpoint(1 PR)

- **现状**:OpenAPI `services/dw.yaml` 已签,`packages/mate-tech-dw/` 不存在。
- **缺失**:15 个 GET endpoint(commit / documents / employees / evaluations / extract / knowledge-bases / models / tools / traces / learning 等)。
- **修复**:新建 `mate-tech-dw`,做数字员工聚合查询(对接 mate-app-kb / mate-tech-rag / mate-tech-agent)。
- **5 步 checklist**:全量。
- **阻塞**:TECH-SERVICES 5 步依赖(可与 P1 wave 并行)

### 4.3 copilot 包代码 + 35 endpoint(2-3 PR)

- **现状**:OpenAPI `services/copilot.yaml` 已签,`packages/mate-app-copilot/` 不存在。
- **缺失**:35 个 endpoint,涵盖:
  - `a2a/delegate` / `a2a/external`(A2A 协议层)
  - `analysis/audit-sql` / `execute-sql` / `explain-sql` / `generate-sql`(SQL Copilot)
  - `chat/multimodal/upload`(多模态上传)
  - `code` / `conversations` / `datasources` / `models/multimodal`
  - `generate/dashboard` / `explain-code` / `form` / `process` / `review-code`
  - `ontology/concepts/search` / `graph/expand` / `graph/query`(本体图)
  - `queries/execute` / `queries/history`
  - `scheduling/employees/match` / `execution/start` / `intent/detect` / `intents` / `plan/generate` / `templates`
  - `actions` / `actions/execute` / `actions/match`
  - `search` / `auth/login`
- **修复**:新建 `mate-app-copilot`,**按上述 8 个功能簇拆 PR**,每 PR 完成 5 步 checklist。
- **阻塞**:mate-tech-agent 已接入,可复用其编排能力;ontology 集成需 mate-tech-ont(已落地)

### 4.4 arch 包代码 + 29 endpoint(2-3 PR)

- **现状**:OpenAPI `services/arch.yaml` 已签,`packages/mate-app-arch/` 不存在。
- **缺失**:29 个 GET endpoint(架构中心只读):
  - `applications` / `business-processes` / `capabilities` (含 tree / mappings) / `data-assets` (含 catalog) / `data-entities` / `data-flows` / `data-standards` / `data/domains` / `deployments`
  - `governance/principle-categories` / `principles` / `review-templates` / `review-tickets` / `tech-debts`
  - `impact-analysis` / `infrastructures`
  - `ontology-mappings/changes` / `rules`
  - `orgs` (含 tree) / `roles`
  - `tech-stacks` / `technology-components` / `technology-radar` / `technology-stacks`
  - `value-streams`
- **修复**:新建 `mate-app-arch`,从 ontology + 部署数据 + 数据资产做只读聚合。
- **5 步 checklist**:全量。
- **阻塞**:无

---

## 5. 总览矩阵

| 域 | spec 路由 | 代码命中 | 未实现 | 工作量 | 优先级 |
|---|---:|---:|---:|---|---|
| iam | 5 | 5 | 0 | — | 🟡 deprecated |
| obs | 2 | 2 | 0 | — | ✅ P1 wave 1 |
| msg | 2 | 2 | 0 | — | ✅ P1 wave 1 |
| rag | 7 | 7 | 0 | — | ✅ P1 wave 3 |
| ont | 12 | 9 (去重) | 0 | — | ✅ P2 wave 1 |
| agent | 4 | 4 | 0 | — | ✅ P1 wave 2 |
| **dashboard** | 38 | 29 | **9** | 1 PR | **P1** |
| **mcp** | 5 | 0 | **5** | 1 PR | **P0** |
| **apphub** | 5 | 0 | **5** | 1 PR | **P1** |
| **a2a** | 2 | 0 | **2** | 1 PR | **P1** |
| **wfe** | 2 | 0 | **2** | 1 PR | **P1** |
| **data** | 15 | 0 | **15** | 1 大 PR | **P2** |
| **etl** | 8 | 0 | **8** | 同上 | **P2** |
| **metrics** | 8 | 0 | **8** | 同上 | **P2** |
| **scheduler** | 8 | 0 | **8** | 同上 | **P2** |
| **dw** | 15 | 0 | **15** | 1 PR | **P2** |
| **copilot** | 35 | 0 | **35** | 2-3 PR | **P2** |
| **arch** | 29 | 0 | **29** | 2-3 PR | **P2** |
| **kb** | 5 | 0 (`app-kb` 别名) | **0**(路径别名) | 1 行 | **P0** |
| **llmgw** | 3 | 0 (legacy `llm`) | **0**(路径迁移) | 1 PR | **P0** |
| **Σ** | **214** | **89** | **125** | — | — |

---

## 6. 工作量与时序估算

| 优先级 | PR 数 | 工作量 | 起点 |
|---|---|---|---|
| P0(路径对齐 + mcp) | 2 | 3-5 天 | 本周 |
| P1(dashboard 补 + apphub / a2a / wfe 新建包) | 4 | 1-2 周 | 本周 + 1 |
| P2 数据平台(data/etl/metrics/scheduler 挂 DATA-D0-D8) | 1-4 | 1 周 | DATA-D0-D8 子批 OK 后启动 |
| P2 dw + copilot + arch | 5-7 | 3-4 周 | GA 收口前 |

**合计**:约 **6-8 周 / 12-16 个 PR**,可全部推到 v3.1 GA。

---

## 7. 与 13 硬规则对齐(每个 PR 自检)

按 `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 §8:

- [ ] 步骤 1:`install_auth(app)` 在 `create_app()` 第一行
- [ ] 步骤 2:每个 handler 第一行 `require_tenant(ctx)`
- [ ] 步骤 3:写 handler 用 `outbox.append(Event.create(...))` 同事务
- [ ] 步骤 4:出向调用用 `BearerAuth` + `OutgoingAuthMiddleware`
- [ ] 步骤 5:`tests/test_<app>_tenant.py` ≥ 3 cross-tenant negative
- [ ] 步骤 6:OpenAPI `security:` 段已升级三段式
- [ ] `pytest <app>/tests` 全绿;`pytest infra/tests` 全绿
- [ ] `git log` 显示每个 PR commit 信息包含 ADR-0014 引用

---

## 8. 关联文档

- `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2 — 17 域接入进度主表
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/decisions/ADR-0014-tech-services-integration.md` — 集成模式决策
- `docs/active/delivery/evidence/TECH-SERVICES-ACCEPTANCE.md` — canonical reference 验收
- `docs/active/delivery/evidence/BUSINESS-SLICES-ACCEPTANCE.md` — P1 wave 1 验收
- `docs/active/delivery/PROGRAM-BOARD.md` — 全局批次跟踪
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13 — 13 硬规则

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | 初版 v1.0(基于 main 分支 + bundled.yaml 解析) | TRAE 盘点 |