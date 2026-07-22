# Mate Platform UI 设计规范

> 本规范统一定义 Mate Platform 全部前端界面的视觉体系、布局规则、组件模式与交互标准，确保平台 8 个一级模块体验一致。
>
> 设计系统：MetaPlatform3.0（Dark / Light 双主题）
>
> 版本：v1.1
>
> 日期：2026-07-21
>
> 适用范围：APP-DASHBOARD、APP-SUPERAI、APP-DW、APP-APPHUB、APP-ONTSTUDIO、APP-ARCH、APP-MCPHUB、后台管理

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.1 | 2026-07-21 | 圆角统一为 4px 小圆角；收紧间距提升空间利用率；补充完整亮色主题 token；刷新侧边栏布局规范 | - |
| v1.0 | 2026-07-19 | 初始版本，基于 MetaPlatform3.0 Design Token 与 42 页暗色设计稿 | - |
| v1.0-orig | 2026-07-19 | 初版（Ant Design 默认蓝，已废弃） | - |

---

## 1. 设计原则

| 原则 | 说明 |
|---|---|
| 零阴影、边框驱动 | 全局不使用 box-shadow，仅通过 1px 边框区分层级，视觉干净克制。 |
| 双主题支持 | 暗色为默认主题，亮色主题通过 CSS 变量切换实现，组件代码无需修改。 |
| 高空间利用率 | 紧凑间距减少无效边界，卡片内边距 16px，区块间距 16-20px，让内容占据更多空间。 |
| 小圆角 | 全局统一 4px 圆角，视觉锐利精致。 |
| AI 原生 | AI 对话、智能推荐等场景使用 Ant Design X 2.0 组件，流式输出带打字机效果。 |
| 一致性 | 8 个一级模块使用同一套 Design Token、组件类名（`.v-*`）与页面骨架。 |

---

## 2. 设计令牌（Design Tokens）

### 2.1 色彩系统

平台支持暗色和亮色双主题，所有颜色通过 CSS 自定义属性（CSS Variables）管理。暗色变量定义在 `:root` 下，亮色变量定义在 `[data-theme="light"]` 或 `.light` 选择器下。

#### 基础色板

| Token | 暗色值 | 亮色值 | 用途 |
|---|---|---|---|
| `--background` | `#0a0a0a` | `#ffffff` | 页面主背景 |
| `--foreground` | `#fafafa` | `#0a0a0a` | 主文字颜色 |
| `--card` | `#111111` | `#f5f5f5` | 卡片/容器背景 |
| `--card-foreground` | `#fafafa` | `#0a0a0a` | 卡片内文字 |
| `--muted` | `#1a1a1a` | `#f0f0f0` | 次级背景（hover、选中行） |
| `--muted-foreground` | `#a1a1a1` | `#737373` | 次级文字（说明、时间戳、meta 信息） |
| `--accent` | `#1a1a1a` | `#f0f0f0` | 强调背景（选中标签、激活态） |
| `--accent-foreground` | `#fafafa` | `#0a0a0a` | 强调背景上的文字 |
| `--border` | `#262626` | `#e5e5e5` | 边框、分割线 |
| `--primary` | `#fafafa` | `#0a0a0a` | 主色调 |
| `--primary-foreground` | `#0a0a0a` | `#fafafa` | 主色调上的文字 |

#### 侧边栏色板

| Token | 暗色值 | 亮色值 | 用途 |
|---|---|---|---|
| `--sidebar` | `#0f0f0f` | `#fafafa` | 侧边栏背景 |
| `--sidebar-foreground` | `#fafafa` | `#525252` | 菜单文字 |
| `--sidebar-primary` | `#fafafa` | `#0a0a0a` | 当前选中菜单项背景 |
| `--sidebar-primary-foreground` | `#0a0a0a` | `#fafafa` | 当前选中菜单项文字 |
| `--sidebar-accent` | `#1a1a1a` | `#f0f0f0` | 菜单 hover 背景 |
| `--sidebar-accent-foreground` | `#fafafa` | `#0a0a0a` | 菜单 hover 文字 |
| `--sidebar-border` | `#262626` | `#e5e5e5` | 侧边栏右侧边框 |

