# ADR-0081：Agent 写路径的租约门禁、并发审批与工具结果三态

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0066（身份与任务作用域）、ADR-0067（委托身份）、
  `MP-RUN-LEASE-01`（租约/心跳/接管）、`MP-TOOL-IDEMPOTENCY-01`（工具调用账本）、
  ADR-0044（HITL 闸门 / `agent_invokable`）、13 硬规则 #9（审计）
- **范围**：**只修**影响本体审批与写入的 Agent 正确性；**不新增** Agent 能力

## 1. 背景（五处实测缺陷）

| # | 位置 | 症状 |
| --- | --- | --- |
| 1 | `api/run_control.py::resume` | `await self._claim_lease(...)` 的**返回值被丢掉** —— 拿不到租约也照样 `_service.resume`，两个副本同时进闸门的读-改-写 |
| 2 | `brain.py::resume` | 「读闸门 → 记决定 → 评估 → 够票就推进会」是**没有串行化**的读-改-写：并发审批丢决定（会签永远凑不齐）或**双推进图**（后续节点与本体写入跑两遍） |
| 3 | `tool_ledger.py` + `employee.py` | 只有 `running / completed / failed`，且 `failed` **允许重试**。**读超时被记成 failed** → "远端其实已经写成功"的那一次被重放 |
| 4 | `run_control.py` 心跳 | 续租失败只记一条日志就返回；图继续跑、继续写 —— **日志挡不住任何东西** |
| 5 | 写入面口径 | 缺一条**机器可验**的证据说明"agent 只能 propose，落库/人工闸门碰不到" |

## 2. 决策

### 2.1 `resume` 必须有有效租约，否则不推进图

`RunControl.resume` 先**有界等待**地抢这一轮的活跃租约（默认 2s，
`MATE_AGENT_TEAM_APPROVE_LEASE_WAIT_SECONDS`），抢到才 `_service.resume`；
抢不到抛 :class:`RunLeaseHeld`，API 翻成 **409 `E_RUN_LEASE_HELD`**（可重试）。

- 为什么是"等待 + 拒绝"而不是"直接拒绝"：两位审批人几乎同时到达时，后到的那位
  排一下队就能批上（决定不会因为时序白丢）；等不到才说明**另一个副本正在写它**，
  这时本副本插进去就是丢决定/重复推进。
- 为什么是"拒绝"而不是"当作已受理"：`E_RUN_LEASE_HELD` 明确表示**这一票没有被记下**，
  客户端重试即可；假装批完了才是把错误藏起来。

**本进程已经在驱动这一轮时不覆盖它的 `_LiveRun`**：`_live` 里那一条属于正在执行
（或刚跑到闸门、还在收尾）的那个请求，覆盖它会换掉它的心跳与执行代次语境。所以先
**有界等它收尾**（窗口只有几个 await），等不到才回绝。`submit` 与 `recover` 早就有
这道检查，只有 `resume` 漏了；`_close` 也一并改成**只摘自己那张牌**。

### 2.2 并发审批：读-改-写被租约串行化

活跃租约是这一轮"谁在写"的唯一裁判。`resume` 持有它直到 `_service.resume` 结束
（含 `ainvoke`），于是**同一时刻只有一个副本在闸门的读-改-写里**：

- **决定不丢**：第二个人排在后面进入，读到的是第一个人已经写回的决定；
- **闸门不重复推进**：只有拿着租约的那一次会 `ainvoke`；
- 第二个人若在等待窗口内没排到 → 409 `E_RUN_LEASE_HELD`，**它没有记下任何东西**
  （不是"丢了决定"，是"明确告诉你去重试"）。

会签语义不变：去重仍按 actor（同一个人批两次算一次），所以两条票必须来自不同审批人。

### 2.3 工具结果三态：明确成功 / 明确未执行 / 结果不确定

账本新增 `indeterminate` 状态，判据落在 `classify_tool_error(exc, tool_name=...)`：

