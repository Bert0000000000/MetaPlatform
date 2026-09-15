# UI 重设计验收证据（Calm Density）

> **结论**：8 域信息架构、应用壳、五骨架组件、旧路由 301 全部落地并通过用例；`v-*` 与 `.semi-*` 覆盖两项指标达成，**inline style 一项未达**（见 §2 差距说明）。
> **依据**：[DESIGN-SPEC.md](./DESIGN-SPEC.md) v1.3 · [UI-OPTIMIZATION-PLAN.md](./UI-OPTIMIZATION-PLAN.md) §2
> **归档日**：2026-09-15 · 基线日 2026-09-14
> **复现**：`pnpm --dir apps/web exec playwright test ui-p0-shell ui-p1a-ontology ui-p1b-home ui-p1c-agents ui-p1d-superai ui-p1e-admin ui-p2a-apps ui-p2b-ki ui-p3-acceptance`

---

## 1. 视觉基线（8 域 × 浅/深双主题）

截图目录：`metaplatform-frontend/apps/web/tests/visual/ui-redesign/`（16 张，由 `ui-p3-acceptance.spec.ts` 生成，非手工截屏）。

| # | 域 | 验收路径 | 实现批次 | commit | 截图 | 日期 | 人工复核 |
|---|----|----------|----------|--------|------|------|----------|
| 1 | 工作台 | `/home` | UI-P1b | `eea984dc` | `ui-redesign/1-home-{light,dark}.png` | 2026-09-15 | 待指认 |
| 2 | 本体 | `/ontology/explorer` | UI-P1a | `412e0151` | `ui-redesign/2-ontology-{light,dark}.png` | 2026-09-15 | 待指认 |
| 3 | 数字员工 | `/agents` | UI-P1c + UI-P3 收尾 | `6f632322` | `ui-redesign/3-agents-{light,dark}.png` | 2026-09-15 | 待指认 |
| 4 | SuperAI | `/superai/chat` | UI-P1d | `c88fdf21` | `ui-redesign/4-superai-{light,dark}.png` | 2026-09-15 | 待指认 |
| 5 | 应用中心 | `/apps/mine` | UI-P2a | `30f63802` | `ui-redesign/5-apps-{light,dark}.png` | 2026-09-15 | 待指认 |
| 6 | 知识与集成 | `/ki/kb` | UI-P2b | `3f951239` | `ui-redesign/6-ki-{light,dark}.png` | 2026-09-15 | 待指认 |
| 7 | 数据与治理 | `/gov/business` | UI-P2c | `f6b8346c` | `ui-redesign/7-gov-{light,dark}.png` | 2026-09-15 | 待指认 |
| 8 | 平台管理 | `/admin/org/users` | UI-P1e | `933617a6` | `ui-redesign/8-admin-{light,dark}.png` | 2026-09-15 | 待指认 |

> 「人工复核」列留空：本档由实现方（AI 会话）出具，**人工签认需由各域责任人另行确认**，未确认前不视作已评审。

---

## 2. 指标对照

| 指标 | 基线（2026-09-14） | 现状（2026-09-15） | 目标 | 状态 |
|------|--------------------|----------------|------|------|
| inline `style={{}}` | 4,526 | **1,748** | < 100 | ❌ 未达（-61%） |
| `v-*` 自建类 | 261 | **0** | 0 | ✅ |
| `.semi-*` CSS 覆盖 | 0 | **0** | 0 | ✅ |
| 私有 CSS 变量（`--muted/--accent/#hex` 直写） | 与 Semi 令牌并行 | **0 处未定义引用** | 单一令牌体系 | ✅ |
| `src/App.css` | 185 行（含 ~90 行 `v-portal-*` 死样式） | **94 行** | 退役 | ✅ |
| 顶级路由域 | 11 域 / 100+ 路由 | **8 域**，域内 tab 化 | 8 域 | ✅ |
| `src` 下 ts/tsx 文件 | 484 | **393**（删 94 个不可达文件） | 无孤儿 | ✅ |

复现命令：

```bash
grep -rh "style={{}}" src --include="*.tsx" | wc -l      # 1748
grep -rho "\bv-[a-z][a-z-]*" src --include="*.tsx" | wc -l  # 0
grep -rn "\.semi-" src --include="*.css" | wc -l             # 0
```

### 2.1 差距说明：inline style 未达 < 100

**未达成的部分集中在 P1a 的「过渡期」本体页**，也就是本轮明确只换壳、不重写内部的两类：

