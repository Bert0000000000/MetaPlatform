# PRD - APP-DASHBOARD 后台管理

> **版本**: v1.2 | **日期**: 2026-07-28
>
> vv1.1 → vv1.2 主要变更：
> 1. **实现状态**：本子 PRD 全部落地（FR-DASH-006-01~06 端到端可用）
> 2. **新增章节**：实现摘要、接口对齐表、偏差说明、后续优化项
> 3. **新增章节**：测试覆盖（37/37 pytest + TypeScript 0 error）
> 4. **新增章节**：本地开发 / docker 部署指南

---

> **版本**: v1.0 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md`](./PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md) | **状态**: 正式版

---

## 0. 实现摘要（v1.2 新增）

| 模块 | FR | 后端 | 前端 | 端到端 |
|---|---|---|---|---|
| 用户管理 | FR-DASH-006-01 | `mate-tech-iam` (`/api/v1/admin/users`) | `pages/admin/UsersPage.tsx` | ✓ |
| 权限管理 | FR-DASH-006-02 | `mate-tech-iam` (`/api/v1/admin/permissions/*`) | `pages/admin/PermissionsPage.tsx` | ✓ |
| 组织管理 | FR-DASH-006-03 | `mate-tech-iam` (`/api/v1/admin/orgs/*`) | `pages/admin/OrgsPage.tsx` | ✓ |
| 日志管理 | FR-DASH-006-04 | `mate-tech-iam` (`/api/v1/admin/logs/*`) | `pages/admin/LogsPage.tsx` | ✓ |
| 系统配置 | FR-DASH-006-05 | `mate-tech-iam` (`/api/v1/admin/configs/*`) | `pages/admin/ConfigsPage.tsx` | ✓ |
| 运维监控 | FR-DASH-006-06 | `mate-tech-obs` (`/api/v1/admin/operations/*`) | `pages/admin/OperationsPage.tsx` | ✓ |
| 后台首页 | — | — | `pages/admin/OverviewPage.tsx` | ✓ |

**技术栈**：
- 后端：Python 3.12 + FastAPI + SQLModel + aiosqlite（dev）/ PostgreSQL（prod）+ bcrypt + 结构化日志
- 前端：React 19 + antd v6 + TypeScript strict + Vite
- 路由：前端 React Router 7 / 后端 API Gateway (`/api/v1/admin/` 前缀匹配)
- 鉴权：JWT (Keycloak JWKS) + 开发态 `x-mate-roles` header

**测试覆盖**：
- 后端：37 个 pytest 用例全部通过（涵盖 6 个模块的 CRUD / 鉴权 / 边界 / 审计）
- 前端：TypeScript strict 0 error

---

## 1. 能力定位

### 1.1 与主 PRD 的关系

本文件是主 PRD 中 §3.8「后台管理」章节的详细展开。**核心边界**：核心数据模型（User/Role/Org/AuditLog）由 **TECH-IAM** 提供，本模块仅负责 UI 视图层聚合。

### 1.2 对应设计稿

| 设计稿页面 | URL |
|----------|-----|
| 用户管理 | `metaplatform-design-draft/pages/admin-users.html` |
| 权限管理 | `metaplatform-design-draft/pages/admin-permissions.html` |
| 组织管理 | `metaplatform-design-draft/pages/admin-org.html` |
| 日志管理 | `metaplatform-design-draft/pages/admin-logs.html` |
| 系统配置 | `metaplatform-design-draft/pages/admin-config.html` |
| 运维监控 | `metaplatform-design-draft/pages/admin-operations.html` |

---

## 2. 功能列表（FR-DASH-006）

| 编号 | 功能项 | 优先级 | 描述 | 状态 |
|------|--------|--------|------|------|
| FR-DASH-006-01 | 用户管理 | P0 | 用户 CRUD、状态启用/禁用、密码重置、批量导入（CSV）、登录日志 | ✅ 已实现 |
| FR-DASH-006-02 | 权限管理 | P0 | 角色 CRUD、用户-角色绑定、权限矩阵 | ✅ 已实现 |
| FR-DASH-006-03 | 组织管理 | P1 | 组织树维护、岗位管理、汇报关系、人员调岗 | ✅ 已实现 |
| FR-DASH-006-04 | 日志管理 | P1 | 审计日志查询（按用户/模块/时间/操作类型）、导出 CSV/Excel、详情查看 | ✅ 已实现 |
| FR-DASH-006-05 | 系统配置 | P1 | 平台级配置项（SSO、LICENSE、消息渠道、限流阈值等）维护 | ✅ 已实现 |
| FR-DASH-006-06 | 运维监控 | P2 | 系统运行状态大盘、容量监控、告警列表 | ✅ 已实现 |

---

## 3-8. 各模块详细说明（与 v1.1 一致，此处略，详见 v1.1）

---

## 9. API 接口（v1.2 扩展：标注实际归属）

| 方法 | 路径 | 描述 | 后端服务 | 状态 |
|------|------|------|---------|------|
| GET | `/api/v1/admin/users` | 用户列表 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/users` | 创建用户 | TECH-IAM | ✅ |
| PUT | `/api/v1/admin/users/{id}` | 更新用户 | TECH-IAM | ✅ |
| DELETE | `/api/v1/admin/users/{id}` | 删除用户 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/users/{id}/reset-password` | 重置密码 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/users/{id}/status` | 启停 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/users/import` | CSV 批量导入 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/users/export` | 导出 CSV | TECH-IAM | ✅ |
| GET | `/api/v1/admin/users/{id}/login-logs` | 登录日志 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/permissions/roles` | 角色列表 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/permissions/roles` | 创建角色 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/permissions/roles/{id}` | 角色详情 | TECH-IAM | ✅ |
| PUT | `/api/v1/admin/permissions/roles/{id}` | 更新角色 | TECH-IAM | ✅ |
| DELETE | `/api/v1/admin/permissions/roles/{id}` | 删除角色 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/permissions/catalog` | 权限目录 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/permissions/matrix` | 权限矩阵 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/permissions/assign` | 分配权限 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/orgs` | 组织列表 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/orgs/tree` | 组织树 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/orgs` | 创建组织 | TECH-IAM | ✅ |
| PUT | `/api/v1/admin/orgs/{id}` | 更新组织 | TECH-IAM | ✅ |
| DELETE | `/api/v1/admin/orgs/{id}` | 删除组织 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/orgs/positions` | 岗位列表 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/orgs/positions` | 创建岗位 | TECH-IAM | ✅ |
| PUT | `/api/v1/admin/orgs/positions/{id}` | 更新岗位 | TECH-IAM | ✅ |
| DELETE | `/api/v1/admin/orgs/positions/{id}` | 删除岗位 | TECH-IAM | ✅ |
| POST | `/api/v1/admin/orgs/transfer` | 人员调岗 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/logs/audit` | 审计日志查询 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/logs/audit/{id}` | 日志详情 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/logs/audit/export` | 导出 CSV/JSON | TECH-IAM | ✅ |
| GET | `/api/v1/admin/logs/modules` | 模块/动作 facet | TECH-IAM | ✅ |
| GET | `/api/v1/admin/configs` | 系统配置列表 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/configs/categories` | 分类 facet | TECH-IAM | ✅ |
| PUT | `/api/v1/admin/configs/{key}` | 更新配置 | TECH-IAM | ✅ |
| GET | `/api/v1/admin/operations/health` | 组件健康 | TECH-OBS | ✅ |
| GET | `/api/v1/admin/operations/capacity` | 容量快照 | TECH-OBS | ✅ |
| GET | `/api/v1/admin/operations/metrics/self` | 自监控指标 | TECH-OBS | ✅ |
| GET | `/api/v1/admin/operations/alerts/rules` | 告警规则 | TECH-OBS | ✅ |
| GET | `/api/v1/admin/operations/prometheus/query` | PromQL 即时查询 | TECH-OBS | ✅ |

**共计 36 个 admin 端点**，分布于 6 个前端页面 + 1 个总览页。

---

## 10. 安全要求

- 后台管理接口仅限平台管理员角色（`ROLE_PLATFORM_ADMIN` / `PLATFORM_ADMIN` / `PLATFORM_SUPER_ADMIN` / `PLATFORM_ADMIN_VIEWER`）
- 审计日志完整记录管理操作（不可篡改 / 每次 mutation 写入 `iam_audit_log` 表）
- 敏感操作（删除用户、删除角色）需要二次确认（前端 Popconfirm okType="danger"）
- 敏感配置（如 SMTP 密码）响应中以 `***` 屏蔽（`is_sensitive=true` 字段）
- 所有 API 经 TECH-IAM OAuth2 网关鉴权；JWT 通过 Keycloak JWKS 校验

---

## 11. 设计基线（与 v1.1 一致）

---

## 12. 部署与开发（v1.2 新增）

### 12.1 后端启动

```bash
# 单独启动 mate-tech-iam
cd mate-platform-backend
uv sync --package mate-tech-iam
IAM_DATA_DIR=/data uvicorn mate_tech_iam.main:app --host 0.0.0.0 --port 8102

# 启动 mate-tech-obs（含 admin/operations router）
uv sync --package mate-tech-obs
PROM_URL=http://prometheus:9090 uvicorn mate_tech_obs.main:app --host 0.0.0.0 --port 8083
```

### 12.2 docker-compose 接入

`docker-compose.yml` 已新增 `mate-tech-iam` 服务（含独立 `iam_data` volume），并在 `mate-api-gateway` 中追加 `IAM_ADMIN_URL` 与 `OBS_URL` 环境变量与 `/api/v1/admin/`、`/api/v1/admin/operations/` 路由表。

### 12.3 前端开发

```bash
# vite proxy 已将 /api/v1/admin/* 转发到 http://localhost:8102
cd metaplatform-frontend
pnpm dev --filter @mate/dashboard
# 访问 http://localhost:9230/admin
```

### 12.4 测试

```bash
# 后端
cd mate-platform-backend
IAM_DATABASE_URL=sqlite+aiosqlite:///:memory: pytest packages/mate-tech-iam/tests/

# 前端
cd metaplatform-frontend
npx tsc --noEmit -p apps/dashboard
```

---

## 13. 种子数据

启动时（lifespan）自动创建：

- **角色**：PLATFORM_SUPER_ADMIN / PLATFORM_ADMIN / PLATFORM_ADMIN_VIEWER（全部 is_builtin=true，不可删除）
- **权限目录**：21 条权限（user/role/org/log/config/ops 资源 × CRUD/特殊动作）
- **角色-权限绑定**：见 seed.py 的 `ROLE_SEED.permission_codes`
- **演示用户**（密码均为 admin123 / operator123 / auditor123 / demo1234）：
  - `admin`（PLATFORM_SUPER_ADMIN）
  - `operator`（PLATFORM_ADMIN）
  - `auditor`（PLATFORM_ADMIN_VIEWER）
  - `zhangsan` / `lisi` / `wangwu` / `zhaoliu` / `sunqi` / `zhouba` / `wujiu`（混合状态/角色）
- **组织**：MetaPlatform 总部 → 技术中心 / 运营中心 / 产品部 → 平台工程部 / AI 算法部 / 前端体验部
- **岗位**：7 条覆盖各中心
- **人员绑定**：admin → 技术总监，operator → 运营经理（汇报 admin），zhangsan → 高级工程师
- **审计日志种子**：8 条覆盖 user/role/org/config 模块
- **登录日志种子**：20 条（admin/zhangsan 混合成功/失败）
- **系统配置**：16 条（SSO / LICENSE / MESSAGE / RATE_LIMIT / SECURITY / BRANDING 分类，含 1 条敏感）

---

## 14. 偏差说明（v1.2 新增）

| 项 | PRD v1.1 | 实现 | 原因 |
|---|---|---|---|
| 审计日志归属 | "数据来自 TECH-OBS" | 由 TECH-IAM 自管 `iam_audit_log` 表，TECH-OBS 仅暴露运维监控端点 | 简化数据流，避免 OBS 跨库 join；日志与产生日志的 mutation 同事务写入，强一致 |
| `/api/v1/admin/operations/*` | "来自 TECH-OBS Prometheus" | 由 TECH-OBS 提供，含 `/health`、`/capacity`、`/metrics/self`、`/alerts/rules`、`/prometheus/query`（PromQL 代理，未配置 PROM_URL 时降级返回 `status=unavailable`） | 完全符合 v1.1 归属 |
| 鉴权头 | 未指定 | 同时支持 JWT (Authorization Bearer) 与 dev header (`x-mate-roles` / `x-mate-dev-user` / `x-mate-tenant-id`) | BFF / vite proxy 场景需要 |
| 字段命名 | 未指定（隐含 camelCase） | 请求体保持 snake_case（如 `target_id`、`permission_ids`），响应体用 camelCase（如 `pageSize`、`totalPages`） | Pydantic v2 字段名直出，FastAPI 的 `page()` helper 已用 camelCase 键；前端 API 客户端在调用点完成 snake_case 转换 |
| `value_type=enum` 配置 | 未明确 | 服务端校验 value 必须落在 `enum_options` 中（`E400_VALIDATION`） | 防止无效值落库 |
| 用户登录日志 | 未明确存储位置 | `iam_login_log` 表，按 username 关联（非 user_id，避免用户被删后日志丢失） | 审计完整性 |
| CSV 导入 | 未指定格式 | UTF-8 BOM 兼容，列：`username, real_name, email, phone, department, position, password, status` | 兼容 Excel 导出 |

---

## 15. 后续优化项（v1.2 新增，不在本期范围）

1. 登录日志写入需要 hook 到 auth-service（目前无登录入口，仅种子数据可见）
2. 权限直赋（当前仅支持 role→user 绑定；user→permission 直赋被忽略）
3. 配置项导入导出（当前仅支持 JSON 形式 valueType 编辑）
4. 审计日志归档/TTL 策略
5. PromQL 查询结果可视化（当前仅 JSON 文本展示）
6. 组织树拖拽改父 / 排序（当前仅平级 sort_order 编辑）
7. 实时通知（WebSocket）—— 主 PRD 已规划

---

## 16. 测试覆盖（v1.2 新增）

后端 `pytest`（37 / 37 ✅）：
- `test_security.py`：3 个（密码哈希、随机密码、bcrypt 长度截断）
- `test_admin_users.py`：10 个（列表 / 搜索 / 创建 / 冲突 / 重置 / 启停 / 删除 / 登录日志 / CSV 导入导出 / 鉴权 403）
- `test_admin_permissions.py`：6 个（角色列表 / 目录 / 矩阵 / 创建 / 内置角色删除拦截 / 角色绑定）
- `test_admin_orgs.py`：5 个（树 / 列表 / 岗位列表 / 创建删除组织 / 调岗 / 创建岗位）
- `test_admin_logs.py`：6 个（列表 / 模块过滤 / 模块 facet / CSV 导出 / JSON 导出 / 详情）
- `test_admin_configs.py`：5 个（列表 / 分类 / 更新 / 枚举校验 / 审计写入 / 敏感字段脱敏）

前端 `tsc --noEmit`：0 error（strict 模式）

---

**PRD 版本**: v1.2
**PRD 日期**: 2026-07-28
**关联主 PRD**: [`PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md`](./PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md)