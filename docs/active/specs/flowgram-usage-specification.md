# FlowGram.AI 使用规范（Mate Platform v1.4）

> **创建日期**：2026-07-25
> **版本**：v1.0
> **关联项目**：Mate Platform v1.4 重构期·R1.5
> **前置文档**：[`2026-07-23-flow-canvas-design.md`](./2026-07-23-flow-canvas-design.md)（架构层）、[`CLAUDE.md`](../../CLAUDE.md)（项目级约束）

本规范是 Mate Platform 使用 FlowGram.AI 时的**强制参考**，覆盖已装 47 个 `@flowgram.ai/*` 包的能力、官方 9 个 CSS 主题变量、3 个官方坑、双布局（fixed + free）集成范式、节点 / 表单 / 物料体系、与 Mate 设计稿 token 的对接方式，以及与三大流程场景（AI 编排 / 表单审批 / 业务触发）的对应落地路径。

**Why**：v1.3 阶段多次踩 FlowGram 三个官方坑（`formMeta` 不自动生效、`renderDefaultNode` 拖拽绑定、`fitView` 时机敏感），且只用到 47 个官方包中的 2.5 个。本规范把"用 FlowGram 的正确姿势"沉淀成可复用规则，确保后续每接入一个业务模块、每加一个节点、每做一次主题切换都不重复踩坑。

**How to apply**：
1. **新建任何 flowgram 画布**：必须复用 `@mate/shared/flow` 的 `FlowgramEditor` / `FlowDesigner`，禁止直接调用 `@flowgram.ai/fixed-layout-editor` 的 `FixedLayoutEditorProvider`
2. **新增节点**：先在 `node-registries.ts` 加 `FlowNodeRegistry`，再在 `node-render.tsx` 加专属卡片（若需要），不要每个页面重复注册
3. **修改主题色**：只能改 `packages/shared/src/components/flow/styles/flowgram-theme.css`，不要在页面里写 CSS 覆盖
4. **接入新插件**：必须经本规范评审，确认插件与 `fixed-layout-editor` 的兼容性矩阵

---

## 1. 能力总览

### 1.1 已装的 47 个官方包

| 类别 | 包名 | 数量 |
|---|---|---|
| **编辑核心** | `fixed-layout-editor`、`free-layout-editor`、`editor`、`core` | 4 |
| **节点 / 文档** | `node`、`document`、`reactive`、`renderer`、`utils`、`playground-react`、`command`、`history`、`playground-reactiv*` | 9 |
| **Fixed 布局专用** | `fixed-layout-core`、`fixed-history-plugin`、`fixed-drag-plugin`、`minimap-plugin`、`fixed-semi-materials` | 5 |
| **Free 布局专用** | `free-layout-core`、`free-history-plugin`、`free-lines-plugin`、`free-node-panel-plugin`、`free-snap-plugin`、`free-stack-plugin`、`free-hover-plugin`、`free-auto-layout-plugin` | 8 |
| **表单 / 表单材料** | `form`、`form-core`、`form-materials`、`json-schema` | 4 |
| **增强插件** | `background-plugin`、`group-plugin`、`export-plugin`、`shortcuts-plugin`、`panel-manager-plugin`、`redux-devtool-plugin`、`i18n`、`i18n-plugin` | 8 |
| **变量** | `variable-core`、`variable-layout-plugin`、`node-variable-plugin` | 3 |
| **节点核心** | `node-core-plugin`、`materials-plugin`、`select-box-plugin` | 3 |
| **代码编辑** | `coze-editor` + `@coze-editor/code-language-{sql,json,typescript,python,shell}` | 6 |
| **总计** | | **48**（含 coze-editor 子包） |

> **关键事实**：本地 `node_modules/.pnpm/@flowgram.ai*/` 目录下确认 47 个直接依赖包，加上 coze-editor 系列合计 48 个独立包。

### 1.2 当前已接入 / 待接入（截至 v1.4 Sprint 1）

