# MetaPlatform 数字员工平台业务 MVP 实施路线图

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用四个可独立验收的业务 MVP 逐步交付数字员工平台，同时通过独立的架构收敛门把现有实现迁移到已验证的目标组件。

**Architecture:** 实施采用“业务闭环轨 + 架构收敛轨”双轨制。业务 MVP 只引入完成本场景所必需的能力；目标组件通过锁版、兼容、许可证、迁移和恢复门后才进入生产路径，不能把整个平台底座隐藏在 MVP1 中。

**Tech Stack:** Python/FastAPI、PostgreSQL、React/Vite、MCP、OpenAPI/JSON Schema；目标组件按需采用 Supabase Auth、Keycloak、OpenFGA、OPA、LiteLLM、Temporal、NATS、RAGFlow、MemoryCore、Jena、Trino/Iceberg/Polaris、SeaweedFS。

**Spec:** `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md`

## Global Constraints

- 平台拥有数字员工、Run、Lease、Memory 和 Artifact 的权威状态；宿主只加载投影。
- MCP 调能力，A2A 调员工，NATS 传事件，Temporal 只承载可靠等待、重试和补偿。
- `ReportArtifact`、`ActionPlan`、`ApprovalRecord`、`DecisionRecord`、`ExecutionReceipt` 是独立不可变对象，以 Digest 互相引用；无副作用的法务决定不能伪装成执行回执。
- 变更型调用必须携带 `run_id + lease_id + lease_epoch + idempotency_key`，并在副作用前校验。
- 开源能力采用顺序为 `Adopt → Configure → Extend → Build`；不得重建通用 IAM、授权、网关、RAG、记忆、图、联邦、工作流或消息系统。
- MetaPortal 不新增聊天入口；业务页面使用共享 Artifact Renderer，触达页面逐步收敛到 Ant Design。
- 当前状态以代码、测试、部署检查和当前 SHA 为证据；README、CLAUDE 和历史验收只作线索。
- 受控业务 MVP 与生产准入分开验收；未通过目标组件生产门，不得宣称生产就绪。

---

## 1. 评审后的路线结论

实施顺序确定为：

1. **MVP1：订单洞察与行动。** 查询真实订单，依据本体和制度约束形成证据报告与 ActionPlan，人工确认后执行一个可逆跟进动作。
2. **MVP2：合同审查闭环。** 上传真实 PDF/DOCX，依据合同本体和 RAG 证据形成风险报告、修改建议和审批提案。
3. **MVP3：本体构建工厂。** 从对话和材料形成带来源的本体候选，调度数字员工协作，完成校验、评审、签名和版本发布。
4. **MVP4：本体持续运维。** 持续处理知识切片和 Schema 变化，形成漂移提案、影响分析、回归、发布和回滚。

订单优先是当前证据下的最短真实闭环，不是被历史设计绑定。基线 SHA `c80239c6a478e51b10624d317c058fc07be3a2aa` 中，订单域已有事务仓储、EvidenceBundle、Ontology Action、ActionProposal、幂等确认/拒绝、Outbox、页面和 E2E；合同审查只有演示数据，没有独立 API、领域模型、迁移、MCP 工具和测试。

## 2. 双轨实施模型

### 2.1 业务闭环轨

每个 MVP 必须独立交付：真实业务输入、结构化 Artifact、可验证证据、人工决策、允许的业务动作或明确无副作用终态、失败路径和业务指标。有副作用的场景必须有 ExecutionReceipt；无副作用的场景以 DecisionRecord 终结并禁止伪造 ExecutionReceipt。一个 MVP 不得以“组件部署成功”代替业务验收。

### 2.2 架构收敛轨

架构任务分为三类门：

| 门 | 含义 | 何时阻断 |
|---|---|---|
| 场景必需门 | 本场景若缺失就无法安全交付，例如订单迁移、ActionPlan 审批绑定、Lease fencing | 阻断该业务 MVP |
| 生产准入门 | 受控环境可用兼容实现，但目标组件未经锁版、恢复或许可证验证 | 阻断生产声明，不阻断受控业务价值验证 |
| 目标替换门 | 当前实现继续承载业务，待消费者、桥接、回滚和校验齐备后切换 | 阻断旧组件退役，不阻断前序 MVP |