#### 语义色

| Token | 暗色值 | 亮色值 | 用途 |
|---|---|---|---|
| `--destructive` | `#ff6166` | `#dc2626` | 错误、危险操作、删除 |
| `--success` | `#62d178` | `#16a34a` | 成功、运行中、正向趋势 |
| `--success-subtle` | `#14241a` | `#dcfce7` | 成功状态的浅色背景 |
| `--success-foreground` | `#fafafa` | `#0a0a0a` | 成功背景上的文字 |
| `--warning` | `#eab308` | `#ca8a04` | 警告、待处理、中等优先级 |
| `--warning-subtle` | `#1a1800` | `#fef9c3` | 警告状态的浅色背景 |

#### 图表色板

| Token | 值 | 用途 |
|---|---|---|
| `--chart-1` | `#91c5ff` | 图表色 1（最浅蓝） |
| `--chart-2` | `#3a81f6` | 图表色 2（主蓝） |
| `--chart-3` | `#2563ef` | 图表色 3 |
| `--chart-4` | `#1a4eda` | 图表色 4 |
| `--chart-5` | `#1f3fad` | 图表色 5（最深蓝） |

### 2.2 字体

| Token | 值 | 用途 |
|---|---|---|
| `--font-sans` | `'Geist', ui-sans-serif, system-ui, sans-serif` | 全局默认字体 |
| `--font-mono` | `'Geist Mono', ui-monospace, monospace` | 代码、日志、技术信息 |

字体加载方式：通过 Google Fonts CDN 引入 Geist 和 Geist Mono。

### 2.3 间距与圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius` | `4px` | 全局圆角（按钮、卡片、输入框、弹窗） |

间距使用 4px 基准网格（紧凑模式，提升空间利用率）：

| 语义 | 值 | 用途 |
|---|---|---|
| xs | `4px` | 图标与文字间距 |
| sm | `8px` | 紧凑元素间距 |
| md | `12px` | 相关元素间距 |
| lg | `16px` | 卡片内边距、区块内间距 |
| xl | `20px` | 区块间距 |
| 2xl | `24px` | 页面级大间距 |
| 3xl | `32px` | 页面标题区底部间距 |

### 2.4 阴影

全局零阴影（Zero Shadow）策略。暗色模式下层级关系完全通过背景色深浅差异（`#0a0a0a` → `#111111` → `#1a1a1a`）和 1px 边框体现。亮色模式下通过背景色深浅差异（`#ffffff` → `#f5f5f5` → `#f0f0f0`）和 1px 边框体现。

---

## 3. 布局规范

### 3.1 页面骨架

所有模块统一采用 **Sider + Content** 双栏布局（无顶部 Header 栏）：

```
┌──────────┬─────────────────────────────────┐
│ Sider    │ Content                         │
│ 240px    │ flex: 1                         │
│          │ padding: 24px                   │
│ Logo     │ ┌─────────────────────────────┐ │
│ 一级菜单  │ │ 面包屑 / 页面标题            │ │
│          │ ├─────────────────────────────┤ │
│          │ │                             │ │
│          │ │ 内容区                       │ │
│          │ │                             │ │
│          │ └─────────────────────────────┘ │
└──────────┴─────────────────────────────────┘
```

- 侧边栏宽度：`240px`，`position: fixed; top: 0; left: 0; bottom: 0; z-index: 10`
- 侧边栏内边距：`padding: 20px 12px`（Logo 与菜单项的上/左右边距）
- 侧边栏背景：`var(--sidebar)`
- 侧边栏右侧边框：`1px solid var(--sidebar-border)`
- Content 区域：`margin-left: 240px; flex: 1; padding: 24px; max-width: calc(100vw - 240px)`
- 全局最小高度：`100vh`
- 全局无 Header，用户信息与通知入口放在侧边栏底部

### 3.2 一级菜单

8 个一级菜单项，顺序按业务使用频率与架构逻辑排列：

