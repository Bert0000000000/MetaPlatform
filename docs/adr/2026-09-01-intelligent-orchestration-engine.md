# ADR: MetaPlatform 智能编排引擎边界

- **Status:** Accepted for first-release implementation
- **Date:** 2026-09-01
- **Owners:** Action 与工作流中心 DRI；Employee Runtime DRI；平台架构审批人
- **Decision scope:** 自然语言任务分解、候选路径规划、分支判断、多员工 SubRun 委托与受约束重规划

## Context

MetaPlatform 同时需要 AI 原生的柔性任务规划与关键业务流程的可靠执行。若智能编排器、Employee Runtime 和 Temporal 都保存“任务运行状态”或都能触发副作用，会产生多重权威、重复执行、不可恢复审批与跨宿主不一致。首发必须锁定一个可替换的智能编排实现和明确的移交边界。

## Decision

1. 首发采用 **LangGraph** 作为智能编排引擎，必须通过 IntelligentOrchestrationAdapter 使用；领域服务不得直接依赖其内部 checkpoint、node 或 state 类型。
2. LangGraph 只生成和推进 OrchestrationPlan，可以进行任务分解、候选路径比较、分支、预算控制、异常重规划以及向 Employee Runtime 请求 SubRun。
3. Employee Runtime 是 BusinessSession、WorkItem、Run/SubRun、Lease、Checkpoint 和运行命令的唯一权威。
4. Temporal 是 WorkflowExecution 的唯一权威，只承接持久等待、定时、重试、补偿、审批等待和跨进程可靠信号。
5. 任一外部 Action 必须固定 ActionVersionDigest，通过 Runtime 校验 Run/Lease，通过服务端策略校验双主体授权与 Approval，通过 ActivityLedger 幂等保护，并生成 Receipt。
6. 模型、LangGraph checkpoint、宿主缓存和 Temporal history 都不能作为业务事实、授权、Artifact 或本体发布权威。
7. 生产 profile 在进入 PI-3 前锁定 LangGraph 版本、镜像/包 Digest、许可证、SBOM、已知限制和升级 Gate；本 ADR 不写浮动的“最新版”。

## Adapter Contract

IntelligentOrchestrationAdapter 必须提供：

- compile(definition_digest) → CompiledPlanEngine
- create_plan(run_context, intent, capability_snapshot, policy_snapshot) → OrchestrationPlan
- next_candidates(plan_digest, observations) → CandidateStep[]
- record_constraint(plan_digest, human_or_policy_constraint) → OrchestrationPlanVersion
- request_replan(plan_digest, failure_receipt) → OrchestrationPlanVersion
- cancel(plan_digest, reason) → CancellationReceipt

每次输出包含 tenant、Run、policy/model/capability Digest、预算、深度、TTL、选择依据、来源证据和 correlation/causation ID。适配器不得接收可直接写业务数据库的凭据。

## Determinism and Handoff Rules

- 可在智能层内完成：纯读取、候选分析、短时无副作用计算、受约束的路径选择。
- 必须创建 SubRun：委托另一数字员工、需要独立权限/预算/审计或需要跨宿主继续。
- 必须移交 Temporal：持久等待、审批、定时、重试、补偿、人工任务或跨进程信号。
- 必须移交领域 Action：任何外部副作用、业务数据修改或不可逆操作。
- 任何重规划不得改写已执行步骤；只能创建新的 PlanVersion 并引用旧版本与失败回执。

## Replacement Conditions

只有满足以下条件才允许替换 LangGraph：

- 新实现完整通过同一 Adapter conformance、策略衰减、预算/深度/TTL、SubRun、故障注入和业务 E2E 向量；
- 迁移不会改变既有 Run/Artifact/Approval/WorkflowExecution 权威；
- production-profile、SBOM、许可证、供应链签名、回退和 Gate 已更新并 PASSED；
- 现有 Plan 的兼容/终止策略和消费者通知已批准。

触发替换评审的条件包括不兼容许可证、无法修复的高危漏洞、关键能力不满足、维护终止、性能/SLO 持续不达标或适配器契约无法保持。

## Consequences

- 优点：智能规划保持灵活，同时副作用、审批、恢复和宿主切换仍由确定性平台权威控制。
- 代价：必须维护 Adapter、边界回执、SubRun/Temporal handoff 和额外契约测试。
- 明确不做：将 LangGraph 作为第二套 Runtime；用 Temporal 编排所有短请求；允许宿主直接恢复内部编排状态并继续受保护执行。

## Verification

- test_intelligent_orchestration_boundary.py 验证智能状态不能修改 Run/Lease/Approval/WorkflowExecution。
- test_temporal_replay_safety.py 验证 replay、重复 signal 和 worker restart 不重复副作用。
- 四个宿主的 HostCapabilityContract 验证宿主只消费投影和 Artifact，不读取内部编排状态。
- PI-3 production Gate 固定版本/Digest；PI-6 针对 final-candidate 全量重验。
