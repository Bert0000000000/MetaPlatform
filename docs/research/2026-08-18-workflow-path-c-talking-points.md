# Workflow Path C — 内部 Review Talking Points 速查卡

> **用途**：内部 review 场景的 talking points，可口头/聊天/邮件直接复用
> **更新日期**：2026-08-18（含 HITL 场景冻结）
> **关联决策**：项目记忆 `mp-workflow-path-c` + `mp-workflow-hitl-scenarios`
> **完整规划**：`2026-08-18-workflow-master-synthesis.md`（单一源文档，本文件为其速查版）

---

## ⚠️ 最重要的核心用户故事：HITL（不是 BPMN）

**用户明确**：Workflow 引擎的核心用户故事是 **HITL（Human-in-the-Loop）**，**BPMN 不重要**，最后做一个转化层即可。

### 4 个 HITL 场景（已冻结）

| # | 场景 | 关键点 | 阶段 |
|---|---|---|---|
| 1 | **UserTask**（任务分发池） | 待办池 + claim/delegate/加签 + **默认 or-approve** | **M0/M1** |
| 2 | **UserApproved**（审批节点） | 审批人固定 + approve/reject/modify + **强制 audit log** | **M1** |
| 3 | **AI HITL Confirm**（Agent 半路问人） | 3 模式：simple / editable / discard+revert | **M2** |
| 4 | **In-loop AI confirm** vs **Formal Approved** | 前者 Agent loop 内轻量 / 后者 Workflow 一等节点 | **M2** |

### HITL 决定架构硬约束

**HITL 推翻了 1 个判断，升级了 3 件事**：

1. **推翻**：BPMN 不在核心 → 不引入 BPMN 全套
2. **升级**：**Path C 必须有 Event Sourcing**（不是 Temporal 借鉴，是 HITL 硬约束）——不做 = Workflow 不能挂起 = HITL 不能用 = 项目失败
3. **升级**：M0 PoC 验收标准 = 包含 UserTask → 人 approve → 继续（不是简单顺序流程）
4. **架构优先级**：P0 = Event Sourcing + Interrupt + UserTask + UserApproved

---

## 一句话定位（30 秒电梯版）

我们要做一个 **Python-native 的 Workflow 引擎**，**核心是 HITL**（不是 BPMN），把 **n8n 的可视化能力、flowgram 的友好 UI、LangGraph 的 BSP** 合三为一，用 Python 重写（不是翻译），与 composition 内核协同。

---

## 三大决策基线（任何评审必讲）

### 基线 1：为什么不用现成引擎？

- "画布 + 执行 + 审批 + Agent" **四合一开源项目不存在**
- 现成都是二选一（画布弱 / 执行弱 / BPMN 太重不适合 AI）
- n8n（201k★）License 是雷区（禁止做竞品）

### 基线 2：为什么 Path C（Python-native）？

- MatePlatform 是 **Python-first**（composition 内核、mate-platform 后端都是 Python）
- 引入 Temporal（Go）+ LangGraph（Python）+ xyflow（TS）+ flowgram（TS）+ Flowable（Java）= **5 个异构引擎污染主代码库**
- 用户明确要求"Python 一致性"——这是项目级原则

### 基线 3：为什么借鉴不翻译？

- **翻译** = 私有 fork，永远追上游、性能差、维护成本 5x
- **借鉴** = 读"为什么" + 写"做什么"，100% Python 自有、永久可演进
- 4 份借鉴清单已完成：
  - Temporal（确定性回放/Event Sourcing/Signal-Query）
  - LangGraph（BSP/reducer/Checkpoint/Interrupt）
  - xstate（statechart/Actor 模型/Guard-Action）
  - flowgram + xyflow（变量作用域/物料模式/画布）

---

## 能力对位表（让团队秒懂）

| 想要的能力 | Path C 怎么做 | 优先级 |
|---|---|---|
| **HITL（核心）** | Event Sourcing + Interrupt + UserTask + UserApproved + AI HITL Confirm | **P0** |
| **n8n 集成能力** | 17 域 Ontology Function（业务更对口，非 400+ 通用） | P2 |
| **n8n 编排** | xyflow v12 前端 + 自研 Python 编排内核 | P0 |
| **n8n 表达式** | 自研 ast + Jinja2（不抄 `$node["x"].json`） | P2 |
| **n8n 凭据** | 复用 Keycloak + SEC-IAM-01（不重做） | P1 |
| **Flowable 审批** | **不重写 BPMN**，只借鉴 UserTask 概念 + Interrupt 协议 | P0 |
| **Flowable 多租户** | 复用 SEC-TENANT-01 + Namespace 模型 | P1 |
| **flowgram UI** | xyflow + 借鉴 variable/form 设计 | P1 |
| **BPMN 兼容** | 不在核心，最后做一个转化层即可 | P3 |

---

## 6 个预判 Q&A（按出现概率排序）