| 顺序 | 菜单项 | 对应模块 | 图标 |
|---|---|---|---|
| 1 | 工作台 | APP-DASHBOARD | `LayoutDashboard` (Lucide) |
| 2 | SuperAI | APP-SUPERAI | `Sparkles` (Lucide) |
| 3 | 架构中心 | APP-ARCH | `GitBranch` (Lucide) |
| 4 | 应用中心 | APP-APPHUB | `Boxes` (Lucide) |
| 5 | 本体引擎 | APP-ONTSTUDIO | `Database` (Lucide) |
| 6 | MCP 中心 | APP-MCPHUB | `Plug` (Lucide) |
| 7 | 数字员工 | APP-DW | `Bot` (Lucide) |
| 8 | 后台管理 | 后台管理 | `Settings` (Lucide) |

菜单图标统一使用 **Lucide Icons**（`lucide-react`），风格为 stroke 1.5px，尺寸 18×18px。

菜单项交互：

| 状态 | 背景 | 文字 | 左侧指示器 |
|---|---|---|---|
| 默认 | 透明 | `var(--sidebar-foreground)` | 无 |
| Hover | `var(--sidebar-accent)` | `var(--sidebar-accent-foreground)` | 无 |
| 选中/激活 | `var(--sidebar-primary)` | `var(--sidebar-primary-foreground)` | 无（反色背景已足够区分） |

菜单项高度：`40px`，内边距：`0 12px`，圆角：`4px`，图标与文字间距：`12px`。

### 3.3 页面标题区

Content 区域顶部为页面标题区，包含：

```
页面标题（18px, font-weight: 600, color: var(--foreground)）
页面描述（13px, color: var(--muted-foreground)）
操作按钮（右侧对齐）
```

标题与内容区之间用 `var(--border)` 分割线隔开，或通过间距自然过渡。

### 3.4 工作台首页结构

工作台（APP-DASHBOARD）包含 6 个子页面：

| 页面 | 说明 |
|---|---|
| 工作台 | 欢迎卡片、指标看板、快捷入口、待办、数字员工状态 |
| 我的应用 | 用户收藏/常用应用卡片列表 |
| 我的数字员工 | 用户创建的数字员工列表 |
| 消息 | 系统通知、审批提醒 |
| 门户 | 外部门户入口 |
| 交付材料 | 报告、任务输出、分析结果归档 |

---

## 4. 组件规范

所有自定义组件使用 `.v-` 前缀类名。Ant Design 6.0 组件通过 ConfigProvider 主题适配。

### 4.1 卡片（`.v-card`）

```
背景: var(--card)
边框: 1px solid var(--border)
圆角: var(--radius) = 4px
内边距: 16px
阴影: 无
```

卡片标题：14px, font-weight: 600, color: var(--foreground)。
卡片内辅助文字：13px, color: var(--muted-foreground)。

### 4.2 按钮

| 类名 | 背景 | 文字 | 边框 | 用途 |
|---|---|---|---|---|
| `.v-btn` | `transparent` | `var(--foreground)` | `1px solid var(--border)` | 次要操作 |
| `.v-btn-primary` | `var(--primary)` | `var(--primary-foreground)` | 无 | 主要操作 |
| 危险按钮 | `transparent` | `var(--destructive)` | `1px solid var(--destructive)` | 删除/危险操作 |

按钮高度：`36px`，内边距：`0 16px`，圆角：`var(--radius)` = `4px`，字号：`13px`，font-weight: `500`。

按钮 hover 状态：背景变为 `var(--muted)`（`.v-btn`）或降低不透明度至 90%（`.v-btn-primary`）。

### 4.3 表格（`.v-table`）

```
背景: var(--card)
边框: 1px solid var(--border)
圆角: var(--radius) = 4px
表头背景: transparent（与卡片同色，通过底部边框区分）
表头文字: 12px, font-weight: 500, color: var(--muted-foreground), text-transform: uppercase, letter-spacing: 0.05em
行文字: 13px, color: var(--foreground)
行高: 44px
行 hover: background: var(--muted)
单元格内边距: 10px 16px
```

无斑马纹。列分隔使用右侧边框或间距自然区分。

