"""business domains: rag/ont/agent/mcp/kb/llmgw SQL tables (P3-W4 TD-5)

Adds 19 tables for the 6 remaining business domains:
  - rag:     rag_documents / rag_indexes (2)
  - ont:     ont_ontologies / ont_classes / ont_instances / ont_relations / ont_versions (5)
  - agent:   agent_agents / agent_sessions / agent_messages (3)
  - mcp:     mcp_tools / mcp_resources / mcp_prompts (3)
  - kb:      kb_collections / kb_documents / kb_search_logs (3)
  - llmgw:   llmgw_providers / llmgw_models / llmgw_route_rules (3)

Dict fields are JSON-serialised to TEXT; tuple fields are stored as
newline-separated TEXT; the SQLAlchemy-reserved ``metadata`` attribute
is stored as ``meta`` (rag/kb) or ``ver_meta`` (ont).

Revision ID: 0006_business_domains
Revises: 0005_tech_dw
Create Date: 2026-08-01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_business_domains"
down_revision: Union[str, Sequence[str], None] = "0005_tech_dw"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ===================================================================
    # RAG domain (2 tables)
    # ===================================================================
    op.create_table(
        "rag_documents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("document_id", sa.String(64), default=""),
        sa.Column("filename", sa.String(256), default=""),
        sa.Column("chunk_count", sa.Integer, default=0),
        sa.Column("meta", sa.Text, default="{}"),
        sa.Column("status", sa.String(32), default="indexed"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "rag_indexes",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("backend", sa.String(32), default="memory"),
        sa.Column("chunk_count", sa.Integer, default=0),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("created_at", sa.String(64), default=""),
    )

    # ===================================================================
    # ONT domain (5 tables)
    # ===================================================================
    op.create_table(
        "ont_ontologies",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("namespace", sa.String(64), default="default"),
        sa.Column("description", sa.Text, default=""),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "ont_classes",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("ontology_id", sa.String(64), default=""),
        sa.Column("namespace", sa.String(64), default="default"),
        sa.Column("label", sa.String(256), default=""),
        sa.Column("parent", sa.String(64), nullable=True, default=None),
        sa.Column("properties", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "ont_instances",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("class_id", sa.String(64), default=""),
        sa.Column("namespace", sa.String(64), default="default"),
        sa.Column("properties", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "ont_relations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("type", sa.String(64), default=""),
        sa.Column("src_id", sa.String(64), default=""),
        sa.Column("dst_id", sa.String(64), default=""),
        sa.Column("properties", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "ont_versions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("ontology_id", sa.String(64), default=""),
        sa.Column("version", sa.String(64), default=""),
        sa.Column("parent", sa.String(64), nullable=True, default=None),
        sa.Column("ver_meta", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
    )

    # ===================================================================
    # AGENT domain (3 tables)
    # ===================================================================
    op.create_table(
        "agent_agents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("scenario", sa.String(32), default="S1"),
        sa.Column("model_id", sa.String(128), default=""),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("agent_id", sa.String(64), default=""),
        sa.Column("thread_id", sa.String(64), default=""),
        sa.Column("scenario", sa.String(32), default="S1"),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("thread_id", sa.String(64), default=""),
        sa.Column("role", sa.String(32), default="user"),
        sa.Column("content", sa.Text, default=""),
        sa.Column("tool_calls", sa.Text, default="[]"),
        sa.Column("created_at", sa.String(64), default=""),
    )

    # ===================================================================
    # MCP domain (3 tables)
    # ===================================================================
    op.create_table(
        "mcp_tools",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("input_schema", sa.Text, default="{}"),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "mcp_resources",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("uri", sa.String(512), default=""),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("mime_type", sa.String(128), default=""),
        sa.Column("created_at", sa.String(64), default=""),
    )
    op.create_table(
        "mcp_prompts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("template", sa.Text, default=""),
        sa.Column("arguments", sa.Text, default=""),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )

    # ===================================================================
    # KB domain (3 tables)
    # ===================================================================
    op.create_table(
        "kb_collections",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("description", sa.Text, default=""),
        sa.Column("document_count", sa.Integer, default=0),
        sa.Column("status", sa.String(32), default="active"),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "kb_documents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("collection_id", sa.String(64), default=""),
        sa.Column("document_id", sa.String(64), default=""),
        sa.Column("filename", sa.String(256), default=""),
        sa.Column("size_bytes", sa.Integer, default=0),
        sa.Column("chunk_count", sa.Integer, default=0),
        sa.Column("status", sa.String(32), default="indexed"),
        sa.Column("meta", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "kb_search_logs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("query", sa.Text, default=""),
        sa.Column("mode", sa.String(32), default="hybrid"),
        sa.Column("total_hits", sa.Integer, default=0),
        sa.Column("latency_ms", sa.Integer, default=0),
        sa.Column("created_at", sa.String(64), default=""),
    )

    # ===================================================================
    # LLMGW domain (3 tables)
    # ===================================================================
    op.create_table(
        "llmgw_providers",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(256), default=""),
        sa.Column("provider_type", sa.String(64), default=""),
        sa.Column("base_url", sa.String(512), default=""),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "llmgw_models",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("model_id", sa.String(128), default=""),
        sa.Column("display_name", sa.String(256), default=""),
        sa.Column("provider", sa.String(64), default=""),
        sa.Column("modality", sa.String(32), default="text"),
        sa.Column("max_tokens", sa.Integer, default=4096),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("config", sa.Text, default="{}"),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )
    op.create_table(
        "llmgw_route_rules",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
        sa.Column("model_pattern", sa.String(256), default=""),
        sa.Column("provider", sa.String(64), default=""),
        sa.Column("priority", sa.Integer, default=0),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("created_at", sa.String(64), default=""),
        sa.Column("updated_at", sa.String(64), default=""),
    )


def downgrade() -> None:
    # LLMGW
    op.drop_table("llmgw_route_rules")
    op.drop_table("llmgw_models")
    op.drop_table("llmgw_providers")
    # KB
    op.drop_table("kb_search_logs")
    op.drop_table("kb_documents")
    op.drop_table("kb_collections")
    # MCP
    op.drop_table("mcp_prompts")
    op.drop_table("mcp_resources")
    op.drop_table("mcp_tools")
    # AGENT
    op.drop_table("agent_messages")
    op.drop_table("agent_sessions")
    op.drop_table("agent_agents")
    # ONT
    op.drop_table("ont_versions")
    op.drop_table("ont_relations")
    op.drop_table("ont_instances")
    op.drop_table("ont_classes")
    op.drop_table("ont_ontologies")
    # RAG
    op.drop_table("rag_indexes")
    op.drop_table("rag_documents")
