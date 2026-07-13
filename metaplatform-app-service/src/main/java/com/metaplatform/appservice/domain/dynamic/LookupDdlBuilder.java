package com.metaplatform.appservice.domain.dynamic;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.object.AppObjectService;

import java.util.List;
import java.util.regex.Pattern;

/**
 * v1.0.2 B1.3: lookup 字段 DDL 拼接工具 — 纯函数, 无 Spring 依赖, 易单元测试.
 *
 * <p>负责:
 * <ul>
 *   <li>生成 lookup 列的 DDL 类型 (BIGINT)</li>
 *   <li>生成 lookup 索引的 DDL (idx_{table}_{column}_lookup)</li>
 *   <li>校验表名/列名/索引名符合 IDENT_PATTERN</li>
 * </ul>
 *
 * <p>被 {@link DynamicTableService} 调用以确保 lookup 字段有 FK 索引,
 * 提升连表查询性能 (B1.5 listInstances 列表查询).
 */
public final class LookupDdlBuilder {

    /** 与 DynamicTableService.IDENT_PATTERN 一致, 小写字母+数字+下划线. */
    public static final Pattern IDENT_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{0,62}$");

    /** 与 DynamicTableService.TABLE_NAME_PATTERN 一致, data_xxx_xxx. */
    public static final Pattern TABLE_NAME_PATTERN = Pattern.compile("^data_[a-z][a-z0-9_]+$");

    /** lookup 列的 DDL 类型 (外键 ID). */
    public static final String LOOKUP_COLUMN_TYPE = "BIGINT";

    /** lookup 列是否必填: 否 (允许 NULL, 关联可选). */
    public static final boolean LOOKUP_NOT_NULL_DEFAULT = false;

    private LookupDdlBuilder() {}

    /**
     * 判断字段是否为 lookup 类型.
     */
    public static boolean isLookupField(AppObjectService.FieldDef field) {
        return field != null && "lookup".equals(field.type()) && field.lookup() != null;
    }

    /**
     * 生成 lookup 列 DDL 片段.
     *
     * <p>格式: {@code <column_name> BIGINT [NOT NULL]}
     *
     * @param field lookup 字段定义
     * @return DDL 片段 (不含前导逗号)
     */
    public static String buildLookupColumnDef(AppObjectService.FieldDef field) {
        validateColumnName(field.code());
        StringBuilder sb = new StringBuilder();
        sb.append(field.code()).append(" ").append(LOOKUP_COLUMN_TYPE);
        if (Boolean.TRUE.equals(field.required())) {
            sb.append(" NOT NULL");
        }
        return sb.toString();
    }

    /**
     * 生成单条 lookup 索引 DDL.
     *
     * <p>格式: {@code CREATE INDEX idx_<table>_<column>_lookup ON <table>(<column>)}
     *
     * <p>索引名规则:
     * <ul>
     *   <li>前缀 idx_</li>
     *   <li>表名 (去掉 data_ 前缀)</li>
     *   <li>列名</li>
     *   <li>后缀 _lookup (区别于其它索引)</li>
     * </ul>
     *
     * @param tableName 物理表名 (格式 data_xxx_xxx)
     * @param column 列名 (lookup 字段的 code)
     * @return 完整 DDL 语句
     */
    public static String buildLookupIndexDdl(String tableName, String column) {
        validateTableName(tableName);
        validateColumnName(column);
        String indexName = indexName(tableName, column);
        validateIndexName(indexName);
        return "CREATE INDEX " + indexName + " ON " + tableName + "(" + column + ")";
    }

    /**
     * 一次性生成多条 lookup 索引 DDL (批量, 用于 createTable 后批量创建).
     *
     * @param tableName 物理表名
     * @param fields 全部字段定义列表 (内部过滤 lookup 类型)
     * @return DDL 列表 (只含 lookup 字段, 非 lookup 返回空列表)
     */
    public static List<String> buildLookupIndexDdls(String tableName, List<AppObjectService.FieldDef> fields) {
        if (fields == null || fields.isEmpty()) {
            return List.of();
        }
        return fields.stream()
                .filter(LookupDdlBuilder::isLookupField)
                .map(f -> buildLookupIndexDdl(tableName, f.code()))
                .toList();
    }

    /**
     * 删除 lookup 索引 DDL (用于 rollback 或字段删除场景).
     */
    public static String buildDropLookupIndexDdl(String tableName, String column) {
        validateTableName(tableName);
        validateColumnName(column);
        return "DROP INDEX IF EXISTS " + indexName(tableName, column);
    }

    // ──────────────────────────────────────────────────────────
    // 内部工具
    // ──────────────────────────────────────────────────────────

    /** idx_<table>_<column>_lookup 索引名生成. */
    private static String indexName(String tableName, String column) {
        // 表名可能含 data_xxx_xxx, 直接拼接, 长度不超过 DB 限制
        // (Postgres: 63 chars, MySQL: 64 chars, H2: 不限)
        return "idx_" + tableName + "_" + column + "_lookup";
    }

    /** 校验表名格式 (data_xxx_xxx). */
    private static void validateTableName(String tableName) {
        if (tableName == null || !TABLE_NAME_PATTERN.matcher(tableName).matches()) {
            throw ApiException.badRequest("非法表名: " + tableName);
        }
    }

    /** 校验列名格式. */
    private static void validateColumnName(String column) {
        if (column == null || !IDENT_PATTERN.matcher(column).matches()) {
            throw ApiException.badRequest("非法列名: " + column);
        }
    }

    /** 校验索引名长度 (Postgres 63 字符上限). */
    private static void validateIndexName(String indexName) {
        if (indexName.length() > 63) {
            throw ApiException.badRequest(
                "索引名过长 (max 63): " + indexName + " (" + indexName.length() + " chars)");
        }
    }
}