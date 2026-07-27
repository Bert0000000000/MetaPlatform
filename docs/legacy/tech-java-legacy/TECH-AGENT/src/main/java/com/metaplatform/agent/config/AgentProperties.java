package com.metaplatform.agent.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * TECH-AGENT 配置属性类，对应 application.yml 中 {@code mate.agent.*} 前缀。
 *
 * <p>包含上游服务地址（LLMGW / Action / RAG）、JWT 配置、Kafka topic 等运行参数。</p>
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mate.agent")
public class AgentProperties {

    /** LLM Gateway 基础地址。 */
    private String llmgwBaseUrl = "http://localhost:8210";

    /** LLM Gateway 调用超时时间。 */
    private Duration llmgwTimeout = Duration.ofSeconds(30);

    /** Action 服务基础地址。 */
    private String actionBaseUrl = "http://localhost:8104";

    /** Action 服务调用超时时间。 */
    private Duration actionTimeout = Duration.ofSeconds(30);

    /** RAG 服务基础地址。 */
    private String ragBaseUrl = "http://localhost:8901";

    /** RAG 服务调用超时时间。 */
    private Duration ragTimeout = Duration.ofSeconds(30);

    private String ontologyBaseUrl = "http://localhost:8201";

    private String iamBaseUrl = "";

    private Duration iamTimeout = Duration.ofSeconds(10);

    private Duration ontologyTimeout = Duration.ofSeconds(30);

    /** JWT 签名密钥（HS256/HS384/HS512 共用）。 */
    private String jwtSecret = "mate-platform-default-secret-key-must-be-over-32-bytes";

    /** JWT 签名算法（如 HS256 / HS384 / HS512）。 */
    private String jwtAlgorithm = "HS384";

    /** Kafka topic：Agent 执行事件发布。 */
    private String kafkaTopic = "agent-execution-events";

    /** Agent 执行最大并发数（Graph Core 节点并行度上限）。 */
    private int maxConcurrency = 16;

    /** Agent 单次执行最大步数（防止无限循环）。 */
    private int maxSteps = 50;

    /** Agent 单次执行超时时间。 */
    private Duration executionTimeout = Duration.ofMinutes(10);
}
