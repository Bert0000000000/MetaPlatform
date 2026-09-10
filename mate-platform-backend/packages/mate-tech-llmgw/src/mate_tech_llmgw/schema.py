"""Operator entry: apply llmgw DDL against a target DSN.

Usage:
    python -m mate_tech_llmgw.schema            # apply (PG_DSN or --dsn)
    python -m mate_tech_llmgw.schema --print    # print DDL only
    python -m mate_tech_llmgw.schema --downgrade  # print rollback SQL only

The schema is applied idempotently at service startup (repositories.ddl.
ensure_schema); this CLI exists for release runbooks and CI pre-flight.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

from .repositories.ddl import DOWNGRADE_SQL, LLMGW_SCHEMA_SQL, ensure_schema

DEFAULT_DSN = "postgresql://mate:mate@localhost:5432/metaplatform_kb"


async def _apply(dsn: str) -> int:
    import asyncpg

    conn = await asyncpg.connect(dsn)
    try:
        await ensure_schema(conn)
    finally:
        await conn.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="llmgw schema operator CLI")
    parser.add_argument("--dsn", default=os.getenv("PG_DSN", DEFAULT_DSN))
    parser.add_argument("--print", action="store_true", help="print DDL and exit")
    parser.add_argument("--downgrade", action="store_true", help="print rollback SQL and exit")
    args = parser.parse_args(argv)

    if args.downgrade:
        print(DOWNGRADE_SQL)
        return 0
    if args.print:
        print(LLMGW_SCHEMA_SQL)
        return 0
    return asyncio.run(_apply(args.dsn))


if __name__ == "__main__":
    sys.exit(main())
