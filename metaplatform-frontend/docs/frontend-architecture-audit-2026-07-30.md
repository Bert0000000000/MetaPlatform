# Frontend Architecture Audit (2026-07-30)

## Current target architecture

The frontend is a single React 19 SPA. The only deployable browser application is:

- `apps/web` (`@mate/web`)

Supporting workspace packages are:

- `packages/shared`: shared layout, authentication, API client, hooks and design primitives.
- `bff`: optional Node BFF; it is not a browser application.

Ontology Studio is a product/domain name, not a separate SPA. Its current implementation lives under:

- `apps/web/src/pages/ontology`
- `apps/web/src/api/ontology-bigdata.ts`
- `apps/web/src/types/ontology-bigdata.ts`

The supported browser routes are `/ontology`, `/ontology/datacenter`, `/ontology/action`, and `/ontology/graph`.

## Findings

### P0: The single SPA did not start

`apps/web/src/App.tsx` referenced deleted `Admin*Page` components. JavaScript threw `AdminUsersPage is not defined` while creating `AppRoutes`, leaving every route blank. The duplicated routes have been removed in favor of the existing `DashboardAdmin*Page` routes.

### P0: Delivery definitions still described seven SPAs

`Dockerfile` copied deleted app manifests and built `@mate/portal`; `docker-compose.yml` attempted to start portal, dashboard, superai, apphub, arch, dw and mcphub independently. Both files now build and serve only `@mate/web`.

### P1: OntStudio appeared to still exist

The tracked `apps/ontstudio` application was deleted in commit `12842ea0`, but an ignored `apps/ontstudio/node_modules` directory remained on the workstation. It contained no source or manifest. That ignored directory was moved out of `metaplatform-frontend/apps`; it was not a functioning application.

Historical product documentation still uses `APP-ONTSTUDIO`. That name may remain as a business capability identifier, but technical documents and commands must not refer to `apps/ontstudio`, a separate port, or a separate deployment.

### P1: CI intentionally skipped the only application

The CI filter selected every app except `apps/web`. After the monorepo shrink this meant that CI checked no browser application. A temporary single-SPA structure audit now verifies that only `apps/web` exists. It must be replaced by mandatory typecheck/build once migration errors are fixed.

### P1: Type safety gate is red

The current `@mate/web` typecheck reports 458 errors. The largest clusters are Ontology/Data views, SuperAI and DW evaluation. These are migration integrity problems, not React 19 problems.

### P1: API contract mismatch in KB

The frontend KB client calls `/api/v1/kb/knowledge-bases` and `/documents`, while the implemented Python `mate-app-kb` OpenAPI exposes `/api/v1/app-kb/upload`, `/search`, `/chat`, and `/stats`. A service contract owner must decide whether TECH-KB is missing from this checkout or the frontend is targeting an obsolete API.

### P2: Module boundaries are directory-only

`App.tsx` contains more than 100 route declarations and imports every domain route. Each domain should export a route module, for example `pages/ontology/routes.tsx`, so broken symbols in one domain cannot invalidate unrelated route configuration.

### P2: Oversized files

High-risk files include `OntologyActionPage.tsx` (about 2,000 lines), SuperAI Chat, MCP audit statistics and several designers. Split view, state/controller, API adapter and domain types. Target fewer than 400 lines for page containers.

### P2: Generated and backup artifacts are tracked

The repository tracks `playwright-report`, `test-results`, and `OntologyActionPage.tsx.bak`. These should be removed from Git and blocked by `.gitignore`.

### P2: Mixed lockfiles and package ownership

The supported package manager is pnpm, but ignored nested `package-lock.json` files are present. Keep only the root `pnpm-lock.yaml`; add a repository check that fails on nested npm/yarn lockfiles.

## Recommended execution order

1. Fix shared Ontology/Data type exports and API models to collapse the largest TypeScript error cluster.
2. Restore missing DW evaluation types and SuperAI hook/type exports.
3. Make `pnpm --filter @mate/web typecheck` and `build` mandatory in CI.
4. Align KB frontend calls with the authoritative OpenAPI contract.
5. Split `App.tsx` into domain route modules and introduce route-level error boundaries.
6. Remove tracked reports/backups and enforce workspace hygiene checks.
7. Update active technical documentation from multi-SPA deployment language to single-SPA modules; retain APP names only as business capability labels.
