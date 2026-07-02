#!/usr/bin/env bash
# ============================================================================
# init-multi-db.sh — PostgreSQL multi-database initializer
# ============================================================================
# Creates all MetaPlatform databases in a single PostgreSQL instance.
# Designed to run as a docker-entrypoint-initdb.d script or standalone.
#
# Usage (standalone):
#   ./scripts/init-multi-db.sh
#
# Usage (docker-compose volume):
#   volumes:
#     - ./scripts/init-multi-db.sh:/docker-entrypoint-initdb.d/init-multi-db.sh
# ============================================================================
set -euo pipefail

# --- Default values (overridable via environment) ---
POSTGRES_USER="${POSTGRES_USER:-meta}"
POSTGRES_DB="${POSTGRES_DB:-metaplatform}"

# All databases needed by MetaPlatform services
DATABASES=(
  platform_base
  ai_substrate
  ontology_meta
  data_stack
  page_generator
  dialogue
  capability
  process_engine
  rag_mdm
)

echo "================================================"
echo " MetaPlatform — Multi-Database Initialization"
echo "================================================"
echo "Superuser : ${POSTGRES_USER}"
echo "Databases : ${#DATABASES[@]}"
echo ""

for db in "${DATABASES[@]}"; do
  echo "  -> Creating database: ${db}"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" <<-EOSQL
    SELECT 'CREATE DATABASE ${db}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
EOSQL

  # Grant full privileges so the application user can operate
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${db}" <<-EOSQL
    GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${POSTGRES_USER};
EOSQL
done

echo ""
echo "All databases created successfully."
echo "================================================"
