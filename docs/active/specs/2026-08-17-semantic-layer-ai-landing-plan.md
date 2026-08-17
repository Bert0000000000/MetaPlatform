# 语义层 AI 落地规划 — Palantir 全景对标与差距分析

> **状态**：v0.3（2026-08-17：§4.0 程序目标锁定——核心闭环 = SAL-01+02+04 + 北极星验收；MP-SAL-01 设计定案 ADR-0043；v0.2 为同日代码实况审计修订，G3/G4/G6/G7 以行内【审计修订/逆转】标记）
> **日期**：2026-08-17
> **作者**：Claude（规划会话起草；同日 4-agent 并行代码审计修订）
> **上游依赖**：`2026-08-06-ontology-kernel-blueprint.md` v0.4 · ADR-0021/0040/0041/0042 · `V31-ONTOLOGY-BOARD.md`（20/20 + v4 5/5 + MP-COMP-01）
> **目的**：回答「语义层如何通过 AI 落地」——对标 Palantir Foundry/AIP 的落地原理，量化平台差距，给出可接力的 Batch 路线。

---

## 0. 一句话结论

**平台的语义层「数据模型侧」（12 基元 / 持久化 / ActionType 引擎 / ObjectSet 编译器）已基本收口；差距集中在「AI 消费侧」的五个面：①Ontology 工具化（Object Query 等价物）、②OAG 检索上下文、③端到端 assisted action 写回链路、④沙箱生产化（L2/L3 占位）、⑤对象级治理标记。** Palantir 的经验表明：语义层落地成败不在建模本身，而在 AI 是否把 Ontology 当作**唯一的世界模型**来读（typed tools）、来想（retrieval context）、来写（assisted actions + HITL）。

---

## 1. Palantir 语义层落地原理（对标基准）

以下原理提炼自 Palantir 官方文档与公开深度分析（来源清单见 §7）。蓝图 v0.4 的「三大顶层原理」与此对齐，本节补齐的是**落地机制层**。

### 1.1 三层结构：Semantic / Kinetic / Dynamic

Palantir 把 Ontology 描述为三层，而非单一语义层：

| 层 | 回答的问题 | 组成 |
|---|---|---|
| **Semantic（语义）** | 世界上有什么？ | Object Types · Properties（含时序/地理/媒体）· Link Types |
| **Kinetic（动力）** | 能对它做什么？ | Action Types（受治理的写回操作，带校验规则） |
| **Dynamic（动态）** | 接下来会发生什么？ | Functions · Models · 实时逻辑 |

这与蓝图「Digital Twin = Semantics + Kinetics」原理一致。**关键洞察：Palantir 从一开始就把 Actions 和 Functions 设计为 Ontology 的一等公民，而不是后加的 API**——因为语义层若只有「读」，AI 只能做分析；有「写」，AI 才能做决策与执行。

### 1.2 AI 如何消费语义层：OAG（Ontology-Augmented Generation）

Palantir AIP 的核心机制不是传统 RAG，而是 **OAG**：

1. **Retrieval Context（检索上下文）**：agent 的上下文来自 Ontology 中的对象——固定对象集或**语义检索**命中的对象，而非非结构化文档切片。
2. **Object Query Tool（对象查询工具）**：agent 通过工具对配置可见的对象做 **filtering / aggregation / inspection / link traversal**，返回**强类型结构化结果**。
3. **Function Tools**：确定性逻辑（计算、模型调用）以 Function 工具形式暴露，LLM 只负责编排，不负责计算。
4. **Action Tools（assisted actions）**：AI 的输出是 **proposal**，经 **human-in-the-loop 确认**（AIP Logic + Workshop 评审界面）后写回 Ontology，再同步到外部系统（ERP / 边缘系统）。
5. **确定性优先**：OAG 的设计原则是「先取 typed 对象、先跑确定性工具，LLM 只做最后综合」——用类型系统约束幻觉，全程可审计。

