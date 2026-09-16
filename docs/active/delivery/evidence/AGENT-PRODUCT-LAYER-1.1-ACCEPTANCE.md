# AGENT-PRODUCT-LAYER-1.1 · 验收证据

> 日期：2026-09-16 · 分支：`feat/agent-product-layer-1.1` · 基线：`origin/main` = `e29c4acd`
> 目标：MCP 中心能对外当 MCP 服务端（各自落在自己的租户）；1.0 绕开 MCP 的本体工具
> 收回总线；员工身份落库；权限包络衰减（子 ⊆ 上级）。
> 上游设计：ADR-0066 §3.3/§3.4、`docs/active/specs/2026-09-16-agent-product-layer-env-facts.md`

## 0. 测试基线 → 最终

| 项 | 值 |
| --- | --- |
| 开工基线（`mate-tech-mcp` + `mate-tech-agent-team`） | **277 passed / 1 failed** |
| 基线那条红 | `test_streamable_http.py::test_streamable_http_roundtrip` —— 全量跑时端口/时序抖动，单跑必过 |
| 最终（同两套） | **304 passed / 0 failed** |
| 最终（+ `mate-tech-orchestrator`） | 见 §7 |

## 1. 任务 1 · MCP 对外可服务

### 1a 协议面租户绑定

`MateStreamableHttpServer` 原先把动态工具面写死解析到 `default` 租户 —— 任何
外部客户端持哪把 `sk-mcp-*` 密钥，看到的都是同一份工具面。

改动：租户从 `request.state.ctx` 解析（`install_auth` 注入，经 Starlette mount
由 `scope['state']` 传递）；请求内解析不到租户 **fail-closed**
（`PermissionError`），不再回落 `default`；`default_tenant` 只用于无 HTTP 请求的
场景（stdio / 直接单测调用）。静态工具面同样按租户过滤。

**真实容器验证**（`mate-tech-mcp:8081`，重建镜像后）：

| 检查 | 结果 |
| --- | --- |
| A 的密钥看得到自己租户注册的动态工具 | ✅ `acme_only_tool` 在列 |
| **A 看不到 B 注册的动态工具**（跨租户负例） | ✅ 不在列 |
| 静态本体面可见 | ✅ `ont_object_query` 等在列 |

单测另含一条真实 streamable-http 往返：auth 中间件 → Starlette mount → 协议面，
两个不同租户头拿到两份不同工具面（`test_protocol_tenant_binding.py`，8 条）。

### 1b 客户端注册落库

`clients_repo.py` 的模块级 dict（`_CLIENTS`）→ PG 表 `mcp_clients`（迁移
`0020_mcp_clients` + `tenant_isolation` 策略 + `FORCE ROW LEVEL SECURITY`）。
每个读写按 `tenant_id` 过滤；别租户的行与不存在的行同义（无存在性预言机）。

**真实容器验证**：`POST /api/v1/mcp/clients` 建 `codex` → 查库得
`codex|tenant-default` 一行；`mcp_clients` 表由启动引导（`checkfirst`）与迁移
双路径创建。

单测 14 条：CRUD / 跨租户 list+get+update+delete 全负例 / 空租户 / **引擎重启后
仍在** / `require_tenant → repo` 的 HTTP 路径。

### 1c 本体工具收回总线

1.0 时 MCP 的本体代理用**服务身份** `client_credentials` token 出站，该 token
不带 `tenant` claim，本体 `AuthMiddleware` 判 403（实测；env-facts 记的 401 是
同一件事的更早形态）。agent-team 因此绕过总线、带用户 token 直连本体。

改动：

* 新增 `caller_context`（ContextVar）；协议面与 REST 桥在调用工具前绑定调用方的
  **租户 + 原始 bearer**
* `OntologyProxyTool` 出站改用绑定到的调用方身份；无绑定（stdio / 内部桥）才回落
  服务身份
* 用户 JWT → 原样透传；`sk-mcp-*` → **不透传密钥**，改用服务身份 +
  `X-Tenant-Id=<调用方租户>`（sk-mcp 是中心专用凭证，下游无法验签）
* `ont_list_classes` 的「只回 rid + 名称」裁剪从 agent-team 旁路**搬回总线**
* 删除 `mate-tech-agent-team/ontology_toolbox.py`（`OntologyToolbox` 直连旁路）与
  wiring 里的 `OntAgentToolsClient` 构造

