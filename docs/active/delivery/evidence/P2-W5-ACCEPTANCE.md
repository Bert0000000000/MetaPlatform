# P2-W5 PR#17 — a2a 补 2 endpoint + wfe 建包 2 endpoint

> **批次**: P2-W5 PR#17
> **日期**: 2026-08-01
> **ADR**: ADR-0014（5 步接入模式）
> **状态**: ✅ Accepted
> **前序**: P2-W4 PR#16（arch + copilot 补齐）

## 1. 交付目标

| 域 | 目标 | 结果 |
|---|---|---|
| `mate-app-a2a` | 补 2 spec-only endpoint（agent-cards/search + delegations） | ✅ 2/2 |
| `mate-app-wfe` | 新建包 + 2 endpoint（flows/test + flows/validate） | ✅ 2/2 |

**未实现 endpoint**: 33 → **29**（-4）
**17 域接入进度**: 12/17 → **14/17**（+2：a2a 2/2 全通 + wfe 2/2 全通）

## 2. 规模指标

| 包 | 新增 endpoint | 新增测试 | 包测试 | 全后端 |
|---|---:|---:|---:|---:|
| mate-app-a2a | 2 (GET) | 4 (2 happy + 2 tenant) | 26 passed | — |
| mate-app-wfe | 2 (1 POST + 1 GET) | 10 (7 happy + 3 tenant) | 10 passed | — |
| **合计** | **4** | **14** | — | **604 passed** |

## 3. ADR-0014 5 步合规矩阵

| Domain | Step 1 (install_auth) | Step 2 (require_tenant) | Step 3 (outbox) | Step 4 (BearerAuth) | Step 5 (tenant tests) |
|---|---|---|---|---|---|
| `mate-app-a2a`（P2-W5 增量）| ✅ 沿用 | ✅ `_tid(request)` helper | n/a（2 个新增均为 GET 只读）| ✅ 沿用 `clients.py` | ✅ 2 tenant tests（isolation × 2）|
| `mate-app-wfe`（P2-W5 新建）| ✅ `create_app()` 首行 `install_auth(app)` | ✅ `_tid(request)` helper | ✅ `POST /flows/test` emit `wfe.flow.tested` outbox event | ✅ `AsyncFlowableClient` 预留（P2-W6 接 Flowable）| ✅ 3 tenant tests（isolation × 2 + no-tenant 400）|

## 4. 实现细节

### 4.1 mate-app-a2a 补 2 endpoint

| Endpoint | operationId | 实现 |
|---|---|---|
| `GET /api/v1/a2a/agent-cards/search` | `a2aGetA2aAgentCardsSearch` | 合并 internal agents + external agents 为统一 card 列表，按 id 排序，分页。card 带 `source` 字段区分内部/联邦 |
| `GET /api/v1/a2a/delegations` | `a2aGetA2aDelegations` | 复用 `list_delegations` + `task_to_dict`，分页 envelope（`/tasks` 的 canonical 分页版） |

新增 helper: `_paginate` + `_agent_card`（在 `api/app.py` 末尾）。

### 4.2 mate-app-wfe 新建包

**包结构**:
```
packages/mate-app-wfe/
├── pyproject.toml          # workspace 成员，依赖 mate-platform + mate-clients
├── README.md
├── src/mate_app_wfe/
│   ├── __init__.py
│   ├── main.py             # create_app() + install_auth
│   ├── clients.py          # AsyncFlowableClient 预留（P2-W6）
│   ├── api/
│   │   ├── __init__.py
│   │   └── app.py          # 2 endpoint + _emit + _paginate
│   └── repositories/
│       ├── __init__.py
│       └── in_memory.py    # 3 dataclass + BPMN 校验 + 种子数据
└── tests/
    ├── conftest.py
    ├── test_app_wfe.py             # 7 happy-path
    └── test_app_wfe_tenant_integration.py  # 3 tenant
```

**数据模型**: `FlowDefinition` / `FlowValidation` / `FlowTestRun`（frozen dataclass）。

**BPMN 校验** (`validate_bpmn`): 结构性检查（`<definitions>` root + `<process>` + `<startEvent>` + `<endEvent>`），返回 `(valid, issues)`。Flowable 8.0 引擎集成留 P2-W6。

**endpoint 行为**:
- `POST /flows/test`: 接收 `flow_id`（加载存储 BPMN）或 inline `bpmn_xml`（ad-hoc），跑校验，持久化 `FlowTestRun` + `FlowValidation`，emit `wfe.flow.tested` outbox event，返回 `{run_id, flow_id, status, output}`
- `GET /flows/validate`: 分页返回 `FlowValidation` 记录（含 `valid` + `issues`）

## 5. 实际运行结果

```text
# mate-app-a2a（含新增 2 endpoint）
$ uv run pytest packages/mate-app-a2a/tests/ -q
26 passed in 0.56s   # 22 原有 + 2 happy-path + 2 tenant

# mate-app-wfe（新建包）
$ uv run pytest packages/mate-app-wfe/tests/ -q
10 passed in 0.23s   # 7 happy-path + 3 tenant

# 全后端回归
$ uv run pytest packages/ -q --no-header
604 passed in 118.13s
```

## 6. 环境修复（附记）

`uv sync`（不带 `--all-packages`）会卸载 workspace 成员的 production 依赖
（structlog / sqlparse）。本次回归前执行 `uv sync --all-packages` 修复，
恢复了 7 个 tech 包的 structlog + copilot 的 sqlparse。

## 7. 13 硬规则对齐

| # | 硬规则 | 本次合规 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ 4 endpoint 均有 operationId + FR ID |
| 3 | 没有 tenant 上下文不访问 repository | ✅ `_tid(request)` + `require_tenant` |
| 4 | 外部系统没有 ACL Client | ✅ wfe `AsyncFlowableClient` 预留 |
| 7 | 契约/集成测试不跳过 | ✅ 14 tests pass，0 skip |
| 9 | 审计/指标/trace | ✅ 沿用 install_auth + OTel |
| 10 | 所有状态以验收证据为准 | ✅ 本文件 |

## 8. 后续

- **P2-W6**: wfe 接 Flowable 8.0 引擎（`AsyncFlowableClient` 真实实现）
- **数据平台控制面**: data 15 + etl 5 + metrics 5 + scheduler 5 = 30 endpoint（挂 DATA-D0-D8）