### 1.3 面向开发者的落地形态：Ontology SDK

- TypeScript / Python OSDK：从 Ontology 自动生成 **typed client**（`client(Restaurant).objects()` 式 fluent ObjectSet 查询、action 调用、类型标注的 Function）。
- Functions 内可直接 import Ontology SDK 类型做注解。
- 开发者体验闭环：Ontology 一处定义 → 应用 / 分析 / AI agent 三处复用同一套类型。

### 1.4 治理与安全

- **Markings / 权限标记**：对象与属性级安全标记，控制哪些 agent / 用户 / 工具可见。
- **HITL 强制**：agent 对世界的每次修改必须经人工确认场景（scenario）staged 后写回。
- **审计**：agent 的每次工具调用、每次写回全程留痕。
- **基础设施级 guardrail**：model hub 层面约束（如第三方 provider 不留存 prompt/completion）。

---

## 2. 平台现状盘点（截至 2026-08-17）

基于 `V31-ONTOLOGY-BOARD.md`、各 ACCEPTANCE 与代码实况。**注意区分两层：任务板宣称的「Batch Accepted（契约+进程级实现）」与「生产级 runtime」**。

### 2.1 已收口（契约 + 进程级实现 ✅）

| 能力 | 落点 | 状态 |
|---|---|---|
| 12 基元 frozen dataclass | `mate-kernel/src/mate_kernel/ontology/`（identity/types/instances/reasoning/query） | ✅ ADR-0021 冻结 |
| PG 持久化（9 张 `ont_*` 基表） | `mate-tech-ont/v2_kernel/pg_repo.py`（1,267 行） | ✅ RUNTIME-MVP-02 真跑 PG |
| ObjectSet 查询编译 | `mate-kernel/src/mate_kernel/objectset/{compiler,sql_compiler}.py`（268+113 行 DSL → 参数化 SQL） | ✅ 进程级 |
| ActionType 唯一写入口 | `action/engine.py`（317 行 `ActionType.apply`） | ✅ 进程级 |
| Function 沙箱 L1 | `sandbox/function.py`（subprocess + denylist + rlimit） | ✅ |
| AIP Gateway（多 provider + 预算路由） | `aip/gateway.py`（192 行） | ✅ |
| Orchestrator（plan_runner 强制 ≥1 HITL，决策 B3） | `mate-tech-orchestrator/`（3,308 行，A2A/MCP 已接） | ✅ |
| 7+1 数字员工 Agent | `mate_kernel/agent/`（11 文件 1,991 行）+ `mate-app-copilot/`（8,279 行） | ✅ 偏 Protocol+prompt 层 |
| RAG × Ontology | `mate-kernel/src/mate_kernel/rag/ontology.py`（161 行，对象属性级检索原型） | ✅ 初版 |
| Composition 内核（能力反应式） | `mate_platform/composition/`（674 行零依赖，19 不变量） | ✅ MP-COMP-01 |

### 2.2 已知未收口 / 占位（来自蓝图 v0.5 待办 + ADR-0042 §6 + GOVERN 披露）

1. **沙箱 L2/L3 占位**：`sandbox/k8s.py` 中 `backend=k8s`（K8s Job）与 `backend=microvm`（Firecracker）均为 API 占位，仅 SubprocessExecutor 真跑。
2. **蓝图 v0.5 任务**：补抓 Palantir 官方 7 核心页正文，替换「业内共识」级可证伪行。
3. **真鉴权**：copilot dev profile 依赖 `LEGACY_LOGIN_COMPAT=1`（IAM-COPILOT-04 留 v4 后续）。
4. **GOVERN-03/06 残余**：v1 退役子 spec 1/6；RLS 缺口子 spec 3/4 未完。
5. **ObjectSet 编译器覆盖面**：268 行 DSL 自报「80% 业务查询」，无聚合 / 时序 / 地理 / link 遍历一等支持。
6. **ADR-0042 出范围项**：MCP center→orchestrator 能力通知接线、intercept/policy、ActionType proposal 状态机重写、Session discard ≃ 语义收紧。

