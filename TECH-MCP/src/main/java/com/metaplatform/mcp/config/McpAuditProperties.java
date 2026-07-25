package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.audit")
public class McpAuditProperties {

    private boolean aopEnabled = true;

    private boolean kafkaOutboxEnabled = true;

    private String outboxTopic = "mcp-audit-events";

    private int maxResponseBytes = 1024;
}