# PRD - APP-DASHBOARD 仪表盘

> **版本**: v1.0 | **日期**: 2026-07-16 | **模块**: APP-DASHBOARD | **状态**: 草案

---

## 1. 模块概述

### 1.1 模块定位

APP-DASHBOARD 是 Mate Platform 的全局统一入口和工作台，为用户提供个性化、可配置的数据看板、待办通知、快捷导航和个人中心能力。作为平台的"门面"，仪表盘聚合了来自各业务模块的关键信息，实现"一屏掌控全局"的运营体验。

### 1.2 核心价值

- **统一入口**：所有用户通过仪表盘进入平台，根据角色展示差异化内容
- **实时感知**：聚合关键业务指标、待办事项、系统通知，实时反映平台运行状态
- **个性化定制**：用户可自定义看板布局、快捷入口、关注指标
- **运营提效**：将高频操作前置，减少用户在多模块间的跳转成本

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| 平台管理员 | 监控平台整体运行状态、资源使用、用户活跃度 |
| 业务运营人员 | 查看业务指标趋势、处理待办事项、跟进任务进度 |
| 数字员工管理者 | 监控数字员工运行状态、对话质量评估 |
| 普通用户 | 个人工作台、快捷操作、通知查看 |

---

## 2. 功能需求列表

### 2.1 全局工作台 (FR-DASH-001)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-001-01 | 工作台首页 | P0 | 登录后默认页面，展示用户欢迎信息、今日概要、快捷入口 |
| FR-DASH-001-02 | 角色视图切换 | P0 | 根据用户角色（管理员/运营/开发者/普通用户）展示不同布局 |
| FR-DASH-001-03 | 布局自定义 | P1 | 用户可拖拽调整看板卡片位置、显示/隐藏卡片 |
| FR-DASH-001-04 | 多工作区 | P1 | 支持创建多个自定义工作区，快速切换不同场景视图 |
| FR-DASH-001-05 | 主题切换 | P2 | 暗色/亮色主题，支持自定义品牌色 |

### 2.2 指标看板 (FR-DASH-002)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-002-01 | 指标卡片 | P0 | 展示关键指标数值（如在线数字员工数、今日任务完成率、知识库问答数） |
| FR-DASH-002-02 | 趋势图表 | P0 | 折线图/柱状图展示指标趋势，支持日/周/月/季时间范围选择 |
| FR-DASH-002-03 | 指标配置 | P1 | 管理员可配置看板展示的指标项、数据源、刷新频率 |
| FR-DASH-002-04 | 实时数据流 | P1 | WebSocket 推送实时指标更新，无需手动刷新 |
| FR-DASH-002-05 | 指标下钻 | P2 | 点击指标卡片可下钻查看明细数据 |
| FR-DASH-002-06 | 指标告警 | P2 | 指标超阈值时在看板上高亮告警 |

### 2.3 待办通知 (FR-DASH-003)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-003-01 | 待办列表 | P0 | 展示当前用户的待办事项（审批待办、任务待办、工单待办） |
| FR-DASH-003-02 | 通知中心 | P0 | 系统通知、业务通知、消息提醒统一展示 |
| FR-DASH-003-03 | 待办处理 | P0 | 支持直接在待办中执行操作（审批通过/驳回、任务接受/拒绝） |
| FR-DASH-003-04 | 通知分类筛选 | P1 | 按通知类型、来源模块、已读/未读筛选 |
| FR-DASH-003-05 | 消息推送 | P1 | 支持浏览器桌面通知（Web Notification API） |
| FR-DASH-003-06 | 通知免打扰 | P2 | 设置免打扰时段、免打扰通知类型 |

### 2.4 快捷导航 (FR-DASH-004)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-004-01 | 全局搜索 | P0 | 搜索框支持搜索应用、流程、数字员工、知识文档等全平台资源 |
| FR-DASH-004-02 | 快捷入口 | P0 | 常用功能快捷入口卡片（创建应用、创建数字员工、新建流程等） |
| FR-DASH-004-03 | 最近访问 | P1 | 记录并展示用户最近访问的页面/资源 |
| FR-DASH-004-04 | 收藏夹 | P1 | 用户可收藏常用页面/资源，快速访问 |
| FR-DASH-004-05 | 命令面板 | P2 | Ctrl+K 唤起全局命令面板，支持快捷操作和搜索 |