---

## 3. 差距矩阵：Palantir 落地要素 × 平台现状

分级：**P0 = AI 落地的必经之路（不做则语义层对 AI 不可用）；P1 = 落地质量与规模化必需；P2 = 长期对齐项。**

| # | Palantir 落地要素 | 平台现状 | 差距 | 级 |
|---|---|---|---|---|
| G1 | **Object Query Tool**（filter/aggregate/inspect/traverse links，typed 输出） | ObjectSet DSL 有 filter（14 操作符）+ sort（仅取第一个键）+ paging；无聚合、无 link 遍历一等算子、无 inspection；未包装为 LLM 工具 | **大**：查询算子缺 + 工具化缺 | **P0** |
| G2 | **Ontology → 工具 schema 自动生成**（对象/属性/函数对 agent 可见即工具） | MCP 注册机制有（ADR-0025~0027），但 ObjectSet/Function/ActionType → tool schema 的自动生成器未见 | **大**：目前是手工/模板，不是「建模即工具」 | **P0** |
| G3 | **Retrieval Context / OAG**（agent 上下文 = Ontology 对象，语义检索命中） | 【审计修订】两侧都比原稿写的更极端：kernel 已有**对象属性级检索原型**（`rag/ontology.py`：Individual 属性切 chunk + ObjectSet 过滤召回，已接 KnowledgeLibraryAgent）但 token 重叠伪相似度、纯内存 dict、止于 kernel/示例；而 copilot 聊天上下文 = 静态角色 system prompt + 对话历史，**连文档 RAG 都没进上下文** | **大**：检索器要升级（pgvector）+ 通道要新建（copilot 接检索） | **P0** |
| G4 | **Assisted Action 端到端链路**（proposal → HITL UI 确认 → ActionType.apply → 写回外部系统） | 【审计修订】已有件比原稿多：`ActionProposal`/`propose()` 模型、orchestrator HITL 状态机（无 HITL 步 raise → WAITING → review API）、copilot 直连 apply 均在。断点 5 处：① proposal 无状态机且 `apply()` 从不校验；② `side_effect_emitter` 是可选 hook，pg_repo 调用不传、不写 outbox；③ tech-ont 无 propose/confirm 端点（apply 直达落库）；④ **两套 HITL 互不相通**（orchestrator review 后走 A2A worker，从不调 ActionType.apply）；⑤ copilot 无「AI 提议→确认→落库」端点 | **中**：写入口在，链路 5 断点 + HITL 需统一 | **P0** |
| G5 | **Function 沙箱生产化**（每次调用独立容器） | L1 subprocess 真跑；L2 K8s Job / L3 MicroVM 占位 | **中**：dev 可用，prod 不可用 | **P0** |
| G6 | **OSDK 等价物**（typed fluent client，从 Ontology 自动生成） | 【审计修订】`mate-clients/sdk/` 目录不存在（原稿笔误）；实际是手写 httpx client（如 `mate_clients/marketplace/ontology.py`，dict payload 非 typed）；仓库仅有 OpenAPI spec 导出脚本 | **中**：能力降级为普通 REST | **P1** |
| G7 | **Markings / 对象级权限标记**（控制 agent 可见性） | 【审计逆转】对象级 markings **已实现且有强制**：`Individual/LinkInstance.marking` 字段 + `agent/security.py` required_markings 拒绝检查 + `PropertyFormat.MARKING`。剩余缺口：与 agent/工具可见性配置的联动 | **小**：大半已实现，剩可见性联动（MP-SAL-01 白名单直接建在其上） | **P2**（原 P1 降级） |
| G8 | **属性类型丰富度**（时序 / 地理 / 媒体属性） | Property 为基本类型 | **中**：分析类场景受限 | **P1** |
| G9 | **Interfaces**（跨 ObjectType 接口契约） | Interface 基元在 12 基元清单内，实现薄 | **小** | **P2** |
| G10 | **Function on objects 的类型注解开发体验**（SDK import 进 Function） | Function 沙箱有，类型注解 DX 无 | **小** | **P2** |
| G11 | **Agent 治理报告 / guardrail 对齐**（provider 不留存、审计） | OTel + audit 有；provider 留存策略约束未成文 | **小** | **P2** |