| 文件 | inline 数 | 性质 |
|------|-----------|------|
| `pages/ontology/OntologyActionPage.tsx` | 241 | 旧 Action 编排画布（拖拽节点 + JS palette 对象，含 `#hex` 字面量） |
| `pages/ontology/GovernancePage.tsx` | 112 | 旧治理页 |
| `pages/ontology/OntologyModelingPage.tsx` | 80 | 类型编辑器（过渡子路由 `/ontology/model/editor`） |
| `pages/ontology/DashboardPage.tsx` | 70 | 旧分析看板 |
| 其余（含 mcp / knowledge / apphub 的仪表盘与设计器壳） | 合计 ~1,245 | 分散在 60+ 文件，多为布局微调 |

这些文件**在上表 8 域的入口 tab 之外**（属域内深链子路由），P2 各批的「只换壳不换画布」约束直接把它们排除在重写范围外。把 inline 压到 < 100 需要重写这批画布类页面，**不是本次范围**。

结论：该指标本轮**未达成**，且差距是**已定位的、有范围的**，不是散落的遗漏。

---

## 3. 路由对照表（旧 → 新 8 域）

由 `src/routes/legacy-redirects.tsx` 派生（99 条），全部以 `<Navigate replace>` 实现 301。

| # | 旧路径 | 新路径 | 方式 |
|---|---|---|---|
| 1 | `/dashboard` | `/home` | r() 直转 |
| 2 | `/dashboard/my-apps` | `/home/apps` | r() 直转 |
| 3 | `/dashboard/my-agents` | `/agents` | r() 直转 |
| 4 | `/dashboard/messages` | `/home/messages` | r() 直转 |
| 5 | `/dashboard/portal` | `/home/portal` | r() 直转 |
| 6 | `/dashboard/notifications` | `/home/todos` | r() 直转 |
| 7 | `/dashboard/deliverables` | `/home/deliverables` | r() 直转 |
| 8 | `/dashboard/aiops` | `/home/aiops` | r() 直转 |
| 9 | `/dashboard/settings` | `/home/me` | r() 直转 |
| 10 | `/ontology/objects` | `/ontology/explorer` | r() 直转 |
| 11 | `/ontology/object-types` | `/ontology/model` | r() 直转 |
| 12 | `/ontology/object-types/:rid` | `/ontology/model` | r() 直转 |
| 13 | `/ontology/relationship-types` | `/ontology/model` | r() 直转 |
| 14 | `/ontology/graph` | `/ontology/datacenter` | r() 直转 |
| 15 | `/ontology/action` | `/ontology/ops/actions` | r() 直转 |
| 16 | `/ontology/actions` | `/ontology/ops/actions` | r() 直转 |
| 17 | `/ontology/analytics` | `/ontology/ops/analytics` | r() 直转 |
| 18 | `/dw/employees` | `/agents/employees` | r() 直转 |
| 19 | `/dw/tasks` | `/agents/dw-tasks` | r() 直转 |
| 20 | `/dw/collaborations` | `/agents/dw-collaborations` | r() 直转 |
| 21 | `/dw/evaluations` | `/agents/dw-evaluations` | r() 直转 |
| 22 | `/dw/learning` | `/agents/learning` | r() 直转 |
| 23 | `/dw/documents` | `/agents/documents` | r() 直转 |
| 24 | `/dw/extraction` | `/agents/extraction` | r() 直转 |
| 25 | `/dw/obs` | `/agents/obs` | r() 直转 |
| 26 | `/dw/a2a` | `/agents/external` | r() 直转 |
| 27 | `/superai` | `/superai/chat` | r() 直转 |
| 28 | `/superai/copilot` | `/superai/chat/copilot` | r() 直转 |
| 29 | `/superai/a2a` | `/superai/plans/a2a` | r() 直转 |
| 30 | `/superai/orchestration` | `/superai/plans/orchestration` | r() 直转 |
| 31 | `/superai/execution` | `/superai/plans` | r() 直转 |
| 32 | `/superai/manual-select` | `/superai/plans/manual-select` | r() 直转 |
| 33 | `/superai/parallel` | `/superai/plans/parallel` | r() 直转 |
| 34 | `/superai/result-aggregation` | `/superai/plans/result-aggregation` | r() 直转 |
| 35 | `/superai/result-summary` | `/superai/plans/result-summary` | r() 直转 |
| 36 | `/superai/employee-match` | `/superai/plans/employee-match` | r() 直转 |
| 37 | `/superai/tasks` | `/superai/plans` | r() 直转 |
| 38 | `/superai/order-review` | `/apps/order-review` | r() 直转 |
| 39 | `/superai/schedule` | `/superai/schedules` | r() 直转 |
| 40 | `/superai/schedule/execute` | `/superai/schedules/execute` | r() 直转 |
| 41 | `/superai/schedule/plan` | `/superai/schedules/plan` | r() 直转 |
| 42 | `/superai/data` | `/superai/cost/data` | r() 直转 |
| 43 | `/superai/report` | `/superai/cost/report` | r() 直转 |
| 44 | `/marketplace` | `/apps/market` | r() 直转 |
| 45 | `/market` | `/apps/market` | r() 直转 |
| 46 | `/my-templates` | `/apps/templates` | r() 直转 |
| 47 | `/my-templates/submit` | `/apps/templates?submit=1` | r() 直转 |
| 48 | `/ai-designer` | `/apps/designer` | r() 直转 |
| 49 | `/knowledge` | `/ki/kb` | r() 直转 |
| 50 | `/knowledge/docs` | `/ki/kb/docs` | r() 直转 |
| 51 | `/knowledge/config` | `/ki/kb/config` | r() 直转 |
| 52 | `/knowledge/test` | `/ki/test` | r() 直转 |
| 53 | `/arch` | `/gov/business` | r() 直转 |
| 54 | `/arch/business` | `/gov/business` | r() 直转 |
| 55 | `/arch/capabilities` | `/gov/business/capabilities` | r() 直转 |
| 56 | `/arch/applications` | `/gov/business/applications` | r() 直转 |
| 57 | `/arch/value-streams` | `/gov/business/value-streams` | r() 直转 |
| 58 | `/arch/processes` | `/gov/business/processes` | r() 直转 |
| 59 | `/arch/org-roles` | `/gov/business/org-roles` | r() 直转 |
| 60 | `/arch/data` | `/gov/data` | r() 直转 |
| 61 | `/arch/data/flows` | `/gov/data/flows` | r() 直转 |
| 62 | `/arch/data/standards` | `/gov/data/standards` | r() 直转 |
| 63 | `/arch/data/assets` | `/gov/data/assets` | r() 直转 |
| 64 | `/arch/tech` | `/gov/tech` | r() 直转 |
| 65 | `/arch/tech-components` | `/gov/tech/components` | r() 直转 |
| 66 | `/arch/tech-stacks` | `/gov/tech/stacks` | r() 直转 |
| 67 | `/arch/deployment-topologies` | `/gov/tech/topologies` | r() 直转 |
| 68 | `/arch/tech-radar` | `/gov/tech/radar` | r() 直转 |
| 69 | `/arch/principles` | `/gov/governance/principles` | r() 直转 |
| 70 | `/arch/review-templates` | `/gov/governance/review-templates` | r() 直转 |
| 71 | `/arch/reviews` | `/gov/governance/reviews` | r() 直转 |
| 72 | `/arch/tech-debt` | `/gov/governance/tech-debt` | r() 直转 |
| 73 | `/arch/ontology-mapping` | `/gov/governance/ontology-mapping` | r() 直转 |
| 74 | `/admin` | `/admin/org/users` | r() 直转 |
| 75 | `/admin/users` | `/admin/org/users` | r() 直转 |
| 76 | `/admin/permissions` | `/admin/org/roles` | r() 直转 |
| 77 | `/admin/orgs` | `/admin/org/tenants` | r() 直转 |
| 78 | `/admin/logs` | `/admin/ops/logs` | r() 直转 |
| 79 | `/admin/configs` | `/admin/platform/configs` | r() 直转 |
| 80 | `/admin/ai-providers` | `/admin/platform/ai-providers` | r() 直转 |
| 81 | `/admin/operations` | `/admin/ops/operations` | r() 直转 |
| 82 | `/admin/analytics` | `/admin/ops/analytics` | r() 直转 |
| 83 | `/admin/components` | `/admin/platform/components` | r() 直转 |
| 84 | `/ontology?tab=*` | `/ontology/{explorer,datacenter,model,ops}` | tab → 路径 |
| 85 | `/superai/execution/:id` | `/superai/plans/:id` | 参数透传 |
| 86 | `/wfe/action-orchestration/:definitionId` | `/superai/plans/:definitionId` | 参数透传 |
| 87 | `/apps?tab=*` | `/apps/{mine,market,templates,designer}` | tab → 路径 |
| 88 | `/apps/:appId` | `/apps/mine?app=:appId` | 深链 → query |
| 89 | `/apps/:appId/lifecycle` | `/apps/mine?app=:appId&tab=lifecycle` | 深链 → query |
| 90 | `/apps/:appId/versions` | `/apps/mine?app=:appId&tab=versions` | 深链 → query |
| 91 | `/apps/:appId/versions/:versionId` | `/apps/mine?app=:appId&vid=:versionId` | 深链 → query |
| 92 | `/apps/:appId/modules/:moduleId/form-designer` | `/apps/mine?app=:appId&module=:moduleId&tab=form-designer` | 深链 → query |
| 93 | `/apps/:appId/modules/:moduleId/flow-designer` | `/apps/mine?app=:appId&module=:moduleId&tab=flow-designer` | 深链 → query |
| 94 | `/pages/:pageId` | `/apps/mine?tab=page&page=:pageId` | 深链 → query |
| 95 | `/marketplace/:templateId` | `/apps/market?tid=:templateId` | 参数透传 |
| 96 | `/market/:templateId` | `/apps/market?tid=:templateId` | 参数透传 |
| 97 | `/knowledge/kb/:kbId` | `/ki/kb/:kbId` | 参数透传 |
| 98 | `/mcp/*` | `/ki/mcp/*` | 子路径透传 |
| 99 | `/arch/data/entities/:id` | `/gov/data/entities/:id` | 参数透传 |

