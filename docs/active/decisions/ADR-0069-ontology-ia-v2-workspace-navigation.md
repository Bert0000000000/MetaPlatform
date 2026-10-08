# ADR-0069：Ontology IA v2 —— 本体域改左侧工作区导航，路由即状态

- **状态**：Accepted（IA2-0 设计冻结；实现按 IA2-1 ~ IA2-7 分批落地）
- **日期**：2026-09-18
- **关联**：`docs/active/specs/2026-09-18-ontology-ia-v2-design.md`（设计规格 + 路由矩阵）；
  `docs/active/delivery/evidence/ONTOLOGY-IA2-0-BASELINE.md`（基线报告）；
  上游输入 `docs/active/specs/MetaPlatform-调整优化方案执行计划-2026-09-17.md` G5（收敛本体产品闭环）
- **基线**：`main@d4a56521`（其中 2026-09-17 的 6-tab 横向重排 `45466d7e` 是本 ADR 的直接前置）

## 1. 背景

### 1.1 现状（2026-09-17 IA 重排之后）

本体域当前是 6 个平级路由（`/ontology`、`/model`、`/objects`、`/datacenter`、`/apps`、`/ops`）
+ 2 个过渡路由（`/ops/actions`、`/ops/governance`），由 `domains.tsx` 注册为全局横向 PageTabs。
导航状态大量停留在**页面内部 useState**：

- `ModelingPage` 内部 `kind` state 切对象/关系/动作/函数/接口/公理/图谱 7 个子面；
- `DatacenterPage` 内部 `view` state 切数据接入/血缘/资产；
- `AppsPage` 内部 `app` state 切分析/仪表盘/地图；
- `OpsPage` 内部 `tab` state 切版本/审计/治理；
- `GovernancePage` 把草稿、版本、导入导出、使用量、Lint、安全策略、Action 审计、
  Agent 指标堆在一个 734 行大页面里。

由此产生的产品问题：二级能力没有正式 URL（不可分享、刷新即丢）、
「横向 Tab 套横向 Tab」、`GovernancePage` 对 Agent 服务的指标依赖把本体域和 Agent 域耦在一起。

### 1.2 为什么现在做

上游执行计划（G5）要求本体从「功能集合」收敛为
「模型发布 → 对象消费 → Action → 确认 → 回写 → 审计」标准闭环。
闭环的每一步都要有可链接的正式入口，这是本 ADR 的路由部分；
而左侧工作区导航是承载六段动线的容器。**本 ADR 只动 IA / 路由 / 导航，不新增本体引擎能力。**

## 2. 决策

**一句话**：本体域退出全局横向 PageTabs（`navigationMode: 'workspace'`），
改为域内左侧导航（`OntologySideNav`，由单一配置 `ONTOLOGY_NAV` 驱动）；
六大功能域（总览 / 语义模型 / 数据映射 / 对象与查询 / 动作与函数 / 发布与治理）
及其二级页面全部获得正式 URL；页面内承担产品导航的 useState 一律迁入路由
（path + query string）。

### 2.1 三级导航层级

```
平台级       IconRail（8 域，不变）
工作区级     OntologySideNav（本体域专属，ONTOLOGY_NAV 单一配置）
资源详情级   ResourceDetailLayout（单资源局部 Tab，最多一行）
```

### 2.2 路由即状态

进入 URL 的：功能页、资源 RID、详情 Tab、对象类型/实例、搜索词、筛选、排序、页码、视图模式。
留在组件内的：Drawer 开关、列宽、hover、未提交表单、动画折叠态。

### 2.3 单一配置源

新增 `src/pages/ontology/navigation.ts`（`ONTOLOGY_NAV`，含 `status: 'active' | 'hidden' | 'planned'`），
同时驱动：左侧导航、路由高亮、TopBar 面包屑、Command Palette、页面标题、测试路径矩阵。
禁止在多处硬编码路径；禁止用 `location.pathname.startsWith('/ontology')` 之类字符串特判
（`PageTabs` 只认 `domain.navigationMode`）。

### 2.4 不展示假功能

目标 IA 中暂无真实能力的页面（关系映射 / ObjectSet 构建器 / 审批策略等）不建空壳、
不进正式导航；可登记为 `status: 'planned'`（`visible: false`），等真实 API + 验收后再打开。

### 2.5 明确不做的

- 不动 Agent Runtime / Agent Team / SuperAI / MCP / LLM 相关目录与文件；
- 不新增后端本体能力、不改契约；
- 不迁移 AppHub（Dashboard 从本体导航移除后保留兼容文件，归宿另立任务）；
- 全局数据资产门户（CDC / Paimon / Iceberg / Data Product）迁回「数据与治理」域，
  若本批不能安全迁移则先从本体导航移除并单独登记 Gov 域迁移任务；
- 不移除全局 CopilotDock；`OntologyDomainShell` 的 ADR-0065 S2 导航上下文写入保留并随新路由扩展。

## 3. 不变量

