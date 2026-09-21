# ONTOLOGY-IA2-1 验收证据（工作区 Shell 与路由骨架）

> **批次**：IA2-1（ADR-0069 实施切片 2/8）
> **日期**：2026-09-18
> **分支**：`feat/ontology-ia-v2-foundation`（与 IA2-0 同分支，合成 PR-1）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md`
> **基线**：IA2-0 基线报告 `ONTOLOGY-IA2-0-BASELINE.md`（本批的全部红测试以它为准）

## 1. 改动摘要与文件清单

**做了什么**：本体域退出全局横向 PageTabs，改为工作区布局
（ContextBar + 左侧导航 + Outlet）；六大功能域（总览 / 语义模型 / 数据映射 /
对象与查询 / 动作与函数 / 发布与治理）落正式嵌套路由；新路径先挂**现有页面**
（`initialKind / initialView / initialTab` 过渡 Adapter 只定初值，不改页面内部）；
旧路径全部 301 到新路径；面包屑 / ⌘K / 高亮由单一配置 `ONTOLOGY_NAV` 驱动。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `src/pages/ontology/navigation.ts` | ONTOLOGY_NAV 单一事实源（active/planned 状态、面包屑解析、⌘K 索引） |
| `src/pages/ontology/layout/OntologyWorkspaceLayout.tsx` | 工作区布局（ContextBar + SideNav + OntologyDomainShell(Outlet)） |
| `src/pages/ontology/layout/OntologySideNav.tsx` | 左侧导航（只渲染 active 项；NavLink 前缀高亮） |
| `src/pages/ontology/layout/OntologyContextBar.tsx` | 上下文条（当前位置 + 搜索入口） |
| `src/pages/ontology/layout/ResourceDetailLayout.tsx` | 资源详情布局（至多一行局部 Tab；IA2-2 首个接入） |
| `src/pages/ontology/layout/ontology-workspace.css` | 工作区样式（全令牌取值，无 .semi-* 覆盖） |

**修改**：`routes/ontology.tsx`（嵌套路由 + ?tab= 转发表）、
`routes/legacy-redirects.tsx`（15 条旧路径 301 指向新路径）、
`components/shell/domains.tsx`（ontology `navigationMode: 'workspace'` + tabs 换六域）、
`PageTabs.tsx`（workspace 域早退，无路径特判）、`TopBar.tsx`（本体面包屑走 ONTOLOGY_NAV）、
`CommandPalette.tsx`（本体细粒度索引来自 ONTOLOGY_NAV）、
`OntologyDomainShell.tsx`（ROUTE_VIEWS 改前缀制：ontology-{overview,model,data,explore,logic,governance}）、
`ModelingPage / DatacenterPage / OpsPage`（各加一个可选 initial* prop）。

**过渡 Adapter 映射**（IA2-2~2-6 逐批替换为独立页面）：

| 新路径 | 挂载 |
| --- | --- |
| /ontology（index） | OverviewPage（保留 ?tab= 转发） |
| model/{object-types,link-types,interfaces,axioms,graph} | ModelingPage initialKind=object/link/interface/axiom/graph |
| data/{mappings,lineage} | DatacenterPage initialView=ingest/lineage |
| explore/objects · analysis · map | ObjectExplorerPage · AnalysisPage · MapPage |
| logic/{actions,functions} | ModelingPage initialKind=action/function |
| logic/designer · runs | OntologyActionPage · OpsPage initialTab=audit |
| governance/{drafts,releases} | OpsPage initialTab=release（Schema WIP 草稿面）· GovernancePage |

## 2. 旧 → 新路径表

权威矩阵 = 设计规格 §4.2（本批修正一行：裸 `/ontology/governance` 是组根，
由组 index redirect 落 **drafts**，不是退役路径）。E2E 表驱动覆盖 28 条：
`tests/e2e/ontology-ia-v2-legacy-redirects.spec.ts`。

## 3. 测试命令与真实结果（2026-09-18 实测）

| 命令 | 结果 |
| --- | --- |
| `pnpm typecheck` | ✅ |
| `pnpm build` | ✅ 22.8s（仅既有 chunk 警告） |
| `pnpm test:unit` | 65/66（IA2-0 三条契约**转绿**；唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ 5963 引用 / 866 唯一 / 996 定义 |
| `ontology-ia-v2-navigation.spec.ts` | **5/5 绿**（17.7s；IA2-0 时 5 红） |
| `ontology-ia-v2-legacy-redirects.spec.ts` | **28/28 绿**（38.6s；IA2-0 时 27 红 1 绿） |
| `ui-p1a-ontology.spec.ts`（按新 IA 重写） | **6/6 绿**（main 基线 6 红） |
| `ui-p0-shell.spec.ts` | **48/48 绿** |
| `ui-p3-acceptance.spec.ts` | **12/12 绿**（本体就绪标记与 ⌘K 用例随 IA v2 更新） |
| `context-navigate.spec.ts`（ADR-0065） | **4/4 绿**（视图名 ontology-explore / pageCode 对齐） |
| 全量 Playwright 套件 | **133 过 / 8 红 / 1 skip**；8 红 = 5 条已知预存（action-orchestration×2 后端 502、superai-routing×1 后端、ontology-dedup / ontology-agent-e2e 预存）+ 2 条 ui-p3（本批已修，复跑 12/12 绿）+ 1 条 dedup 环境性 API 超时（复测网关 119ms 健康，非前端回归）|

注：ontology-dedup / ontology-agent-e2e 两条预存红本批仍在红（直连 API 超时 /
后端 400——与 main 基线同类），按设计规格 §7.3 在 IA2-2 处置。

## 4. 浏览器验证

- 结构化探针（1440 / 1024 / 暗色，2026-09-18）：
  侧栏 200px→1024 时收窄 152px；`.mp-pagetabs` 全程 0；ContextBar 可见；
  内容区与侧栏无重叠（contentLeft ≥ navRight）；高亮项正确
  （explore/objects→「对象浏览」、model/object-types→「对象类型」）；
  暗色下 `--semi-color-bg-1` 切换为 rgba(21,24,29,1)。
- 视觉证据（已入库）：
  `tests/e2e/screenshots/ui-p1a-{explorer,graph}-{light,dark}.png`（新工作区双主题）
  `tests/visual/ui-redesign/2-ontology-{light,dark}.png`（8 域基线中的本体域）

## 5. 已知边界与回滚

**边界（诚实登记）**：
1. 尚未拆分的页面仍是容器内 tab（Modeling 7 子面 / Datacenter 3 视图 / Ops 3 面），
   URL 只到容器级——按批次 IA2-2~2-6 逐个拆出。
2. planned 项未渲染未注册路由（model/validation、data/sync、explore/objects/:rid、
   logic/actions/:rid、governance/{usage,lint,security,import-export,audit}）。
3. ContextBar 的「创建资源」下拉未做：对象类型创建入口在建模工作台内部，
   跨页触发信号随 IA2-2 提供；本体名称 / Release 徽标等本体元数据 API 可用时接入。
4. `AppsPage` 不再被路由引用（/ontology/apps 301 → explore/analysis），
   文件保留，IA2-4 确认 Dashboard 归属后处置；`DashboardPage` 同。
5. 侧栏交互式折叠（手动展开/收起）未做（CSS 自适应 1024 已有，非阻断项）。
6. 预存红清单见 §3 注。

**回滚**：本批一个 commit 组即可回退；紧急回退路径 = 恢复
`domains.tsx` 的 `navigationMode`（去掉 workspace 声明）+ 回退
`routes/ontology.tsx` / `legacy-redirects.tsx` 两个文件，即回到 6-tab IA。
旧路径 301 与新路由并存，至少保留一个发布周期（ADR-0069 不变量 2/5）。

## 6. 结论

IA2-1 准出达成：新左导航可用、六大域正确高亮、深链 / 刷新 / 前进后退正确、
IA2-0 全部失败测试转绿、现有功能经全量套件验证无新增回归、无 Agent 文件变更
（context-navigate 仅同步路径常量，行为断言不变）。