### 3.1 差距总量判断

- **建模侧（12 基元、持久化、写入口、HITL 约束）**：≈ 80% 对齐 Palantir 语义层骨架——这是 20/20 batch 的成果。
- **AI 消费侧（G1-G5）**：≈ 30-40% 对齐——这是语义层「AI 落地」尚未发生的原因：**当前 AI（SuperAI/agent）更多是把 Ontology 当 REST 资源访问，而不是当作带类型、带工具、带场景写回的世界模型**。
- 若以 Palantir「agent 可用的最小落地闭环」= G1+G2+G3+G4 衡量，平台缺一个完整的产品层，估计 **4-6 个 Batch / 8-12 周**（见 §4）。
- **审计后维持上述判断**：G4 已有件略好于原稿（proposal 模型/HITL 状态机/copilot 直连 apply 均在），G3 通道侧比原稿更空（copilot 零检索上下文），互有抵消；G7 从差距清单中大半移除。

---

## 4. AI 落地路线：MP-SAL 系列（Semantic layer AI Landing）建议

> 命名沿用既有 MP-* 前缀；依赖 v3.1 已收口资产，不重做 AIP-GATEWAY / AGENT-ORCH / SUPER-COPILOT。提交顺序遵循强约束：`docs/ADR → contract → failing tests → feature → infrastructure → acceptance evidence`。

### 4.0 程序目标（2026-08-17 锁定）：语义层 AI 落地完整闭环（读+想+写）

**「Ontology 核心能力完成」的定义 = MP-SAL-01+02+04 三批 Accepted（读写闭环 + 上下文）；03 为生产化门（部署条件，非能力条件），并行推进、生产验收前收口。** 依据：读/想/写三腿齐备才是「AI 把 Ontology 当世界模型」而非 REST 资源（spec §0 结论）；设计资产已齐（ADR-0043）、复用面大（pgvector / markings / outbox / HITL 状态机均为现成资产）。

| 阶段 | Batch | 内容 | 估时 |
|---|---|---|---|
| P1 | SAL-01 读 | ObjectSet IR + 每类型工具 + markings 可见性（ADR-0043） | 2-3 周 |
| P2 | SAL-02 想 | pgvector 对象检索 + copilot 上下文通道 | 1-2 周 |
| P2 并行 | SAL-03 生产化 | Function 沙箱 K8s Job 真接 | 1-2 周 |
| P3 | SAL-04 写 | Proposal/Scenario 状态机 + HITL 统一 + outbox 写回 | 3-4 周 |

**北极星验收（全部建成 = 此 demo 成立）**：SuperAI 收到自然语言任务「把这批金额超 10 万的未付订单标记为待复核」——① `list_classes`/`inspect_class` 自主发现订单类型（01）；② 检索上下文自动携带相关对象卡片、带 rid 推理（02）；③ 产出 proposal（预期 diff）经用户界面确认（HITL）；④ `ActionType.apply` 落库 → outbox 事件 → 外部系统同步（04）；⑤ 全程四段审计留痕。**Negative 同为验收件**：未确认 proposal 永不落库；agent 缺 marking 时工具不可见且直调被拒。

**全程风险盯守**：① SAL-04 的两套 HITL 统一是全程最重架构任务，01 收口后立即起草 ADR-0044；② copilot 真鉴权（现 dev 靠 `LEGACY_LOGIN_COMPAT=1`）挂入 SAL-03 生产化范围；③ 每批独立 ACCEPTANCE.md + `HARD-RULES-MATRIX` 对应行更新（硬规则 10），不合并档。

