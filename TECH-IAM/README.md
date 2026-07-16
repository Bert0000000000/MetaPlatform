# TECH-IAM - 身份认证与权限服务

## 模块类型

TECH 模块

## 作用

统一身份认证、SSO、RBAC/ABAC 权限管理、审计日志，为所有 APP 和 TECH 服务提供安全基座。

## 上游依赖

- 无

## 下游消费

- `所有 APP 模块`
- `所有 TECH 模块`

## 目录结构

```
TECH-IAM/
├── README.md              # 本文件
├── src/                   # 源码目录
├── tests/                 # 测试目录
├── docs/                  # 模块内部文档
├── config/                # 配置文件
├── scripts/               # 脚本文件
└── docker/                # 容器化配置
```

## 快速开始

TODO: 补充模块的快速开始指南

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)

## 已交付 API 列表

> 路径前缀：`/api/v1/iam`，统一响应：`ApiResponse<T>`，统一错误码：`ErrorCode`，traceId 透传 `X-Trace-Id`。

### Phase 1：用户与认证核心（M1，Sprint 1）

| 方法 | 路径 | 说明 | 是否鉴权 |
|---|---|---|---|
| POST | `/auth/register` | 用户注册 | 否 |
| POST | `/auth/login` | 用户登录，返回 JWT | 否 |

详细规范参见 [`docs/SPEC-TECH-IAM-身份认证API规范_v1.0-20260716.md`](docs/SPEC-TECH-IAM-身份认证API规范_v1.0-20260716.md) §3.5。

### Phase 2：组织架构与角色（M2，Sprint 2）

#### 部门管理（SPEC §3.2）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/departments` | 创建部门 |
| GET | `/departments` | 分页查询部门列表（支持 `parentId` 过滤、`keyword` 模糊匹配） |
| GET | `/departments/tree` | 查询部门层级树（支持 `rootId`/`maxDepth`） |
| GET | `/departments/{deptId}` | 查询部门详情 |
| PUT | `/departments/{deptId}` | 更新部门（乐观锁 `version` 必填） |
| DELETE | `/departments/{deptId}` | 删除部门（软删除，禁止删除根/有子部门） |

#### 用户-部门关联（SPEC §3.2.11 简化版）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/users/{userId}/departments` | 将用户绑定到部门（`{departmentId, isPrimary}`） |
| GET | `/users/{userId}/departments` | 查询用户所属部门列表 |

#### 角色管理（SPEC §3.3）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/roles` | 创建角色 |
| GET | `/roles` | 分页查询角色列表 |
| GET | `/roles/{roleId}` | 查询角色详情 |
| PUT | `/roles/{roleId}` | 更新角色（乐观锁） |
| DELETE | `/roles/{roleId}` | 删除角色（软删除；SYSTEM 角色不可删） |
| POST | `/roles/{roleId}/permissions` | 为角色分配权限（`{permissionIds, replaceMode}`） |
| GET | `/roles/{roleId}/permissions` | 查询角色已分配的权限列表 |

#### 权限定义（SPEC §3.4.1-3.4.5）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/permissions` | 创建权限定义 |
| GET | `/permissions` | 分页查询权限定义列表 |
| GET | `/permissions/{permissionId}` | 查询权限详情 |
| PUT | `/permissions/{permissionId}` | 更新权限定义（乐观锁） |
| DELETE | `/permissions/{permissionId}?force=...` | 删除权限定义（`force=true` 强制解除关联） |

#### 当前用户信息（SPEC §3.5 扩展）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/auth/me` | 解析 JWT 中的 userId，返回当前用户信息（含 roles、departments） |

### Phase 2 数据模型（Flyway V3）

| 表名 | 说明 |
|---|---|
| `iam_department` | 部门表（含层级 path/level，复合唯一 `(tenant_id, dept_code)`） |
| `iam_user_department` | 用户-部门关联（复合唯一 `(tenant_id, user_id, department_id)`） |
| `iam_role` | 角色表（含 `role_type` SYSTEM/CUSTOM、`data_scope` 枚举，复合唯一 `(tenant_id, role_code)`） |
| `iam_permission` | 权限定义表（`actions` JSON 文本、`effect` ALLOW/DENY，复合唯一 `(tenant_id, permission_code)`） |
| `iam_role_permission` | 角色-权限关联（复合唯一 `(tenant_id, role_id, permission_id)`） |

所有外键 `ON DELETE RESTRICT`，所有审计字段（`tenant_id`、`deleted`、`created_at`、`updated_at`、`created_by`、`updated_by`）。

### 通用约束

- **租户隔离**：所有业务表 `tenant_id NOT NULL`，缺省值 `tenant-default` 在 Service 层强制注入
- **统一异常处理**：`IamException` + `ErrorCode` → `GlobalExceptionHandler` 输出 `ApiResponse`
- **白名单**：`/auth/register`、`/auth/login`、`/auth/refresh`、`/auth/captcha`、`/health/**`、`/actuator/health`、`/actuator/info`、`/error`；其余均需 JWT
- **审计字段**：所有实体继承 `AuditEntity`（`@MappedSuperclass` + `@SuperBuilder`）

### 测试

- **Phase 2 测试套件**：10 个测试类，41 个测试用例（mvn clean test 全量通过）
  - `DepartmentServiceTest` (6) / `RoleServiceTest` (7) / `PermissionServiceTest` (5)：Mockito 单元测试，覆盖 CRUD、版本冲突、引用校验、枚举校验、循环引用防护
  - `DepartmentControllerTest` (3) / `RoleControllerTest` (3) / `PermissionControllerTest` (3) / `CurrentUserControllerTest` (2)：@WebMvcTest 控制器测试，覆盖正常路径与必填参数校验
  - Phase 1 测试保持：`AuthServiceTest` (7) / `AuthControllerTest` (2) / `JwtUtilTest` (3)