| 包 | Sprint 1（当前） | 待办 |
|---|:-:|:-:|
| `fixed-layout-editor` | ✅ | — |
| `minimap-plugin` | ✅ | — |
| `fixed-semi-materials` | ✅ | — |
| `materials-plugin` | ✅ | — |
| `form-core` | ✅（间接） | — |
| `background-plugin` | ✅ | — |
| `export-plugin` | ✅ | — |
| `shortcuts-plugin` | ✅ | — |
| `free-snap-plugin` | ✅ | — |
| `free-hover-plugin` | ✅ | — |
| `form-materials`（40+ 组件） | 🟡 部分（VariableSelector / PromptEditor / ConditionRow / CodeEditor） | 全量 |
| `free-layout-editor` + 6 个 free-* 插件 | 🟡 占位（`@mate/shared/flow` 已声明依赖） | Sprint 2 落地 |
| `group-plugin` | ❌ | Sprint 4 |
| `panel-manager-plugin` | ❌ | Sprint 4 |
| `auto-layout-plugin` | ❌ | Sprint 2 |
| `i18n` + `i18n-plugin` | ❌ | Sprint 4 |
| `redux-devtool-plugin` | ❌ | Sprint 4 |
| `json-schema` | ❌ | Sprint 4 |

---

## 2. 官方 9 个 CSS 主题变量（**重要发现**）

> **2026-07-25 修正**：之前判断"FlowGram 不提供官方主题机制"是错误的。源码 `node_modules/.pnpm/@flowgram.ai+fixed-layout-e_*/node_modules/@flowgram.ai/fixed-layout-editor/index.css` L6-17 证实 **FlowGram 官方暴露 9 个 CSS 变量**，仅未在文档中宣传。

### 2.1 变量清单

```css
:root {
  --g-selection-background: #4d53e8;              /* 品牌主色：节点选中/连线/端口/hover */
  --g-editor-background: #f2f3f5;                /* 画布背景（默认浅灰） */
  --g-playground-select: var(--g-selection-background);
  --g-playground-hover: var(--g-selection-background);
  --g-playground-line: var(--g-selection-background);     /* 连线颜色 */
  --g-playground-blur: #999;                            /* 失焦连线 */
  --g-playground-selectBox-outline: var(--g-selection-background);
  --g-playground-selectBox-background: rgba(141, 144, 231, 0.1);
  --g-playground-select-hover-background: rgba(77, 83, 232, 0.1);
  --g-playground-select-control-size: 12px;
}
```

### 2.2 注入位置（避免污染全局）

**禁止**在 `:root` 覆盖（会污染 portal 全站）  
**必须**在 `.gedit-playground` 容器作用域下覆盖：

```css
.gedit-playground,
.gedit-playground-pipeline,
.gedit-playground-layer {
  --g-selection-background: var(--primary, #fafafa);
  --g-editor-background: var(--background, #0a0a0a);
  --g-playground-select: var(--primary, #fafafa);
  --g-playground-hover: var(--primary, #fafafa);
  --g-playground-line: var(--primary, #fafafa);
  --g-playground-blur: var(--muted-foreground, #a1a1a1);
  --g-playground-selectBox-outline: var(--primary, #fafafa);
  --g-playground-selectBox-background: rgba(250, 250, 250, 0.06);
  --g-playground-select-hover-background: rgba(250, 250, 250, 0.06);
  --g-playground-select-control-size: 12px;
}
```

→ 实际生效位置：`packages/shared/src/components/flow/styles/flowgram-theme.css`

### 2.3 配套硬编码颜色兜底

`fixed-layout-editor/index.css` 内仅 3 处**未走变量**的硬编码颜色，必须单独覆盖：

```css
.gedit-selector-bounds-background { background-color: rgba(250, 250, 250, 0.04) !important; }
.gedit-playground-loading { color: var(--foreground, #fafafa); }
.gedit-grid-svg .gedit-grid-dot { fill: var(--border, #262626); }
```

### 2.4 Semi Design 配套

`fixed-semi-materials` 内部使用 `@douyinfe/semi-ui`，**不走 `--g-*` 变量**。需用 Semi 的 `ConfigProvider` + Algorithm Theme 单独覆盖：

```tsx
import { ConfigProvider } from '@douyinfe/semi-ui';
import { getMateSemiTheme } from '@mate/shared/flow';

<ConfigProvider theme={getMateSemiTheme()}>
  <FlowgramEditor {...props} />
</ConfigProvider>
```

`getMateSemiTheme()` 实现见 `packages/shared/src/components/flow/flowgram-demo/semi-theme.ts`。

---

## 3. 三个必须规避的官方坑（CLAUDE.md 已记录，强制复述）

