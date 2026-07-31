# BUSINESS-SLICES P2 Wave 2 — Pre-Merge Checklist

> 版本：v1.0 · 2026-07-30
> Worktree 分支：`codex/p2-wave-2`
> 关联：`2026-07-30-p2-wave-2-spec.md` v1.0
> 关联：`2026-07-30-per-app-integration-checklist.md` v1.0
> 关联：`2026-07-30-p2-wave-2-tasks.md` v1.0

每个 PR 在 owner review 前必须**逐条勾选**本 checklist。任何一条 ❌ 都不能合并。

---

## 通用：每个 PR 必检项（4 个 PR 共用）

### G.1 代码 5 步合规

- [ ] `install_auth(app)` 在 `create_app()` 第一行（或在 router 挂载的主包 main.py 里已有，复检不重复）
- [ ] 每个 handler 第一行 `ctx = request.state.ctx; require_tenant(ctx)`（**特例**：dashboard `auth/login` 前 ctx.tenant 允许空，用 `_require_ctx_or_anonymous()` flag 区分）
- [ ] 写 handler（POST / PUT / DELETE / PATCH）写 `outbox.append(Event.create(...))` 同事务；event type 命名 `<domain>.<aggregate>.<verb>`（如 `dashboard.settings.updated`）
- [ ] 出向调用（apphub → arch / kb；arch → ontology / kb；copilot → llmgw / kb）用 `mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`
- [ ] 5 步 step 5：`tests/test_<app>_tenant_integration.py` 含 **wrong-tenant / missing-scope / no-tenant** 三 case

### G.2 CI / pre-commit

- [ ] `python scripts/ci/forbid_raw_sql.py packages/<pkg>/src/` exit 0
- [ ] `python scripts/ci/forbid_bare_httpx.py packages/<pkg>/src/` exit 0
- [ ] `python scripts/ci/forbid_legacy_fallback.py` exit 0
- [ ] `python scripts/ci/forbid_skip_tests.py packages/<pkg>/tests/` exit 0
- [ ] `ruff check packages/<pkg>/` 净增 < 50 errors（5 步合规带来的不可避免 import 调整）

### G.3 OpenAPI security 三段式（v3.0 已批量升级；本批只需复检）

- [ ] `contracts/openapi/services/<domain>.yaml` 的 `security:` 段含 `bearerAuth` + `tenantHeader` + `oidcScopes`
- [ ] POST/PUT/DELETE endpoint oidcScopes 标 `platform.write`；GET 标 `platform.read`

### G.4 测试矩阵

- [ ] `pytest packages/<pkg>/tests/ -v` 全绿；happy-path 数 ≥ §6.1 表
- [ ] `pytest infra/tests -q` 全绿（回归）
- [ ] `pytest packages/mate-platform/tests/ packages/mate-app-kb/tests/ packages/mate-tech-msg/tests/ packages/mate-tech-obs/tests/ -q` 全绿（回归）
- [ ] 跨租户 negative 测试 ≥ 3（per app）

### G.5 Evidence & ADR

- [ ] `git log --oneline` 显示 commit 信息含 `ADR-0014` 引用
- [ ] PR description 引用 `2026-07-30-p2-wave-2-spec.md` + 本 checklist
- [ ] `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md` 在最后 PR#14 填写（本 PR 不强制）

---

## PR 专项 checklist

### PR#11 — dashboard 5 步合规（5 天）

#### 代码改动

- [ ] `packages/mate-tech-iam/src/mate_tech_iam/api/dashboard.py`：
  - [ ] 在 `router = APIRouter(...)` 之后，**module-level** import `require_tenant` / `assert_same_tenant` from `mate_platform.tenancy.guards`
  - [ ] 顶部加 `_require_ctx_or_anonymous(request)` helper：ctx 允许空但 token 必须存在
  - [ ] 34 个 handler 全部加 `request: Request` 参数
  - [ ] 14 个 GET handler 加 `ctx = request.state.ctx; require_tenant(ctx)`（auth/login 用 `_require_ctx_or_anonymous`）
  - [ ] 9 个写 handler 加 `_require_ctx_or_anonymous` + outbox event append（POST/PUT/PATCH/DELETE）
  - [ ] `_handle_*` 内部 helper（如有）也加 ctx 参数
- [ ] 不动 `install_auth`（已在 `mate-tech-iam/src/mate_tech_iam/main.py` 第 N 行就位；只 grep 确认）

