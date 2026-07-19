# Mate Platform UI 设计规范

> 本规范统一 Mate Platform 7 个 APP 模块与 15 个 TECH 服务相关前端界面的视觉、交互与组件使用标准，确保平台体验一致、可维护、可扩展。
>
> 版本：v1.0
>
> 日期：2026-07-19
>
> 适用范围：APP-DASHBOARD、APP-SUPERAI、APP-DW、APP-APPHUB、APP-ONTSTUDIO、APP-ARCH、APP-MCPHUB

---

## 1. 设计原则

| 原则 | 说明 |
|---|---|
| 一致性 | 全部模块使用同一套 Design Token、组件库与页面结构，降低用户学习成本。 |
| 效率优先 | 企业级用户高频操作路径不超过 3 步；核心入口在一级菜单或工作台首页直达。 |
| AI 原生 | AI 对话、智能推荐、生成结果等场景使用 Ant Design X 2.0 组件与流式输出模式。 |
| 可扩展 | 主题、布局、组件行为通过 ConfigProvider 与本地配置统一驱动，支持后续低代码自举。 |
| 清晰可控 | 复杂数据通过卡片、标签、表格、图谱分层展示；关键操作提供二次确认与撤销能力。 |

---

## 2. 设计令牌（Design Tokens）

### 2.1 色彩系统

全局主色与功能色统一使用 Ant Design 6.0 默认 token，禁止各模块自行硬编码。

| Token | 值 | 使用场景 |
|---|---|---|
| `colorPrimary` | `#1677ff` | 主按钮、链接、选中状态、品牌标识、关键数据高亮。 |
| `colorSuccess` | `#52c41a` | 成功、通过、运行中、正向趋势。 |
| `colorWarning` | `#faad14` | 警告、待处理、中等优先级。 |
| `colorError` | `#f5222d` | 错误、失败、高风险、删除操作。 |
| `colorInfo` | `#1677ff` | 提示、信息通知。 |
| `colorBgContainer` | Ant Design 默认 | 卡片、侧边栏、头部背景。 |
| `colorBorderSecondary` | Ant Design 默认 | 分割线、边框。 |

模块品牌辅助色（仅用于图标背景、装饰性元素）：

| 模块 | 辅助色 |
|---|---|
| APP-DASHBOARD | `#1677ff` |
| APP-SUPERAI | `#722ed1` |
| APP-DW | `#52c41a` |
| APP-APPHUB | `#1677ff` |
| APP-ONTSTUDIO | `#fa8c16` |
| APP-ARCH | `#13c2c2` |
| APP-MCPHUB | `#eb2f96` |

### 2.2 字体与排版

- 基础字体：`font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;`
- 中文字体回退：`'PingFang SC', 'Microsoft YaHei', sans-serif`
- 标题层级：
  - 页面标题：`Typography.Title level={3}`
  - 区块标题：`Typography.Title level={4}`
  - 卡片标题：`Typography.Text strong` 或 `Card title`
  - 正文：`Typography.Text`，默认 14px
  - 辅助说明：`Typography.Text type="secondary"`，默认 12px–13px

### 2.3 间距与圆角

| Token | 值 | 使用场景 |
|---|---|---|
| `borderRadius` | `6` | 卡片、按钮、输入框、弹窗 |
| `borderRadiusLG` | Ant Design 默认 | 大卡片、面板 |
| 页面内边距 | `padding: 16px 24px` | Content 区域 |
| 卡片内边距 | `padding: 24px` | 标准卡片 |
| 栅格间距 | `gutter={[16, 16]}` | Dashboard 卡片布局 |

---

## 3. 布局规范

### 3.1 页面骨架

所有 APP 模块统一采用 **Header + Sider + Content** 三段式布局：

```
┌────────────────────────────────────────────┐
│ Header: 品牌标题 | 全局搜索 | 通知 | 用户信息 │
├──────────┬─────────────────────────────────┤
│ Sider    │ Content                         │
│ 一级菜单  │ 面包屑/页面标题/内容区            │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

- Header 高度：Ant Design 默认 64px
- Sider 宽度：`200px`
- Content 最小高度：`280px`
- 全局最小高度：`100vh`

### 3.2 一级菜单

APP-DASHBOARD 作为统一门户，一级菜单必须覆盖平台全部 7 个 APP 模块，菜单顺序按业务使用频率与架构逻辑排列：

| 顺序 | 菜单项 | 路由 / 跳转目标 | 图标 | 说明 |
|---|---|---|---|---|
| 1 | 工作台 | `/dashboard` | `DashboardOutlined` | 聚合待办、指标、快捷入口 |
| 2 | 超级 AI | `http://localhost:9301` | `MessageOutlined` | 智能问答、任务编排 |
| 3 | 数字员工 | `http://localhost:9401` | `RobotOutlined` | 数字员工管理与任务调度 |
| 4 | 应用中心 | `http://localhost:9201` | `AppstoreOutlined` | 低代码应用与流程设计 |
| 5 | 本体论引擎 | `http://localhost:9101` | `ApartmentOutlined` | 本体建模、数据中心、Action 编排 |
| 6 | 架构中心 | `http://localhost:9206` | `PartitionOutlined` | EA 架构资产管理 |
| 7 | MCP 服务中心 | `http://localhost:9501` | `ApiOutlined` | MCP Server/Client、工具注册 |
| 8 | 消息中心 | `/notifications` | `BellOutlined` | 系统通知、审批提醒 |
| 9 | 历史交付物 | `/deliverables` | `FileSearchOutlined` | 报告、任务输出、分析结果 |
| 10 | 个性化设置 | `/settings` | `SettingOutlined` | 语言、时区、主题、个人信息 |