### 3.1 `formMeta` 不自动生效

**症状**：在 `nodeRegistries` 里给了 `formMeta.render`，画布上还是显示默认 input 卡片。  
**根因**：`FixedLayoutEditorProvider` 的 `getNodeDefaultRegistry(type)` 返回默认的 `<Field name="title">` + `<Field name="content">`，**不会自动套用外部传入的 `formMeta`**。  
**正解**：必须**自己包一层 Provider**，覆盖 `getNodeDefaultRegistry`，把每个节点的 `formMeta` 显式塞进去。`packages/shared/src/components/flow/flowgram-demo/editor.tsx` 已实现该封装，所有页面通过 `FlowgramEditor` 间接调用，**禁止在业务页面里直接用 `FixedLayoutEditorProvider`**。

### 3.2 `renderDefaultNode` 拖拽绑定

**症状**：节点既无法拖动也无法选中连线。  
**根因**：自定义节点外壳时没绑定 `onMouseDown → nodeRender.startDrag(e) + stopPropagation`。  
**正解**：`packages/shared/src/components/flow/flowgram-demo/components/base-node.tsx` 与 `apps/portal/src/pages/admin/custom-base-node.tsx` 已有正解，所有业务节点必须基于此壳层扩展，不要重写外壳。

### 3.3 `fitView` 时机敏感

**症状**：编辑器自带的 `pg.config.fitView(doc.root.bounds.pad(30))` 在 `initialData` 传入时常常不生效，画布出现黑边或节点挤在角落。  
**根因**：FlowGram 内部 playground 异步渲染，`onInit` 时画布 DOM 还没准备好。  
**正解**：`apps/portal/src/pages/admin/flowgram-editor.tsx` 内的 `<ForceFitViewport>` 组件，用 demo 数据的**逻辑坐标常量** + `ResizeObserver` + 多次重试，**绝对不要用已被 transform 的 `.gedit-flow-background-layer` DOM rect**（会产生循环）。

---

## 4. 双布局编辑器（fixed + free）

### 4.1 何时用哪种

| 场景 | 用法 | 理由 |
|---|---|---|
| **表单审批（BPMN）** | `fixed-layout-editor` | 节点左右对齐、流程结构清晰、Tech-WFE 自研引擎可直接消费 JSON |
| **AI Agent 编排** | `free-layout-editor` | 节点自由排布、连线任意角度、支持分支/循环/子图，SAA Graph Core 自然映射 |
| **业务流程（业务触发）** | `fixed-layout-editor` | 与审批同结构，技术栈统一（Tech-ACTION + Tech-ONT） |
| **复杂混合场景** | `free-layout-editor` | 自由画布可嵌套分支/循环/子图 |

### 4.2 API 路径

```tsx
// 固定布局（默认）
import { FlowgramEditor } from '@mate/shared/flow';
<FlowgramEditor mode="bpmn" nodeRegistries={BPMN_REGISTRIES} />

// 自由布局（v1.4 Sprint 2 启用）
import { FreeFlowgramEditor } from '@mate/shared/flow';
<FreeFlowgramEditor mode="agent" nodeRegistries={AGENT_REGISTRIES} plugins={[createFreeStackPlugin(), createFreeSnapPlugin(), createFreeHoverPlugin()]} />
```

### 4.3 Free 布局必接插件

| 插件 | 必要性 | 作用 |
|---|---|---|
| `createFreeHistoryPlugin` | 必须 | Undo/Redo，含 10 种 Operation |
| `createFreeLinesPlugin` | 必须 | 拖拽连线、端口渲染 |
| `createFreeStackPlugin` | 推荐 | hover/selected 节点自动浮顶 |
| `createFreeHoverPlugin` | 推荐 | hover 高亮 |
| `createFreeSnapPlugin` | 推荐 | 拖拽时显示 top/bottom/left/right/mid 对齐辅助线 |
| `createFreeNodePanelPlugin` | 推荐 | 节点面板 |
| `createAutoLayoutPlugin` | 按需 | DAG 自动布局（Dagre 算法） |

---

## 5. 节点体系

### 5.1 三种节点注册位置（**强制**）

