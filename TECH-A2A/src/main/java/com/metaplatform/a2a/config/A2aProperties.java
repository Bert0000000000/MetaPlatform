package com.metaplatform.a2a.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * TECH-A2A 配置属性类，对应 application.yml 中 {@code mate.a2a.*} 前缀。
 *
 * <p>对应 Python {@code app.config.Settings}。
 * 包含外部 A2A Agent / TECH-AGENT / TECH-WFE 地址、JWT 配置、心跳超时等运行参数。</p>
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mate.a2a")
public class A2aProperties {

    /** 外部 A2A Agent 基础地址（JSON-RPC tasks/send 调用）。空字符串启用 mock 模式。 */
    private String agentBaseUrl = "http://localhost:8501";

    /** 外部 A2A Agent 调用超时时间。 */
    private Duration agentTimeout = Duration.ofSeconds(30);

    /** TECH-AGENT 服务基础地址（路由到 Agent 执行）。空字符串启用 mock 模式。 */
    private String agentServiceBaseUrl = "http://localhost:8511";

    /** TECH-AGENT 调用超时时间。 */
    private Duration agentServiceTimeout = Duration.ofSeconds(30);

    /** TECH-WFE 服务基础地址（路由到工作流执行）。空字符串启用 mock 模式。 */
    private String wfeBaseUrl = "http://localhost:8801";

    /** TECH-WFE 调用超时时间。 */
    private Duration wfeTimeout = Duration.ofSeconds(30);

    /** JWT 签名密钥。 */
    private String jwtSecret = "metaplatform-jwt-secret-key-2026";

    /** JWT 签名算法。 */
    private String jwtAlgorithm = "HS256";

    /** Agent 心跳超时秒数。 */
    private long heartbeatTimeoutSeconds = 60L;

    /** Kafka topic：A2A 协议事件发布。 */
    private String kafkaTopic = "a2a-protocol-events";
}
