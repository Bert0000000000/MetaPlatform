"""Mock data-source catalog used until real JDBC metadata is wired."""

from __future__ import annotations

from app.models.schemas import ColumnInfo, DataSourceMetadata, TableInfo


_MOCK_SOURCES: dict[str, DataSourceMetadata] = {
    "ds-ecommerce": DataSourceMetadata(
        sourceId="ds-ecommerce",
        sourceName="电商主库",
        sourceType="postgresql",
        tables=[
            TableInfo(
                name="users",
                schemaName="public",
                comment="用户表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(name="email", type="varchar", nullable=False),
                    ColumnInfo(name="nickname", type="varchar"),
                    ColumnInfo(name="created_at", type="timestamp"),
                ],
            ),
            TableInfo(
                name="orders",
                schemaName="public",
                comment="订单表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(
                        name="user_id",
                        type="bigint",
                        nullable=False,
                        isForeignKey=True,
                        referencedTable="users",
                        referencedColumn="id",
                    ),
                    ColumnInfo(name="order_no", type="varchar", nullable=False),
                    ColumnInfo(name="total_amount", type="decimal"),
                    ColumnInfo(name="status", type="varchar"),
                    ColumnInfo(name="created_at", type="timestamp"),
                ],
            ),
            TableInfo(
                name="order_items",
                schemaName="public",
                comment="订单明细表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(
                        name="order_id",
                        type="bigint",
                        nullable=False,
                        isForeignKey=True,
                        referencedTable="orders",
                        referencedColumn="id",
                    ),
                    ColumnInfo(name="product_id", type="bigint", nullable=False),
                    ColumnInfo(name="quantity", type="integer"),
                    ColumnInfo(name="price", type="decimal"),
                ],
            ),
            TableInfo(
                name="products",
                schemaName="public",
                comment="商品表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(name="sku", type="varchar", nullable=False),
                    ColumnInfo(name="name", type="varchar"),
                    ColumnInfo(name="category_id", type="bigint"),
                ],
            ),
        ],
    ),
    "ds-crm": DataSourceMetadata(
        sourceId="ds-crm",
        sourceName="CRM 数据库",
        sourceType="mysql",
        tables=[
            TableInfo(
                name="customers",
                schemaName="crm",
                comment="客户表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(name="company_name", type="varchar"),
                    ColumnInfo(name="contact_phone", type="varchar"),
                ],
            ),
            TableInfo(
                name="leads",
                schemaName="crm",
                comment="线索表",
                columns=[
                    ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True),
                    ColumnInfo(
                        name="customer_id",
                        type="bigint",
                        isForeignKey=True,
                        referencedTable="customers",
                        referencedColumn="id",
                    ),
                    ColumnInfo(name="source", type="varchar"),
                    ColumnInfo(name="score", type="integer"),
                ],
            ),
        ],
    ),
}


def list_sources() -> list[DataSourceMetadata]:
    """Return all registered mock data sources."""
    return list(_MOCK_SOURCES.values())


def get_source(source_id: str) -> DataSourceMetadata | None:
    """Return a single mock data source by id."""
    return _MOCK_SOURCES.get(source_id)
