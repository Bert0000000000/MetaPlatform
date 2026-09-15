# SuperAI 聊天：本体证据 + Action 计划 + 同意/讨论/驳回 — 验收证据

> **验收日期**：2026-09-15
> **验收环境**：Windows 10 / Docker Desktop (WSL2) 30 容器栈 —— 网关 8100 + Keycloak RS256 + 真实 ARK Plan（glm-5.3-flash）+ 本体 v2 内核（`KERNEL_BACKEND=pg`）
> **验收方式**：后端 pytest（真实 venv）+ 前端 tsc/vitest + 真实浏览器（9250 dev server，admin/admin123）+ 直接查 PG 落库态
> **结论**：**核心链路全部通过**。本体工具取证 → 结构化 evidence 事件 → 聊天证据卡片；AI 提议 → proposal 事件 → action 卡片 + 三按钮；同意（抽屉 + 三闸门）与驳回均驱动后端真实状态；确认执行的数据真落 PG 且可回滚。

---

## 1. 需求对位与结论

| # | 需求 | 结果 | 证据 |
|---|------|------|------|
| A | 本体引擎 + AI Agent 可实现整体业务调度 | ✅ **原本已可用**（未改动） | §3.1 |
| B | SuperAI 窗口内动态数字员工调度 | ✅ **原本已可用**（未改动） | §3.1 |
| C | 聊天反馈带充足本体 evidence 与相关数据 | ✅ 新增 | §3.2 / §3.3 |
| D | 聊天反馈带后续 action 计划 | ✅ 新增 | §3.4 |
| E | 聊天窗口「同意 / 详细讨论 / 驳回」交互 | ✅ 新增 | §3.5 / §3.6 / §3.7 |
| F | 连带修复：本体域 AI 助手（打在不存在的端点上） | ✅ 一并修好 | §3.8 |
| G | 回复内含 **AI 分析与建议**（事实/推断/建议 + 置信度） | ✅ 新增（补做） | §3.9 |
| H | 本体证据展示 **关系图 + 对应本体数据** | ✅ 新增（补做） | §3.10 |

### 回复结构（最终）

```
思考 → 调度步骤(仅 dispatch_employee) → 路由决策
  → 回答正文
  → AI 分析与建议（事实 / 推断 / 建议 + 置信度）   ← §3.9
  → 本体证据                                        ← §3.2
  → Action 计划 + 同意/详细讨论/驳回                ← §3.4
```

叙事是「做了什么 → 结论是什么 → 结论怎么拆解 → 什么支撑它 → 下一步做什么」。

---

## 2. 改动面

### 后端（`mate-platform-backend/packages/mate-app-copilot/`）

| 文件 | 改动 |
|------|------|
| `src/mate_app_copilot/agent_loop.py` | 新增 `_evidence_items()` / `_proposal_from_tool()` / `_row_identity()`；本体工具执行后外流 `evidence` 事件，`propose_*` 外流 `proposal` 事件；单次工具调用证据限流 `_EVIDENCE_ITEM_LIMIT = 8` |
| `src/mate_app_copilot/ontology_tools.py` | `propose_create_instance` / `propose_model_type` 返回补 `impact_summary` |
| `src/mate_app_copilot/api/app.py` | 持久化白名单加 `evidence` / `proposal`（刷新会话可重建卡片）；新增 `[Interaction Context]` 注入（承载宿主页面 / 主体对象） |
| `tests/test_agent_loop_ontology.py` | +7 用例（证据映射 ×4、限流 ×1、提案 ×3、负向 ×2） |

### 前端（`metaplatform-frontend/apps/web/src/`）

| 文件 | 改动 |
|------|------|
| `api/superai/chat.ts` | `streamAgentChat` 解析 `evidence` / `proposal`；`StreamAgentCallbacks` 加 `onEvidence` / `onProposal`；新增可选 `context` 透传 |
| `pages/superai/components/ProposalActionCard.tsx` | **新建** — action 计划卡片 + 三按钮（原生 `button`，规避 React 19 下 Semi onClick 被截） |
| `pages/superai/ChatPage.tsx` | 新增 `agentEvidence` / `agentProposals` / `pendingProposal` 状态；注册 `evidence` / `proposal` content-item renderer；挂载 `ProposalConfirmDrawer`；**修复**：只有 `dispatch_employee` 才记「调度数字员工」步骤 |
| `pages/superai/superai.css` | 证据区 + 提案卡片样式（复用令牌，走本域 CSS） |
| `pages/ontology/hooks/useOntologyAssistant.ts` | 改写为走 `streamAgentChat`（原打在不存在的端点） |
| `routes/superai.tsx` | 删除 `superai/chat/copilot` 路由 → 转发主聊天 |

