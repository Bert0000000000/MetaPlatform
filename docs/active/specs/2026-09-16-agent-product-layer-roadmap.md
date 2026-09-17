# Agent 产品层 · 路线图与版本规划

> 2026-09-17 · **跨会话交接用**：每个版本的**范围 + 理由 + 证据 + 已交付 commit** 都在这里，新会话不必重新推导。
> 配套：**踩坑卡** `2026-09-16-agent-product-layer-env-facts.md`（**每个版本开工前必读**）

---

## 已交付

### 1.0 —— 一条主链端到端（PR #41 → `04d181bb`）

新服务 **`mate-tech-agent-team`**（8013，`/api/v1/agent-team/*`）。六任务判据全达成，端到端脚本 7/7。

- 定义：`2026-09-16-agent-product-layer-1.0.md`
- 启动提示词：`2026-09-16-ai-launch-prompt-...-1.0-goal-mode.md`

### 1.1 —— MCP 对外 + 身份 + 权限（PR #43）

| 任务 | commit |
|---|---|
| 1a 协议面租户绑定 | `e205fbd1` |
| 1b 客户端注册落库 | `4460ce2a` |
| 1c 本体收回总线 | `1afefb35` |
| 2 Codex 接入（附证据） | `2d82298f` |
| 3 员工身份落库 | `d8a4fdce` |
| 4+5 权限衰减 + 深度闸门 | `29346c2f` |

### 1.2 —— LangChain 迁移 + 双向消息（PR #44 → `1706ce9e`）

**迁移的理由与证据**（用户定位「以 langgraph + langchain 为核心」，1.0/1.1 只落实了 langgraph 那一半）：

- 全服务第三方 import 只有 `fastapi / pydantic / psycopg / langgraph`——**`langchain` 零 import**，而它**已装在 venv**
- 已装可用却未用：`create_agent` + **16 个中间件** + `tools/` `messages/` `chat_models/`
- 所谓"自研适配层"其实是**平行造了一套 LangChain 等价物**

**交付**：`create_agent` + `LlmgwChatModel(BaseChatModel)`（**通道未换**）+ `langchain-mcp-adapters`；启用 `summarization`/`context_editing`。测试 99→122。
**任务 2**：`team_task` 表（含 `inbox`）+ `TeamBus.send/consume_inbox/finish`；终态 409、跨租户 404。
**任务 id 统一**（`7b75f11b`）：`{run_id[:8]}-{计划内标签}`。

### 1.3 —— 派活加固 + 运行控制面 + 交付面（PR #45 → `6d417d93`）

三轨（`0e6c714a` / `75415380` / `0f95f361` + prettier `cd46e850`）。测试 131→163。

**轨 1 派活加固**：把 1.1 建好却**空转**的闸门接进真实路径。

- 发起用户包络**从令牌解析**（管理角色 → 能力全集；`tool:`/`action:`/`kb:`/`marking:` 前缀标记按维追加；**无令牌 = 空包络**，fail-closed）
- 派活一律走 `TeamBus.spawn`：越权 → 转 proposal **且不执行**；跨租户/深度超限 → 硬拒并**整轮判失败**
- 闸门**发放**的 `granted_tools` 直接喂运行时（此前判定与工具面是两份数据）
- `depends_on` 真执行：图按依赖**分波**（同波并行、跨波串行）；悬空/成环在**计划期**判失败

**轨 2 运行控制面**：`POST/PUT/GET /profiles`（定义包络须 ⊆ 创建者，否则 403）+ `POST /runs/{id}/cancel` + 运行级超时 + `GET /runs/{id}/events`（SSE 步骤级）

**轨 3 交付面**：容器重建。**两个只有真重建才暴露的坑**：