#### 测试新增

- [ ] `packages/mate-tech-iam/tests/test_dashboard_tenant_integration.py` 新建：
  - [ ] `test_wrong_tenant_403`：tenant A token 调 tenant B 数据 → 403
  - [ ] `test_missing_scope_403`：无 `platform.read` scope → 403
  - [ ] `test_no_tenant_400`：empty tenant_id → require_tenant raise 400
  - [ ] `test_auth_login_anonymous_ok`：login 不需要 tenant
  - [ ] `test_settings_put_emits_outbox_event`：PUT /settings → outbox.append called with type `dashboard.settings.updated`
- [ ] `packages/mate-tech-iam/tests/test_dashboard.py` 新建 6 happy-path：
  - [ ] `test_get_profile_ok`
  - [ ] `test_put_settings_ok`
  - [ ] `test_post_api_keys_ok`
  - [ ] `test_put_notification_read_ok`
  - [ ] `test_post_todo_action_ok`
  - [ ] `test_post_anomaly_remediate_ok`
  - [ ] `test_get_search_ok`

#### 通过门槛

- [ ] `pytest packages/mate-tech-iam/tests/ -v` ≥ 9 passed
- [ ] pre-commit hooks 全 exit 0
- [ ] ruff check net delta < 30

---

### PR#12 — apphub 新包（5-7 天）

#### 新建文件

- [ ] `packages/mate-app-hub/pyproject.toml`：
  - [ ] `name = "mate-app-hub"`, `version = "0.1.0"`
  - [ ] `dependencies`: `fastapi>=0.115`, `pydantic>=2.0`, `mate-platform`, `mate-clients`
  - [ ] `dev-dependencies`: `pytest`, `pytest-asyncio`, `respx`, `ruff`, `pyright`
- [ ] `packages/mate-app-hub/src/mate_app_hub/__init__.py`
- [ ] `packages/mate-app-hub/src/mate_app_hub/main.py`：
  - [ ] `from mate_platform.auth import install_auth`
  - [ ] `from mate_platform.messaging.outbox import OutboxWriter`（虽然本批只 GET，但 future-proof）
  - [ ] `def create_app() -> FastAPI: app = FastAPI(title="mate-app-hub"); install_auth(app); app.include_router(router); return app`
- [ ] `packages/mate-app-hub/src/mate_app_hub/api/__init__.py`
- [ ] `packages/mate-app-hub/src/mate_app_hub/api/app.py`：
  - [ ] 5 GET handler，每个第一行 `ctx = request.state.ctx; require_tenant(ctx)`
  - [ ] 调 `repositories.in_memory.list_apps(...)` 等
- [ ] `packages/mate-app-hub/src/mate_app_hub/clients.py`：
  - [ ] `AsyncApphubClient` class（预留 P2 W3 给 arch / kb 调用）
- [ ] `packages/mate-app-hub/src/mate_app_hub/repositories/__init__.py`
- [ ] `packages/mate-app-hub/src/mate_app_hub/repositories/in_memory.py`：
  - [ ] `ApphubApp` / `ApphubGroup` / `ApphubModule` / `ApphubPage` / `ApphubTemplate` dataclass
  - [ ] 多 tenant dict `{tenant_id: {entity_id: entity}}`
  - [ ] `list_apps(tenant_id)`, `list_groups(tenant_id)`, `list_modules(tenant_id)`, `list_pages(tenant_id)`, `list_templates(tenant_id)` 5 个公共函数
  - [ ] seed fixture ≥ 15 个 apps（kb / rag / llmgw / mcp / obs / msg / ont / agent / arch / copilot / dashboard / dw / a2a / wfe / data）+ 3 groups + 8 modules + 12 pages + 6 templates
- [ ] `packages/mate-app-hub/tests/__init__.py`
- [ ] `packages/mate-app-hub/tests/conftest.py`：
  - [ ] `client` fixture (`TestClient(create_app())`)
  - [ ] `auth_headers_acme` / `auth_headers_globex` fixture
- [ ] `packages/mate-app-hub/tests/test_app_hub.py`：5 happy-path
- [ ] `packages/mate-app-hub/tests/test_app_hub_tenant_integration.py`：3 negative + 1 ok-isolation

#### Workspace 集成