### 删除（死代码，指向 404 端点）

`pages/superai/AgentCopilotPage.tsx`、`components/AgentChatPanel.tsx`、`hooks/{useAgentStream,useAgentRunEvents,InteractionContextProvider,index}.ts`、`api/superai/types/index.ts` 的 `export * from hooks`。

> 保留并复用 `EvidenceRenderer` / `ClaimRenderer`（原仅被死页面使用，现接入主聊天）。

---

## 3. 验收过程与证据

### 3.1 Agent 运行机制核查（未改动，确认可用）

`agent_loop.py:run_agent_loop()` 链路：SemanticRouter 预筛 top-k → LLM 流式 FC 决策 → 两类工具分支（`dispatch_employee` → orchestrator `/dispatch` → A2AWorker → A2A 中心内联执行并轮询；本体工具族直连 `/api/v1/ont/v2`）→ `final`。

实测（`POST /api/v1/copilot/chat/agent/stream`，真实栈）：

```
POST /api/v1/agent/runs/stream         → HTTP 404   （不存在）
POST /api/v1/agent/chat/stream         → HTTP 200   （mate-tech-agent，另一条线）
POST /api/v1/copilot/chat/agent/stream → HTTP 200   （真实在跑的 agent 流）
```

### 3.2 本体工具取证 → evidence 事件（后端）

`list_classes` 提问实测事件序列：

```
{"type":"routing_decision", "stage":"pre_screen", ...}
{"type":"reasoning", ...} ×67
{"type":"tool_call", "tool":"list_classes", "args":{}}
{"type":"tool_result", "status":"success", "result":{"classes":[{"rid":"ont.tenant-default.obj.crm.contract.v1","display_name":"合同",...}, ...]}}
{"type":"evidence", "toolCallId":"call_519b3ca4...", "items":[
   {"type":"ONTOLOGY_OBJECT","ref":"ont.tenant-default.obj.crm.contract.v1","concept":"合同",
    "evidenceId":"call_519b3ca4...-e0","capturedAt":"2026-09-15T06:22:23Z"}, ...]}
{"choices":[{"delta":{"content":...}}]} ×30
```

### 3.3 evidence 卡片（前端真实浏览器）

真实浏览器渲染 49 张证据卡片后触发 UX 问题（把回答挤出视野）→ 后端加限流 `_EVIDENCE_ITEM_LIMIT=8`，并把证据区移到回答之后（引用面）+ 加高度上限。

### 3.4 proposal 事件 + action 卡片（前后端）

事件实测：

```json
{"type":"proposal","toolCallId":"call_6ed20e9f...","proposalId":"prop-b7b65aab",
 "kind":"create_instance","status":"pending",
 "impactSummary":"在「合同」对象类型下新建一个实例：合同编号 HT-PROBE-9，合同名称 ProbeCo（起止日期暂缺，待确认后可补充）。此为提议，需用户确认后才会落库。"}
```

浏览器渲染的卡片 DOM：

```html
<div class="mp-proposal-card" data-proposal-id="prop-90752d03">
  <div class="mp-proposal-head">
    <span class="mp-proposal-kind">创建实例</span>
    <code class="mp-proposal-id">prop-90752d03</code>
    <span class="mp-proposal-status">待确认</span>
  </div>
  <div class="mp-proposal-impact">新建一条「合同」对象实例：contract_id=HT-UI-777，contract_name=UItest。等待用户确认后才会落库，不影响现有数据。</div>
  <div class="mp-proposal-actions">
    <button ...>同意</button><button ...>详细讨论</button><button ...>驳回</button>
  </div>
</div>
```

### 3.5 「详细讨论」 — 上下文回填继续对话

点击后实测追加的用户消息：

```
我想详细讨论刚才这个提案（创建实例，id: prop-80c85063）。
提案影响：在「合同」对象类型（ont.tenant-default.obj.crm.contract.v1）下新建一条合同实例：
合同编号 HT-UI-888，合同名称 UItest2。该操作为提议（pending proposal），需用户确认后才会落库。
请先说明它的依据和潜在风险，再给出可选的修订方案。
```

流继续，AI 带上下文重新推理。

### 3.6 「驳回」 — 前端 + 后端状态

点击后卡片就地变为 `已驳回`（按钮隐藏），PG 实测：

```
prop-80c85063 | rejected | create_instance
```

