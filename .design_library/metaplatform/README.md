# MetaPlatform 设计系统（精简版）

紧凑型企业级低代码平台设计规范。通过最小化 Token 集合与精简组件库，在保持视觉一致性的同时降低维护成本，适合快速交付的管理后台类产品。

---

## 快速开始

在项目入口 HTML 中引入 `colors_and_type.css`：

```html
<link rel="stylesheet" href="path/to/metaplatform/colors_and_type.css">
```

引入后即可通过 CSS 变量使用所有 Token：

```css
.my-component {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  color: var(--color-text-primary);
}
```

暗色模式：在根元素添加 `.dark` 类即可自动切换。

---

## Token 速查

### 颜色

| Token | 值 | 用途 |
| --- | --- | --- |
| `--color-primary` | `#3b82f6` | 品牌主色 / 操作色 |
| `--color-primary-hover` | `#2563eb` | 主色悬停态 |
| `--color-primary-light` | `#eff6ff` | 主色浅底 |
| `--color-bg` | `#ffffff` | 页面背景 |
| `--color-bg-secondary` | `#f8fafc` | 次级背景 |
| `--color-surface` | `#ffffff` | 卡片 / 面板 |
| `--color-text-primary` | `#0f172a` | 主文本 |
| `--color-text-secondary` | `#64748b` | 次文本 |
| `--color-border` | `#e2e8f0` | 边框 |
| `--state-success` | `#22c55e` | 成功 |
| `--state-warning` | `#f59e0b` | 警告 |
| `--state-error` | `#ef4444` | 错误 |

### 排版

| Token | 值 | 说明 |
| --- | --- | --- |
| `--font-size-xs` | `11px` | 辅助文字 |
| `--font-size-sm` | `12px` | 标签 / 注释 |
| `--font-size-base` | `13px` | 正文 |
| `--font-size-lg` | `14px` | 大号正文 |
| `--font-size-xl` | `18px` | 小标题 |
| `--font-size-2xl` | `22px` | 标题 |

### 间距

| Token | 值 |
| --- | --- |
| `--spacing-xs` | `2px` |
| `--spacing-sm` | `4px` |
| `--spacing-md` | `8px` |
| `--spacing-lg` | `12px` |
| `--spacing-xl` | `16px` |
| `--spacing-2xl` | `24px` |

### 圆角

| Token | 值 | 场景 |
| --- | --- | --- |
| `--radius-sm` | `3px` | 小元素 |
| `--radius-md` | `4px` | 按钮 / 输入框 |
| `--radius-lg` | `6px` | 卡片 |
| `--radius-full` | `9999px` | 胶囊 / 头像 |

### 阴影

| Token | 值 | 场景 |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | 轻微提升 |
| `--shadow-float` | `0 8px 24px rgba(0,0,0,0.10)` | 浮动面板 |

---

## 组件列表

| 组件 | 说明 | 预览 |
| --- | --- | --- |
| Sidebar | 侧边导航栏 | [预览](preview/component-sidebar.html) |
| Button | 按钮 | [预览](preview/component-button.html) |
| Card | 卡片 | [预览](preview/component-card.html) |
| DataTable | 数据表格 | [预览](preview/component-data-table.html) |
| Badge | 标签 / 徽章 | [预览](preview/component-badge.html) |
| Input | 输入框 | [预览](preview/component-input.html) |

---

## 文件结构

```
metaplatform/
├── README.md                  # 本文档
├── colors_and_type.css        # 设计 Token（颜色、排版、间距、圆角、阴影）
├── components/
│   ├── index.json             # 组件注册索引
│   ├── sidebar.json           # Sidebar 组件规格
│   ├── button.json            # Button 组件规格
│   ├── card.json              # Card 组件规格
│   ├── data-table.json        # DataTable 组件规格
│   ├── badge.json             # Badge 组件规格
│   └── input.json             # Input 组件规格
└── preview/
    ├── component-sidebar.html # Sidebar 预览页
    ├── component-button.html  # Button 预览页
    ├── component-card.html    # Card 预览页
    ├── component-data-table.html # DataTable 预览页
    ├── component-badge.html   # Badge 预览页
    └── component-input.html   # Input 预览页
```