### 4.1 Batch 拆分（依赖图）

```
MP-SAL-01 工具化基座 ──────┐
   ObjectSet 算子补齐       │
   + tool schema 生成器     ├──→ MP-SAL-04 Assisted Action 端到端
                           │      proposal → HITL → apply → 写回
MP-SAL-02 OAG 检索上下文 ──┤      （scenario/staging 语义）
   对象语义检索进 prompt    │
                           │
MP-SAL-03 沙箱生产化 ──────┘
   K8s Job backend 真接（RUNTIME-K8S-02 收口）

之后（P1/P2，可并行排期）：
MP-SAL-05 OSDK-typed client（Ontology → 生成式 typed SDK）
MP-SAL-06 Markings 对象级标记 + agent 可见性
MP-SAL-07 富属性（时序/地理）+ Interfaces 收口
```

### 4.2 各 Batch 范围与验收要点

**MP-SAL-01 · Ontology 工具化基座（对位 G1+G2，P0）** —— 设计定案见 **ADR-0043**（2026-08-17 五决策点裁定，Palantir Object Query Tool 对标确认）

- **ObjectSet v2 = 结构化 JSON IR**：`ObjectSetQuery`（filters/aggregation/traversal/多键 sort/paging）；字符串 `filter_expr` 降为编译进 IR 的前端糖；InMemory 与 PG 双后端消费同一 IR（消除两套语义漂移）。
- **结果信封**：`{kind: objects|aggregates, rows}`；`inspect` 独立元数据工具，不进查询 DSL。
- **schema_gen**（`mate_kernel/tooling/`）：从 ObjectType/Function/ActionType 生成协议无关 tool schema；MCP center 与 copilot 两处消费。
- **每类型专用工具 `query_<slug>`**（对齐 Palantir 绑定形态，token 效率优先）：字段枚举直接进参数 schema；实现上是 IR 之上的薄外壳。配套 `list_classes` + `inspect_class` 固定辅助工具。
- **虚拟注册表**：`tools/list` 从 `ont_object_types` 实时计算（短 TTL 缓存），零 push 同步，「发布即生效」。
- **工具白名单 = markings 上抬一级**：ObjectType 加 `marking`，可见工具 = 类型标记 ⊆ agent `required_markings`；实例级 marking 继续独立强制；属性级可见出范围（机制已在）。
- **返回侧 `result_schema` 描述**；typed client 留 MP-SAL-05。
- 验收：**copilot e2e 为核心**（发布→工具出现→FC 查询→结果 + marking 不可见 negative）+ 算子 InMemory/PG 双后端单测 + kitchen sink 顺带一步；`forbid_bare_httpx` 经 mate-clients BearerAuth 自然覆盖。

**MP-SAL-02 · OAG 检索上下文（对位 G3，P0）**

- 检索器升级：`rag/ontology.py` 已是对象属性级检索原型（token 重叠 + 内存 dict），改为复用平台 pgvector halfvec+HNSW 设施做 embedding 召回 + ObjectSet 结构化过滤。
- **通道新建**：copilot `agent_loop` 当前零检索上下文（静态角色 prompt + 对话历史），本 Batch 必须把检索结果以「对象卡片」（带 rid 可追溯）注入 agent prompt。
- 与既有 RAG-Ont-01 区分：那是文档→本体对齐，这是**对象实例→上下文**。
- 验收：给定自然语言问题，检索命中的相关对象进入上下文且带 rid 可追溯；幻觉率对照实验（无 OAG vs 有 OAG）。

**MP-SAL-03 · Function 沙箱生产化（对位 G5，P0）**

