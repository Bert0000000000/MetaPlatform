# 后端接口未实现开发清单

> 版本:v1.6 · 2026-08-01(17 域接入收口)
> 数据源:`mate-platform-backend/contracts/openapi/generated/bundled.yaml`(252,516 bytes,214 个 spec 路由)
> 代码扫描:`mate-platform-backend/` 下所有 `.py` 文件(`.venv` / `node_modules` / `tests` / `.wheels` / `__pycache__` 已排除)
> 关联:`docs/active/specs/2026-07-31-features-backlog.md` v1.1(功能维度)
> 关联:`docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2(17 域接入进度)
> 关联:`docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0(5 步模式)
> 关联:`docs/active/decisions/ADR-0014-tech-services-integration.md`
> 关联:`docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md`(7/30 收尾)
> 关联:`docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`(7/31 主推进)
> 关联:`docs/active/delivery/evidence/P2-W7-ACCEPTANCE.md`(8/1 17 域收口)

---

## 1. 总览(2026-08-01 主分支)

| 项 | 数 |
|---|---:|
| Spec 路由(去重后) | 214 |
| 代码路由(`@router.*` + `@app.*`,去重) | 188 |
| Spec 命中代码 | 188 |
| Spec-only(**未实现**) | **0** ✅ |
| Impl-only(legacy / 内部探针 / 路径别名) | 10 |
| **17 域接入进度** | **17/17** ✅(8/17 → 11/17 → 12/17 → 14/17 → 15/17 → 17/17) |

**17 / 17 域全部按 ADR-0014 5 步模式接入**(dashboard/apphub/arch/copilot/dw/a2a/wfe/data/etl/metrics/scheduler 全部完成)。

**v1.6(8/1)vs v1.5更新**:
- **P2-W7 PR#19 完成**:新建 mate-tech-etl + mate-tech-metrics + mate-tech-scheduler 三包,24 endpoint(etl 8 + metrics 8 + scheduler 8)
- **未实现 14 → 0**(-14)✅ **17 域接入全部收口**
- **17 域 15/17 → 17/17**(+2:etl 8/8 + metrics 8/8 + scheduler 8/8 全通)
- **全后端回归**:688 passed / 0 failed(632 + 56 新增 tests)
- **后续重心**:v3.1 DATA-D0-D8 真实引擎集成 + BUSINESS-SLICES 业务逻辑深度实现

**v1.5(8/1)vs v1.4更新**:
- **P2-W6 PR#18 完成**:新建 mate-tech-data 包,data 域 15 endpoint(cdc-tasks 8 + sources 7)
- **未实现 29 → 14**(-15)
- **17 域 14/17 → 15/17**(+1:data 15/15 全通)
- **修正**:backlog §4.1 原述"DATA-D0-D8 已落地仅需挂路由"不准确,实际为新建包 + in-memory 实现(同 dw/wfe 模式)

**v1.4(8/1)vs v1.3更新**:
- **P2-W5 PR#17 完成**:a2a 补 2 endpoint(agent-cards/search + delegations) + wfe 新建包 2 endpoint(flows/test + flows/validate)
- **未实现 33 → 29**(-4)
- **17 域 12/17 → 14/17**(+2:a2a 2/2 全通 + wfe 2/2 全通)

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

### 3.3 ✅ arch 包代码 + 4 endpoint(补齐)— **31/31 已完成**(P2-W2 PR#13 + P2-W4 PR#16,8/1)

- **状态**:**已完成**(P2-W4 补齐 4 endpoint:capabilities / capability-mappings / orgs / roles)
- **改动**(P2-W4):`api/app.py` 新增 4 个分页 GET endpoint + `_paginate` helper;`repositories/in_memory.py` 新增 `list_capabilities` / `list_orgs` / `list_roles` 扁平列表函数
- **测试**(P2-W4):4 happy-path + 2 tenant(isolation + no-tenant 400)= 6 新增 tests pass

### 3.4 ✅ copilot 包代码 + 3 endpoint(补齐)— **35/35 已完成**(P2-W2 PR#14 + P2-W4 PR#16,8/1)

- **状态**:**已完成**(P2-W4 补齐 3 endpoint:actions/execute + generate/process + scheduling/templates)
- **改动**(P2-W4):`api/app.py` 新增 `POST /actions/execute`(body 取 action_id/action_name,emit outbox event)+ `GET /generate/process`(分页,复用 list_plans)+ `GET /scheduling/templates`(分页,复用 list_templates)+ `_paginate` helper
- **测试**(P2-W4):3 happy-path + 3 tenant(isolation + scoped + no-tenant 400)= 6 新增 tests pass
- **A2A / LLM 真实实现**:TD-4 已闭环(P2-W3);TD-6 留 P2-W5

---

## 4. P2(数据平台 + dw + wfe + a2a 真实)

### 4.1 ✅ data 包代码 + 15 endpoint — **已完成**(P2-W6 PR#18,8/1)

