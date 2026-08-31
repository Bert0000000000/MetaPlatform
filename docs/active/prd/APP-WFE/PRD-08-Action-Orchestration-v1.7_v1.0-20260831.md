# PRD-08：Action Orchestration v1.7

> 关联批次：action-orchestration v1.7 · 所属 Sprint：0
> 状态：`[~] Product Approved — local Docker system journey passed; production hardening remains` · 2026-08-31
> 事实基线：`docs/active/delivery/evidence/ACTION-ORCHESTRATION-V1.7-ACCEPTANCE.md`

## 1. 目标与边界

为业务建模人员提供稳定的可视化 Action 编排体验：从节点库拖放节点，按节点类型编辑动态字段，安全删除节点和关联线，并在全屏编辑状态下完成同样操作。

本 PRD 定义 v1.7 编辑器交互和结构化编辑数据。运行请求只允许引用后端已发布的 Plan revision；Temporal 的具体 workflow ID、task queue、activity 与凭据不暴露给浏览器。本地 Docker 使用显式 local executor 进行接口验收，staging/prod 仍要求 Temporal 连接成功；因此本地验证不能替代长任务、HITL signal 与 outbox→Temporal 生产演练。

## 2. 用户旅程

| 场景 | 用户动作 | 系统结果 |
|---|---|---|
| 新增节点 | 从节点库拖入画布 | 创建带标题和默认 schema 的节点 |
| 配置节点 | 选中节点，在 NodeInspector 编辑字段 | 按节点类型显示可编辑字段和校验结果 |
| 连接节点 | 在画布创建边 | 连接遵守端口/节点类型约束 |
| 删除节点 | 删除选中节点 | 节点及全部关联线同步移除，不留下悬挂边 |
| 全屏编辑 | 通过原生全屏入口进入 | 节点库、画布、Inspector 与关键操作均可稳定使用 |

## 3. 功能要求

1. 节点 schema 与 Inspector 字段由节点类型动态决定；未知或不兼容类型显示明确错误，不渲染误导性的通用表单。
2. 拖放、选中、编辑、连接和删除应在同一编辑状态中即时一致；删除节点必须原子清理关联线。
3. 全屏入口必须是稳定的原生 button 路径，避免依赖 React 19 根事件委托的偶发 click 行为。
4. 页面在读取/保存失败时展示可行动错误，不得以 localStorage 或演示数据冒充已持久化工作流。
5. 编辑器仅生成和编辑稳定 Plan JSON；Temporal 内部对象、worker 实现和运行时凭据不得暴露给前端。

## 4. 数据、权限与审计

Plan 定义包含节点、边、节点类型、schema 值和版本信息。保存、发布、运行和删除等副作用动作必须由后端进行 tenant/角色授权、版本冲突检查和审计；浏览器只维护短暂编辑状态。

审计至少关联 plan ID、版本、操作者、tenant、变更摘要、trace/correlation ID。运行请求与 Action proposal 的幂等、确认与 Outbox 规则仍按工作流/Action 公共契约执行。

## 5. 验收标准

代码级验收覆盖动态 Inspector、拖放节点标题、删除节点时清理边、全屏入口和主要键盘/鼠标路径。Playwright 必须在生产构建产物与 Docker 全栈中稳定通过，不能依赖已有开发服务器或任意等待时间。

当前代码级验证覆盖版本化 Plan 存储、发布校验、发布 revision 执行、跨租户隐藏、网关路由，以及前端 typecheck/build。`scripts/ci/prd08_action_orchestration_smoke.ps1` 可使用真实、带 tenant claim 的 OIDC token 验证 Gateway→WFE 的保存、发布、运行与回读。

本地 Docker 已验证 Keycloak、WFE 与 Gateway 健康，且未认证请求被拒绝；tenant-bound service token 已完成保存、发布、运行和状态回读。Playwright 已覆盖该用户旅程的刷新持久化，以及两个标签页的陈旧保存冲突与重新加载恢复。服务重启后的 production Temporal 持久运行、Outbox 事务证据和 staging/prod 发布演练仍是正式 GA 前置条件，状态保持 `[~]`。

## 6. 产品评审项

需要确认初版允许的节点类型集合、未保存变更离开提示、发布前校验级别以及多人同时编辑策略。默认策略是单用户编辑、离开前提示、发布前阻断结构错误、运行中计划不可由浏览器直接改写。
