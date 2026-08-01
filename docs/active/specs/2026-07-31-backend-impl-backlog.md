# 后端接口未实现开发清单

> 版本:v1.1 · 2026-07-31
> 数据源:`mate-platform-backend/contracts/openapi/generated/bundled.yaml`(252,516 bytes,214 个 spec 路由)
> 代码扫描:`mate-platform-backend/` 下所有 `.py` 文件(`.venv` / `node_modules` / `tests` / `.wheels` / `__pycache__` 已排除)
> 关联:`docs/active/specs/2026-07-31-features-backlog.md` v1.1(功能维度)
> 关联:`docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2(17 域接入进度)
> 关联:`docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0(5 步模式)
> 关联:`docs/active/decisions/ADR-0014-tech-services-integration.md`
> 关联:`docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md`(7/30 收尾)
> 关联:`docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`(7/31 主推进)

---

## 1. 总览(2026-07-31 主分支)

| 项 | 数 |
|---|---:|
| Spec 路由(去重后) | 214 |
| 代码路由(`@router.*` + `@app.*`,去重) | 184 |
| Spec 命中代码 | 174 |
| Spec-only(**未实现**) | **40** |
| Impl-only(legacy / 内部探针 / 路径别名) | 10 |
| **17 域接入进度** | **12/17**(8/17 → 11/17 → 12/17,apphub/arch/copilot/dw 完成) |

**9 / 17 域已 5 步模式接入 + 3 / 17 域 P2 已建包(dashboard/apphub/arch/copilot/dw 全部或基本完成)**;**5 域 P2 待建包**(data / etl / metrics / scheduler / a2a / wfe)。

**v1.2(8/1)vs v1.1(7/30)更新**:
- **P2-W3 PR#15 完成**:新建 `mate-tech-dw` 包,15 endpoint 全通(14 GET + 1 POST `/documents/upload` stub)
- **未实现 55 → 40**(-15)
- **17 域 11/17 → 12/17**(+1)

---

## 2. P0(已全部完成)

### 2.1 ✅ 路径对齐 · `app-kb → kb`

