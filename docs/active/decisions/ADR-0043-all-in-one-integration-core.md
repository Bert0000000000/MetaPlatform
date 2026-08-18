# ADR-0043: All-in-One 集成核心（cordis 范式升格）

> 状态：**Accepted v1.0** · 日期：2026-08-17 · 决策人：MetaPlatform Architecture Council（MP-COMP-01 收口后的战略升格）
>
> 签字：`__/__________`
>
> 上游：ADR-0042（composition kernel）/ cordiverse/paper §1.2/§3.3/§6.1-3
> 关联：MP-COMP-01 收口（已 Accepted）/ 后续面向 A/B/C/D 各自 Batch（占位见 V31-ONTOLOGY-BOARD §6.5）

## 1. 背景

**MP-COMP-01 收口（2026-08-17）证明**：cordis 时空可组合性范式用 ~674 行 Python 内核 + orchestrator capability 试点跑通了「工具下线→角色反应式失活→dispatch 拒绝」端到端链路。内核四不变量 I1-I4 全绿、内核 API 稳定。

**战略远景（用户判断）**：ToB 场景下整个平台最终会 all-in-one —— **一个由 cordis 范式驱动的可组合集成核心 + 大量在其上挂载/卸载的子系统**（数字员工、Marketplace 第三方、AI proposal、跨域能力拓扑）。MP-COMP-01 是这个核心的最小原型；后续应该把 composition kernel 从 orchestrator 单点推广为**全平台的集成层 OS**，让任何「可挂载、可撤销、有依赖」的东西都用同一套原语表达。

**现状碎片化**：

- 17 域业务服务、orchestrator、MCP center、Marketplace、ActionType、沙箱各自有「加载/卸载/依赖」逻辑但无统一语义。系统集成是粗粒度的 —— 配 K8s values + 改 Helm chart + 重启。
- API gateway `ROUTE_MAP` 转 25+ 路径前缀到 17+ 上游（api-gateway `SERVICES` dict）；MCP center `in_memory.py` `register_tool/unregister_tool/update_tool` 是动态注册但进程内 dict；Marketplace SkillHub、A2A center `AgentCapability`、DW workers 各自维护能力表。30+ 服务共享地址空间无统一依赖语义。
- 「未确认永不落库」（ADR-0044 状态机 `PENDING → CONFIRMED → APPLIED` + engine `apply()` 强制）是当前最强的可逆约束，但 confirm 之后没有结构化的撤回原语、reject 只能整单作废。

**论文对位**：cordis §1.2.3 已论证 K8s/进程是粗粒度 workaround；§1.2.1/§1.2.2/§6.1/§6.3 给出所有四大面向的直接答案。

## 2. 决策

把 `mate_platform/composition` 从「orchestrator 试点」升格为「平台集成层可组合 OS」，下设四大面向（每个面向按 v3.1 Batch 节奏独立收口）。

### 面向 A · 数字员工自进化（论文 §1.2.2 动机原题）

- **基线**：7+N 类的语义层在 `mate_kernel.agent.orchestrator.AgentRole`（enums + rid-prefix 映射 + kernel `prompts.py` 一提示一角色）；运行层在 orchestrator `RoleRegistry`（增/删/查/恢复 + 持久化 `orchestrator_roles`）+ bootstrap 默认 capability。**没有统一的运行时「加载/卸载」语义**：装新技能 = 改 prompt 文件 + bootstrap 重启；session 内无热挂载。
- **决策**：每类数字员工 = 一颗 fiber，inject 它的 capability 集（mcp/a2a/http/local），provide 它暴露的能力（tool/skill/sub-agent）；session 内热挂载技能 = `ctx.use(component)`、卸载 = `fiber.dispose()`、依赖反应自动级联。kernel `AgentRole` 不动；orchestrator `RoleRegistry` 是数据事实源，fiber 不存副本（与 MP-COMP-01 同样的边界）。
- **对接**：复用 CapabilityRuntime 反应式语义（同款 coeffect key + 激活 overlay）；新增轻量 `digital_employee.runtime.Context` 门面以 `session_id` 维度承载生命周期。
- **Batch 候选**：`MP-EMP-EVOLVE-01`（skill/sub-agent 热挂载 kernel 化）。

### 面向 B · Marketplace 第三方订阅（论文 §6.3 capability + intercept）

- **基线**：`mate_platform/marketplace/` 已有完整 HTTP（`POST /install`, `DELETE /install/{id}`）+ 状态机（`downloading | verifying | installed | uninstalling`，`install_service.py`）+ KMS 加密 license（`subscription.py`）；信任/沙箱边界在 MCP center（`AgentTrust` / `ExternalAgent` / `Policy`），不在 marketplace 包内。**当前 install = 进程级事务**，无 capability 清单声明、无 policy 衰减语义。
- **决策**：第三方订阅 = fiber with **capability 清单声明**（inject 声明要装的能力，提供对外暴露的 endpoint）。`use()` 校验清单后启动 install 状态机，失败/取消 → fiber dispose → install 状态回滚 + license 清理；intercept/policy 先定义 dataclass 不做运行时拦截（与 MP-COMP-01 同步克制），policy 校验进 install 前审批路径。
- **Batch 候选**：`MP-MKT-INSTALL-01`（install/uninstall 走 composition 通道，capability 清单进 use() 校验）。

### 面向 C · AI proposal 回滚（论文 §6.1 acquisition/emission/withholding/compensation）