1. **`packages/shared/src/components/flow/node-registries.ts`** — Mate 17 种标准节点（`BPMN_NODE_REGISTRIES` 7 + `AGENT_NODE_REGISTRIES` 7 + `BUSINESS_FLOW_REGISTRIES` 3），所有页面共享
2. **`apps/portal/src/pages/admin/node-render.tsx`** — admin/components 节点库的 17 种专属卡片（每种节点的具体内容展示），通过 `AC_NODE_RENDER_REGISTRIES` 注入到 FlowgramEditor
3. **业务页面** — 若有特殊节点，在 `nodeRegistries`/`customRegistries` 参数注入；**禁止**直接修改 `nodeRegistries.ts`（会被其他页面影响）

### 5.2 节点数据结构（业务模型）

```ts
interface FlowNode<T = unknown> {
  id: string;          // nanoid
  type: string;        // 'bpmnStart' / 'agent_llm' / 'business_trigger' 等
  name: string;        // 中文显示名
  x: number;           // 逻辑坐标
  y: number;
  width?: number;      // 默认 150
  height?: number;     // 默认 70
  data?: T;            // 业务自定义数据
}
```

→ 完整定义见 `packages/shared/src/components/flow/flow-types.ts`

### 5.3 FlowNodeRegistry 配置项（最少必填）

```ts
const MY_NODE: FlowNodeRegistry = {
  type: 'myNode',
  meta: { defaultExpanded: true },   // 必填，否则 formMeta 不渲染
  onAdd: () => ({                   // 拖入画布时的初始节点
    id: `myNode_${nanoid(5)}`,
    type: 'myNode',
    data: { title: '我的节点', content: '描述' },
  }),
};
```

### 5.4 节点专属卡片（formMeta.render）

```ts
formMeta: {
  render: () => <NodeCard type="myNode" />,  // 自定义 React 卡片
}
```

卡片样式约束：
- 使用项目 token：`--card / --border / --foreground / --muted-foreground / --info / --purple / --success / --warning / --destructive`
- **禁止**写死 hex 颜色
- **禁止**引入 Antd 组件（避免与 Antd 6.0 主题耦合）

→ 完整模板见 `apps/portal/src/pages/admin/node-render.tsx`

---

## 6. 表单材料（form-materials）

### 6.1 40+ 组件清单

| 组件 | 用途 | 典型节点 |
|---|---|---|
| `VariableSelector` / `BatchVariableSelector` | 变量选择器 | Agent 输入/输出 |
| `PromptEditor` / `PromptEditorWithInputs` / `PromptEditorWithVariables` | Prompt 编辑 | LLM 节点 |
| `ConditionRow` / `DBConditionRow` / `useCondition` | 条件构建 | 条件分支 |
| `CodeEditor` / `JsonCodeEditor` / `SQLCodeEditor` / `TypeScriptCodeEditor` / `PythonCodeEditor` / `ShellCodeEditor` | 代码编辑 | 服务任务 / API 调用 |
| `JsonSchemaEditor` / `JsonSchemaCreator` | JSON Schema 编辑 | 业务对象 |
| `BatchOutputs` / `AssignRow` / `AssignRows` | 批量输出 | 流程出口 |
| `DynamicValueInput` / `ConstantInput` | 动态值 / 常量输入 | 变量绑定 |
| `TypeSelector` / `DisplaySchemaTag` / `DisplaySchemaTree` | 类型选择 / Schema 标签 | 数据类型 |
| `DisplayFlowValue` / `DisplayInputsValues` / `DisplayOutputs` | 只读展示 | 历史 / 预览 |

### 6.2 接入规范

```tsx
// 1. 在 FlowgramEditor 的 materials.components 注入
materials: {
  components: {
    ...defaultFixedSemiMaterials,
    [FlowRendererKey.NODE]: CustomNodeRender,  // 自定义节点壳
  },
}
```

**禁止**直接在 `nodeRegistries` 里嵌入 form-material 组件——必须在 `materials.components` 注册。

---

## 7. 插件体系

### 7.1 已启用的官方插件

