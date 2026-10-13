# Issue #139: Excel modeling source in the Tencent demo

Status: In progress. Base: dc8980d3e129e94f0bc55190705ede7cbe304ba0.

The deployed Excel modeling sync-check fails because the demo Compose overlay does not pass ONT_MODELING_SOURCE_DSN. Ingestion writes tenant-scoped staging in the kernel database and requires its backing-source reader to connect to that same database. Reuse the nonprivileged mate_app connection and existing private ONT_APP_PASSWORD; no database, role, schema or API changes are needed. The registered PostgreSQL source in #112 is a separate configuration path.

1. Reproduce the missing environment variable in the actual merged Compose configuration, using disposable generated settings without starting containers.
2. Set ONT_MODELING_SOURCE_DSN to the kernel database DSN in the Tencent overlay. Preserve service checks, RLS, source baseline validation and explicit user review.
3. Add a synthetic Excel upload -> reviewed draft -> publication -> sync-check -> instance/relationship readback probe to fresh cloud release verification. Retry the same source and verify stable instance/link counts; preserve the probe receipt for subsequent read-only validation. Never ingest existing enterprise batches as release test data.
4. Run deployment regressions and local validation; collect real PostgreSQL and browser results in PR CI, with no mandatory skips. Refresh main before push and merge, and resolve any overlap without changing other worktrees.
5. Wait for all checks on the exact merge SHA, Tencent deployment result and synthetic cloud readback. Keep original enterprise-batch acceptance distinct; users can retry that existing batch once the environment is repaired.

Authority: existing modeling API operations ontCheckModelingDataSync, ontSyncModelingSource; ADR-0080 and ADR-0082; HARD-RULES-MATRIX. No contract change or business ontology definition is introduced.

Rollback retains the previous application artifacts and the existing database backups. Do not reset databases, restart Docker globally, delete volumes, remove worktrees or overwrite primary-checkout WIP. Local Docker daemon availability is independent of offline Compose config verification and hosted CI PostgreSQL services.
