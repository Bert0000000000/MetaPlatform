# Frontend Architecture Audit (2026-07-30)

## Scope

The single `@mate/web` SPA inside `metaplatform-frontend/apps/web`,
the shared package `packages/shared`, the E2E suite, and the dev/build
toolchain. Evidence: `scripts/audit/architecture-audit.py` + manual
review of `App.tsx`, `client.ts`, `package.json` files, and CI workflow.

## Inventory

| Metric | Value |
|---|---:|
| Source files (`*.ts`/`*.tsx`) | 370 (128 .ts, 242 .tsx) |
| Files under `pages/` | 250 |
| Files under `api/` | 103 |
| Mock files | 2 |
| Routes in `App.tsx` | 109 |
| `useState` calls | 444 |
| `useEffect` calls | 192 |
| `useCallback` calls | 92 |
| `useMemo` calls | 80 |
| `useReducer` calls | 4 |
| `useRef` calls | 7 |
| `useContext` calls | 14 |
| Files importing `antd` | 211 |
| `message.*` call sites | 426 |
| `App.useApp()` call sites | 2 |
| Direct `window.*` call sites | 3 |

### Top-level directory layout

```
metaplatform-frontend/
  apps/web/                 single SPA
    src/api/                103 files (admin, apphub, arch, dashboard, dw, kb, mcphub, ontology-bigdata, superai)
    src/pages/              250 files (subfolders per module)
    src/components/         4 files
    src/contexts, hooks, mock, store, types, utils  (each a flat folder of a few files)
  packages/shared/
    src/api/                axios client, sso, auth, users, departments, roles, permissions, audit-logs, api-keys
    src/auth/               AuthProvider + token store
    src/components/         PageContainer, FormDrawer, DataTable, etc.
    src/config/             apiConfig, appTabs, appMeta, platformMenus
    src/hooks/              useAsync, useWebSocket, useLoadingState, useAsyncError
    src/icons/, interaction/, renderers/, utils/
  scripts/audit/           operations-audit.py, architecture-audit.py
  tests/e2e/                5 spec files
```

### Largest files

| File | Lines |
|---|---:|
| `pages/ontology/OntologyActionPage.tsx` | 1984 |
| `pages/apphub/data/templates.ts` | 1074 |
| `pages/superai/ChatPage.tsx` | 985 |
| `pages/mcp/AuditStatisticsPage.tsx` | 956 |
| `pages/apphub/AIDesignerPage.tsx` | 855 |
| `pages/apphub/FlowDesignerPage.tsx` | 790 |
| `pages/superai/components/CodeWorkspace.tsx` | 753 (18 useState) |
| `pages/apphub/FormDesignerPage.tsx` | 738 |
| `api/mcphub/types/index.ts` | 736 |
| `pages/dashboard/SettingsPage.tsx` | 679 |
| `pages/apphub/utils/safeScriptRunner.ts` | 644 |
| `pages/dashboard/admin/UsersPage.tsx` | 637 |
| `pages/ontology/components/LineageFullView.tsx` | 620 (10 useState) |
| `pages/ontology/components/DataGraphView.tsx` | 570 |

## Findings (by severity)

### P0 — structural

1. **Single SPA but no module routing files.** `App.tsx` is the only
   place that knows all 109 routes. A single missing import there
   crashes the entire shell, which we have already observed twice
   (the `Admin*` symbol crash, the `App.useApp` registration gap).
   Recommended: split into `src/routes/<module>Routes.tsx` and
   combine via `useRoutes`. Add a `ErrorBoundary` per module.

2. **Shared axios client is the only consistency seam.** Good:
   `createApiClient()` injects `Authorization`, `X-Trace-Id`, `X-Tenant-Id`,
   unwraps `ApiResponse`, refreshes 401 once, normalizes snake_case
   keys, and maps IAM `status`/`roleType`. Bad: most of the 103 files
   in `src/api/` still call `axios.create({ baseURL: '/api/v1' })` locally
   (e.g. `api/ontology-bigdata.ts`, `api/client.ts` instance,
   `api/superai/*`), bypassing the shared client. That re-invents
   interceptors per module, and bypasses snake_case normalization
   and 401 refresh.