| 插件 | 包 | 启用版本 | 必填参数 |
|---|---|---|---|
| `createMinimapPlugin` | `minimap-plugin` | v1.0.12 | `disableLayer / canvasStyle` |
| `createBackgroundPlugin` | `background-plugin` | v1.0.12 | `backgroundColor / dotColor / dotSize / gridSize / logo` |
| `createExportPlugin` | `export-plugin` | v1.0.12 | `getFilename / watermarkSVG` |
| `createShortcutsPlugin` | `shortcuts-plugin` | v1.0.12 | `registerShortcuts(registry)` |
| `createFreeSnapPlugin` | `free-snap-plugin` | v1.0.12 | — |
| `createFreeHoverPlugin` | `free-hover-plugin` | v1.0.12 | — |
| `createMaterialsPlugin` | `materials-plugin` | v1.0.12 | `components / renderNodes / renderDefaultNode / renderTexts` |

### 7.2 plugins 配置位置

```ts
// packages/shared/src/components/flow/flowgram-demo/hooks/use-editor-props.tsx
plugins: () => [
  createBackgroundPlugin({ backgroundColor: 'var(--background)', dotColor: 'var(--border)' }),
  createMinimapPlugin({ ... }),
  createExportPlugin({ ... }),
  createShortcutsPlugin({ registerShortcuts: (r) => r.addHandlers({ ... }) }),
  createFreeSnapPlugin({}),
  createFreeHoverPlugin({}),
]
```

### 7.3 快捷键注册示例

```ts
registerShortcuts: (registry) => {
  registry.addHandlers(
    { commandId: 'flow.save', shortcuts: ['Cmd+S', 'Ctrl+S'], execute: () => save() },
    { commandId: 'flow.copy', shortcuts: ['Cmd+C', 'Ctrl+C'], execute: () => copy() },
    { commandId: 'flow.paste', shortcuts: ['Cmd+V', 'Ctrl+V'], execute: () => paste() },
    { commandId: 'flow.undo', shortcuts: ['Cmd+Z', 'Ctrl+Z'], execute: () => undo() },
    { commandId: 'flow.redo', shortcuts: ['Cmd+Shift+Z', 'Ctrl+Y'], execute: () => redo() },
    { commandId: 'flow.delete', shortcuts: ['Delete', 'Backspace'], execute: () => deleteNode() },
  );
}
```

---

## 8. 与 Mate 设计稿 token 对接

### 8.1 项目侧 CSS 变量（`packages/shared/src/global.css`）

```css
:root {
  --background: #0a0a0a;
  --card: #111111;
  --border: #262626;
  --foreground: #fafafa;
  --muted: #1a1a1a;
  --muted-foreground: #a1a1a1;
  --primary: #fafafa;
  --info: #3b82f6;
  --success: #62d178;
  --warning: #eab308;
  --destructive: #ff6166;
  --purple: #a855f7;
  --info-subtle: rgba(59, 130, 246, 0.1);
  --success-subtle: rgba(98, 209, 120, 0.1);
  --warning-subtle: rgba(234, 179, 8, 0.1);
  --destructive-subtle: rgba(255, 97, 102, 0.1);
  --purple-subtle: rgba(168, 85, 247, 0.1);
  --radius: 8px;
}
```

### 8.2 双向映射表

| 设计稿 token | FlowGram 变量 | 用途 |
|---|---|---|
| `--background` | `--g-editor-background` | 画布背景 |
| `--primary` | `--g-selection-background` | 主色（连线/选中/端口） |
| `--muted-foreground` | `--g-playground-blur` | 失焦连线 |
| `--foreground` | `.gedit-playground-loading color` | Loading 文字 |
| `--border` | `.gedit-grid-svg .gedit-grid-dot fill` | 网格点 |
| `--card` / `--border` | 节点卡片背景与边框 | `renderDefaultNode` 自定义 |
| `--info` / `--purple` / `--success` / `--warning` | 节点分类彩条 | 17 卡片分类 |

### 8.3 浅色 / 深色切换

```ts
// packages/shared/src/components/flow/flowgram-demo/theme.ts
export type FlowgramTheme = 'light' | 'dark';

export function getThemeVariables(theme: FlowgramTheme): Record<string, string> {
  return theme === 'dark' ? {
    '--g-selection-background': '#fafafa',
    '--g-editor-background': '#0a0a0a',
    '--g-playground-blur': '#a1a1a1',
    '--g-playground-selectBox-background': 'rgba(250, 250, 250, 0.06)',
    // ...
  } : {
    '--g-selection-background': '#18181b',
    '--g-editor-background': '#ffffff',
    '--g-playground-blur': '#52525b',
    // ...
  };
}
```

→ `flowgram-theme.css` 通过 `data-theme` 属性切换