- **基线**：ADR-0044（Assisted Action）已定 `PENDING → CONFIRMED → APPLIED + REJECTED` 状态机，`mate_kernel/action/engine.py` `apply()` 强制 `CONFIRMED` 才能落库（"未确认永不落库"硬门）；C3 默认 discard 在 `prompts.py`/orchestrator `StepStatus` 注释里。**当前状态切换是普通方法调用 + DB 行状态变更**，没有结构化的 effect/逆：confirm 后无撤回原语、reject 只能整单作废。
- **决策**：ActionType.apply = effect（acquisition：装订 proposal 进 intent 表）；`confirm_proposal()` = 提交（emission，跨过系统边界）；`withdraw_proposal()` = 撤回（逆 = 摘除 intent，已 emit 落库的动作走补偿链）；`reject_proposal()` = 整套 disposal，observational equivalence ≃ 收紧「discard 到什么程度算干净」。**ADR-0044 不重写**，本面向做的是 effect/补偿词汇升级（`propose() / confirm_proposal() / withdraw_proposal()` 都成可逆 effect + 带 OTel 事件）。
- **Batch 候选**：`MP-ACTION-CONFIRM-01`（ActionType 状态机 effect 化 + I1 ≃ 等价判定测试）。

### 面向 D · 跨服务能力拓扑（论文 §3.2 + §6.2 broker）

- **基线**：api-gateway `ROUTE_MAP` 转 25+ 路径前缀到 17+ 上游；MCP center `in_memory.py` `register_tool/unregister_tool/update_tool` 是动态注册；Marketplace SkillHub、A2A center `AgentCapability`、DW workers 各自维护能力表。**30+ 服务共享地址空间无统一依赖语义**，能力上线靠各服务自己的 in-memory dict。
- **决策**：把 composition kernel 推广到 platform-level runtime —— 一个共享 `Context` 总线让平台级 capability（DB session pool / Redis pool / model endpoint / external tool / skill）以 fiber 形式挂载；进程内集成由各 service owner 自选是否用内核入口（不强制；Phase 1 给「MCP center dynamic registry + Marketplace install service + A2A center AgentCapability」3 个高 ROI 候选做试点）。服务间 RPC 沿用 api-gateway，broker 模式（论文 §6.2）做关键 capability 的多 provider 仲裁。
- **Batch 候选**：`MP-INTEGRATION-HUB-01`（platform-level Context 总线 + 至少 3 个 capability fiber 试点）。

## 3. 跟既有决策的关系

| 决策 | 关系 |
|---|---|
| ADR-0021（Kernel 12 基元） | 语义层正交：12 基元是数据/类型契约；composition 是它们的运行时组合机制 |
| ADR-0040/0041（沙箱） | 边界层：沙箱把 fiber 装进不可信容器；fiber 在沙箱内、外都同语义 |
| ADR-0042（composition 内核） | **本 ADR 是 0042 的升格**：内核本身不动，提升它作为集成层 OS 的地位与覆盖范围 |
| ADR-0044（Assisted Action） | 面向 C 不重写：把 ADR-0044 的状态机搬到 effect 词汇下，confirm/withdraw/reject 升级为可逆 effect |
| 自建原则 v0.4 | 同款处理：不引入 cordis TS 包、不引入 MAF/外部 agent 框架 |

## 4. 跟 13 硬规则对位

| 硬规则 | 承担 |
|---|---|
| ① Swagger 没有接口不写 route | 每个 Batch 进 OpenAPI 契约；capability 端点已在 MP-COMP-01 落 |
| ⑥ 静态检查失败不合并 | composition kernel 已 pyright-strict + ruff 干净；后续 Batch 同款 |
| ⑨ 没有审计/指标/trace | 每个 fiber dispose 产生 lifecycle 事件；接 OTel |
| ⑩ 状态以验收证据为准 | 每个面向独立 ACCEPTANCE.md + I1-I4 不变量测试 |

## 5. 验收

- 四大面向各 Batch 独立 ACCEPTANCE：contract + failing tests + feature + 集成 + 证据；进 V31-ONTOLOGY-BOARD §6.5 增段。
- composition kernel 公共 API 在四个面向下不退化（增项要可加不可改）。
- 论文 §3.3 / §4.4 / §6.1 / §6.3 的关键性质在每个面向都有对应测试。

## 6. 影响

- `mate_platform/composition` 从 orchestrator 单点被引用 → 跨服务共享（不强制，但 API 稳定可复用）。
- 新增 `mate_platform/integration/` 子包（platform-level Context 总线，见面向 D）的可能性。
- 治理：V31-ONTOLOGY-BOARD §6.5 v3.1 增补继续承接各 Batch。

## 7. 替代方案与拒绝理由

- **直接 fork cordis TS 包**——被拒：跨语言 + RC + bus factor≈1（ADR-0042 §7 已拒）
- **每个面向各自发明一套挂载/卸载机制**——被拒：17 域服务 × 4 面向 = 68 套碎片化机制，可维护性崩；与 K8s-as-orchestrator 粗粒度同病
- **等外部厂商出成熟 SaaS**——被拒：cordis 范式的价值恰在「这是平台自己的内核语义」，外包给第三方就把治理主权交出去了

## 8. 开放问题（出 ADR 范围，每个面向的 Batch 自己解决）

1. capability fiber 跨服务边界（>1 进程）时的桥接：论文 §6.2 服务多路复用 + §6.3 bridge —— MetaPlatform 实现要解决 RPC 中转 + capability 衰减
2. intercept/policy 实现成本（python descriptor / `__getattribute__` 钩子 vs 生成代码）：面向 B 第一版先做 capability 清单+声明，policy 衰减下一版
3. FAILED fiber 自动恢复策略：目前仅手动 reload；面向 D 高频场景需要 supervisor（cron 或 OTel trigger）
4. ≃ 等价判定在不同 capability 类型上的默认实现（值 vs 引用 vs 身份）：面向 C/D 第一版用身份等价，后续可注入自定义 equivalence