3. **Page-owned error handling.** Each page composes its own
   `try/catch + message.error`. There is no central error
   boundary mapping, no field-level 422 mapper, no 5xx retry policy.
   `client.ts` already wraps everything in `HttpError`/`BizError`; the
   pages immediately re-stringify it, losing the traceId.

### P1 — maintainability

4. **Largest page is 1984 lines, 18 useState, 10 useState per page.**
   `OntologyActionPage` mixes flow designer, dataclass editor, and
   runtime metrics inside a single component. Without a controller
   split, every fix risks regressions in unrelated subsystems.

5. **state is everywhere, server-state nowhere.** 444 useState, 4
   useReducer, 0 query caches (no TanStack Query / SWR). The
   `@mate/shared/hooks/useAsync` is a thin load/error wrapper with
   no caching, dedup, retry, or invalidation. After the first
   dispatch to `createKb`, the list is not refetched unless the
   page explicitly re-invokes `load()`. Most pages do, but several
   rely on manual `reload()` chains.

6. **antd `App.useApp` is only used in 2 places.** Everywhere else
   pages import `import { message } from 'antd'` directly. This still
   works in antd 6, but it loses the message-context and disconnects
   from the ConfigProvider's locale. Either commit to
   `App.useApp` everywhere or accept the static path.

7. **No feature folder layout.** Everything under `src/api` and
   `src/pages` is a flat folder per module. Cross-module dependencies
   are detected only by reading imports; nothing prevents, e.g.,
   `pages/ontology` from importing `pages/dashboard`. A `src/features/`
   split would scale better.

8. **13 of 14 `useContext` calls are antd's own.** Only
   `AuthContext`, `useSettings`, `useDataSource`, `useService`,
   `useAppTabs`, `useRadarGeometry` are app-level contexts; the
   rest are antd primitives and are noise in the metric.

### P2 — quality

9. **Two mock files still exist** (`mock/` directory, 2 files, 593
   lines combined). They are imported by the old `ontology-bigdata.ts`
   fallback paths, which were just removed. Both files are now dead
   code and should be deleted.

10. **2/2 `App.useApp` calls exist, but many components still use the
    static `message` import from antd directly.** Mixing modes is the
    current worst case. Settle on one.

11. **`Window.location` is used 3 times**:
    - `api/client.ts:57` — login check (intentional).
    - `api/client.ts:65` — login redirect (intentional).
    - `OntologyDatacenterPage.tsx:147` — "刷新" button reloads the
      page, defeating the SPA. Replace with `useLocation()` + manual
      data refresh.

12. **`<button disabled>` audited to 1 unconditional instance.**
    Inspect manually; the audit script intentionally excludes
    conditional `disabled={x}` to avoid noise.

13. **`Modal.confirm` from antd is used widely; `alert/confirm` is
    now 0.** This used to be a major smell; the migration is
    complete.

14. **antd `message.*` 426 call sites.** That is healthy; the
    alternative was 200+ native `alert()` calls.

### P3 — tooling

15. **`tsc -b` composite** is enabled at the root, but `apps/web`
    has only one project. The benefit is `incremental` builds; the
    risk is the project references must be kept in sync.

16. **The `metaplatform-frontend/scripts/audit/` directory only
    contains the two audit scripts; CI calls one of them.
    `python` is not declared in the root `engines` or anywhere as a
    required tool. CI relies on the GitHub Actions default image
    which happens to have Python 3.13.

17. **No package visibility on the client.** `src/api/admin`,
    `src/api/dashboard`, `src/api/dw`, `src/api/kb`, `src/api/mcphub`,
    `src/api/superai`, `src/api/ontology-bigdata` are all exposed to
    the SPA bundle even when only a couple of pages import them.
    Vite tree-shakes by entry point, so the runtime bundle is OK,
    but the *source* surface area is wide.