- [ ] `mate-platform-backend/pyproject.toml` 的 `[tool.uv.workspace]` 加 `packages/mate-app-hub`
- [ ] `mate-platform-backend/contracts/scripts/build_platform.py` 不变（apphub 不在 main bundle）
- [ ] `infra/helm/charts/<domain>/` 不动（本批不进 helm chart）

#### 通过门槛

- [ ] `pytest packages/mate-app-hub/tests/ -v` ≥ 9 passed（5 happy + 3 negative + 1 isolation）
- [ ] pre-commit hooks 全 exit 0
- [ ] ruff check net delta < 30

---

### PR#13 — arch 新包（10-14 天）

#### 新建文件

- [ ] `packages/mate-app-arch/pyproject.toml`：同 PR#12 模板
- [ ] `packages/mate-app-arch/src/mate_app_arch/__init__.py`
- [ ] `packages/mate-app-arch/src/mate_app_arch/main.py`：同模板
- [ ] `packages/mate-app-arch/src/mate_app_arch/api/app.py`：
  - [ ] 27 GET handler，覆盖：
    - [ ] applications / business-processes / capabilities (/tree) / capability-mappings (4)
    - [ ] data-assets (/catalog) / data-entities / data-flows / data-standards / data/domains (5)
    - [ ] deployments / infrastructures (2)
    - [ ] governance/principle-categories / principles / review-templates / review-tickets / tech-debts (5)
    - [ ] impact-analysis / ontology-mappings/changes / rules (3)
    - [ ] orgs (/tree) / roles (3)
    - [ ] tech-stacks / technology-components / technology-radar / technology-stacks (4)
    - [ ] value-streams (1)
  - [ ] 每个 handler 第一行 `require_tenant(ctx)`
- [ ] `packages/mate-app-arch/src/mate_app_arch/clients.py`：
  - [ ] `AsyncArchClient` class
  - [ ] `mate_tech_ont` 代理调用（用 `OutgoingAuthMiddleware`）
  - [ ] `mate_tech_iam` org 调用
- [ ] `packages/mate-app-arch/src/mate_app_arch/repositories/in_memory.py`：
  - [ ] 12+ dataclass（Application / BusinessProcess / Capability / DataAsset / DataEntity / DataFlow / DataStandard / Deployment / GovernancePrinciple / Org / Role / TechStack / TechnologyComponent / ValueStream）
  - [ ] 多 tenant dict
  - [ ] seed fixture：≥20 applications + ≥15 capabilities + ≥10 data-assets + ≥5 orgs + ≥5 principles + ≥10 tech-stack entries
  - [ ] `value-streams` 用静态拓扑（DAG）
  - [ ] `impact-analysis` 用 BFS from `node_id` over capability tree
- [ ] `packages/mate-app-arch/tests/conftest.py`
- [ ] `packages/mate-app-arch/tests/test_app_arch.py`：5 happy-path
- [ ] `packages/mate-app-arch/tests/test_app_arch_tenant_integration.py`：3 negative + 1 isolation

#### Workspace 集成

- [ ] `mate-platform-backend/pyproject.toml` workspace 加 `packages/mate-app-arch`
- [ ] `infra/helm/charts/arch/` 不动

#### 通过门槛

- [ ] `pytest packages/mate-app-arch/tests/ -v` ≥ 9 passed
- [ ] pre-commit hooks 全 exit 0
- [ ] ruff check net delta < 30

---

### PR#14 — copilot 新包（14-21 天）

#### 新建文件

