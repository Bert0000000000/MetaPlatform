# Ontology IA v2 设计规格（工作区导航 + 路由即状态）

> **版本**：v1.0（IA2-0 冻结）
> **日期**：2026-09-18
> **决策**：ADR-0069（`docs/active/decisions/ADR-0069-ontology-ia-v2-workspace-navigation.md`）
> **基线**：`main@d4a56521`；代码事实核对于本仓（见 §7 基线报告）
> **范围**：前端 IA / 路由 / 导航 / 旧页迁移 / 测试 / 文档。明确排除：Agent Runtime、
> Agent Team、SuperAI、A2A、MCP Agent、LLM/Prompt、本体引擎能力扩建
> **实施方式**：绞杀式迁移（IA2-0 ~ IA2-7），每批主干可运行、可独立回滚

---

## 1. 一句话目标

把 `概览 / 概念建模 / 对象浏览 / 数据中心 / 分析应用 / 运行治理` 六个横向 Tab，
重构为语义清晰、职责互斥、支持深链接的本体工作区：

```
本体
├── 总览
├── 语义模型
├── 数据映射
├── 对象与查询
├── 动作与函数
└── 发布与治理
```

硬性约束：每个二级能力有正式 URL；刷新/前进/后退/深链正确；不再用页面内 useState
充当产品导航；不出现「横向 Tab 套横向 Tab」；对象浏览→关系跳转→Action→Proposal→
版本治理→分析能力不退化；本体页面不依赖 Agent 服务；本轮不新增后端本体能力、
不伪造未实现页面。

## 2. 核心设计决策

### 2.1 三级导航层级

| 层级 | 控件 | 归属 |
| --- | --- | --- |
| 平台级 | `IconRail`（8 域，现状不变） | `components/shell/IconRail.tsx` |
| 工作区级 | `OntologySideNav`（本体专属左侧导航） | `pages/ontology/layout/`（新增） |
| 资源详情级 | `ResourceDetailLayout`（单资源局部 Tab，最多一行） | `pages/ontology/layout/`（新增） |

本体域不再渲染 AppShell 的横向 PageTabs；资源详情页最多一行局部 Tab。

### 2.2 路由即状态

**必须进 URL**：功能页 / 资源 RID / 详情 Tab / 对象类型 / 对象实例 / 搜索词 / 筛选 /
排序 / 页码 / 视图模式（表格、图表、关系图、地图）。

**可留组件内**：Drawer 开关 / 列宽 / hover / 未提交表单 / 动画折叠态。

### 2.3 单一导航配置

新增 `src/pages/ontology/navigation.ts`：

```ts
export type OntologyNavStatus = 'active' | 'hidden' | 'planned';
export interface OntologyNavItem {
  key: string;
  label: string;
  path: string;
  icon?: ReactNode;
  status: OntologyNavStatus;
  children?: OntologyNavItem[];
}
export const ONTOLOGY_NAV: OntologyNavItem[] = [ /* 六大域 */ ];
```

同一配置驱动：左侧导航、路由高亮、TopBar 面包屑、Command Palette、页面标题、
测试路径矩阵。禁止四处硬编码路径。

### 2.4 Domain 配置扩展

```ts
// components/shell/domains.tsx
export interface DomainDef {
  ...
  navigationMode?: 'tabs' | 'workspace';   // 新增，缺省 'tabs'
}
// ontology 域：navigationMode: 'workspace'
```

`tabs` 字段保留作面包屑/兼容索引，但不再渲染横向 PageTabs。
`PageTabs.tsx`：`if (!domain || domain.navigationMode === 'workspace') return null;`
——**禁止**按路径字符串特判（如 `pathname.startsWith('/ontology')`）。

### 2.5 不展示假功能

暂无真实能力的页面：不建空壳、不进正式导航、不用 Mock；可登记
`status: 'planned'`（不渲染），等真实 API + 验收后再打开。