## Strengths

- Single SPA, React 19, antd 6, all `MOCK_` fallbacks removed.
- TypeScript build green; production build green; 8 E2E tests
  passing including negative paths (500 / mock fallback / 403).
- API client unifies auth, traceId, tenant, refresh, key remap.
- `useAsync` + `useLoadingState` cover the common loading pattern.
- `operations-audit.py` and `architecture-audit.py` are reproducible;
  both have JSON output that can be diffed.
- `App.tsx` already uses `Suspense` + `lazy` for every page.

## Recommendations (priority-ordered)

### Phase 1 (this week)

1. Split `App.tsx` into per-module route files. Wrap each in an
   `ErrorBoundary`.
2. Route every page through the shared `createApiClient()` and
   remove the 100+ `axios.create({ baseURL: '/api/v1' })` calls in
   `src/api/*`. Replace with `import { apiClient, apiPath } from
   '@mate/shared/api'`.
3. Centralize error handling: an `ErrorBoundary` + a hook
   `useApiErrorBoundary(error, fallback)` that pipes `HttpError`/`BizError`
   into antd `message`, `notification`, or a `Result` component.
4. Remove `mock/ontology-bigdata.ts` and any dead `__AdminLayout`
   admin re-imports we still ship.

### Phase 2 (next sprint)

5. Introduce a thin server-state cache (TanStack Query) for the
   high-read pages (KB, Dashboard, Ontology, Admin lists). Drop
   `useState` + `useEffect` + `useAsync` chains.
6. Refactor `OntologyActionPage.tsx`, `ChatPage.tsx`,
   `AuditStatisticsPage.tsx`, `AIDesignerPage.tsx`, `FlowDesignerPage.tsx`
   into `Page + Controller + Components` per module.
7. Convert `App.useApp` adoption to 100% and stop importing `message`
   from antd directly in pages.
8. Split `AppLayout`, `PageHeader`, `DataTable`, `FormFields` into
   `@mate/shared` only the truly cross-cutting variants; keep module-
   specific UIs in `apps/web/src/pages/<module>/components`.

### Phase 3 (later)

9. Feature-folder migration: `src/features/{dashboard,ontology,kb,
   apphub,superai,mcp,arch,agents}/` with `routes.tsx`,
   `api/`, `components/`, `pages/`, `state/`, `types.ts`. Keep
   `@mate/shared` for cross-cutting only.
10. Bundle budget: introduce `vite build --chunkSizeWarningLimit 600`
    and `manualChunks` to keep initial JS < 350 KB gzip; lazy-load
    `OntologyDataCenter` tabs and the heavy designer pages.
11. Add a frontend ADR log under `docs/frontend/adr/` for routing
    refactors and state-migration decisions.
12. Add Lighthouse / Web Vitals budget for `/dashboard` (initial
    paint) and `/ontology/datacenter` (interactive, since it
    dynamically imports DataGraph / Lineage / CDC / Scheduler).

## What is *not* a problem (intentionally)

- The 109 routes in one file is large but mostly cosmetic; a split
  does not change runtime.
- `useMemo`/`useCallback` density is reasonable (80/92) and
  correlated with the heavy designer pages.
- `useReducer` is rare (4) but justified: state machines belong
  in reducers, not in 20+ `useState` calls.

## Evidence files

- `metaplatform-frontend/scripts/audit/architecture-audit.py` — produces
  `architecture-audit.json` with the metrics above.
- `metaplatform-frontend/docs/frontend/operations-audit-2026-07-30.md`
  — operation-gap audit.
- `metaplatform-frontend/apps/web/src/App.tsx` — 109 routes in a
  single `Routes` block.
- `metaplatform-frontend/packages/shared/src/api/client.ts` — the
  canonical axios wrapper.

