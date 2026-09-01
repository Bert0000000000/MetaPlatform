# MetaPlatform 敏捷交付运行模型设计

**状态：** 已确认的交付治理设计，待书面评审后进入实施计划重构。

## 1. 目标与边界

MetaPlatform 首发交付以产品主规格的 15 个一级模块为固定范围，以四个业务 MVP 为真实价值链，以组件生产 Gate 和 platform-ga 为上线证据。敏捷方法用于分解、排序、交付和复盘，不能用来降低安全、恢复、授权、审计或发布证据要求。

本模型回答四个问题：

1. 每两周交付什么可演示的功能增量。
2. 每六周如何形成跨模块可验收的产品能力。
3. 如何让业务 MVP、产品控制面和生产 Gate 并行而不产生双权威。
4. 如何在交付所有首发功能后，以 platform-ga 证明可以正常上线。

它不改变已确定的权威边界：Employee Runtime 仍拥有 Run/Lease，产物审批中心仍拥有 Artifact/Approval/Receipt，本体中心仍拥有本体发布，应用中心只装配引用，宿主不拥有平台状态。

## 2. 工作节奏

采用固定的两层节奏：

| 层级 | 周期 | 产出 | 不可省略的检查 |
|---|---:|---|---|
| Sprint | 2 周 | 至少一个可演示、可测试、可回退的产品增量 | Backlog Refinement、Sprint Planning、每日同步、Review、Retro |
| Program Increment，PI | 6 周，3 个 Sprint | 一组跨模块能力和可部署候选版本 | PI Planning、系统演示、集成验证、风险复盘、下一 PI 准入 |
| 首发发布 | PI-6 完成后 | 锁定 profile 的 GA 候选 | 真实推广、观察期、回退演练、platform-ga |

每个 PI 内长期保留两条工作线：

- 业务纵切片线：以订单、合同、本体构建、本体运维等真实场景交付用户可见价值。
- 平台与证据线：实现当前 PI 依赖的控制面、可观测、恢复、供应链和组件 Gate。

业务功能完成但 Gate 未通过，只能标记为受控能力；Gate 通过但没有真实业务闭环，也不能记作功能交付。

## 3. Backlog 与追踪模型

所有工作采用以下层级，禁止直接从“组件名称”创建没有业务结果的 Sprint 任务：

| 层级 | 定义 | 例子 | 完成证据 |
|---|---|---|---|
| Release Outcome | 首发必须兑现的业务和产品结果 | 15 模块最小闭环、混合部署可安全上线 | platform-ga |
| Capability | 可被用户、宿主或管理员识别的跨模块能力 | 临时员工组装、AI 本体演化、用户可见降级 | 端到端场景验收 |
| Epic | 可独立排入一个 PI 的能力边界 | Artifact/应用输出、MCP Catalog、动态角色 | PI 集成验收 |
| Feature | 在一个或多个 Sprint 内可演示的完整切片 | 模板包发布、Tool Schema Snapshot、AssemblyReceipt | Feature E2E |
| Story | 一个角色可验证的小行为 | 管理员创建 DynamicRole 并完成 SoD 预检 | 自动测试和 Review |
| Enabler | 为明确 Feature 服务的技术或证据工作 | 迁移 Job、恢复 Drill、Gate runner | 关联 Feature 的验证证据 |
| Defect/Risk | 已知失败、风险或债务 | 旧 IAM 路由、运行时 create_all | 修复测试和风险关闭 |

每个 Story 必须引用唯一的首发 Requirement、所属 Epic/Feature、权威对象、权限策略、测试、回退行为和责任人。Requirements Traceability Matrix 是范围权威；看板不能私自把首发 Requirement 标为不做。

## 4. 完成标准

### 4.1 Definition of Ready

Story 进入 Sprint 前必须明确：

- 用户/管理员/宿主角色与可观察结果；
- 权威对象、租户边界和权限策略；
- 输入、输出、失败与降级行为；
- 关联 Requirement、Feature、Gate 和依赖；
- 自动化测试路径与真实 E2E 样本；
- 对数据、Schema、配置、包或外部副作用的回退方式。

不具备上述信息的工作只能保留在 Discovery，不进入承诺 Sprint。

### 4.2 Definition of Done

Feature 只有同时满足下列条件才是 Done：

1. 实现已合并，契约、迁移、API、前端和文档一致。
2. 单元、集成、授权/租户隔离、并发幂等和失败路径测试通过。
3. 使用真实或经批准脱敏样本完成端到端验收；生产验收不得 mock 订单、审批、执行、回执、合同解析或恢复接口。
4. 关键读取、写入、审批、执行、发布和删除产生正确审计。
5. 有副作用的功能证明 Run、Lease、Approval 和 idempotency 生效；无副作用场景以 DecisionRecord 结束。
6. 关联 Gate 为 PASSED，或 Requirement 明确为受控环境能力且不进入 production-profile。
7. 发布后可观察、可告警、可恢复，且回退已演练。