## 3. 目标信息架构（含状态标注）

> 首版只渲染 `active`；`planned` 只登记不渲染。

```
本体
├── 总览                       active
├── 语义模型
│   ├── 对象类型               active   （OntologyModelingPage 工作台迁入）
│   │   └── :rid 详情         active   （IA2-2 详情路由）
│   ├── 关系类型               active   （ModelingPage 关系表抽出）
│   ├── 接口                   active   （ModelingPage 接口表抽出）
│   ├── 公理                   active   （ModelingPage 公理表抽出）
│   ├── 模型图谱               active   （OntologyGraphView 成正式路由）
│   ├── 模型校验               active   （GovernancePage lint 部分拆入）
│   ├── 关系映射               planned
│   ├── 数据质量               planned
│   ├── Schema 漂移            planned
│   └── Writeback              planned
├── 数据映射
│   ├── 对象映射               active   （DatacenterPage 数据接入 + 背挂数据源）
│   ├── 同步任务               active   （DatacenterPage 同步健康）
│   ├── 本体血缘               active   （DatacenterPage 血缘视图，只留本体相关链路）
│   ├── （全局资产清单）       —— 移出本体导航，回「数据与治理」域（单独跟踪）
├── 对象与查询
│   ├── 对象浏览               active   （ObjectExplorerPage 原样迁入）
│   │   └── :rid 详情         active   （IA2-4 详情路由化，Sheet → 路由驱动）
│   ├── 聚合分析               active   （AnalysisPage 迁入）
│   ├── 地图视图               active   （MapPage 迁入）
│   ├── ObjectSet 构建器       planned
│   └── 保存的查询             planned
├── 动作与函数
│   ├── 动作类型               active   （ModelingPage action 表迁出 + 详情）
│   ├── 函数                   active   （ModelingPage function 表迁出 + 详情）
│   ├── Action 编排            active   （OntologyActionPage → ActionDesignerPage）
│   ├── 执行记录               active   （Ops/Governance 的 Action Audit 迁入）
│   ├── 审批策略               planned（无真实数据不显示页签）
│   ├── Side Effects           planned
│   └── 补偿                   planned
└── 发布与治理
    ├── 草稿                   active   （SchemaWipCard → DraftsPage）
    ├── 版本与发布             active   （OpsPage release + branch/diff/rollback）
    ├── 使用量                 active   （GovernancePage usage/lifecycle）
    ├── 模型检查               active   （入口页；实现在语义模型/模型校验，不重复实现）
    ├── 安全策略               active   （SecurityPolicyCard）
    ├── 导入导出               active   （GovernancePage import/export）
    ├── 审计                   active   （平台级审计汇总；Action 审计在执行记录）
    ├── Review                 planned
    ├── Migration Plan         planned
    └── Scheduled Release      planned
```

Dashboard：从本体导航移除，`DashboardPage.tsx` 保留文件（最终归宿 AppHub，另立任务）。

## 4. 权威路由矩阵

### 4.1 目标正式路由

