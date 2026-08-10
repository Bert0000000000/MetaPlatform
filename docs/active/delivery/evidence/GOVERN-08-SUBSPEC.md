# GOVERN-08 — 前端路由与契约闭环 子规格

> 编制日期：2026-08-10
> 工作目录：`D:\Hermes\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend`
> 父计划：`cozy-orbiting-wombat.md §3.3 GOVERN-08`
> 上游：GOVERN-07 ✅（死模块清理已完成；本批次是路由与契约闭环）
> 下游：GOVERN-10（13 硬规则 × CI 矩阵收口）

---

## 0. 与父计划偏差修订

父计划 §GOVERN-08 列了 6 项动作 + 4 项验收。本批次开局由 `Explore` agent
实地盘点了 `apps/web/src/` 与 `metaplatform-frontend/` 整树后，发现以下
与原计划不符的事实，先以本子规格为准：

| 原计划条目 | 实地状态 | 修订 |
|---|---|---|
| C3 `runtime/iam.json == runtime/dashboard.json == 301902 字节` | **`contracts/runtime/` 整树不存在**，仓库内 grep `iam.json` / `dashboard.json` 0 命中 | 删除原 C3 动作；原"删冗余"无对象 |
| C4 `wfe.yaml + wfe.json` 存在但前端无 wfe 客户端 | **`apps/web/src/api/wfe/` 不存在**，`App.tsx` 无 `/wfe/*` 路由 | 不再"补 8 端点 client"；改为"删除后端 OpenAPI 中无人消费的 wfe.yaml（若仍存在）" |
| C6 `openapi-typescript` 流水线不存在 → 引入 | **`package.json` devDeps 无 `openapi-typescript`，scripts 无 `openapi:gen`，`apps/web/src/types/api.d.ts` 不存在** | 改为新增流水线 + 删手写 types 漂移条目 |
| 死模块清理 GOVERN-07 已先一步 | `agents/AgentsXxxPage ×6`、`superai/SuperAIPage`、`pages/admin/__AdminLayout.tsx`、`superai/LoginPage`、`mcp/LoginPage`、`api/dw/capabilities.ts`、`agents/TaskCreatePage`、`agents/VersionDiffPage` 已先被 GOVERN-07 处理 / 不动 | 本批次不再重复删 |

> 修订理由：先把"事实是什么"对齐到代码，再讨论"做什么"。下文动作
> 与验收按修订后口径写。

---

## 1. 现状快照（来自 Explore audit, 2026-08-10）

### 1.1 App.tsx 路由（apps/web/src/App.tsx, 23 KB）

131 个 `lazy()` 声明 + 4 个静态 import（LoginPage / ArchLayout / AppLayout）。
路由前缀分组：

| Prefix | Count | 状态 |
|---|---:|---|
| `/login`, `/s/:code`, `/` | 3 | OK |
| `dashboard/*` | 9 | OK |
| `admin/*`（来自 `pages/dashboard/admin/*`） | 9 | OK；`pages/admin/__AdminLayout.tsx` 是 6220 字节孤儿副本，与 4792 字节真版 `dashboard/admin/__AdminLayout.tsx` 分叉 |
| `superai/*` | 19 | OK |
| `arch/*` | 21 | OK |
| `apps/*`, `marketplace`, `market`, `my-templates`, `ai-designer`, `pages/:pageId` | 15 | OK |
| `ontology/*` | 4 | OK |
| `knowledge/*` | 4 | OK |
| `mcp/*` | 25 | OK |
| `agents/*` | 12 | OK |
| `dw/*` | **0** | **缺**（10 个 API 已存在但无消费路由） |
| `wfe/*` | **0** | **缺**（`api/wfe/` 也不存在） |

### 1.2 api/dw/ 消费情况

10 个 `.ts` 文件 + `types/` 子目录。grep 全仓库：

| 文件 | 外部引用次数 | 状态 |
|---|---:|---|
| employees.ts | 12 | linked |
| evaluations.ts | 8 | linked |
| collaborations.ts | 6 | linked |
| a2a.ts | 4 | linked |
| tasks.ts | 4 | linked |
| learning.ts | 2 | linked |
| documents.ts | 1 | linked |
| extraction.ts | 1 | linked |
| obs.ts | 1 | linked |
| **capabilities.ts** | **0** | **dead（由 GOVERN-07 标迁移或删，本批次不再动作）** |

所有引用都来自 `pages/agents/components/`；App.tsx 与任何 router 都不消费。

### 1.3 package.json（metaplatform-frontend）

```json
"scripts": {
  "dev": "pnpm --filter @mate/web dev",
  "dev:all": "pnpm -r --parallel dev",
  "build": "pnpm -r build",
  "build:app": "pnpm --filter",
  "typecheck": "pnpm -r typecheck",
  "preview": "pnpm --filter @mate/web preview",
  "clean": "pnpm -r exec rimraf dist node_modules/.vite",
  "install:clean": "rimraf node_modules **/node_modules pnpm-lock.yaml && pnpm install"
}
```

**无 `openapi:gen` / `gen:api` / `openapi-typescript` script**。
devDeps 无 `openapi-typescript`。

---

## 2. 动作范围（修订后）

### 08-01 DW 路由消费 + 类型生成流水线（最大动作）

把"API 已存在但无路由"的 9 个 DW client 接进 App.tsx：

