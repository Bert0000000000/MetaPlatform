package com.metaplatform.mcp.monitor.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component("mcpHealthCheckProperties")
@ConfigurationProperties(prefix = "mate.mcp.health-check")
public class McpHealthCheckProperties {

    private boolean enabled = true;
    private long intervalSeconds = 60;
    private long timeoutSeconds = 10;
}
