# FlowGram.AI 集成规范（mate-platform）

> 本文档沉淀 FlowGram.AI 在 metaplatform-frontend 中的踩坑、API 速查、模板代码。下次直接照抄，不用再翻官方文档 / 翻 node_modules。

---

## 1. 基础架构

### 1.1 安装

```bash
pnpm add @flowgram.ai/free-layout-editor
```

CSS **必须**显式导入（否则基础样式全无）：

```ts
import '@flowgram.ai/free-layout-editor/index.css';
```

### 1.2 最小可运行模板

```tsx
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  useNodeRender,
  type WorkflowJSON,
  type WorkflowNodeRegistry,
} from '@flowgram.ai/free-layout-editor';
import '@flowgram.ai/free-layout-editor/index.css';

const initialData: WorkflowJSON = {
  nodes: [{ id: 'n1', type: 'custom', meta: { position: { x: 0, y: 0 } } }],
  edges: [],
};

const nodeRegistries: WorkflowNodeRegistry[] = [
  { type: 'custom', meta: { size: { width: 220, height: 80 } } },
];

function MyNode() {
  const { node, nodeRef } = useNodeRender();
  return (
    <div
      ref={nodeRef as unknown as React.RefObject<HTMLDivElement>}
      style={{ width: '100%', height: '100%', background: '#111' }}
    >
      {node.toJSON().id}
    </div>
  );
}

export default function Canvas() {
  return (
    <FreeLayoutEditorProvider
      initialData={initialData}
      nodeRegistries={nodeRegistries}
      materials={{ renderDefaultNode: MyNode }}
      onAllLayersRendered={(ctx) => ctx.tools.fitView(false)}
    >
      <EditorRenderer style={{ width: '100%', height: '100%' }} />
    </FreeLayoutEditorProvider>
  );
}
```

---

## 2. 关键概念 / 坑点速查

### 2.1 必须有 `<FreeLayoutEditorProvider>` + `<EditorRenderer />` 两个组件

- `<FreeLayoutEditorProvider>` 只提供 Context，不渲染 UI
- `<EditorRenderer />` 才是实际画布
- **没有** `FreeLayoutEditor` 组件（曾经找过，没有）

### 2.2 节点类型名映射

| 数据流 | 名称 | 说明 |
|---|---|---|
| `WorkflowNodeJSON.type` / `nodeRegistries[].type` | `flow-input` 等 | 完整名（业务自定义） |
| `n.type` 在 `useNodeRender` 内部 | **可能是 `flow-input` 也可能没有** | 在 `materials.renderDefaultNode` 路径下不可靠 |
| `n.id`（DOM `data-node-id`） | `input` 等 | **唯一可靠**，用它做 id→type 查表 |

**结论**：在自定义 node renderer 里通过 `n.id` 查表确定类型，**不要信 `n.type`**。

### 2.3 节点数据获取（`nodeRender.data` 在 materials 路径下可能为 `undefined`）

**坑**：`useNodeRender().data` / `form.values` / `node.toJSON().data` 在 `materials.renderDefaultNode` 渲染路径下都是 undefined。

**解决**：用**模块级静态表** `Record<string, DataShape>`，通过 `n.id` 查询：

```ts
const NODE_DATA: Record<string, { title: string; desc: string }> = {
  input: { title: '接收数据', desc: '...' },
  llm_extract: { title: 'LLM', desc: '...' },
};

function MyNode() {
  const { node } = useNodeRender();
  const data = NODE_DATA[node.id] || {};
  return <div>{data.title}</div>;
}
```

### 2.4 节点尺寸（meta.size 必须 + 强制 CSS 兜底）

- `nodeRegistries[].meta.size = { width, height }` —— FlowGram 用这个算位置
- **但**：FlowGram 1.0.12 渲染时默认给 80x40，需要 CSS `!important` 强制覆盖：

```css
.gedit-flow-activity-node[data-node-id] {
  width: 220px !important;
  height: 80px !important;
}
```

### 2.5 节点必须有 `nodeRef` 才能被 FlowGram measure

```tsx
function MyNode() {
  const { nodeRef } = useNodeRender();
  return <div ref={nodeRef} style={{ width: '100%', height: '100%' }}>...</div>;
}
```

### 2.6 关闭 React.StrictMode

FlowGram 1.0.x 的 InversifyJS DI 在 mount 时注册，StrictMode 双 mount 会留重复 binding → 报错。**移除 `<React.StrictMode>` 包裹**。

### 2.7 不要用 formMeta（除非真的需要 form engine）

