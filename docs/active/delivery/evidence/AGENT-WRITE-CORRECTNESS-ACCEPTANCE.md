# AGENT-WRITE-CORRECTNESS ACCEPTANCE — Agent 审批与写入正确性

> **日期**：2026-09-23 · **ADR**：`docs/active/decisions/ADR-0081-agent-write-lease-approval-and-tool-outcomes.md`
> **范围**：只修**影响本体审批与写入**的 Agent 正确性；不新增 Agent 能力（不加工具、不加端点、不改本体契约）
> **测试基线**：`packages/mate-tech-agent-team/tests` = **617 passed / 0 failed**（本批新增 12 项：
> 604 → 617；原先唯一那条红已在同一批修掉，见 §4）。
> `packages/mate-tech-mcp/tests` 全绿（本批给 HITL 命令补幂等键）。

## 1. 五条目标的逐条对位

| # | 目标 | 改动 | 证据 |
| --- | --- | --- | --- |
| 1 | resume 未取得有效租约时**不得推进图或执行后续节点** | `RunControl.resume` 原先丢掉 `_claim_lease` 的返回值；现在**有界等待**抢租约，抢不到抛 `RunLeaseHeld` → API 409 `E_RUN_LEASE_HELD`，**不碰图**。同进程已有请求在驱动这一轮时也先**有界等它收尾**，不覆盖它的 `_LiveRun` | `test_resume_without_the_lease_refuses_to_advance`（并断言"别人的租约不许被我们释放"）、`test_resume_does_not_clobber_a_live_run_in_this_process` + 反向验证：去掉门禁即红 |
| 2 | 失租后**禁止发起新写**，提交边界**拒绝旧执行代次** | 心跳置 `lease_lost`；新增 `RunWritePermit`（判据：`lease_lost` → 无租约 → 换主人 → **`lease_epoch` 更新**；读不动则 fail-closed）；`_gated_tool` 在**派发前**问一次，被拒则**一个请求都不发** | `test_write_permit_refuses_without_a_valid_lease`（六种结论含 `superseded_epoch`）、`test_write_permit_denies_when_the_lease_store_is_unreadable`、`test_a_lost_lease_stops_the_write_tool_but_not_the_read_tool` |
| 3 | 工具结果区分**明确成功 / 明确未执行 / 结果不确定**；远端可能已成功但本地超时**不得标 failed 后盲目重试** | 账本新增 `indeterminate`；`classify_tool_error` 按"只读 / 没发出去 / 其余"三条判据分流，**认不出就按不确定处理**；`_admission_for` 对不确定**撤销重试许可** | `test_a_write_timeout_is_indeterminate_and_its_retry_is_refused`（主判据，反向验证即红）、`test_a_connect_error_on_a_write_is_definitely_not_sent_so_retry_is_allowed`、`test_a_read_only_timeout_stays_retryable` |
| 4 | 本体写操作**复用 Proposal、审批、统一执行器**；用稳定业务操作标识查询或恢复；不绕过治理 | 审计确认（并加机器判据）：agent 只有 `ont_propose_*` 形状；`confirm/execute/reject` 在 **MCP 中心**（`agent_invokable=False`）与 **agent-team 闸门**（发现面 + 派发面）双重关闭。稳定标识 = `sha256(工具名‖规范化参数)` + `invocation_id`，落账本、随回执可见 | `test_ontology_writes_stay_proposal_shaped_and_hitl_tools_are_refused` |
| 5 | 两位审批者并发时**决定不丢**、闸门**不重复推进** | 租约把闸门的读-改-写**串行化**（`resume` 持租约直到 `_service.resume` 结束）；等待窗口内排不上队的第二人得到**明确可重试**的 409（不是丢了决定，是没记下） | `test_two_approvers_concurrently_lose_no_vote_and_advance_once`（两条票都在 + **只推进一次** + 串行化探针 `max_active == 1`；反向验证即红） |

## 2. 验收场景对位（目标里点名的三种情形）

| 场景 | 期望 | 本批怎么保证 | 用例 |
| --- | --- | --- | --- |
| **双副本同时审批** | 不产生重复本体写入 | 租约串行化读-改-写；只有持租约者 `ainvoke`（= 后续节点/写只跑一遍）；另一人 409 可重试 | 见 #5 用例；`planner` 与 `runtime` 调用次数各为 1 |
| **执行中失租** | 不再发起新写，且**旧代次被提交边界拒掉** | `lease_lost` 快路径 + 提交边界按 `lease_epoch` 判；写被拒时**请求没发出**，账本记 `failed`（接管方补写） | `..._stops_the_write_tool_but_not_the_read_tool`、`..._refuses_without_a_valid_lease` |
| **远端写入成功后断连** | 不产生重复本体写入 | 该异常落 `indeterminate`（**不是 failed**）→ 同参数重放被账本挡下，且回执明确写"结果未知、不要照原样重试" | `test_a_write_timeout_is_indeterminate_and_its_retry_is_refused` |