1. **Dockerfile 必须跟着代码涨**（1.2 引入 langchain 却没改 Dockerfile；源码是 bind mount，**本地永远看不出来**）
2. **compose 服务密钥变量**：`.env` 只有 `KEYCLOAK_CLIENT_SECRET`，写 `${SERVICE_CLIENT_SECRET:-}` 解析成空串 → startup RuntimeError → restart 循环。**`mate-tech-orchestrator` 有同一处问题（未修）**

---

### 1.4 —— 安全收敛（✅ PR #46 → `3aa05896`）

三件"建了但没兜住"的全补上：`d738a8d2` 包络四维在执行侧真的拦人 / `2328e318` 沙箱分层键由厂商身份改为代码来源 / `3d5e383e` 审批要角色、派活与越权与审批要落审计行。

**ADR-0040 已修订到 v1.1**（2026-09-17）：§2.1 分层键 = **代码来源**，不是厂商身份。修订理由三条写在 ADR 里：① 威胁面在代码来源上不在组织边界上 ② 代码来源是沙箱入口当场可判的元数据，出品方不是 ③ 提示注入/工具返回投毒/子员工产出都属"AI 生成"。

### 1.5 —— 运行控制补全（✅ PR #47 → `f3e91805`）

补掉 1.3 运行控制面自标的三条边界，再加重试。四件事都围着**检查点**做，没有另建 run 存储。

| 任务 | commit | 结果 |
|---|---|---|
| 1 执行中的 run 可取消 | `984b9960` | 控制面在开跑前认领 run，把取消标志交给图；图在 `plan`/`dispatch`/`gather` 三个边界自查，落终态 `cancelled`。粒度是**波与波之间**：在途那波跑完（不硬断），已完成节点不重跑，下一波一个员工都不派。`POST /cancel` 对执行中的 run **等图停下再回话** |
| 2 超时值持久化 | `a96ccf1a` | 生效值与**绝对**截止时刻随 run 落检查点；裁决改读状态里的 `deadline_at`，不再有进程内的第二份计时器。API 可读：`RunState.timeout_seconds` / `deadline_at` |
| 3 事件流尾随 | `0e02a743` | 回放 + 尾随：连上先补历史，之后新步骤即推送，终态才发 `end` 收流。**尾随靠轮询检查点**（不引入消息总线），新步骤最多晚一个轮询间隔到达 |
| 4 失败重试 | `406c221d` | `RetryPolicy`（次数/指数退避）+ `TransientRunError`。重试**只包住员工运行时那一次调用**，派活在循环外——所以"重试几次就派几次活"不会发生。刻意不用 langgraph 的**节点级** `RetryPolicy`（它重跑整个节点函数）。配套让 `LlmgwError` 标注 `retryable`（传输错/429/5xx 为真），运行时常在"还没有任何工具调用落地"时才抛给图重试 |

**留下的两条边界（写在这里，不假装没有）**：

- 取消信号是**进程内**的：跨副本取消执行中的 run 需要共享信号通道（停在闸门的 run 不受影响，终态写在检查点）。
- 事件流尾随靠轮询（当前 250ms 一轮），没有消息总线推。

**测试**：agent-team 202 → 218（+16）；另在 `mate-clients` 新增 12 条 llmgw 失败分类用例。`mate-kernel` 有 1 条**预存红**（`test_migrate_v1_v2::test_cli_invocation`，Windows GBK 解码子进程输出），与本批无关（该包零改动）。

### 1.6 —— 证据与交付（✅ PR #48 → `940a9d7b`）

四件事：证据接线 / 真实 Artifact / CI 门禁 / 前端工作台。agent-team **246 passed**（基线 220）。