| 情形 | 状态 | 能否重试 |
| --- | --- | --- |
| 成功 | `completed` | 回放结果，不再执行 |
| 只读工具失败 | `failed` | **可以**（重试一次读没有副作用） |
| **请求没发出去**（建连失败/超时、URL 非法、本地参数错） | `failed` | **可以**（"没落地"是确定的） |
| **结果不确定**（读超时、传输中断、5xx、认不出的异常） | `indeterminate` | **不可以**（远端可能已成功） |

- 只有**带副作用的工具**（`SIDE_EFFECT_PREFIXES`）才升格成 `indeterminate`；
  只读工具照旧 `failed` —— 不为"读失败"付"这一条永不再执行"的代价。
- **认不出就按不确定处理**是刻意的：代价是这一条不再自动重试（交给人核对），
  收益是不会在本体上写第二遍。
- 回灌给模型的话是明确的：**"结果未知，不是失败"**，附 `invocation_id`，
  并说明"不要用相同参数重试"（相同参数=同一个键，本来也会被账本挡下；换参数=新意图）。

### 2.4 失租后禁止发起新写；提交边界按执行代次拒绝

- 心跳续租失败 → 置 `_LiveRun.lease_lost`（**图不硬停**：硬停会留下半截）；
- 新增 :class:`RunWritePermit`：执行面在**发起写操作之前**问一次
  `allowed(tenant_id, run_id)`，判据依次是 `lease_lost`（内存快路径）→
  租约行不存在 → 主人换了 → **`lease_epoch` 比自己新**（这正是"旧执行代次"）；
  读不动租约表时 **fail-closed**（拒绝写）。
- **提交边界就在工具派发处**：`_gated_tool` 只对**带副作用的工具**问许可；
  被拒时**一个请求都不发**，账本记 `failed`（确定没落地），**接管方拿到这一轮时正该把这次写补上**。
- 装配是**迟绑定**的：服务先建（运行时要拿许可），控制面后建；组合根
  （`main.py`）先建壳交给服务，控制面建好后再 `bind` 真身，**且在 `recover()` 之前**
  ——续跑那条路也会写。

### 2.5 本体写入面：只经 Proposal，稳定业务标识可查询/可恢复

**机器可验的口径**（本 ADR 的验收就在这一条上）：

- Agent 侧**只有** `ont_propose_*` 形状的写入工具；`ont_confirm_proposal` /
  `ont_execute_proposal` / `ont_reject_proposal` 在**两个面**上同时关闭：
  MCP 中心按 `agent_invokable=False` 拒（`mate_tech_mcp/server.py`），
  agent-team 的闸门在**发现面**（不摆到模型面前）与**派发面**（照旧拒）各拦一次。
  于是"落库"（execute）与"人工闸门"（confirm/reject）agent 都碰不到。
- **稳定业务操作标识** = 账本键 `tool_call_id = sha256(工具名 ‖ 规范化参数)`
  （跨进程/跨轮次稳定，`tool_call_id` 不用框架给的随机 id）+ 可读形态
  `invocation_id = run_id:task_id:tool_call_id`。
  - **查询**：`tool_calls` 随子任务回执落检查点（`GET /runs/{id}` 可见），
    新增字段 `outcome` / `write_denied` / `indeterminate` / `invocation_id`；
  - **恢复**：`completed` 回放原结果、`failed` 允许重来、`indeterminate` 不重来。

## 3. 不做的

- 不新增 Agent 能力、不加新工具、不改 MCP 中心的 HITL 标志位。
- 不改本体（`mate-tech-ont`）的契约与幂等语义；不动 `ont_confirm/execute` 的
  `Idempotency-Key` 要求。
- 不做"失租后自动回滚"：已经写出去的副作用没有可逆承诺（与本体侧 ADR-0080 §6 同一口径）。
- 不把取消语义与失租语义合并：取消 → 落终态；失租 → 只禁写、不硬停。

## 4. 实施与验证

