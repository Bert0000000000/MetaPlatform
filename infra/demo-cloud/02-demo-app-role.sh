#!/usr/bin/env bash
set -euo pipefail

# New volumes only: the PostgreSQL image executes this after the base DB script.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --set "app_password=$ONT_APP_PASSWORD" <<'SQL'
CREATE ROLE mate_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
ALTER DATABASE metaplatform SET app.tenant_id = '';
ALTER DATABASE metaplatform_ont SET app.tenant_id = '';
SQL

for database in metaplatform metaplatform_ont; do
    psql --username "$POSTGRES_USER" --dbname "$database" --set ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
GRANT CONNECT ON DATABASE metaplatform TO mate_app;
GRANT CONNECT ON DATABASE metaplatform_ont TO mate_app;
GRANT USAGE, CREATE ON SCHEMA public TO mate_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mate_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mate_app;
SQL
done