1. **对象消费闭环不退化**：对象列表 → 打开对象 → 关系跳转 → Action → Proposal 确认 → 审计，
   全链路在新路由下可用。
2. **旧路径全部可达**：§5 迁移表中的每个旧路径（含 `?tab=` 变体）301 到新路径，
   保留可安全迁移的 query 参数；旧路径至少保留一个发布周期。
3. **本体域不依赖 Agent 服务**：总览与治理页删除 Agent metrics 后，Agent 服务关闭时页面仍正常。
4. **一份权威路由矩阵**：`legacy-redirects.tsx` 与 `routes/ontology.tsx` 不得重复注册同一路径；
   矩阵以设计规格文档 + 表驱动 E2E 为准。
5. **每批可独立回滚**：IA2-1 回退即恢复 `navigationMode: 'tabs'` + 原六路由；
   迁移批先保留 Legacy 容器，稳定后再删。
6. **工程红线**：不新增 `.semi-*` CSS 覆盖、不新增静态 inline style、不拿 Mock 冒充真实数据。

## 4. 影响与残差风险

| 风险 | 处理 |
| --- | --- |
| 一次拆完导致大 PR | 严格按 IA2-0 ~ IA2-7 分批，PR-1 只含 foundation |
| 新旧路由并存冲突 | 单一路由矩阵 + 表驱动 redirect E2E（本批已落失败测试） |
| 复制页面造成双状态 | 只移动/抽取，不复制业务逻辑；删除前 Legacy 容器与新页面不同时挂路由 |
| Dashboard 归属未定 | 先从本体导航移除、保留文件，AppHub 迁移单独跟踪 |
| TopBar 面包屑破坏 | 面包屑从 `ONTOLOGY_NAV` 解析，不动其他 7 域逻辑 |
| Agent 分支并发冲突 | 不改 Agent 目录；共享文件（domains.tsx / TopBar / CommandPalette）小 PR |
| ADR-0065 上下文退化 | `ROUTE_VIEWS` 随新路由同步扩展，纳入 IA2-1 验收 |

**残差**：`ui-p1a-ontology.spec.ts` 等 3 个 spec 在 main 上已是红基线
（见基线报告 §2），IA2-1 起按新 IA 重写对应用例，不在本批修。

## 5. 实施切片（与设计规格 §9 一致）

IA2-0 设计 + 基线 + 失败测试（本 ADR + 设计规格 + 基线报告 + 红 spec）→
IA2-1 工作区 Shell 与路由骨架 → IA2-2 语义模型 → IA2-3 数据映射 →
IA2-4 对象与查询 → IA2-5 动作/函数/执行记录 → IA2-6 发布治理总览 → IA2-7 清理验收。

## 6. 验收标准（浓缩，全文见设计规格 §11）

- 六大功能域命名/顺序正确，本体域不渲染全局 PageTabs，工作区有左侧导航；
- 每个 active 子页面有正式 URL，刷新/前进/后退/深链正确，面包屑与 ⌘K 可用；
- 旧路径矩阵全绿；对象消费闭环、Action 编排、版本 Diff/Rollback、映射同步、分析地图不退化；
- Agent 服务不可用不影响本体页面；typecheck / build / unit / E2E 通过；证据落档。

## 7. 参考

- 实施方案输入（用户提供的 v1.0 执行版方案，2026-09-17）
- `45466d7e feat(ontology): 本体模块 IA 重排 + 消费动线闭环`（6-tab 前置）
- Palantir Foundry 对位差距分析 `docs/active/specs/2026-09-09-*`（UI-01 对象浏览器等）


---

## 附录：2026-09-24 导航呈现改回横向 Tab 模式（用户决策）

用户使用后决策：**本体导航回归与全站一致的横向 PageTabs**（主 tab = 六大功能组，
children 胶囊行 = 各组子页面，与 ki/gov/admin 域同构）。

**保留不变的（本 ADR 的核心成果）**：
- 全部正式 URL 与权威路由矩阵（六大功能组 23 个 active 子页）
- 路由即状态（:rid 段路由、Tab 进 URL、query 参数、redirect 语义）
- 旧路径 301 矩阵、⌘K 细粒度索引（ONTOLOGY_NAV）、planned 项登记
- 全部子页拆分成果（容器消亡、职责互斥）、零 Agent 依赖

**改变的（仅呈现层）**：
- `DomainDef.navigationMode: 'workspace'` 机制移除（无使用者）；
  domains.tsx 的 ontology tabs 扩为「主 tab + children」完整结构
- `OntologyWorkspaceLayout / OntologySideNav / OntologyContextBar` 删除，
  由 `OntologyTabLayout`（仅域壳 + Outlet）替代
- 面包屑回归 PageTabs 的 tab/children 默认解析

**历史注记**：左侧工作区导航为 2026-09-18 ~ 09-23 的 IA v2 交付形态；
本附录不否定该交付（其路由/拆分成果全部延续），仅调整导航呈现以统一全站交互。