### 2.5 个人中心 (FR-DASH-005)

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-DASH-005-01 | 个人信息 | P0 | 查看/编辑个人信息（头像、昵称、部门、联系方式） |
| FR-DASH-005-02 | 偏好设置 | P0 | 语言、时区、日期格式、界面密度等偏好配置 |
| FR-DASH-005-03 | 操作日志 | P1 | 查看个人操作历史记录 |
| FR-DASH-005-04 | 会话管理 | P1 | 管理登录设备、强制下线 |
| FR-DASH-005-05 | 通知偏好 | P1 | 配置各类型通知的接收方式（站内/邮件/浏览器推送） |
| FR-DASH-005-06 | API Token | P2 | 管理个人 API Token，用于平台 API 调用认证 |

---

## 3. 用户故事

### US-01: 平台管理员查看运行概览
> 作为平台管理员，我希望登录后能在首页看到平台整体运行状态（活跃用户数、在线服务数、系统资源使用率、今日告警数），以便我快速了解平台健康度。

**验收标准**:
- 首页展示至少 6 个核心运营指标卡片
- 指标数据延迟不超过 5 分钟
- 指标超阈值时红色高亮
- 点击指标可跳转到详细监控页面

### US-02: 运营人员处理待办审批
> 作为运营人员，我希望在仪表盘直接看到待我审批的事项列表，并能直接在列表中通过或驳回，而不需要跳转到审批系统。

**验收标准**:
- 待办列表实时刷新，延迟不超过 30 秒
- 支持在列表内直接审批操作，填写审批意见
- 审批完成后待办自动从列表移除
- 支持批量审批

### US-03: 开发者快速访问功能
> 作为应用开发者，我希望通过快捷导航快速进入应用中心、本体论引擎等开发工具，并能看到我最近编辑的应用和流程。

**验收标准**:
- 快捷入口展示平台核心模块入口
- 最近访问列表展示最近 10 条记录
- 支持搜索全平台资源
- 搜索响应时间不超过 500ms

### US-04: 自定义工作台
> 作为业务用户，我希望能够自定义工作台布局，选择我关注的指标卡片和待办类型，隐藏不需要的内容。

**验收标准**:
- 支持拖拽调整卡片位置
- 支持添加/移除卡片
- 布局配置自动保存，下次登录恢复
- 支持创建多个工作区

### US-05: 通知统一管理
> 作为用户，我希望所有通知（系统通知、业务提醒、任务分配）在一个地方查看，避免遗漏重要信息。

**验收标准**:
- 通知按时间倒序排列
- 未读通知有醒目标识
- 支持按类型筛选
- 支持批量标记已读/清除

---

## 4. API 接口定义

### 4.1 工作台接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/dashboard/workspaces` | 获取用户工作区列表 |
| POST | `/api/v1/dashboard/workspaces` | 创建工作区 |
| PUT | `/api/v1/dashboard/workspaces/{workspaceId}` | 更新工作区配置 |
| DELETE | `/api/v1/dashboard/workspaces/{workspaceId}` | 删除工作区 |
| GET | `/api/v1/dashboard/workspaces/{workspaceId}/layout` | 获取工作区布局配置 |
| PUT | `/api/v1/dashboard/workspaces/{workspaceId}/layout` | 更新工作区布局 |

### 4.2 指标看板接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/dashboard/metrics` | 获取指标列表 |
| GET | `/api/v1/dashboard/metrics/{metricId}` | 获取指标详情 |
| GET | `/api/v1/dashboard/metrics/{metricId}/data` | 获取指标数据（支持时间范围参数） |
| GET | `/api/v1/dashboard/metrics/{metricId}/trend` | 获取指标趋势数据 |
| POST | `/api/v1/dashboard/metrics/config` | 配置看板指标项 |
| GET | `/api/v1/dashboard/metrics/config` | 获取看板指标配置 |
| WS | `/api/v1/dashboard/metrics/stream` | WebSocket 实时指标推送 |

