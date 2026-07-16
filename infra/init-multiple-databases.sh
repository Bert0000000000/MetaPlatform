#!/bin/bash
set -e

function create_database() {
    local database=$1
    echo "Checking database '$database'"
    if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tc "SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -q 1; then
        echo "Database '$database' already exists, skipping"
    else
        echo "Creating database '$database'"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $database;"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;"
        echo "Database '$database' created"
    fi
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
        create_database "$db"
    done
    echo "Multiple databases initialization completed"
fi