### Q1：为什么不直接用 Temporal？

> Temporal 是 Go 服务端。引入它意味着 Python 后端要跟 Go 进程 RPC，**架构复杂度高 5x**。我们的 Python SDK 还要再写一层。**我们借鉴它的设计**（Event Sourcing、确定性回放、Signal/Query、Timer），用 Pydantic + PostgreSQL 实现。

### Q2：LangGraph 已经是 Python，为什么不用？

> LangGraph 强绑定 LangChain + MessagesState + Runnable 抽象，**与我们的 composition 内核风格冲突**（cordis 范式 ≠ LangChain 范式）。**借鉴** BSP、reducer、Checkpoint 设计，自己写 super_step() 函数。

### Q3：Flowable 怎么处理？BPMN 怎么兼容？

> **Flowable 8.0 保留作合规/审计后端**（v3.0 GA 已有，54 tests pass）。**BPMN 不在 Path C 核心**，最后做一个轻量 BPMN→DSL 转化层即可（v3.3+ 范畴）。我们**不重写 BPMN 引擎**——那是 Java 的活，而且对 AI 场景太重。**核心是 HITL**，BPMN 只是外部对接。

### Q4：6-12 月 / 3-4 人够吗？

> M0 PoC 2 周跑通最小 workflow → 验证可行。**若 M0/M1 跑不动，降级到 Path A（集成现成引擎），不无限投入**。这是我们的止损线。

### Q5：跟 composition 内核怎么协同？

> composition 的 I1-I4 不变量（revertible effects / reactive coeffects / 惰性 fiber / capability fiber）覆盖 Workflow 域。Workflow 引擎的持久化、回滚、多租户、调度全部走 composition。**新增 I5-I8**（状态一致性、节点契约、事件回放、租户隔离）。

### Q6：UI 用 flowgram 还是 xyflow？

> **xyflow v12**（38k★，MIT，TS）。原因：①生态更成熟；②更轻（2k 行 vs flowgram 8k 行）；③与 Semi Design 兼容；④不抄 flowgram 是因为它的 runtime/nodejs 与我们的 Sandbox 架构冲突。

---

## 4 个风险点（诚实告知）

1. **画布"自由+固定"双模式**：flowgram 花了一年多打磨，自研 2 人月起
2. **生产级持久化**：Event History 的 corner case 至少 3 个月（Temporal 5 年）
3. **LangGraph 性能对标**：BSP 的 actor 调度优化是 Google 工程级，Python 重写难
4. **永久维护成本**：上线后需持续跟进上游范式变化

**缓解**：M0 PoC 用真实业务压力测试，跑不动就降级 Path A。

---

## 4 个里程碑（建立预期）

| 阶段 | 时长 | 交付 | HITL 验收点 |
|---|---|---|---|
| **M0 PoC** | 2 周 | 最小可执行 workflow + PostgreSQL 持久化 | **必须跑通 UserTask → 人 approve → 继续** |
| **M1 内核** | 8 周 | DSL + 编排 + 持久化 + UserTask + UserApproved 节点 | 两个一等 HITL 节点 + 完整 audit log |
| **M2 节点** | 10 周 | 17 域节点 + Agent + 沙箱 + AI HITL Confirm（3 模式）+ in-loop | AI 半路问人 + editable + discard+revert |
| **M3 生产化** | 12 周 | 多租户 + 可观测 + 13 硬规则 + ACCEPTANCE + all_approve/majority + BPMN 转化层 | 多签模式 + 转化层 |

---

## 借您用的金句（可直接复述）

- "**核心是 HITL，BPMN 不重要，最后做转化层就行**"
- "**HITL 决定 Path C 必须有 Event Sourcing**——不是 Temporal 借鉴，是 HITL 硬约束"
- "**借鉴设计不翻译代码**——这是 Apache、PyTorch、LangGraph 自己走过的路"
- "**n8n 是雷区，Flowable 是合规后端，flowgram 是画布参考**，三件套能力我们都要，但**用 Python 重新实现**"
- "**In-loop confirm 是轻量便利，Formal Approved 是合规级**——两者必须区分"
- "**M0 跑不动就降级 Path A**——这是止损线，不是承诺"

---

## 关联资源

- **项目记忆**：
  - `mp-workflow-path-c`（含 n8n/Flowable/flowgram 能力对位表）
  - `mp-workflow-hitl-scenarios`（4 个 HITL 场景 + 3 个 AI 模式 + In-loop vs Formal 细分）
- **反馈记忆**：`feedback-python-native-preference`
- **借鉴清单**：
  - Temporal（确定性回放/Event Sourcing）— **HITL 决定必须用**
  - LangGraph（BSP/reducer/Interrupt）— **HITL 决定必须用**
  - xstate（statechart/Actor）
  - flowgram + xyflow（变量/物料/画布）
- **下一步**：review 反馈 → ADR-0050 起草 → M0 PoC（含 HITL 最小验证）