PI 结束时，只有所有承诺 Feature 的 Done 证据和 PI 集成验收齐备，才能关闭；未完成事项不能统计为交付，只能重新拆分、降级为未启用或带风险转入下一 PI。

## 5. PI 路线图

### PI-0：首发范围与敏捷基础

目标：把“全部功能交付”变成可验证的范围，而不是抽象目标。

- 建立 15 模块 Requirements Traceability Matrix、责任人、受控例外和签字。
- 建立 Epic/Feature/Story 模板、统一 Definition of Ready/Done、风险登记和 PI Review 格式。
- 实现生产 Gate Schema、锁定工具链、唯一 live runner 和 production-profile 骨架。
- 创建六组产品实施计划的详细 backlog，不复制现有 MVP 契约。
- 完成 Demo：管理员可查看每个 Requirement 的所属 PI、Feature、Gate 与证据状态。

PI Exit：范围无遗漏；任何启用能力均能追踪到计划、测试和 Gate；所有 Gate 初始保持 NOT_EXERCISED。

### PI-1：控制面、Runtime 内核与订单闭环

目标：交付首个有副作用且可追溯的数字员工业务闭环。

- 个人中心、用户 Bootstrap、最小组织身份权限、DynamicRole、Tenant/Config 基础。
- Employee Definition/Version/Assignment、BusinessSession、WorkItem、Run、Lease、Artifact、Approval、Receipt。
- 订单洞察、人工确认、一次可逆跟进和真实订单 E2E。
- Supabase Auth 到 Keycloak 运行令牌路径、最低 OpenFGA/OPA/RLS 与迁移权威。
- 交付 CapabilityAvailabilityProjection 的第一版：订单能力在 READ_ONLY、ACTIONS_PAUSED、WAITING_RECOVERY 下的用户提示。

PI Exit：MVP1 完成双重验收；任何重复确认、过期 Lease 或恢复重放均不产生重复业务效果。

### PI-2：应用、能力与 MCP 控制面

目标：让受治理的能力可发现、可装配、可发布，而不复制其权威对象。

- ArtifactSchema、OutputProfile、Markdown/HTML 模板包、装配型应用、安装/升级/回滚。
- Skill/Capability 生命周期、评测、版本与员工绑定。
- MCP Server/Tool/Resource/Prompt Catalog、Schema Snapshot、AuthProfile、Route、ConsumerBinding 和兼容测试。
- Host/Connector 控制面、至少两宿主 Run 续接验证。
- 交付 Demo：管理员发布一个模板包与装配应用；宿主按 UserContext/EmployeeProjection/CapabilityCatalog 调用受权 Tool。

PI Exit：应用、员工、Skill、MCP 与 Artifact 只以固定 Release/Digest 关联；未通过安全 Gate 的 MCP App 与可执行插件不进入运行时。

### PI-3：合同知识、数据产品与智能编排

目标：交付“有证据的智能分析和编排”，而非通用聊天。

- 合同文档接入、真实 RAGFlow 解析、来源跨度、金标评测和人工 DecisionRecord。
- DataSource、DataProduct、质量、血缘、受治理查询与知识图谱投影。
- Action/Workflow 的版本、风险、补偿、Trigger 与 Execution。
- IntelligentOrchestrationDefinition、OrchestrationPlan、受衰减 SubRun 和 Runtime/Temporal 移交边界。
- 交付 Demo：合同审查报告含证据；用户任务由智能编排拆分，在审批等待时转入可靠工作流。

PI Exit：MVP2 完成业务与架构验收；模型或编排层不能直接执行副作用或扩大权限。

### PI-4：本体工厂、动态员工与自动演化

目标：让 AI 生成候选与规划，但不获得本体或权限的最终写权。

- 对话/材料统一抽取、OntologyProposal、冲突、SHACL、影响分析、Release Ledger、Jena 投影。
- EmployeeAssemblyPlan、EphemeralEmployeeInstance、AssemblyReceipt、TTL 回收和跨宿主续接。
- OntologyEvolutionPipeline 与 OntologyQualityAssessment：受权材料、知识切片、Schema/血缘变化驱动维护提案。
- 交付 Demo：用户发起复杂本体任务，平台组装临时员工，生成候选、质量评估、人工评审、发布或回滚。

PI Exit：MVP3 完成验收；自动演化只能产生候选，人工发布、确定性校验和权限边界不被绕过。

### PI-5：本体运维、记忆、运营与用户可见降级

目标：把持续运营与故障体验作为产品能力交付。