跨宿主切换是架构验收，不是独立产品阶段。MVP1 先支持一个经验证的宿主入口；第二宿主在 Run/Lease 契约稳定后加入架构门。四宿主完整矩阵是生产准入条件，不是订单业务出口条件。

## 3. 当前实现证据与处理决定

| 能力 | 当前证据 | 处理决定 |
|---|---|---|
| 订单事务闭环 | `mate-tech-orchestrator/.../repositories/order_review.py`；本轮 81 tests passed、3 PostgreSQL 并发 tests skipped | 复用领域逻辑；先补迁移、并发和真实数据验收 |
| 订单表结构 | 运行时 `create_all()`，Alembic 无对应迁移 | MVP1 阻断项：补正式 migration、回填/回滚和 schema gate |
| 订单建议 | `OrderReviewPage.tsx` 使用固定 `follow_up_payment` | 不包装成模型洞察；先由可审计规则生成，再引入有 ModelReceipt 的模型建议 |
| 订单本体 | PostgreSQL ontology v2 代码存在 | MVP1 直接使用 PostgreSQL 权威；Jena 投影按本体场景拉动 |
| 数字员工目录 | `mate-tech-dw` 同时有 SQL、in-memory 和演示 API | MVP1 把最小 EmployeeDefinition/Version/Instance/Assignment 权威前置到 `mate-platform`；`mate-tech-dw` 只作迁移来源/只读投影，不得成为 Employee 或 Run 权威 |
| 身份 | 当前 Keycloak/JWT 可用；Supabase 人类身份链尚未实现 | MVP1 保留兼容入口；Supabase→Keycloak 为生产准入门 |
| 授权 | JWT、tenant guard、部分 RLS；OpenFGA/OPA 缺失 | MVP1 实现订单最小双主体策略；通用模型逐场景扩展 |
| MCP | `mate-tech-mcp` 有业务工具，也混入自研管理/联邦 | 保留业务工具；网关替换须经 LiteLLM MIT-only 与兼容门 |
| 模型网关 | 自研 `mate-tech-llmgw` 存在 | 受控 MVP 可兼容；服务端模型迁移到 LiteLLM 后再退役 |
| 工作流 | Temporal 抽象和 worker 边界存在 | 只有出现可靠等待/重试时启用；普通查询不进入 Temporal |
| 事件 | Kafka/Outbox 为主 | MVP1 保留 Outbox；NATS 在事件型场景拉动并提供迁移桥 |
| RAG | 客户端失败时整文 fallback，binary 仅文本 decode | 订单 MVP 不强制；合同 MVP 必须真实解析且失败关闭 |
| 记忆 | MemoryCore 集成缺失 | 不阻断订单业务闭环；跨宿主连续性需要时接入受治理 Memory Adapter |
| Artifact | EvidenceBundle 和 Viewer 存在，统一对象缺失 | MVP1 建 v1 不可变对象链并兼容历史 EvidenceBundle |
| 数据联邦 | Trino/Iceberg Helm 资产存在，目标组合未验收 | 真实订单源需要跨源时才用 Trino；否则业务服务直读受治理数据源 |
| 前端 | React/Vite，Semi/Recharts/自有组件混用 | 只迁移 MVP 触达页面；不在 MVP1 发起全站换栈 |

## 4. MVP 与目标组件拉动矩阵