- `sandbox/k8s.py` 的 `backend=k8s` 真接 K8s Job（沿用 PLATFORM-K8S-01 Helm 设施），收敛 RUNTIME-K8S-02 遗留。
- dev profile 保持 subprocess 双轨（ADR-0040 §2.5.1）；L3 MicroVM 继续留 Marketplace 后续。
- 验收：prod profile 下 Function 调用走 K8s Job 且 NetworkPolicy 隔离；回滚方案文档化（硬规则 8）。

**MP-SAL-04 · Assisted Action 端到端（对位 G4，P0，依赖 01）**

- 引入 **Proposal / Scenario 语义**：AI 输出为 staged proposal（含预期 diff），复用 ADR-0042 acquisition/emission 词汇重写 ActionType proposal 状态机（该出范围项在此收口）。
- **统一两套 HITL（审计新增，本 Batch 最重的架构任务）**：orchestrator plan review（approve 后现走 A2A worker）与 ActionProposal 状态机（`apply()` 现从不校验 proposal）打通——review approve 路由到 `ActionType.apply`，proposal_id/hitl_token 全程流转。
- HITL 确认界面挂 `mate-app-copilot`（补「AI 提议→确认→落库」端点）；确认后走 `ActionType.apply` → Outbox（PLATFORM-EVENT-01，接线点为 engine 的 `side_effect_emitter` 可选 hook，现 pg_repo 调用不传）→ 外部系统同步；tech-ont 补 propose/confirm 端点。
- 全链路审计：proposal 创建 / 确认 / apply / 写回四段留痕（硬规则 9）。
- 验收：端到端测试「AI 提议 → 人确认 → 落库 → outbox 事件」；未确认 proposal 永不落库的 negative 测试。

**MP-SAL-05~07（P1/P2）**：生成式 typed SDK（对位 OSDK，`mate-clients/sdk/` 增加 Ontology-typed 生成器）；Markings 对象级标记（与 5 层租户隔离正交，向下细化一级）；富属性与 Interfaces 收口（含蓝图 v0.5 的 pyshacl 评估决策）。

### 4.3 与治理线的合流

- MP-SAL 各 Batch 的 ACCEPTANCE 需同时更新 `HARD-RULES-MATRIX.md` 对应行（尤其硬规则 3/4/9/10）。
- 蓝图 v0.5 的「补抓 Palantir 官方 7 页」任务与本文档 §7 来源清单合并执行：官方 docs 正文直抓在当前环境受限（重定向拦截），建议由有浏览器环境的人工或后续会话补抓归档到 `docs/active/research/palantir/`。

---

## 5. 风险与开放问题

1. **OAG 检索的成本**：对象实例级 embedding 在大数据量租户下的索引策略（仅摘要 vs 增量索引）——MP-SAL-02 需给 ADR。
2. **工具爆炸**：17 域全接入后 agent 可见工具数量失控——需要工具可见性配置；G7 审计逆转后可知 markings 机制已在（`agent/security.py` required_markings），「per-agent 工具白名单」直接建在其上，建议 MP-SAL-01 内置。
3. **Scenario 写回与业务一致性**：staged proposal 的过期/冲突策略（对象在确认前被他人修改）——乐观锁 or 重建 proposal，MP-SAL-04 需决策。
4. ~~**orchestrator pre-existing 3 个失败测试**（test_superai_a2a_*）~~ **已修（2026-08-17）**。**功能本身无恙**：A2A 调度自 `4e3ae7ff`（2026-08-15「real-result streaming」）起已收口——该提交把 A2AWorker 切到同步 `POST /execute` 并在 mate-app-a2a 加了对应端点（返回 `{status, result, task_id, target_agent_id}`，app.py:342），但**漏改了 orchestrator 侧的 superai_a2a 两个测试文件**（仍停在 08-14 的 `/messages` fire-and-forget 语义）。3 个失败均为陈旧断言而非功能缺陷。修复：mock 端点与响应契约对齐 execute、cross_service 的 `pending→completed` 断言更新；另为 `test_a2a_external_agent_docker.py` 加 `importorskip`（服务包不在 checkout，原为收集期 ImportError）。orchestrator 套件现 **47 passed / 1 skipped**。
5. **20/20 「Accepted」语义**：部分合档证据 + 占位实现（§2.2），MP-SAL 验收建议恢复独立 ACCEPTANCE.md，不合并档。

