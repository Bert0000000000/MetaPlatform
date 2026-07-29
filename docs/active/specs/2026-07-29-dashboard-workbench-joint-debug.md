# Dashboard Workbench Joint Debug Report

> Date: 2026-07-29
> Owner: Mate Platform Team
> Status: PASSED (31/31 endpoints)

## Goal

工作台（Dashboard / @mate/dashboard）前后端联调启动。联调范围：
- 前端: `metaplatform-frontend/apps/dashboard` Vite dev (port 9230)
- 后端: `mate-platform-backend/packages/mate-tech-iam` uvicorn (port 8102)
- 路径：vite proxy `/api/v1/{dashboard,iam,admin}` -> `http://localhost:8102`

## Context

Dashboard workbench is the platform home page (FR-DASH-001..010). It
aggregates data from many sources (TECH-RAG, TECH-MSG, TECH-OBS, TECH-WFE,
TECH-AGENT, TECH-ONT). Until now it had no real backend; the prior
`vite.config.ts` proxied `/api/v1/dashboard` to port 9001 (no listener).

The IAM service (port 8102) already ships a complete FastAPI surface for
`/api/v1/iam/*` and `/api/v1/admin/*` (W3-1 / W3-5 deliverable), plus
CORS, lifespan, DB, seed users. The cleanest minimal-risk path was to add a
new `/api/v1/dashboard/*` router alongside the existing IAM routers, share
the running process, and update the vite proxy.

## Delivered

### 1. Backend router (29 endpoints)
`packages/mate-tech-iam/src/mate_tech_iam/api/dashboard.py`

Self-contained mock store (in-memory, process-local). Shapes match the
TypeScript types in `metaplatform-frontend/apps/dashboard/src/types/`.

| Bucket       | Endpoints |
|--------------|-----------|
| auth         | `POST /auth/login` |
| profile      | `GET /profile`, `GET /profile/permissions` |
| settings     | `GET /settings`, `PUT /settings`, `GET /sessions`, `DELETE /sessions/{id}` |
| api-keys     | `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/{id}` |
| notifications | `GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/{id}/read`, `POST /notifications/read-all`, `GET /notifications/settings`, `PUT /notifications/settings` |
| metrics      | `GET /metrics`, `GET /metrics/trend` |
| todos        | `GET /todos`, `GET /todos/done`, `POST /todos/{id}/action` |
| workers      | `GET /workers` |
| deliverables | `GET /deliverables`, `POST /deliverables/{id}/download`, `DELETE /deliverables/{id}` |
| anomalies    | `GET /anomalies`, `GET /anomalies/{id}`, `POST /anomalies/{id}/analyze`, `POST /anomalies/{id}/remediate` |
| anomaly-rules | `GET /anomaly-rules`, `POST /anomaly-rules`, `PUT /anomaly-rules/{id}`, `DELETE /anomaly-rules/{id}` |
| search       | `GET /search?keyword=...` |

### 2. IAM main.py wiring
- Imported `dashboard_router` from `mate_tech_iam.api`
- Re-exported in `api/__init__.py`
- Registered with `app.include_router(dashboard_router)` next to `configs_router`

### 3. Vite proxy rewrite
`metaplatform-frontend/apps/dashboard/vite.config.ts`
- `/api/v1/dashboard` -> `http://localhost:8102` (was `9001`)

### 4. One-click dev launcher
`start-dashboard-dev.ps1`

```powershell
.\start-dashboard-dev.ps1            # start
.\start-dashboard-dev.ps1 -Status    # show status
.\start-dashboard-dev.ps1 -E2E       # run 31 endpoint e2e tests
.\start-dashboard-dev.ps1 -Stop      # stop
```

The script wraps the IAM uvicorn launcher with the required `IAM_DATA_DIR`
env var (defaults to `/data`, does not exist on Windows dev box) and
launches the Vite dev server via `node ./node_modules/vite/bin/vite.js`
to bypass pnpm script quirks.

## End-to-end verification (31/31 OK)

```
[OK] POST /auth/login -> 200
[OK] GET  /profile -> 200
[OK] GET  /profile/permissions -> 200
[OK] GET  /settings -> 200
[OK] PUT  /settings -> 200
[OK] GET  /sessions -> 200
[OK] GET  /api-keys -> 200
[OK] POST /api-keys -> 200
[OK] GET  /notifications -> 200
[OK] GET  /notifications/unread-count -> 200
[OK] GET  /notifications/settings -> 200
[OK] PUT  /notifications/settings -> 200
[OK] GET  /metrics -> 200
[OK] GET  /metrics/trend -> 200
[OK] GET  /todos -> 200
[OK] GET  /todos/done -> 200
[OK] POST /todos/action -> 200
[OK] GET  /workers -> 200
[OK] GET  /deliverables -> 200
[OK] POST /deliverables/download -> 200
[OK] GET  /anomalies -> 200
[OK] GET  /anomalies/{id} -> 200
[OK] POST /anomalies/analyze -> 200
[OK] POST /anomalies/remediate -> 200
[OK] GET  /anomaly-rules -> 200
[OK] POST /anomaly-rules -> 200
[OK] GET  /search -> 200
[OK] POST /iam/auth/login -> 200
[OK] GET  /iam/auth/me -> 200
[OK] GET  /admin/users -> 200
[OK] GET  /admin/permissions/catalog -> 200
=== TOTAL: 31 passed, 0 failed ===
```

## Open questions / next steps

1. **Replace mock store** with real backing services when their APIs land:
   - `notifications/*` -> TECH-MSG (port 8106) event bus
   - `todos/*` -> TECH-WFE / Flowable 8 (port 8202/8203)
   - `metrics/*` -> TECH-OBS (port 8083)
   - `deliverables/*` -> TECH-AGENT artifact storage
   - `anomalies/*` -> TECH-OBS metrics + TECH-AGENT analysis
2. **JWT interoperability**: `/api/v1/dashboard/auth/login` currently returns
   a synthetic bearer (`mb_at_...`) instead of a real HS256 JWT. Real
   IAM admin endpoints (`/api/v1/admin/*`) reject it with 401/403. Once
   we wire the dashboard login to delegate to `/api/v1/iam/auth/login`,
   the same JWT can serve both surfaces.
3. **Promotion path**: When the workbench graduates from mock to real
   backing, extract `dashboard.py` into its own package
   `packages/mate-tech-dashboard/` (port 9001) so the IAM admin process
   stays focused on identity + governance.
4. **Document sync**: update `docs/active/specs/INTEGRATION-MODULE-IAM-ADMIN.md`
   to call out the new dashboard router (currently lists Dashboard as the
   "next" deliverable).