- [ ] `packages/mate-app-copilot/pyproject.toml`：同 PR#12 模板 + `sqlparse>=0.5` (SQL Copilot)
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/__init__.py`
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/main.py`
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/api/app.py`：
  - [ ] 33 endpoint（27 GET + 6 POST），按 §4.4 表格分组实现
  - [ ] A2A `/a2a/delegate` + `/a2a/external` → 返 501 Not Implemented + body `{error: "mate-app-a2a pending", code: "E_NOT_IMPLEMENTED"}`
  - [ ] `auth/login` POST → 返 `{access_token: "stub-copilot-..."}` + user fixture
  - [ ] `chat/multimodal/upload` POST → 调 `llm.stub_provider.embeddings()` + `repositories.in_memory.put_asset()`
  - [ ] `analysis/explain-sql` GET → `sqlparse.parse()` + stub explanation
  - [ ] `analysis/audit-sql` POST → `sqlparse.parse()` + check for SELECT * / DELETE without WHERE / etc.
  - [ ] `analysis/execute-sql` POST → 拒绝 non-SELECT（per spec §AC），返 dry-run result
  - [ ] `analysis/generate-sql` POST → 接受 NL prompt + table_name 返 stub SQL
  - [ ] `actions/{match,execute}` POST → 静态 action registry + execute stub
  - [ ] `generate/*` POST → 返 dashboard JSON skeleton / code stub / form spec
  - [ ] `queries/execute` POST + `/queries/history` GET → in-memory log
  - [ ] `scheduling/*` → stub matcher / executor / detector (regex match intent)
  - [ ] `ontology/concepts/search` + `/graph/expand` + `/graph/query` → 代理 mate-tech-ont 失败时 in-memory fallback
  - [ ] `knowledge-bases` GET + `search` GET → 代理 mate-app-kb 失败时空集
  - [ ] 写 handler 加 outbox event：`copilot.<action>.executed` / `copilot.sql.audited` / `copilot.multimodal.uploaded` / `copilot.multimodal.indexed` / `copilot.query.executed` / `copilot.scheduling.started`
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/clients.py`：
  - [ ] `AsyncCopilotClient` class
  - [ ] `mate_tech_llmgw` 代理（embeddings / chat stub）
  - [ ] `mate_app_kb` 代理（search）
  - [ ] `mate_tech_ont` 代理（concepts / graph）
  - [ ] `mate_tech_agent` 代理（orchestration）
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/llm/__init__.py`
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/llm/stub_provider.py`：
  - [ ] `embeddings(texts: list[str]) -> list[list[float]]` → 返固定 1536 维 fixture（hash → 数字）
  - [ ] `chat(messages: list[dict]) -> str` → 返 stub 回复
  - [ ] `generate_sql(nl_prompt: str, tables: list[str]) -> str` → 拼装 fixture
- [ ] `packages/mate-app-copilot/src/mate_app_copilot/repositories/in_memory.py`：
  - [ ] `Conversation` / `Query` / `Plan` / `Intent` / `Template` / `Action` / `CodeGeneration` dataclass
  - [ ] 多 tenant dict
  - [ ] seed fixture：≥10 conversations + ≥20 queries + ≥5 plans + ≥5 intents + ≥5 templates + ≥10 actions
- [ ] `packages/mate-app-copilot/tests/conftest.py`
- [ ] `packages/mate-app-copilot/tests/test_app_copilot.py`：8 happy-path
- [ ] `packages/mate-app-copilot/tests/test_app_copilot_tenant_integration.py`：3 negative + 1 isolation + 1 a2a-stub-501

#### Workspace 集成

- [ ] `mate-platform-backend/pyproject.toml` workspace 加 `packages/mate-app-copilot`

#### 通过门槛

- [ ] `pytest packages/mate-app-copilot/tests/ -v` ≥ 13 passed（8 happy + 3 negative + 1 isolation + 1 a2a 501）
- [ ] pre-commit hooks 全 exit 0
- [ ] ruff check net delta < 50

---

## 最终验收（PR#14 merge 后）

- [ ] `evidence/P2-W2-ACCEPTANCE.md` 填写：
  - [ ] 4 包 / 99 endpoint 全部 5 步合规
  - [ ] ≥19 happy-path 测试 pass
  - [ ] ≥12 tenant negative pass
  - [ ] 0 raw SQL / 0 bare httpx / 0 fallback / 0 skip
  - [ ] pyright strict exit 0
  - [ ] ruff check 净增 < 200（PR#11-14 累计）
- [ ] `PROGRAM-BOARD.md` v3.1 章节更新：BUSINESS-SLICES P2 W2 = Accepted
- [ ] `delivery-roadmap.md` v1.3 附录 B.6 更新：P2 W2 实际工时 + 净改动
- [ ] 在 `#platform-eng` Slack 通知 owner review 下一个 P2 W3 起点

---

## 关联文档

- `docs/active/specs/2026-07-30-p2-wave-2-spec.md` v1.0
- `docs/active/specs/2026-07-30-p2-wave-2-tasks.md` v1.0
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0
- `docs/active/specs/2026-07-30-backend-impl-backlog.md` v1.0
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13

---

## 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | 初版 v1.0 | TRAE 在 `codex/p2-wave-2` 分支起草 |