---

## 6. 接力指引（新会话/Codex）

**首选**：整段复制粘贴 `2026-08-17-ai-launch-prompt-mp-sal-program.md` 的启动 Prompt 到对话开头（覆盖 SAL-01→04 全程序：目标、必读文档、代码锚点、环境基线、逐批任务与完成定义）。

手动路径：

1. 基于 `main` 新建分支 `refactor/mp-sal-01`（建议从 MP-SAL-01 起，按 4.1 依赖图顺序）。
2. 先跑基线：`mate-platform-backend/packages/mate-kernel/tests` + `mate-platform/tests`，确认无新增失败。
3. PR 引用本 spec + **ADR-0043**（ObjectSet IR 与工具化设计，已落档 `docs/active/decisions/ADR-0043-ontology-tooling.md`）+ operationId（`mate-platform-backend/contracts/openapi/services/ont.yaml` 23 v2 端点基础上扩展）+ ACCEPTANCE.md。
4. 每收口一个 Batch 更新 `V31-ONTOLOGY-BOARD.md`（新增 §SAL）与 `PROGRAM-BOARD.md`。

---

## 7. 参考（Palantir 对标来源）

官方：

- [Ontology Core Concepts — Objects, Properties, Link Types, Actions](https://palantir.com/docs/foundry/ontology/core-concepts/)
- [Why Create an Ontology? — scenarios 与安全写回](https://palantir.com/docs/foundry/ontology/why-ontology/)
- [Ontology 平台页 — Human+AI 决策建模与写回](https://www.palantir.com/platforms/ontology/)
- [Foundry Ontology 总览](https://www.palantir.com/explore/platforms/foundry/ontology/)
- [AIP Chatbot Studio · Tools Overview — Object Query Tool（filter/aggregate/inspect/traverse）](https://palantir.com/docs/foundry/chatbot-studio/tools/)
- [AIP Chatbot Studio · Retrieval Context — Ontology 检索上下文](https://palantir.com/docs/foundry/chatbot-studio/retrieval-context/)
- [AIP Logic FAQ — HITL 人工评审与写回](https://palantir.com/docs/foundry/logic/faq/)
- [Functions · API Object Sets](https://palantir.com/docs/foundry/functions/api-object-sets/)
- [TypeScript OSDK](https://palantir.com/docs/foundry/ontology-sdk/typescript-osdk/) · [Python Functions on Objects](https://palantir.com/docs/foundry/functions/python-functions-on-objects/)

深度分析：

- [Understanding Palantir's Ontology: Semantic, Kinetic, Dynamic Layers](https://pythonebasta.medium.com/understanding-palantirs-ontology-semantic-kinetic-and-dynamic-layers-explained-c1c25b39ea3c)
- [Palantir Foundry Ontology: How It Works, What Problems It Solves, and Where It Falls Short](https://pub.towardsai.net/palantir-foundry-ontology-how-it-works-what-problems-it-solves-and-where-it-falls-short-d8b4a1ae4900)
- [Palantir AIP Agent & Ontology Interaction](https://zerofuturetech.substack.com/p/palantir-aip-agent-ontology-interaction)
- [Inside Palantir AIP — OAG 机制与 HITL 强制](https://towardsai.com/p/machine-learning/inside-palantir-aip-how-the-worlds-most-controversial-ai-platform-actually-works)
- [Leveling up your AIP agents with the Palantir API（社区）](https://community.palantir.com/t/leveling-up-your-aip-agents-with-the-palantir-api/2956)
