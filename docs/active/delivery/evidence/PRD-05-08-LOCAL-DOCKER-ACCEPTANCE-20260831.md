# PRD-05 至 PRD-08 本地 Docker 条件验收记录

> 状态：`[~] 本地条件验收`（不是 v1.0 GA Accepted）
> 记录日期：2026-08-31
> 范围：当前 `codex/prd-05-08-sprint-0` 工作树的本地 Docker 环境

## 已验证

- Task5 启动器按 PostgreSQL → Ontology → Orchestrator → Gateway 的依赖顺序
  重建当前源码挂载服务；完整 `scripts/task5-verify.sh` 通过。
- Keycloak 使用 PostgreSQL；人类登录令牌和 `client_credentials` 服务令牌均带有
  经过验证的 `tenant-default` 声明。旧的固定租户 client mapper 在启动迁移中删除，
  服务账号通过自己的用户属性获得租户声明。
- PRD-05：Semantic Router/dispatcher/授权路由测试 `105 passed`。Task5 compose 明确
  仅为本地验收配置 `PLATFORM_ADMIN` 默认授权与旧内置角色空授权回填；Gateway→Copilot→
  Orchestrator 的真实 SSE 验收 `2 passed`，其中正式 `/superai/chat` 在开启“Agent 调度”后
  发送订单查询，可展示并展开本轮 `routing_decision` 的候选与最终选择。
- PRD-06：Ontology preview 测试 `13 passed`；通过 Gateway 和 OIDC 完成
  `pending → preview → confirmed → executed` 的真实 PostgreSQL proposal 生命周期；重建
  `mate-tech-ont` 后仍可通过 Gateway 回读 proposal 的 `executed` 终态和 OIDC actor。
- PRD-07：通过 Gateway 和 OIDC 创建两个 ObjectType，预检命中候选，再完成
  `merge_suggestion` 的 `pending → confirmed → executed`；重建 `mate-tech-ont` 后仍可回读
  `executed` 终态、OIDC actor，并由 PostgreSQL 确认 source archived、target active。
- PRD-08：版本化 Plan/WFE 测试 `25 passed`；前端生产构建
  `pnpm --filter @mate/web build` 通过；生产静态预览（独立 `vite preview` 端口）
  的 Playwright 覆盖保存、发布、运行、刷新持久化及两标签页版本冲突恢复，`2 passed`。
- Orchestrator 旧表兼容测试和授权角色测试 `18 passed`；本地 PostgreSQL 已实测自动
  补齐 `orchestrator_roles.allowed_actor_roles`，Orchestrator 与 Gateway 均恢复健康。

## 仍未闭环

- PRD-05 的两个真实 OpenAI-compatible provider、配额/熔断/故障切换和 staging SSE
  断线恢复。
- PRD-06/07 的生产 PostgreSQL/RLS 角色、并发/补偿/回滚与真实 embedding 性能证据。
- PRD-08 的 Temporal 持久运行、Outbox 事务和 staging/prod 发布演练。
- 正式 SuperAI 页仍有一条 React 19 development-only 的“列表缺少 key”告警。已隔离确认它
  不由本批次的路由面板、初始消息或引用数据引入；作为 UI 依赖/平台框架的 P2 质量债单列，
  不影响本地路由功能验收，也不得标注为零告警验收。

## 结论

本记录证明 Sprint 0 中 PRD-05 至 PRD-08 的本地实现、租户边界和主要系统旅程可运行；
上述真实环境门禁和已列 UI 质量债未完成前，四项均保持 `[~]`，不得作为 v1.0 GA 发布证据。