```
/ontology                              总览（落地页）

/ontology/model                     → redirect /ontology/model/object-types
/ontology/model/object-types           对象类型列表
/ontology/model/object-types/:rid      对象类型详情（tab 段见下）
   /overview /properties /links /interfaces /axioms /datasources
   /dependents /history /security
/ontology/model/link-types             关系类型
/ontology/model/interfaces             接口
/ontology/model/axioms                 公理
/ontology/model/graph                  模型图谱
/ontology/model/validation             模型校验

/ontology/data                       → redirect /ontology/data/mappings
/ontology/data/mappings                对象映射
/ontology/data/sync                    同步任务
/ontology/data/lineage                 本体血缘

/ontology/explore                    → redirect /ontology/explore/objects
/ontology/explore/objects              对象浏览
/ontology/explore/objects/:rid         对象详情（列表页内 Sheet 用 background location 呈现）
/ontology/explore/analysis             聚合分析
/ontology/explore/map                  地图视图

/ontology/logic                      → redirect /ontology/logic/actions
/ontology/logic/actions                动作类型列表
/ontology/logic/actions/:rid           动作类型详情（/overview /parameters /rules
                                        /approvals /side-effects /runs —— 无真实
                                        数据的页签不显示）
/ontology/logic/functions              函数列表
/ontology/logic/functions/:rid         函数详情（/overview /versions /dependencies /runs）
/ontology/logic/designer               Action 编排（原 /ontology/ops/actions）
/ontology/logic/runs                   执行记录

/ontology/governance                 → redirect /ontology/governance/drafts
/ontology/governance/drafts            草稿
/ontology/governance/releases           版本与发布
/ontology/governance/usage              使用量
/ontology/governance/lint               模型检查（入口链接到 /ontology/model/validation）
/ontology/governance/security           安全策略
/ontology/governance/import-export      导入导出
/ontology/governance/audit              审计
```

约束：
- 详情路由先注册；暂无独立组件的详情 Tab 用同一详情组件按 tab 渲染。
- `:rid` 用 URL-safe 编码 + 统一解码辅助函数（复用 `pages/ontology/rid.ts` 惯例）。
- 对象详情可继续以 Sheet 呈现（React Router background location），深链直达时展示
  完整详情或同一 Sheet 容器——两种入口 URL 一致。
- 注册点唯一：新路由集中在 `routes/ontology.tsx`（嵌套 + `<Outlet>`）；
  `legacy-redirects.tsx` 只放 301。同一路径不得两处注册。

### 4.2 旧路径迁移表（含 `?tab=` 变体；E2E 表驱动覆盖）

| 旧路径 / 入口 | 新路径 | 现状（main@d4a56521） |
| --- | --- | --- |
| `/ontology` | `/ontology` | 已是落地页 |
| `/ontology?tab=overview` | `/ontology` | 现转 `/ontology`（不变） |
| `/ontology?tab=concept` `modeling` `model` | `/ontology/model/object-types` | 现转 `/ontology/model` |
| `/ontology?tab=graph` | `/ontology/model/graph` | 现转 `/ontology/model` |
| `/ontology?tab=objects` | `/ontology/explore/objects` | 现转 `/ontology/objects` |
| `/ontology?tab=data` `datacenter` | `/ontology/data/mappings` | 现转 `/ontology/datacenter` |
| `/ontology?tab=action` | `/ontology/logic/actions` | 现转 `/ontology/model` |
| `/ontology?tab=analytics` | `/ontology/explore/analysis` | 现转 `/ontology/apps` |
| `/ontology?tab=governance` | `/ontology/governance/releases` | 现转 `/ontology/ops` |
| `/ontology/model` | `/ontology/model/object-types`（redirect） | 现为 ModelingPage |
| `/ontology/model/editor` | `/ontology/model/object-types` | 已 301 到 `/ontology/model` |
| `/ontology/object-types`、`/ontology/object-types/:rid` | `/ontology/model/object-types` | 已 301 到 `/ontology/model`（:rid 将透传） |
| `/ontology/relationship-types` | `/ontology/model/link-types` | 已 301 到 `/ontology/model`（本表新增登记，原方案未列） |
| `/ontology/graph` | `/ontology/model/graph` | 已 301 到 `/ontology/model` |
| `/ontology/action`、`/ontology/actions` | `/ontology/logic/actions` | 已 301 到 `/ontology/model` |
| `/ontology/objects` | `/ontology/explore/objects` | 现为对象浏览主页 |
| `/ontology/explorer` | `/ontology/explore/objects` | 已 301 到 `/ontology/objects` |
| `/ontology/datacenter` | `/ontology/data/mappings` | 现为 DatacenterPage |
| `/ontology/apps` | `/ontology/explore/analysis` | 现为 AppsPage |
| `/ontology/analytics` | `/ontology/explore/analysis` | 已 301 到 `/ontology/apps` |
| `/ontology/ops/actions` | `/ontology/logic/designer` | 现挂 OntologyActionPage |
| `/ontology/ops/governance` | `/ontology/governance/releases` | 现挂 GovernancePage |
| `/ontology/ops` | `/ontology/governance/drafts` | 现为 OpsPage |
| `/ontology/governance` | `/ontology/governance/releases` | 已 301 到 `/ontology/ops` |

