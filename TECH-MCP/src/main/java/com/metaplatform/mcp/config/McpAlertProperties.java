package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.alert")
public class McpAlertProperties {

    private boolean enabled = true;

    private long scanIntervalMs = 60000L;

    private String alertTopic = "mcp-alert-events";

    private String msgBaseUrl;
}