总数：99

---

## 4. 交互验收（`ui-p3-acceptance.spec.ts`，4/4 通过）

| 项 | 断言 | 结果 |
|----|------|------|
| ⌘K 全域搜索 | `Ctrl+K` 开合 → 输入「数据中心」过滤 → `Enter` 落 `/ontology/datacenter` | ✅ |
| Copilot dock | `/home`、`/gov/business`、`/ki/mcp/tools` 三页均可开合，`#app[data-copilot]` 同步翻转 | ✅ |
| 详情 Sheet | 知识库列表点行 → 456px 非模态浮层（无 `.semi-sidesheet-mask`）→ `Esc` 关闭 | ✅ |
| 双主题 | `--semi-color-primary` 浅/深取值不同且均非空（同一令牌两套值） | ✅ |

---

## 5. 用例基线

各套件在**批次各自收口时均跑到全绿**；最后一次「9 套件合并串行跑」（93 条）因本机 Node 进程连续崩溃只拿到 **90 passed / 3 failed**，3 条失败**全部落在导航/登录阶段，未触及任何 UI 断言**（详见下方环境说明）。

| 套件 | 用例数 | 批次收口时 | 最后合并跑 |
|------|--------|-----------|-----------|
| `ui-p0-shell`（壳 / 新 IA / 301 / ⌘K / 五骨架 demo） | 46 | ✅ | ❌ 登录 POST 超时（单跑 3.6s 通过） |
| `ui-p1a-ontology` | 5 | ✅ | ✅ |
| `ui-p1b-home` | 4 | ✅ | ❌ worker 崩溃（见环境说明） |
| `ui-p1c-agents` | 4 | ✅ | ✅ |
| `ui-p1d-superai` | 4 | ✅ | ❌ worker 崩溃（见环境说明） |
| `ui-p1e-admin` | 4 | ✅ | ✅ |
| `ui-p2a-apps` | 5 | ✅ | ✅ |
| `ui-p2b-ki` | 6 | ✅ | ✅ |
| `ui-p3-acceptance` | 12 | ✅ | ✅ |
| **合计** | **90** | — | **90 / 3 failed** |