| 任务 | commit | 结果 |
|---|---|---|
| 1 证据接线 | `cef1f4ba` | 新增 `evidence.py`，条目形状**复刻 copilot 的 `_evidence_items`**；前端**直接用 SuperAI 那个 `EvidenceRenderer`**——证据在 UI 上也只有一种样子。**比 copilot 严一处**：查询行没有实例身份时**直接丢弃**，不做位置占位（占位 ref 点进去必 404） |
| 2 真实 Artifact | `e2f1eeb6` | **落 PG 不落 MinIO**（`artifact_store.py` 注释写了三条理由，核心是**租户隔离只有 PG 是数据库强制的**）；id = `{run_id前8位}-{计划内标签}`，upsert 幂等 |
| 3 CI 门禁 | `0a5ecf0e` `7d993551` | `agent-team-tests` 进 `ga-acceptance.yml`（带 PG service，RLS 断言真跑），**不设 `continue-on-error`**；同批把 `api-gateway-tests` 也纳入。**用临时探针验证真卡后 revert**（`5b81e97a` → `e6b17de0`） |
| 4 前端工作台 | `6aae7ada` | 任务图 / 员工状态 / 证据 / 交付物 / 终态 |

**浏览器验证抓出的两个真问题（都已修，都是预存的）**：

1. `POST /runs` 同步约 60s，前端 axios 默认 30s → 提交必失败
2. **网关 60s 读超时 → 504，且 run 其实已建好拿不到 run_id**（用户看到"提交失败"，重试一次多跑一轮）

**1.6 剩下的两条真边界**（→ 就是 1.7）：① **分支保护没开**，`main` 完全无保护，且 `python-ci.yml` 有路径过滤，贸然加 required 会在不碰后端的 PR 上**死锁**；② 前端**没做 SSE 实时流**（`EventSource` 带不了 `Authorization` 头）。

---

### 1.7 —— 异步化与实时流（✅ PR #50 → `6ff46528`）

三项 + 一个真 bug：

| 任务 | commit | 结果 |
|---|---|---|
| 1 `POST /runs` 改受理制 | `edc40e60` | **202 + run_id**，实测 **202 在 0.22s**（原 ~60s）。幂等靠可选 `Idempotency-Key`：同键重复提交**原样回同一个 run_id** + `deduplicated: true` |
| 2 前端实时事件流 | `4abd5e4d` | **不用 `EventSource`**，`fetch` + `ReadableStream` 消费回放 + 尾随；拆掉旧 2s 轮询（**停在闸门空闲 7s 请求数 0**） |
| 3 分支保护 | `dc308727` | **`pull_request` 去掉 `paths` 过滤**，让 required check 不漏报；见 [[main-branch-protection-required-checks]] |

**顺带修掉一个真 bug（浏览器验证才暴露）**：**网关把 SSE 攒着不发**——`await client.request(...)` + `Response(content=upstream.content)` 是"整份读完再回话"，而事件流停在闸门时不关流 → 浏览器连响应头都收不到。改走 `send(stream=True)` + `StreamingResponse`。实测：直连 8013 +0.12s vs 经 8100 **修复前 20s 超时 / 修复后 +0.09s**。

**1.7 新边界**（→ 1.8+）：① 后台执行仍在**进程内事件循环**（进程重启在途 run 停住）② 幂等跨副本有极小竞态 ③ SSE 要求客户端声明 `Accept`。

---

### 1.8 —— 三轨并行（✅ PR #54 → `b30043d0`）

三轨全达成，**330 passed / 0 skipped**（基线 254）。

| 轨 | commit | 结果 |
|---|---|---|
| 1 可靠 | `9fd41c95` | 重启后可恢复的后台执行（**扫检查点续跑**，用 `ainvoke(None, cfg)`，不另建 run 真相） |
| 2 外联 | `87bbf4bd` | **外部执行面下投影（Claude Code）+ A2A 外联**（走 Projection 下放，非黑盒调 CLI） |
| 3 编排 | `4fb326bd` | **主图在同一轮 run 内有界重规划** |
| 修 | `8a2a1464` | 去掉 opt-in skip —— 按规则 7 改成"**回执如实**"的常跑用例（**不是加白名单**） |

**三条边界（各轨都有一条，值得记住）**：