## 附录：2026-10-08 本体建设工作区呈现决定（Accepted）

用户已确认[Builder V2 对齐设计](../../superpowers/specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)并授权实施。本附录覆盖 2026-09-24 附录中的横向导航呈现决定；该历史记录和既有路由、页面拆分、旧深链成果保留。

- 本体采用平台 IconRail → 六域左侧工作区导航 → 单资源详情页签；其他七域继续 PageTabs。本体域声明 `navigationMode: 'workspace'`，兼容 tabs 元数据由 `ONTOLOGY_NAV` 派生。
- 一级本体入口为 `/ontology/model/graph`（模型工作台），语义模型的默认子页同为模型工作台。`/ontology` 继续为总览，`/ontology/overview` 为别名；全站根入口继续 `/home`。
- 六域导航、命令搜索、面包屑与兼容 tabs 共享 `ONTOLOGY_NAV`，仅 active 项可进入导航，当前页以最长路径匹配，详情深链归入所属资源入口。
- 窄屏通过可访问按钮展开导航，路由跳转后收起；刷新、前进后退和旧路径重定向保留。`OntologyDomainShell` 继续发布 ADR-0065 的真实路由及打开记录上下文。
- 平台定位区采用深色主题令牌，工作区使用 Semi 与应用令牌；不新增 Semi 内部样式覆盖，不展示虚构项目、分支、Owner 或草稿数量。

实施及证据边界见[对齐计划](../../superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md)：渲染单元、独立浏览器、真实后端、CI、部署与业务验收分别记录。

## 附录：2026-10-08 后补七入口与本体职责归组（Accepted）

用户随后选择[七入口修订设计](../../superpowers/specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)的产品导航方案。本决定覆盖本 ADR 前一附录的八入口呈现和原六域标签，不把产品重设计提案中的后台能力全部转为已接受需求。

- 一级菜单依次为工作台、业务应用、对象探索、本体工作室、数字员工、连接与知识、治理与管理。SuperAI 为常驻能力，保留 Copilot、完整 `/superai/chat` 和全部既有 SuperAI 深链及搜索入口。
- 同一产品域注册表派生侧栏/顶栏菜单、命令索引和最长路由前缀归属。对象探索承接 `/ontology/explore/*`；治理与管理承接 `/gov/*`、`/admin/*` 及现有 `/ontology/governance/security` 权限策略，其他正式 URL 保留。
- 本体工作室六组为概览、业务模型、数据接入、业务动作、变更发布、运行与质量。同步、模型校验、执行记录、审计、使用量归入运行与质量；模型检查的旧路径指向同一模型校验实现。接口/公理及函数/编排保留高级入口，planned 项不进入菜单。
- 对象探索和统一治理中的本体策略页面仍由 `OntologyDomainShell` 发布原路由、打开记录及租户上下文，保持高度约束，但不套建设侧栏。对象浏览、ObjectSet、聚合与地图由同一正式导航配置派生。
- 本次只改入口、归组和兼容别名；不复制数据、权限或模型事实，不新增原型身份、角色及前端权限。缺少现行角色到菜单的映射时不编造裁剪规则，服务端授权保持权威。
- 保留窄屏导航打开、选择、Escape 的可见焦点恢复，旧路径、查询参数和浏览器历史继续可用。验证边界与独立资源沿用[当前计划](../../superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md) Task 7/6。

## 附录：2026-10-08 全平台功能组与页面导航呈现（Accepted）

依据[全平台对齐设计 §4.1/5/10](../../superpowers/specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)，本附录覆盖前述“本体六组左侧导航、其他域 PageTabs”的阶段呈现。平台七入口及常驻 SuperAI 保留；所有域统一为顶部功能组、左侧当前组页面、内容区内部资源详情页签。本体不再叠加旧六组侧栏，但 `OntologyDomainShell` 的高度和真实助手上下文继续生效。

功能组与页面从 `domains.tsx` 派生；本体继续消费 `ONTOLOGY_NAV`。已有嵌套页面沿用父组，平铺页面按现有职责归组，单组仍展示组标题与页面列表。最长边界路径选择支持详情深链与别名，不在渲染时跳首项；组入口使用该组已登记的真实页面。搜索和面包屑消费同源组/页面元数据。

采用深色带标签窄栏、浅色顶栏/组栏/页面导航及浅灰内容背景；颜色消费现有主题令牌，新用户默认 light，保留本地和远端已有主题及 side/top 偏好。390px 的组栏局部滚动、页面导航按钮展开；打开转移焦点、Escape/选择恢复可见按钮。平台壳不存业务事实，不移植原型演示角色、工作区、分支或环境健康。

正式路由及旧 URL 保留；仅纳入源码实际已注册页面，未支持原型页不生成入口。当前路由覆盖清单与 focused unit 证据落在[计划 Task 8](../../superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md)工作区，实际全入口浏览器及四尺寸验收由 Task 5/6 独立记录。
