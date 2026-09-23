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