| 能力 | MVP1 订单 | MVP2 合同 | MVP3 本体构建 | MVP4 本体运维 |
|---|---|---|---|---|
| Employee/Session/Run/Lease | 最小权威内核 | 复用 | 增加 A2A SubRun | 增加事件 Run |
| 宿主入口 | 一个稳定 Connector | 第二宿主作为架构门 | 增加协作能力矩阵 | 完成四宿主生产矩阵 |
| 身份 | 现有 Keycloak 兼容链 | Supabase→Keycloak PoC 可并行 | 锁版后候选切换 | 完成迁移/撤销/离线演练 |
| OpenFGA/OPA/RLS | 订单最小策略 | 合同资源和文件策略 | 本体职责分离 | 自动提案/发布策略 |
| LiteLLM | 若使用服务端模型则先接 Model Gateway | Model + MCP 锁版路径 | A2A 仅在互操作通过后启用 | 完整预算/恢复门 |
| RAGFlow/Infinity | 非必需 | 核心依赖，真实解析/证据 | 复用材料输入 | 切片复盘和漂移 |
| MemoryCore | 非业务出口条件 | 可选案例经验 | 可选建模经验候选 | 可选运维经验晋升与删除；不阻断 MVP4 业务出口 |
| Jena | 非必需 | 合同本体复杂查询时条件启用 | SHACL/版本投影核心 | 回归、切换、重建 |
| Trino/Iceberg/Polaris | 仅真实跨源订单需要 | 可选元数据分析 | 影响分析读取 | 完成湖仓目标收口 |
| Temporal | 仅跨时审批/外部等待 | 审批、超时、长解析 | 多员工评审发布 | 周期复盘、回归、回滚 |
| NATS | 保留现有 Outbox | 可不启用 | 发布通知可启用 | Schema/切片/漂移事件核心 |
| SeaweedFS | Artifact 对象需要时条件启用 | 文件与证据对象核心 | 复用 | 备份恢复和对象锁门 |
| 前端收敛 | 订单页和 Artifact Renderer | 合同页 | 本体 diff/图 | 运维面板及触达页收口 |

## 5. MVP1 订单洞察与行动

### 5.1 业务闭环

真实高价值未支付订单 → 固化订单/本体/策略版本 → 生成 Evidence 与 ReportArtifact → 生成独立 ActionPlan → 人工确认或拒绝 → 幂等执行可逆跟进动作 → ExecutionReceipt、审计和对账。

### 5.2 场景必需门

- 为订单表补 Alembic migration，移除生产路径运行时 `create_all()`。
- 使用真实订单适配器；测试 API 创建的数据不能作为业务验收样本。
- 建立最小 BusinessSession、WorkItem、EmployeeRun、ExecutionLease 和 Run Ledger CAS。
- 建立 ReportArtifact、ActionPlan、ApprovalRecord、ExecutionReceipt 的 Digest 引用。
- 执行前校验双主体、计划 Digest、Lease epoch、业务版本和幂等键。
- 补真实 Outbox relay、消费幂等、并发确认/拒绝竞争和 PostgreSQL 并发测试。
- 固定建议明确标为规则输出；模型参与时必须提供 ModelReceipt。
- 先提供一个经验证的 Host Connector；MetaPortal 只查看报告和确认动作。

### 5.3 不纳入订单业务出口

RAGFlow、MemoryCore、Jena、NATS、A2A、Iceberg/Polaris、四宿主矩阵、全站 UI 迁移、Flux 替换和完全离线 Cell 都不是订单业务出口条件。它们只有在订单真实数据源或业务流程确实需要时，才作为对应任务的依赖进入。

### 5.4 业务验收

- 重复请求、并发确认、确认/拒绝竞争只产生一次业务效果。
- 数据版本、本体版本、策略决策、审批、计划和回执可追溯。
- Evidence 缺失、本体版本过期、授权撤销或 Lease 迟到时禁止执行。
- 用户能看到为什么提出建议、将执行什么、实际执行结果以及失败恢复状态。

## 6. MVP2 合同审查闭环

### 6.1 业务闭环

上传真实带文本层的 PDF/DOCX → 恶意文件与权限检查 → 固定 GovernedSourceDocument 版本 → 真实解析条款页码/跨度 → 检索制度、模板和合同本体 → 生成风险 ReportArtifact 与修改 ActionPlan → 法务确认/拒绝/评论 → 导出不可变报告和终态 DecisionRecord。

### 6.2 场景必需门

- 新建独立合同审查领域包、OpenAPI、迁移、MCP 工具和真实文件 fixtures。
- RAGFlow 使用锁定版本真实上传、异步解析、检索和删除；禁止整文 fallback 冒充成功。
- Evidence 精确记录合同 Digest、页码/字符跨度、制度版本、本体 Digest、检索快照和 ModelReceipt。
- 金标集按合同类型和法域分组，度量高风险条款召回率、引用准确率、无依据结论率和主动弃答率。
- PDF/DOCX、损坏文件、大文件、压缩炸弹、恶意宏、提示注入和跨租户对象键均有拒绝用例；首版扫描件明确返回 `OCR_REQUIRED_UNSUPPORTED`，OCR 通过独立开源组件 Gate 后再启用。
- MVP2 不自动修改、签署或发送合同，法务确认不可绕过。

