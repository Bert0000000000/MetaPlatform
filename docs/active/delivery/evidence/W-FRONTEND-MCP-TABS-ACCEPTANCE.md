# 前端：MCP 服务中心三 tab（SKILL / MCP / A2A）：验收证据

> 批次：前端 MCP 中心导航重构 · 日期：2026-08-12
> 工作目录：`metaplatform-frontend`
> 归组决策：用户确认「推荐归组（能力/协议/协作）」（AskUserQuestion, 2026-08-12）

## 1. 一句话验收

**MCP 服务中心从「17 个扁平菜单项」重构为「SKILL 服务 / MCP 服务 / A2A 服务 三 tab」：tab 栏切换三层默认页，各子页面仍在原 `/mcp/*` 路由下渲染；tsc 干净，浏览器实测 tab 切换 + 页面渲染正常。**

## 2. 改动清单

| 文件 | 改动 |
|---|---|
| `packages/shared/src/config/platformMenu.ts` | `PlatformMenuItem` 加 `group` 字段；mcphub 17 项归组 skill / mcp / a2a |
| `apps/web/src/pages/mcp/McpCenterLayout.tsx` | **新增** 三 tab 布局（antd Tabs + Outlet），按 pathname 反查激活 tab，切换跳组默认页 |
| `apps/web/src/App.tsx` | mcp 路由改为 `<Route path="mcp" element={<McpCenterLayout />}>` 嵌套；`/mcp` 重定向到 `/mcp/overview` |

## 3. 归组

- **SKILL 服务**：概览 / 工具注册中心 / 资源配置 / Prompt 模板 / 调试器 / IDE 配置
- **MCP 服务**：MCP Server / MCP Client / 权限控制 / ABAC 策略 / 权限矩阵 / 调用审计 / 连接监控
- **A2A 服务**：外部 Agent 目录 / 外部对接 / 信任管理 / 协作审计

## 4. 验证证据

- `tsc --noEmit -p apps/web/tsconfig.json` → **0 错误**（McpCenterLayout / App.tsx / platformMenu 全通过）。
- 浏览器实测（vite dev @64045）：
  - `/mcp/overview` → tablist 显示 `SKILL 服务 / MCP 服务 / A2A 服务` 三个 tab，SKILL 激活，渲染"MCP Hub 概览"。
  - 点「MCP 服务」→ 导航 `/mcp/servers`，渲染"MCP Server 管理"。
  - 点「A2A 服务」→ 导航 `/mcp/external-agents`。
  - 控制台无布局相关错误（仅有后端未起的 401 + antd 既有弃用警告）。

## 5. 偏离 / 已知缺口

- `/matrix`、`/collaborations`、`/integrations` 三个菜单项**本无对应页面**（既有死链）；本轮映射到最近页面（`/matrix`→ABAC 策略页、`/integrations`+`/collaborations`→外部 Agent 页）避免 404，专用页面留后续。
- 侧边栏渲染在仓库外（本仓库仅 `menuMatcher` 消费菜单元数据）；`group` 字段为增量，外部 shell 可据 `group` 渲染分组。
