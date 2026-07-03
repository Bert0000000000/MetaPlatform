# MetaPlatform 设计系统

## 概述

MetaPlatform 设计系统（精简版），面向企业级低代码平台的紧凑型设计规范。核心特征：小圆角（最大 6px）、紧凑间距、精简色彩（仅保留语义色），包含 6 个核心 UI 组件。

## 品牌标识

- **Brand prefix:** `mp`
- **Primary:** `#3b82f6`
- **字体:** Inter + Noto Sans SC
- **风格:** compact minimal enterprise

## Token 体系

### 颜色

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-primary` | `#3b82f6` | 主色 / 操作色 |
| `--color-primary-hover` | `#2563eb` | 主色悬停 |
| `--color-primary-light` | `#eff6ff` | 主色浅底 |
| `--color-bg` | `#ffffff` | 页面背景 |
| `--color-bg-secondary` | `#f8fafc` | 次级背景 |
| `--color-surface` | `#ffffff` | 卡片/面板表面 |
| `--color-text-primary` | `#0f172a` | 主文本 |
| `--color-text-secondary` | `#64748b` | 次级文本 |
| `--color-text-inverse` | `#ffffff` | 反色文本 |
| `--color-border` | `#e2e8f0` | 边框（唯一） |
| `--state-success` | `#22c55e` | 成功 |
| `--state-warning` | `#f59e0b` | 警告 |
| `--state-error` | `#ef4444` | 错误 |

### 排版

| 级别 | 字号 | Token |
|------|------|-------|
| xs | 11px | `--font-size-xs` |
| sm | 12px | `--font-size-sm` |
| base | 13px | `--font-size-base` |
| lg | 14px | `--font-size-lg` |
| xl | 18px | `--font-size-xl` |
| 2xl | 22px | `--font-size-2xl` |

### 间距

| Token | 值 |
|-------|-----|
| `--spacing-xs` | 2px |
| `--spacing-sm` | 4px |
| `--spacing-md` | 8px |
| `--spacing-lg` | 12px |
| `--spacing-xl` | 16px |
| `--spacing-2xl` | 24px |

### 圆角

| Token | 值 |
|-------|-----|
| `--radius-sm` | 3px |
| `--radius-md` | 4px |
| `--radius-lg` | 6px |
| `--radius-full` | 9999px |

### 阴影

| Token | 值 |
|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-float` | `0 8px 24px rgba(0,0,0,0.1)` |

## 组件清单

### sidebar — 侧边栏导航

- 220px 固定宽度（`--sidebar-width`）
- 深色背景 `#0f172a`，文字 `#94a3b8`
- 激活项：蓝色半透明底 + 蓝色文字

### button — 按钮

- 三种变体：主要（primary）、轮廓（outline）、危险（danger）
- 圆角 `--radius-md`（4px），字号 11px（`--font-size-xs`）

### card — 卡片

- 圆角 `--radius-lg`（6px），无彩色边框
- 提供 `.mp-surface`（普通）和 `.mp-surface-raised`（浮起）两种表面

### data-table — 数据表格

- 紧凑行高，适配高信息密度场景

### badge — 徽章

- 中性默认样式 + 语义状态色（success / warning / error）

### input — 输入框

- 圆角 `--radius-md`（4px），边框使用 `--color-border`

## 暗色模式

通过 `.dark` class 切换，覆盖全部 neutral、text、border、shadow token，state 背景改为半透明。

## 设计原则

1. **小圆角** — 最大 6px，保持精致感
2. **紧凑间距** — 间距梯度从 2px 起，适配高密度界面
3. **中性色彩** — 仅保留语义色（success/warning/error），无多余装饰色
4. **无装饰** — 极简风格，去除视觉噪音，聚焦内容与操作