## 7. MVP3 本体构建工厂

### 7.1 业务闭环

经授权的 DialogueSourceSnapshot 或 GovernedSourceDocument → 带来源跨度的实体/关系/约束/动作候选 → 去重和冲突分析 → A2A SubRun 协作 → SHACL 与影响校验 → 多角色评审 → 签名 OntologyPackage → PostgreSQL Release Ledger 发布，Jena 投影和通知由恢复器幂等收敛。

### 7.2 场景必需门

- 对话和材料复用同一 `SemanticExtractionResult` 与 `OntologyProposal` Schema。
- A2A 委托记录父 Run、预算、深度、截止时间、权限衰减和审批继承，拒绝循环和扩权。
- 模型只能写候选；提取者、评审者和发布者职责分离。
- 每个 OntologyPackage Digest 对应不可变 Jena Named Graph，既有 Run 固定旧 Digest。
- breaking change、重复 RID、无来源候选和 SHACL 失败必须拒绝发布。
- 任一发布边界失败按 `STAGED → VALIDATED → ACTIVATING → ACTIVE | FAILED` Ledger 恢复；`current` 只是可修复投影，既有 Run 保留固定 Digest。

## 8. MVP4 本体持续运维

### 8.1 业务闭环

RAG 切片或 Schema 事件 → 去重并建立 MaintenanceRun → 漂移候选 → 影响分析 → 金标回归 → 人工审批 → 发布或回滚 → 质量、运行和记忆反馈。

### 8.2 场景必需门

- NATS CloudEvents 携带 tenant、Run、causation、Schema version 和权限水位；有界重试、DLQ 和安全重放。
- 重复事件只生成一个提案；事件风暴有背压、限流和恢复验证。
- 质量下降、证据不足或影响未知时停止，不允许自动检测直接自动发布。
- 回滚以 PostgreSQL Release Ledger 为权威，Jena 别名、缓存和通知由补偿/恢复器收敛；既有 Run 不改 Digest。
- MemoryCore 仅在被选择进入部署时执行可选 Gate；MemoryCandidate 只有在来源、作用域、保留期和审核通过后晋升，并支持冲突、污染撤销和删除传播。
- 完成数据库、对象存储、事件和工作流恢复演练；若启用 MemoryCore 再补记忆恢复证据，之后才可关闭相应 Kafka/MinIO/旧网关入口。

## 9. 生产准入门

以下验证与业务开发并行，但未通过前只能在受控环境使用对应能力：

1. 四宿主逐版本 Capability Contract；稳定 Connector + Bootstrap/元工具，不依赖按员工动态安装插件。
2. Supabase Auth → Keycloak OIDC Identity Brokering（Authorization Code + PKCE）→ Token Exchange → 租户 Runtime；执行时锁当前安全支持的精确 patch 与镜像 Digest，2026-09-01 验证基线为 26.7.3。覆盖预链接、ID Token `iss/aud/nonce`、JWKS 轮换、撤销、水位和回滚映射；JWT Authorization Grant 只作为通过独立断言/audience/jti Gate 的非交互可选路径。
3. LiteLLM 锁定 commit/image 的 Model/MCP/A2A 互操作、OAuth、流式、预算、失败降级、import graph 和 transitive SBOM；A2A 缺陷关闭前不进入关键路径。
4. 先完成 SeaweedFS 安全版本、对象权限、Object Lock/WORM 和 filer/data 恢复，再验证 RAGFlow 的 PostgreSQL、外部 Valkey、Infinity、SeaweedFS 组合；交付包不部署/打包未选默认服务镜像和 Chart。
5. MemoryCore 锁定 tag/commit，只开放 L0-L3，经 Memory Adapter 完成 ACL、单活崩溃、快照恢复、升级和 RPO/RTO 验收。
6. Polaris 保持唯一 Catalog；MetaPlatform 只验证并消费外部受治理发布者提交的 Iceberg v2 快照，Trino/S3 全链路只读，不在当前架构内补写 Iceberg writer。
7. EmployeePackage/SkillPackage/OntologyPackage/DeploymentBundle 完成权限清单、Digest、Cosign、SBOM、撤销和离线信任包验证。
8. OpenBao HA/Raft、PKI、动态凭据、签名轮换和恢复，以及 CloudNativePG/Barman Cloud Plugin PITR 必须分别通过，不以服务健康替代恢复证据。
9. Connected TenantRuntime 完成 Envoy Gateway、Supabase 数据面、OpenFGA/OPA、Artifact Object API、NATS/Temporal、OCI Registry、OpenSearch/Perses 和 Flux 组合门后，才可制作 Disconnected Cell。
10. Disconnected Cell 完成本地身份、Bootstrap、策略、Secrets、OCI、GitOps、最长离线有效期和重新联网冲突演练后，方可宣称完全离线。

