package com.metaplatform.mcp.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "mate.mcp.iam")
public class McpIamProperties {

    private boolean enabled = false;

    private String baseUrl = "http://localhost:8101";

    private String apiKeyHeader = "X-API-Key";

    private String tenantHeader = "X-Tenant-Id";
}