# ADR-0065：SuperAI Context-Awareness 协议（UI 状态 → Agent 的分层通道）

> **状态**：**Proposed（草案，待评审）**
> **日期**：2026-09-15
> **作者**：Claude + 用户协作
> **关联 ADR**：ADR-0021（Kernel 12 基元）、ADR-0043（all-in-one 集成核心 · AI proposal 管道）、ADR-0064（Action 统一 EditSet · propose_action 工具）
> **来源**：2026-09-15 开源调研 BuilderIO/agent-native（agent-native.com）Context-Awareness 协议——**引原理不引组件**（同 cordis 范式，ADR-0042 先例）
> **触发**：调研发现 copilot 已有 ad-hoc `interaction_context`，但无正式化分层协议；这是与 agent-native 对位中本项目唯一的概念性缺口

---

## 1. 背景

### 1.1 agent-native 的模型（调研原文）

BuilderIO/agent-native（4.8K stars / MIT / 2026-03 创建）的核心论点与本仓 ADR-0021/0064 **同构**：*"The agent does not click through the UI. It works through the same action layer as the UI."*——agent 与 UI 是平等伙伴，共享 action 层、数据与应用状态。

其中本项目尚未正式化的部分是 **Context-Awareness 协议**（agent-native.com/docs/context-awareness）：

| 层 | 谁写入 | 用途 |
| --- | --- | --- |
| `navigation` | UI | 语义路由状态：view 名、打开记录 ID、活跃 tab |
| `selection` | UI | 持久化的行/块/形状选中态 |
| `pending-selection-context` | UI / AgentPanel | 一次性划词上下文（Cmd+I 流） |
| `view-screen` action | Agent | 把状态键**水合**成新鲜 DB 记录（agent 行动前必调） |
| `navigate` 命令 | Agent | 一次性指令，告诉 UI 去哪（agent 永不直接写 navigation） |
| `sendToAgentChat()` | UI | 把一次点击/命令变成一个聊天轮次 |

四条硬约定：① 状态只存 ID+label，源记录由 agent 水合获取；② agent 不直接写 `navigation`，写 `navigate` 由 UI 执行；③ agent 操作当前 UI 前必须先 `view-screen`；④ URL 参数是可分享过滤器的唯一事实源。

### 1.2 本仓现状（v0，已存在）

| 环节 | 位置 | 现状 |
| --- | --- | --- |
| 前端类型 | `useOntologyAssistant.ts:30-34` | `AssistantInteractionContext = {appCode, pageCode, pageUrl}`，**静态值** |
| 前端写入 | `OntologyDomainShell.tsx:38-44` | `pageCode: 'ontology-domain'` **写死**；不随路由/选中变化 |
| 第二宿主 | `AppRuntimePage.tsx`（apphub 低代码运行时） | 同样只传静态 appCode/pageCode |
| 传输 | `chat.ts:259,280` | `context?: Record<string, unknown>` 自由透传 |
| 后端消费 | `app.py:2424-2448` | 折进 system prompt `[Interaction Context]` 标记（interaction 3 键 + subject 2 键），"缺字段不编造" |
| 回向通道 | `chat.ts:326-336` | SSE typed events：`reasoning` / `tool_call` / `tool_result` / proposal（弹 ProposalConfirmDrawer）——**无 navigate** |

即：已有一次性、请求作用域、单层、静态的上下文注入；**无分层状态键、无水合约定、无回向通道、无宿主→chat 正式 API**。

### 1.3 差距

| # | 差距 | 影响 |
| --- | --- | --- |
| A | 无 `selection` 层 | 用户选中对象后提问"这个最近怎么样"，指代落不到具体 RID，agent 只能反问 |
| B | navigation 是静态快照 | 换 tab / 深入子页后上下文失真 |
| C | 无水合约定 | agent 拿到的是标记文本快照，可能基于陈旧状态行动（Ontology 工具已具备水合能力，但无约定组织） |
| D | 无 `navigate` 回向 | agent 说"我建好了，去看 X"之后用户要自己找路 |
| E | 无宿主→chat 通道 | 划词/右键"问 AI"类交互无处安放（只有静态 suggestions 数组） |

## 2. 决策

**把宿主页面 → copilot agent 的上下文正式化为分层协议（navigation / selection / pendingSelection 三层状态键 + 水合约定 + navigate 回向事件），v1 请求作用域、不落库、完全向后兼容。借鉴 agent-native 的协议形态，实现全部落在既有 copilot agent stream + ontology 工具栈上，不引入任何 agent-native 代码。**

