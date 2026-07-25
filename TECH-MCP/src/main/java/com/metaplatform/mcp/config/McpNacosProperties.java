package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.nacos")
public class McpNacosProperties {

    private boolean registryEnabled = true;

    private String namespace = "metaplatform";

    private String mcpServerGroup = "mcp-servers";

    private String mcpToolGroup = "mcp-tools";
}