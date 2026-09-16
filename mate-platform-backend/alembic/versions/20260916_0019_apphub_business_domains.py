"""apphub 业务域 —— 新增 apphub_domains 表与 apphub_apps.business_domain 列。

背景：应用中心此前只有技术分类 ``category``（platform / knowledge / data），
没有业务域维度。本次引入 ``business_domain``（订单域 / 供应链域 / …）作为
独立的业务分类轴，并让业务域本身成为一等实体（可增 / 可改 / 可删）。

两处 DDL 都做存在性守护，原因有二：

1. 本仓库 apphub 的 SQL 层目前只被测试直接调用（``repositories/__init__.py``
   导出的是 in_memory 实现），本地 PG 里连 ``apphub_apps`` 都可能不存在 ——
   参照 ``0018_mcp_api_keys`` 的 restart-safe 模式，表不在就跳过加列。
2. 业务域表带租户 RLS。**不能**把 ``apphub_domains`` 加进
   ``20260801_0008_tenant_rls`` 的 TENANT_TABLES：那条迁移运行在本表创建之前，
   ``ALTER TABLE`` 会直接失败。因此 RLS 在本迁移内随建表一起施加。

Revision ID: 0019_apphub_business_domains
Revises: 0018_mcp_api_keys
Create Date: 2026-09-16
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019_apphub_business_domains"
down_revision: str | Sequence[str] | None = "0018_mcp_api_keys"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DOMAIN_TABLE = "apphub_domains"
APP_TABLE = "apphub_apps"
POLICY = "tenant_isolation"


def _policy_exists(bind: sa.engine.Connection, table: str) -> bool:
    if bind.dialect.name != "postgresql":
        return False
    row = bind.execute(
        sa.text("SELECT 1 FROM pg_policies WHERE tablename = :t AND policyname = :p"),
        {"t": table, "p": POLICY},
    ).first()
    return row is not None


def _apply_tenant_rls(bind: sa.engine.Connection, table: str) -> None:
    """与 20260801_0008_tenant_rls 完全一致的租户隔离策略。"""
    if bind.dialect.name != "postgresql":
        # RLS 是 PostgreSQL 专有；SQLite / MySQL 开发态只靠 db_filter.py 的事件监听。
        return
    if _policy_exists(bind, table):
        return
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {POLICY} ON {table} "
        "USING (tenant_id = current_setting('app.tenant_id')::text) "
        "WITH CHECK (tenant_id = current_setting('app.tenant_id')::text)"
    )
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())

    # --- apphub_domains（新表） ---
    if DOMAIN_TABLE not in existing_tables:
        op.create_table(
            DOMAIN_TABLE,
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("tenant_id", sa.String(64), nullable=False, index=True),
            sa.Column("name", sa.String(256), nullable=False),
            sa.Column("code", sa.String(64), nullable=False),
            sa.Column("icon", sa.String(64), nullable=False, server_default=""),
            sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        )
        op.create_index(
            f"ix_{DOMAIN_TABLE}_tenant_code",
            DOMAIN_TABLE,
            ["tenant_id", "code"],
            unique=True,
        )

    _apply_tenant_rls(bind, DOMAIN_TABLE)

    # --- apphub_apps.business_domain（新列） ---
    if APP_TABLE in existing_tables:
        columns = {c["name"] for c in sa.inspect(bind).get_columns(APP_TABLE)}
        if "business_domain" not in columns:
            op.add_column(
                APP_TABLE,
                sa.Column(
                    "business_domain",
                    sa.String(64),
                    nullable=False,
                    server_default="",
                ),
            )


def downgrade() -> None:
    bind = op.get_bind()
    existing_tables = set(sa.inspect(bind).get_table_names())

    if APP_TABLE in existing_tables:
        columns = {c["name"] for c in sa.inspect(bind).get_columns(APP_TABLE)}
        if "business_domain" in columns:
            op.drop_column(APP_TABLE, "business_domain")

    if DOMAIN_TABLE in existing_tables:
        op.drop_index(f"ix_{DOMAIN_TABLE}_tenant_code", table_name=DOMAIN_TABLE)
        op.drop_table(DOMAIN_TABLE)
