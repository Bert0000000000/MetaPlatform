# FlowCanvas 标准化流程图组件设计文档

> 创建日期：2026-07-23
> 版本：v1.0
> 关联项目：Mate Platform v1.3 重构期

## 1. 背景与目标

当前 `metaplatform-frontend` 中流程设计器页面（`ProcessDesignerPage`）仍使用静态 SVG 占位，AI Agent 编排页面（`TaskOrchestrationPage`）也缺乏统一的画布能力。为了支撑 **BPMN 审批流** 与 **AI Agent 编排流** 两种场景，需要基于 FlowGram.AI 官方固定布局能力，封装一套可复用、深色主题、支持节点拖拽/选中/编辑/缩放的流程图组件。

### 核心目标
- **标准化**：在 `packages/shared` 中提供统一 API 的 `FlowCanvas` 组件族。
- **可复用**：同时服务于 `portal`（BPMN）和 `superai`（Agent 编排）。
- **深色主题**：与现有 Ant Design 6 深色 Design Token 保持一致。
- **交互完整**：节点拖拽、单击选中、右侧属性面板编辑、画布缩放/适应屏幕。
- **业务友好**：对外暴露 `{ nodes, edges }` 业务模型，内部转换为 FlowGram 格式。

## 2. 范围

### 在本次设计中覆盖
- `packages/shared/src/components/flow/` 下的组件封装。
- 统一的节点/边数据模型、节点注册机制、主题配置。
- `portal/src/pages/apps/ProcessDesignerPage.tsx` 的流程设计器改造。
- `superai/src/pages/TaskOrchestrationPage.tsx` 的 Agent 编排画布接入。

### 不在本次设计中覆盖
- 后端流程定义存储/加载 API（沿用现有 `flows.ts` / `client.ts`）。
- 运行态流程模拟执行引擎。
- 自由布局（free-layout）能力（后续在 Agent 编排增强时可选扩展）。

## 3. 组件架构

组件族分为 5 个核心单元：

| 组件 | 路径 | 职责 |
|---|---|---|
| `FlowCanvas` | `flow/FlowCanvas.tsx` | 画布核心，集成 FlowGram fixed-layout-editor，渲染节点与边，处理缩放、拖拽、选中 |
| `FlowToolbar` | `flow/FlowToolbar.tsx` | 顶部工具栏：撤销/重做、放大/缩小/适应屏幕、预览/保存/发布 |
| `FlowPalette` | `flow/FlowPalette.tsx` | 左侧组件面板，按分类展示可拖拽节点模板 |
| `FlowPropertyPanel` | `flow/FlowPropertyPanel.tsx` | 右侧属性面板，根据选中节点渲染表单 |
| `FlowProvider` | `flow/FlowProvider.tsx` | 提供 `FlowContext`，统一管理节点/边状态、选中态、缩放比例 |

### 组合关系
```
ProcessDesignerPage / TaskOrchestrationPage
└── <FlowProvider>
    └── <div className="flow-workspace">
        ├── <FlowToolbar />
        ├── <div className="flow-body">
        │   ├── <FlowPalette />
        │   ├── <FlowCanvas />
        │   └── <FlowPropertyPanel />
        └── <FlowStatusBar /> (可选，页面级)
```

## 4. 数据模型

### 4.1 对外业务模型

```typescript
export interface FlowNode<T = unknown> {
  id: string;
  type: string;           // 'start' | 'end' | 'userTask' | 'serviceTask' | 'exclusiveGateway' | 'agent' | ...
  name: string;
  x: number;
  y: number;
  data?: T;               // 业务自定义数据
}

export interface FlowEdge<T = unknown> {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: T;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNodeType {
  type: string;
  name: string;
  category: string;
  icon?: React.ComponentType;
  component: React.ComponentType<{ node: FlowNode; selected: boolean }>;
  defaultWidth?: number;
  defaultHeight?: number;
  form?: React.ComponentType<{ node: FlowNode; onChange: (patch: Partial<FlowNode>) => void }>;
}
```

### 4.2 与 FlowGram 的转换

`FlowCanvas` 内部通过 `flowDataToFlowgram(data)` 与 `flowgramToFlowData(json)` 两个转换器完成业务模型与 FlowGram fixed-layout JSON 之间的双向映射。转换器位于 `flow/utils/adapter.ts`。

