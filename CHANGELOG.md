# Changelog

All notable changes to the Mate Platform (MetaPlatform) project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v3.1] — 2026-07-31

> BUSINESS-SLICES incremental wave (P2-W2 → P2-W4). Adds 4 new Python app
> packages and upgrades the Dashboard to full ADR-0014 5-step compliance.

### Added

- **4 new Python packages**: `mate-app-hub` (5 endpoints), `mate-app-arch` (27 endpoints), `mate-app-copilot` (33 endpoints), `mate-app-a2a` (10 endpoints) — 75 new endpoints total.
- **Dashboard (`mate-tech-iam`)**: 34 endpoints upgraded with ADR-0014 5-step compliance (`install_auth` + `require_tenant` + outbox).
- **AsyncCopilotClient**: Transport-agnostic LLM client with `BearerAuth` + `OutgoingAuthMiddleware`, supporting `embed` / `chat` / `generate_sql` via a swappable provider (`stub_provider` / `LlmgwProvider`).
- **LlmgwProvider**: Real HTTP LLM gateway provider with circuit-breaker fallback to `stub_provider` on connection failure.
- **Event.create tenant guard**: Empty `tenant_id` now rejected at construction time (defense in depth with `OutboxWriter`).
- **TenantAccessError handler**: Registered in `install_auth()` → returns HTTP 400 (`TENANT_ACCESS_DENIED` / `E_TENANT_REQUIRED`) instead of 500.
- **A2A protocol**: `mate-app-a2a` package with delegation lifecycle (create/status/result) + external agent registration. Copilot `/a2a/delegate` + `/a2a/external` proxy to this service.
- **`forbid_bare_httpx` gate**: Expanded exclude list for client modules (`llmgw_provider.py`, `bearer.py`, `outgoing.py`).

### Changed

- **JWT iss/aud unification**: Dashboard auth now uses Keycloak-format JWT issuer/audience.
- **copilot handlers**: `generate-sql`, `explain-code`, `multimodal-upload` now route through `AsyncCopilotClient` instead of calling `stub_provider` directly.
- **Outbox integration**: Dashboard POST handlers drive the real `InMemoryOutboxWriter` (not mock).
- **Import cleanup**: Hoisted lazy imports to top-level in copilot `api/app.py`.

### Fixed

- **TD-1**: `TenantAccessError` now returns 400 (was 500).
- **TD-7**: pyright strict mode — 0 errors across all new packages (fixed 7 type annotation issues).

### Test metrics

- 228+ tests passing across 6 packages
- 0 ruff errors
- 0 pyright errors
- 0 PR gate violations

### Commits

- `833a809d` feat: P2-W2 batch — 4 domains / 99 endpoints / 93 tests (#12)
- `76fe9df1` fix: TD-1 TenantAccessError → 400 + TD-7 pyright strict 0 errors
- `4f07c481` feat: P2-W3 kickstart — Event.create tenant guard + mate-app-a2a
- `6109a76c` feat: TD-3 copilot A2A proxy + OutgoingAuthMiddleware wiring
- `3e4ef54e` feat: P2-W4 copilot handlers route through AsyncCopilotClient
- `498a0453` feat: TD-6 llmgw_provider — real HTTP LLM gateway with circuit-breaker

## [v3.0] — 2026-07-30

> GA release. 8 / 8 core Delivery Batches Accepted; 13 hard rules closed via
> pre-commit hooks + CI jobs + test coverage. See
> `docs/active/delivery/evidence/GA-ACCEPTANCE.md`.
