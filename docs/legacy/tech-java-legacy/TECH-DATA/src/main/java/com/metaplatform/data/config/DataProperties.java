package com.metaplatform.data.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * TECH-DATA 配置属性类，对应 application.yml 中 {@code mate.data.*} 前缀。
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mate.data")
public class DataProperties {

    /** AES-256 凭证加密密钥（SHA-256 派生 32 字节）。 */
    private String dataEncryptionKey = "metaplatform-data-key-2026";

    /** 数据源连接测试超时时间。 */
    private Duration connectionTestTimeout = Duration.ofSeconds(5);

    /** SQL 查询最大返回行数。 */
    private int queryMaxRows = 10000;

    /** SQL 查询执行超时（秒）。 */
    private int queryTimeoutSeconds = 30;

    /** Kafka topic：数据集成事件发布。 */
    private String kafkaTopic = "data-integration-events";

    /** 数据湖默认存储格式（Hudi 主 / Iceberg 备）。 */
    private String lakehouseFormat = "hudi";

    /** OLAP 引擎类型（StarRocks 主）。 */
    private String olapEngine = "starrocks";

    /** 外部数据源连接池配置。 */
    private Pool pool = new Pool();

    @Getter
    @Setter
    public static class Pool {
        /** HikariCP 最大连接数（按 DataSource 隔离）。 */
        private int maxPoolSize = 5;
        /** HikariCP 最小空闲连接。 */
        private int minIdle = 1;
        /** 连接超时（毫秒）。 */
        private long connectionTimeoutMs = 10_000L;
        /** 空闲超时（毫秒）。 */
        private long idleTimeoutMs = 600_000L;
        /** 连接最大生命周期（毫秒）。 */
        private long maxLifetimeMs = 1_800_000L;
    }
}