### 3.7 「同意」 — 抽屉 + 三闸门 + 落库

点击后 `ProposalConfirmDrawer` 打开（复用本体域组件），实测渲染：

```
AI 提案 · 待确认
创建实例 (create_instance)   id：  pending
机器预检阻断：预检阻断：schema 3 项错误；SHACL 3 项 Violation
  schema：必填属性缺失: contract-contract-name
  schema：必填属性缺失: contract-start-date
  schema：必填属性缺失: contract-end-date
  SHACL：expects 1+ values, found 0   ×3
[取消]  [拒绝]  [预检阻断，不可执行]   ← 确认按钮 disabled
```

放行路径（完整字段）实测：

```
POST /api/v1/ont/v2/classes/{rid}/propose-instance  → proposal_id=prop-b197df12
POST /api/v1/ont/v2/proposals/prop-b197df12/confirm → HTTP 200
POST /api/v1/ont/v2/proposals/prop-b197df12/execute → HTTP 200
   {"kind":"create_instance","individual_rid":"ont.tenant-default.ind.contract.HT-EXEC-1",
    "postflight":{"checked":true,"blocked":false,"summary":"预检通过"}}
```

PG 落库实测（**注意是 `metaplatform` 库**，`KERNEL_PG_DSN` 指向它，不是 `metaplatform_ont`）：

```
select proposal_id, status, kind from ont_proposal order by created_at desc limit 6;
 prop-b197df12 | executed | create_instance
 prop-8195b5cf | pending  | create_instance
 prop-80c85063 | rejected | create_instance
 prop-90752d03 | pending  | create_instance
 prop-b7b65aab | rejected | create_instance
 prop-f6530128 | pending  | create_instance

select rid, primary_key, provenance->>'proposal_id' from ont_individual where primary_key='HT-EXEC-1';
 ont.tenant-default.ind.contract.HT-EXEC-1 | HT-EXEC-1 | prop-b197df12
```

回滚实测（顺带验证）：

```
POST /api/v1/ont/v2/proposals/prop-b197df12/revert → HTTP 200
{"status":"reverted","kind":"create_instance","equivalence":"equivalent",
 "compensation":{"deleted_individual":"ont.tenant-default.ind.contract.HT-EXEC-1","rows":1}}
```

### 3.8 连带修复：本体域 AI 助手

原 `useOntologyAssistant` → `useAgentStream` → `/api/v1/agent/runs/stream` 实测 **404**，即 `OntologyDomainShell` 里的 AI 助手面板是坏的。已改接 `streamAgentChat`（真实端点），并顺带获得真实 token 增量（原实现只靠一次性回填，无 token 累加）。

同时修复 ChatPage 一处误导性渲染：本体工具调用（`list_classes` / `inspect_class` / `propose_*`）被记成「调度 X 数字员工」，而实际没有任何员工被调度。修复后步骤只剩真实的 `routing_decision`。

### 3.9 回复内含「AI 分析与建议」（补做）

**缺口**：system prompt（`ChatPage.tsx` 的 `UNIFIED_SYSTEM_PROMPT`）明确要求模型在回答末尾输出
2-4 条论断 `{"claims":[{"content","type":"FACT|INFERENCE|RECOMMENDATION","confidence"}]}`；
`extractClaims()` 也解析进了 `msg.claims` —— 但**渲染分支里没有任何地方读它**，
解析完即丢弃。`ClaimRenderer` 组件本身完好，却在我删除 `AgentChatPanel` 后彻底成为孤儿。

**连带发现 2 处**：

1. **字段错位**：`extractClaims` 产出的是 `content`，而 `ClaimRenderer` 渲染的是 `claim.text`
   —— 即使接上也是空白。已改为 `claim.text ?? claim.content ?? ''`。
2. **JSON 泄漏进正文**：原正则 `/\{"claims"\s*:\s*\[[\s\S]*?\]\s*\}(?:\s|$)/` 只匹配「末尾且带空白」的形态，
   模型换个排布就漏剥，实测出现 `…,"type":"FACT","confidence":1.0}]}` 直接显示在回答里。
   已改为**配对括号扫描**（含字符串/转义状态机）定位 `{"claims"` 块，并连带剥掉可能包裹它的
   ```json 围栏；解析失败则原样返回、绝不吞正文。

**实测（普通问答模式，真实浏览器）**：

```
AI 分析与建议 · 事实 1 · 建议 1
  事实  100%  SuperAI 具备问答、数据分析、知识图谱查询、代码生成和任务编排五类核心能力
  建议   90%  建议用户从描述具体业务问题入手（如数据查询或流程搭建），以最快获得可用的分析结果或代码产出
