# 示例：IAM 权限列表接口

> 这是一份**符合模板**的示例任务，给 Cowork 参考如何写 inbox。
> Claude Code 不应实现本示例，仅供格式参照。

## 目标
在 mate-tech-iam 中新增 `GET /v1/iam/permissions` 接口，返回当前租户下可见的权限列表。

## 背景 / 上下文
- 架构铁律 #6：所有 API 必须在 `contracts/openapi/` 有契约
- 配套 spec：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md#W5-3`

## 涉及模块
- 后端：`mate-platform-backend/packages/mate-tech-iam`
- 前端：无
- 共享契约：`contracts/openapi/iam.yaml`
- 文档：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`（如需更新）

## 改动范围
- [ ] 新增文件 A：`mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/api/permissions.py` —— 路由实现
- [ ] 修改文件 B：`mate-platform-backend/packages/mate-tech-iam/src/mate_tech_iam/main.py` —— 注册 router
- [ ] 新增单测：`mate-platform-backend/packages/mate-tech-iam/tests/test_permissions_list.py`
- [ ] OpenAPI 同步：`contracts/openapi/iam.yaml` —— 追加路径定义

## 接口契约
```yaml
paths:
  /v1/iam/permissions:
    get:
      summary: 列出当前租户可见权限
      parameters:
        - in: query
          name: q
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/PermissionItem' }
```

## 验收标准
- [ ] `uv run pytest packages/mate-tech-iam -q` 全绿
- [ ] `uv run pyright packages/mate-tech-iam` 0 error
- [ ] 跑通 `start-iam.ps1`，访问 `GET /v1/iam/permissions` 返回 JSON
- [ ] 覆盖率 ≥ 80%

## 风险 / 前置依赖
- 依赖 Keycloak realm 中的 `mate-platform` client 已开启 introspection（已对齐 Owner）

## 不在本次范围
- 权限的增删改（只做查）
- 前端 UI 改造

## 关联
- 关联 spec：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md#W5-3`
- 关联任务：无