> 用例数从 93 校正为 90：`ui-p0-shell` 在 P2b 时退役了 1 条「过渡期」用例（`ownsTabs` 全站归零后该用例失去意义）。

`pnpm build` 通过（tsc -b + vite build，多次复跑）。

### 5.1 环境说明（这 3 条红与代码无关）

本机在收口阶段出现**系统级不稳定**，三个独立现象同一时期出现：

1. **vite dev server（9250）会自行崩溃退出**：启动正常（`ready in 1156 ms`）后在 ~24–70 秒内以退出码 `3221226505`（`0xC0000409`，Windows fail-fast）无输出死亡。清理 `node_modules/.vite` 缓存后复现，说明与构建缓存无关。
2. **Playwright worker 以同一码崩溃**：`worker process exited unexpectedly (code=3221226505)`，整条 spec 停止。
3. **浏览器报 `net::ERR_INSUFFICIENT_RESOURCES`**：页面动态 import 拉不动 chunk，落到 ErrorBoundary。同会话早些时候 bash 也报过 `fork: Resource temporarily unavailable`。

判定依据：崩溃发生在**导航/登录**阶段（`page.goto` → `ERR_CONNECTION_REFUSED`、`#app` 未挂载、`apiRequestContext.post` 超时），不在任何 UI 断言上；且 `ui-p0-shell` 那条单跑 3.6s 通过。故这 3 条记为**环境噪声**，但**本档不宣称 93 全绿**——要在稳定机器上复跑一次 9 套件合并才算数。