### 4.4 输入框（`.v-input`）

```
背景: var(--muted)
边框: 1px solid var(--border)
圆角: var(--radius) = 4px
高度: 36px
内边距: 0 12px
文字: 13px, color: var(--foreground)
占位符: color: var(--muted-foreground)
```

Focus 状态：`border-color: var(--foreground)`（暗色为白色，亮色为黑色边框）。

### 4.5 标签页（`.v-tab`）

```
默认: color: var(--muted-foreground), background: transparent
激活: color: var(--foreground), background: var(--muted)
圆角: 4px
内边距: 6px 12px
字号: 13px
```

标签页容器底部使用 `var(--border)` 分割线。

### 4.6 徽章（`.v-badge`）

| 类名 | 背景色 | 文字色 | 用途 |
|---|---|---|---|
| `.v-badge-success` | `var(--success-subtle)` | `var(--success)` | 运行中、成功、在线 |
| `.v-badge-warning` | `var(--warning-subtle)` | `var(--warning)` | 待处理、暂停、警告 |
| `.v-badge-error` | `var(--destructive)` 15% 透明度 | `var(--destructive)` | 失败、错误、离线 |
| `.v-badge-neutral` | `var(--muted)` | `var(--muted-foreground)` | 未知、草稿 |

徽章圆角：`9999px`，内边距：`2px 8px`，字号：`12px`，font-weight: `500`。

### 4.7 排版辅助类

| 类名 | 样式 | 用途 |
|---|---|---|
| `.v-eyebrow` | `11px, font-weight: 500, text-transform: uppercase, letter-spacing: 0.05em, color: var(--muted-foreground)` | 区块标签、分类名 |
| `.v-value` | `24px, font-weight: 600, color: var(--foreground)` | 大数字、指标值 |
| `.v-meta` | `12px, color: var(--muted-foreground)` | 时间戳、次要说明 |
| `.v-divider` | `border-top: 1px solid var(--border)` | 分割线 |

### 4.8 侧边栏菜单项（`.v-sidebar-item`）

```
高度: 40px
内边距: 0 12px
圆角: 4px
间距: margin-bottom: 2px
图标: 18×18px, stroke-width: 1.5px
图标与文字间距: 12px
字号: 14px
```

### 4.9 AI 对话组件

AI 对话场景使用 Ant Design X 2.0 组件，需通过 ConfigProvider 适配主题：

- `Bubble`：用户消息靠右，AI 消息靠左。气泡背景用户 `var(--muted)`，AI `var(--card)`。
- `Sender`：底部输入栏，背景 `var(--card)`，边框 `var(--border)`。
- `Conversations`：左侧会话列表，背景 `var(--sidebar)`。
- `Prompts`：推荐提示词，使用 `.v-badge-neutral` 样式的胶囊按钮。
- 流式输出：打字机效果，闪烁光标 `animation: blink 1s step-end infinite`。
- 生成结果操作栏：复制、重新生成、点赞/踩，使用 `.v-btn` 样式。

### 4.10 图表组件

- 趋势图、柱状图：使用 `recharts`，配色取 `--chart-1` 至 `--chart-5`。
- 知识图谱、架构图：使用 AntV X6，节点背景 `var(--card)`，边框 `var(--border)`，文字 `var(--foreground)`。
- 流程设计器：统一使用 FlowGram.AI，审批流 fixed-layout，Agent 编排 free-layout。设计器内组件适配当前主题。

---

## 5. 图标规范

- 图标库：**Lucide Icons**（`lucide-react`），不使用 `@ant-design/icons`。
- 风格：stroke，`stroke-width: 1.5px`。
- 侧边栏菜单图标：18×18px。
- 内容区图标：16×16px（行内）、18×18px（独立使用）。
- 禁止混用多种图标库。

---

## 6. 页面结构与 42 页清单

### 6.1 页面分布

