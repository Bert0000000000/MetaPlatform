package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.health-check")
public class McpHealthCheckProperties {

    private boolean enabled = true;

    private long intervalSeconds = 30L;

    private long timeoutMs = 5000L;
}