1. **新增懒加载 page**：`apps/web/src/pages/dw/` 下挂 9 个 wrapper page
   - `EmployeesPage.tsx`、`EvaluationsPage.tsx`、`CollaborationsPage.tsx`
   - `A2APage.tsx`、`TasksPage.tsx`、`LearningPage.tsx`
   - `DocumentsPage.tsx`、`ExtractionPage.tsx`、`ObsPage.tsx`
   - 每个文件 ~50 行，从对应 client 拉数据 + 渲染最小列表。
   - `capabilities.ts` 由 GOVERN-07 决策，本批次不创建 `/dw/capabilities` 路由。
2. **App.tsx 注册**：`/dw/*` 9 条 lazy route（沿用现有 `Suspense fallback` 模式）。
3. **openapi-typescript 流水线**：
   - `package.json` devDeps 加 `"openapi-typescript": "^7.13.0"`
   - `apps/web/package.json` scripts 加 `"openapi:gen": "openapi-typescript ../contracts/openapi/services/ont.yaml -o src/types/api.d.ts"`
   - `.github/workflows/frontend-ci.yml`（若存在）加 `pnpm openapi:gen && pnpm typecheck` job；否则新建。
4. **types/ 漂移清理**：保留手工 `admin.ts` 等业务类型；新生成 `types/api.d.ts`
   由 CI 覆盖；手写的与 OpenAPI operationId 同名的 type（drift 候选）
   本批次**不删**（属历史包袱，删错会破路由；下批次 GOVERN-10 评估）。

### 08-02 后端 OpenAPI wfe.yaml 状态确认

- 父计划 C4 说"wfe.yaml 存在但前端无 wfe 客户端"，但前端根本无 `wfe/` 客户端。
- 本批次动作 = 在 `mate-platform-backend/contracts/openapi/services/` grep
  `wfe.yaml`：若存在，标注 `x-sunset: 2026-12-31`；若不存在，跳过。
- 输出：`grep wfe.yaml` 命中数 = 0 或 1 + 命中则加 sunset 头。

### 08-03 `pages/admin/__AdminLayout.tsx` 孤儿副本处理

- 6220 字节孤儿副本与 4792 字节真版 (`pages/dashboard/admin/__AdminLayout.tsx`) 分叉。
- 验证：`grep -rn "__AdminLayout" apps/web/src/` 全部命中应来自 `dashboard/admin/` 子路径。
- 命中若全来自 `dashboard/admin/` → `rm apps/web/src/pages/admin/__AdminLayout.tsx`
- 命中若仍有 `pages/admin/__AdminLayout` → 留待 GOVERN-10 评估。

### 08-04 e2e 验证

- 新增 `apps/web/e2e/dw-list.spec.ts` ≥1 用例（Playwright）：
  启 dev server → 访问 `/dw/employees` → 等待懒加载 → 截图列表为空态 OK。
- 现有 `apps/web/e2e/` 套件 `pnpm playwright test` 全绿（基线）。

---

## 3. 验收标准

| # | 检查 | 命令 | 期望 |
|---|---|---|---|
| 1 | DW 路由可达 | `grep "/dw/" apps/web/src/App.tsx` | ≥9 命中 |
| 2 | DW page 文件存在 | `ls apps/web/src/pages/dw/` | ≥9 个 .tsx |
| 3 | wfe.yaml 处理 | `grep "wfe.yaml" mate-platform-backend/contracts/openapi/services/` 命中 → 含 `x-sunset` | sunset 标注或 0 命中 |
| 4 | 孤儿 admin 副本 | `ls apps/web/src/pages/admin/__AdminLayout.tsx` | 不存在（已删） |
| 5 | openapi-typescript script | `grep "openapi:gen" package.json` | ≥1 命中 |
| 6 | typecheck 通过 | `pnpm typecheck` | exit 0 |
| 7 | DW e2e | `pnpm --filter @mate/web e2e -- dw-list.spec.ts` | ≥1 passed |
| 8 | 死页未复活 | `ls apps/web/src/pages/agents/AgentsXxxPage*.tsx apps/web/src/pages/superai/SuperAIPage.tsx apps/web/src/pages/superai/LoginPage.tsx apps/web/src/pages/mcp/LoginPage.tsx 2>&1` | 全 No such file |

---

## 4. 风险

| 风险 | 触发 | 缓解 |
|---|---|---|
| `openapi-typescript` 装包失败（网络） | gh 直连不通 | 用本地 7897 代理；否则只生成 `types/api.d.ts` 不强依赖流水线 |
| DW page 写错导致 typecheck 红 | dto 与 API 漂移 | 复用现有 `api/dw/*` 类型（已生成），page 内部不重新声明 |
| Playwright headless 在 Windows 装 chromium 慢 | 机器性能 | e2e 用 `--project=chromium --headed=false`，避免下载 webkit/firefox |
| `__AdminLayout.tsx` 删错有 import | grep 不全 | 删除前先 grep；命中=0 才删 |

---

## 5. 提交策略

Conventional Commits；单 PR；commit message：

```
refactor(frontend): GOVERN-08 DW routing closure + openapi-typescript pipeline
```

证据：`docs/active/delivery/evidence/GOVERN-08-SUBSPEC.md`（本文件）+ 后续 ACCEPTANCE。

---

## 6. 不在本批次

- `agents/AgentsXxxPage` 复活（父计划 C2 子项）→ 已在 GOVERN-07 删除，
  若产品需要走新 PRD 单独批次
- marketplace / iam.json / dashboard.json runtime schema → 父计划 C3 修订后无对象
- 手写 `types/admin.ts` 等漂移清理 → 下批次 GOVERN-10 评估
- 前端租户隔离（前端 → API 链路 tenant header 注入）→ 在 SEC-IAM-01 已闭合，
  本批次不动