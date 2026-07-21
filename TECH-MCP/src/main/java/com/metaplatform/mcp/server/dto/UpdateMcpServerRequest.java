package com.metaplatform.mcp.server.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateMcpServerRequest {

    private String name;
    private String description;
    private String transportType;
    private String endpointUrl;
    private String host;

    @Min(value = 1, message = "port 必须在 1-65535 之间")
    @Max(value = 65535, message = "port 必须在 1-65535 之间")
    private Integer port;

    private String sseEndpoint;

    @Pattern(regexp = "none|apikey|oauth2", message = "authType 必须是 none、apikey 或 oauth2")
    private String authType;

    private String authConfig;

    @Min(value = 1, message = "timeoutMs 必须大于 0")
    private Integer timeoutMs;

    @Min(value = 1, message = "maxConcurrentCalls 必须大于 0")
    private Integer maxConcurrentCalls;

    private String healthCheckUrl;

    private String config;
}