> 注意：TECH-WFE v1.3 已移除 Flowable 依赖，流程定义存储格式改为 FlowGram.AI fixed-layout JSON（`flowgramJson` 字段）。因此组件默认以 FlowGram JSON 为主格式，BPMN XML 仅作为单页导入/导出的兼容格式（调用后端 `BpmnToFlowGramConverter`）。

### 4.3 节点注册表（Node Material Registry）

参考 FlowGram 官方物料库（`@flowgram.ai/form-materials`）的组件化思路，节点库把每个节点类型抽象为一份**节点物料（Node Material）**，由渲染组件、配置表单、图标、默认尺寸和元数据组成。节点类型通过 `nodeTypes` 属性注入，不同页面传入不同节点集合，实现 BPMN 审批流与 AI Agent 编排的场景隔离。

#### 4.3.1 节点物料结构

```typescript
export interface FlowNodeFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'json' | 'variable' | 'condition';
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface FlowNodeMaterial<T = unknown> {
  type: string;                 // 全局唯一节点类型标识
  name: string;                 // 显示名称
  category: string;             // 面板分类 key
  icon?: React.ComponentType;
  component: React.ComponentType<{ node: FlowNode<T>; selected: boolean }>;
  form?: React.ComponentType<{ node: FlowNode<T>; onChange: (patch: Partial<FlowNode<T>>) => void }>;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  fields?: FlowNodeFormField[]; // 通用属性面板字段描述
  defaultData?: T;              // 拖入画布时的默认业务数据
  ports?: { top?: number; right?: number; bottom?: number; left?: number }; // 连线锚点
}
```

#### 4.3.2 BPMN 审批流节点

| 类型 | 名称 | 默认尺寸 | 主要业务字段 | 说明 |
|---|---|---|---|---|
| `start` | 开始 | 40×40 | — | 圆形，每个流程唯一入口 |
| `end` | 结束 | 40×40 | — | 圆形粗边框，可配置终止类型 |
| `userTask` | 用户任务 | 120×80 | 审批人、候选角色、表单、超时提醒 | 矩形，支持会签/或签 |
| `serviceTask` | 服务任务 | 120×80 | 服务类型、接口、重试策略 | 圆角矩形，调用外部服务 |
| `scriptTask` | 脚本任务 | 120×80 | 脚本语言、脚本内容 | 用于规则/数据转换 |
| `exclusiveGateway` | 排他网关 | 60×60 | 默认分支 | 菱形，条件互斥 |
| `parallelGateway` | 并行网关 | 60×60 | — | 菱形，加号图标 |
| `inclusiveGateway` | 包容网关 | 60×60 | 默认分支 | 菱形，条件可组合 |
| `eventBasedGateway` | 事件网关 | 60×60 | — | 菱形，用于事件驱动分支 |
| `sequenceFlow` | 顺序流 | — | 条件表达式、优先级 | 边类型，非节点 |

#### 4.3.3 AI Agent 编排节点

| 类型 | 名称 | 默认尺寸 | 主要业务字段 | 说明 |
|---|---|---|---|---|
| `input` | 输入 | 120×60 | 变量列表、输入模板 | 接收用户或上游输入 |
| `llm` | LLM | 140×90 | 模型、温度、系统提示词、输出格式 | 大模型推理节点 |
| `toolCall` | 工具调用 | 140×90 | 工具/ MCP 服务、参数映射、超时 | 调用外部工具/MCP Server |
| `knowledgeRetrieval` | 知识检索 | 140×90 | 知识库、TopK、阈值、过滤条件 | RAG 检索节点 |
| `condition` | 条件 | 100×80 | 分支条件、默认分支 | 控制流分支 |
| `loop` | 循环 | 120×80 | 循环条件、最大次数 | 迭代执行子流 |
| `subFlow` | 子流程 | 140×90 | 子流程定义、输入/输出映射 | 复用已有流程 |
| `humanConfirm` | 人工确认 | 140×90 | 确认人、确认方式、超时策略 | 人在环路节点 |
| `output` | 输出 | 120×60 | 输出变量、模板 | 返回最终结果 |
| `code` | 代码 | 120×80 | 语言、代码片段 | 轻量数据加工 |

#### 4.3.4 节点注册示例

