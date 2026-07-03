# MetaPlatform 设计系统

## 概述

MetaPlatform 设计系统是企业级低代码平台 MetaPlatform 的完整设计规范。系统涵盖色彩、排版、间距、圆角、阴影等全套 Design Token，以及 6 个核心 UI 组件，为平台控制台界面提供统一、冷静、可信赖的视觉语言。

## 品牌标识

| 属性 | 值 |
|------|-----|
| 品牌前缀 | `mp` |
| 主色 | Indigo Blue `#3b82f6` |
| 字体栈 | Inter + Noto Sans SC |
| 视觉基调 | 冷静、可信赖的企业级管理台 |

## Token 体系

所有 Token 定义于 `colors_and_type.css`，以 CSS 自定义属性（Custom Properties）形式提供。

### 色彩（Color）

- **主色**：`--color-primary` / `--color-action`（便携别名）
- **中性背景**：`--color-bg`、`--color-bg-secondary`、`--color-bg-tertiary`
- **表面**：`--color-surface`、`--color-surface-hover`
- **侧边栏**：`--color-sidebar-bg`、`--color-sidebar-text`、`--color-sidebar-active-bg`
- **文本**：`--color-content`、`--color-content-secondary`、`--color-content-tertiary`
- **边框**：`--color-field`（便携别名，指向 `--color-border`）
- **状态反馈**：`--color-feedback-success`、`--color-feedback-warning`、`--color-feedback-error`、`--color-feedback-info`
- **分类着色**：`--tint-ai`、`--tint-data`、`--tint-tool`、`--tint-rest`、`--tint-database`、`--tint-csv`

### 排版（Typography）

- **字体**：`--font-sans`（正文）、`--font-mono`（代码）
- **字号**：`--font-size-xs`(11px) ~ `--font-size-3xl`(30px)
- **字重**：`--type-heading`(700)、`--type-subheading`(600)、`--type-body`(400)
- **行高**：`--line-height-tight`(1.25)、`--line-height-normal`(1.5)

### 间距（Spacing）

`--spacing-xs`(4px)、`--spacing-sm`(8px)、`--spacing-md`(12px)、`--spacing-lg`(16px)、`--spacing-xl`(24px)、`--spacing-2xl`(32px)、`--spacing-3xl`(48px)

### 圆角（Radius）

- `--radius-btn` = `--radius-md`(8px)
- `--radius-card` = `--radius-lg`(12px)
- `--radius-input` = `--radius-md`(8px)
- `--radius-pill` = `--radius-full`(9999px)

### 阴影（Shadow）

`--shadow-sm`、`--shadow-md`、`--shadow-lg`、`--shadow-float` -- 低透明度、边框优先的阴影层级

### 布局（Layout）

- `--sidebar-width`: 240px
- `--content-max-width`: 1200px
- `--header-height`: 56px

## 组件清单

| Slug | 名称 | 说明 |
|------|------|------|
| `sidebar` | 侧边栏导航 | 固定左侧深色导航栏，含品牌标识、导航分组与用户信息区 |
| `button` | 按钮 | 主要（Primary）、轮廓（Outline）、危险（Danger）三种样式，SM / MD 两种尺寸 |
| `card` | 卡片 | 默认、可交互（Interactive）、状态（Status）、紧凑（Compact）四种变体 |
| `data-table` | 数据表格 | 带表头、行悬停高亮和操作列的结构化数据展示组件 |
| `badge` | 徽章标签 | 支持 Default、Category（REST/Database/CSV/AI）、Status（成功/异常/警告）三类 |
| `input` | 输入框 | 文本输入框（含 Mono 变体）和文本域，带 focus 光晕反馈 |

## 暗色模式

设计系统支持 `.dark` 类名切换暗色模式。在 `.dark` 作用域下，所有背景、文本、边框、状态色和阴影 Token 均自动翻转为深色值，组件无需额外处理即可适配。

切换方式：在 `<html>` 或任意祖先元素添加 `class="dark"` 即可。

## 使用指南

### 1. 引入 Token 文件

在项目入口 HTML 或 CSS 中引入 `colors_and_type.css`：

```html
<link rel="stylesheet" href="path/to/metaplatform/colors_and_type.css">
```

### 2. 使用 Token

在自定义样式中通过 CSS 自定义属性引用：

```css
.my-component {
  background: var(--color-surface);
  border: 1px solid var(--color-field);
  border-radius: var(--radius-card);
  padding: var(--spacing-lg);
  color: var(--color-content);
  box-shadow: var(--shadow-sm);
}
```

推荐使用便携别名（如 `--color-action`、`--color-content`、`--radius-btn`），而非直接引用底层变量名，以保持组件代码的语义清晰和可移植性。

### 3. 使用排版类

设计系统提供预置排版类：

- `.mp-h1` ~ `.mp-h4`：标题层级
- `.mp-body`：正文
- `.mp-caption`：辅助说明
- `.mp-code`：代码文本

### 4. 使用表面类

- `.mp-surface`：基础表面（边框 + 圆角）
- `.mp-surface-raised`：浮起表面（边框 + 圆角 + 阴影）
