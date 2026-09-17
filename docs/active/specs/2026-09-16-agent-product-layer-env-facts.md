# Agent 产品层 · 环境事实卡（踩坑备忘）

> 1.0 / 1.1 实跑踩出来的**不看代码看不出来**的事实。**开工前必须先读本卡。**
> 上游：`2026-09-16-agent-product-layer-1.0.md`、ADR-0066

## 1. 1.1 直接相关

| 事实 | 细节 |
|---|---|
| **MCP 协议面租户是写死的** | `mate-tech-mcp/src/mate_tech_mcp/protocol/streamable.py` 的 `MateMcpProtocol.__init__` 里 `self._tenant = default_tenant`（默认 `"default"`），`list_tools()` 用它调 `list_dynamic_tools(self._tenant)`。**这是 1.1 任务 1a 的唯一卡点** |
| **认证层其实已能解析租户** | `install_auth(app, api_key_verifier=mcp_api_key_verifier)`（`main.py:150`）；JWT 路径见 `auth.py:89`；`sk-mcp-*` 密钥见 `security/api_keys.py:227` 的 `mcp_api_key_verifier` → 返回 `RequestContext` |
| **MCP 对外面已存在** | `/api/v1/mcp/protocol/mcp`（FastMCP + streamable-http）。`main.py` 里那条服务注册的注释明写"外部 AI 客户端经 streamable-http 接入，写路径全部走 proposal+HITL" |
| **Codex 接 MCP 的确切配置** | `[mcp_servers.<id>]` + **StreamableHttp**（`url` / **`bearer_token_env_var`** / `http_headers` / `env_http_headers`）；过滤 = **`enabled_tools`（允许表）+ `disabled_tools`（拒绝表，在允许表之后生效）**。已读 `codex-rs/config/src/mcp_types.rs` 确认 |
| **MCP 容器无源码挂载** | 改 MCP 必须**重建镜像**，不能热重启（`docker inspect ... Mounts` 为空） |
| MCP 中心端口 | `8081`（见 orchestrator worker 的 `MCP_URL` 默认值） |

## 2. 租户隔离 / RLS（安全关键）

| 事实 | 细节 |
|---|---|
| **PG 表 owner 默认绕过 RLS** | 用服务角色调 `PostgresSaver.setup()` → 它成为 owner → **跨租户可读且不报错**。必须：admin 角色建表 + `FORCE ROW LEVEL SECURITY` 双保险 |
| **`meta` 是超级用户** | `rolsuper=true, rolbypassrls=true`。**隔离断言必须用 `mate_app:mate_app@localhost:5432/metaplatform`**（非超级、不绕过）。用 `meta` 测会**假通过** |
| 租户策略写法 | 需同时给 `USING` 与 `WITH CHECK`；上下文用 `current_setting('app.tenant_id', true)`；未设 = 返回空（**fail-closed，设计如此**） |
| langgraph 表 | `setup()` 建 4 张（`checkpoints`/`checkpoint_blobs`/`checkpoint_writes`/`checkpoint_migrations`）；前三张主键首列均为 `thread_id`；`thread_id` 格式 `租户ID\|任务ID` |

## 3. 身份 / 令牌

| 事实 | 细节 |
|---|---|
| **服务 token 的 `iss` 取决于换发地址** | 宿主机经 `localhost:8180` 取 → `iss=http://localhost:8180/...`；容器内经 `keycloak:8080` 取 → `iss=http://keycloak:8080/...`。网关与 llmgw 按自己的 `KEYCLOAK_URL` 校验 → **宿主机进程用服务身份调内部服务必 401**。只能进容器，或透传**用户** token |
| **MCP→ONT 服务身份无 tenant claim** | MCP 的本体代理用 client_credentials token 出站，该 token 不带 tenant claim，本体 `AuthMiddleware` 直接拒（401）。`X-Tenant-Id` 也救不了（需 `tenant_switch_enabled` scope） |

## 4. LLM 通道

| 事实 | 细节 |
|---|---|
| **llmgw 静默 stub-fallback** | 不带 `base_url`/`api_key` 时 llmgw **把输入原样回显**（`fallback: true`）——看着像模型答了，实际是**假回执**。真值要经 `GET /api/v1/admin/configs/service-read?prefix=ai.provider.&tenant=<tid>`（头带 `X-Service-Secret`）取 `ai.provider.<default_active>.{base_url,api_key,default_model}`；响应是**扁平 key→value 的 `data` 字典**，不是列表 |
| async 图 | 必须配 `AsyncPostgresSaver`；同步 saver + `ainvoke` 抛 `NotImplementedError`；Windows 上 psycopg async 要 `WindowsSelectorEventLoopPolicy` |

## 5. 平台侧

| 事实 | 细节 |
|---|---|
| **DSN 一律写 `127.0.0.1`** | Windows 上 `localhost` 先试 `::1`，Docker 端口映射在 `::1` 上"连上即被关闭"（表现为 `ConnectionTimeout`） |
| schema 隔离 | langgraph `setup()` 走 `search_path`，可在独立 schema 建表，便于验证与清理 |
| `setup()` 与事务 | DDL 含 `CREATE INDEX CONCURRENTLY`，连接**必须 autocommit** |
| 本体工具返回要裁剪 | `ont_list_classes` 回完整定义（47 类 × 几十字段）会淹没模型 → 它会**自己拼 rid** 然后 404。必须压成 rid+名称清单，并在提示词里禁止拼造 rid |
| 数据库清单 | `metaplatform`（主）/ `metaplatform_ont` / `metaplatform_agent` / `metaplatform_orchestrator` / `metaplatform_kb` / `metaplatform_wfe` / `metaplatform_iam` / `metaplatform_action` / `metaplatform_obs` / `metaplatform_ont_test` |

## 6. 1.0 留下的行为设计（**别当 bug 改回去**）

- 工具轮次用尽时**再要一次不带工具的纯文本答复**——否则员工 `status=ok` 却返回空产出，那是另一种"假回执"
- 对象类型清单**只回 rid + 名称**、工具结果裁剪上限 **8000**——回完整定义或上限太小都会让模型只看到前几个类型（**实测因此挑错订单类**）
