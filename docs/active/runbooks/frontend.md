# Frontend 9 apps Runbook (W6-4/5/6 收尾)

## 概述

Mate Platform 前端 9 apps + BFF + MSW + Playwright。

## 9 apps

| App | 端口 | 状态 | 已实现 |
|---|---|---|---|
| portal | 5173 | ✅ | scaffold / state / list / detail / e2e / polish |
| dashboard | 5174 | ✅ | scaffold / state / stat cards / charts / e2e / polish |
| ontstudio | 5175 | ✅ | scaffold / state / class tree / detail / SPARQL / e2e+polish |
| kb | 5176 | ✅ | scaffold / state / list / upload / search / e2e+polish |
| mcphub | 5177 | ✅ | scaffold / state / tool list / try it / resources / e2e+polish |
| apphub | 5178 | ✅ | scaffold / state / list / install / e2e+polish |
| arch | 5179 | ✅ | scaffold / state / canvas / templates / e2e+polish |
| dw | 5180 | ✅ | scaffold / state / canvas / nodes / e2e+polish |
| superai | 5181 | ✅ | scaffold / state / chat UI / history / e2e+polish |

## BFF

`@mate/bff` (Node + Fastify + TS) — port 3000。

### API_MODE

| Mode | 行为 |
|---|---|
| mock | 返回 mock 数据 |
| live | 透传到 UPSTREAM_BASE |
| hybrid | GET mock, mutation live |

### 启动

```bash
API_MODE=mock pnpm --filter @mate/bff dev
# 或：
API_MODE=live UPSTREAM_BASE=http://localhost:8000 pnpm --filter @mate/bff dev
```

## MSW

`apps/web/src/mock/index.ts` — 浏览器层 Mock。

Codegen: `pnpm tsx scripts/msw-codegen.ts <openapi.yaml>`

## Playwright

`playwright.config.ts` — 9 项目 + BFF 自动启动。

```bash
pnpm exec playwright test                 # 全部
pnpm exec playwright test --project=portal
pnpm exec playwright test tests/e2e/portal.spec.ts
```

## shared package

`packages/shared/src/` — AppLayout, AuthGuard, AuthProvider, DataTable, ErrorBoundary, EmptyState, ErrorState, Flowgram, PlatformMenu, renderers, theme, hooks, API client.

## 故障排查

| 现象 | 排查 |
|---|---|
| 9 端口冲突 | 调整 vite.config.ts port |
| BFF 500 | 检查 API_MODE / UPSTREAM_BASE |
| MSW 不工作 | 检查 `worker.start()` 在 main.tsx |
| Playwright 超时 | 检查 webServer 启动日志 |
| Auth 401 | 检查 shared/auth/token.ts |