---

## 9. 模块对接路径

### 9.1 已有引用（v1.4 Sprint 1 现状）

| 模块 | 文件 | 用法 | 状态 |
|---|---|---|:-:|
| **组件库（节点 catalog）** | `apps/portal/src/pages/admin/AdminComponentsPage.tsx` | `<ACFlowgramEditor>` 直接 `FixedLayoutEditorProvider` + 17 专属卡片 + 导出 JSON/PNG | ✅ |
| **节点库专用壳** | `apps/portal/src/pages/admin/flowgram-editor.tsx` | 覆盖 `getNodeDefaultRegistry` + `ForceFitViewport` + Semi ConfigProvider | ✅ |
| **三场景统一编辑器** | `packages/shared/src/components/flow/FlowDesigner.tsx` | `<FlowgramEditor>` + 工具条 + localStorage | ✅ |
| **公共壳** | `packages/shared/src/components/flow/flowgram-demo/editor.tsx` | `FixedLayoutEditorProvider` + 注入 17 registry + Semi ConfigProvider | ✅ |
| **editorProps 工厂** | `packages/shared/src/components/flow/flowgram-demo/hooks/use-editor-props.tsx` | minimap + materials + **background + export + shortcuts + free-hover** 插件 | ✅ |
| **主题色注入器** | `packages/shared/src/components/flow/flowgram-demo/theme-injector.ts` | 注入 9 个 `--g-*` CSS 变量覆盖层 | ✅ |
| **主题色 CSS 源** | `packages/shared/src/components/flow/styles/flowgram-theme.css` | 9 变量 + 3 处硬编码兜底 + light/dark 主题 | ✅ |
| **APP-APPHUB 流程设计器** | `apps/portal/src/pages/apps/ProcessDesignerPage.tsx` | `<FlowDesigner mode="bpmn">` （审批流） | ✅ |
| **admin 节点外壳** | `apps/portal/src/pages/admin/custom-base-node.tsx` | 自写节点壳（onMouseDown → startDrag） | ✅ |
| **admin 17 卡片** | `apps/portal/src/pages/admin/node-render.tsx` | 17 种专属卡片渲染 | ✅ |

### 9.2 待接入（v1.4 Sprint 2-4 规划）

| 模块 | 文件 | 用途 | Sprint |
|---|---|---|:-:|
| **APP-COPILOT 顶层调度** | `apps/portal/src/pages/superai/SuperAIPage.tsx` | free-layout Agent 编排（SAA Graph Core 可视化） | 2 |
| **APP-DW 数字员工配置** | `apps/portal/src/pages/agents/AgentsKnowledgePage.tsx` | 数字员工 Agent 编排画布 | 2 |
| **APP-DW 任务编排** | `apps/portal/src/pages/agents/AgentsTasksPage.tsx` | 任务工作流编排 | 2 |
| **APP-APPHUB 表单+流程联动** | `apps/portal/src/pages/apps/AppConfigPage.tsx` | 表单 → 流程映射可视化 | 3 |
| **APP-MCPHUB 工具编排** | `apps/portal/src/pages/mcp/McpToolsPage.tsx` | MCP 工具编排 | 3 |

### 9.3 接入示例（任意业务页面）

```tsx
import {
  FlowDesigner,           // 三场景统一编辑器（推荐）
  FlowgramEditor,         // 裸 FlowgramEditor
  AGENT_NODE_REGISTRIES,  // AI Agent 节点库
  BPMN_NODE_REGISTRIES,   // BPMN 审批节点库
  BUSINESS_FLOW_REGISTRIES, // 业务节点库
  ALL_NODE_REGISTRIES,    // 全部 17 种
} from '@mate/shared/flow';

// 1. 三场景统一编辑器（推荐）
<FlowDesigner mode="bpmn" storageKey="my-flow-v1" height={640} />

// 2. 裸 FlowgramEditor + 自定义 registries
<FlowgramEditor
  initialData={flowDataToFlowgram(myData)}
  nodeRegistries={ALL_NODE_REGISTRIES}
  onChange={(json) => saveToBackend(json)}
/>

// 3. free-layout（v1.4 Sprint 2）
<FlowgramEditor
  mode="free"
  initialData={...}
  nodeRegistries={AGENT_NODE_REGISTRIES}
  plugins={[
    createFreeHistoryPlugin(),
    createFreeLinesPlugin(),
    createFreeStackPlugin(),
    createFreeHoverPlugin(),
    createFreeSnapPlugin(),
  ]}
/>
```