```

同时断言 `leakedJson: false` —— 正文不再出现 `"claims"` / `"confidence"` 字样。

### 3.10 本体证据的「关系图 + 对象数据」（补做）

**改前**：本体证据只平铺成一列卡片（`ref` + `concept` + 截断的 JSON `fragment`），
既没有关系图，也看不到对象的真实属性。

**改后**：证据里指向具体本体对象的条目交给新组件
`pages/superai/components/OntologyEvidencePanel.tsx`：

- 以证据里的对象为**焦点对象**（多个时给可点切换的 chips）
- `searchAround(rid)` → 一跳关联（按 link_type / direction 分组，对端属性内联）
  → `SemiGraphCanvas` 放射布局：焦点居中标实心，对端按方向着色，边标 `link_display`；
  **点对端节点可重新居中下钻**
- `getIndividual(rid)` → 焦点对象属性 → 两列键值表；属性键从全 rid 缩短为可读名
  （`ont.<t>.prop.sopbench-dg-product-id.v1` → `product-id`）
- 关系按方向分组列出（出边/入边 + 关联名 + 个数 + 对端对象及其属性）

**零后端改动** —— `searchAround` / `getIndividual` 早已存在于 `api/ont/kernel.ts`。

**但暴露并修复了后端证据映射的两处语义错误**（会让新面板 404）：

| 问题 | 修前 | 修后 |
|---|---|---|
| `query_*` 行的身份取值 | 先匹配到业务主键（`sopbench-dg-product-id`）当作 identity | 优先取 ont v2 的规范身份列 **`__rid__`**；取不到则不设 `objectId` |
| `inspect_class` 的 `objectId` | 设成 **class rid**（类型不是实例） | 去掉 `objectId`，只留 `ref` + `concept` |

实测（真实浏览器 + 真实 PG 数据）：焦点 `...ind.sopbench-patient-intake.p100029`
经 `insurance` 出边连到 `...ind.sopbench-patient-intake-provider.humana`，
图上 2 节点 1 边、边标 `insurance`；数据区列出焦点对象 11 项可读属性
（`diet-type: Regular`、`blood-type: AB-`、`drug-allergies: ["Penicillin","Codeine"]` 等）。
另实测一组**无关联**的对象（dangerous-goods）：图正确显示「0 个关联对象」并给出空态说明，
不伪造连线。

---

## 4. 测试结果

| 套件 | 命令 | 结果 |
|------|------|------|
| 后端（agent loop 本体路径） | `.venv/Scripts/python.exe -m pytest packages/mate-app-copilot/tests/test_agent_loop_ontology.py -q` | **15 passed** |
| 后端（copilot 全量回归） | `.venv/Scripts/python.exe -m pytest packages/mate-app-copilot/tests/ -q` | **239 passed / 0 failed** |
| 前端类型 | `npx tsc -b --noEmit` | 干净 |
| 前端单测 | `npx vitest run` | 13 passed / **1 failed** |

（全量回归基线为 235；本次新增 4 条用例后为 239。）

**关于那 1 条失败**：`pages/ontology/components/ProposalConfirmDrawer.test.tsx` 的
"only reports success after the authoritative confirmation and execution states" 用例。
已用 `git stash push -u -- metaplatform-frontend/apps/web/src` 回退全部本次前端改动后复跑，
**基线同样 1 failed / 2 passed** —— 属既有红用例，非本次引入。本次未修复（不属改动范围）。

---

## 5. 诚实边界

1. **`dispatch_by_routing_fn` 是死参数**：`agent_loop.py` 签名声明了它，但整个函数体从未使用；`app.py` 精心构造的 4 级 fallback dispatcher（embedding → keyword substring）**实际未接上**。本次未动（超出范围），已在评审中单列为待办。
2. 同意/驳回驱动的**是用户侧端点**，与 AI 的 `propose_*` 工具分离 —— 这是设计约束（AI 只能提议），非缺口。
3. 未做 preflight **放行**路径的浏览器点击验证（只做了 API 链 + 抽屉阻断态渲染）。原因：LLM 自然产出的提案多数缺必填字段，稳定命中 schema 阻断；放行态用完整字段走 API 链验证，并由抽屉复用已存在的实现。
4. 前端存在既有的 React `key` 警告（本次改动前页面加载即出现），未定位、未修复。
5. 本次验证在 dev 栈 + 9250 dev server 完成，**未做 staging/prod 演练**。
