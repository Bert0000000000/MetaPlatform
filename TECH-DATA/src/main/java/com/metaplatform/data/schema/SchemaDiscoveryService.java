package com.metaplatform.data.schema;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.datasources.support.DataSourceManager;
import com.metaplatform.data.datasources.support.DataSourceRepositoryHelper;
import com.metaplatform.data.entity.DataSourceEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.schema.dto.ColumnListResponse;
import com.metaplatform.data.schema.dto.DatabaseListResponse;
import com.metaplatform.data.schema.dto.TableListResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Schema 发现服务：通过真实 JDBC DatabaseMetaData 发现 databases / tables / columns。
 *
 * <p>对应 Python app/services/schema_discovery_service.py 的 SchemaDiscoveryService。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaDiscoveryService {

    private static final String POSTGRESQL = "postgresql";

    private final DataSourceManager dataSourceManager;
    private final DataSourceRepositoryHelper repositoryHelper;

    /**
     * 列出数据源下的所有数据库。
     *
     * <p>PostgreSQL 使用 {@code SELECT datname FROM pg_database WHERE datistemplate = false}，
     * 其他数据库使用 {@code SHOW DATABASES}。</p>
     */
    public DatabaseListResponse listDatabases(String datasourceId) {
        DataSourceEntity ds = repositoryHelper.requireDataSource(datasourceId);
        List<String> databases = new ArrayList<>();

        try (Connection conn = dataSourceManager.getConnection(datasourceId)) {
            if (POSTGRESQL.equalsIgnoreCase(ds.getSourceType())) {
                collectPostgresDatabases(conn, databases);
            } else {
                collectDatabasesByShow(conn, databases);
            }
        } catch (SQLException e) {
            log.warn("数据库列表发现失败 | ds={} error={}", datasourceId, e.getMessage());
            throw new DataException(ErrorCode.SCHEMA_DISCOVERY_FAILED,
                    "数据库列表发现失败: " + e.getMessage(), e);
        }

        log.info("数据库列表发现 | ds={} type={} count={}", datasourceId, ds.getSourceType(), databases.size());
        return DatabaseListResponse.builder()
                .datasourceId(ds.getId())
                .databases(databases)
                .build();
    }

    /**
     * 列出指定数据库下的所有表。
     *
     * <p>使用 {@link DatabaseMetaData#getTables(String, String, String, String[])}，
     * PostgreSQL schemaPattern=public，其他 catalog=database。</p>
     */
    public TableListResponse listTables(String datasourceId, String database) {
        DataSourceEntity ds = repositoryHelper.requireDataSource(datasourceId);
        List<TableListResponse.TableInfo> tables = new ArrayList<>();
        boolean isPostgres = POSTGRESQL.equalsIgnoreCase(ds.getSourceType());

        try (Connection conn = dataSourceManager.getConnection(datasourceId)) {
            DatabaseMetaData metaData = conn.getMetaData();
            String catalog = isPostgres ? null : database;
            String schemaPattern = isPostgres ? "public" : null;

            try (ResultSet rs = metaData.getTables(catalog, schemaPattern, "%",
                    new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    tables.add(TableListResponse.TableInfo.builder()
                            .name(rs.getString("TABLE_NAME"))
                            .type(rs.getString("TABLE_TYPE"))
                            .engine(ds.getSourceType())
                            .rowCount(0L)
                            .dataSizeBytes(0L)
                            .build());
                }
            }
        } catch (SQLException e) {
            log.warn("表列表发现失败 | ds={} db={} error={}", datasourceId, database, e.getMessage());
            throw new DataException(ErrorCode.SCHEMA_DISCOVERY_FAILED,
                    "表列表发现失败: " + e.getMessage(), e);
        }

        log.info("表列表发现 | ds={} db={} count={}", datasourceId, database, tables.size());
        return TableListResponse.builder()
                .datasourceId(ds.getId())
                .database(database)
                .tables(tables)
                .build();
    }

    /**
     * 列出指定表的所有列。
     *
     * <p>使用 {@link DatabaseMetaData#getColumns(String, String, String, String)} +
     * {@link DatabaseMetaData#getPrimaryKeys(String, String, String)} 判断主键。</p>
     */
    public ColumnListResponse listColumns(String datasourceId, String database, String table) {
        DataSourceEntity ds = repositoryHelper.requireDataSource(datasourceId);
        List<ColumnListResponse.ColumnInfo> columns = new ArrayList<>();
        boolean isPostgres = POSTGRESQL.equalsIgnoreCase(ds.getSourceType());

        try (Connection conn = dataSourceManager.getConnection(datasourceId)) {
            DatabaseMetaData metaData = conn.getMetaData();
            String catalog = isPostgres ? null : database;
            String schemaPattern = isPostgres ? "public" : null;

            // 先查主键集合
            Set<String> primaryKeys = collectPrimaryKeys(metaData, catalog, schemaPattern, table);

            try (ResultSet rs = metaData.getColumns(catalog, schemaPattern, table, "%")) {
                while (rs.next()) {
                    String columnName = rs.getString("COLUMN_NAME");
                    columns.add(ColumnListResponse.ColumnInfo.builder()
                            .name(columnName)
                            .dataType(rs.getString("TYPE_NAME"))
                            .nullable("YES".equalsIgnoreCase(rs.getString("IS_NULLABLE")))
                            .defaultValue(rs.getString("COLUMN_DEF"))
                            .comment(rs.getString("REMARKS"))
                            .primaryKey(primaryKeys.contains(columnName))
                            .ordinalPosition(rs.getInt("ORDINAL_POSITION"))
                            .build());
                }
            }
        } catch (SQLException e) {
            log.warn("列信息发现失败 | ds={} db={} table={} error={}",
                    datasourceId, database, table, e.getMessage());
            throw new DataException(ErrorCode.SCHEMA_DISCOVERY_FAILED,
                    "列信息发现失败: " + e.getMessage(), e);
        }

        log.info("列信息发现 | ds={} db={} table={} count={}", datasourceId, database, table, columns.size());
        return ColumnListResponse.builder()
                .datasourceId(ds.getId())
                .database(database)
                .table(table)
                .columns(columns)
                .build();
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private void collectPostgresDatabases(Connection conn, List<String> databases) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")) {
            while (rs.next()) {
                databases.add(rs.getString(1));
            }
        }
    }

    private void collectDatabasesByShow(Connection conn, List<String> databases) throws SQLException {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SHOW DATABASES")) {
            while (rs.next()) {
                databases.add(rs.getString(1));
            }
        }
    }

    private Set<String> collectPrimaryKeys(DatabaseMetaData metaData, String catalog,
                                            String schema, String table) throws SQLException {
        Set<String> pkColumns = new HashSet<>();
        try (ResultSet rs = metaData.getPrimaryKeys(catalog, schema, table)) {
            while (rs.next()) {
                pkColumns.add(rs.getString("COLUMN_NAME"));
            }
        } catch (SQLException e) {
            // 部分驱动对无主键表 getPrimaryKeys 可能抛异常，忽略后继续
            log.debug("主键查询忽略异常 | table={} error={}", table, e.getMessage());
        }
        return pkColumns;
    }
}