| 模块 | 菜单序号 | 页面数 | 页面列表 |
|---|---|---|---|
| 工作台 | 1 | 6 | 工作台、我的应用、我的数字员工、消息、门户、交付材料 |
| SuperAI | 2 | 1 | AI 对话 |
| 架构中心 | 3 | 5 | 业务架构、应用架构、数据架构、技术架构、架构治理 |
| 应用中心 | 4 | 8 | 列表、详情、建模、表单设计器、流程设计器、配置、发布、版本 |
| 本体引擎 | 5 | 4 | 本体论管理、数据中心、Action 编排、知识图谱 |
| MCP 中心 | 6 | 7 | 工具注册、Server、Client、调试器、权限、外部对接、审计 |
| 数字员工 | 7 | 6 | 列表、详情、知识提炼、任务、协作、效果评估 |
| 后台管理 | 8 | 5 | 用户管理、权限管理、组织管理、日志、系统配置 |
| **合计** | | **42** | |

### 6.2 页面文件命名

页面 HTML 文件使用 kebab-case 命名，存放在设计稿 `pages/` 目录下：

```
pages/dashboard.html
pages/dashboard-myapps.html
pages/dashboard-myagents.html
pages/dashboard-messages.html
pages/dashboard-portal.html
pages/dashboard-deliverables.html
pages/superai-dialogue.html
pages/arch-business.html
pages/arch-app.html
pages/arch-data.html
pages/arch-tech.html
pages/arch-governance.html
pages/apps-list.html
pages/apps-detail.html
pages/apps-modeling.html
pages/apps-formdesigner.html
pages/apps-processdesigner.html
pages/apps-config.html
pages/apps-publish.html
pages/apps-version.html
pages/ontology-modeling.html
pages/ontology-datacenter.html
pages/ontology-action.html
pages/ontology-graph.html
pages/mcp-tools.html
pages/mcp-server.html
pages/mcp-client.html
pages/mcp-debugger.html
pages/mcp-permissions.html
pages/mcp-external.html
pages/mcp-audit.html
pages/agents-list.html
pages/agents-detail.html
pages/agents-knowledge.html
pages/agents-tasks.html
pages/agents-collab.html
pages/agents-evaluation.html
pages/admin-users.html
pages/admin-permissions.html
pages/admin-org.html
pages/admin-logs.html
pages/admin-config.html
```

---

## 7. 交互规范

### 7.1 导航交互

- 当前模块菜单项反色高亮（暗色：白底黑字；亮色：黑底白字）。
- 模块间切换为 SPA 路由跳转（React Router）。
- 页面内操作完成后使用轻量 toast 反馈（非 `alert()`）。

### 7.2 加载与空状态

- 数据加载：骨架屏（Skeleton）优先于 Spin。
- 空数据：居中展示空状态插图 + 说明文字 + 主操作按钮。
- 错误状态：展示错误描述 + 重试按钮，背景不使用红色（保持 `var(--card)`），仅通过 `.v-badge-error` 标识状态。

### 7.3 表单与校验

- 输入框使用 `.v-input` 样式。
- 必填项使用红色星号（`color: var(--destructive)`）标记。
- 校验错误即时显示在字段下方（`color: var(--destructive)`, 12px）。
- 提交按钮在提交过程中显示 loading 状态（opacity 降低 + 旋转图标）。

### 7.4 弹窗与抽屉

- 弹窗背景：`var(--card)`。
- 弹窗边框：`1px solid var(--border)`。
- 弹窗圆角：`var(--radius)` = `4px`。
- 遮罩层：暗色 `rgba(0, 0, 0, 0.6)`，亮色 `rgba(0, 0, 0, 0.4)`。
- 弹窗宽度：小 480px / 中 640px / 大 800px。

### 7.5 确认对话框

- 危险操作（删除、停用）需二次确认。
- 确认对话框使用双按钮布局：左侧取消（`.v-btn`），右侧确认（文字色 `var(--destructive)` 或背景 `var(--destructive)`）。

---

## 8. 主题与模式

### 8.1 暗色模式（默认）

所有页面默认使用暗色模式。CSS 变量定义在 `:root` 选择器下：