| 维度 | 决策 |
| --- | --- |
| **状态分层** | `context.navigation`（语义路由态）/ `context.selection`（持久选中态）/ `context.pendingSelection`（一次性划词） |
| **状态大小** | **只存 ID + label + kind**，禁止存对象快照——源记录由 agent 水合 |
| **水合约定** | agent 对上下文对象行动前必须用既有 ontology 工具（`query_*` / `search_objects` / `inspect_class`）按 RID 取新鲜数据；system prompt 显式指令，**不新建 view-screen 端点** |
| **回向通道** | SSE 新增 typed event `{"type": "navigate", "target": {...}}`；前端渲染为**可点击导航卡片**（用户点击才跳转），与 evidence/proposal 卡片同模式 |
| **navigate 语义** | agent 永不直接操作路由；只发建议。**对齐本仓 HITL 哲学（AI 输出 = proposal）**，比 agent-native 的自动执行更保守 |
| **宿主→chat** | `useOntologyAssistant` 新增 `sendWithContext(text, {selection?, pendingSelection?})` API |
| **作用域** | **v1 请求作用域**：每次 stream 请求由前端携带全量状态键，服务端无状态；会话级持久化（v2）deferred，见 §7 |
| **兼容性** | 现有 `context.interaction` / `context.subject` **保留为兼容输入**，与 新键 并存渲染；不设废弃时间点 |
| **安全** | 状态键只进 system prompt 渲染，**永不**并入工具执行参数；租户隔离沿用既有请求链路（tid/uid + ContextVar），无新增跨租户面 |
| **实现边界** | 前端 Semi 自建（AIAssistantWorkspace 扩展）；后端 FastAPI 既有 stream 端点扩展。**零 agent-native 依赖** |

### 2.1 关键子决策：不照抄的三处

1. **navigate 不自动执行**（agent-native 是 UI 收到即跳）。本仓原则是 AI 输出皆 proposal——导航虽只读，但保持交互一致性：卡片点击 = 确认。若后续实测打断感强，再评估 `autoFollow` 开关。
2. **不新建 view-screen 端点**（agent-native 是专用 action）。本仓 ontology 工具已覆盖水合能力，缺的只是约定——用 system prompt 指令 + 工具描述对齐解决，避免端点增殖。
3. **不引入共享 SQL 状态表**（agent-native 把 app state 落库）。本仓 v1 走请求携带，服务端保持无状态；落库版本待真实需求（跨设备续聊/自动化回放）出现再立项。

## 3. 协议设计

### 3.1 Context envelope（前端 → 后端，stream body）

```jsonc
{
  "context": {
    // ── 新分层（本 ADR）──
    "navigation": {
      "view": "ontology-objects",        // 语义视图名（宿主自定义）
      "tab": "instances",                // 活跃 tab（可选）
      "openRecordIds": ["obj-123"],      // 打开中的记录 RID（可选）
      "url": "/ontology/objects?concept=customer"  // 原始 URL（事实源）
    },
    "selection": {
      "kind": "ontology.instances",      // 选中物类型（宿主命名空间.物类）
      "items": [                          // 只存 ID + label
        { "rid": "obj-123", "label": "客户A" }
      ],
      "capturedAt": 1780000000000
    },
    "pendingSelection": {                 // 一次性，消费即弃
      "text": "划选的原文",
      "sourceRid": "obj-123"
    },
    // ── 兼容输入（保留，ADR 前 v0 键）──
    "interaction": { "appCode": "...", "pageCode": "...", "pageUrl": "..." },
    "subject": { "conceptCode": "...", "objectId": "..." }
  }
}
```

### 3.2 后端渲染（app.py 扩展）

`[Interaction Context]` 标记升级为分层渲染，并追加**水合指令**：

```
[Interaction Context]
- view: ontology-objects (tab=instances)
- url: /ontology/objects?concept=customer
- selected[ontology.instances]: obj-123 客户A
[pending-selection] "划选的原文" (source: obj-123)

[Context Protocol]
- 上述 selection/navigation 只含标识，不是实时数据。
- 对选中/打开对象采取行动（含 propose_action）前，必须先用
  query/search 工具按 RID 取回当前状态，不得凭上下文快照推断。
- 需要用户跳转查看结果时，输出 navigate 事件而非让用户自行寻找。
```

