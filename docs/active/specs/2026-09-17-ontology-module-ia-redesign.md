# 本体模块信息架构与操作动线重设计

> 状态：**已定稿**（2026-09-17 评审通过：6 tab / 7 步向导 / 扩后端做全量预填）｜日期：2026-09-17｜范围：`metaplatform-frontend/apps/web/src/pages/ontology/` + `routes/ontology.tsx` + `components/shell/domains.tsx` + 后端 copilot proposal 契约
> 依据：DESIGN-SPEC v1.0（Calm Density）· ADR-0021（Kernel 12 基元）· 2026-09-09 本体差距分析
> 目标：**一次性改对**——菜单按用户动线切分，补齐断掉的消费动线，并把「创建本体」做成引导式 + AI 内嵌的抽屉向导。

---

## 1. 问题诊断

当前本体域 4 个页内 tab（`/ontology/{explorer,datacenter,model,ops}`）存在 5 个结构性毛病。

### 1.1 菜单名不在一个层级上

| Tab | 名字的类型 | 实际内容 |
|---|---|---|
| 对象浏览器 | 工具名 | 类型树 + 实例表 + 详情浮层 |
| 数据中心 | 地点名 | 类型图谱 + 数据血缘 + 资产清单 |
| 类型建模 | 活动名 | 6 张只读清单表 |
| 运维 | 职能名 | 接入/版本/审计 + 下拉藏 3 项 |

四种命名层级混用，用户无法从菜单名推断"我该去哪做我要做的事"。

### 1.2 「类型建模」是空壳

`routes/ontology.tsx:68` 挂的是 `ModelingPage`（488 行，纯只读清单）；真正的建模工作台 `OntologyModelingPage`（819 行，含领域树 / 概念表 / 新建 / 编辑 / 相似合并）挂在下一行的 `/ontology/model/editor`，只能靠右上角一个按钮进入，且进入后是另一套三栏界面。

**用户在"类型建模"里找不到"新建"。**

### 1.3 「数据中心」装了两类不相干的东西

知识图谱的节点是 `ObjectType`、边是 `LinkType`——那是**模型层**；数据血缘与资产清单是**数据平台层**。前者应与建模同处，后者属于数据面。

### 1.4 消费动线只做了半截（最严重）

对象详情浮层底部只有两个按钮：复制 RID、新标签页打开（`explorer/ObjectExplorerPage.tsx:413-440`）。关系区渲染为一排 `Tag`，**不可点击**（同上 `:499-521`）——从订单跳不到客户。也没有任何"执行动作"入口。

而后端**全部就绪**：`applyEditSet` 即"人工路径预览即确认"（即时 proposal + 单事务 + 审计，`api/ont/kernel.ts:553`），`ProposalKind` 含 `'action'`。纯 UI 缺口。

> ⚠️ 事实澄清：2026-09-09 差距分析把 G36「对象主页」、G37「人工 Action 表单」标为 ✅，但 `ObjectHomeDrawer` / `ActionFormDrawer` / `ObjectDataPage` **在当前代码中不存在**（UI 重写那轮丢失）。这不是"做过没做好"，是真没有。

### 1.5 两处高价值能力被埋三层

分析工作台 / 仪表盘 / 地图（Quiver / Carbon / Map 对位）与治理面（版本分支 / diff / 回滚 / 使用量 / lint），入口都在 `ops/OpsPage.tsx:23-27` 的「更多运维工具」下拉里。

---

## 2. 设计原则

1. **菜单 = 用户动线**。菜单从"用户要干什么"推导，不从代码目录推导。
2. **名字同事物**。每个 tab 名指向一类任务对象，不再混用工具名/地点名/职能名。
3. **一个实体只在一处**。类型图谱跟类型定义同处；血缘资产跟数据接入同处。
4. **主路径 ≤ 2 层**。域 tab → 页内子 tab，禁止第三层下拉。
5. **每个 tab 一个显式主按钮**。
6. **消费动线闭环**。清单 → 对象主页 → 关系跳转 → 执行动作 → 看审计。
7. **守 DESIGN-SPEC**：详情一律走 Preview Sheet 浮层（B 骨架），不新增第六种版式；单工作区可见横向切换控件 ≤ 2 种。

---

## 3. 新信息架构：6 个页内 tab

先列动线，菜单由动线推导：

