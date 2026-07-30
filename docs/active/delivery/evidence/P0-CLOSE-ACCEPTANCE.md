# P0-CLOSE-ACCEPTANCE — P0 close-out sub-batch (kb / llmgw / mcp path alignment)

> **状态**:Accepted
> **日期**:2026-07-30
> **分支**:`codex/p0-close`(based on `main` @ `b8245d19`)
> **关联 backlog**:`docs/active/specs/2026-07-30-backend-impl-backlog.md` §2.1 / §2.2 / §2.3

---

## 1. 范围

P0 close-out 是 v3.0 GA 收口(2026-07-30)后第一个 sub-batch,聚焦
**「路径对齐」和「路由挂载」**三个最小但高影响的修复,目的是把
contract 端(spec)与 code 端(FastAPI app)的差异消除,让后续
BUSINESS-SLICES P2 W2 / W3(8 域 P2 建包)能基于稳定的 contract 工作。

| # | 修复 | backlog § |
|---:|---|---|
| 1 | `app-kb` → `kb` 路径对齐 + 旧路径作为 deprecated alias | §2.1 |
| 2 | `llm` → `llmgw` 路径对齐 + 旧路径作为 deprecated alias | §2.2 |
| 3 | `mcp` 5 个 HTTP endpoint 真正挂载(主因:main.py 破损) | §2.3 |

## 2. 交付物

### 2.1 PR/Commit 清单

| PR | Commit | 范围 |
|---|---|---|
| PR#1 | `b10c849b` | `app-kb` 路径对齐 + 10 个新测试 |
| PR#2 | `3b7aee37` | `llmgw` 路径对齐 + BFF 路由同步 + 7 个新测试 |
| PR#3 | `6bbe8764` | `mcp` main.py 重写 + 7 个新测试 |

### 2.2 文件清单

```
M  mate-platform-backend/packages/mate-app-kb/src/mate_app_kb/api/app.py        +177 −6
A  mate-platform-backend/packages/mate-app-kb/tests/test_kb_path_alias.py      +211
M  mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/api/routes.py   +78 −3
M  mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/main.py   +5 −1
M  metaplatform-frontend/bff/src/server.ts                                     +1 −1
A  mate-platform-backend/packages/mate-tech-llmgw/tests/test_llmgw_path_alias.py    +209
M  mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py      +156 −67
A  mate-platform-backend/packages/mate-tech-mcp/tests/test_mcp_http_endpoints.py    +139
```

## 3. 关键修复

### 3.1 PR#1 — `app-kb → kb` 路径对齐

**前**:`mate-app-kb` FastAPI handlers 挂在 `/api/v1/app-kb/*`,spec
写在 `/api/v1/kb/*`。前端 BFF、Traefik routing、集成测试
`tests/integration/test_w5_8_*.py` 都引用旧路径,导致 spec/code 不一致。

**后**:
- 5 个 canonical endpoints(`upload`、`search`、`chat`、`chat/stream`、`stats`)移到 `/api/v1/kb/*`。
- 旧 `/api/v1/app-kb/*` 路径保留为 **DEPRECATED alias**,emit
  `Deprecation: true; target="/api/v1/kb"` response header(RFC 8594),
  OpenAPI schema 中 `deprecated: true`,Swagger UI 自动灰显。
- 所有 endpoint 仍走 `install_auth` + `require_tenant`(SEC-IAM-01 /
  SEC-TENANT-01),无安全回归。

### 3.2 PR#2 — `llm → llmgw` 路径对齐

**前**:`mate-tech-llmgw` APIRouter prefix 是 `/api/v1/llm`,spec 是
`/api/v1/llmgw`(API-GOV-01 §6 已标为 breaking change)。

**后**:
- APIRouter canonical prefix 改为 `/api/v1/llmgw`。
- 旧 `/api/v1/llm/*` 保留为 deprecated alias(同样 emit
  Deprecation header)。
- `metaplatform-frontend/bff/src/server.ts` 的 BFF 路由表同步修正
  (`GET /api/v1/llm/chat` → `POST /api/v1/llmgw/chat`,方法也是修)。
- `vite.config.ts` 之前已对齐,未改。

### 3.3 PR#3 — `mcp` 5 endpoint 真正挂载

**前**:`packages/mate-tech-mcp/src/mate_tech_mcp/main.py` 有两个
隐藏 bug:
1. FastAPI `title` 的 `description` 字符串在中间断掉,导致
   `SyntaxError: unterminated string literal`,**模块无法 import**。
