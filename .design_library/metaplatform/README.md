# MetaPlatform 设计系统

企业级低代码平台统一设计规范。提供完整的设计 Token、组件库和暗色模式支持，确保产品视觉一致性与开发效率。

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
| `--color-surface-hover` | `#f8fafc` | 面板悬停 |
| `--color-text-primary` | `#0f172a` | 主文本 |
| `--color-text-secondary` | `#475569` | 次文本 |
| `--color-text-tertiary` | `#94a3b8` | 辅助文本 |
| `--color-text-inverse` | `#ffffff` | 反色文本 |
| `--color-border` | `#e2e8f0` | 边框 |
| `--color-border-light` | `#f1f5f9` | 浅边框 / 分割线 |
| `--state-success` | `#22c55e` | 成功 |
| `--state-warning` | `#f59e0b` | 警告 |
| `--state-error` | `#ef4444` | 错误 |
| `--state-info` | `#3b82f6` | 信息 |
| `--tint-ai` | `#8b5cf6` | AI 能力分类 |
| `--tint-data` | `#06b6d4` | 数据源分类 |
| `--tint-tool` | `#f59e0b` | 工具分类 |
| `--tint-rest` | `#3b82f6` | REST API 分类 |
| `--tint-database` | `#22c55e` | 数据库分类 |
| `--tint-csv` | `#f59e0b` | CSV 分类 |

### 排版

| Token | 值 | 说明 |
| --- | --- | --- |
| `--font-sans` | Inter, system stack | 主字体 |
| `--font-mono` | SFMono, Consolas | 等宽字体 |
| `--font-size-xs` | `11px` | 辅助文字 |
| `--font-size-sm` | `12px` | 标签 / 注释 |
| `--font-size-base` | `14px` | 正文 |
| `--font-size-md` | `15px` | 中号文本 |
| `--font-size-lg` | `16px` | 大号正文 |
| `--font-size-xl` | `20px` | 小标题 |
| `--font-size-2xl` | `24px` | 标题 |
| `--font-size-3xl` | `30px` | 大标题 |
| `--font-weight-normal` | `400` | 常规 |
| `--font-weight-medium` | `500` | 中等 |
| `--font-weight-semibold` | `600` | 半粗 |
| `--font-weight-bold` | `700` | 粗体 |

### 间距

| Token | 值 |
| --- | --- |
| `--spacing-xs` | `4px` |
| `--spacing-sm` | `8px` |
| `--spacing-md` | `12px` |
| `--spacing-lg` | `16px` |
| `--spacing-xl` | `24px` |
| `--spacing-2xl` | `32px` |
| `--spacing-3xl` | `48px` |

### 圆角

| Token | 值 | 场景 |
| --- | --- | --- |
| `--radius-sm` | `4px` | 小元素 |
| `--radius-md` | `8px` | 按钮 / 输入框 |
| `--radius-lg` | `12px` | 卡片 |
| `--radius-xl` | `16px` | 大面板 |
| `--radius-full` | `9999px` | 胶囊 / 头像 |

### 阴影

| Token | 值 | 场景 |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.03)` | 轻微提升 |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.04)` | 卡片 |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.05)` | 弹层 |
| `--shadow-float` | `0 12px 32px rgba(0,0,0,0.12)` | 浮动面板 |

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

## 暗色模式

在根元素或容器上添加 `.dark` 类即可切换暗色主题。所有 Token（背景、文本、边框、状态色、阴影等）会自动切换为对应的暗色值。

```html
<html class="dark">
  <!-- 页面将使用暗色模式 -->
</html>
```

暗色模式下主要变化：
- 背景切换为深海军蓝色系（`#0f172a` / `#1e293b`）
- 文本色反转为浅色系
- 边框加深，阴影加大透明度
- 状态色背景使用低透明度叠加

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
