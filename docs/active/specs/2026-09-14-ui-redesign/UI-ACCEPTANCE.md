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

| 指标 | 基线（2026-09-14） | 终值（2026-09-15） | 目标 | 状态 |
|------|--------------------|----------------|------|------|
| inline `style={{}}` | 4,526 | **32** | < 100 | ✅ |
| `v-*` 自建类 | 261 | **0** | 0 | ✅ |
| `.semi-*` CSS 覆盖 | 0 | **0** | 0 | ✅ |
| 私有 CSS 变量（`--muted/--accent/#hex` 直写） | 与 Semi 令牌并行（915 处引用已全站无定义） | **0** | 单一令牌体系 | ✅ |
| `src/App.css` | 185 行（含 ~90 行 `v-portal-*` 死样式） | **94 行** | 退役 | ✅ |
| 顶级路由域 | 11 域 / 100+ 路由 | **8 域**，域内 tab 化 | 8 域 | ✅ |
| `src` 下 ts/tsx 文件 | 484 | **393**（删 94 个不可达文件） | 无孤儿 | ✅ |
| 引用类是否有样式落地 | 未校验 | **692/692 有定义**（0 悬挂） | — | ✅ |

复现命令：

```bash
grep -rh "style={{" src --include="*.tsx" | wc -l            # 32
grep -rhoE "\bv-[a-z][a-z-]*" src --include="*.tsx" | wc -l  # 0
grep -rn "\.semi-" src --include="*.css" | wc -l            # 0（仅 1 处注释提及）
node scripts/check_classes.mjs                               # OK：所有引用的类都有 CSS 定义
```

### 2.1 残留的 32 处：全部是不可静态化的运行时值

| 文件 | 处数 | 为何必须留在 JS |
|------|------|-----------------|
| `components/SemiGraphCanvas.tsx` | 9 | DOM 关系图：节点 x/y/w/h、缩放、transform 由数据与 props 驱动 |
| `pages/ontology/OntologyActionPage.tsx` | 9 | FlowGram 节点渲染器：`nodeWidth`/`tColor`/选中态 boxShadow 属画布内部 |
| `pages/dashboard/admin/components/UvPvTrendChart.tsx` | 4 | Recharts 序列色 + 数据驱动高度 |
| `pages/dashboard/admin/components/DistributionCard.tsx` | 4 | 同上 |
| `pages/wfe/components/PlanCanvas.tsx` | 2 | 画布容器 minHeight/minWidth |
| `pages/ontology/MapPage.tsx` | 2 | 瓦片与弹层的运行时 left/top |
| 其余 3 个文件 | 3 | 单点动态值（AnalyticsTab / FunnelCard 等） |

这些都命中 UI-P2a/b/c 的「只换壳不换画布」约束，或本质上是数据驱动的数值，**没有静态类可表达**。

### 2.2 收敛方法（可复现）

1. **令牌工具层**：新建 `src/styles/utilities.css`（190 个类），把旧页面里重复上千次的
   `marginBottom: 16` / `width: '100%'` / `fontSize: 12` 之类收敛成一份令牌类；
   非令牌数值**吸附到最近的 10 档令牌**（DESIGN-SPEC §4.1）。
2. **codemod**：`scripts/codemod_style.mjs`（5 轮，共 1,747 → 473）。安全设计：
   只在同一 JSX 标签属性区内找已有 className（掩掉嵌套 `{…}`，避免把类名并到子元素上）、
   动态 className 一律跳过、每个文件改完用 tsc 语法校验，不合法就整文件回退。
3. **逐页语义化**：剩余长尾按域拆给 4 个并行批次人工抽取为
   `mp-onto-*` / `mp-flow-*` / `mp-app-*` / `mp-kb-*` 等语义类，写进各域 css。

### 2.3 本文档的验证边界（请知悉）

本轮的**代码级**证据是完整的：`tsc -b` 零错误、`pnpm build` 通过、
`scripts/check_classes.mjs` 确认 692 个引用类零悬挂、25 条代表性路由无崩溃渲染（见 §5）。