```css
:root {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #111111;
  --card-foreground: #fafafa;
  --muted: #1a1a1a;
  --muted-foreground: #a1a1a1;
  --accent: #1a1a1a;
  --accent-foreground: #fafafa;
  --border: #262626;
  --primary: #fafafa;
  --primary-foreground: #0a0a0a;
  --destructive: #ff6166;
  --success: #62d178;
  --success-subtle: #14241a;
  --success-foreground: #fafafa;
  --warning: #eab308;
  --warning-subtle: #1a1800;
  --sidebar: #0f0f0f;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #fafafa;
  --sidebar-primary-foreground: #0a0a0a;
  --sidebar-accent: #1a1a1a;
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: #262626;
  --radius: 4px;
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
```

### 8.2 亮色模式

亮色模式通过在 `<html>` 或 `<body>` 上添加 `data-theme="light"` 属性触发，覆盖 `:root` 变量：

```css
[data-theme="light"] {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #f5f5f5;
  --card-foreground: #0a0a0a;
  --muted: #f0f0f0;
  --muted-foreground: #737373;
  --accent: #f0f0f0;
  --accent-foreground: #0a0a0a;
  --border: #e5e5e5;
  --primary: #0a0a0a;
  --primary-foreground: #fafafa;
  --destructive: #dc2626;
  --success: #16a34a;
  --success-subtle: #dcfce7;
  --success-foreground: #0a0a0a;
  --warning: #ca8a04;
  --warning-subtle: #fef9c3;
  --sidebar: #fafafa;
  --sidebar-foreground: #525252;
  --sidebar-primary: #0a0a0a;
  --sidebar-primary-foreground: #fafafa;
  --sidebar-accent: #f0f0f0;
  --sidebar-accent-foreground: #0a0a0a;
  --sidebar-border: #e5e5e5;
}
```

切换机制通过 Ant Design ConfigProvider `algorithm` + CSS 变量覆盖联合实现。组件代码无需修改，仅通过 CSS 变量自动适配。

### 8.3 Ant Design 6.0 适配

Ant Design 组件通过 ConfigProvider 统一配置主题：

```typescript
// 暗色
<ConfigProvider
  theme={{
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: '#fafafa',
      colorBgContainer: '#111111',
      colorBorder: '#262626',
      colorText: '#fafafa',
      colorTextSecondary: '#a1a1a1',
      borderRadius: 4,
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    },
  }}
>

// 亮色
<ConfigProvider
  theme={{
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#0a0a0a',
      colorBgContainer: '#f5f5f5',
      colorBorder: '#e5e5e5',
      colorText: '#0a0a0a',
      colorTextSecondary: '#737373',
      borderRadius: 4,
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    },
  }}
>
```

---

## 9. 响应式与可访问性

- 最小适配宽度：1280px。
- 表格在窄屏下支持横向滚动。
- 所有交互元素满足 `focus-visible` 状态（暗色：白色 outline；亮色：黑色 outline）。
- 暗色对比度：前景 `#fafafa` on 背景 `#0a0a0a` 约 19:1（AAA）。
- 亮色对比度：前景 `#0a0a0a` on 背景 `#ffffff` 约 19:1（AAA）。
- 语义色对比度均满足 WCAG 2.1 AA 以上标准。
- 图标与装饰性元素添加 `aria-hidden="true"`。

---

## 10. 前端代码规范

- 目录名：kebab-case
- 组件名：PascalCase
- CSS 优先使用本文档定义的 CSS 变量，避免硬编码颜色值
- 自定义组件类名使用 `.v-` 前缀
- 图标统一使用 `lucide-react`，不混用 `@ant-design/icons`
- API 路径统一为 `/api/v1/[模块]/[资源]`
- 禁止直接调用模型 API，统一通过 TECH-LLMGW

---

## 11. Design Library 关联

本规范的 Design Token 源自 **MetaPlatform3.0** Design Library（ID: `_-ZRH2U5YKIYA4`）。Design Library 是 token 的唯一真相源，本规范文档为消费侧参考。

当 Design Library token 更新时，需同步更新本规范中的对应表格。

---

**规范制定日期：** 2026-07-19
**最后更新日期：** 2026-07-21
**下次评审时间：** v1.0-ga 版本验收时