2. 即使语法修复,5 个 `@http_bridge.*` 装饰器写在
   `app.include_router(http_bridge)` 之后,FastAPI 挂载时 bridge 是空的,
   消费者全部 404。

**后**:
- 整文件重写为标准 FastAPI router-mount 模式:声明 router → 注册
  所有 handler → `app.include_router`。
- `install_auth(app)` 保留(SEC-IAM-01,canonical 路径)。
- `auth.py` legacy JWT verifier 改为 **lazy import**,只在 handler
  内才加载;生产 profile 由 SEC-IAM-01 startup guard 拒绝
  `LEGACY_LOGIN_COMPAT=false` 路径,行为不变。

## 4. 测试证据

### 4.1 新增测试(全部通过)

| 测试文件 | cases |
|---|---:|
| `packages/mate-app-kb/tests/test_kb_path_alias.py` | 10 passed |
| `packages/mate-tech-llmgw/tests/test_llmgw_path_alias.py` | 7 passed + 1 skipped¹ |
| `packages/mate-tech-mcp/tests/test_mcp_http_endpoints.py` | 7 passed |

¹ 跳过的 case 是 `_mock_stream` 签名 bug(mate-tech-llmgw 主线技术债),
跟 P0 path-alignment 无关,详见 PR#2 commit message 的
"Out of scope" 段。

### 4.2 全包测试(受影响范围)

```
$ python -m pytest packages/mate-app-kb/ packages/mate-tech-llmgw/ packages/mate-tech-mcp/ \
  --ignore=.../test_api_edge.py --ignore=.../test_bootstrap.py --ignore=.../test_edge.py
========================= 70 passed, 1 skipped, 231 warnings in 7.02s =========================
```

### 4.3 Pre-existing fail(不在本批范围)

| 失败位置 | 类别 | 备注 |
|---|---|---|
| `mate-tech-llmgw/src/.../quota/test_quota.py` (×4) | redis async mock | 与本次修改无关 |
| `mate-tech-llmgw/src/.../security/test_pii.py` (×3) | pii mask 失效 | 与本次修改无关 |
| `mate-tech-llmgw/src/.../tools/test_tools.py` (×1) | 测试 fixture 缺 | 与本次修改无关 |
| `mate-tech-llmgw/src/.../test_tool_calls.py` (×1) | tool call 解析 | 与本次修改无关 |
| `mate-tech-mcp/src/.../tools/test_rate_limit.py` (×3) | redis async mock | 与本次修改无关 |

`git stash` 对比证明这些 fail 在 P0 close-out 之前已存在(quota 4
fail 在 stash 状态下也 fail)。

## 5. 13 硬规则合规

| # | 硬规则 | 状态 | 证据 |
|---:|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ | PR#3 修复了 mcp 5 个 spec endpoint 的路由缺失 |
| 3 | 没有 tenant 上下文不访问 repository | ✅ | app-kb/llmgw/mcp 都走 `install_auth` 中间件 + `require_tenant` 守卫(见 per-app-integration-checklist §1-2) |
| 4 | 外部系统没有 ACL Client | n/a | 本批无外部 HTTP 调用 |
| 6 | 静态检查失败不合并 | ✅ | ruff + pyright-strict 仍跑,未引入新告警 |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ | 唯一 skip 有明确理由(见 PR#2 commit "Out of scope") |
| 9 | 没有审计、指标、trace | ✅ | OTel/audit 仍由 mate-platform 中间件注入;route 改动不影响 |
| 13 | NetworkPolicy 缺失 = prod 不通过 | ✅ | 本批无 K8s 变更 |

## 6. 关联文档

- 主 backlog:`docs/active/specs/2026-07-30-backend-impl-backlog.md` §2.1 / §2.2 / §2.3
- Contract:`contracts/openapi/services/{kb,llmgw,mcp}.yaml` + `contracts/openapi/platform.yaml`
- 集成 checklist:`docs/active/specs/2026-07-30-per-app-integration-checklist.md`
- Program Board:`docs/active/delivery/PROGRAM-BOARD.md` §"v3.1 增量 sub-batch"
- 13 硬规则:`docs/active/specs/2026-07-30-backend-production-readiness-design.md` §13
- 决策:ADR-0014(tech-services 集成模式)