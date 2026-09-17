# Agent 产品层 2.1 · 迭代规划（生产硬化）

> **本文件的定位（挂靠关系）**：本文件是 **Agent 产品层的批次细节层**，挂靠在平台级季度计划
> `docs/active/specs/MetaPlatform-调整优化方案执行计划-2026-09-17.md`
> （13 周 / 6 Sprint / 2026-09-21 ~ 12-18，同一基线 `main@24976a4`）之下。
>
> **分工**：那份管**做什么、谁做、什么时候**（含量化准出、RACI、周计划）；
> 本文件管 **Agent 产品层这一刀怎么做、怎么验、证据在哪**——逐条差距带 `file:line`、
> 与 2.0 边界表对账、以及**它没有覆盖的 9 个批次**（见 §8）。
> **编号一律用它的 `MP-*` 体系**，2.1-A/B/C 只是本文件内部的阅读分组，不是对外批次号。
>
> 本文件不回写那份计划（它是未跟踪的在途文档）——反向引用由维护那份的人补。

---

> 2026-09-17 · 上游：`docs/active/delivery/evidence/AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3 边界表，
> 外加外部评审（2026-09-17，21 条差距）。评审的每一条都已**逐条核到代码/远端配置**，
> 核对结论与证据见本文件 §1。
>
> **交付形态**：内部三个分组 **2.1-A / 2.1-B / 2.1-C**，
> **对外批次号见 §8 的 `MP-*` 对照表**。
> **每组一份 `*-ACCEPTANCE.md` + 一份 goal-mode 启动提示词**——这正是 2.0 自己提的建议 #1
> （「从 2.1 起每版一份，别再积累」），本规划照办。

---

## 0. 为什么 2.1 是硬化而不是功能扩展

2.0 收口时功能面完整、357 测试通过。但**最能代表生产成熟度的五条性质，一条都还没有可判定的判据**：

| 性质 | 2.0 现状 | 证据 |
| --- | --- | --- |
| 副作用**最多一次** | 只有 **run 级**幂等。进程死在某一波员工在途，那一波整体重跑 | `api/run_control.py:44-47` 代码自认；工具调用级账本零命中 |
| 重启后身份**仍然可信** | 续跑走**服务身份**（client_credentials）；用户令牌刻意不落库 | `brain.py:249,259` 传 `user_token=""`；`wiring.py:49-58` |
| 审计**可取证** | 进程内 list，上限 1 万，重启即丢，多副本各存 | `audit.py:79-82`；docstring 自认「刻意不落 PG」 |
| 外部进程**不泄漏宿主** | `claude` 子进程继承 `os.environ`（含 DB DSN / Service Secret / Keycloak 配置） | `runtimes/claude_code.py:190` `{**os.environ, **self._env}` |
| 主干**真被门禁拦** | required check 只有 4 条；GA 在 `main` 上红着照样合 | 远端保护配置实取；`main` HEAD 的 `ga-acceptance` = failure |

**2.1 的目标只有一个**：把这五条从「机制存在」变成「有判据、可复现、能拦住」。

**2.1 明确不做**：不扩功能面。新数字员工类型、新图节点、新编排能力都不在本 release。
产品统一（会话↔run 落库、页面上下文感知、新旧 Agent 合并、Artifact 版本化）放在 **2.1-C**——
它虽然在本次范围内，但**不阻塞 A/B 的硬化判据**，可以最后做。

---

## 1. 与 2.0 边界表的对账（先做这件事，再立项）

外部评审给了 21 条。逐条核到代码后：**事实层面没有一条是编造的**，但有 3 处需要修正，
并且**其中 13 条是项目自己在 2.0 就已登记的边界**——评审把它们摊平重列，
读起来像全新发现。立项前必须分清哪条是「已知取舍、按『要做的条件』推进」，哪条是真新账。

### 1.1 三条需要修正的

| # | 评审原话 | 核对结论 |
| --- | --- | --- |
| 1 | GA 红灯「失败来自全仓库尾随空格；`CLAUDE.md` 被 Prettier 修改」 | **只说了一半**。`main` HEAD 上有**两个**失败 job：`ga pre-commit`（Prettier 卡在 `CLAUDE.md`）**和** `Architecture kernel governance / Pyright strict`（预存债、`continue-on-error`）。更要紧的是后果被说轻了：Prettier 失败后**后续 4 个 step 全部 skipped**，其中一条是 `mate-platform/tests (SEC-IAM-01 + SEC-TENANT-01 + PLATFORM-EVENT-01)`——**这些 GA 回归测试在 main 上根本没跑** |
| 2 | 审计「默认查询可返回所有租户，租户过滤由调用方负责」 | **只对库的默认参数成立**。对外端点 `api/app.py:281-287` 是**按调用方租户过滤**的；且每次 append 同发 `metaplatform.audit.agent_team` logger（`audit.py:29,112`）。准确说法是「**没有持久化的、可取证的结构化审计存储**」，不是「没有审计」 |
| 3 | 把 21 条当作同一批新差距 | **未区分「已登记」与「新发现」**。见 §1.3 |

### 1.2 评审漏掉的一条（本规划新增）

评审建议「用 Durable Worker / Temporal 承担副作用」，但**没注意到平台已经跑着 Temporal**：

- `mate-temporal-worker` 容器**当前就是活的**
- ADR-0061 **已 Accepted**
- `docs/active/V1.0-RELEASE-PLAN.md:175,220` 把 Sprint 1A 标成 **[x] Accepted（终验 2026-09-08，判据全过）**

这对结论是**加强**：该建议不是新引入依赖，而是与既有架构选择收敛。但同时暴露一处**文档自相矛盾**：

| 出处 | 说法 |
| --- | --- |
| `V1.0-RELEASE-PLAN.md:175,220` | Sprint 1A **Accepted**（2026-09-08 终验） |
| `CLAUDE.md:6`（**2026-09-17 本批刚更新**） | 「Sprint 1A 迁移尚未完成」 |
| `…architecture-implementation.md:12,167,853`（7 月版） | 仍为 **`Not Started`** |

同一个事实三种说法，**且最新更新的那份站在错的一边**。这比版本号写 `0.1.0` 更该先修（→ 2.1-A / A-7）。

### 1.3 21 条的对账结果

**「2.0 已登记」= 项目自己在 `AGENT-PRODUCT-LAYER-2.0-ACCEPTANCE.md` §3 / §5.4 里
已经写明「为什么留着 + 要做的条件」**，属于已知取舍，按原计划推进即可。

| 评审条目 | 2.0 是否已登记 | 2.1 落点 |
| --- | --- | --- |
| P0-1 执行是进程内后台任务、崩溃重跑整波 | 部分（代码注释自认，未进边界表） | **A-3** |
| P0-2 续跑缺用户凭据 | ✅ **B-1** | **A-2** |
| P0-3 审计不落盘 | ❌ **净增量** | **A-1** |
| P0-4 Required Checks 不足 | ✅ 1.6 边界 | **A-5** |
| P0-5 外部 CLI 继承宿主环境 | ❌ **净增量** | **A-4**（近端）+ **B-8**（远端） |
| checkpoint 无版本化 | ❌ **净增量** | **A-6** |
| 员工无不可变 revision | ❌ **净增量** | **A-6** |
| `runtimes` 未落库 | ✅ **1.1 边界**（代码 docstring 自认） | **C-5** |
| 无 lease/heartbeat、TTL 30s | ✅ **B-4** | **B-1** |
| SSE 靠 250ms 轮询 | ✅ 1.5 / 1.6 边界 | **B-2** |
| HITL 非原生 interrupt | ❌ **净增量**（评审自评「当前设计合理」） | **B-6** |
| conversation↔run 只在浏览器 | ✅ **§5.4** | **C-1** |
| 新旧 Agent 主线并存 | ✅ **§5.4** | **C-3** |
| ADR-0065 仍 Proposed | ✅ **B-8** | **C-2** |
| Artifact 只有 report 且覆盖写 | ❌ **净增量** | **C-4** |
| A2A 是同步适配器 | ✅ **B-7**（部分） | **B-7** |
| A2A 计入 `llm_calls` | ❌ **净增量** | **B-7** |
| 缺真实模型质量评测 | ❌ **净增量** | **C-6** |
| 观测指标不细 | ❌ **净增量** | **C-7** |
| Admin DSN 进运行 Pod | ❌ **净增量** | **B-4** |
| 未连接池 | ❌ **净增量** | **B-5** |
| 版本号 0.1.0 | ❌ **净增量** | **A-7** |

**净增量 8 条 + 顺带发现的文档矛盾 1 条**，才是 2.1 真正的新立项依据。
其余 13 条按 2.0 边界表里已经写好的「要做的条件」推进。

---

## 2. 2.1-A · 生产安全收口

> **主题**：让「最多一次 / 不能扩权 / 可取证 / 不泄漏 / 门禁真拦」成为**可判定的判据**。
> **准出即试点门槛**。

### A-4 外部 Runtime 进程隔离（**本批第一条做**）

**为什么排最前**：其余条目是可靠性/治理问题，**只有这条是当下就在生效的凭据暴露面**。
代码把宿主进程的 DB DSN、Service Secret、Keycloak 配置原样交给子进程
（`runtimes/claude_code.py:190`），而项目在 ADR-0040 / 1.4 里声称「沙箱按代码来源分层」——
说明分层目前只在**逻辑**上成立，**进程隔离根本没做**。

- 环境变量**白名单**（最小集），剥离一切宿主敏感变量
- 租户目录（`workspace_for` 的 `<tenant>/<task>`）只做文件隔离，不能当作安全边界——写进注释
- 远端形态（K8s Job）见 **B-8**，本批先做近端 subprocess 层

**判据**：有断言证明子进程 env **不含** DSN / Service Secret / Keycloak 配置；`{**os.environ, ...}` 被替换为白名单构造。

### A-1 持久审计

新增不可变审计通道。**复用平台既有 Outbox**（PLATFORM-EVENT-01），不新造总线：

```text
业务事务 → Outbox → Kafka / 审计存储（长期不可变）
```

事件形状：

```text
AgentAuditEvent
├─ event_id / tenant_id / run_id / task_id / actor_id
├─ agent_profile_revision
├─ action / decision / approver_id
├─ authority_before / authority_after / policy_version
├─ trace_id
├─ event_hash / previous_hash        ← 哈希链，可检出篡改
└─ created_at
```

- **保留**现有 `metaplatform.audit.agent_team` logger 通道（不删，只是不再作为唯一依赖）
- 查询**强制按租户过滤**，不只是「调用方责任」

**判据**：重启后审计可查；多副本合并视图一致；篡改任一行可被哈希链检出；跨租户查询被拒。

### A-2 Run Delegation Token

**前置：先出 ADR**——2.0 的 B-1「要做的条件」写明「**动这两处之前要先有 ADR**」（llmgw / MCP 协议面）。

- **不落原始 Bearer**（1.9 已立的硬约束，不破）
- 开跑时记录 run 授权；**恢复时由 IAM 重新签发**一份 per-run 短期委托令牌
- 约束：`delegation ⊆ 发起时包络 ⊆ 当前权限`，并支持**权限撤销后重新评估**
- 优先走 **Keycloak token exchange**（已在栈里），不自造签名服务

**判据**：重启续跑能**以用户身份**通过 llmgw / MCP 鉴权；权限被撤销后旧 run **不能继续扩权执行**；
全量历史快照断言原始 Bearer **零落库**。

### A-3 ToolInvocation 幂等账本

```text
ToolInvocation
├─ invocation_id = run_id + task_id + tool_call_id
├─ idempotency_key / input_digest
├─ status / result_digest / completed_at
├─ lease_owner / lease_expires_at
```

每笔工具调用用 `run_id + task_id + tool_call_id` 作幂等键。

**判据**：在工具执行的**任意时刻** kill 进程 → 恢复后**业务副作用最多一次**
（用带计数的假外部系统作可观测副作用桩，断言计数 ≤ 1）。

### A-6 State / Graph / Profile 版本化

两个「同一 Run 前后不一致」的来源，一起堵：

1. **状态无版本** —— `state.py:102-141` 的 `BrainState` 无任何 `*version*` 字段。
   加 `state_schema_version` / `graph_definition_version` / `agent_runtime_version` / `checkpoint_codec_version`
2. **员工定义无快照** —— `state.py:21-47` 的 `SubTask` 只有 `profile_id`；
   `profile_store.py:160` 是 `ON CONFLICT DO UPDATE` **覆盖写，无历史版本**。于是
   「Run 用员工 v1 起步 → 有人改了 Prompt/Model → 下一波实际跑的是 v2」。

   派活时生成不可变快照，Run / SubTask **永远引用 Snapshot**，不读可变 Profile 最新值：

   ```text
   AgentProfileSnapshot
   ├─ profile_id / revision
   ├─ prompt_digest / model_id / model_parameters
   ├─ skills[{id, version, digest}]
   ├─ tools[{name, schema_digest}]
   ├─ authority_envelope / runtime_kind
   ```

**判据**：旧版本 checkpoint fixture → 新代码读取 → 恢复 → 结果一致；
Run 中途改员工定义，**本轮行为不变**。

### A-5 门禁收口

- **格式 job 与功能 job 拆开** —— 格式红灯可以拦合并，但**不该让真正的验收结果整体缺失**
  （现状：Prettier 一红，`mate-platform/tests` 等 4 个 step 全 skipped）
- 进 required：Agent Team pytest + PG RLS + OpenAPI Contract + 前端 typecheck/unit + GA aggregate
- **CODEOWNERS**；普通 Agent 改动 ≥1 个非作者 approve，**权限 / Runtime / RLS / 审批类 ≥2 个**
- 修 `CLAUDE.md` 的 Prettier（`main` 当前红的直接原因）

**判据**：`main` **连续 10 次合并**全部 required check 通过；
GA 的 `mate-platform/tests` 有**真实跑过**的 run 记录（不是 skipped）。

### A-7 文档与版本口径订正

- 三处 Sprint 1A 说法统一（见 §1.2）
- `pyproject.toml:3` `0.1.0` + `:4` description「Agent 产品层 1.0」→ 与服务实际版本一致
- 版本**分离**，别再用一个模糊的「2.1」代表全部：

  ```text
  产品能力版本：Agent Product Layer 2.1
  服务版本：    mate-tech-agent-team 2.1.x
  图定义版本：  agent-team-graph/v3
  状态版本：    brain-state/v2
  API 版本：    v1
  ```

**判据**：三处口径与 `git log` 对得上；版本号在镜像 / 日志 / OpenAPI 里一致可读。

### 2.1-A 准出

**本文件自定的五条**（性质判据）：

```text
1. 进程在工具执行任意时刻被 kill → 恢复后业务副作用最多一次
2. 用户权限被撤销 → 旧 Run 不能继续扩权执行
3. 任何审批 → 重启后仍可查完整记录（审计可取证、可检篡改）
4. 外部 CLI 子进程 → 看不到任何宿主凭据
5. main → 连续 10 次合并全部 required check 通过
```

**叠加平台计划的量化准出**（那份计划写得比本文件硬，直接采纳，不另立一套）：

| 来源 | 指标 |
| --- | --- |
| 平台计划 S0 | 功能注册表覆盖 **100%** 前端正式路由与 OpenAPI 操作；关键包无「未解释预存红」 |
| 平台计划 S1 | `POST /runs` **p95 < 500ms**；SSE 首事件 **p95 < 1s**；相同 `Idempotency-Key` **并发 100 次只产生一个 Run** |
| 平台计划 S2 | 数据库 / 日志 / 检查点中**不存在原始用户 Bearer**；**3 副本并发压测无双重认领**；随机杀死执行 Pod 后 Run **30s 内被接管**并继续；跨副本取消 **10s 内**进入终态或明确等待状态；工具与 Action 重试**不产生重复业务副作用**；跨租户 / Marking / MCP 代租户负例全部通过 |

> **一致性要求**：同一指标的**数值只在一处定义**（平台计划），本文件只引用不重定义——
> 避免两套准出各自漂移。

---

## 3. 2.1-B · 分布式运行时收口

> **主题**：把「只在单进程、不重启前提下成立」的机制，在多副本下也做对。
> 依赖 A 批：**B-1 的接管条件要用到 A-3 的幂等账本**。

| # | 条目 | 要点 | 判据 |
| --- | --- | --- | --- |
| **B-1** | Run Lease / Heartbeat / 活跃 run 注册表 | `active_run_lease`：`run_id / owner_instance / lease_epoch / heartbeat_at / expires_at / current_step`。接管须同时满足：**lease 已过期 AND 无心跳 AND checkpoint 未进展 AND 幂等调用状态可恢复**。TTL 做成**可配 + 带续租**（2.0 的 B-4 已写明这条路） | 长跑 run 不被误接管；真崩的孤儿能接管 |
| **B-2** | Run Event Log + SSE 推送 | 新增 `RunEvent(sequence, run_id, event_type, payload, checkpoint_id, created_at)`；写入走 Outbox → `LISTEN/NOTIFY` 或 Redis Streams → SSE 网关。**checkpoint 仍是执行恢复的真相源，event log 只是产品观察模型**，不是两个冲突事实源 | 高并发下不再「连接数 × 每秒 4 次」读 checkpoint；`Last-Event-ID` 断线重连**按 sequence 补发**不丢事件 |
| **B-3** | 取消改异步 + 跨副本传播 | 取消接口返回 **202 cancel_requested**，客户端观察 `cancelling → cancelled`，不再暗示「回话那刻图已停」（2.0 的 B-3 明说这个强保证需要跨副本 live 通道——B-1 正是它） | 跨副本取消最终一定落终态；客户端能观测到中间态 |
| **B-4** | Admin DSN 移出运行 Pod | 建表/策略/权限移到**迁移 Job**；运行态只持**受 RLS 限制的 App DSN**；跨租户恢复扫描由**独立控制面身份**执行，而不是普通 Agent API Pod | 运行 Pod 的 env 里**没有** admin DSN；恢复扫描仍可用 |
| **B-5** | PG 连接池 | `psycopg[binary,pool]` **已声明却没用**（`pyproject.toml:19`）；6 处 `AsyncConnection.connect` 改池：`checkout → SET LOCAL tenant → transaction → RESET/rollback → return` | **专测连接复用不泄漏租户上下文** |
| **B-6** | HITL gate ABI 规范化 | 二选一成文：**原生 `interrupt()` + `Command(resume=…)`**，或**保留自定义 gate 但定义统一协议**（`gate_id / gate_type / required_roles / required_approvals / payload / editable_fields / expires_at / decision / decision_actor / decision_comment`）。**不能让每个图自己发明一种暂停恢复方式** | 至少支持多级审批 / 会签 / 超时 中的两项，且有用例 |
| **B-7** | A2A 长任务与计量拆分 | 补：状态轮询 / 中途取消 / trace / 外部 Artifact 映射 Evidence。计量**拆开**——现状 `outbound.py:266-268` 把一次外部往返记成 `source="llm"` / `llm_calls=1`，会让成本指标失真 | 拆为 `llm_calls / external_agent_calls / tool_calls / runtime_calls`；外部往返不再计入 `llm_calls` |
| **B-8** | Claude Runtime → K8s Job 沙箱 | 独立 ServiceAccount / 最小环境变量白名单 / 只读根 / `emptyDir` / seccomp / 非 root / CPU-Memory-Timeout 限额 / NetworkPolicy / **每次任务独立短期凭证**。第三方 runtime 再上 gVisor 或 MicroVM | 与 A-4 同一套断言，只是换到 Job 里跑 |

---

## 4. 2.1-C · 产品统一

> **主题**：把两条并行的东西收敛成一条。**不阻塞 A/B 的硬化判据**，可最后做。

| # | 条目 | 要点 |
| --- | --- | --- |
| **C-1** | conversation ↔ run 落后端 | 新增 `conversation_run(tenant_id, conversation_id, run_id, turn_id, created_by, created_at, relation_type)` + `GET /runs?conversation=…`。**后端成为唯一关系来源**，前端 Local Storage 降级为缓存。现状：`ChatPage.tsx:158` 的 `mp-agent-team-run:`，后端 grep `conversation_id` **零命中** |
| **C-2** | ADR-0065 页面上下文感知 | **先走评审转 Accepted**（现在仍是 Proposed，别偷偷升格），再按 S1~S3 小步实施。缺的是：当前页面 / 选中对象 / 筛选器 / 草稿 / 租户应用上下文 / 可执行导航目标 |
| **C-3** | 新旧 Agent 模式合并 | 收敛为一条链：`Conversation → AgentRun → LangGraph/LangChain Runtime → Task/SubagentRun/ToolInvocation → Evidence/Proposal/Artifact`。旧 copilot loop 明确标 **Legacy** 并给退役版本，或降为「Agent Team 的简单对话 Profile」 |
| **C-4** | Artifact 2.0 | 现状 `artifact_store.py:45` 只有 `report` 一种类型、正文 Markdown、确定性 ID + `ON CONFLICT DO UPDATE` **覆盖写**（`:223-232`）——覆盖会削弱复现。加 `version / immutable_digest / content_type / size / storage_uri / producer_run / producer_task / provenance / security_classification / retention_policy`。小文本留 PG，大文件进对象存储，元数据统一 PG |
| **C-5** | 员工 Revision + Runtime 配置管理 | `profile_store` 加 `runtimes` 列、HTTP 模型暴露该字段（现状：`profiles.py:78` 有，`profile_store.py:32-65` DDL 与 `api/schemas.py:117-149` 都没有）、提供管理界面。配 Runtime 可用性预检与降级策略，**不允许静默切换 Runtime** |
| **C-6** | 真实 Provider Golden Evaluation | 357 个测试证明的是「框架按预期执行」，**不是「模型能稳定完成企业任务」**。建固定 Golden Dataset，在真实 staging provider 上定期跑：任务拆解完整率/重复率、工具选择正确率、RID 正确率、证据覆盖率、无依据陈述率、重启后结果一致率、**重放副作用重复数**、token/成本、首响应/P95、敏感操作漏审率 |
| **C-7** | 观测指标细化 | 补 `input/output/cached_tokens`、`model_cost`、各类 latency、`runtime_kind / provider / model_version / prompt_digest / failure_category / replan_reason`。Span 分层：`agent.run / plan / wave / subagent / llm / tool / approval / artifact`，统一关联 `tenant_id / run_id / task_id / trace_id / conversation_id` |

---

## 5. 依赖顺序

```text
2.1-A（生产安全）          2.1-B（分布式）           2.1-C（产品统一）
├─ A-4 进程隔离（先做）      ├─ B-1 lease ←──┐        ├─ C-1 会话↔run
├─ A-1 持久审计              ├─ B-2 event log │        ├─ C-2 ADR-0065（先评审）
├─ A-2 delegation（先 ADR）  ├─ B-3 取消异步  │        ├─ C-3 新旧合并
├─ A-3 幂等账本 ────────────┼─→ B-1 接管条件 ┘        ├─ C-4 Artifact 2.0
├─ A-6 版本化 ──────────────┼─→ B-2 事件版本           ├─ C-5 员工 revision
├─ A-5 门禁收口              ├─ B-4 admin DSN           ├─ C-6 golden eval
└─ A-7 口径订正              ├─ B-5 连接池              └─ C-7 观测
                            ├─ B-6 HITL ABI
                            ├─ B-7 A2A
                            └─ B-8 K8s Job ←── A-4 的远端一半