- `formMeta.render` 在 `materials.renderDefaultNode` 模式下不触发
- `nodeRender.form` 是 `undefined`
- 想用 form → 用 `nodeEngine: { enable: true }` + `formMeta.render` 但要注意签名 `() => ReactNode`（无参数）
- **推荐直接用 `materials.renderDefaultNode`** —— 简单且可控

---

## 3. 暗色主题适配

### 3.1 画布背景

```css
.gedit-playground,
.gedit-flow-background-layer {
  background-color: var(--background) !important;
}
```

### 3.2 网格点（hardcoded `stroke="#eceeef"` 在 SVG pattern 内）

只能 CSS `!important` 覆盖：

```css
.gedit-grid-svg circle {
  stroke: var(--border, #262626) !important;
  fill-opacity: 0.5 !important;
}
```

### 3.3 节点尺寸 + 容器透明

```css
.gedit-flow-activity-node,
.gedit-flow-render-node {
  background: transparent !important;
  min-width: 80px !important;
  min-height: 40px !important;
}
.gedit-flow-activity-node[data-node-id] {
  width: 220px !important;
  height: 80px !important;
}
.gedit-flow-activity-node[data-node-id="condition"] {
  width: 200px !important;
}
```

### 3.4 连线颜色

通过 `FreeLayoutEditorProvider` 的 `lineColor` prop：

```tsx
lineColor={{
  hidden: 'transparent',
  default: '#52525b',
  drawing: '#a78bfa',
  hovered: '#a1a1aa',
  selected: '#a78bfa',
  error: '#ff6166',
  flowing: '#52525b',
}}
```

### 3.5 主题色节点配色方案（推荐）

**核心原则**：UI 黑色 → 节点**黑底** + 浅边框 + 浅色文字；类型色仅用于 icon / pill / 选中态。

| 元素 | 颜色 |
|---|---|
| 节点背景（深色 UI） | `#000000` |
| 节点边框（未选中） | `#e4e4e7` 浅灰 |
| 节点文字 | `#fafafa` |
| 节点类型 pill 背景 | `rgba(<typeColor>, 0.15)` |
| 节点类型 pill 文字 | 类型色（亮版） |
| 选中态边框 | 类型色（取代浅灰） |
| 选中态 boxShadow | `0 0 0 3px <tColor>, 0 0 0 6px <tColor>40, 0 8px 24px <tColor>80` |

类型色推荐（400-500 级，在深底上饱和度合适）：
- input/output: `#3b82f6`（蓝）
- llm: `#8b5cf6`（紫）
- condition: `#eab308`（黄）
- tool: `#22c55e`（绿）
- loop: `#f97316`（橙）

---

## 4. 类型 / API 速查

### 4.1 导出

```ts
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  useNodeRender,
  useCurrentDomNode,
  useClientContext,
  type WorkflowJSON,
  type WorkflowNodeRegistry,
} from '@flowgram.ai/free-layout-editor';
```

### 4.2 `WorkflowJSON` 形状

```ts
type WorkflowJSON = {
  nodes: WorkflowNodeJSON[];  // { id, type, meta: { position: {x,y} }, data, blocks? }
  edges: WorkflowEdgeJSON[];  // { sourceNodeID, targetNodeID, sourcePortID?, targetPortID? }
};
```

**注意**：`WorkflowEdgeJSON` **没有 `id` 字段**！FlowGram 自动生成。

### 4.3 `useNodeRender()` 返回

```ts
interface NodeRenderReturnType {
  id: string;
  node: WorkflowNodeEntity;
  data: any;          // ← materials 路径下是 undefined
  updateData: (newData: any) => void;
  selected: boolean;
  activated: boolean;
  expanded: boolean;
  startDrag: (e: React.MouseEvent) => void;
  ports: WorkflowPortEntity[];
  deleteNode: () => void;
  selectNode: (e: React.MouseEvent) => void;
  readonly: boolean;
  linkingNodeId: string;
  nodeRef: React.MutableRefObject<HTMLDivElement | null>;
  onFocus: () => void;
  onBlur: () => void;
  form?: { render: () => ReactNode; values: any };  // ← 需 nodeEngine.enable
}
```

### 4.4 `useClientContext()` 返回

```ts
interface FreeLayoutPluginContext {
  document: WorkflowDocument;
  clipboard: ClipboardService;
  selection: SelectionService;
  operation: WorkflowOperationService;
  history: HistoryService;
  tools: { autoLayout, fitView };
  playground: EditorPlayground;
}
```

### 4.5 `document.addNode(data)`