| # | 动线 | 谁 | 当前断点 |
|---|---|---|---|
| ① | 建概念 → 加属性/关系/动作 → 接数据 → 发布 → 验数据 | 本体建模者 | 新建在隐藏路由；接数据/发布在另一个 tab |
| ② | 找对象 → 看关系/历史 → 执行动作 | 业务用户 | 关系不可点、无动作入口、无对象主页 |
| ③ | 选分析应用（工作台/仪表盘/地图） | 分析者 | 藏三层下 |
| ④ | 看同步健康 / 血缘 / 资产 | 数据工程师 | 混在"运维"里，与模型图谱同 tab |
| ⑤ | 发版本 / 查审计 / 治理 / AI 回归 | 平台运维 | 与 Action 编排混在一起 |

| # | Tab | 路径 | 承接 | 右上主按钮 |
|---|---|---|---|---|
| 1 | **概览** | `/ontology` | 新建落地页 | 新建本体 |
| 2 | **概念建模** | `/ontology/model` | 类型建模 + 隐藏编辑器 + 类型图谱 | 新建本体 |
| 3 | **对象浏览** | `/ontology/objects` | 对象浏览器 + 对象主页 + 执行动作 | 执行动作 |
| 4 | **数据中心** | `/ontology/datacenter` | 数据接入（同步健康）+ 数据血缘 + 资产清单 | 新建数据源 |
| 5 | **分析应用** | `/ontology/apps` | 从三层下拉捞出的 3 个 L6 应用 | — |
| 6 | **运行治理** | `/ontology/ops` | 数据接入以外的运维面 + 隐藏的治理面 | — |

---

## 4. 各 tab 内部设计

### 4.1 概览（新，A 骨架）

回答"进了本体，从哪开始"。数据全部来自既有端点，不新增后端契约。

- **KPI 行**：对象类型数 / 关系类型数 / 动作类型数 / 函数数（`listObjectTypes` 等 6 个 list）
- **主列**：最近 Action 执行（`listActionAudit`）+ 待确认提案（走 `getProposal`）
- **侧列**：同步健康摘要（`getDatasourceSyncStatus`，红/绿计数）+ Agent 回归指标（`/agent-metrics/summary`）
- **快捷入口**：新建本体（唤起向导）/ 浏览对象 / 查看图谱

### 4.2 概念建模（B 骨架）

- **左栏「一级本体」是可下钻的树**：一级本体 → 概念 → 子概念（递归）→ 末级概念。数据源 `GET /object-types/hierarchy`（后端按 `parent_class` 组好的嵌套树）；端点不可用或返回空时降级为「域 → 概念」两层。首次加载自动展开到末级，用户手动开合后不再覆盖。
- **中栏**：所选基元的清单表（`DataTablePro`），带「新建」
- **右上视图切换**（1 个控件）：`清单 | 图谱`——图谱即现「知识图谱」视图（节点 = ObjectType，边 = LinkType）
- **点行 → 右浮层**：详情 + 「编辑」（开 `ObjectTypeEditorV2Drawer` / `PropertyEditorV2`）；动作类型行额外给「编排流程」（开 FlowGram，即现 `OntologyActionPage`）

> **数据事实（2026-09-17 治理后）**：类型数 **47 → 29**。清掉的 18 个：16 个空壳「客户」（只有 1 个属性、0 实例，rid 带创建时间戳）+ `probe-customer-x` + 1 个此前已被软删的 drill 残留。
> 层级已建：**员工 is-a 人员**、**请假申请 is-a 工单**（真正的 is-a；此前举例的「人员→组织」「订单→合同」是关联不是子类型，已更正）。
> 树的跨域规则：**整棵子树跟随根节点的域**——所以「员工」挂在「组织人力 → 人员」下、不再单独占「人事档案」域；「请假申请」挂在「工单」下。
> 另注：改 `parent_class` 后端返回 409 `destructive_confirm_required`，需带 `confirm_name`（G33 破坏性变更二段确认）——赋值入口在 `ObjectTypeEditorV2Drawer` 的「父类型」字段。
>
> **顺带修掉一个后端 bug**：`PgOntologyRepo.list_object_types` 的 SQL 漏了 `archived = FALSE`（同文件里去重/预检查询都带了，只有列表端点漏），导致 merge / lifecycle delete 软删掉的类型仍出现在列表与层级树里——与 InMemory 实现（软删＝移出活动集合）行为不一致。已修（`pg_repo.py`），一处过滤同时修好列表与层级树两个端点。
>
> `OntologyModelingPage` 的建模能力**整体并入本 tab**，`/ontology/model/editor` 路由退役。

### 4.3 对象浏览（B 骨架，骨架不变，补全动线）

左类型树与中实例表不动。改动集中在详情浮层与搜索：