**顺带修掉一个真 bug**：`ont_list_classes` 原先打 `/api/v1/ont/v2/agent-tools`，
而那个端点返回的是**虚拟工具注册表**（`query_<slug>` …，字段 `name`/`class_rid`，
没有 `rid`），裁剪逻辑按 `item["rid"]` 取 → **任何租户下恒回 `count: 0`**。
改打 `/api/v1/ont/v2/object-types` 后，同一租户从 0 条变 **47 条**（见 §2）。

**真实容器验证**：

| 检查 | 结果 |
| --- | --- |
| `ont_list_classes` 经总线可调（用户 JWT） | ✅ 200，返回裁剪后的 `{count, classes, hint}` |
| `ont_list_classes` 经总线可调（`sk-mcp-*` 密钥） | ❌ → 见 §6 遗留项（本体判 403） |

## 2. 任务 2 · 接入 Codex

完整配置与调用记录见 [`AGENT-PRODUCT-LAYER-1.1-CODEX-MCP.md`](./AGENT-PRODUCT-LAYER-1.1-CODEX-MCP.md)。

| 判据 | 结果 |
| --- | --- |
| Codex 侧能列出我们的工具 | ✅ 恰好 `enabled_tools` 里的 3 个 |
| 能成功调用一次 | ✅ `ont_list_classes` → `count: 47`（含真实 rid）；`ont_object_query` → `{kind, rows, result_schema}` |
| 越权工具被过滤 | ✅ 中心静态面 18 个工具，Codex 只见 3 个；`ont_confirm_proposal` 不可见 |

配置形状：`streamable-http` + `bearer_token_env_var` + `enabled_tools` /
`disabled_tools`（拒绝表在允许表之后生效）。

## 3. 任务 3 · 员工身份落库（ADR-0066 S0）

新增 `agent_team.employee_profile`：身份三要素（提示词 / 技能清单 / 工具白名单）
与权限包络四维（`tools` / `action_rids` / `kb_ids` / `markings`）。
建表走 admin DSN + RLS 策略 + `FORCE ROW LEVEL SECURITY`；未设 `app.tenant_id`
时一行都读不到（fail-closed）。`ProfileRegistry` 变租户相关：内置定义 +
本租户在 PG 里的行，库里的行按 `profile_id` 覆盖内置。

**判据对照**（`test_profile_store.py`，11 条，全部跑在真 PG 的 `mate_app` 角色上）：

| 判据 | 结果 |
| --- | --- |
| 建一个员工 → 重启服务 → 它还在 | ✅ 换 store 实例后仍读得到 |
| 跨租户不可见 | ✅ list / get / delete 全负例；**直连库的 RLS 断言**也挡住 |
| 身份三要素 + 包络四维往返 | ✅ |
| 空租户 fail-closed | ✅ 读空、写 `ValueError` |

## 4. 任务 4 · 权限包络衰减

包络 = `(tools, action_rids, kb_ids, markings)`。不变量 **子 ⊆ 发起用户**
（链根是用户，不是父 agent —— SuperAI 只是代用户行事）。

**选「转 proposal」而不是「403」的理由（判据要求二选一写明）**：D-4 把本仓
「AI 输出 = proposal」精确化为「**扩权才 proposal**」。403 会把"需要授权"
（用户点一下同意就能继续）与"根本不允许"（点多少次都没用）混成同一种失败。
真正"根本不允许"的两类仍走硬拒：**深度超限** 与 **跨租户**（profile 在该租户
名册里不存在）。

**negative 矩阵**（`test_authority_envelope.py`，19 条 + 深度 11 条）：

| 用例 | 期望 | 结果 |
| --- | --- | --- |
| 只收窄（tools/kb/markings 全 ⊆） | 放行，**不产 proposal** | ✅ |
| 包络完全相等 | 不算扩权（⊆ 不是 ⊂） | ✅ |
| `tool_scope` 里塞上级没有的工具 | 被交集吃掉，仍放行 | ✅ |
| 逐维越权：tools / action_rids / kb_ids / markings | 各触发一次 proposal | ✅ |
| 多维同时越权 | 逐维报出（`{tools, kb_ids}`） | ✅ |
| 父 agent 手里有更大包络 | **不作数**，天花板仍是用户 | ✅ |
| 授权只作用于该 task | 第二次派活不继承，仍待审 | ✅ |
| `revoke` 回收 | 包络回到空 | ✅ |
| 授权不改员工定义 | 库里 profile 不变 | ✅ |
| 跨租户 profile | `ProfileNotFound` | ✅ |
| 空租户 | `ValueError` | ✅ |

