package com.metaplatform.data.datasources.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.config.DataProperties;
import com.metaplatform.data.entity.DataSourceEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.util.CryptoUtil;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 外部数据源连接池管理器：基于 HikariCP 按数据源 ID 缓存连接池。
 *
 * <p>提供：</p>
 * <ul>
 *   <li>{@link #getConnection} — 获取真实 JDBC Connection（自动解密凭证）</li>
 *   <li>{@link #testConnection} — 测试连接可达性（带超时）</li>
 *   <li>{@link #invalidate} — 数据源更新/删除时清理连接池</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSourceManager {

    private final DataSourceRepositoryHelper repositoryHelper;
    private final DataProperties dataProperties;
    private final ObjectMapper objectMapper;

    /** 数据源 ID → HikariDataSource 缓存。 */
    private final Map<String, HikariDataSource> poolCache = new ConcurrentHashMap<>();

    /**
     * 测试连接（不缓存连接池，单次连接 + 立即关闭）。
     */
    public TestResult testConnection(String sourceType, Map<String, Object> decryptedConfig) {
        String url = DbUrlBuilder.buildUrl(sourceType, decryptedConfig);
        String driverClass = DbUrlBuilder.driverClass(sourceType);
        String username = getString(decryptedConfig, "username");
        String password = getString(decryptedConfig, "password");

        long start = System.currentTimeMillis();
        try {
            Class.forName(driverClass);
        } catch (ClassNotFoundException e) {
            return new TestResult(false, "JDBC 驱动未找到: " + driverClass, System.currentTimeMillis() - start);
        }

        long timeoutMs = dataProperties.getConnectionTestTimeout().toMillis();
        try (Connection ignored = java.sql.DriverManager.getConnection(url, username, password)) {
            if (!ignored.isValid((int) Math.max(1, timeoutMs / 1000))) {
                return new TestResult(false, "连接验证失败（超时）", System.currentTimeMillis() - start);
            }
            long latency = System.currentTimeMillis() - start;
            log.info("数据源连接测试成功 | url={} latency={}ms", maskUrl(url), latency);
            return new TestResult(true, "连接成功", latency);
        } catch (SQLException e) {
            long latency = System.currentTimeMillis() - start;
            String msg = "连接失败: " + e.getMessage();
            log.warn("数据源连接测试失败 | url={} error={}", maskUrl(url), e.getMessage());
            return new TestResult(false, msg, latency);
        }
    }

    /**
     * 获取数据源对应的连接池 DataSource（按需创建并缓存）。
     */
    public DataSource getDataSource(String datasourceId) {
        return poolCache.computeIfAbsent(datasourceId, this::createPool);
    }

    /**
     * 直接获取 Connection（调用方负责 close）。
     */
    public Connection getConnection(String datasourceId) throws SQLException {
        return getDataSource(datasourceId).getConnection();
    }

    /**
     * 失效连接池（数据源更新/删除时调用）。
     */
    public void invalidate(String datasourceId) {
        HikariDataSource pool = poolCache.remove(datasourceId);
        if (pool != null) {
            pool.close();
            log.info("数据源连接池已清理 | datasourceId={}", datasourceId);
        }
    }

    private HikariDataSource createPool(String datasourceId) {
        DataSourceEntity entity = repositoryHelper.requireDataSource(datasourceId);
        Map<String, Object> config = decryptConfig(entity.getConnectionConfig());
        String url = DbUrlBuilder.buildUrl(entity.getSourceType(), config);
        String driverClass = DbUrlBuilder.driverClass(entity.getSourceType());

        HikariConfig hc = new HikariConfig();
        hc.setJdbcUrl(url);
        hc.setDriverClassName(driverClass);
        hc.setUsername(getString(config, "username"));
        hc.setPassword(getString(config, "password"));
        hc.setPoolName("ds-" + datasourceId);
        hc.setMaximumPoolSize(dataProperties.getPool().getMaxPoolSize());
        hc.setMinimumIdle(dataProperties.getPool().getMinIdle());
        hc.setConnectionTimeout(dataProperties.getPool().getConnectionTimeoutMs());
        hc.setIdleTimeout(dataProperties.getPool().getIdleTimeoutMs());
        hc.setMaxLifetime(dataProperties.getPool().getMaxLifetimeMs());
        hc.setReadOnly(true);

        log.info("创建数据源连接池 | datasourceId={} url={} poolSize={}",
                datasourceId, maskUrl(url), dataProperties.getPool().getMaxPoolSize());
        return new HikariDataSource(hc);
    }

    private Map<String, Object> decryptConfig(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            ObjectNode mutable = node.deepCopy();
            if (mutable.has("password") && mutable.has("passwordEncrypted")
                    && mutable.get("passwordEncrypted").asBoolean()) {
                String cipher = mutable.get("password").asText();
                mutable.put("password", CryptoUtil.decrypt(cipher, dataProperties.getDataEncryptionKey()));
            }
            return objectMapper.convertValue(mutable, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            throw new DataException(ErrorCode.INTERNAL_ERROR, "connectionConfig 解析失败: " + e.getMessage(), e);
        }
    }

    private static String getString(Map<String, Object> config, String key) {
        Object v = config.get(key);
        return v != null ? String.valueOf(v) : null;
    }

    private static String maskUrl(String url) {
        return url.replaceAll("password=[^&]*", "password=***");
    }

    /**
     * 测试连接结果。
     */
    public record TestResult(boolean success, String message, long latencyMs) {
    }
}