- NATS Outbox/Inbox/DLQ、事件去重、背压、安全重放、MaintenanceRun 与本体漂移维护。
- 受治理 MemoryCandidate、Review、Promotion、Conflict、Revocation、Deletion 与跨宿主连续性。
- SLO、Alert、Incident、Runbook、On-call RACI、质量评测、成本预算、备份与 Restore Drill。
- 全量 CapabilityAvailabilityProjection：各故障域的 AVAILABLE、READ_ONLY、WAITING_RECOVERY、ACTIONS_PAUSED、UNAVAILABLE 体验与恢复通知。
- 交付 Demo：知识或 Schema 变化生成维护提案；依赖故障时用户获得正确降级、恢复和审计链。

PI Exit：MVP4 完成验收；端到端恢复与业务对账满足声明的 RPO/RTO；启用 Memory 的租户完成删除传播证据。

### PI-6：混合部署、发布收口与 GA

目标：把已交付功能安全推进到首发生产环境。

- 完成 Connected Runtime 的组件 Gate、生产 profile、签名/SBOM/许可证、迁移 Job 和旧 IAM 退出。
- 云端生产与连接型私有部署使用相同 TenantRuntime Package 完成预生产回放、灰度、观察期和回退。
- 完成四宿主 Capability Contract；若完全断网 Cell 被列入首发，则完成 disconnected-cell-hosts Gate。
- 完成全链路灾备、跨故障域恢复、N/N-1 升级/回退、真实业务对账和事故演练。
- 运行 production-release-promotion；生成 Release Readiness Report 并由业务、安全、数据、运营和发布负责人签字。

PI Exit：platform-ga 为 PASSED；任何子 Gate、恢复、签字或证据 Digest 失败即为 NO-GO。

## 6. Sprint 执行规则

每个 Sprint 从各 PI 的承诺 Feature 中选择垂直切片，并至少包含一项用户可见能力或可验证风险关闭。推荐顺序：

1. 先完成契约和测试，再实现最小行为，再接入真实依赖。
2. 将前端、API、运行时、权限、审计和 E2E 同一 Story 完成，避免“后端已完成、前端待接”的伪交付。
3. Enabler 只能作为明确 Feature 的依赖存在；没有 Release Requirement 的基础设施工作不能占用 PI 承诺容量。
4. 每个 Sprint Review 展示真实样本、当前证据、失败路径、降级和回退，不展示 mock 成功截图。
5. 每个 Retro 输出最多三项改进，必须有责任人并进入下一个 Sprint Backlog。
6. 发生 P0 安全、数据完整性、越权或重复副作用风险时，暂停相关 Feature，先执行风险修复和重新验证。

## 7. 跨团队协作与职责

| 角色 | 主要职责 | 不可替代的签字/决定 |
|---|---|---|
| 产品负责人 | 维护 Release Outcome、需求优先级、业务验收 | 首发范围与业务价值签字 |
| 领域负责人 | 提供真实样本、规则、本体语义和验收 | 领域结论与行动边界 |
| 平台工程 | Runtime、身份、权限、应用、部署、可观测 | 权威边界和工程验收 |
| 数据/知识工程 | 数据产品、RAG、血缘、质量、图谱 | 数据可用性与证据 |
| 安全/合规 | 策略、供应链、审计、保留、例外 | 风险例外与安全准入 |
| SRE/运维 | SLO、告警、恢复、发布、值班 | 生产推广与恢复 |
| QA/质量 | 金标、E2E、故障注入、回归 | 质量门与测试完整性 |

任何角色都不能单独使高风险 Action、本体发布、权限提升或 GA 生效；职责分离由策略、审批和审计同时保证。

## 8. 变更管理

- 首发 Requirement 只能通过产品、安全、数据和运营共同签字的变更记录新增、删除或降级。
- Sprint 内发现的实现细节可以调整；跨 PI 的能力边界、权威对象和 Gate 依赖必须先更新规格与追踪矩阵。
- 未能通过 Gate 的组件保持受控兼容路径或 NOT_IN_RUNTIME，不能以自研替代物绕过评审。
- 新宿主、MCP App、可执行插件、完全断网 Cell 都是显式范围变更，不能因演示成功自动进入首发。
- 任何版本、镜像、配置或证据 Digest 改变，受影响 Gate 和 platform-ga 必须重新验证。

## 9. 成功度量

敏捷过程本身不以故事点或燃尽图判定成功。首发成功只使用以下结果度量：

- 15 个模块的首发 Requirement 覆盖率、Done 比率与证据新鲜度。
- 四个业务 MVP 的真实 E2E 通过率、失败路径覆盖率和业务签字。
- 授权拒绝、租户隔离、重复副作用、恢复对账和审计完整性。
- SLO、错误预算、RPO/RTO、告警演练与回退演练。
- 生产 profile 中启用组件和其父 Gate 的 PASSED 比率。
- platform-ga 的最终 GO/NO-GO 结论。

燃尽图只用于预测，不得替代上述发布证据。

