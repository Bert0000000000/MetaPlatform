#!/usr/bin/env bash
# ST-7.1.3: 数据隔离脚本 — staging 用 stg_ 前缀
set -euo pipefail

echo "==> 初始化 staging 数据（stg_ 前缀隔离）"

# Postgres
export PGPASSWORD=mate-pass
psql -h localhost -U mate -d mate <<EOF
-- staging 独立 schema
CREATE SCHEMA IF NOT EXISTS stg_mate;
SET search_path TO stg_mate, public;

-- 复用 dev 的表结构（stg_ 前缀）
CREATE TABLE IF NOT EXISTS stg_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id UUID,
    status TEXT,
    source_uri TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
EOF

# Redis 用 DB 1
redis-cli -n 1 FLUSHDB > /dev/null

# MinIO bucket
mc alias set local http://localhost:9000 mate mate-pass
mc mb local/stg-mate-documents || true
mc anonymous set none local/stg-mate-documents

echo "==> Staging 数据隔离完成"
echo "  - Postgres schema: stg_mate"
echo "  - Redis DB: 1"
echo "  - MinIO bucket: stg-mate-documents"