```

**硬前置**：A-2 与 C-2 都需要**先出/先升格 ADR**——不要跳过文档直接写代码
（2.0 的 B-1 与 B-8 都写明这是条件）。

---

## 6. 复用既有能力，别自研（用户 2026-09-16 定的原则）

2.1 的每一条都应该先问「平台里是不是已经有了」：

| 2.1 要做的事 | 别自研，用这个 |
| --- | --- |
| 审计/事件的可靠投递 | 平台既有 **Outbox**（PLATFORM-EVENT-01），不新造投递 |
| 事件流的推送通道 | **PG `LISTEN/NOTIFY`** 或 **Redis Streams**（都在栈里），不自造消息总线 |
| 副作用的持久执行 | 平台**已跑着 Temporal**（ADR-0061 Accepted，`mate-temporal-worker` 在跑）——是否复用它承担 Activity，见下方风险 |
| per-run 委托令牌 | **Keycloak token exchange**（已在栈里），不自造签名服务 |
| 连接池 | `psycopg[binary,pool]` **已经声明了**，直接用 |
| 跨副本租约 | 优先 PG 原子语义（`RunClaims` 已有 `INSERT … ON CONFLICT … RETURNING` 的成功先例） |

> **风险提示（必须写进 A 批的开工说明）**：Temporal 的 **Sprint 1A 完成度存在文档矛盾**
> （§1.2）。**不能拿「容器在跑」当已上线证据**——项目自己在
> `…architecture-implementation.md:618` 就立过这条纪律。
> 2.1-B 若要让 Agent Team 复用 Temporal，**前置是先把 A-7 的口径订正做完**，
> 并据实确认 Sprint 1A 的验收边界。

---

## 7. 治理要求（每批都必须满足）

- **硬规则 #1**：新增 HTTP 面（审计查询 / event log / `GET /runs?conversation=` / runtime 配置）
  **必须先进 OpenAPI 契约**，并在 `docs/active/delivery/REQUIREMENT-MATRIX.yaml`
  登记 operationId（反向也查：矩阵里有而契约没有同样报错）
- **硬规则 #3**：新表一律在 tenant 上下文内访问
- **硬规则 #7**：**禁** `skip` / `skipif` / `xfail`（`importorskip` 放行）——外部依赖类的
  验证项按 1.8 的做法写成「回执如实」的常跑用例
- **硬规则 #10 / #12**：每批一份 ACCEPTANCE；secret 不进 git
- **每批一份 goal-mode 启动提示词**，体例见 2.0 那份
- **测试基线**：`.venv` 跑 `packages/mate-tech-agent-team/tests`，**只升不降**（2.0 基线 357）

---

## 8. 与平台计划的批次对照（挂靠表）

**编号一律用平台的 `MP-<域>-<动作>-01` 体系**。`2.1-A/B/C` 只是本文件内的阅读分组。

### 8.1 平台计划**已有**批次——本文件只补证据与判据

| 本文件条目 | 平台批次 | 平台计划已覆盖的部分 |
| --- | --- | --- |
| A-2 Run Delegation Token | **`MP-RUN-DELEGATED-IDENTITY-01`**（S2） | AuthorizationSnapshot + IAM Token Exchange + 重启后 llmgw/MCP/Ontology 重新签发身份 |
| A-3 工具幂等账本 | **`MP-TOOL-IDEMPOTENCY-01`**（S2，无独立批次号） | S2 工作项 9「对工具和 Action 增加业务幂等键」 |
| A-7 文档与版本口径 | **`MP-FEATURE-REGISTRY-01`**（S0） | 功能状态唯一真相源（本文件补：Sprint 1A 三处矛盾 + 版本号） |
| B-1 Run Lease / Heartbeat | **`MP-RUN-LEASE-01`**（S2） | 租约心跳 + 活跃 Run 注册 + Cancel Signal 归档 |
| B-2 Event Log + SSE | **`MP-RUNTIME-UNIFY-01`**（S1，工作项 5/6） | 追加式 `run_event` 真相表 + SSE 从统一 Event 投影 |
| B-3 取消改异步 | **`MP-RUN-LEASE-01`**（S2，工作项 5/6） | 取消语义改异步受理 + 明确终态等待方式 |
| B-6 HITL gate ABI | **`MP-RUNTIME-UNIFY-01`**（S1） | Approval 是统一 Run 契约的一部分 |
| B-7 A2A 长任务 | **`MP-EXTERNAL-RUNTIME-E2E-01`**（S3） | Claude / A2A 真执行 |
| C-1 会话 ↔ run 落后端 | **`MP-SESSION-RUN-LINK-01`**（S1） | 会话与 Run 持久关系 |
| C-2 页面上下文感知 | **`MP-CONTEXT-AWARE-01`**（S3） | 页面上下文协议（依赖 ADR-0065） |
| C-3 新旧 Agent 合并 | **`MP-LEGACY-SUNSET-01`** + `MP-RUNTIME-UNIFY-01` | 统一 Run + 双轨退役 |
| B-10 `tenant_switch_enabled` | **`MP-MCP-TENANT-SECURITY-01`**（S2） | 专用 MCP Client 或 Token Exchange，共享 Client 不得默认代任意租户 |

### 8.2 平台计划**没有**的——本文件新提 9 个批次

实测关键词命中（平台计划全文）：`os.environ` / `环境变量` / `白名单` **0**；
`state_schema` / `版本迁移` **0**；`连接池` / `pool` **0**；`哈希` / `hash` **0**；
`Golden` / `评测` **0**；`CODEOWNERS` / `分支保护` / `Prettier` **0**。

| 新提批次 | 交付 | 本文件条目 | 为什么平台计划漏了 |
| --- | --- | --- | --- |
| **`MP-AGENT-SANDBOX-ISOLATION-01`** | 外部 Runtime 环境变量白名单 → K8s Job 隔离 | A-4 + B-8 | `MP-EXTERNAL-RUNTIME-E2E-01` 管的是「**真执行**」，不管「**隔离**」。而 `runtimes/claude_code.py:190` 正在把宿主 DSN / Service Secret 交给子进程——**当下就在生效** |
| **`MP-AUDIT-LEDGER-01`** | 持久、可取证、带哈希链的 Agent 审计 | A-1 | 平台计划 13 处「审计」全在 **Action 层**（S4 `MP-ACTION-GOVERNANCE-01`）与格式统一（S5）；agent-team `audit.py` 的进程内 / 1 万上限 / 重启即丢 / 跨租户默认**未被点出** |
| **`MP-AGENT-VERSIONING-01`** | State / Graph 版本化 + 员工不可变 Revision 快照 | A-6 + C-5 | 全文 0 命中 |
| **`MP-MAIN-GATE-01`** | required check 收口 + CODEOWNERS + 非作者审批 + 修 `CLAUDE.md` Prettier | A-5 | 全文 0 命中。现状：GA 在 main 上红着照样合，且 Prettier 一红让 `mate-platform/tests` 等 4 个 step 全 skipped |
| **`MP-RUNTIME-DB-POOL-01`** | PG 连接池（租户安全 checkout）+ Admin DSN 移出运行 Pod | B-4 + B-5 | 全文 0 命中；`psycopg[binary,pool]` **已声明却没用** |
| **`MP-ARTIFACT-VERSIONING-01`** | Artifact 版本化 + 对象存储 + digest | C-4 | 平台计划有 Artifact 但无版本化；现状是**覆盖写**，削弱复现 |
| **`MP-EVAL-GOLDEN-01`** | 真实 Provider Golden Dataset + 10 项指标 | C-6 | 全文 0 命中。357 个测试证明的是「框架按预期执行」，不是「模型能完成企业任务」 |
| **`MP-OBSERVABILITY-DEEPEN-01`** | agent 层 Span 分层 + token / 成本 / 延迟细分 | C-7 | 平台计划 S6 有 staging 与性能，但无 agent 层 span 细化 |

> **提交给平台计划维护者的两条**：① 请把上述 9 个新批次号纳入它的 §8 批次清单
> 与 §13 P0/P1 Backlog；② 请在它那份里加一句反向指向本文件的引用。**本文件不替它改。**

### 8.3 分组 → 启动提示词 → 证据

| 分组 | 含批次 | 启动提示词 | ACCEPTANCE | 状态 |
| --- | --- | --- | --- | --- |
| **2.1-A** 生产安全收口 | `MP-AGENT-SANDBOX-ISOLATION-01` / `MP-AUDIT-LEDGER-01` / `MP-RUN-DELEGATED-IDENTITY-01` / `MP-TOOL-IDEMPOTENCY-01` / `MP-AGENT-VERSIONING-01` / `MP-MAIN-GATE-01` / `MP-FEATURE-REGISTRY-01` | `2026-09-17-ai-launch-prompt-agent-product-layer-2.1-a-goal-mode.md` | `AGENT-PRODUCT-LAYER-2.1-A-ACCEPTANCE.md` | 🟡 已规划，待开工 |
| **2.1-B** 分布式运行时收口 | `MP-RUN-LEASE-01` / `MP-RUNTIME-UNIFY-01`(事件流部分) / `MP-RUNTIME-DB-POOL-01` / `MP-EXTERNAL-RUNTIME-E2E-01` / `MP-AGENT-SANDBOX-ISOLATION-01`(Job 部分) | 待写 | 待写 | ⬜ 依赖 A |
| **2.1-C** 产品统一 | `MP-SESSION-RUN-LINK-01` / `MP-CONTEXT-AWARE-01` / `MP-LEGACY-SUNSET-01` / `MP-ARTIFACT-VERSIONING-01` / `MP-EVAL-GOLDEN-01` / `MP-OBSERVABILITY-DEEPEN-01` | 待写 | 待写 | ⬜ 依赖 A/B |

> **与平台计划 Sprint 的对应**：2.1-A ≈ S0+S2 的 Agent 部分；2.1-B ≈ S2 余项 + S3 外联；
> 2.1-C ≈ S1 + S3 + S5/S6 的 Agent 部分。**Sprint 的实际排期以平台计划为准**，
> 本文件的 A/B/C 只表达**依赖顺序**（A 未完成则 B 的接管条件不成立）。

---

## 9. 诚实的边界（本规划自己承认的）

1. **评审的成熟度打分（7.0/10 那套）不予采纳**——没有评分标准，不可证伪。
   本规划只采纳它的**事实清单**，不采纳它的**分值**。
2. **2.1 的判据里有两条依赖外部条件**：
   - A-4 / B-8 的「真跑」需要一台**已登录的 CLI 机器或注入凭证的 CI**（2.0 的 B-6，
     本机 `claude -p` 回 `Not logged in`）
   - B-7 的 A2A 真端到端需要**对端 A2A 服务**（2.0 的 B-7）
   这两条属于**环境条件不是代码缺口**，若届时仍不具备，按 1.8 的做法**如实回执**，
   不伪造证据、不加 skip。
3. **B-10 `tenant_switch_enabled` 不在本文件立项**——平台计划已用
   **`MP-MCP-TENANT-SECURITY-01`**（S2）承接它。但本文件的 A-2 会动 MCP 协议面，
   **动之前必须连带复核 B-10**（安全复核项，不能因为「另有批次」就绕过）。
4. **本规划是设计稿**。开工前每批仍需各自的 goal-mode 提示词把范围进一步收紧。
5. **挂靠是单向的**：本文件指向平台计划，**没有回写它**——那份计划目前是**未跟踪状态**
   （`docs/active/specs/MetaPlatform-调整优化方案执行计划-2026-09-17.md`），
   不是本会话创建的在途文档，不应被本会话改动。§8.2 的 9 个新批次号需要它的维护者
   接纳后才生效；在那之前它们只是**建议编号**。
6. **两套准出已做去重**：同一指标的数值只在平台计划里定义一处，本文件只引用。
   若后续平台计划改了数值，**改它那一处即可**，本文件的 §2.1-A 准出表不需要跟着改。
