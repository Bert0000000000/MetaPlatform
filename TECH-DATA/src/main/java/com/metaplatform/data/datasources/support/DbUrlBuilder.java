package com.metaplatform.data.datasources.support;

import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.exception.DataException;

import java.util.Map;

/**
 * 数据库 JDBC URL 构建器：按 sourceType 适配不同数据库的 URL 模板。
 *
 * <p>支持的数据库类型：postgresql / mysql / starrocks / clickhouse / hive。</p>
 */
public final class DbUrlBuilder {

    private DbUrlBuilder() {
    }

    /**
     * 根据 sourceType + connectionConfig 构建 JDBC URL。
     *
     * <p>connectionConfig 必须包含 host；可选 port、database、ssl、extraParams。</p>
     */
    public static String buildUrl(String sourceType, Map<String, Object> config) {
        if (config == null || !config.containsKey("host")) {
            throw DataException.invalidParam("connectionConfig 缺少 host 字段");
        }
        String host = String.valueOf(config.get("host"));
        int port = parseIntOrDefault(config.get("port"), defaultPort(sourceType));
        String database = config.containsKey("database")
                ? String.valueOf(config.get("database"))
                : "";
        boolean ssl = parseBoolOrDefault(config.get("ssl"), false);
        String extra = config.containsKey("extraParams")
                ? String.valueOf(config.get("extraParams"))
                : "";

        return switch (sourceType.toLowerCase()) {
            case "postgresql" -> {
                StringBuilder sb = new StringBuilder("jdbc:postgresql://").append(host).append(":").append(port);
                if (!database.isEmpty()) sb.append("/").append(database);
                if (ssl) appendParam(sb, "sslmode", "require", sb.indexOf("?") < 0);
                if (!extra.isEmpty()) appendExtra(sb, extra);
                yield sb.toString();
            }
            case "mysql", "starrocks" -> {
                // StarRocks 兼容 MySQL 协议，使用 mysql-connector-j 驱动
                StringBuilder sb = new StringBuilder("jdbc:mysql://").append(host).append(":").append(port);
                if (!database.isEmpty()) sb.append("/").append(database);
                if (ssl) appendParam(sb, "useSSL", "true", sb.indexOf("?") < 0);
                if (!extra.isEmpty()) appendExtra(sb, extra);
                yield sb.toString();
            }
            case "clickhouse" -> {
                StringBuilder sb = new StringBuilder("jdbc:clickhouse://").append(host).append(":").append(port);
                if (!database.isEmpty()) sb.append("/").append(database);
                if (ssl) appendParam(sb, "ssl", "true", sb.indexOf("?") < 0);
                if (!extra.isEmpty()) appendExtra(sb, extra);
                yield sb.toString();
            }
            case "hive" -> {
                StringBuilder sb = new StringBuilder("jdbc:hive2://").append(host).append(":").append(port);
                if (!database.isEmpty()) sb.append("/").append(database);
                if (!extra.isEmpty()) appendExtra(sb, extra);
                yield sb.toString();
            }
            case "iceberg", "hudi" -> {
                // Hudi/Iceberg 通常通过 Hive/Trino/Presto JDBC 访问
                StringBuilder sb = new StringBuilder("jdbc:trino://").append(host).append(":").append(port);
                if (!database.isEmpty()) sb.append("/").append(database);
                if (!extra.isEmpty()) appendExtra(sb, extra);
                yield sb.toString();
            }
            default -> throw new DataException(ErrorCode.UNSUPPORTED_SOURCE_TYPE,
                    "不支持的 sourceType: " + sourceType);
        };
    }

    /**
     * 根据 sourceType 返回 JDBC Driver 类名。
     */
    public static String driverClass(String sourceType) {
        return switch (sourceType.toLowerCase()) {
            case "postgresql" -> "org.postgresql.Driver";
            case "mysql", "starrocks" -> "com.mysql.cj.jdbc.Driver";
            case "clickhouse" -> "com.clickhouse.jdbc.ClickHouseDriver";
            case "hive" -> "org.apache.hive.jdbc.HiveDriver";
            case "iceberg", "hudi" -> "io.trino.jdbc.TrinoDriver";
            default -> throw new DataException(ErrorCode.UNSUPPORTED_SOURCE_TYPE,
                    "不支持的 sourceType: " + sourceType);
        };
    }

    private static int defaultPort(String sourceType) {
        return switch (sourceType.toLowerCase()) {
            case "postgresql" -> 5432;
            case "mysql", "starrocks" -> 3306;
            case "clickhouse" -> 8123;
            case "hive" -> 10000;
            case "iceberg", "hudi" -> 8080;
            default -> throw new DataException(ErrorCode.UNSUPPORTED_SOURCE_TYPE,
                    "不支持的 sourceType: " + sourceType);
        };
    }

    private static int parseIntOrDefault(Object value, int defaultValue) {
        if (value == null) return defaultValue;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static boolean parseBoolOrDefault(Object value, boolean defaultValue) {
        if (value == null) return defaultValue;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private static void appendParam(StringBuilder sb, String key, String value, boolean first) {
        sb.append(first ? "?" : "&").append(key).append("=").append(value);
    }

    private static void appendExtra(StringBuilder sb, String extra) {
        if (extra == null || extra.isEmpty()) return;
        String prefix = sb.indexOf("?") < 0 ? "?" : "&";
        if (extra.startsWith("?") || extra.startsWith("&")) {
            sb.append(extra);
        } else {
            sb.append(prefix).append(extra);
        }
    }
}
