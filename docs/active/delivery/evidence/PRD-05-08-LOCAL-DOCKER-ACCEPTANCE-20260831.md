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
- PRD-05：Semantic Router/dispatcher/授权路由测试 `105 passed`。
- PRD-06：Ontology preview 测试 `13 passed`；通过 Gateway 和 OIDC 完成
  `pending → preview → confirmed → executed` 的真实 PostgreSQL proposal 生命周期，
  并完成终态回读。
- PRD-07：通过 Gateway 和 OIDC 创建两个 ObjectType，预检命中候选，再完成
  `merge_suggestion` 的 `pending → confirmed → executed` 与终态回读。
- PRD-08：版本化 Plan/WFE 测试 `25 passed`；前端 typecheck 通过；Playwright
  保存、发布、运行、刷新持久化及两标签页版本冲突恢复 `2 passed`。
- Orchestrator 旧表兼容测试和授权角色测试 `13 passed`；本地 PostgreSQL 已实测自动
  补齐 `orchestrator_roles.allowed_actor_roles`，Orchestrator 与 Gateway 均恢复健康。

## 仍未闭环

- PRD-05 的两个真实 OpenAI-compatible provider、配额/熔断/故障切换和 staging SSE
  断线恢复。
- PRD-06/07 的生产 PostgreSQL/RLS 角色、并发/补偿/回滚与真实 embedding 性能证据。
- PRD-08 的生产构建静态站点 Playwright、Temporal 持久运行、Outbox 事务和
  staging/prod 发布演练。

## 结论

本记录证明 Sprint 0 中 PRD-05 至 PRD-08 的本地实现、租户边界和主要系统旅程可运行；
上述真实环境门禁未完成前，四项均保持 `[~]`，不得作为 v1.0 GA 发布证据。