```typescript
import {
  bpmnStartNode,
  bpmnEndNode,
  bpmnUserTaskNode,
  bpmnServiceTaskNode,
  bpmnExclusiveGatewayNode,
  bpmnParallelGatewayNode,
  bpmnSequenceFlowEdge,
} from '@shared/components/flow/materials/bpmn';

import {
  agentInputNode,
  agentLlmNode,
  agentToolCallNode,
  agentConditionNode,
  agentOutputNode,
  agentHumanConfirmNode,
} from '@shared/components/flow/materials/agent';

// portal 审批流
const portalMaterials: FlowNodeMaterial[] = [
  bpmnStartNode,
  bpmnEndNode,
  bpmnUserTaskNode,
  bpmnServiceTaskNode,
  bpmnExclusiveGatewayNode,
  bpmnParallelGatewayNode,
  bpmnSequenceFlowEdge,
];

// superai Agent 编排
const agentMaterials: FlowNodeMaterial[] = [
  agentInputNode,
  agentLlmNode,
  agentToolCallNode,
  agentConditionNode,
  agentOutputNode,
  agentHumanConfirmNode,
];
```

#### 4.3.5 节点物料扩展方式

参考 FlowGram form-materials 的两种使用方式，节点库支持：

1. **包引用**：业务方直接引用 `@shared/components/flow/materials/*` 中的标准节点物料。
2. **CLI/源码复制**：当业务需要深度定制节点样式或交互时，将标准节点物料源码复制到业务包内修改（后续可通过 CLI 模板实现）。

标准节点物料底层基于 React + Ant Design 6 实现；业务方复制后可替换底层组件库或注入自有业务逻辑。

### 4.4 边注册表（Edge Material Registry）

边同样作为物料管理，支持：

```typescript
export interface FlowEdgeMaterial<T = unknown> {
  type: string;
  name: string;
  component?: React.ComponentType<{ edge: FlowEdge<T>; selected: boolean }>;
  form?: React.ComponentType<{ edge: FlowEdge<T>; onChange: (patch: Partial<FlowEdge<T>>) => void }>;
  labelEditable?: boolean;
}
```

默认提供 `sequenceFlow`（直线/折线）与 `agentConnection`（带标签曲线）两种边物料；业务可扩展虚线、条件高亮等样式。

## 5. API 设计

### 5.1 FlowProvider

```typescript
interface FlowProviderProps {
  initialData?: FlowData;
  nodeMaterials: FlowNodeMaterial[];
  themeMode?: 'light' | 'dark' | 'auto';   // 主题模式，默认跟随全局
  paletteCategories?: FlowPaletteCategory[];
  onChange?: (data: FlowData) => void;
  onNodeSelect?: (node: FlowNode | null) => void;
  children: React.ReactNode;
}
```

### 5.2 FlowCanvas

```typescript
interface FlowCanvasProps {
  className?: string;
  readonly?: boolean;        // 是否只读（预览模式）
  minZoom?: number;            // 默认 0.2
  maxZoom?: number;            // 默认 3
  zoomStep?: number;           // 默认 0.1
}
```

### 5.3 FlowToolbar

```typescript
interface FlowToolbarProps {
  title?: string;
  version?: string;
  extraLeft?: React.ReactNode;
  extraRight?: React.ReactNode;
  onSave?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
}
```

### 5.4 FlowPalette

```typescript
interface FlowPaletteCategory {
  key: string;
  label: string;
  items: FlowNodeMaterial[];
}

interface FlowPaletteProps {
  categories?: FlowPaletteCategory[];
  searchable?: boolean;
}
```

### 5.5 FlowPropertyPanel

```typescript
interface FlowPropertyPanelProps {
  title?: string;
  emptyText?: string;
}
```

## 6. 主题与样式