1. **重启续跑没有链根包络** —— 令牌刻意不落库，所以进程重启后续跑的那一波会 **fail-closed 转待授权提案**。这是安全性质不是妥协；要真跑得另设计**与令牌分离的 per-run 派活授权**（→ **1.9**）
2. **外部 runtime 只验到 CLI 契约** —— 本机 `claude` CLI 未登录，真实模型调用做不了
3. **A2A 真端到端是人工验证项** —— 规则 7 禁 `@pytest.mark.skipif`，留不下自动用例

**两个反复踩的钩子**：`detect-private-key`（pre-commit）**比 gitleaks 更宽**——测试注释里都不能有私钥头连写，样本按片段拼；`forbid_skip_tests` 禁 `skip`/`skipif`/`xfail` 但**放行 `importorskip`**。

---

### 1.9 —— 多副本与重启下的正确性（✅ PR #55 → `8546cac3`）

启动提示词：`2026-09-17-ai-launch-prompt-agent-product-layer-1.9-goal-mode.md`

1.0~1.8 把机制建起来了，但有几处**只在单进程、不重启的前提下成立**。本批让它们在**多副本 + 重启**下也正确。**357 passed / 0 skipped**（基线 330）；CI 的 `agent-team pytest` job 绿。

| 任务 | commit | 结果 |
|---|---|---|
| 1 续跑的真授权 | `a4c142dc` | 新增 `delegation.py`：开跑那一刻把链根发成一份**与令牌分离**的 per-run 派活授权随 run 落库（只有 `run_id / granted_by / envelope / expires_at`，**没有凭据**）。续跑读它当链根，于是**真跑到底**；授权带 `run_id`，**不能跨 run 复用**；原始 Bearer 仍然一个字节不落库（全量历史快照断言）。`continue_run` 因"图拿 ctx 建、ctx 要从状态读"改为**先读检查点再建图**（`_stored_state`，走公开读法 `aget_tuple`） |
| 2 取消信号跨副本 | `a5d4619a` | 新增 `coordination.py` 的 `CancelSignals` 共享通道（进程内 + PG 实现，同库同 schema 同 RLS 写法）。图那条 `should_cancel` 改 **async**（信号在共享通道里，得真去读）；`gate` 补成**第五个**自查边界（它是"还没停下来"的最后一道门）。1.5 波边界语义不变 |
| 3 幂等跨副本竞态 | `443cfde3` | `coordination.py` 的 `RunClaims`：原子认领（`INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING`，不是"先查再写"）。同键并发**只产生一个 run**，跨副本同样成立。认领随执行结束归还，硬崩留下的孤儿坑在 TTL（默认 30s）后可被接管 |
| 修 | `8546cac3` | 两条续跑负例的崩溃点从"撞窗口"改成"构造"——**无令牌那一轮的员工根本不会被调起来**（越权直接转提案，毫秒级），它不会停在某一波里等着被撞见；CI（Linux）因这条红了而本机（Windows）绿，正是"靠跑得快慢撞窗口"的典型症状。改成把崩溃点放进**拆解**（慢拆解器），与有没有令牌无关 |

**契约面零改动**：无新 operationId，HTTP 语义与 1.7/1.5 一致，`agent-team.yaml` 与 `REQUIREMENT-MATRIX.yaml` 不需要动。

**四条遗留**（详见 PR #55）：

1. **续跑没有用户令牌** —— 上游按令牌解析租户的那几处（llmgw / MCP 协议面）仍走服务身份。1.8 就存在的边界，本批只解决"派活授权的链根"。
2. **取消信号粘性**（只置不清）—— 留一张只增不减的小表；能清才是错的。
3. **跨副本取消不保证回话那刻图已停** —— B 没有 A 的 live 记录，无法等；保证的是终态与信号都已落下。
4. **认领靠 TTL 兜硬崩** —— 正常路径随执行归还，被杀时孤儿坑 TTL 后可接管，接管后还有"查检查点"兜底。

---

### 2.0 —— 收尾 + 会话页整合（✅）

