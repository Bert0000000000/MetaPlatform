# MP11 existing demo metadata upgrade

Date: 2026-10-13. Scope: the user-authorized main integration and Tencent demo upgrade. This is an implementation and validation record; it is not GA acceptance.

The current cloud can contain AppHub and MCP tables created before the new publication fields and key grants. SQLAlchemy `create_all` does not add columns to an existing table, so an otherwise healthy process could fail on its first business read.

Use `infra/demo-cloud/configure_schema.py` before the two actual AppHub/MCP uvicorn entry points. The CLI accepts only PostgreSQL at `postgres:5432/metaplatform`, rejects URL overrides, and verifies `current_database()` before mutation. A transaction advisory lock serializes both processes. Bootstrap also calls the helper before business seed and acceptance.

The helper reuses official migrations `0021_apphub_publication` and `0022_mcp_key_scopes`. It inspects three target tables, creates a missing target table from its ORM, and adds only the nine known missing fields. It does not stamp Alembic history or run migrations from an invented legacy revision. Existing type/nullability conflicts and unsafe grants stop the upgrade. Existing rows, key hashes, unrelated tables, and the existing migration marker are retained. New legacy key grants default to `[]`; capability access requires a human-issued key with verified grants.

Existing scope defaults are accepted only as the complete empty TEXT literal, with an optional `::text` cast and balanced surrounding parentheses. The helper rejects operators, functions, JSON casts and concatenation without evaluating the expression or querying key rows. The Docker build allowlist includes the helper, the exact two migration files and their required parent directories; secret and cache exclusions remain in force.

Validation separates actual databases from substitutes:

- Local SQLite/CLI/default-expression checks: 36 passed, 0 skipped. The complete file collects 53 cases; the original 35 remain covered.
- Seventeen PostgreSQL cases require the owned CI database and a role with NOSUPERUSER, NOBYPASSRLS, NOCREATEDB and NOCREATEROLE. Each fixture uses an owned UUID schema. Missing prerequisites fail. CI runs the complete file and checks its JUnit for zero skips. These PostgreSQL cases have not been executed locally.
- Tests cover retained records and key hashes, all nine safe defaults, repeat execution with zero mutations, absent-table initialization, schema/grant conflicts, existing approved grants, and transaction lock contention.
- A JSON-concatenation default reproduced an incorrect acceptance before the parser fix. Additional PostgreSQL cases inspect real compound defaults; fresh-table lifecycle cases retain an issued read grant and key hash across a zero-mutation restart using the existing official ORM default.
- Cloud regression suite: 43 passed, including startup refusal after upgrade failure and preservation of the original service command.
- Frozen runtime export includes Alembic through mate-tech-db and signature crypto through mate-platform. All 230 existing locked package versions remain unchanged.

The deployment controller must keep its existing backup, exact-main CI gate, actual-image checks and verified rollback. Database upgrades are additive; application rollback does not downgrade schema or replace identity configuration. Actual PostgreSQL, Keycloak/browser CI and Tencent deployment are still separate required evidence.