- **详情浮层升级为「对象主页」**（仍是 456px Preview Sheet，不破规范）：
  - 属性（`Descriptions`）
  - **关系（`Tag` 改为可点击）** → 打开关联对象的对象主页，带面包屑栈可返回
  - 变更历史（`Timeline`，`listActionAudit`）
  - 底部按钮：复制 RID / 新标签页打开 / **执行动作**
- **执行动作** → `ActionFormDrawer`：选动作类型 → 按 `ActionType.parameters` 动态渲染表单 → `proposeEditSet` 建提案 → 复用 `ProposalConfirmDrawer` 确认执行
- **搜索框接语义检索** `searchObjectsSemantic`（客户端 filter 降级为兜底）

> **契约事实（2026-09-17 实测）**：人工 Action 表单走 `propose-edit-set`，后端落下的提案 **kind = `edit_set`**，既不是 `action` 也不在前端原 `ProposalKind` 联合类型里 —— 于是确认抽屉显示「未知类型（edit_set）」且不渲染任何预览体。已修复：前端补 `edit_set` kind + `OntologyStagingPreview` 新增分支。
> `edit_set` 的 preview 字段**平铺在顶层**（不像前四种套在 `model_type`/`action` 等子对象里）：`action_type` / `target_rid` / `parameters.{edits,parameters}` / `expected_diff.{ops,'~ops',preview_source}` / `impact_summary.{affected_individuals_estimate,warnings}`。
> 实测 `expected_diff.ops` 恒为空且 `preview_source = "function(deferred)"`——**真正的变更集由动作函数在执行时决定，确认前无法逐条列出**。UI 如实说明，不编造 diff。

### 4.4 数据中心（F 骨架）

三个视图全部保留，但**内容归位**：

- **数据接入**（新增，原在运维）：`getDatasourceSyncStatus` 同步健康表 + 背挂数据源绑定（`listBackingDatasources` / `upsertBackingDatasource` / `syncBackingDatasources`）
- **数据血缘**：`deriveLineageGraph`（不变）
- **资产清单**：`listBigDataSources`（不变）

> 类型图谱已移出本 tab（归概念建模）。

### 4.5 分析应用（E 骨架）

分析工作台 / 仪表盘 / 地图三卡或三子 tab，整块搬自 `AnalyticsTab`。

### 4.6 运行治理（E 骨架）

子 tab：**版本与发布** | **变更审计** | **治理** | **AI 回归指标**

- 版本与发布：`listSchemaWip` + apply（草稿发布）
- 变更审计：`listActionAudit`（200 条）
- 治理：`GovernancePage` 整体并入（branch / diff / rollback / usage / `lintAntiPatterns` / SchemaWipCard / SecurityPolicyCard）
- AI 回归指标：`/agent-metrics/{summary,trend,health}`

---

## 5. 本体创建向导（本轮重点）

### 5.1 为什么需要

当前"新建概念"是一个扁平表单（`ObjectTypeEditorV2Drawer`），一次只落一个 ObjectType。但"创建一个本体概念"在工程上是一条**跨基元的链路**：类 → 属性 → 关系 → 动作 → 数据绑定 → 发布。扁平表单强迫用户在脑子里维护这条链路，还要在多个 tab 之间跳（属性在编辑器、数据源在数据中心、发布在运维）。

**向导把这条链路显式化，每步只做一件事。**

### 5.2 步骤设计（由本体论层次推导）

本体论的核心构造：**类 / 属性 / 关系 / 个体 / 公理**；本平台在此之上加了**动能层（ActionType）**与**落地层（背挂数据源）**。

| 步 | 名称 | 本体论对应 | 后端端点 | 必填 |
|---|---|---|---|---|
| 1 | **概念** | ObjectType / Class | `POST /object-types` | ✅ |
| 2 | **属性** | Property / DatatypeProperty | 同上（`properties[]` 内联） | ✅ ≥1 |
| 3 | **关系** | LinkType / ObjectProperty | `POST /link-types` | ⬜ 可跳过 |
| 4 | **动作** | ActionType（动能层） | `POST /action-types` | ⬜ 可跳过 |
| 5 | **数据来源** | 背挂数据源 | `POST /object-types/{rid}/datasources` | ✅ 可"暂不绑定" |
| 6 | **数据确认** | 字段映射 + 抽样 | `GET .../materialization` | ✅ |
| 7 | **校验与发布** | 公理校验 + 版本发布 | `POST /object-types/precheck` · `/validate` · `/wip` + `/apply` | ✅ |

