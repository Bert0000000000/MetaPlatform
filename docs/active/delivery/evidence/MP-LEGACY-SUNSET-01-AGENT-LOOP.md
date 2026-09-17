# MP-LEGACY-SUNSET-01 · SuperAI Agent Loop 退役登记

> **编制**：2026-09-18 · **批次**：Agent 产品层 2.1-C（C-3 / `MP-LEGACY-SUNSET-01`）
> **状态**：**Active（过渡期）** · **退役版本：2.2** · **退役窗口：2026-12-31**
> **关联**：ADR-0066（Agent Team 身份与派活）、`Agent 产品层 2.1` roadmap §4 C-3、
> `MetaPlatform-调整优化方案执行计划-2026-09-17.md` §4.2 / §8 / §17
> **本条退役的被测对象**：`POST /api/v1/copilot/chat/agent/stream`（SuperAI agent loop）

## 1. 为什么它要退

2.1-C 的目标是**只剩一条 Agent 主线**：

```
Conversation → AgentRun → Runtime → Task/ToolInvocation → Evidence/Proposal/Artifact
```

退役的不是"一个旧接口"，而是**第二套执行真相**：

| | 旧（本端点） | 新（主线） |
| --- | --- | --- |
| 入口 | `POST /copilot/chat/agent/stream` | `POST /api/v1/agent-team/runs` |
| 调度状态存哪 | SSE 事件流里（前端各自拼） | **落库的 Run**（检查点 / 事件日志 / 租约） |
| 可恢复 | 否（流断即失） | 是（B-1 续跑 + B-2 事件补发） |
| 审计 / 证据 / 交付物 | 无统一面 | 有（A-1 审计账本 / 1.6 证据与 Artifact） |
| 跨副本 | 否 | 是（B 批已验） |
| 契约 | **不在 OpenAPI 契约里**（见 §5-①） | 有（`contracts/openapi/services/agent-team.yaml`） |

两套并存的直接后果是**用户看到的"Agent 在干什么"有两个互相矛盾的来源**——
这正是平台计划 §17 第 3 条明令禁止的（"不让两个系统同时成为同一状态的权威来源"）。

## 2. 退役对象与保留对象（**别把保留的也一起删了**）

| 端点 | 处置 | 依据 |
| --- | --- | --- |
| `POST /copilot/chat/agent/stream` | **Legacy → 退役（2.2）** | 它做的是"派活给数字员工"，与 agent-team 的 Run 是同一件事的两套实现 |
| `POST /copilot/chat/completions/stream` | **保留**，不受影响 | 平台计划 S1 工作项 3 明写"旧 Copilot Stream **仅保留轻量直接问答**"——不派活、不调度、无事件真相，不属于双轨 |
| `/copilot/conversations*` | **保留** | 会话本身仍是主线的组成部分（C-1 的 `conversation_run` 就指着它） |
| `/copilot/scheduling/*` | 早已退役 | A3 吸收到 orchestrator，见 `_mark_deprecated` |

## 3. 已落地的 Sunset 标记

`mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/api/app.py`：

```python
_LEGACY_AGENT_LOOP_HEADERS = {
    "Deprecation": "true",                                          # RFC 9745
    "Sunset": "Thu, 31 Dec 2026 23:59:59 GMT",                      # RFC 8594
    "Link": '</api/v1/agent-team/runs>; rel="successor-version"',   # RFC 8288
    "X-Sunset-Version": "2.2",          # 本项目自加：平台按**发布版本**排退役节奏
    "X-Migrated-To": "/api/v1/agent-team/runs",
}
```

**为什么用标准头而不是自造的 `X-Sunset`**：仓库里既有两套写法（`mate-tech-ont`
用标准 `Sunset` 日期，copilot 的 scheduling 用非标准 `X-Sunset`）。本条目按标准写，
并额外带一个版本号——只给日期说不清"哪个版本之后没有"，而平台的退役是按版本排的。
**不是**要顺手统一别人那两处（那是各自批次的事，不在本条范围）。

调用方现在就能在响应头里读到"这条要退、退到哪去"，不必等公告。

## 4. 客户端迁移指引

```bash
# 1) 找出还打这条的调用方
grep -rn "chat/agent/stream" metaplatform-frontend/apps/web/src

# 2) 迁移映射
#   Agent 模式（派活给数字员工）→ POST /api/v1/agent-team/runs
#     请求：{goal, max_parallel, conversation_id?, turn_id?}
#     回执：202 {run_id, tenant_id, status, deduplicated}
#     观察：GET /runs/{run_id}（+ /events SSE，支持 Last-Event-ID 续传）
#   轻量问答（不派活）→ POST /copilot/chat/completions/stream（不变）
```

**迁移期内的已知调用方**（本批实测，不是估计）：

| 调用方 | 位置 | 处置 |
| --- | --- | --- |
| 会话页「Agent 调度」模式 | `pages/superai/ChatPage.tsx` | **保留入口但标 Legacy**（不删，避免打断在用的用户） |
| `CopilotDock`（全局悬浮助手） | `components/shell/CopilotDock.tsx` | 同上 |
| A2A 集成指引页 | `pages/mcp/A2aIntegrationGuidePage.tsx` | **指向主线**（文档面不该教人用退役接口） |

## 5. 如实登记的边界与发现

| # | 项 | 说明 |
| --- | --- | --- |
| **①** | **本端点从来没进过 OpenAPI 契约** | `grep -rn "chat/agent/stream" contracts/openapi/services/` **零命中**（只在 CI 生成的 `contracts/runtime/*.json` 里，那是运行时 dump 不是契约）。所以本条目**没有**契约改动可做——`deprecated: true` 无处可加。这本身就是它是 legacy 的一个旁证：主线那条（agent-team）是契约先行交付的。**不补**（给一个要退的端点补契约等于给它续命）；记在这里，避免下一次有人以为"漏登记了" |
| **②** | **没有真实流量指标** | 平台计划要求每条 Legacy 有"流量指标"。本机没有生产流量可测，所以**不给数字**——给了就是编。可观测的替代：上表三个调用方是代码级穷举（`grep` 得到，不依赖采样）；真正的流量指标要在 staging 起来之后从网关的按路径统计取 |
| **③** | **退役日期是版本号 + 窗口，不是"某天关机"** | 判据绑在 **2.2 发布** 上；`Sunset` 头给的是窗口末（2026-12-31，与 `MP-ONT-V1-SUNSET-NOTICE` 同一个窗口）。**两者不一致时以版本为准**——日期只是给不支持版本化预期的客户端的兜底 |
| **④** | **退役条件没有自动门禁** | 本条目只登记，没有 CI 检查"到期自动红"。要自动化的前提是 `MP-FEATURE-REGISTRY-01` 的功能注册表把这份表读进去（它已在本批之外） |

## 6. 与平台计划的关系

| 平台批次 | 关系 |
| --- | --- |
| `MP-RUNTIME-UNIFY-01`（S1） | 统一 Run 协议——本条目是它的**收敛动作**在产品层的落地 |
| `MP-LEGACY-SUNSET-01`（S6） | 平台级的 Sunset 表。**本文件是它的一条明细**，不另立体系；S6 汇总时把本节并入即可 |
| `MP-SESSION-RUN-LINK-01`（S1，本批已交付 `f44c0074`） | 会话↔run 落后端是"收敛成一条链"的**前置**：关系源不在后端，新旧合并就没有关系源 |
