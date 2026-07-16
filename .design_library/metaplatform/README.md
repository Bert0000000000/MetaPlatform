# MetaPlatform 设计系统

本体论驱动的企业级 AI 平台视觉规范。

## 设计理念

MetaPlatform 采用紧凑、专业、数据驱动的设计语言。视觉风格以冷蓝色调为主，白色画布搭配深色侧边栏，强调信息密度和操作效率。

### 核心原则

- **紧凑高效**：4px 基准间距体系，小圆角 (3-6px)，高信息密度
- **边框优先**：卡片使用 border-only 样式，避免多余阴影
- **层级分明**：深色侧边栏 + 白色内容区 + 浅灰辅助背景，三级视觉层级
- **语义清晰**：统一的色彩语义系统 (success/warning/error)，状态一目了然

## Token 体系

### 色彩

| 类别 | Token | 值 | 用途 |
|------|-------|-----|------|
| 主色 | `--mp-primary` | #3b82f6 | 主要操作、链接、活跃状态 |
| 主色悬停 | `--mp-primary-hover` | #2563eb | 按钮悬停态 |
| 侧边栏 | `--mp-sidebar` | #0f172a | 侧边栏背景 |
| 背景 | `--mp-bg` | #ffffff | 页面主背景 |
| 辅助背景 | `--mp-surface-dim` | #f8fafc | 表头、输入框背景 |
| 文字 | `--mp-fg` | #0f172a | 主要文字 |
| 次要文字 | `--mp-muted` | #64748b | 描述、辅助信息 |
| 边框 | `--mp-border` | #e2e8f0 | 分割线、卡片边框 |
| 成功 | `--mp-success` | #22c55e | 成功状态 |
| 警告 | `--mp-warning` | #f59e0b | 警告状态 |
| 错误 | `--mp-error` | #ef4444 | 错误状态 |

### 排版

| 角色 | Token | 值 |
|------|-------|-----|
| 正文 | `--type-body-family` | 'Inter', 'Noto Sans SC', sans-serif |
| 正文大小 | `--type-body` | 13px |
| 辅助文字 | `--type-sm` | 12px |
| 标签 | `--type-xs` | 11px |
| 小标题 | `--type-lg` | 14px |
| 页面标题 | `--type-xl` | 18px |
| 大标题 | `--type-2xl` | 22px |

### 间距

基准单位 4px：`--space-1`(4px), `--space-2`(8px), `--space-3`(12px), `--space-4`(16px), `--space-5`(20px), `--space-6`(24px)

### 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 3px | 小元素 |
| `--radius-md` | 4px | 按钮、输入框 |
| `--radius-lg` | 6px | 卡片、面板 |
| `--radius-full` | 9999px | Badge、头像 |

## 组件

### 核心

| 组件 | 描述 |
|------|------|
| Button | 主操作按钮，Primary/Ghost 两种样式 |
| Card | 边框优先容器，Default/Stat 两种变体 |
| Table | 数据表格，紧凑行高、小号表头 |
| Input | 表单输入，32px 高度、蓝色聚焦环 |
| Badge | 状态标签，5 种语义色 |
| Sidebar | 深色垂直导航，220px 宽度 |

### 组件预览

每个组件均提供独立预览页面，位于 `preview/` 目录。

## 使用方式

1. 在 HTML 中引入 Token CSS：`<link rel="stylesheet" href="colors_and_type.css">`
2. 使用 CSS 变量构建页面：`color: var(--mp-fg); background: var(--mp-surface);`
3. 参考组件预览页面实现一致的设计
