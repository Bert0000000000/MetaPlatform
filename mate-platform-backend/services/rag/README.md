# services/rag

> **状态（GOVERN-07 治理收口，2026-08-07）**：历史目录占位。

`mate-tech-rag` 现由 `mate-platform-backend/packages/mate-tech-rag/` 提供；
Docker 镜像 compose 服务名仍为 `mate-tech-rag`，由 api-gateway ROUTE_MAP
`/api/v1/rag/*` 透传。本目录仅作为早期 monorepo 探索期的占位，未挂任何代码。

维护策略：

- 不在本目录新增 Python 包；
- 未来 GOVERN-07 完成清理后可整体 `git rm`。