### 3.3 navigate 事件（后端 → 前端，SSE）

```jsonc
{"type": "navigate", "target": {"path": "/ontology/objects/obj-123", "label": "客户A 详情"}}
```

前端在既有 typed-event 分发（`chat.ts:326` 一支）新增 navigate 分支，渲染导航卡片（复用 evidence 卡片视觉），点击后 `navigate(target.path)`。

### 3.4 宿主 API（useOntologyAssistant 扩展）

```ts
// 动态 navigation：随路由/深链变化自动更新（替换现静态 baseContext）
const assistant = useOntologyAssistant({
  ..., 
  getNavigationState: () => ({ view, tab, openRecordIds, url }),
});
// 划词/右键"问 AI"入口
assistant.sendWithContext('把这段改得更有力', { pendingSelection: { text, sourceRid } });
```

## 4. 安全与租户

- 状态键**只影响 prompt 渲染**，不参与工具参数注入、不进 proposal 通道；RID 进入工具调用仍走 agent 自主决策 + 既有 markings 闸门（`ontology_tools.py` 的 marking 合取检查不变）。
- envelope 由后端按 schema 白名单校验（未知键丢弃 + audit 记一次），长度上限（序列化后 4KB）防 prompt 撑爆，与 `AGENT_TOOLS_BUDGET`（app.py:2341）同类护栏。
- 租户/用户标识沿用请求认证链路，状态键本身不携带也不需要租户字段。

## 5. 兼容性

| 面 | 影响 |
| --- | --- |
| 旧宿主（只发 interaction/subject） | 零变化——兼容键照常渲染 |
| 旧前端 + 新后端 | 零变化——新键缺省即不渲染 |
| OpenAPI 契约 | stream body 的 `context` 为自由对象，无需 oasdiff 变更（若后续类型化则走契约先行） |
| 硬规则 | 不触发表结构/路由新增；navigate 是 SSE 事件不是 REST 接口 |

## 6. 实施切片（小步可交付）

| 切片 | 内容 | 落点 |
| --- | --- | --- |
| **S1 后端契约** | envelope 白名单校验 + 分层渲染 + 水合指令注入 + 单测（含兼容键回归） | `app.py` `_render_interaction_context`（自 2424 段抽出） |
| **S2 前端写入** | `getNavigationState` 动态化 + selection 注入 + `sendWithContext`；OntologyDomainShell 接真实路由与列表选中 | `useOntologyAssistant.ts` / `OntologyDomainShell.tsx` |
| **S3 navigate 回向** | SSE navigate 事件 + 导航卡片渲染 + 点击跳转 | `app.py` agent loop / `chat.ts` / ChatPage 卡片区 |
| **S4（deferred）v2** | 会话级持久化（跨轮/跨设备）、apphub AppRuntimePage 接入、`autoFollow` 评估 | 另立增量 |

## 7. 验收标准（S1–S3）

1. **指代消解**：宿主页选中"客户A"后提问"这个对象最近怎么样"→ agent 用其 RID 调 query 工具，不反问（Playwright 用例）。
2. **水合约定可见**：system prompt 含 `[Context Protocol]` 段；对陈旧 selection 行动前有 query 调用记录（事件流断言）。
3. **navigate 卡片**：agent 回复"已创建，查看详情"→ 出现导航卡片 → 点击跳转正确路径。
4. **兼容回归**：仅发 `interaction`/`subject` 的旧用例输出逐字节等价（快照测试）。
5. **护栏**：超长/未知键 envelope 被裁剪并 audit，不 500。
6. 既有 pytest + vitest 套件全绿（`mate-app-copilot` tests / `apps/web`）。

## 8. 收口记录

> 待评审后补：实施 commit、验收证据链接（`docs/active/delivery/evidence/`）。

---

## 附：与 agent-native 的对位结论（调研存档）

agent-native 是对 ADR-0021/0064 路线的**外部验证**（Builder.io 2026 年独立收敛到同一论点）；其框架本体因全栈 TS 栈冲突 + 自研铁律 + 本仓已有更完整等价物（统一执行器/markings/五层租户隔离）**不引入**。本 ADR 仅吸收其 Context-Awareness 协议形态，为调研报告中唯一标记"强推荐借鉴"的 pattern。完整调研：2026-09-15 会话记录。