迁移要求：保留可安全迁移的 query（如 `?class=`、`?id=`）；旧路径至少保留一个
发布周期，删除前记录命中次数。

### 4.3 默认入口

| 功能域 | 默认路径 |
| --- | --- |
| 总览 | `/ontology` |
| 语义模型 | `/ontology/model/object-types` |
| 数据映射 | `/ontology/data/mappings` |
| 对象与查询 | `/ontology/explore/objects` |
| 动作与函数 | `/ontology/logic/actions` |
| 发布与治理 | `/ontology/governance/drafts` |

## 5. Shell 与页面迁移设计

### 5.1 OntologyWorkspaceLayout

```
┌──────────────────────────────────────────────────────┐
│ ContextBar：本体名 / Release / 搜索 / 创建资源        │
├───────────────┬──────────────────────────────────────┤
│ Ontology Nav  │ Outlet                               │
│ 总览          │ 当前页面                              │
│ 语义模型      │                                      │
│ 数据映射      │                                      │
│ 对象与查询    │                                      │
│ 动作与函数    │                                      │
│ 发布与治理    │                                      │
└───────────────┴──────────────────────────────────────┘
```

- 文件：`pages/ontology/layout/{OntologyWorkspaceLayout,OntologySideNav,
  OntologyContextBar,ResourceDetailLayout}.tsx` + `ontology-workspace.css`
- 使用现有设计令牌；不新增 `.semi-*` 覆盖、不新增静态 inline style；
  侧栏可折叠（非首批阻断）；1024px 不遮挡主内容；深浅主题可用；
  全幅画布页声明 `contentMode: 'full'`（对象浏览/图谱/血缘），列表页默认 gutter。
- 「创建资源」下拉只放开**已有真实编辑器**的项（对象类型 / 关系类型 / 接口 / 公理 /
  动作类型 / 函数按真实编辑器拥有情况逐个开）；没有真实编辑器的不显示或 disabled
  带说明；按钮不再统一叫「新建本体」。

### 5.2 TopBar / Command Palette / 上下文

- 本体页面面包屑从 `ONTOLOGY_NAV` 解析（如 `本体 / 语义模型 / 对象类型`）；
  其他 7 域逻辑不动。
- Command Palette 索引六大功能域 + 全部 active 子页面；不索引 hidden/planned；
  支持中文关键词（对象类型、关系、动作、函数、草稿、发布、审计…）。
- `OntologyDomainShell.ROUTE_VIEWS`（ADR-0065 S2 上下文写入）随新路由同步扩展——
  视图名以新 IA 为准（如 `ontology-explore-objects`），旧视图名随旧路由退役；
  `context-navigate.spec.ts` 中硬编码的 `/ontology/objects` 用例同步更新。

### 5.3 页面迁移映射（源 → 目标，只移动不复制）

