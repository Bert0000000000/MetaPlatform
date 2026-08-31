# MP-SR-01 验收记录

> 状态：`[~] 条件验收记录`（不是 v1.0 GA Accepted）
> 代码基线：`038f92e1`
> 记录日期：2026-08-27

## 范围

本批覆盖 Semantic Router、候选角色 top-k、LLM function-call 路由、A2A →
kernel role → embedding → keyword 的 dispatcher 链路，以及
`routing_decision` SSE 和 SuperAI 页面展示。

## 已验证

- Copilot 测试分片：`189 passed`，包含 routing、dispatcher、租户和 adversarial 用例。
- 前端 `pnpm --filter @mate/web build` 已通过。
- 生产 fallback 静态门禁已通过；生产镜像不得使用 memory/echo/demo 静默回退。

## 未闭环项

- 尚未用两个独立真实 LLM-compatible provider 验证路由、配额、熔断和故障切换。
- 尚未在真实 staging 执行 SSE 断线恢复、跨租户路由拒绝和端到端业务结果核对。

## 结论

离线行为与前端构建通过，进入真实 provider/staging 验收队列；在外部依赖证据
补齐前保持 `[~]`。

## 2026-08-31 本地验证补充

- 当前 Sprint 0 工作树的 Semantic Router、dispatcher、授权快照与流式路由测试
  `105 passed`。
- 本地 Task5 Docker 验收验证 OIDC 人类/服务令牌的 tenant claim、Copilot 与 Gateway
  健康；完整细节见 `PRD-05-08-LOCAL-DOCKER-ACCEPTANCE-20260831.md`。
- 本补充不替代两个真实 provider、熔断/配额和 staging SSE 验收，状态仍为 `[~]`。