### 5.2 既知基线红（改动前即为红）

`action-orchestration` / `ontology-agent-e2e` / `ontology-dedup` / `superai-routing` 四套用例依赖的后端接口在本地未全起（workflow-definitions 502、路由快照 `no_authorized_roles`），**改动前即为红**（见记忆档 `playwright-baseline-red-specs`）。

------|--------|------|
| `ui-p0-shell`（壳 / 新 IA / 301 / ⌘K / 五骨架 demo） | 47 | ✅ |
| `ui-p1a-ontology` | 5 | ✅ |
| `ui-p1b-home` | 4 | ✅ |
| `ui-p1c-agents` | 4 | ✅ |
| `ui-p1d-superai` | 4 | ✅ |
| `ui-p1e-admin` | 4 | ✅ |
| `ui-p2a-apps` | 5 | ✅ |
| `ui-p2b-ki` | 6 | ✅ |
| `ui-p3-acceptance` | 12 | ✅ |
| **合计** | **93** | **全绿** |

`pnpm build` 通过（tsc -b + vite build）。

> 既知噪声（非回归，见记忆档 `playwright-baseline-red-specs`）：`action-orchestration` / `ontology-agent-e2e` / `ontology-dedup` / `superai-routing` 四套用例依赖的后端接口在本地未全起（workflow-definitions 502、路由快照 `no_authorized_roles`），**改动前即为红**；全量串行跑时偶发一条 `socket hang up` 的登录抖动，单跑即过。

---

## 6. 与规范的偏差（如实登记）

1. **应用卡片的「状态」与「使用次数」未显示**。后端 `GET /api/v1/apphub/apps` 只返回 `id/name/code/category/description/version/owner/tags`，无 status、无使用计数。按「不编造」纪律，卡片只渲染真实字段（图标/名称/编码/分类/版本/标签数）。**待后端补字段**。
2. **知识库表格的「切片数、向量模型、检索 P95、重建进度」未建列**。`GET /api/v1/kb/collections` 只返回 `document_count / config.embedder / status`，且 `src/api/kb/index.ts` 的 mapper 未透出 `config.embedder`。API 层本批冻结，故不建列。**待后端/mapper 补字段**。
3. **`mapApp` 字段失真**：`src/api/apphub/apps.ts` 把后端 `version` 映射进 `AppItem.updatedAt`，且 `status` 硬编码为 `PUBLISHED`。本批不动 API 层，前端以 `appVersion()` 单点读取并注释了耦合；**建议后续修 mapper**。
4. **MCP 长期 API Key 的 UI 当前不可达**：`pages/mcp/components/ApiKeyGenerator.tsx`（含 ADR-0062 去掉 scope 选择器的改动）只被 `McpExternalPage.tsx` 引用，而后者未被任何路由挂载 —— P2b 拆掉 `McpCenterLayout` 三 HUB 后该入口悬空。**该 UI 已保留未删除**，需产品决定挂回 `/ki/mcp` 下哪个 tab。
5. **FlowGram 画布样式保留**：`App.css` 剩余 94 行是 `.gedit-*`（FlowGram 编辑器网格/端口/minimap）与 `.mp-loading`。画布按「只换壳不换画布」约束未动，其 `var(--background)` 一类旧引用已归一到 Semi 令牌（原引用未定义变量，等于一直没生效）。
6. **数字员工域在 UI-P3 才摘掉 `ownsTabs`**：P1c 把内容换成 C 骨架但 tab 行仍由 `AgentsLayout`（`ModuleTabsLayout`）自渲染；本轮删除 `AgentsLayout.tsx` 与 `DomainDef.ownsTabs`，8 域至此**统一由壳渲染 tab 行**。
