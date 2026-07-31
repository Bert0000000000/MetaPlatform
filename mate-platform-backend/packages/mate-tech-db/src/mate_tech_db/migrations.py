"""DDL migrations — raw SQL for initial table creation.

In v3.2 we use raw SQL (not Alembic) to keep dependencies minimal.
Tables are also auto-created by SQLAlchemy create_all() when models
are defined with mapped columns.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import text

INITIAL_SCHEMA = """
-- Copilot tables (tenant-scoped)
CREATE TABLE IF NOT EXISTS copilot_conversations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    summary TEXT DEFAULT '',
    message_count INTEGER DEFAULT 0,
    created_at VARCHAR(64) DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cc_tenant ON copilot_conversations(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_queries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    sql TEXT NOT NULL,
    datasource_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'ok',
    row_count INTEGER DEFAULT 0,
    created_at VARCHAR(64) DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cq_tenant ON copilot_queries(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_plans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    goal TEXT NOT NULL,
    steps TEXT DEFAULT '',  -- JSON-encoded
    status VARCHAR(32) DEFAULT 'draft'
);
CREATE INDEX IF NOT EXISTS idx_cp_tenant ON copilot_plans(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_intents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    keywords TEXT DEFAULT '',  -- comma-separated
    confidence REAL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_ci_tenant ON copilot_intents(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_templates (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ct_tenant ON copilot_templates(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_actions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) DEFAULT 'general',
    keywords TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ca_tenant ON copilot_actions(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_datasources (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(64) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(32) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_cd_tenant ON copilot_datasources(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_knowledge_bases (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT DEFAULT '',
    doc_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ckb_tenant ON copilot_knowledge_bases(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_models (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    provider VARCHAR(128) NOT NULL,
    modality VARCHAR(64) DEFAULT 'multimodal',
    status VARCHAR(32) DEFAULT 'available'
);
CREATE INDEX IF NOT EXISTS idx_cm_tenant ON copilot_models(tenant_id);

CREATE TABLE IF NOT EXISTS copilot_assets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    filename VARCHAR(512) NOT NULL,
    content_type VARCHAR(128) DEFAULT 'application/octet-stream',
    embedding_dim INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cas_tenant ON copilot_assets(tenant_id);
"""


def run_migrations(session: Any) -> None:
    """Execute the initial schema DDL."""
    for raw_stmt in INITIAL_SCHEMA.strip().split(";"):
        stmt = raw_stmt.strip()
        if stmt:
            session.execute(text(stmt))
    session.commit()
