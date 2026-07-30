# TASK-YYYYMMDD-NNN-<slug>

> 给 Cowork 用的方案模板。每一节都必填，缺一项退回重写。
> 文件名示例：`TASK-20260729-001-iam-permission-list-api.md`

## 目标
（一句话讲清楚要做什么，解决什么问题）

## 背景 / 上下文
（2-5 行：为什么做、卡在哪、关联到哪个架构章节或 spec 文件路径）

## 涉及模块
- 后端：`mate-platform-backend/packages/<pkg>/<path>`（写到包级或更深）
- 前端：`metaplatform-frontend/apps/<app>` 或 `packages/shared`
- 共享契约：`contracts/openapi/<file>.yaml`（如涉及 API 变更）
- 文档：`docs/active/specs/<file>.md`（如需同步）

## 改动范围
- [ ] 新增文件 A：`path/to/A.py` —— 作用
- [ ] 修改文件 B：`path/to/B.ts:行号范围` —— 改什么
- [ ] 删除文件 C：`path/to/C.py` —— 为什么删
- [ ] 数据库迁移：`alembic/versions/xxxx.py` —— 变更说明
- [ ] OpenAPI 同步：`contracts/openapi/<file>.yaml` —— diff 摘要

## 接口契约（如有 API 变更）
```yaml
# 路径/方法/参数/返回；可直接给 OpenAPI 片段
paths:
  /v1/iam/permissions:
    get:
      summary: 列出权限
      parameters: [...]
      responses:
        '200':
          content:
            application/json:
              schema: { ... }
```

```ts
// 前端类型片段
export interface PermissionItem {
  id: string;
  code: string;
  name: string;
}
```

## 数据模型变更（如有）
- 表 `iam.permission`：新增字段 `scope VARCHAR(32) NOT NULL DEFAULT 'tenant'`
- 索引：`(tenant_id, code)` UNIQUE
- 回滚：`DROP COLUMN scope`

## 验收标准（必须可勾选）
- [ ] `uv run pytest <path> -q` 全绿
- [ ] `uv run pyright packages/<pkg>` 0 error
- [ ] `pnpm -F <app> typecheck` 通过（如涉及前端）
- [ ] `pnpm -F <app> lint` 通过
- [ ] 跑通 `start-dev.ps1` 或对应服务的启动脚本
- [ ] 手动验证：<具体操作步骤>
- [ ] 文档同步：CLAUDE.md / 主架构 / 交付计划（如涉及）
- [ ] 覆盖率 ≥ 80%（如新增业务代码）

## 风险 / 前置依赖
- 依赖 mate-tech-iam 先合入 #PR-NNN
- 需要 Keycloak realm 改造，已与 Owner 对齐
- 影响线上接口，需走灰度发布

## 不在本次范围
- 明确写出**不做**的事，避免 scope creep

## 关联
- 关联 spec：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md#§X`
- 关联任务：TASK-YYYYMMDD-NNN-<pre>（如有前置）
- 关联 issue / PR：#NNN
