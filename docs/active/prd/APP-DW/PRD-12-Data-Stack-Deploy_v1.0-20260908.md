# PRD-12 真实 Paimon / Iceberg / Trino 部署
> 版本: v1.2 · 日期: 2026-09-08 · 状态: [x]（第三批全收口：Trino 483 激活 live（联邦查询 + Iceberg JDBC metastore Roundtrip）+ Paimon 运行面 live（Flink 1.20 + paimon-s3 bundle on MinIO））
> 关联: Sprint 5 / v3.2 阶段 3 / ADR-0017
> FR: FR-DATA-001..004
FR-DATA-001 Trino 单节点部署并接入 metaplatform 网络 [x]
FR-DATA-002 Iceberg 真实表（S3 warehouse on MinIO）建表/写入/查询 [x]（Trino 483 CatalogType 合法值 glue/hive_metastore/jdbc/nessie/rest/snowflake/testing_file_metastore；采用 jdbc metastore——元数据表 iceberg_tables/iceberg_namespace_properties 落 mate-postgres 专用库 iceberg_catalog，数据 parquet + metadata.json 落 mate-warehouse；file-system catalog 系配置误记，Trino 无此 type）
FR-DATA-003 Trino 联邦查询 PostgreSQL（ont 平台真实数据）[x]（ont_object_type 30 行 / ont_individual 16 行经 postgresql catalog 查得）
FR-DATA-004 Paimon 运行面部署 [x]（Flink 1.20 standalone + Paimon 1.1.1 paimon-s3 bundle：CREATE CATALOG（warehouse=s3://mate-warehouse/paimon on MinIO）+ CREATE TABLE + INSERT（Job FINISHED）+ SELECT 3 行留证；lake 布局 bucket-0/manifest/schema/snapshot 落 MinIO）
