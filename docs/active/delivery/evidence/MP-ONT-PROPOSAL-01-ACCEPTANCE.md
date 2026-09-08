# MP-ONT-PROPOSAL-01 验收记录

> 状态：`[~] 条件验收记录`（不是 v1.0 GA Accepted）
> 代码基线：`3f9b0238`
> 记录日期：2026-08-27

## 范围

本批覆盖 Ontology Agent 的 LLM 结构化提议、staging preview、MCP 写工具
以及人工确认边界：proposal → preview → confirm/execute。确认前不得写入业务事实。

## 已验证

- Kernel 测试分片：`536 passed`。
- Ontology 测试分片：`172 passed`，另有 `48 skipped`；跳过项均要求本机
  PostgreSQL/RLS 角色和数据库。
- MCP 完整测试分片退出码为 0，包含 Ontology write tools 和 streamable HTTP。
- 前端生产构建已通过，Ontology staging preview 与 confirm drawer 能完成 TypeScript/Vite 构建。

## 未闭环项

- 尚未在真实 LLM provider、真实 PostgreSQL/RLS 和 staging 集群执行完整链路。
- 尚未完成重启恢复、重复确认、版本冲突、越权和故障回滚的 staging 证据。

## 结论

代码和离线测试具备进入真实依赖验收的条件；在上述外部依赖证据补齐前，保持
Sprint 0 `[~]`，不得标记为 v1.0 GA Accepted。

## 2026-08-31 本地 Docker 验证补充

- Proposal preview 测试 `13 passed`；本地 Docker 通过真实 OIDC 和 Gateway 完成
  model_type 的 `pending → preview → confirmed → executed`，并从服务端回读终态。
- Ontology 服务在 PostgreSQL 重启后的 DDL 初始化已实测恢复；详细系统证据见
  `PRD-05-08-LOCAL-DOCKER-ACCEPTANCE-20260831.md`。
- 该验证使用本地开发 PostgreSQL，不构成生产 RLS、真实 provider 或 staging 证据，
  状态仍为 `[~]`。
