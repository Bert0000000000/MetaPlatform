# PRD 05–08 Sprint 0 Delivery Design

> 日期：2026-08-31
> 状态：`[x] Design Approved — implementation planning pending`
> 关联 PRD：PRD-05、PRD-06、PRD-07、PRD-08

## 1. 目标与范围

将已具备条件验收的 Semantic Router、Ontology Proposal、Ontology Dedup 与
Action Orchestration v1.7 收口为可持久化、可授权、可审计且可进行本地系统验收的
能力。实现分为三批：Proposal/Dedup 核心（PRD-06/07）、Router 收紧（PRD-05）、
Plan 编辑与持久化（PRD-08）。

本设计不交付真实 staging、真实 LLM provider、PostgreSQL RLS、Sandbox L2、
Temporal Plan 运行时翻译或 v1.0 GA。

## 2. 跨批次原则

- Keycloak OIDC/JWT 是可信用户身份来源；请求体不得提供确认、拒绝或执行主体。
- 所有业务事实按 tenant 隔离；tenant、actor、trace 与 correlation 必须进入审计。
- 内存、浏览器 localStorage 与演示数据只能用于短暂 UI 状态，不能作为 Proposal、
  ObjectType、Plan 或业务执行事实源。
- 副作用必须失败关闭；依赖不可用时返回可诊断错误，禁止伪造成功或静默回退。
- 本地 Task5 验收使用 Docker/PostgreSQL；结果必须明确标识为 local acceptance。

## 3. 批次 A：PRD-06 与 PRD-07 Proposal/Dedup 核心

### 3.1 状态与权限

Proposal 的公共状态为：

```text
pending -> confirmed -> executed
pending -> rejected
```

`executed` 是唯一公共执行终态；现有内部 `applied` 语义在仓储与 API 层统一映射或
迁移为该术语，避免两个终态含义并存。所有终态转换是一次性的，重复确认、重复拒绝、
终态 preview、未确认执行与版本冲突均返回可识别的冲突错误。

Sprint 0 中，同一位拥有 Ontology 运营权限的 tenant 成员可以创建、确认、拒绝及执行
proposal。服务端从 OIDC 上下文写入 `created_by`、`confirmed_by`、`rejected_by` 与
`executed_by`；不信任前端字段。双人审批与更细的职责分离留待后续 RBAC 矩阵。

### 3.2 Proposal 执行边界

- `model_type` 与 `create_instance` 只能由 confirmed proposal 触发写入。
- `merge_suggestion` 必须包含不同的同 tenant source/target、属性映射与影响摘要；
  成功后 archive source，绝不物理删除。
- `action` 仅可衔接既有 ActionType.apply 契约，保留幂等、乐观锁、Outbox 与 Audit
  规则；通用 proposal execute 不得旁路 action 的授权/确认链。
- preview 在 `pending` 时基于结构化 parameters 渲染；进入终态后锁定，不能重算或
  覆盖已审计事实。

### 3.3 数据与审计

PostgreSQL Proposal 记录保存 kind、tenant、actor、状态转换时间、结构化参数、预期
diff、引用版本、执行结果摘要、trace/correlation。执行与 ObjectType 合并在同一事务
边界内持久化业务事实与审计/Outbox 事件；失败不把 proposal 标记为 executed。

ObjectType 对未归档记录保持 `(tenant_id, slug)` 唯一。precheck 与 embedding 相似度
只产生同租户候选和可解释证据，不自动合并，也不得在 409 响应中泄露跨租户 RID 或
schema。

## 4. 批次 B：PRD-05 Semantic Router

```text
OIDC subject + tenant
  -> authorized role snapshot
  -> semantic/keyword top-k ranking
  -> routing_decision pre-screen SSE
  -> bounded LLM or deterministic dispatcher selection
  -> routing_decision final SSE
  -> authorized target invocation
```

- Router 只能从当前 tenant、当前用户可调用且能力匹配的角色快照中选择目标。
- 初始服务默认值为 `top_k=3`、最低相关度 `0`；二者均由服务配置提供，前端不硬编码。
- 缓存键含 tenant、role ID 与能力文本版本；角色能力变更必须失效缓存。
- `routing_decision` 必须先于 reasoning/tool 事件。最终事件包含候选、selected、原因、
  路径、trace/correlation；无候选、目录/A2A/provider 故障是明确失败状态。
- LLM 不能选择候选以外的角色。Sprint 0 只展示过程，不允许用户手工改选。
- 路由审计保存请求关联、候选快照摘要、选择与路径；原始提示词按既有合规策略处理。

## 5. 批次 C：PRD-08 Action Orchestration v1.7

前端只维护短暂编辑状态；服务端的版本化 Plan JSON 是 Workflow Definition 的唯一
事实源。

```text
Node library / canvas / inspector
  -> in-memory Plan JSON draft
  -> versioned explicit save
  -> Workflow Definition API + PostgreSQL + Audit
  -> publish
  -> existing WorkflowRun API
```

- 编辑读写使用 `GET` / `PUT /api/v1/workflow-definitions/{id}`；`PUT` 携带版本，
  冲突返回 409 和最新版本摘要。
- 发布使用 `POST /api/v1/workflow-definitions/{id}:publish`。运行保留
  `POST /api/v1/workflows/{definition_id}/runs`，不暴露 Temporal worker、内部对象或
  凭据。
- 节点类型、Inspector 字段与可连接端口由受控注册表决定。未知节点、非法连线和结构
  错误必须可行动地报错并阻断发布。
- 删除节点在同一份 Plan JSON 中原子删除关联边；保存失败保留浏览器草稿并提示重试，
  但不得显示为已保存。
- 全屏由原生 button 触发；全屏状态下节点库、画布、Inspector、保存和退出操作都可用。

## 6. 验收策略

每批均以测试先行：

| 批次 | 自动化覆盖 | 本地系统验收 |
|---|---|---|
| A | 状态机、可信 actor、租户隔离、preview 锁定、slug 并发冲突、merge archive、审计/Outbox | Docker PostgreSQL 重启后 proposal/dedup 事实可查询 |
| B | 排序、能力变更失效、候选约束、SSE 顺序、跨租户拒绝、依赖失败 | SuperAI SSE 事件及可读路由面板 |
| C | Plan 版本冲突、节点/边约束、原子删除、错误态、全屏入口 | Docker 全栈生产构建 Playwright，不使用 mock 或固定等待 |

通过上述测试仅表示代码级和 local Docker acceptance。真实 provider、RLS、staging、
Sandbox L2、Temporal 运行时和 GA 仍为独立门禁。