说明：
- 内部路由（`/dashboard`、`/notifications`、`/deliverables`、`/settings`）使用 React Router 无刷新跳转。
- 外部模块链接（其他 6 个 APP）在新标签页打开，避免当前会话状态丢失。
- 菜单图标统一使用 `@ant-design/icons` 6.0，尺寸遵循 Ant Design Menu 默认规范。

### 3.3 工作台首页

工作台首页必须包含以下区域：

1. **欢迎卡片**：显示用户名称、当前日期，使用主色渐变背景。
2. **快捷入口**：以 3 列卡片形式展示全部 6 个外部模块入口（应用中心、超级 AI、数字员工、本体工作室、架构中心、MCP 服务中心），卡片包含图标、标题、描述、跳转链接。
3. **指标看板**：展示关键运营指标与趋势图。
4. **待办审批**：展示当前用户待处理审批任务。
5. **数字员工状态**：展示活跃数字员工与运行任务数。

---

## 4. 组件使用规范

### 4.1 基础组件

| 组件 | 使用场景 | 约束 |
|---|---|---|
| `Button` | 主要操作、次要操作、文字按钮 | 主操作用 `type="primary"`，危险操作用 `danger`，链接用 `type="link"` |
| `Card` | 信息分组、仪表盘卡片 | 统一 `borderRadius: 6`，标题使用 `title` 属性 |
| `Space` | 行/列元素排列 | Ant Design 6 使用 `orientation` 替代 `direction` |
| `Dropdown` | 下拉菜单、通知面板 | Ant Design 6 使用 `popupRender` 替代 `dropdownRender` |
| `Menu` | 侧边栏导航 | 使用 `items` 属性，模式 `inline` |
| `Table` | 数据列表 | 统一分页、空状态、加载状态 |
| `Form` | 数据录入 | 统一标签右对齐或顶对齐，校验即时反馈 |

### 4.2 AI 场景组件

- 对话界面使用 Ant Design X 2.0 的 `Bubble`、`Conversations`、`Prompts`、`Sender` 等组件。
- 流式输出需展示打字机效果与引用来源。
- 生成结果支持复制、重新生成、点赞/踩反馈。

### 4.3 图表与可视化

- 趋势图、柱状图使用 `recharts`。
- 知识图谱、架构图、流程图使用 AntV X6。
- 流程设计器统一使用 FlowGram.AI：审批流使用 fixed-layout，Agent 编排使用 free-layout。

---

## 5. 图标规范

- 统一使用 `@ant-design/icons` 6.0。
- 菜单图标使用 `Outlined` 风格，尺寸默认。
- 快捷入口图标放在 48×48px 圆角容器中，容器背景使用对应模块辅助色 15% 透明度，图标使用辅助色。
- 禁止混用多种图标库，避免风格不统一。

---

## 6. 主题与模式

### 6.1 亮色/暗色模式

- 通过 `ConfigProvider` 的 `algorithm` 切换 `defaultAlgorithm` / `darkAlgorithm`。
- 主题状态保存在 `SettingsContext` 与后端配置中。
- 自定义 CSS 应使用 Ant Design token，避免硬编码颜色。

### 6.2 主题 Token 配置

```typescript
<ConfigProvider
  theme={{
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
  }}
>
```

---

## 7. 交互规范

### 7.1 导航交互

- 当前所在模块菜单项高亮显示。
- 点击外部模块菜单项时在新标签页打开，并显示外部链接提示（可选）。
- 页面内操作完成后给出 `message` 或 `notification` 反馈。

### 7.2 加载与空状态

- 数据加载使用 `Spin` 或 `Skeleton`。
- 空数据使用 `Empty` 组件，并提供新建/刷新引导。
- 错误状态使用 `Result` 组件，包含错误码、描述、重试按钮。

### 7.3 表单与校验

- 必填项使用红色星号标记。
- 校验错误即时显示在字段下方。
- 提交按钮在提交过程中显示 `loading`。

---

## 8. 响应式与可访问性

- 最小适配宽度：1280px。
- 表格在窄屏下支持横向滚动。
- 图片与图表提供 `alt` 或 `aria-label`。
- 颜色对比度符合 WCAG 2.1 AA 标准。

---

## 9. 前端代码规范

- 目录名：kebab-case
- 组件名：PascalCase
- 样式优先使用 Ant Design token 与内联 `style`，避免引入额外 CSS 文件。
- 禁止直接调用模型 API，统一通过 TECH-LLMGW 等后端服务。
- API 路径统一为 `/api/v1/[模块]/[资源]`。

---

## 10. 版本与维护

- 本规范随 v1.2 版本任务 V12-10「统一设计规范与组件库」建立。
- 新增模块上线前需与本规范对齐，并通过 UI 走查。
- 后续 Design Token 与组件扩展优先通过 Ant Design `ConfigProvider` 与主题配置文件管理。

---

**规范制定日期：** 2026-07-19
**下次评审时间：** v1.2 版本验收时