```ts
type AddNodeData = FlowNodeJSON & {
  originParent?: FlowNodeEntity;
  parent?: FlowNodeEntity;
  hidden?: boolean;
  index?: number;
};
document.addNode(data): FlowNodeEntity;
```

### 4.6 `FreeLayoutEditorProvider` 关键 props

| Prop | 类型 | 说明 |
|---|---|---|
| `initialData` | `WorkflowJSON` | 初始数据 |
| `nodeRegistries` | `WorkflowNodeRegistry[]` | 节点类型注册 |
| `materials.renderDefaultNode` | `React.ComponentType` | **推荐**自定义节点渲染器（替代 formMeta） |
| `nodeEngine` | `{ enable: boolean }` | 启用 form 引擎（不推荐在 materials 路径下使用） |
| `background` | `boolean` | 显示网格点 |
| `lineColor` | `LineColor` | 连线配色 |
| `playground.preventGlobalGesture` | `boolean` | 禁用全局手势（避免与外层冲突） |
| `readonly` | `boolean` | 只读模式 |
| `canDeleteNode` / `canDeleteLine` | `(ctx, ...) => boolean` | 是否允许删除 |
| `onAllLayersRendered` | `(ctx) => void` | 画布初始化完成后回调（在 ctx.tools.fitView(false) 处调用） |
| `history.enable` | `boolean` | 启用撤销/重做 |

---

## 5. 拖拽添加节点模式（HTML5 dnd + document.addNode）

### 5.1 流程

1. **左侧节点库**：每个 item `draggable={true}` + `onDragStart` 设置 `e.dataTransfer.setData('application/flowgram-node', nodeType)`
2. **画布容器**：React `onDrop` + `onDragOver` 阻止默认 + 派发到内部
3. **内部 addNode**：`onAllLayersRendered` 中通过 `ctx.document.addNode(...)` 添加

### 5.2 坐标转换（clientX/Y → 画布 x/y）

```ts
// drop 时
const rect = dropEl.getBoundingClientRect();
const renderLayer = dropEl.querySelector('.gedit-playground-layer') as HTMLElement;
const transform = renderLayer?.style?.transform || '';

// 解析 "translate(Xpx, Ypx) scale(Z)"
const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
const transMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
const tx = transMatch ? parseFloat(transMatch[1]) : 0;
const ty = transMatch ? parseFloat(transMatch[2]) : 0;

const cx = (e.clientX - rect.left - tx) / scale;
const cy = (e.clientY - rect.top - ty) / scale;
```

### 5.3 完整代码模板

```tsx
// === 节点库面板 ===
function NodeLibrary({ onDragStart }) {
  return (
    <div>
      {NODE_TYPES.map((n) => (
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/flowgram-node', n.type);
            e.dataTransfer.effectAllowed = 'copy';
            // 自定义 drag image
            const ghost = document.createElement('div');
            ghost.textContent = n.title;
            ghost.style.cssText = 'position:fixed;top:-1000px;left:-1000px;...';
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            setTimeout(() => document.body.removeChild(ghost), 0);
          }}
        >{n.title}</div>
      ))}
    </div>
  );
}

// === 画布 Drop Zone ===
function CanvasDropZone({ children, onAddNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/flowgram-node')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('application/flowgram-node');
        if (!nodeType || !ref.current) return;
        const { x, y } = clientToCanvas(e, ref.current);
        onAddNode(nodeType, x, y);
      }}
    >{children}</div>
  );
}

// === FlowGram 编辑器 ===
function Editor({ onAddNode }) {
  return (
    <FreeLayoutEditorProvider
      onAllLayersRendered={(ctx) => {
        // 暴露 addNode 给外部
        ctx.document;  // WorkflowDocument
        // 保存到 ref / context 供外部调用
      }}
    >...</FreeLayoutEditorProvider>
  );
}
```

### 5.4 ⚠️ 重要坑：drop 事件必须绑在 React 容器上，不要绑在 `.gedit-playground` 内部

FlowGram 内部 child element 会拦截 `dragover`，导致 `dropEffect: none`。**React 包装层在 FlowGram 之前截获**。

---

## 6. 节点选中状态同步到外部 React state

FlowGram 的 `onSelectionChange` 不在 props 中。手动方案：

```tsx
// 1. React Context 传递 onSelect
const SelectionContext = React.createContext<(id: string) => void>(() => {});

// 2. 内部包装组件
function BaseNodeWithSelect() {
  const onSelect = useContext(SelectionContext);
  return <BaseNode onSelect={onSelect} />;
}

// 3. BaseNode 中 onClick 同时调用
function BaseNode({ onSelect }) {
  const nodeRender = useNodeRender();
  return (
    <div
      ref={nodeRender.nodeRef}
      onClick={(e) => { e.stopPropagation(); onSelect?.(nodeRender.node.id); nodeRender.selectNode(e); }}
    >...</div>
  );
}
```

