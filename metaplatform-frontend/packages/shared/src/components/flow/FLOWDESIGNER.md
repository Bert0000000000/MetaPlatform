# FlowDesigner 三场景统一编辑器

> 创建于 2026-07-24，R1 UI 优化阶段落地。

## 作用

封装 `@flowgram.ai/fixed-layout-editor` 的 `FlowgramEditor`，提供**画布 + 工具条 + 本地持久化 + 全屏**的一站式体验。通过 `mode` 切换三大流程编排场景：

| mode | 场景 | 节点库 | 后端 |
|---|---|---|---|
| `bpmn` | 审批流程编排 | `BPMN_NODE_REGISTRIES`（7 种） | `TECH-WFE` 状态机 |
| `agent` | AI 协作流程编排 | `AGENT_NODE_REGISTRIES`（7 种） | `TECH-AGENT` (SAA Graph Core) |
| `business` | 业务流程编排 | `BUSINESS_FLOW_REGISTRIES`（3 种） | `TECH-ACTION` + `TECH-ONT` |

也支持 `nodeRegistryMode="all"` 启用全部 17 种节点库。

## 用法

```tsx
import { FlowDesigner, type FlowMode } from '@mate/shared/flow';

// 1. 默认审批流程
<FlowDesigner mode="bpmn" />

// 2. 指定 localStorage key（多应用隔离）
<FlowDesigner mode="agent" storageKey="agent-flow-2026-q3" />

// 3. 全部 17 节点库
<FlowDesigner mode="bpmn" nodeRegistryMode="all" />

// 4. 注入自定义节点卡片（参见 admin/components/node-render.tsx）
<FlowDesigner
  mode="agent"
  customRegistries={AC_NODE_RENDER_REGISTRIES}
/>

// 5. 隐藏工具条（嵌入式使用）
<FlowDesigner mode="bpmn" hideToolbar />
```

## 当前已接入

| 页面 | 路径 | mode 默认值 |
|---|---|---|
| `apps/web/src/pages/apps/ProcessDesignerPage.tsx` | `/apps/processdesigner` | URL `?mode=` → localStorage → 默认 `bpmn` |
| `apps/web/src/pages/admin/AdminComponentsPage.tsx` | `/admin/components` | 直接用 `FlowgramEditor`（catalog 演示页，未走 FlowDesigner） |

## 工具条交互

- **左侧**：当前场景 + 切换场景下拉（隐藏时 `hideModeSwitch`）
- **右侧**：
  - 状态指示：未保存 / 草稿 / 已保存
  - 保存到 localStorage
  - 清空（带 confirm 确认）
  - 全屏切换（Esc 退出）

## 限制

- **仅 fixed-layout**：free-layout 还没集成
- **不接后端 API**：数据全部在 localStorage；R2/R3 会接 `TECH-WFE` / `TECH-AGENT` / `TECH-ACTION` 的真实保存接口
- **节点自定义卡片**：admin/components 的 17 专属卡片目前还是本地实现，**未抽取到 shared**——下个迭代再做

## 文件清单

```
packages/shared/src/components/flow/
├── FlowDesigner.tsx       # 主组件（工具条 + 画布 + localStorage）
├── presets.ts             # 三场景初始数据 + mode 元信息
└── index.ts               # 统一导出（已加 FlowDesigner / FlowMode / presets）
```

## 与 R1 admin/components 流程画布的关系

`AdminComponentsPage` 是**节点库 catalog 演示页**（展示全部 17 节点 + 自定义卡片），直接用底层 `FlowgramEditor` 复刻 design draft。`FlowDesigner` 是**业务编辑器**（默认带工具条 + 持久化）。两者定位不同：

- `AdminComponentsPage` 侧重"看节点长什么样"
- `FlowDesigner` 侧重"画真实的流程并保存"
