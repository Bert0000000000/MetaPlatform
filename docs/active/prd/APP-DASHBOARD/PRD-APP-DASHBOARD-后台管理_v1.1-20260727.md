# PRD - APP-DASHBOARD-后台管理

> **版本**: v1.1 | **日期**: 2026-07-27
>
> **vv1.0 → vv1.1 主要变更**：
> 1. 与主 PRD 同步更新
> 2. API 接口按 Q2=B 归属 TECH-IAM
> 3. 新增「待补交互清单」
> 4. 关联文档：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`

---


> **版本**: v1.0 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md`](./PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-DASHBOARD 的**子文件**，专门描述后台管理（用户/权限/组织/日志/系统配置/运营监控）相关功能（FR-DASH-006-01~06）。

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
| 运营监控 | `metaplatform-design-draft/pages/admin-operations.html` |

---

## 2. 功能列表（FR-DASH-006）

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-006-01 | 用户管理 | P0 | 用户 CRUD、状态启用/禁用、密码重置、批量导入（CSV）、登录日志 |
| FR-DASH-006-02 | 权限管理 | P0 | 角色 CRUD、用户-角色绑定、权限矩阵配置 |
| FR-DASH-006-03 | 组织管理 | P1 | 组织树维护、岗位管理、汇报关系、人员调岗 |
| FR-DASH-006-04 | 日志管理 | P1 | 审计日志查询（按用户/模块/时间/操作类型）、导出 CSV/Excel、详情查看 |
| FR-DASH-006-05 | 系统配置 | P1 | 平台级配置项（SSO、LICENSE、消息渠道、限流阈值等）维护 |
| FR-DASH-006-06 | 运营监控 | P2 | 系统运行状态大盘、容量监控、告警列表 |

---

## 3. 用户管理（FR-DASH-006-01）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/users` |
| 功能 | 用户 CRUD、状态启用/禁用、密码重置、批量导入（CSV）、登录日志 |
| 数据 | 来自 TECH-IAM `/api/v1/admin/users` |

**典型操作**：

| 操作 | 权限要求 |
|------|---------|
| 查看用户列表 | `PLATFORM_ADMIN_VIEWER` |
| 新建用户 | `PLATFORM_ADMIN` |
| 编辑用户 | `PLATFORM_ADMIN` |
| 删除用户 | `PLATFORM_SUPER_ADMIN` |
| 重置密码 | `PLATFORM_ADMIN` |
| 启用/禁用用户 | `PLATFORM_ADMIN` |
| 批量导入 | `PLATFORM_ADMIN` |

---

## 4. 权限管理（FR-DASH-006-02）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/permissions` |
| 功能 | 角色 CRUD、用户-角色绑定、权限矩阵配置 |
| 数据 | 来自 TECH-IAM `/api/v1/admin/permissions/roles`、`/api/v1/admin/permissions/assign` |

**典型操作**：

| 操作 | 权限要求 |
|------|---------|
| 查看角色 | `PLATFORM_ADMIN_VIEWER` |
| 创建角色 | `PLATFORM_ADMIN` |
| 删除角色 | `PLATFORM_SUPER_ADMIN` |
| 分配权限 | `PLATFORM_ADMIN` |
| 分配角色给用户 | `PLATFORM_ADMIN` |

---

## 5. 组织管理（FR-DASH-006-03）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/orgs` |
| 功能 | 组织树维护、岗位管理、汇报关系、人员调岗 |
| 数据 | 来自 TECH-IAM `/api/v1/admin/orgs` |

---

## 6. 日志管理（FR-DASH-006-04）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/logs` |
| 功能 | 审计日志查询（按用户/模块/时间/操作类型）、导出 CSV/Excel、详情查看 |
| 数据 | 来自 TECH-OBS `/api/v1/admin/logs/audit`、`/api/v1/admin/logs/audit/export` |

---

## 7. 系统配置（FR-DASH-006-05）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/configs` |
| 功能 | 平台级配置项（SSO、LICENSE、消息渠道、限流阈值等）维护 |
| 数据 | 来自 Nacos Config 中心 |
| 权限 | 仅限 `ROLE_PLATFORM_ADMIN` |

---

## 8. 运营监控（FR-DASH-006-06）

| 维度 | 描述 |
|------|------|
| 路径 | `/admin/operations` |
| 功能 | 系统运行状态大盘、容量监控、告警列表 |
| 数据 | 来自 TECH-OBS Prometheus 指标 |

---

## 9. API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/admin/users` | 用户列表 |
| POST | `/api/v1/admin/users` | 创建用户 |
| PUT | `/api/v1/admin/users/{id}` | 更新用户 |
| DELETE | `/api/v1/admin/users/{id}` | 删除用户 |
| POST | `/api/v1/admin/users/{id}/reset-password` | 重置密码 |
| GET | `/api/v1/admin/permissions/roles` | 角色列表 |
| POST | `/api/v1/admin/permissions/roles` | 创建角色 |
| POST | `/api/v1/admin/permissions/assign` | 分配权限 |
| GET | `/api/v1/admin/orgs` | 组织树 |
| PUT | `/api/v1/admin/orgs/{id}` | 更新组织 |
| GET | `/api/v1/admin/logs/audit` | 审计日志 |
| GET | `/api/v1/admin/logs/audit/export` | 导出审计日志 |
| GET | `/api/v1/admin/configs` | 系统配置项 |
| PUT | `/api/v1/admin/configs/{key}` | 更新配置项 |

---

## 10. 安全要求

- 后台管理接口仅限平台管理员角色（`ROLE_PLATFORM_ADMIN`）
- 审计日志完整记录管理操作（不可篡改）
- 敏感操作（删除用户、删除角色）需要二次确认
- 所有 API 经 TECH-IAM OAuth2 网关鉴权

---

## 11. 设计基线

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa` |
| 字体 | Geist |
| 形状 | `--radius:8px`，1px 边框，零阴影 |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge-*` |

---

**PRD 版本**: v1.0（子文件）
**PRD 日期**: 2026-07-22
**关联主 PRD**: [`PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md`](./PRD-APP-DASHBOARD-仪表盘_v2.2-20260722.md)

---

## 附录：vv1.0 → vv1.1 增量更新说明

> **更新日期**: 2026-07-27
> **归属后端服务**: TECH-IAM

### 一、主要变更

1. 范围对齐主 PRD 同步
2. API 接口按 Q2=B 决策归属 **TECH-IAM**
3. 新增「待补交互清单」章节
4. 数据模型与前端类型同步

### 二、待补交互清单

见主 PRD 的「待补交互清单」章节，本子 PRD 的所有交互均继承主 PRD 的标记。

### 三、API 接口概要

本子 PRD 的所有端点归属 **TECH-IAM**，完整端点列表见：
- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x

### 四、关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md`
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md`
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