---

## 7. 子 tab + 全屏模式共存

**关键**：每个 `<FreeLayoutEditorProvider>` 是独立实例，state 互不影响。

```tsx
<>
  {/* 子 tab 只读预览 */}
  {detailTab === 'flow' && (
    <div style={{ height: 360 }}>
      <FreeLayoutEditorProvider
        initialData={initialData}
        nodeRegistries={nodeRegistries}
        materials={{ renderDefaultNode: CustomBaseNode }}
        readonly  // ← 只读
        ...
      ><EditorRenderer /></FreeLayoutEditorProvider>
    </div>
  )}

  {/* 全屏编辑 Modal */}
  {flowFullscreen && (
    <Modal>
      <FreeLayoutEditorProvider
        initialData={initialData}
        nodeRegistries={nodeRegistries}
        materials={{ renderDefaultNode: FullscreenBaseNode }}
        // 不用 readonly，可编辑
        ...
      ><EditorRenderer /></FreeLayoutEditorProvider>
    </Modal>
  )}
</>
```

---

## 8. 主题色取反（UI 黑 / UI 浅）模式

```tsx
const palette = themeMode === 'dark'
  ? {
      modalPanel: '#0a0a0a',
      nodeBg: '#000000',        // 节点黑底
      nodeBorder: '#e4e4e7',    // 浅边框
      nodeText: '#fafafa',      // 浅文字
      lineDefault: '#52525b',
      gridColor: '#262626',
      typeColor: (t) => ({ input: '#3b82f6', llm: '#8b5cf6', ... })[t] || '#a1a1aa',
    }
  : {
      // 反色：白底 + 深色边框 + 深色文字
      modalPanel: '#fafafa',
      nodeBg: '#ffffff',
      nodeBorder: '#27272a',
      nodeText: '#18181b',
      ...
    };
```

---

## 9. 已知问题 / 限制

| 问题 | 原因 | 缓解 |
|---|---|---|
| `materials.renderDefaultNode` 路径下 `form` / `data` 是 undefined | FlowGram 1.0.x 限制 | 用 `n.id` 查静态表 |
| 网格点 `stroke="#eceeef"` hardcoded | FlowGram SVG pattern 模板内联 | CSS `!important` 覆盖 |
| 节点默认 80x40 | FlowGram `DEFAULT_SIZE` | CSS `!important` 覆盖 |
| 拖拽不触发 addNode | FlowGram 内部 child 拦截 dragover | React 包装层 onDrop |
| React.StrictMode 双 mount | InversifyJS DI 重复注册 | 移除 StrictMode |
| 节点拖动到画布时 React 不响应新节点 | 内部有 watch 机制 | 调用 `ctx.tools.fitView(false)` 触发重新 layout |
| 删除节点用 keyboard 后数据未清 | workflow data 与 node entity 不同步 | 调用 `document.deleteNode(id)` |

---

## 10. 模板文件清单

| 文件 | 作用 |
|---|---|
| `apps/portal/src/pages/ontology/OntologyActionPage.tsx` | 完整示例：子 tab + 全屏 + 拖拽 + 主题色 |
| `apps/portal/src/App.css` | FlowGram 暗色覆盖 CSS（`.gedit-*` 选择器） |

---

## 11. 调试技巧

```js
// 在浏览器控制台

// 1. 找 FlowGram playground
document.querySelectorAll('.gedit-playground').length
// 多个实例（子 tab + 全屏）应该 ≥ 1

// 2. 检查节点
document.querySelectorAll('.gedit-flow-activity-node').length

// 3. 检查连线
document.querySelectorAll('.gedit-flow-activity-edge').length

// 4. 强制重新 fitView（画布 fit 到所有节点）
// 需先拿到 ctx → 调 ctx.tools.fitView(false)
```

---

## 12. 参考资料

- [FlowGram.AI 官方文档](https://flowgram.ai/guide/getting-started/introduction.html)
- [快速开始（free-layout）](https://flowgram.ai/guide/getting-started/free-layout.html)
- [物料库](https://flowgram.ai/materials/introduction.html)
- 项目内：`apps/portal/src/pages/ontology/OntologyActionPage.tsx` 完整代码
- node_modules: `@flowgram.ai/free-layout-editor/dist/index.d.ts`