> 用户举例的 5 步（概念 → 属性 → 完善数据来源 → 数据源确认 → 完成创建）被完整覆盖：第 5/6 步即"完善数据来源 / 数据源确认"，第 3/4 步是按本体论补足的类间关系与动能层。

### 5.3 提交策略

**前 6 步只在本地暂存，第 7 步一次性提交。**

- 理由：`POST /object-types` 是**整体 upsert**，一次提交 = 一个事务 = 不产生半成品类型
- 中途退出不丢工作：每步可「暂存草稿」→ `POST /object-types/wip`；草稿在 **运行治理 · 版本与发布** 里可见并恢复
- 第 7 步提交前强制跑 `precheckObjectTypes`（相似概念检测）与 `POST /object-types/validate`（schema 校验）；有阻断项则禁用「发布」

### 5.4 AI 内嵌（三种介入）

向导的价值一半在步骤，一半在 **AI 让它快**。

#### ① 一句话起手（向导顶部常驻输入框）

> 例：`建一个数字员工档案，含姓名/工号/部门/入职日期，数据来自 HR 库 employee 表`

提交后走 `useOntologyAssistant` 流，AI 返回结构化预填 → 逐字段回填到对应步骤。

> **决策（2026-09-17）：新增只读「草稿工具」，不走 proposal 状态机。**
>
> 调研发现：`link_type` / `backing_datasource` 作为 proposal kind 全仓不存在，这两个能力目前只有直接写方法（`upsert_link_type` / `upsert_backing_datasource`），不经状态机；且 proposal kind **无集中枚举**，裸字符串散落 5+ 处（kernel 引擎、PG DDL 默认值、copilot 工具映射、前端 union），还有 copilot 与 MCP 两套并行工具链需同步。
>
> 因此改为：给 copilot 加一个**只读**工具 `draft_ontology_concept`，输入自然语言、输出结构化草稿（对象类型 + 属性 + 关系 + 数据源），**不创建 proposal、不落库**；前端把草稿回填到向导表单。**向导的「发布」是唯一写路径**（`POST /object-types` 整体 upsert，单事务）。
>
> 这与 B3「每次 ≥1 HITL」一致——向导逐步骤 review 本身就是 HITL，且避免了同一次变更在审计里出现两条路径。
> 「AI 帮我填」按钮保留——它是单步失败时的兜底，不是主路径。

#### ② 每步的「AI 帮我填」（每步右上 sparkle 按钮）

打开内嵌对话面板，自动注入上下文：`当前步骤 + 已填内容 + 已有本体（对象类型/属性名）`。AI 返回该步字段建议 → 用户点「采用」回填。

这是最可靠的一档：任务窄、上下文小、失败可回退。

#### ③ 发布前的 AI 审查（第 7 步）

AI 对已填内容做本体论审查：命名是否与既有概念冲突、属性是否冗余、关系方向是否合理、该动作是否必须挂 HITL。输出**建议清单**（不阻断），复用 `lintAntiPatterns` 的思路。

**接线纪律**：AI 的所有产出都是 proposal，**统一走 `ProposalConfirmDrawer`**，不旁路审计（对齐 DESIGN-SPEC §6.3 与 ADR-0033 的 HITL 一致性）。

### 5.5 形态

全屏抽屉，宽 720–800px（`--mp-sheet-w` 456px 是详情浮层专用，向导另立 token）：

```text
┌─ 新建本体 ──────────────────────────── ✕ ┐
│  [✨ 用一句话描述你要建的本体…      ] 生成 │
├──────────┬──────────────────────────────┤
│ 1 概念   │                              │
│ 2 属性   │      当前步骤表单             │
│ 3 关系 ○ │      （右侧常驻 AI 面板   │
│ 4 动作 ○ │        可折叠）              │
│ 5 数据来源│                             │
│ 6 数据确认│                             │
│ 7 校验发布│                             │
├──────────┴──────────────────────────────┤
│ 暂存草稿        [上一步]  [下一步/发布]   │
└─────────────────────────────────────────┘
```

用 Semi `Steps`（`direction="vertical"`，项目内已有用例）。

---

## 6. 命名统一

菜单要做对，同一事物得只有一个名字。

| 当前混用 | 统一为 |
|---|---|
| 概念 / 类型 / 对象类型 / ObjectType | **对象类型**（口语可称"概念"） |
| 动作 / Action / ActionType | **动作类型** |
| 数据中心 / 对象数据 / 对象浏览器 | **对象浏览**（工具名） |
| 运维 | **运行治理** |