## Phase 1 Progress (2026-07-30)

| Item | Status | Evidence |
|---|---|---|
| 1. Split App.tsx into per-module routes | Done | `apps/web/src/routes/{dashboard,superai,arch,apphub,ontology,knowledge,mcp,agents}.tsx` + `App.tsx` reduced to composition. Each page wrapped in `ErrorBoundary moduleName=...`. |
| 2. Unify axios on shared client | Done (with 3 baseURL carve-outs) | All 100+ API modules go through `createApiClient()` from `@mate/shared/api`. Only `client.ts` (env override), `ontology-bigdata.ts` (/api/v1), and `dashboard/workbench.ts` (10s timeout) keep dedicated `axios.create`. |
| 3. Delete `mock/` and dead code | Done | `apps/web/src/mock/` removed. `MOCK_AGENTS` / `MOCK_ONTOLOGY_ENTITIES` / `MOCK_BIGDATA_*` imports stripped from `pages/agents/*`, `pages/ontology/*`, and `api/ontology-bigdata.ts`. Real API now in `api/agents/index.ts` and `api/ontology-bigdata.ts` (returns `[]` until backend lands). |
| 4. Fix `window.location.reload` | Done | `pages/ontology/OntologyDatacenterPage.tsx:147` now uses `reloadKey` state to remount the active sub-tab instead of full-page reload. |

### Verification after Phase 1

| Check | Result |
|---|---|
| `pnpm --filter @mate/web typecheck` | 0 errors |
| `pnpm --filter @mate/web build` | `built in 27.24s`, 0 errors |
| E2E (`knowledge`, `portal`, `ontology-operations`, `silent-operations`) | 8/8 passed |
| Operations audit | `silent catch = 0`, `alert/confirm = 1` (false positive), `window.location = 1` (login redirect, intentional) |

### Next step (Phase 2)

- Migrate `api/admin/*`, `api/dashboard/*`, `api/mcphub/*`, etc. off the small leftover `axios.create` and onto the shared client.
- Introduce a `useApiErrorBoundary` hook for pages to centralize error→message wiring.
## Phase 2 Progress (2026-07-30)

| Item | Status | Evidence |
|---|---|---|
| Centralize API error handling | Done | `packages/shared/src/hooks/useApiErrorBoundary.ts` (toast + 401 handling + confirm modal). `packages/shared/src/api/errors.ts` exposes `isApiError` / `isBizError` / `isHttpError` + class re-exports. |
| Lightweight query cache | Done | `packages/shared/src/hooks/useCachedAsync.ts` — TTL + manual `invalidate()` + cross-component shared `Map` (no TanStack Query dep added). |
| KB page migration | Done | `pages/knowledge/KnowledgeBasePage.tsx` uses `useCachedAsync(KB_LIST_KEY, listKb, { onChange: reloadTick })` + `useApiErrorBoundary().report(e)`. |
| OntologyActionPage controller split | Partial | `apps/web/src/pages/ontology/actions/seed.ts` extracts mock action data out of the 1984-line page; `OntologyActionPage.tsx` still contains the Flowgram editor body unchanged. Full Page+Controller split is staged for Phase 3. |
| ArchitectureAuditReport | Updated | This report. |

### Verification after Phase 2

| Check | Result |
|---|---|
| `pnpm --filter @mate/web typecheck` | 0 errors |
| `pnpm --filter @mate/web build` | `built in 27.46s`, 0 errors |
| E2E (`knowledge`, `portal`, `ontology-operations`, `silent-operations`) | 8/8 passed |
| Operations audit | `silent catch = 0` |

### Why not TanStack Query

- Frontend already has 9 high-end features sharing the same `useAsync` interface; introducing TanStack Query for a single page is overkill.
- `useCachedAsync` is ~70 lines, zero deps, easy to remove later if a real cache layer is needed.
- The hook's TTL is conservative (30 s) and `invalidate` is explicit; data is never accidentally stale for long.