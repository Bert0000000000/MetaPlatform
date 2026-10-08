"""Provision only the fixed regression database; RLS specialty stays separate.

Requires explicit ONT_RLS_ADMIN_DSN and PG_DSN. The repository schema and all
auxiliary tables belong to the NOSUPERUSER/NOBYPASSRLS test role. No FORCE RLS
claim is made by this multi-tenant regression fixture setup.
"""

import os

from prepare_ont_rls_test_db import (
    ADMIN_DSN,
    _ensure_database,
    _ensure_pgvector,
    _ensure_role,
    _ensure_table_ownership,
    validate_test_target,
)


def main() -> None:
    test_dsn = os.getenv("PG_DSN", "")
    validate_test_target(ADMIN_DSN, test_dsn)
    _ensure_role()
    _ensure_database()
    _ensure_table_ownership()
    _ensure_pgvector()
    from mate_tech_ont.v2_kernel.pg_repo import PgOntologyRepository

    PgOntologyRepository(dsn=test_dsn)._ensure_schema()
    print("Prepared fixed non-privileged regression database (FORCE RLS tested in ga-014)")


if __name__ == "__main__":
    main()
