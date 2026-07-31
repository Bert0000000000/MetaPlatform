# mate-tech-db

SQLAlchemy 2.0 persistence layer for Mate Platform. Provides `Base`, a session
factory, and the `Repository` protocol that app packages implement for
Postgres-backed storage.

- `base.py` — declarative `Base`, global engine + session factory
  (`init_engine`, `get_session`, `create_all`).
- `protocol.py` — `Repository` runtime-checkable protocol (tenant-scoped).
- `migrations.py` — raw-SQL DDL for the initial tenant-scoped schema.

Dev/test uses SQLite; production uses PostgreSQL.