## 10. 每个 MVP 的双重出口证据

### 10.1 业务验收签字章节

记录用户、样本、输入、输出、允许动作、业务指标、失败案例、人工签字和当前 Git SHA。业务验收回答“这个场景是否真正解决问题”。

### 10.2 架构验收签字章节

记录 Run/Lease、授权、幂等、证据、恢复、宿主兼容、组件版本、许可证和故障注入。架构验收回答“这个场景是否以可持续且安全的方式交付”。两个章节可位于同一个 MVP acceptance 文件，但必须分别签字、分别给出通过/拒绝结论。

所有业务服务必须运行 `mate-platform-backend/tests/conformance/employee_runtime/`，统一验证 Run 状态机、Runtime Token Claim、RFC 8785 Digest、Approval 单次消费、Lease fencing、错误码和 Artifact Schema；业务包不得复制或放宽这套契约。

任何一方失败都不能宣称该 MVP 生产完成；业务验收通过但生产门未过时，只能标记为受控 MVP。

## 11. 详细计划索引

- `docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md`
- `docs/superpowers/plans/2026-09-01-mvp-02-contract-review.md`
- `docs/superpowers/plans/2026-09-01-mvp-03-ontology-factory.md`
- `docs/superpowers/plans/2026-09-01-mvp-04-ontology-operations.md`
- `docs/superpowers/plans/2026-09-01-platform-production-convergence-gates.md`

先完成并提交 Production Convergence Task 1 的证据 Schema、锁定工具链和异常安全 Runner；它是所有计划的测试基础设施，不表示任何组件 Gate 通过。此后四份业务计划各自交付可运行、可测试、可拒绝的软件；其余生产收敛 Gate 按组件首次进入生产路径的时间并行启用，不是第五个业务阶段。后一个 MVP 复用前一个 MVP 的权威对象和契约，不复制 Employee Runtime、授权、Memory 或 Artifact 竖井。

### 11.1 多 Agent 交叉校验结论

| 校验维度 | 最终结论 | 已闭合重点 |
|---|---|---|
| 架构 | 无剩余 P0/P1 | 权威对象、双主体授权、Run/Lease 生命周期、控制面与数据面、六类业务场景 |
| 技术 | 无剩余 P0/P1 | 开源组件边界、身份链、许可证、部署拓扑、恢复要求、生产 Gate DAG |
| 实施 | 无剩余 P0/P1 | 文件和依赖顺序、迁移链、后台 Worker、Temporal、真实 E2E、统一 live runner |

因此，本 Spec、总路线图、四份业务 MVP 计划和生产收敛计划共同构成**条件性实施基线**。这里的“通过”只表示架构和计划经静态交叉评审后完整、内部一致且可以按任务执行；所有任务复选框仍未执行，所有生产 Gate 初始仍为 `NOT_EXERCISED`。只有实际运行计划中的真实环境测试、恢复与故障注入，并形成符合 Schema 的证据后，才能逐项声明 `PASSED` 或生产完成。

## 12. 变更和退役规则

- 总体架构变更先修改 Spec 并重新评审，再修改受影响的 MVP 计划。
- 目标组件版本变化只修改锁文件和兼容矩阵，不改变权威职责。
- 若一个组件不能在当前业务闭环中证明价值，则从该 MVP 移除并保留在生产准入门。
- 替换现有身份、网关、消息、对象存储或数据源前，必须先盘点消费者，提供兼容桥、数据校验、双读/双写窗口和明确回滚。
- 旧入口只有在当前 SHA 的调用方、数据和恢复证据全部迁移后才能停用。
