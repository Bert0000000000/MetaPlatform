package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp")
public class McpRootProperties {

    private Map<String, String> builtin;

    private McpProtocolProperties protocol;

    private McpNacosProperties nacos;

    private McpCacheProperties cache;

    private McpRateLimitProperties rateLimit;

    private McpAlertProperties alert;

    private McpHealthCheckProperties healthCheck;

    private McpAuditProperties audit;

    private McpIamProperties iam;
}