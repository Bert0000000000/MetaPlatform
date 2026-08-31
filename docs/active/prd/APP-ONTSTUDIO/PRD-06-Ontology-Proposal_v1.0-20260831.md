# PRD-06：Ontology Proposal

> 关联批次：MP-ONT-PROPOSAL-01 · 所属 Sprint：0
> 状态：`[~] Draft — 待产品评审` · 2026-08-31
> 事实基线：`docs/active/delivery/evidence/MP-ONT-PROPOSAL-01-ACCEPTANCE.md`

## 1. 目标与边界

将 AI 对本体模型和实例的建议变为可审查的提议，而非直接写入。用户必须先查看 staging preview，再确认或拒绝；仅已确认提议可执行。确认不是执行，执行失败不应被伪装成成功。

本期支持 `model_type`、`create_instance`、`merge_suggestion` 与 `action` 四类提议。`action` 的业务写入仍走 ActionType 的 apply 路径；本 PRD 不授予 LLM 确认或执行权限。

## 2. 用户旅程

| 阶段 | 用户动作 | 系统保证 |
|---|---|---|
| 提议 | AI 或授权用户提交结构化变化 | 仅建立 pending 提议，不改业务事实 |
| 预览 | 审核者打开 preview | 展示类型/实例/映射/目标与影响；终态提议不可重算 preview |
| 决策 | 审核者确认或拒绝 | 记录主体、时间、tenant、理由与 trace |
| 执行 | 授权执行器执行 confirmed 提议 | 按 kind 写入，返回副作用结果或明确失败 |
| 追溯 | 审核或运维查询 | 可关联提议、预览、执行结果、审计和 Outbox |

## 3. 状态机与业务规则

状态机为 `pending → confirmed → executed` 或 `pending → rejected`。只允许一次终态转换；重复确认、重复拒绝、终态后 preview、版本冲突和越权必须返回可识别错误，不能修改事实。

- `model_type`：预览类型定义及主键、属性、接口；执行时受模型校验与租户范围约束。
- `create_instance`：预览 class、主键、属性与校验错误；执行时必须再校验目标类型和版本。
- `merge_suggestion`：预览源/目标、属性映射、相似度和影响；执行委托去重合并流程。
- `action`：预览 ActionType、目标对象和参数；确认后只允许进入既有 apply 契约，不能通过通用 execute 绕开 Action 审批。

## 4. 接口、权限与审计

公开契约提供 proposal 创建、`GET preview`、confirm、reject 与 execute。每个请求必须经 OIDC 身份和 tenant 成员关系校验；`confirmed_by` 必须来自可信主体而不是前端自由文本。

提议记录至少保存 proposal ID、kind、tenant、创建/确认主体、状态、结构化参数、版本/目标引用、结果摘要、correlation/trace ID。副作用采用事务和 Outbox 留痕；高风险 action 还必须携带幂等键与乐观锁版本。

## 5. 体验要求

Ontology Studio 的确认抽屉按 kind 显示结构化 preview、影响范围、验证错误和不可逆提示。确认、拒绝与执行按钮必须按状态/权限禁用，并在成功或失败后刷新同一 proposal 的事实状态；不以客户端缓存替代服务端终态判断。

## 6. 验收标准

代码级验收覆盖四类 preview、未确认不可写入、终态守卫、重复操作、租户隔离、Action 不能旁路 apply 和 Outbox/Audit 关联。

正式 GA 验收必须在真实 LLM provider、PostgreSQL/RLS 与 staging 集群验证：重启恢复、重复确认、版本冲突、越权、依赖故障和回滚/补偿。未获得这些逐笔证据前，状态保持 `[~]`。

## 7. 产品评审项

需要确认各 kind 的审批角色矩阵、是否允许批量确认、各类提议的过期策略和拒绝理由是否必填。默认策略是单提议、显式确认、无自动过期执行、拒绝理由可选但审计记录必有。