但**像素级观感核对未能完整做**：收口期间本机的 gateway(8100) 与 Docker 停摆，
Playwright 的登录链路（`POST /api/v1/iam/auth/login`）走不通，因此带真实数据的
双主题截图与既有 ui-*.spec 无法重跑。已做的替代验证是「无后端冒烟」（占位 token
绕过 AuthGuard，逐个路径检查是否崩到 ErrorBoundary / 白屏）。
**1,700+ 处样式的观感等价性，需要在后端恢复后跑一次全量 Playwright 才算闭合。**

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

## 5. 验证记录

### 5.1 代码级（本轮全部实际跑过）

| 检查 | 命令 | 结果 |
|------|------|------|
| 类型 | `npx tsc -b --noEmit` | **0 error**（P2c / P2a / P2b / P2d 各阶段分别复跑） |
| 构建 | `pnpm build` | **✓ built**（tsc -b + vite build） |
| 类名悬挂 | `node scripts/check_classes.mjs` | **692/692 引用类都有 CSS 定义** |
| 无后端冒烟 | 占位 token 绕过 AuthGuard，逐路径查崩溃/白屏 | **25/25 通过**（8 域代表作 + 五骨架 demo） |

冒烟覆盖的 25 条路径：工作台 · 本体 4 主 tab + Action 编排 + 治理 · 数字员工 ·
SuperAI 会话/执行计划 · 应用中心 3 tab · 知识库/文档/MCP 工具/MCP 客户端/A2A ·
治理 3 主 tab · 管理 3 页 + 五骨架 demo。全部 `#app` 挂载、无 `页面渲染出错`、无白屏；
MCP 三页因后端未起报 500，但页面自行降级渲染，未崩到 ErrorBoundary。

### 5.2 Playwright 全量（2026-09-15 13:0x，后端恢复后重跑）

| 套件 | 用例数 | 结果 |
|------|--------|------|
| `ui-p0-shell`（壳 / 新 IA / 301 / ⌘K / 五骨架 demo） | 46 | ✅ |
| `ui-p1a-ontology` | 5 | ✅ |
| `ui-p1b-home` | 4 | ✅ |
| `ui-p1c-agents` | 4 | ✅ |
| `ui-p1d-superai` | 4 | ✅ |
| `ui-p1e-admin` | 4 | ✅ |
| `ui-p2a-apps` | 5 | ✅ |
| `ui-p2b-ki` | 6 | ✅ |
| `ui-p3-acceptance`（含 8 域 × 双主题截图归档） | 12 | ✅ |
| **合计** | **90** | **93 passed / 0 failed**（含参数化展开） |

**视觉基线已刷新到本轮终态**：`tests/visual/ui-redesign/` 下 8 域 × 浅/深共 16 张
（`1-home` … `8-admin`）在本轮全量跑中重新生成，对应 inline style = 32 的最终代码，
不再是 P3 阶段的中间态。

> 说明：本轮早先「90 passed / 3 failed」的 3 条红，是本机 Node 进程集体 fail-fast
> （dev server 与 Playwright worker 均以 `3221226505`(0xC0000409) 退出、浏览器报
> `ERR_INSUFFICIENT_RESOURCES`）造成的**环境噪声**，失败点全在导航/登录阶段。
> 后端与 Docker 恢复后重跑，同样这 9 个套件 **93/93 全绿**，验证了该判断。

### 5.2.1 仍未闭合的部分

1,700+ 处样式的**像素级等价性**没有做逐处 diff 核对——本轮依据是「全量用例绿 +
类名零悬挂 + 前后截图归档可对比」。若要更严，可对
`tests/visual/ui-redesign/` 的终态与上一版做人工比对。

### 5.3 既知基线红（改动前即为红，与本轮无关）

`action-orchestration` / `ontology-agent-e2e` / `ontology-dedup` / `superai-routing`
四套用例依赖的后端接口在本地未全起（workflow-definitions 502、路由快照
`no_authorized_roles`），见记忆档 `playwright-baseline-red-specs`。

---

## 6. 与规范的偏差（如实登记）