| 目标 | 来源 | 迁移要点 |
| --- | --- | --- |
| 总览 | `overview/OverviewPage.tsx` | 删 `getAgentMetricsSummary` 与 AI 提案回归卡；补 Draft 数 / 最近版本操作 / Lint 数 / Action 执行总量（无可靠失败率 API 就不编造）；快捷入口改六大功能域 |
| model/object-types | `OntologyModelingPage.tsx` | 整体迁为 ObjectTypesPage，先不重写 |
| model/{link-types,interfaces,axioms} | `ModelingPage.tsx` 各表 | 抽为独立页面 |
| model/graph | `model/OntologyGraphView.tsx` | 成正式路由 |
| model/validation | `GovernancePage.tsx` lint 部分 | 治理页只留入口链接 |
| data/* | `DatacenterPage.tsx` + `BackingDatasourcePanel.tsx` | 全局资产清单移出本体导航（不能安全迁移则先摘导航、保留组件、登记 Gov 任务） |
| explore/objects | `explorer/ObjectExplorerPage.tsx` | 详情路由化；搜索/筛选/排序/页码进 query；关系跳转更新 URL 可返回 |
| explore/{analysis,map} | `AnalysisPage.tsx` / `MapPage.tsx` | 迁入；与对象浏览共享 ObjectSet 输入（首批可保持现状，后续统一） |
| logic/* | `ModelingPage` action/function 表、`OntologyActionPage`、Ops/Governance 的 Action Audit | OntologyActionPage 迁为 ActionDesignerPage（2267 行大组件，只迁不复制）；无真实数据的审批/Side Effect 页签不显示 |
| governance/* | `OpsPage.tsx`、`GovernancePage.tsx`、`SchemaWipCard`、`SecurityPolicyCard` | 删全部 Agent metrics 区块；审计页只做平台级汇总 |

容器删除（各自批次准出后）：`ModelingPage.tsx`、`DatacenterPage.tsx`、`AppsPage.tsx`、
`OpsPage.tsx`、`GovernancePage.tsx`、旧 ontology route wrapper、死 CSS、legacy adapters。
`DashboardPage.tsx` 不直接删除，先确认迁移归属与使用者。

既有未挂路由组件：`actions/ActionTypeListPage.tsx`（现仅被引用 `actionDisplayName`）
在 IA2-5 一并处置（挂路由或明确退役）。

## 6. 实施批次（IA2-0 ~ IA2-7）

| 批次 | 主题 | 准出要点 |
| --- | --- | --- |
| IA2-0 | 设计 / 基线 / 失败测试（本批） | ADR + 本规格 + 基线报告 + 红 spec；不改功能页面 |
| IA2-1 | 工作区 Shell 与路由骨架 | 左导航可用；六域正确高亮；深链/刷新/前进后退正确；现有功能仍能打开；无 Agent 文件变更 |
| IA2-2 | 语义模型拆分 | /model/* 每页独立 URL；建模能力不退化；七个内部主 Tab 消失 |
| IA2-3 | 数据映射拆分 | 本体只留本体相关数据面；全局资产门户不在本体；同步/映射不丢 |
| IA2-4 | 对象与查询拆分 | 对象列表→打开→关联跳转→返回→执行动作→Proposal→审计全链路通过；URL 可分享 |
| IA2-5 | 动作/函数/执行记录 | Action/Function 不在语义模型；Designer 不挂 /ops；执行记录唯一权威页 |
| IA2-6 | 发布治理总览拆分 | 治理能力全有正式 URL；Agent 服务关闭页面正常；版本/Diff/Rollback/导入导出不丢 |
| IA2-7 | 清理视觉验收 | 无双导航/死链接/Agent 依赖；双主题三视口截图；证据落档 |

提交顺序（仓库纪律）：docs/ADR → failing tests → navigation contract → route shell →
feature migration → cleanup → acceptance evidence。

## 7. 基线与测试

### 7.1 基线（2026-09-18 实测，详见 `docs/active/delivery/evidence/ONTOLOGY-IA2-0-BASELINE.md`）

- `pnpm typecheck` ✅；`pnpm build` ✅（40.6s）；`node scripts/check_classes.mjs` ✅
- `pnpm test:unit`：62/63，1 预存红（ProposalConfirmDrawer）
- Playwright（本体 3 spec）：8/8 红——`ui-p1a-ontology` 6 条为 09-17 IA 重排的
  **文案漂移**（对象浏览器→对象浏览 等），`ontology-dedup` / `ontology-agent-e2e`
  为 09-15 已登记的既有红
- 环境坑：vite watcher 会因 Playwright 报告文件 EBUSY 崩溃（本批修复：watch ignored）；
  dev server 冷启动首访超时会造成假红（跑套件前先预热路由）

### 7.2 测试方案

**新增（IA2-0 已落红）**：
- `src/components/shell/ontology-navigation-mode.test.tsx`（vitest 契约）：
  ontology 域声明 `navigationMode: 'workspace'`；PageTabs 在本体路由渲染为空；
  非 workspace 域不受影响
- `tests/e2e/ontology-ia-v2-navigation.spec.ts`：六大域默认路径 + 左导航渲染 +
  无 PageTabs + 刷新保持 + 前进后退
- `tests/e2e/ontology-ia-v2-legacy-redirects.spec.ts`：§4.2 迁移表全量表驱动

**后续批次**：`ontology-ia-v2-{object,model,governance,visual}-flow.spec.ts`
（对象消费闭环 / 建模 / 治理 / 双主题三视口）；既有 `ui-p1a-ontology.spec.ts`
随 IA2-1 重写为按新 IA 断言（其文案断言在 main 上已红）；
`context-navigate.spec.ts` 的 `/ontology/objects` 用例随 ROUTE_VIEWS 扩展更新。

**回归命令**（apps/web 下）：
```
pnpm typecheck && pnpm build && pnpm test:unit && node scripts/check_classes.mjs
npx playwright test tests/e2e/ontology-ia-v2-*.spec.ts   # 需 9250 dev server + 8100 网关
```

### 7.3 受影响既有测试清单（本批核实）

| 文件 | 现状 | 处置批次 |
| --- | --- | --- |
| `tests/e2e/ui-p1a-ontology.spec.ts` | 红（文案漂移） | IA2-1 重写断言 |
| `tests/e2e/ontology-dedup.spec.ts` | 红（09-15 已登记） | IA2-2（路径 `/ontology/model/editor` 变更后重跑修） |
| `tests/e2e/ontology-agent-e2e.spec.ts` | 红（09-15 已登记） | IA2-2 同上 |
| `tests/e2e/context-navigate.spec.ts` | 绿（未在本批跑，路径依赖分析） | IA2-1（`/ontology/objects` → 新路径 + 视图名） |
| `src/pages/ontology/components/ProposalConfirmDrawer.test.tsx` | 1 红（预存） | 不动（非 IA 范围） |

## 8. 验收标准

### 8.1 信息架构
六大功能域命名顺序正确；本体不显示全局横向 PageTabs；工作区有独立左侧导航；
语义模型不含 Action/Function；数据映射不含全局资产门户；对象与查询不含正式
Dashboard；动作与函数有独立入口；发布与治理不含 Agent 回归指标。

### 8.2 路由
每个 active 子页面有正式 URL；刷新不丢位置；前进后退正常；面包屑正确；
⌘K 可搜索；旧路径全部可达新路径；无路由循环；无重复注册。

### 8.3 功能
对象消费闭环、Action 编排、版本/Diff/Rollback、数据映射与同步、分析与地图
均不退化；Agent 服务不可用不影响本体页面。

### 8.4 工程
无 `.semi-*` 覆盖；无新增静态 inline style；无 Mock 冒充；无空壳正式页面；
无跳过的 P0 测试；typecheck / build / unit / E2E 通过；验收证据落档。

## 9. 非目标 / 风险 / 回滚

同 ADR-0069 §2.5 / §4 / 不变量 5。PR 切分：PR-1 foundation（IA2-0+IA2-1）→
PR-2 semantic-model → PR-3 data → PR-4 explore → PR-5 logic → PR-6 governance →
PR-7 cleanup-acceptance；每 PR 文件范围明确、不混 Agent 改动、有测试与回滚说明。
