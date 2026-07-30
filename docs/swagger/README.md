# Mate Platform API 文档

本仓库唯一契约源位于 `mate-platform-backend/contracts/openapi/`。

- Swagger UI：`http://localhost:8200/docs/swagger/index.html`
- Redoc：`http://localhost:8200/docs/swagger/redoc.html`
- 聚合契约：`mate-platform-backend/contracts/openapi/generated/bundled.yaml`
- Prism（Mock）：`http://localhost:4010`，启用 local/docs profile

工作流覆盖 PRD Requirement → OpenAPI → 契约校验 → Mock/SDK → 实现 → Runtime Diff → E2E；统一消费 bundled.yaml。