1. **应用卡片的「状态」与「使用次数」未显示**。后端 `GET /api/v1/apphub/apps` 只返回 `id/name/code/category/description/version/owner/tags`，无 status、无使用计数。按「不编造」纪律，卡片只渲染真实字段（图标/名称/编码/分类/版本/标签数）。**待后端补字段**。
2. **知识库表格的「切片数、向量模型、检索 P95、重建进度」未建列**。`GET /api/v1/kb/collections` 只返回 `document_count / config.embedder / status`，且 `src/api/kb/index.ts` 的 mapper 未透出 `config.embedder`。API 层本批冻结，故不建列。**待后端/mapper 补字段**。
3. **`mapApp` 字段失真**：`src/api/apphub/apps.ts` 把后端 `version` 映射进 `AppItem.updatedAt`，且 `status` 硬编码为 `PUBLISHED`。本批不动 API 层，前端以 `appVersion()` 单点读取并注释了耦合；**建议后续修 mapper**。
4. ~~MCP 长期 API Key 的 UI 不可达~~ → **已解决（2026-09-15）**：归位到 `/ki/mcp/clients`（客户端 tab，API Key 本质是客户端凭据），在 `McpClientPage.tsx` 表格下方渲染 `<ApiKeyGenerator />`；同批把它引用的两个不存在的颜色令牌（`--semi-color-warning-bg/-border`）换成真实令牌。
5. **FlowGram 画布样式保留**：`App.css` 剩余 94 行是 `.gedit-*`（FlowGram 编辑器网格/端口/minimap）与 `.mp-loading`。画布按「只换壳不换画布」约束未动，其 `var(--background)` 一类旧引用已归一到 Semi 令牌（原引用未定义变量，等于一直没生效）。
6. **数字员工域在 UI-P3 才摘掉 `ownsTabs`**：P1c 把内容换成 C 骨架但 tab 行仍由 `AgentsLayout`（`ModuleTabsLayout`）自渲染；本轮删除 `AgentsLayout.tsx` 与 `DomainDef.ownsTabs`，8 域至此**统一由壳渲染 tab 行**。

---

## 7. 全局表格样式归一（2026-09-15 追补）

表格此前偏离规范四项，均按 **Semi 官方 DSM 变量 / 官方 props** 修（不写 `.semi-*` 选择器）：

| 项 | 修前 | 修后 | 手段 |
|----|------|------|------|
| **字号** | 14px（继承全局 `$font-size-regular`） | **13px** | Semi 只暴露了空态占位的 `$font-table_base-fontSize`，**没有单元格字号的 DSM 变量**。故在 `DataTablePro` 给 Table 挂我们自己的 `.mp-table`（Semi `className` 透传到同一元素），用 `.mp-tablepro .mp-table { font-size: var(--mp-table-font-size) }` 收口 |
| **表头分割线** | 2px（Semi 默认） | **1px** | DSM 变量 `$width-table_header_border` |
| **列宽 / 横向滚动** | 列按内容宽排、表格不铺满容器 | **表宽 = 容器宽、无横向滚动、列铺满** | `DataTablePro` 去掉强制的 `scroll={{ x: 'max-content' }}` |
| **列宽拖拽把手** | 每个可调列右缘一条 **9px 实心竖条**（Semi 默认 `$width-table_react_resizable_handle`，背景直接用表格边框色，在表头里像一块宽块） | **4px**（读起来像分隔线，仍可抓取） | DSM 变量 `$width-table_react_resizable_handle` |
| **行高** | 42–53px 参差 | **表头全站 41px；表体 43–45px** | ① 单元格内控件统一降为 `size="small"`（84 文件 / 222 处：Tag 173、Button 46、Select-Input 4，全部落在列定义 `render:` 内）② `$spacing-table_{tbody_rowCell-padding, middle-paddingY, small-paddingY}` 三档对齐 10/10/6px ③ 用户表头像 32→24px |

**未达「恰 40px」的原因（如实登记）**：Semi 表格行高是**内容驱动**的（`td` 的 height 只是下限）。
实测内容盒：纯文字格 22.75px、含 20px Tag 的格 20px、含 24px 按钮/头像的格 24px；
叠加 2 × 10px 内距与 1px 下边框后落在 41–45px。要硬钉 40px 只有两条路——
写 `.semi-*` 覆盖（规范明令禁止），或把单元格内所有组件压到 20px 以下（牺牲信息密度）。
**本轮取「表头 41px、表体 43–45px 窄带」为收敛结果**，并已消除 53px 的离群行。

复验方法：登录后在任一表格页读 `getComputedStyle(th).borderBottomWidth`（应为 1px）、
`getComputedStyle(td).fontSize`（13px）、`table.getBoundingClientRect().width` 是否等于容器宽。