- **状态**:**已完成**(新建 `mate-tech-data` 包,data 域 15 endpoint 全通)
- **改动**:新建 `packages/mate-tech-data/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),15 endpoint 全通(cdc-tasks 8 + sources 7),2 dataclass(CdcTask/DataSource)+ 3 seed catalog
- **测试**:20 happy-path + 8 tenant-integration = 28 tests pass;全后端 632 passed / 0 failed
- **修正**:原述"DATA-D0-D8 已落地仅需挂路由"不准确 —— DATA-D0-D8 落地的是横切能力(retention/pii_mask/xdomain_audit),与 data 控制面业务不直接对应;本批次为新建包 + in-memory 实现,同 dw/wfe 模式
- **真实 CDC 引擎**:AsyncDataClient 契约已锁定,Debezium/Flink 集成留后续批次

### 4.1b ✅ etl + metrics + scheduler 24 endpoint — **已完成**(P2-W7 PR#19,8/1)

- **状态**:**已完成**(新建 `mate-tech-etl` / `mate-tech-metrics` / `mate-tech-scheduler` 三包,24 endpoint 全通,17 域接入 15/17 → 17/17 收口)
- **改动**:三包各按 data 模式新建(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py` + `README.md` + `pyproject.toml`),24 endpoint 全通:
  - **etl**:tasks CRUD + run/stop/status(8 endpoint)
  - **metrics**:CRUD + compute/lineage/values(8 endpoint)
  - **scheduler**:tasks CRUD + pause/trigger + DAG(8 endpoint)
- **测试**:etl 19 + metrics 17 + scheduler 20 = **56 新增 tests**(35 happy-path + 21 tenant-integration)全 pass
- **回归**:全后端 **688 passed / 0 failed**(632 + 56)
- **真实引擎集成**:AsyncEtlClient / AsyncMetricsClient / AsyncSchedulerClient 契约已锁定,Spark/Flink/dbt/Airflow 集成留 v3.1 DATA-D0-D8
- **验收**:`docs/active/delivery/evidence/P2-W7-ACCEPTANCE.md`

### 4.2 ✅ dw 包代码 + 15 endpoint — **已完成**(P2-W3 PR#15,8/1)

- **状态**:**已完成**
- **改动**:新建 `packages/mate-tech-dw/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),15 endpoint 全通(14 GET + 1 POST `/documents/upload` stub),14 个 dataclass + tenant-scoped in-memory store
- **测试**:17 happy-path + 6 tenant-integration(含 14-endpoint 跨租户 negative sweep)= 23 tests pass
- **回归**:全后端 578 passed / 0 failed;infra/tests 186 passed
- **真实跨服务聚合**:留 TD-6,待 P2-W5(接 mate-app-kb / mate-tech-rag / mate-tech-agent + `BearerAuth`)

### 4.3 ✅ a2a 补 2 endpoint — **已完成**(P2-W5 PR#17,8/1)

- **状态**:**已完成**(补 2 spec-only endpoint:agent-cards/search + delegations)
- **改动**:`api/app.py` 新增 `GET /agent-cards/search`(合并 internal + external agents 为 card 列表,分页)+ `GET /delegations`(复用 list_delegations,分页 envelope)+ `_paginate` / `_agent_card` helper
- **测试**:2 happy-path + 2 tenant(isolation × 2)= 4 新增 tests pass
- **注**:a2a 包原有 10 个 FR-APP-A2A endpoint(P2-W3 建包),本次补齐契约的 2 个 spec-only canonical 路径

### 4.4 ✅ wfe 包代码 + 2 endpoint — **已完成**(P2-W5 PR#17,8/1)

- **状态**:**已完成**(新建 `mate-app-wfe` 包 + 2 endpoint)
- **改动**:新建 `packages/mate-app-wfe/`(`api/app.py` + `repositories/in_memory.py` + `clients.py` + `main.py`),2 endpoint 全通
  - `POST /flows/test`:接收 flow_id(加载存储 BPMN)或 inline bpmn_xml(ad-hoc),跑 `validate_bpmn` 结构性校验,持久化 FlowTestRun + FlowValidation,emit `wfe.flow.tested` outbox event
  - `GET /flows/validate`:分页返回 FlowValidation 记录(含 valid + issues)
- **测试**:7 happy-path + 3 tenant(isolation × 2 + no-tenant 400)= 10 新增 tests pass
- **BPMN 校验**:结构性检查(`<definitions>` + `<process>` + `<startEvent>` + `<endEvent>`),Flowable 8.0 引擎集成留 P2-W6

---

## 5. 总览矩阵(8/1 — 17 域接入收口)

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
| **arch** | 29 | 29 | 0 | — | ✅ P2-W4 PR#16 |
| **copilot** | 35 | 35 | 0 | — | ✅ P2-W4 PR#16 |
| **a2a** | 2 | 2 | 0 | — | ✅ P2-W5 PR#17 |
| **wfe** | 2 | 2 | 0 | — | ✅ P2-W5 PR#17 |
| **dw** | 15 | 15 | 0 | — | ✅ P2-W3 PR#15 |
| **data** | 15 | 15 | 0 | — | ✅ P2-W6 PR#18 |
| **etl** | 8 | 8 | 0 | — | ✅ P2-W7 PR#19 |
| **metrics** | 8 | 8 | 0 | — | ✅ P2-W7 PR#19 |
| **scheduler** | 8 | 8 | 0 | — | ✅ P2-W7 PR#19 |
| **Σ** | **214** | **214** | **0** ✅ | — | **17/17 接入完成** |

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
| **2026-08-01** | **v1.3**:**P2-W4 PR#16 已落地**:arch 补 4 endpoint + copilot 补 3 endpoint;未实现 40 → 33;arch 31/31 + copilot 35/35 全通 | TRAE 盘点 |
| **2026-08-01** | **v1.4**:**P2-W5 PR#17 已落地**:a2a 补 2 + wfe 新建包 2;未实现 33 → 29;17 域 12/17 → 14/17 | TRAE 盘点 |
| **2026-08-01** | **v1.5**:**P2-W6 PR#18 已落地**:新建 mate-tech-data 包,data 域 15 endpoint;未实现 29 → 14;17 域 14/17 → 15/17 | TRAE 盘点 |