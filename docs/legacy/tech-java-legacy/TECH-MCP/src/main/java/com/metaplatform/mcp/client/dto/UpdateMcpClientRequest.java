package com.metaplatform.mcp.client.dto;

import lombok.Data;

@Data
public class UpdateMcpClientRequest {

    private String name;
    private String serverUrl;
    private String baseUrl;
    private String clientType;
    private String transportType;
    private String authType;
    private String authToken;
    private Integer timeoutMs;
    private String headers;
    private String serverIds;
    private String config;
}
