package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.rate-limit")
public class McpRateLimitProperties {

    private boolean enabled = true;

    private int defaultMaxConcurrent = 50;

    private long keyTtlSeconds = 3600L;
}