- **实现**
  - `api/run_control.py`：`RunLeaseHeld`、`approve_wait` 有界等待、
    `_claim_lease_waiting`、`_await_live_clear`、`_close` 只摘自己的牌、
    `_LiveRun.lease_lost`、心跳置位、`RunWritePermit` + `RunControl.write_permit`；
  - `api/app.py`：`E_RUN_LEASE_HELD` → 409；
  - `tool_ledger.py`：`INDETERMINATE`、`indeterminate()`（两个实现都有）、
    `_admission_for` 对不确定**撤销重试许可**、`SIDE_EFFECT_PREFIXES` /
    `has_side_effects` / `classify_tool_error`；
  - `employee.py`：`_settle_indeterminate`、异常分类落账、被拒写的回执文案、
    `write_permit` 接线与 `_ask_write_permit`（fail-closed）；
  - `wiring.py` / `main.py`：`WritePermitHolder` 迟绑定壳 + 组合根装配；
  - `eval/trace.py`：副作用清单**只留一份**（从 `tool_ledger` 导入，去掉重复口径）；
  - `mate-tech-mcp/tools/ontology_proxy.py`：HITL 命令带确定性幂等键（见 §5.4）。
- **测试**：`tests/test_agent_write_correctness.py`（**12 项**，先红后绿）
  —— 无租约不推进（含"别人的租约不许被我们释放"）、本进程 live 记录不被覆盖、
  并发会签不丢票且只推进一次、串行化探针、超时→不确定且重试被拒、建连失败→可重试、
  只读超时→可重试、写许可六种结论、失租禁写而只读放行、HITL 工具双面拒、组合根可装配。
  另：`tests/conftest.py` 的 `make_token(subject=...)` 支持第二个审批人；
  `mate-tech-mcp/tests/test_ontology_write_tools.py` 断言三个 HITL 命令都带确定性键；
  `tests/test_external_runtime.py` 的桩 CLI 强制 UTF-8 stdout（修掉 Windows 上的**假红**：
  桩按 cp936 输出中文、运行时按 UTF-8 解码 —— 是测试桩的编码问题，不是运行时的）。
- **证据**：`docs/active/delivery/evidence/AGENT-WRITE-CORRECTNESS-ACCEPTANCE.md`。

## 5. 已知边界（诚实登记）

1. **`ont_propose_*` 在本体侧不是幂等的**（`propose` 入口不读业务键，
   只有 confirm/execute/revert 那几条走 `ont_proposal_idempotency`）。
   所以"结果不确定"的 propose **一律不重试**；真出现重复提议时，兜底是人工
   ——提案列表里两条内容相同的 pending 提案看得见、可 withdraw。
2. **外部 runtime 不走本闸门**：`runtimes/claude_code.py` 这一片**没有接 MCP**
   （`--mcp-config` 未接），够不到本体；A2A 出站是把子任务交给远端 agent，
   远端自带的凭据与工具面不由本服务约束。这两条路的写治理**不在本批**。
3. **单事件循环下竞态需要 I/O 交错才显形**：内存检查点器没有真 I/O，读-改-写可能
   自己就串起来了。所以并发用例用探针断言**机制**（同一 run 的审批读-改-写不允许
   并发进入），而不去赌时序；机制 + 结果两个断言合起来才构成证据。
4. **`_HitlProposalTool` 经 MCP 调用会 400**（已修）：`confirm` / `reject` / `execute`
   三个端点都要求 `Idempotency-Key`，而 MCP 代理的 `_post` 不带这个头 —— agent 调不到
   这些工具（双层拦截），但用户侧经 MCP 调用必然失败。现在 `_HitlProposalTool._post_command`
   带**确定性幂等键** `mcp-<操作>:<目标>:<操作人>`：同一次操作重试 → 同一个键 → 本体
   `(tenant, operation, key)` 命中并**回放**；键里带操作人，避免不同的人各敲一次撞成
   "key conflicts with a different proposal command"（本体指纹含 actor）。
5. **写许可只覆盖 superai 运行时**（`_gated_tool` 那条路）。这是本服务里唯一
   经 MCP 派发本体工具的运行时；路由到别的 kind 时该闸门不生效（见第 2 条）。