**交付**：轨 B `b64f5633`；轨 A（落档 / 统一验收 / 边界表 / 状态同步）同批。
**统一验收与边界表**：`docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md`
—— 1.0~1.9 逐版判据与出处、边界登记表（每条写「为什么留着 + 要做的条件」）、
浏览器实跑记录都在那里。

启动提示词：`2026-09-17-ai-launch-prompt-agent-product-layer-2.0-goal-mode.md`（3992 字符）

**两轨**（零文件交集）：

- **轨 A 收尾**（只动 `docs/`+`CLAUDE.md`）：落档 / 统一验收 / 边界表 / 状态同步
- **轨 B 会话页整合**（只动 `pages/superai/`+`api/`）：**会话能调 Agent 产品层全部能力** + **历史之上常驻调度可视化区域**

**用户 2026-09-17 追加**：「会话增加 Agent 的全部能力」「会话历史上面区域增加一个调度的可视化区域」。
现状是**两套调度表示**：会话页走**老 copilot stream**（调度信息散在每条消息里）、工作台走 **agent-team run**（任务图）——轨 B 就是把它们**合一**。

**轨 A 四件**：

1. **落档** —— 开工时工作目录有 **14 个未跟踪文档**（踩坑卡 / 路线图 / 能力面方案 / 调研报告各 1 + **10 个 goal-mode 提示词**，含 2.0 自己那份），此前只提交过 1.0 定义与 1.2 提示词
2. **统一验收** —— `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` 覆盖 1.0~1.9（此前只有 1.1 那份）
3. **边界登记成表** —— 每条写「为什么留着 + 要做的条件」
4. **状态同步** —— CLAUDE.md / 路线图 / **ADR-0065 如实（Proposed 就写 Proposed）**

**2.0 明确不做**：**不新增后端功能**（会话整合走既有 agent-team API）；ADR-0065（上下文感知）与 v6 轨道另立批次。

**收口结论（如实）**：轨 A 的落档是**硬判据**，已完成；但 1.0、1.2~1.9 **仍然没有
各自独立的 `*-ACCEPTANCE.md`**——2.0 这份只是把它们统一收成一张表，不是补写了
九份证据。边界表里 10 条**仍然开着**（其中 B-5 已在 1.9 闭合，保留仅为记录演进）。

---

## 版本规划

| 版本 | 主题 | 状态 |
|---|---|---|
| 1.0~1.9 | 见上「已交付」 | ✅ |
| **2.0** | **收尾 + 会话页整合** | ✅ |

### 接下来（未做，另立批次）

| 批次 | 主题 | 状态 |
|---|---|---|
| 2.1 | **上下文感知**（ADR-0065，页面上下文 → agent） | 🟡 **ADR 仍是 Proposed**，待书面评审 |
| 2.2 | **v6 轨道交汇**（dsh preset ×7） | 🟡 未启动；前置是"外部 runtime 能真跑" |
| 2.x | 编排深度（复杂图 / 主图重规划已部分交付） | 🟡 取决于产品需要 |

**诚实说明**：1.4 是"还欠账"（已建没兜住，属必须）；**1.5~2.0 是"加能力"，做不做取决于产品节奏**——例如没有回环场景就不必做复杂图。

**外联接入面已预验**：

- **Claude Code**：`.claude/agents/*.md`（subagent 全文即其 system prompt）+ `.mcp.json` + `settings.json`（含 managed 层，可被外部平台扮演）
- **dsh**：v6 草案的 `dsh preset ×7`（v6 轨道未启动）
- **A2A**：`Task` **无父子/深度**（v1 proto 实测），终态任务不能续发消息

---

## 一条原则（用户 2026-09-16 定，勿违）

> **「能用强大的功能就不要自研。」** 默认引入成熟组件，**自研需正面理由**。
> 旧约定「agent 编排必须自研」**已被推翻**——别再拿它当论据。