- **状态**:**已完成**(P0-CLOSE PR#1,7/30)
- **改动**:`mate-app-kb/src/mate_app_kb/api/app.py` handlers 移到 `/api/v1/kb/*`;旧 `/api/v1/app-kb/*` 作为 deprecated alias(emit `Deprecation: true` header)
- **测试**:10 个新增(`test_kb_path_alias.py`),全部通过

### 2.2 ✅ 路径对齐 · `llm → llmgw`

- **状态**:**已完成**(P0-CLOSE PR#2,7/30)
- **改动**:`mate-tech-llmgw/api/routes.py` APIRouter prefix `/api/v1/llm` → `/api/v1/llmgw`;BFF 路由同步
- **测试**:7 个新增(`test_llmgw_path_alias.py`),全部通过

### 2.3 ✅ mcp 路由挂载

- **状态**:**已完成**(P0-CLOSE PR#3,7/30)
- **改动**:`mate-tech-mcp/main.py` 整文件重写为标准 FastAPI router-mount 模式;5 endpoint 真正落地
- **测试**:7 个新增(`test_mcp_http_endpoints.py`),全部通过

---

## 3. P1(2 周内)

### 3.1 ✅ dashboard 缺 9 个 endpoint — **已完成**(P2-W2 PR#11,7/31)

- **状态**:**已完成**
- **改动**:`mate-tech-iam/api/dashboard.py` 补 9 个 PUT/PATCH;`install_auth + JWT iss/aud 统一 + InMemoryOutboxWriter 真实集成`
- **测试**:6 happy-path + 5 tenant negative = 11 tests pass

### 3.2 ✅ apphub 包代码 + 5 endpoint — **已完成**(P2-W2 PR#12,7/31)

- **状态**:**已完成**
- **改动**:新建 `packages/mate-app-hub/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),5 endpoint 全通
- **测试**:9 tests pass(in-memory 种子 + 4 tenant tests)

### 3.3 arch 包代码 + 2 endpoint(补齐)— **27/29 已完成**(P2-W2 PR#13,7/31)

- **状态**:**27/29 endpoint**(剩 4 endpoint 待补:capabilities / capability-mappings / orgs / roles 路径规范化后)
- **未实现**:`GET /api/v1/arch/capabilities`、`GET /api/v1/arch/capability-mappings`、`GET /api/v1/arch/orgs`、`GET /api/v1/arch/roles`(规范化后 4 个)
- **改动**:新建 `packages/mate-app-arch/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),27 endpoint 全通 + BFS 影响分析
- **测试**:9 tests pass + 4 tenant tests pass

### 3.4 copilot 包代码 + 3 endpoint(补齐)— **32/35 已完成**(P2-W2 PR#14,7/31)

- **状态**:**32/35 endpoint**(剩 3 endpoint 待补)
- **未实现**:`POST /api/v1/copilot/actions/execute`、`GET /api/v1/copilot/generate/process`、`GET /api/v1/copilot/scheduling/templates`
- **改动**:新建 `packages/mate-app-copilot/`(`api/app.py` + `llm/stub_provider.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),32 endpoint + SQL Copilot(sqlparse)+ 代码 Copilot + NLQ + 本体图 + 任务调度 + Action + 多模态上传
- **测试**:13 tests pass + 5 tenant tests pass(含 a2a 501 stub)
- **A2A / LLM 真实实现**:留 TD-4 / TD-6,待 P2-W3 / P2-W5

---

## 4. P2(数据平台 + dw + wfe + a2a 真实)

### 4.1 data + etl + metrics + scheduler 30 endpoint(1-2 周)

- **现状**:DATA-D0-D8 已落地后端模块(retention / pii_mask / xdomain_audit),但 **HTTP 控制面路由未挂**。
- **缺失**:30 个 endpoint
  - `data` 15 个(CDC tasks/sources CRUD + 启停 + status + test/schema)
  - `etl` 5 个(tasks CRUD + run/stop/status)
  - `metrics` 5 个(CRUD + compute/lineage/values)
  - `scheduler` 5 个(DAG + tasks CRUD + pause/trigger)
- **修复**:在 `packages/mate-tech-data/` 内新增 `api/control_plane/router.py`,把 DATA-D0-D8 已落地的 4 类能力以 HTTP 形式暴露。
- **5 步 checklist**:全量。
- **阻塞**:DATA-D0-D8 D0-D8 全部 Accepted ✅(已落地),仅需挂路由。

### 4.2 ✅ dw 包代码 + 15 endpoint — **已完成**(P2-W3 PR#15,8/1)

- **状态**:**已完成**
- **改动**:新建 `packages/mate-tech-dw/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),15 endpoint 全通(14 GET + 1 POST `/documents/upload` stub),14 个 dataclass + tenant-scoped in-memory store
- **测试**:17 happy-path + 6 tenant-integration(含 14-endpoint 跨租户 negative sweep)= 23 tests pass
- **回归**:全后端 578 passed / 0 failed;infra/tests 186 passed
- **真实跨服务聚合**:留 TD-6,待 P2-W5(接 mate-app-kb / mate-tech-rag / mate-tech-agent + `BearerAuth`)

### 4.3 a2a 真实实现(2 endpoint)— **stub 已挂,真实留 P2-W3**

- **现状**:`copilot/a2a/delegate` + `copilot/a2a/external` 已挂载为 501 stub(P2-W2 实现)。
- **缺失**:`/api/v1/a2a/agent-cards/search` + `/api/v1/a2a/delegations`(独立 a2a 域);copilot 内 2 endpoint 真实实现。
- **修复**:新建 `packages/mate-app-a2a/` 或在 copilot 内升级 stub;接入 Keycloak service account + agent 注册中心。
- **TD-4 范围**。

### 4.4 wfe 包代码 + 2 endpoint(1 周)

- **现状**:OpenAPI `services/wfe.yaml` 已签,`packages/mate-app-wfe/` 不存在。
- **缺失**:流程试运行 + 流程校验 2 个 endpoint。
- **修复**:新建 `mate-app-wfe`,挂 Flowable engine client(POST /flows/test 用 BPMN XML 试运行,GET /flows/validate 做 schema 校验)。
- **5 步 checklist**:全量。
- **阻塞**:Flowable engine 8.0.0 集成(docker-compose.yml 已配)

---

## 5. 总览矩阵(7/31)

| 域 | spec 路由 | 代码命中 | 未实现 | 工作量 | 优先级 |
|---|---:|---:|---:|---|---|
| iam | 5 | 5 | 0 | — | 🟠 deprecated |
| obs | 2 | 2 | 0 | — | ✅ P1 wave 1 |
| msg | 2 | 2 | 0 | — | ✅ P1 wave 1 |
| rag | 7 | 7 | 0 | — | ✅ P1 wave 3 |
| ont | 12 | 9 (去重) | 0 | — | ✅ P2 wave 1 |
| agent | 4 | 4 | 0 | — | ✅ P1 wave 2 |
| mcp | 5 | 5 | 0 | — | ✅ P0-CLOSE |
| kb | 5 | 5 | 0 | — | ✅ P0-CLOSE |
| llmgw | 3 | 3 | 0 | — | ✅ P0-CLOSE |
| **dashboard** | 38 | 38 | 0 | — | ✅ P2-W2 |
| **apphub** | 5 | 5 | 0 | — | ✅ P2-W2 |
| **arch** | 29 | 27 | **2** | 1 PR | **P2**(补齐) |
| **copilot** | 35 | 32 | **3** | 1 PR | **P2**(补齐) |
| **a2a** | 2 | 0(独立包) | **2** | 1 PR | **P2**(独立 a2a 域) |
| **wfe** | 2 | 0 | **2** | 1 PR | **P2** |
| **dw** | 15 | 15 | 0 | — | ✅ P2-W3 PR#15 |
| **data** | 15 | 0 | **15** | 1 周(挂 DATA-D0-D8) | **P2** |
| **etl** | 5 | 0 | **5** | 同上 | **P2** |
| **metrics** | 5 | 0 | **5** | 同上 | **P2** |
| **scheduler** | 5 | 0 | **5** | 同上 | **P2** |
| **Σ** | **214** | **174** | **40** | — | — |

---

## 6. 工作量与时序估算(7/31 更新)

| 优先级 | PR 数 | 工作量 | 起点 |
|---|---|---|---|
| **P1 dw** | 1 | 1-2 周 | 本周 |
| **P2 数据平台控制面**(data/etl/metrics/scheduler 挂 DATA-D0-D8) | 1-4 | 1-2 周 | 本周 + 1 |
| **P2 arch 补 2 + copilot 补 3 + a2a 真实 + wfe 建包** | 4 | 2-3 周 | 本周 + 1 |

**合计**:约 **4-7 周 / 6-9 个 PR**(从 7/30 的 6-8 周 + 12-16 个 PR 大幅压缩,主要因为 hub/arch/copilot/dashboard 9 个 PUT 已落地)。

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

- `docs/active/specs/2026-07-31-features-backlog.md` v1.1 — 功能维度盘点
- `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` v1.3 — 主 Roadmap(附录 B)
- `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2 — 17 域接入进度
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/decisions/ADR-0014-tech-services-integration.md` — 集成模式决策
- `docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md` — P0-CLOSE 收尾
- `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md` — P2-W2 主推进

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | v1.0 初版(基于 main + bundled.yaml 解析,未实现 125) | TRAE 盘点 |
| 2026-07-31 | v1.1:**P0-CLOSE + P2-W2 已落地**:未实现 125 → 55;17 域 8/17 → 11/17;新增 §4.1 数据平台控制面挂载计划 + §4.3 a2a 真实实现(TD-4)| TRAE 盘点 |
| **2026-08-01** | **v1.2**:**P2-W3 PR#15 已落地**:新建 `mate-tech-dw` 包,15 endpoint 全通;未实现 55 → 40;17 域 11/17 → 12/17 | TRAE 盘点 |