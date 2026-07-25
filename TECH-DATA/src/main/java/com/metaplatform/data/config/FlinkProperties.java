package com.metaplatform.data.config;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Flink REST API 配置（对应 application.yml 中 {@code mate.flink.*}）。
 *
 * <p>Flink 集群未部署时 {@code enabled=false}，EtlTaskService 降级到 Spring Batch 本地执行。</p>
 */
@Getter
@Setter
@Slf4j
@Configuration
@ConfigurationProperties(prefix = "mate.flink")
public class FlinkProperties {

    /** Flink JobManager REST API 地址。 */
    private String restUrl = "http://localhost:8081";

    /** 是否启用 Flink 引擎（false 时降级 Spring Batch）。 */
    private boolean enabled = false;

    /** 提交 Job 超时（毫秒）。 */
    private long submitTimeoutMs = 30_000L;

    /** 轮询 Job 状态间隔（毫秒）。 */
    private long pollIntervalMs = 2_000L;
}