### 4.3 待办通知接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/dashboard/todos` | 获取待办列表（支持分页、筛选） |
| PUT | `/api/v1/dashboard/todos/{todoId}/handle` | 处理待办 |
| GET | `/api/v1/dashboard/notifications` | 获取通知列表 |
| PUT | `/api/v1/dashboard/notifications/{notificationId}/read` | 标记通知已读 |
| PUT | `/api/v1/dashboard/notifications/read-all` | 全部标记已读 |
| DELETE | `/api/v1/dashboard/notifications/{notificationId}` | 删除通知 |
| GET | `/api/v1/dashboard/notifications/unread-count` | 获取未读通知数 |
| WS | `/api/v1/dashboard/notifications/stream` | WebSocket 实时通知推送 |

### 4.4 快捷导航接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/dashboard/shortcuts` | 获取快捷入口列表 |
| PUT | `/api/v1/dashboard/shortcuts` | 更新快捷入口配置 |
| GET | `/api/v1/dashboard/recent` | 获取最近访问记录 |
| GET | `/api/v1/dashboard/favorites` | 获取收藏列表 |
| POST | `/api/v1/dashboard/favorites` | 添加收藏 |
| DELETE | `/api/v1/dashboard/favorites/{favoriteId}` | 删除收藏 |
| GET | `/api/v1/dashboard/search` | 全局搜索（query 参数） |

### 4.5 个人中心接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/dashboard/profile` | 获取个人信息 |
| PUT | `/api/v1/dashboard/profile` | 更新个人信息 |
| GET | `/api/v1/dashboard/profile/preferences` | 获取偏好设置 |
| PUT | `/api/v1/dashboard/profile/preferences` | 更新偏好设置 |
| GET | `/api/v1/dashboard/profile/audit-logs` | 获取操作日志 |
| GET | `/api/v1/dashboard/profile/sessions` | 获取登录会话列表 |
| DELETE | `/api/v1/dashboard/profile/sessions/{sessionId}` | 注销会话 |
| GET | `/api/v1/dashboard/profile/notification-preferences` | 获取通知偏好 |
| PUT | `/api/v1/dashboard/profile/notification-preferences` | 更新通知偏好 |
| GET | `/api/v1/dashboard/profile/api-tokens` | 获取 API Token 列表 |
| POST | `/api/v1/dashboard/profile/api-tokens` | 创建 API Token |
| DELETE | `/api/v1/dashboard/profile/api-tokens/{tokenId}` | 删除 API Token |

---

## 5. 数据模型

### 5.1 核心实体