参考 [FlowGram.AI TypeDocs](https://flowgram.ai/auto-docs/index.html) 中 `Playground` / `FlowRenderer` 的颜色通道机制（`baseColor`、`baseActivatedColor` 等），`FlowCanvas` 主题层采用 **Token + CSS Variables** 双层方案：上层按 Mate Platform UI 设计规范的 Design Token；下层通过 CSS 变量驱动 FlowGram 内部样式，覆盖节点、边、网格、面板。

> Mate Platform 当前优先深色（与 Ant Design 6 深色 Token、`theme.ts` 中的 `darkAlgorithm` 对齐），同时支持浅色切换。主题 token 集中在 `packages/shared/src/theme.ts` 的 `getAntdTheme(...)` 中。

### 6.1 双主题 Token

按 `resolvedTheme: 'light' | 'dark'` 生成两套，画布层在 `data-theme="light|dark"` 容器上做覆盖：

#### 6.1.1 深色主题（默认）

```css
.flow-canvas[data-theme='dark'] {
  --flow-bg: #0a0a0a;
  --flow-bg-elevated: #111111;
  --flow-grid: #262626;
  --flow-node-bg: #111111;
  --flow-node-bg-hover: #1a1a1a;
  --flow-node-border: #262626;
  --flow-node-border-hover: #525252;
  --flow-node-border-selected: #fafafa;
  --flow-node-text: #fafafa;
  --flow-node-subtext: #a1a1aa;
  --flow-edge: #52525b;
  --flow-edge-active: #fafafa;
  --flow-edge-text-bg: #0a0a0a;
  --flow-palette-bg: #0f0f0f;
  --flow-panel-bg: #111111;
  --flow-toolbar-bg: #111111;
  --flow-selection-box: rgba(250, 250, 250, 0.08);
  --flow-port-fill: #fafafa;
  --flow-port-border: #262626;
  /* FlowGram 内部通道（与 useBaseColor 对齐） */
  --flow-base-color: #fafafa;
  --flow-base-color-activated: #62d178;
}
```

#### 6.1.2 浅色主题

```css
.flow-canvas[data-theme='light'] {
  --flow-bg: #ffffff;
  --flow-bg-elevated: #ffffff;
  --flow-grid: #e4e4e7;
  --flow-node-bg: #ffffff;
  --flow-node-bg-hover: #f4f4f5;
  --flow-node-border: #e4e4e7;
  --flow-node-border-hover: #a1a1aa;
  --flow-node-border-selected: #18181b;
  --flow-node-text: #18181b;
  --flow-node-subtext: #52525b;
  --flow-edge: #a1a1aa;
  --flow-edge-active: #18181b;
  --flow-edge-text-bg: #ffffff;
  --flow-palette-bg: #fafafa;
  --flow-panel-bg: #ffffff;
  --flow-toolbar-bg: #ffffff;
  --flow-selection-box: rgba(24, 24, 27, 0.08);
  --flow-port-fill: #18181b;
  --flow-port-border: #e4e4e7;
  --flow-base-color: #18181b;
  --flow-base-color-activated: #16a34a;
}
```

### 6.2 主题适配机制

`FlowCanvas` 内部包装一层 `<div className="flow-canvas" data-theme={mode}>`，其中 `mode` 解析优先级：

1. `FlowProvider` 传入的 `themeMode` 属性（`light` / `dark` / `auto`）。
2. `auto` 时取 `useThemeMode().resolvedTheme`。
3. 顶层 `<html data-theme>` 一致性传播。

主题切换时只更替 `data-theme` 属性，CSS 变量实时生效，无需重建 FlowGram 实例。

### 6.3 FlowGram 主题通道对接

FlowGram.AI 提供的主题相关入口：

- `PlaygroundConfigEntityData.theme`：内置主题通道（部分版本支持）。
- `defaultFixedSemiMaterials.components`：底层 UI 组件替换入口。
- 自定义 `renderDefaultNode` / `renderTexts`：节点渲染壳层。

我们在 `useFlowTheme.ts` 中按当前 `mode` 计算一组 `semanticTheme`：

```typescript
export interface FlowSemanticTheme {
  baseColor: string;          // --flow-base-color
  baseActivatedColor: string; // --flow-base-color-activated
  nodeBg: string;             // --flow-node-bg
  nodeBorder: string;         // --flow-node-border
  nodeBorderSelected: string; // --flow-node-border-selected
  nodeText: string;           // --flow-node-text
  nodeSubtext: string;        // --flow-node-subtext
  edge: string;               // --flow-edge
  edgeActive: string;         // --flow-edge-active
  edgeTextBg: string;         // --flow-edge-text-bg
  grid: string;               // --flow-grid
  selectionBox: string;       // --flow-selection-box
}

export function getFlowSemanticTheme(mode: 'light' | 'dark'): FlowSemanticTheme { ... }
```

`FlowCanvas` 初始化时：
1. 调用 `getFlowSemanticTheme(mode)` 取得色板。
2. 写入 `document.documentElement.style.setProperty(...)` 同步 CSS 变量。
3. 通过 `FixedLayoutEditorProvider` 的 `materials` 字段替换底层 `BaseNode` 渲染组件，统一消费 CSS 变量。
4. 通过 `properties.components[FlowRendererKey.NODE]` 等 slot 注入深/浅定制渲染壳，确保 FlowGram 内部 `useBaseColor()` 与外部 Token 一致。

### 6.4 节点默认样式（与双主题对齐）

- 背景：`var(--flow-node-bg)`
- 边框：1px solid `var(--flow-node-border)`，圆角 4px
- 选中态：边框变为 `var(--flow-node-border-selected)`，并显示四个角点
- Hover 态：背景 `var(--flow-node-bg-hover)` + 边框 `var(--flow-node-border-hover)`
- 文字：主标题 `var(--flow-node-text)`，副标题 `var(--flow-node-subtext)`
- 阴影：选中时 `0 0 0 2px var(--flow-selection-box)`

### 6.5 画布背景（点状网格）

```css
.flow-canvas {
  background-color: var(--flow-bg);
  background-image: radial-gradient(
    var(--flow-grid) 1px,
    transparent 1px
  );
  background-size: 16px 16px;
  background-position: 0 0;
}
```

- 深色：`#0a0a0a` + 点 `#262626`
- 浅色：`#ffffff` + 点 `#e4e4e7`

### 6.6 边与端口

- 普通边：`stroke: var(--flow-edge)`，`stroke-width: 1.5`
- 选中/Hover 边：`stroke: var(--flow-edge-active)`，`stroke-width: 2`
- 端口：`fill: var(--flow-port-fill)`，`stroke: var(--flow-port-border)`

### 6.7 工具栏 / 面板

- 工具栏：`background: var(--flow-toolbar-bg)`，底分隔线 `var(--flow-node-border)`
- 左侧组件面板：`background: var(--flow-palette-bg)`
- 右侧属性面板：`background: var(--flow-panel-bg)`

### 6.8 文件落点

```
packages/shared/src/components/flow/
├── styles/
│   ├── flow-canvas.css           # 基础布局与网格
│   ├── flow-canvas.dark.css      # 深色 token
│   ├── flow-canvas.light.css     # 浅色 token
│   └── flow-canvas-tokens.ts     # FlowSemanticTheme 与 getFlowSemanticTheme
├── hooks/
│   └── useFlowTheme.ts           # 当前 mode + semanticTheme + 同步 CSS 变量
```

## 7. 目录结构

```
packages/shared/src/components/flow/
├── index.ts                       # 统一导出
├── FlowProvider.tsx               # 状态上下文
├── FlowCanvas.tsx                 # 画布
├── FlowToolbar.tsx                # 工具栏
├── FlowPalette.tsx                # 组件面板
├── FlowPropertyPanel.tsx          # 属性面板
├── FlowStatusBar.tsx              # 状态栏（可选）
├── hooks/
│   ├── useFlow.ts                 # 消费 FlowContext
│   ├── useFlowHistory.ts          # 撤销/重做
│   └── useFlowZoom.ts             # 缩放控制
├── utils/
│   ├── adapter.ts                 # 业务模型 <-> FlowGram 转换
│   └── layout.ts                  # 节点默认宽高/位置计算
├── materials/                     # 节点/边物料库
│   ├── bpmn/
│   │   ├── index.ts               # BPMN 物料统一导出
│   │   ├── StartNode.tsx
│   │   ├── EndNode.tsx
│   │   ├── UserTaskNode.tsx
│   │   ├── ServiceTaskNode.tsx
│   │   ├── ScriptTaskNode.tsx
│   │   ├── ExclusiveGatewayNode.tsx
│   │   ├── ParallelGatewayNode.tsx
│   │   ├── InclusiveGatewayNode.tsx
│   │   ├── EventBasedGatewayNode.tsx
│   │   ├── SequenceFlowEdge.tsx
│   │   └── forms/                 # BPMN 节点配置表单
│   │       ├── UserTaskForm.tsx
│   │       ├── ServiceTaskForm.tsx
│   │       └── GatewayForm.tsx
│   └── agent/
│       ├── index.ts               # Agent 物料统一导出
│       ├── InputNode.tsx
│       ├── LlmNode.tsx
│       ├── ToolCallNode.tsx
│       ├── KnowledgeRetrievalNode.tsx
│       ├── ConditionNode.tsx
│       ├── LoopNode.tsx
│       ├── SubFlowNode.tsx
│       ├── HumanConfirmNode.tsx
│       ├── OutputNode.tsx
│       ├── CodeNode.tsx
│       ├── AgentConnectionEdge.tsx
│       └── forms/                 # Agent 节点配置表单
│           ├── LlmForm.tsx
│           ├── ToolCallForm.tsx
│           └── KnowledgeRetrievalForm.tsx
├── nodes/
│   └── DefaultNode.tsx            # 通用节点渲染壳（处理选中、拖拽、ports）
└── styles/
    └── flow-canvas.css            # 画布主题样式
```

## 8. 集成计划

### 8.1 第一阶段：封装 `FlowCanvas` 基础组件
- 安装/确认 FlowGram fixed-layout-editor 依赖（已存在 `@flowgram.ai/fixed-layout-editor@^1.0.12`）。
- 实现 `FlowProvider`、`FlowCanvas`、`FlowToolbar`、`FlowPalette`、`FlowPropertyPanel`。
- 实现 `adapter.ts` 双向转换器与基础节点渲染。
- 实现 `materials/bpmn/` 与 `materials/agent/` 下的核心节点物料。
- 在 `packages/shared/src/index.ts` 导出组件与物料。

### 8.2 第二阶段：接入 `portal/ProcessDesignerPage`
- 替换静态 SVG 为 `FlowCanvas`。
- 从 `materials/bpmn` 注册 BPMN 节点物料（开始、结束、用户任务、服务任务、脚本任务、排他/并行/包容/事件网关、顺序流）。
- 复用现有工具栏按钮与右侧属性面板字段。
- 保存/发布时向 TECH-WFE 提交 FlowGram JSON；页面提供 BPMN XML 导入入口作为兼容能力。

### 8.3 第三阶段：接入 `superai/TaskOrchestrationPage`
- 从 `materials/agent` 注册 Agent 编排节点物料（输入、LLM、工具调用、知识检索、条件、循环、子流程、人工确认、输出、代码）。
- 接入 `superai` 已有 API（`generate.ts`、`actions.ts` 等）。
- 保持与现有页面布局风格一致。

## 9. 非功能性需求

- **TypeScript**：所有新增文件提供完整类型定义。
- **可访问性**：工具栏按钮需有 `aria-label`；选中态使用视觉+焦点双反馈。
- **性能**：节点数量超过 200 时启用 `minimap-plugin` 与虚拟化（后续按需）。
- **可测试性**：`FlowProvider` 的状态逻辑独立，可单独编写单元测试。
- **兼容性**：仅使用已安装的 FlowGram 1.0.12 固定布局包，不引入自由布局包。

## 10. 风险与依赖

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| FlowGram fixed-layout-editor API 与官方文档示例有差异 | 中 | 以 `@flowgram.ai/fixed-layout-editor@1.0.12` 实际导出为准，必要时查看源码类型 |
| 深色主题与 FlowGram 默认浅色皮肤冲突 | 中 | 通过 CSS 变量覆盖内部节点与画布背景样式 |
| 浅色主题切换后 FlowGram 内部组件颜色不一致 | 中 | 通过 `materials.components` + 自定义 `renderDefaultNode` 双层覆盖；主题切换时只改 `data-theme`，不重建 FlowGram 实例 |
| 业务模型与 FlowGram 内部模型字段不完全对齐 | 中 | 转换器保留 `extData` 字段透传业务数据 |
| BPMN XML 导入/导出与 FlowGram JSON 语义不完全等价 | 中 | 复用后端 `BpmnToFlowGramConverter` 处理导入；导出功能后续按需实现 |
| 两个页面同时接入导致 API 频繁调整 | 低 | 先完成 `portal` 接入并稳定 API 后再接入 `superai` |
| 节点物料类型较多，首次实现工作量大 | 中 | 按阶段交付：先完成 BPMN 核心节点 + Agent 核心节点，其余类型后续迭代补充 |
| 自定义节点物料与 FlowGram 内部节点注册机制耦合 | 低 | 通过 `DefaultNode` 壳层统一封装，隔离业务渲染与 FlowGram 节点模型 |

## 11. 验收标准

- [ ] `FlowCanvas` 组件可在 `portal` 中渲染 BPMN 节点与连线。
- [ ] 节点可被拖拽、单击选中、双击或右侧面板编辑。
- [ ] 画布支持滚轮/按钮缩放，支持“适应屏幕”。
- [ ] 深色/浅色两套主题均与 Ant Design 6 Token 视觉一致，切换无闪烁、无重渲染闪烁。
- [ ] 主题切换通过 `data-theme` 与 `getFlowSemanticTheme` 统一驱动 CSS 变量。
- [ ] `superai` 任务编排页面复用同一组件，仅节点类型不同。
- [ ] 节点库支持通过 `materials/bpmn` 与 `materials/agent` 扩展新节点类型。
- [ ] `pnpm run typecheck` 无新增类型错误。