---

## 7. 路由迁移

| 新路径 | 承接 | 旧路径 301 |
|---|---|---|
| `/ontology` | 概览 | `/ontology?tab=overview` |
| `/ontology/model` | 概念建模 | `/ontology?tab=concept\|modeling\|model` · `/ontology/object-types*` · `/ontology/model/editor` · `/ontology/ops/actions` |
| `/ontology/objects` | 对象浏览 | `/ontology/explorer` · `/ontology/objects` · `/ontology?tab=objects` |
| `/ontology/datacenter` | 数据中心 | `/ontology?tab=data\|graph` · `/ontology/graph` |
| `/ontology/apps` | 分析应用 | `/ontology/ops/analytics` · `/ontology/analytics` |
| `/ontology/ops` | 运行治理 | `/ontology?tab=action\|governance` · `/ontology/ops/governance` |

`routes/legacy-redirects.tsx` 的 `ONTOLOGY_TAB_TARGET` 同步更新。

---

## 8. 实施批次

| 批次 | 内容 | 依赖 |
|---|---|---|
| **IA-1 骨架与归位** | 6 tab 注册（`domains.tsx` + `routes/ontology.tsx`）；旧路由 301；把 `AnalyticsTab` / `GovernancePage` / `OntologyModelingPage` 搬到新宿主 | 无 |
| **IA-2 概览页** | 新建 `OverviewPage`（KPI + 最近执行 + 健康 + 快捷入口） | IA-1 |
| **IA-3 概念建模合并** | 基元导航 + 图谱切换 + 编辑器并入 | IA-1 |
| **IA-4 消费动线闭环** | 对象主页（关系可点 + 面包屑）+ `ActionFormDrawer` + 语义搜索接线 | IA-1 |
| **IA-5 数据中心归位** | 数据接入视图（同步健康 + 背挂数据源 CRUD） | IA-1 |
| **B-1 后端草稿工具** | copilot 新增**只读**工具 `draft_ontology_concept`：自然语言 → 结构化草稿（对象类型 + 属性 + 关系 + 数据源）；SSE 新增草稿事件；前端消费回填。**不新增 proposal kind**（避开 5+ 散落枚举与双工具链） | 无（可与 IA 并行） |
| **IA-6 创建向导** | 7 步抽屉 + AI 三种介入 + 草稿暂存 | IA-3、IA-4；**B-1**（全量预填） |

**前置 client 补齐**（`api/ont/kernel.ts`）：

- `createLinkType` / `createActionType`（后端 `POST /link-types`、`POST /action-types` 已有，client 未暴露）
- `validateObjectType`（`POST /object-types/validate`）
- WIP 草稿：`createSchemaWip` / `applySchemaWip`（`POST /object-types/wip` + `/apply`）

**B-1 落地要点**：工具定义在 `mate-app-copilot/src/mate_app_copilot/ontology_tools.py`（`PROPOSE_*` 三件套旁新增 `DRAFT_ONTOLOGY_CONCEPT_TOOL`），注册在 `build_ontology_tools`，执行分支在 `execute_ontology_tool`。草稿事件与现有 proposal 事件并列下发（`agent_loop.py`），**不写 `ont_proposal` 表**。开工前先探真端点，确认既有四类提案的真实 JSON 形状（差距分析文档里多处契约与实测不符）。

---

## 9. 验收

- 6 个 tab 的入口、命名、主按钮与本文档 §3/§4 一致
- 旧路径全部 301 可达，无死链
- 消费动线闭环可走通：实例表 → 对象主页 → 点关系跳关联对象 → 返回 → 执行动作 → 审计可见
- 向导可从概览与概念建模两处唤起；7 步可前进/回退/跳步；中途关闭后可从未发布草稿恢复
- 向导第 7 步能检出相似概念与 schema 违规并阻断发布
- 双主题（浅/深）下 6 个 tab 渲染正常
- `scripts/check_classes.mjs` 通过；`tsc` 无新增错误

---

## 10. 诚实边界（首版不做）

| 项 | 说明 |
|---|---|
| 向导内的 Axiom / Interface 编辑 | 本体论公理与接口仍走概念建模 tab 的独立清单，不塞进创建向导 |
| 数据源新建 | `数据中心 · 新建数据源` 按钮依赖数据平台控制面，若端点未就绪则降级为只读 |
| 对象主页独立成页 | 守 DESIGN-SPEC"详情一律 Preview Sheet"，不做独立路由页 |
| Scenario 模拟 | 后端 G44 未立项，无入口 |
