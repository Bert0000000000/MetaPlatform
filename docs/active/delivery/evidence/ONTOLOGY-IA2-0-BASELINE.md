# ONTOLOGY-IA2-0 基线报告（Ontology IA v2 · 设计与基线批次）

> **批次**：IA2-0（设计、基线与失败测试）
> **日期**：2026-09-18
> **代码基线**：`origin/main@d4a56521`（PR #65 合并后；与 IA v2 方案编制基线
> `main@24976a4` 相比新增了 2026-09-17 的本体 6-tab IA 重排 `45466d7e` 与
> ADR-0065 S2/S3 提交，均已在设计中核对吸收）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md`
> **工作分支**：`feat/ontology-ia-v2-foundation`（worktree `.worktrees/ontology-ia-v2-foundation`）

## 1. 工程基线（apps/web，2026-09-18 实测）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `pnpm typecheck` | ✅ 通过 |
| 构建 | `pnpm build` | ✅ 40.55s（仅 chunk >500kB 警告，预存） |
| 单元 | `pnpm test:unit` | 62/63 通过；1 预存红（ProposalConfirmDrawer，2026-09-15 已登记） |
| CSS 治理 | `node scripts/check_classes.mjs` | ✅ 5950 引用 / 855 唯一 / 983 已定义 |

## 2. Ontology E2E 基线（3 spec · 8 用例，2026-09-18 实测）

**结论：8/8 红，全部为预存红，非本批引入。**根因分三类：

1. **`ui-p1a-ontology.spec.ts`（6 条）——文案漂移**。2026-09-17 提交 `45466d7e`
   （本体 6-tab IA 重排）把 tab 文案 `对象浏览器→对象浏览`、`类型建模→概念建模`、
   `运维→运行治理` 改了，但没同步该 spec 的 `hasText` 断言；spec 首个断言即扑空。
   证据：`git show 45466d7e -- src/components/shell/domains.tsx` 的 label diff；
   实机 DOM 探针确认 `.mp-pagetabs .semi-tabs-tab` 与「对象浏览」tab 均正常存在。
2. **`ontology-dedup.spec.ts`、`ontology-agent-e2e.spec.ts`（各 1 条）**——
   2026-09-15 基线记忆已登记的既有红（后端 400 / 抽屉交互），本日复跑仍红。
3. **环境噪声（已甄别，不计入用例红）**：
   - 首轮复跑时 8 条全红的直接原因是 **vite 冷启动**——`pnpm dev` 监听 9250 后
     esbuild 预构建未完成，用例 20s 可见性超时打光；**跑套件前必须先预热路由**。
   - vite watcher 因 Playwright HTML reporter 写入 `playwright-report/`（Windows
     文件锁 EBUSY）**整进程崩溃**——这是「dev server 自行退出」现象的真面目。
     本批修复：`vite.config.ts` 增加 `server.watch.ignored`（见 §4）。

已知其他预存红（本批未跑，记忆登记）：`action-orchestration.spec.ts`（后端 502）、
`superai-routing.spec.ts`（后端角色快照）。均与 IA v2 无关。

## 3. 代码事实核对（IA v2 方案 §1 基线逐条核实）

| 方案断言 | 核实结果 |
| --- | --- |
| 6 平级路由 + 2 过渡路由 | ✅ `routes/ontology.tsx`：`/ontology`、`/model`、`/objects`、`/datacenter`、`/apps`、`/ops` + `/ops/actions`、`/ops/governance` |
| domains.tsx 注册全局横向 PageTabs | ✅ ontology 6 tabs；`DomainDef` 无 `navigationMode` 字段（IA2-1 新增） |
| 四个大页面用 useState 当导航 | ✅ `ModelingPage.kind`（7 子面）/ `DatacenterPage.view` / `AppsPage.app` / `OpsPage.tab` |
| GovernancePage 大杂烩 + Agent 指标 | ✅ 734 行；`agentSummary`/`agentTrend` 依赖 `api/ont/agentMetrics`；Overview 同样引用 |
| 对象浏览→关系→Action→Proposal 链路存在 | ✅ `ObjectExplorerPage` + `ActionFormDrawer` + `ProposalConfirmDrawer`（+ 预存红单测） |
| 旧路径已有一层 301 | ✅ `legacy-redirects.tsx` 含 `ontology/explorer`、`relationship-types`（方案迁移表未列，已补入矩阵）、`object-types/:rid`、`graph`、`action(s)`、`analytics`、`governance` 等 |
| 页面规模 | 容器合计约 8.1k 行（`OntologyActionPage` 2267 行为最大单件；方案所述「11 万行级」系高估，迁移策略不变：只迁不复制） |
| 方案未提及的既有事实 | `actions/ActionTypeListPage.tsx`（148 行）**未挂路由**，仅被两处引用 `actionDisplayName`——IA2-5 处置；`OntologyDomainShell.ROUTE_VIEWS` 承担 ADR-0065 S2 上下文写入，新路由必须同步扩展；`context-navigate.spec.ts` 硬编码 `/ontology/objects` 与 `ontology-objects` 视图名 |

## 4. 本批变更清单（IA2-0）

1. `docs/active/decisions/ADR-0069-ontology-ia-v2-workspace-navigation.md`（决策）
2. `docs/active/specs/2026-09-18-ontology-ia-v2-design.md`（设计规格 + 权威路由矩阵）
3. 失败测试（红，待 IA2-1 转绿）：
   - `src/components/shell/ontology-navigation-mode.test.tsx`
   - `tests/e2e/ontology-ia-v2-navigation.spec.ts`
   - `tests/e2e/ontology-ia-v2-legacy-redirects.spec.ts`
4. 环境加固：`vite.config.ts` `server.watch.ignored`（playwright 报告目录不再
   打崩 dev server；不改任何功能代码）

**明确不做**：不改任何功能页面内容；不修 §2 的预存红（处置批次见设计规格 §7.3）。

## 5. 失败测试的「红因」记录（防止误判）

| 测试 | 当前红因 | 转绿批次 |
| --- | --- | --- |
| `ontology-navigation-mode.test.tsx` | `DomainDef` 无 `navigationMode`；本体域仍渲染 PageTabs | IA2-1 |
| `ontology-ia-v2-navigation.spec.ts` | 新路由不存在，访问落 `*` 兜底被甩回 `/home`；无左侧导航 | IA2-1 |
| `ontology-ia-v2-legacy-redirects.spec.ts` | 旧 301 目标仍是 6-tab 旧路径 | IA2-1 |

CI 影响：apps/web 的 CI 只跑 `typecheck`（`ci.yml`），红测试不影响 required
checks；`ontology-loop.yml` 只管 `metaplatform-frontend/tests/e2e/ontology-loop/**`
（另一目录），与本批无关。

## 6. 后续批次验收口径

按设计规格 §6 批次表与 §8 验收标准执行；IA2-7 收口时另落
`ONTOLOGY-IA2-ACCEPTANCE.md` 并更新 Program Board。