**异常可追踪、可核对、可恢复**：

- 可追踪 —— 写被拒/结果不确定都在子任务回执的 `tool_calls` 里留字段
  （`outcome` / `write_denied` / `indeterminate` / `invocation_id`），随检查点可见；
- 可核对 —— 账本行带 `status / error / result_digest`，`invocation_id` 是稳定业务标识；
- 可恢复 —— `completed` 回放原结果、`failed` 允许重来（接管方正该补）、
  `indeterminate` **不重来**（改参数=新意图，或人工核对提案列表）。

## 3. 反向验证（用例有牙）

三条关键用例都做过**反向验证**（临时把修复退回旧行为，确认用例变红后再恢复）：

| 用例 | 退回的那一处 | 现象 |
| --- | --- | --- |
| 无租约不推进 | `resume` 恢复成"丢掉 `_claim_lease` 返回值" | 红：拿不到租约仍推进图 |
| 并发会签 | 同上 | 红：`max_active == 2`（两个读-改-写同时在里） |
| 超时→不确定 | `classify_tool_error` 一律返回 `failed` | 红：回执是 `failed`，且允许重放 |

## 4. 同批修掉的既有缺陷

| 缺陷 | 位置 |
| --- | --- |
| `resume` 丢掉租约结果（多副本同时审批的唯一入口） | `api/run_control.py` |
| `resume` 覆盖同进程正在执行那一轮的 `_live` 记录（`submit`/`recover` 早有检查，只有它漏了） | `api/run_control.py` |
| 续租失败只有日志、没有任何闸门效果 | `api/run_control.py` 心跳 |
| 超时=失败=可重试（远端已成功却被重放） | `tool_ledger.py` / `employee.py` |
| 副作用清单两份（评测一份、幂等一份） | `eval/trace.py` 改为从 `tool_ledger` 导入 |
| HITL 命令经 MCP 必然 400（本体要求 `Idempotency-Key`，代理不带） | `mate-tech-mcp/tools/ontology_proxy.py` |
| 外部运行时用例在 Windows 上假红（桩按 cp936 出中文，运行时按 UTF-8 解） | `tests/test_external_runtime.py` 的桩脚本 |
| 测试无法造第二个审批人（会签用例写不出来） | `tests/conftest.py`（`make_token(subject=...)`） |

## 5. 边界（与 ADR-0081 §5 一致，不夸大）

1. **`ont_propose_*` 在本体侧不幂等**（`propose` 入口不读业务键）：所以"结果不确定"的
   propose 一律不重试；重复提议的兜底是人工（提案列表可见、可 withdraw）。
2. **外部 runtime 不走本闸门**：claude CLI 这一片没接 MCP（够不到本体）；A2A 是远端
   自带凭据与工具面 —— 这两条路的写治理不在本批。
3. **单事件循环下竞态需 I/O 交错才显形**：并发用例用探针断言**机制**（不并发进入读-改-写），
   机制 + 结果两个断言合起来才算证据。
4. ~~`_HitlProposalTool` 经 MCP 调用会 400~~ **已修**（三个 HITL 命令现在带确定性
   幂等键 `mcp-<操作>:<目标>:<操作人>`，重试被本体回放）。
5. **写许可只覆盖 superai 运行时**（`_gated_tool` 那条路）——本服务里唯一经 MCP 派发
   本体工具的运行时。
6. **"执行中失租"没有多进程写路径 E2E**：本批验的是**机制层**——
   失租后写被拒（`lease_lost` / 换主人 / **epoch 被顶**）+ 被拒时请求没发出且记 `failed`
   - 账本 at-most-once 覆盖"执行到一半被杀"的窗口。`test_replica_two_process.py` 那套
   真进程 + PG 的排查用的是**租约**（接管本身已验），把它扩到"本体写只发生一次"
   需要给执行面加可控的工具停点，本批没做。

## 6. 复现

```bash
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests/test_agent_write_correctness.py -q
.venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q   # 617 passed / 0 failed
.venv/Scripts/python.exe -m pytest packages/mate-tech-mcp/tests -q         # HITL 命令的幂等键
```