---

## 10. 验证清单

每完成一次 FlowGram 接入，**必须**逐项验证：

- [ ] **视觉**：画布背景 = `--background`、主色 = `--primary`、连线 = `--primary`
- [ ] **拖拽**：节点可拖动、端口显示 `startDrag` + `stopPropagation`
- [ ] **选中**：单选 / 多选 / 框选均生效，selectBox 是 `--primary`
- [ ] **删除**：选中节点 → Delete 键删除、Trash2 图标点击删除
- [ ] **撤销 / 重做**：Ctrl+Z / Ctrl+Y 生效
- [ ] **导出**：导出按钮可下载 JSON / PNG / SVG
- [ ] **网格**：网格点 = `--border`，Logo 配置生效
- [ ] **快捷键**：Ctrl+C/V/Z/Y/S/Delete 全部生效
- [ ] **持久化**：localStorage 保存 / 加载 / 清空生效
- [ ] **全屏**：浏览器原生 Fullscreen API + Esc 退出 + 自定义关闭按钮
- [ ] **fitView**：进入即居中、resize 重算、不溢出
- [ ] **主题色切换**：data-theme 切换无闪烁
- [ ] **TypeScript**：`pnpm --filter @mate/portal typecheck` 无新增错误
- [ ] **打包**：`pnpm --filter @mate/portal build` 无新增 warning

---

## 11. 风险与禁止项

### 11.1 风险

| 风险 | 缓解 |
|---|---|
| FlowGram 1.0.12 官方文档与实际 API 差异 | 以 `node_modules/.pnpm/@flowgram.ai+*/` 源码为准 |
| 深色主题与 FlowGram 默认浅色冲突 | 通过 9 个 CSS 变量 + 3 处硬编码兜底 |
| Antd 6.0 与 FlowGram 内部 Semi 组件样式串扰 | FlowgramEditor 必须包在 Antd ConfigProvider **内层**、Semi ConfigProvider **外层** |
| 17 节点卡片样式漂移 | 所有卡片样式走 `node-render.tsx` 单一入口 |

### 11.2 禁止项（强制）

- ❌ **禁止**业务页面直接 `import { FixedLayoutEditorProvider } from '@flowgram.ai/fixed-layout-editor'`
- ❌ **禁止**在 `:root` 覆盖 `--g-*` 变量（会污染全局）
- ❌ **禁止**在节点卡片里写 hex 颜色或硬编码 `var(--xxx)`
- ❌ **禁止**在 `renderDefaultNode` 里漏掉 `onMouseDown → startDrag + stopPropagation`
- ❌ **禁止**在 `nodeRegistries` 里嵌入 `form-material` 组件（必须走 `materials.components`）
- ❌ **禁止**跳过 `getNodeDefaultRegistry` 覆盖
- ❌ **禁止**在 FreeLayoutEditor 里漏装 `createFreeHistoryPlugin`（会导致 undo/redo 不可用）
- ❌ **禁止**后端新增 Python 服务（CLAUDE.md 强制 Java 25）

---

## 12. 版本兼容矩阵

| 官方版本 | 项目锁定 | 备注 |
|---|---|---|
| `@flowgram.ai/*` | 1.0.12（与 React 18 兼容） | React 19 兼容未官方声明，需 POC |
| `@douyinfe/semi-ui` | 2.80.0 | 已知与 React 18 兼容 |
| React | 18.3.x（业务）/ 19.x（项目） | 锁定 18.3.x 给 FlowGram 用 |
| Antd | 6.0.0 | 与 FlowGram 解耦 |

---

## 13. 修订记录

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-25 | 首版：覆盖 47 个官方包、9 个 CSS 变量、3 个官方坑、强制规范 | Claude |

---

## 附录 A：关键文件清单