未批准的 task 包络为**空**（fail-closed）——调用方拿不到可用权限。

## 5. 任务 5 · 深度闸门

`max_depth` 默认 **3**（对齐 Codex `agents.max_depth` 与 Claude Code 默认 3 层），
可用 `MATE_AGENT_TEAM_MAX_DEPTH` 覆盖。计数约定：根任务 `depth=0`，子员工
`depth=1`；判定 `depth <= max_depth`。

| 判据 | 结果 |
| --- | --- |
| 第 3 层放行 | ✅ |
| **第 4 层被拒** | ✅ `DepthExceeded(depth=4, max_depth=3)` |
| 上限可配 | ✅ `max_depth=1` 时 depth=2 被拒 |
| 闸门顺序：深度先于包络 | ✅ 超限报 `DepthExceeded`，不被"顺便也算扩权"掩盖 |
| 被拒的派活不留 task | ✅ `task_ids() == []` |

## 6. 回归

| 套件 | 结果 |
| --- | --- |
| `mate-tech-mcp` + `mate-tech-agent-team` | **304 passed / 0 failed**（基线 277 passed / 1 failed） |
| 再加 `mate-tech-orchestrator` | **528 passed / 1 failed / 3 skipped** |

那 1 条红 —— `mate-tech-orchestrator/tests/test_temporal_rest_dualrail.py::
TestRestDualRail::test_temporal_execute_conflicts`（期望 409、实得 404）——
**是预存红，不是本轮回归**：在 `origin/main`（`e29c4acd`）的独立 worktree 上
单跑同一条用例同样失败。3 条 skip 是 orchestrator 的 PG/Temporal 依赖缺失。

基线那条红（`test_streamable_http_roundtrip`）本轮已**转绿**：它原先假设协议面
无需租户上下文，与新契约冲突；改为经认证中间件挂载后确定性通过。

## 7. 遗留与建议

1. **`sk-mcp-*` 调用方调本体类工具会 403（唯一的未闭环项）**
   MCP 对 API-key 调用方不透传密钥，改用「服务身份 + `X-Tenant-Id=<调用方租户>`」，
   但本体引擎要求该服务令牌带 `tenant_switch_enabled` scope 才认 `X-Tenant-Id`。
   该 scope **全仓零注册**（`grep -r tenant_switch_enabled` 只命中
   `mate_platform/auth/tenant.py` 的读取侧），即平台设计了这条通道但从未开通。
   实测：用户 JWT 路径 ✅ 200；sk-mcp 路径 ❌ 403「tenant switching is not enabled
   for this caller」。
   **这是一处需要拍板的安全边界**——给服务身份开「代任意租户行事」的能力，本轮
   未擅自开启。两条候选路径：① 给 MCP 服务 client 注册该 scope（最省事，但等于
   信任 MCP 可代表全部租户）；② Keycloak token exchange，用调用方密钥换一个带
   tenant claim 的短时令牌（更细，但要动 realm 的 exchange 配置）。
2. **派活闸门尚无 HTTP 面**：`TeamBus` 已装配到 `app.state`、判定与 negative 矩阵
   齐全，但**没有对外端点**。刻意不做，因为端点需要「发起用户的包络」作天花板，
   而「用户 RBAC → 包络」的解析还没有实现——让客户端自报包络等于自授权。该解析
   与 `POST /api/v1/agent-team/spawn`（契约先行）建议并入 1.2。
3. **`agent_team` schema 的 `employee_profile` 无 Alembic 迁移**：与 langgraph 表
   一样走启动期 `bootstrap(admin_dsn)`。若将来要进 alembic 链，注意 0017 起全链
   `upgrade head` 本就是预存断点（见 env-facts）。
4. **`mate-clients/ontology/OntAgentToolsClient` 现已无消费者**（agent-team 的直连
   旁路已删）。它是合规的 ACL client，未删以免误伤他处；确认无引用后可清理。
5. **`MCP_ALLOWED_HOSTS` 需带端口**：SDK 对 Host 精确匹配，只写 `localhost` 时直连
   `localhost:8081` 会被 DNS 防重绑定判 421。已在 docker-compose 补上默认端口的
   两条，非默认端口部署需自行追加。
6. **Codex 侧模型**：工作区默认 `gpt-6-astra` 要求更新版 Codex（CLI 0.145.0 下
   400）；本次用 ChatGPT 账号支持的 `gpt-5.6-luna` 驱动。
