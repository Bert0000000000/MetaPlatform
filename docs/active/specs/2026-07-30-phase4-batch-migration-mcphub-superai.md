# Phase 4.4 + 4.5 批量迁移计划（mcphub / superai）

> 状态：执行中 | 日期：2026-07-30 | 分支：`refactor/monorepo-shrink-phase-2`

## 背景

延续 Phase 4.1/4.2/4.3（arch/dashboard/dw）的迁移模式（参考 commits：
`be4dee47` / `7c4251b2` / `24009dfc`），把剩下的两个独立 SPA `apps/mcphub` 和
`apps/superai` 合并进 `@mate/web`，完成后做 `apps/portal → apps/web` 改名收尾。

## 当前状态

| 项 | 值 |
|---|---|
| 工作分支 | `refactor/monorepo-shrink-phase-2` |
| 当前 HEAD | `24009dfc` (Phase 4.3 dw 完成) |
| 基线 typecheck 错误 | **776** （见 `2026-07-30-typecheck-baseline-pre-4.4.txt`） |
| 已迁移 apps | kb / apphub / arch / dashboard / dw |
| 待迁移 apps | **mcphub** / **superai** /（ontstudio 走 handoff 单独处理）|
| 已知脏状态 | `apps/portal/src/pages/admin/` 11 文件 working-tree 已删；`apps/portal/src/api/{mcphub,superai}/` 仅 types/ 子目录 |

## 范围（与用户确认）

1. **Phase 4.4**: mcphub → @mate/web，独立 commit
2. **Phase 4.5**: superai → @mate/web，独立 commit
3. **Phase 4.6**: `apps/portal/` → `apps/web/` 目录改名 + pnpm-workspace + import 路径批量修正，独立 commit
4. superai 的 `__demo__/` 默认**删除**（保留是技术债）

## 任务卡

### TC-4.4 mcphub migration (~70 文件)

| ST | 内容 | 输出 |
|---|---|---|
| ST-4.4.1 | 复制 20 个 API 模块到 `apps/portal/src/api/mcphub/` 并改 client/auth 冲突命名 | api/mcphub/*.ts |
| ST-4.4.2 | 搬迁 24 个 page 到 `apps/portal/src/pages/mcp/` | pages/mcp/*.tsx |
| ST-4.4.3 | 搬迁 17 个 component 到 `pages/mcp/components/` | pages/mcp/components/*.tsx |
| ST-4.4.4 | 重写 `App.tsx` 注册 24 条 `/mcp/*` 路由 | App.tsx +24 路由 |
| ST-4.4.5 | `pnpm typecheck` 验证 — 错误增量 ≤ 0 | baseline 776 |
| ST-4.4.6 | `git rm -r apps/mcphub` 提交 | commit 4.4 |

### TC-4.5 superai migration (~55 文件)

| ST | 内容 | 输出 |
|---|---|---|
| ST-4.5.1 | 复制 15 个 API 模块到 `apps/portal/src/api/superai/` | api/superai/*.ts |
| ST-4.5.2 | 搬迁 20 个 page 到 `apps/portal/src/pages/superai/`（含覆盖 SuperAIPage） | pages/superai/*.tsx |
| ST-4.5.3 | 搬迁 15 个 component（不含 `__demo__/`）到 `pages/superai/components/` | pages/superai/components/*.tsx |
| ST-4.5.4 | 搬迁 hooks（5 文件）到 `pages/superai/hooks/` | pages/superai/hooks/* |
| ST-4.5.5 | 重写 `App.tsx` 注册 19 条 `/superai/*` 路由（已有 `/superai` 替换为 `SuperAIPage` v2） | App.tsx +19 路由 |
| ST-4.5.6 | `pnpm typecheck` 验证 — 错误增量 ≤ 0 | baseline 776 |
| ST-4.5.7 | `git rm -r apps/superai` 提交 | commit 4.5 |

### TC-4.6 `apps/portal` → `apps/web` rename (~10 文件)

| ST | 内容 | 输出 |
|---|---|---|
| ST-4.6.1 | `git mv apps/portal apps/web` | 目录改名 |
| ST-4.6.2 | 全仓 search & replace：`apps/portal` → `apps/web`（ts/tsx/json/yaml） | grep 0 |
| ST-4.6.3 | `pnpm typecheck` 验证 | baseline 776 |
| ST-4.6.4 | 同步文档：CLAUDE.md / tech-stack-confirmed §7 / delivery-roadmap W6 | docs/* |
| ST-4.6.5 | commit 4.6 + 文档 commit | 2 commits |

## DoD

- [ ] 3 个独立 commit 落地到 `refactor/monorepo-shrink-phase-2`
- [ ] typecheck 错误数 ≤ 776（**不引入新错误**）
- [ ] `apps/{mcphub,superai,portal}` 三个目录物理移除（apps/ 下只剩 ontstudio + web）
- [ ] `@mate/web` 全路由可用：`/mcp/*` (24 路由)、`/superai/*` (20 路由) 等
- [ ] docs 同步：CLAUDE.md / tech-stack-confirmed §7

## 风险与处理

| 风险 | 处理 |
|---|---|
| AppLayout 重名冲突 | mcphub/superai 的 `AppLayout.tsx` → `McpAppLayout.tsx` / `SuperaiAppLayout.tsx` |
| auth.ts 重名冲突 | 进子目录隔离即可（已用 `api/mcphub/auth.ts` 模式）|
| `__demo__/` | 删除，按用户确认 |
| ontstudio 单独 handoff | 不在本计划范围 |
| apps/portal 改名 commit 路径爆炸 | 用 `sed -i` 批量改，最后做全仓 `git grep 'apps/portal'` 为 0 |
