# 流程组件目录（FlowComponentCatalog）

按 `metaplatform-design-draft/pages/components.html` 第 418–1206 行
「流程节点」section 1:1 还原的 React 组件。

## 接入

```tsx
import { FlowComponentCatalog } from '@mate/shared/flow';

export const AdminFlowNodesPage = () => <FlowComponentCatalog />;
```

## 设计稿与实现对应表

### 1. 整体布局（design draft 105-106）

```
┌──────────────────────────────────────────────────────────┐
│ .flow-layout                                             │
│  grid-template-columns: 280px 1fr                        │
│  ┌─────────────┐  ┌────────────────────────────────────┐  │
│  │ flow-palette│  │ flow-canvas-area                   │  │
│  │ (左侧 280px)│  │ (右侧自适应)                        │  │
│  └─────────────┘  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2. 左侧 Palette（design draft 107-138）

```
┌─────────────────────────┐
│ palette-header           │  ← 搜索 input（icon + placeholder）
├─────────────────────────┤
│ palette-categories       │  ← 分类 pill 行：全部 / BPMN / AI / 业务 / 数据
│ (horizontal scroll)      │     （design draft 第 433-438 行）
├─────────────────────────┤
│ palette-body             │
│  palette-group           │
│   palette-group-header   │  ← 标题 + 折叠 chevron + count 徽章
│   palette-group-items    │  ← palette-item 列表
│    palette-icon          │     icon 32×32 圆角背景（bg-bpmn/ai/business/...）
│    palette-info          │     label（13px bold）+ sub（11px muted）
└─────────────────────────┘
```

**交互（1:1 还原）**：
- 搜索框模糊匹配 `data-name` 中英文字符串
- pill 点击过滤 palette-group 的可见性（全部 / 4 类目）
- palette-group-header 点击折叠 / 展开，对应 chevron 旋转 -90°
- palette-item draggable="true"，拖入 dropzone 创建 chip

### 3. 右侧 Canvas Area（design draft 136-153）

```
┌─────────────────────────────────────────────┐
│ canvas-toolbar                              │
│  ┌────────────┐   ┌──────────┐             │
│  │ 流程画布     │   │ 固定布局  │ 自由布局     │
│  └────────────┘   └──────────┘             │
│                          [清空][保存]       │
├─────────────────────────────────────────────┤
│ dropzone                                    │
│  dragover 时变成 info 色边框 + info-subtle  │
│  默认显示空提示：                           │
│  ┌──────────────────────────┐              │
│  │   ◰ 从左侧拖拽节点到此处   │              │
│  └──────────────────────────┘              │
│  拖入后渲染为 chip：                         │
│  ┌──┐ ┌──┐ ┌──┐                            │
│  │○ │ │○ │ │○ │                            │
│  └X┘ └X┘ └X┘                              │
└─────────────────────────────────────────────┘
```

### 4. 节点完整目录 catalog（design draft 156-179）

按 `data-cat` 渲染 6 个分组（BPMN / AI / Business / Data / Trigger / Control），每组
node-grid 3 列卡片：

```
node-group
├── node-group-header
│   ├── node-group-name         e.g. "BPMN 节点"
│   ├── node-group-count        徽章数字
│   └── v-badge                 e.g. v-badge-info "BPMN"
└── node-grid                   grid-template-columns: repeat(3, 1fr)
    └── node-card
        ├── node-card-top
        │   ├── node-icon       36×36 圆角 + 类型色
        │   └── node-meta
        │       ├── node-title  13px bold
        │       └── node-desc   12px muted, 1 行截断
        └── node-card-bottom
            ├── v-badge         类型徽章
            └── ports
                ├── port out    8px 圆点 success 色
                ├── port in     8px 圆点 info 色
                └── ports-text  "1/1" 或 "N/1"
```

### 5. 颜色与类型映射（design draft 213-224）

| 类型      | icon bg            | icon fg    | v-badge              | 用途                     |
|-----------|--------------------|-----------|----------------------|--------------------------|
| bpmn      | `--info-subtle`    | `--info`  | v-badge-info         | BPMN 标准事件 / 网关       |
| ai        | `--purple-subtle`  | `--purple`| v-badge-purple       | AI Agent 节点            |
| business  | `--success-subtle` | `--success`| v-badge-success     | 业务通用节点              |
| data      | `--warning-subtle` | `--warning`| v-badge-warning     | 数据集成                  |
| trigger   | `rgba(232,121,249,0.1)` | `#e879f9` | 自定义 | 流程触发器              |
| control   | `--muted`          | `--muted-foreground` | v-badge-neutral | 控制流 / 条件 / 循环 / 合并 |

### 6. 完整的 6 组节点清单（design draft 440-636 + 668-1201）

| 分组  | count | 节点                                                                                        |
|-------|-------|---------------------------------------------------------------------------------------------|
| BPMN  | 8     | start / end / user-task / service-task / exclusive / parallel / inclusive / subprocess       |
| AI    | 6     | llm / prompt / tool / rag / agent-decision / code-exec                                       |
| Business | 8  | form-collect / data-query / data-write / notify / email / sms / webhook / manual-task        |
| Data  | 5     | db-connect / http / mq / file-storage / etl                                                  |
| Trigger | 4   | schedule / event-trigger / form-submit / webhook-trigger                                     |
| Control | 5   | condition / loop / parallel-control / merge / wait                                           |

合计 36 个节点。所有节点都在 `flow-component-catalog.tsx` 的 `NODE_GROUPS` 数组中定义，
与 `node-registries.ts` 中的 Flowgram 注册保持一一对应：
- 同一中文 name
- 同一 lucide-react icon
- 同一 ports 字符串

## 与 FlowgramEditor 的对比

`FlowComponentCatalog` 是一个**纯展示组件**，不含 FlowGram SDK 状态机：

| 维度       | FlowComponentCatalog         | FlowgramEditor            |
|------------|------------------------------|---------------------------|
| 用途       | 节点展示 + 拖拽交互演示       | 真实流程编辑 + 节点引擎    |
| 技术栈     | 100% HTML / React + lucide    | FlowGram SDK 1.0.12       |
| 节点渲染   | 自渲染 card + chip            | SDK 内部 SVG / DOM         |
| 数据持久   | 无（chip 仅展示）             | document.toJSON()          |

如果业务侧要"用 FlowGram 引擎跑这一套节点"——
把 `NODE_GROUPS` 的节点定义自动同步到 `FlowNodeRegistry[]`，
把 palette-item 的 onMouseDown 接到 `useStartDragNode`，dropzone 接到
`document.onDrop` 即可。

## 已识别但未在 React 中实现的细节

1. **design draft 第 922 行内联样式 bug**：原 HTML 中通知发送卡片的
   palette-icon div 用的是 palette-icon 类，但需要 node-icon 类（36px 而非 32px）。
   React 版统一使用 node-icon 类渲染。
2. **`#e879f9`** 在 design draft 直接写死为 hex，没用 CSS 变量。React 版保留同样
   做法，把 trigger 颜色钉在常量 `T.trigger` 中，便于 dark / light 主题切换。
3. **Tab 过滤**（ui/flow/plugin/doc）本页只复刻 flow section；其它三段
   （UI 组件、插件、API 文档）可以追加 `<UIVariantsSection />` 等姐妹组件。