| 文件 | 路径 | 状态 |
|---|---|---|
| 公共壳 | `packages/shared/src/components/flow/flowgram-demo/editor.tsx` | ✅ v1.4 Sprint 1 升级 |
| EditorProps 工厂（含 5 插件） | `packages/shared/src/components/flow/flowgram-demo/hooks/use-editor-props.tsx` | ✅ v1.4 Sprint 1 升级 |
| 主题色注入器 | `packages/shared/src/components/flow/flowgram-demo/theme-injector.ts` | 🆕 Sprint 1 新增 |
| 主题色 CSS 源（参考） | `packages/shared/src/components/flow/styles/flowgram-theme.css` | 🆕 Sprint 1 新增 |
| Semi 主题适配 | `packages/shared/src/components/flow/flowgram-demo/semi-theme.ts` | 🆕 Sprint 1 新增 |
| 17 节点注册 | `packages/shared/src/components/flow/node-registries.ts` | ✅ 已落地 |
| 17 节点卡片 | `apps/portal/src/pages/admin/node-render.tsx` | ✅ 已落地 |
| Admin 节点壳 | `apps/portal/src/pages/admin/flowgram-editor.tsx` | ✅ v1.4 Sprint 1 升级 |
| Admin 节点外壳 | `apps/portal/src/pages/admin/custom-base-node.tsx` | ✅ 已落地 |
| FlowDesigner 三场景 | `packages/shared/src/components/flow/FlowDesigner.tsx` | ✅ 已落地 |
| Admin/Components 页面 | `apps/portal/src/pages/admin/AdminComponentsPage.tsx` | ✅ v1.4 Sprint 1 升级（新增导出 JSON/PNG 按钮） |
| APP-APPHUB 流程设计器 | `apps/portal/src/pages/apps/ProcessDesignerPage.tsx` | ✅ 通过 `FlowDesigner` 复用 |

## 附录 C：v1.4 Sprint 1 变更总览（2026-07-25）

| 变更类型 | 文件 | 说明 |
|---|---|---|
| **新增** | `docs/superpowers/specs/flowgram-usage-specification.md` | 完整使用规范（13 章 + 3 附录） |
| **新增** | `CLAUDE.md` | 新增 4 条 FlowGram 强制规则 + v1.4 R1.5 Sprint 1 落地记录 |
| **新增** | `packages/shared/src/components/flow/styles/flowgram-theme.css` | 9 个 `--g-*` 变量 + 3 处硬编码兜底 |
| **新增** | `packages/shared/src/components/flow/flowgram-demo/theme-injector.ts` | 主题色注入器（字符串内联避免 Vite `?inline` 边角） |
| **新增** | `packages/shared/src/components/flow/flowgram-demo/semi-theme.ts` | Semi Design ConfigProvider 主题适配 |
| **升级** | `packages/shared/src/components/flow/flowgram-demo/editor.tsx` | mount 时注入主题色 + 包 Semi ConfigProvider |
| **升级** | `packages/shared/src/components/flow/flowgram-demo/hooks/use-editor-props.tsx` | 新增 `buildEditorPropsWith` 函数 + 启用 background/export/shortcuts/free-hover 插件 |
| **升级** | `packages/shared/src/components/flow/index.ts` | 导出新工具 |
| **升级** | `apps/portal/src/pages/admin/flowgram-editor.tsx` | mount 时注入主题色 + 包 Semi ConfigProvider + 改用 `buildEditorPropsWith` |
| **升级** | `apps/portal/src/pages/admin/AdminComponentsPage.tsx` | 工具栏新增「导出 JSON」/「导出 PNG」按钮（v1.4 临时方案：SVG 导出） |
| **package.json** | `packages/shared/package.json` | 新增依赖：`background-plugin / export-plugin / form-materials / coze-editor / free-snap-plugin / free-stack-plugin / free-hover-plugin / free-lines-plugin / free-history-plugin / free-node-panel-plugin / free-auto-layout-plugin` |

## 附录 B：扩展阅读

- [FlowGram.AI 官网](https://flowgram.ai/)（WebFetch 受限）
- [FlowGram.AI GitHub](https://github.com/bytedance/flowgram.ai)（WebFetch 受限，本地源码为准）
- [`docs/superpowers/specs/2026-07-23-flow-canvas-design.md`](./2026-07-23-flow-canvas-design.md) — 架构层设计
- [`docs/flow-component-catalog.md`](../../flow-component-catalog.md) — 组件库节点目录
- [`docs/flow-sidebar-group-accent.md`](../../flow-sidebar-group-accent.md) — 节点分组色族
- [`CLAUDE.md`](../../CLAUDE.md) — 项目级强制约束