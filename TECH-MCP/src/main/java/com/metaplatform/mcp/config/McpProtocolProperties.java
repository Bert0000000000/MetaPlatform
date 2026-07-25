package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.protocol")
public class McpProtocolProperties {

    private String version = "2025-03-26";

    private long maxMessageSize = 10485760L;

    private int requestTimeoutSeconds = 30;
}