```
Workspace（工作区）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── name: String
├── description: String
├── layoutConfig: JSON  // 布局配置
├── isDefault: Boolean
├── createdAt: Timestamp
└── updatedAt: Timestamp

DashboardWidget（看板卡片）
├── id: UUID (PK)
├── workspaceId: String (FK -> Workspace.id)
├── widgetType: Enum [METRIC_CARD, CHART, TODO_LIST, NOTIFICATION, SHORTCUT, CUSTOM]
├── title: String
├── config: JSON  // 卡片配置
├── position: JSON  // 位置信息 {x, y, w, h}
├── isVisible: Boolean
├── createdAt: Timestamp
└── updatedAt: Timestamp

MetricDefinition（指标定义）
├── id: UUID (PK)
├── code: String  // 唯一编码
├── name: String
├── description: String
├── dataSource: String  // 数据来源模块
├── queryConfig: JSON  // 查询配置
├── unit: String
├── refreshInterval: Integer  // 刷新间隔（秒）
├── alertThreshold: JSON  // 告警阈值 {min, max}
├── status: Enum [ACTIVE, INACTIVE]
├── createdAt: Timestamp
└── updatedAt: Timestamp

Todo（待办事项）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── type: Enum [APPROVAL, TASK, TICKET, NOTIFICATION]
├── source: String  // 来源模块
├── sourceId: String  // 来源记录ID
├── title: String
├── description: String
├── priority: Enum [URGENT, HIGH, MEDIUM, LOW]
├── status: Enum [PENDING, COMPLETED, EXPIRED]
├── dueDate: Timestamp
├── actionConfig: JSON  // 可执行操作配置
├── createdAt: Timestamp
└── handledAt: Timestamp

Notification（通知）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── type: Enum [SYSTEM, BUSINESS, TASK, ALERT]
├── source: String  // 来源模块
├── title: String
├── content: String
├── level: Enum [INFO, WARNING, ERROR, SUCCESS]
├── isRead: Boolean
├── actionUrl: String  // 点击跳转URL
├── metadata: JSON
├── createdAt: Timestamp
└── readAt: Timestamp

UserPreference（用户偏好）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── language: String  // zh-CN, en-US
├── timezone: String
├── dateFormat: String
├── theme: Enum [LIGHT, DARK]
├── density: Enum [COMPACT, COMFORTABLE]
├── notificationPreferences: JSON
├── createdAt: Timestamp
└── updatedAt: Timestamp

Favorite（收藏）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── resourceType: String  // PAGE, APP, FLOW, EMPLOYEE, DOC
├── resourceId: String
├── resourceName: String
├── resourceUrl: String
├── sortOrder: Integer
├── createdAt: Timestamp
└── updatedAt: Timestamp

RecentAccess（最近访问）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── resourceType: String
├── resourceId: String
├── resourceName: String
├── resourceUrl: String
├── accessCount: Integer
├── lastAccessedAt: Timestamp
└── createdAt: Timestamp

ApiToken（API Token）
├── id: UUID (PK)
├── userId: String (FK -> User.id)
├── name: String
├── tokenHash: String  // token哈希值（不存明文）
├── scopes: JSON  // 权限范围
├── expiresAt: Timestamp
├── lastUsedAt: Timestamp
├── status: Enum [ACTIVE, REVOKED]
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

---

## 6. 非功能需求

### 6.1 性能需求

| 指标 | 要求 |
|------|------|
| 首页加载时间 | 首屏渲染 < 1.5s（CDN 加速 + 懒加载） |
| 指标数据查询 | P95 < 500ms |
| 全局搜索响应 | P95 < 500ms |
| WebSocket 消息推送延迟 | < 1s |
| 待办列表加载 | P95 < 300ms |

### 6.2 可用性需求

| 指标 | 要求 |
|------|------|
| 可用性 | 99.9% |
| 无状态部署 | 支持水平扩展，会话信息存储在 Redis |
| 故障降级 | 指标数据不可用时展示缓存数据并提示 |
| 灰度发布 | 支持按用户组灰度 |

### 6.3 安全需求

- 所有 API 接口必须通过 TECH-IAM 认证鉴权
- 用户操作日志通过 TECH-OBS 审计记录
- API Token 使用 SHA-256 哈希存储，不存明文
- WebSocket 连接需验证 JWT Token
- 敏感操作（如 API Token 创建、会话注销）需二次确认

### 6.4 兼容性需求

- 浏览器：Chrome 100+、Firefox 100+、Safari 15+、Edge 100+
- 分辨率：最低 1280x720，推荐 1920x1080
- 移动端适配：Pad 横屏可用（P1）

### 6.5 可维护性

- 前端组件复用 Ant Design 6.0 组件库
- 看板卡片采用插件化架构，支持动态注册新卡片类型
- 指标配置通过配置文件管理，无需修改代码

---

## 7. 上下游依赖关系

### 7.1 上游依赖

| 上游服务 | 依赖内容 | 依赖类型 |
|----------|----------|----------|
| TECH-IAM | 用户身份认证、权限校验、角色信息 | 强依赖 |
| TECH-GW | API 网关路由、限流、请求转发 | 强依赖 |
| TECH-MSG | 实时消息推送（通知、待办更新） | 强依赖 |
| TECH-OBS | 操作审计日志、系统监控指标 | 中等依赖 |

### 7.2 下游消费方

| 下游方 | 消费内容 |
|--------|----------|
| 所有 APP 模块 | 仪表盘作为统一入口，导航至各模块 |
| 所有 APP 模块 | 各模块通过 TECH-MSG 向仪表盘推送通知和待办 |

### 7.3 交互流程

```
用户登录 → TECH-IAM 认证 → 返回 JWT Token
  ↓
前端加载仪表盘 → 调用工作台/指标/待办/通知 API
  ↓
TECH-GW 路由请求 → 各后端服务返回数据
  ↓
TECH-MSG 推送实时通知 → WebSocket 推送到前端
  ↓
TECH-OBS 记录用户行为审计日志
```

### 7.4 数据流转

```
各业务模块产生事件 → TECH-MSG (Kafka/RabbitMQ) → 仪表盘消息消费
  ↓
通知/待办写入 PostgreSQL → WebSocket 推送到前端
  ↓
指标数据从 TECH-OBS 获取 → 聚合后展示在看板
```
